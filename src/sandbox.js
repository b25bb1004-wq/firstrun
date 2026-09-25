import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { run, must, sleep, shortId, shq, tail } from './util.js';

/**
 * A clean machine for one run: a long-lived container that behaves like a
 * newcomer's terminal. Shell state (cwd, exported variables, activated venvs)
 * carries over between steps, the way it does when someone types the README
 * commands one after another. Backing services (Postgres, Redis, ...) run as
 * sidecars that share the container's network namespace, so `localhost:5432`
 * works exactly as it would on a laptop.
 */
const FATAL = /Failed running '|\[nodemon\] app crashed|Traceback \(most recent call last\)|UnhandledPromiseRejection|ECONNREFUSED|EADDRINUSE|Error: Cannot find module|ERROR:\s+Application startup failed|Error loading ASGI app|ModuleNotFoundError|ImportError|RuntimeError:|Missing required environment variable|Waiting for file changes before restarting/;

/** The port a dev server says it is listening on, from lines such as "Uvicorn running on http://0.0.0.0:8000",
 * "Listening on port 4000", "Local: http://localhost:5173/", "Server started at http://127.0.0.1:8080". */
export function announcedPort(out) {
  const lines = String(out || '').split('\n').filter((l) => /running|listening|started|serving|available|local:|ready/i.test(l));
  for (const l of lines.reverse()) {
    const m = l.match(/(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::\]|\[::1\]|[\w.-]+\.local):(\d{2,5})\b/i) || l.match(/\bport\s*[:=]?\s*(\d{2,5})\b/i);
    if (m) { const p = Number(m[1]); if (p >= 80 && p <= 65535) return p; }
  }
  return null;
}

export class Sandbox {
  constructor({ image, repoDir, label = 'firstrun', patches = [], log = () => {} }) {
    this.image = image;
    this.repoDir = repoDir;
    this.label = label;
    this.patches = patches; // [{ path, content }] applied over the clone (used by replay)
    this.log = log;
    this.name = `firstrun-${shortId()}`;
    this.services = [];
    this.seq = 0;
    this.started = false;
  }

  async ensureImage(image = this.image) {
    const has = await run('docker', ['image', 'inspect', image, '--format', '{{.Id}}']);
    if (has.code === 0) return;
    this.log(`pulling ${image}…`);
    const r = await run('docker', ['pull', image], { timeoutMs: 15 * 60_000 });
    if (r.code !== 0) throw new Error(`cannot pull ${image}: ${tail(r.out, 5)}`);
  }

  async start() {
    await this.ensureImage();
    await must('docker', ['run', '-d', '--name', this.name, '--label', `firstrun=${this.label}`, '--entrypoint', 'sleep',
      '-e', 'CI=true', '-e', 'DEBIAN_FRONTEND=noninteractive', '-e', 'NO_COLOR=1', '-e', 'FORCE_COLOR=0',
      '-e', 'npm_config_fund=false', '-e', 'npm_config_audit=false', '-e', 'npm_config_update_notifier=false',
      '-e', 'PIP_DISABLE_PIP_VERSION_CHECK=1', '-e', 'PIP_ROOT_USER_ACTION=ignore', '-e', 'PYTHONUNBUFFERED=1',
      '-w', '/workspace', this.image, 'infinity']);
    this.started = true;
    await this.sh('mkdir -p /workspace /firstrun && echo /workspace > /firstrun/cwd && : > /firstrun/state.env');
    await this.installShims();
    // Official Node images bundle Yarn 1; a newcomer who installs Node from nodejs.org
    // does not have it. Remove it so the sandbox matches a fresh machine.
    if (/^node:/.test(this.image)) await this.sh('rm -f /usr/local/bin/yarn /usr/local/bin/yarnpkg; rm -rf /opt/yarn-*');
    await this.copyRepo();
    for (const p of this.patches) await this.writeFile(p.path, p.content);
  }

  /**
   * Commands a newcomer's laptop has that the clean machine doesn't, translated without touching the docs:
   * - sudo: the container already runs as root, so it just runs the command.
   * - docker / docker-compose called from scripts (a justfile, a Makefile): there is no daemon here.
   *   "up" asks FirstRun (exit 97 + /firstrun/services.request) to start the services as sidecars,
   *   then the step is retried and the shim sees they are running.
   */
  async installShims() {
    const sudo = [
      '#!/bin/sh',
      '# FirstRun: the clean machine runs as root, so sudo just runs the command.',
      'while [ $# -gt 0 ]; do case "$1" in -u|-g|-C|-D|-h|-p|-r|-t|-U) shift 2;; --) shift; break;; -*) shift;; *) break;; esac; done',
      'exec "$@"',
    ].join('\n');
    const docker = [
      '#!/bin/sh',
      '# FirstRun: no Docker daemon on the clean machine; FirstRun starts services as sidecars.',
      'me=$(basename "$0"); cmd="$me $*"',
      'case " $* " in',
      '  *" up "*|*" start "*|"run "*|" run "*)',
      '    if [ -f /firstrun/services.done ] && grep -qxF "$cmd" /firstrun/services.done; then echo "[firstrun] services from \'$cmd\' are already running"; exit 0; fi',
      '    printf "%s\\n%s\\n" "$(pwd)" "$cmd" > /firstrun/services.request; exit 97;;',
      '  *" ps "*|*" logs "*|*" down "*|*" stop "*|*" pull "*|*" version "*) echo "[firstrun] \'$cmd\' does nothing on the clean machine"; exit 0;;',
      '  *) echo "[firstrun] \'$cmd\' is not available on the clean machine (no Docker daemon)" >&2; exit 1;;',
      'esac',
    ].join('\n');
    // Container images ship without apt package lists, and a person answers apt's [Y/n] prompt;
    // a fresh laptop has lists and a human at the keyboard.
    const apt = [
      '#!/bin/sh',
      '# FirstRun: behave like apt on a fresh machine with someone answering its prompt.',
      'real=/usr/bin/$(basename "$0")',
      'if [ -z "$(ls -A /var/lib/apt/lists 2>/dev/null | grep -v -e lock -e partial)" ]; then /usr/bin/apt-get update -qq >/dev/null 2>&1; fi',
      'case "$1" in install|upgrade|dist-upgrade|remove) exec "$real" -y "$@";; *) exec "$real" "$@";; esac',
    ].join('\n');
    await this.writeFile('/firstrun/shims/apt', apt);
    await this.writeFile('/firstrun/shims/sudo', sudo);
    await this.writeFile('/firstrun/shims/docker', docker);
    await this.sh([
      'chmod +x /firstrun/shims/*',
      'command -v sudo >/dev/null || ln -s /firstrun/shims/sudo /usr/local/bin/sudo',
      '{ [ ! -x /usr/bin/apt-get ] || { ln -sf /firstrun/shims/apt /usr/local/bin/apt-get && ln -sf /firstrun/shims/apt /usr/local/bin/apt; }; }',
      'command -v docker >/dev/null || ln -s /firstrun/shims/docker /usr/local/bin/docker',
      'command -v docker-compose >/dev/null || ln -s /firstrun/shims/docker /usr/local/bin/docker-compose',
    ].join(' && '));
  }

  /** Copy what `git clone` would give a newcomer: tracked files only, no local node_modules or .env. */
  async copyRepo() {
    const isGit = fs.existsSync(path.join(this.repoDir, '.git'));
    const producer = isGit
      ? spawn('git', ['-C', this.repoDir, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { windowsHide: true })
      : null;
    let fileList = null;
    if (producer) {
      fileList = await new Promise((resolve) => {
        let buf = '';
        producer.stdout.on('data', (d) => { buf += d; });
        producer.on('close', () => resolve(buf.split('\0').filter(Boolean).filter((f) => fs.existsSync(path.join(this.repoDir, f)))));
      });
    }
    const listFile = path.join(this.repoDir, '.firstrun-filelist');
    const args = ['-c', '-f', '-', '-C', this.repoDir];
    if (fileList) {
      fs.writeFileSync(listFile, fileList.filter((f) => !f.startsWith('.firstrun')).join('\n'));
      args.push('-T', listFile);
    } else {
      for (const ex of ['node_modules', '.firstrun', '.firstrun-work', '.venv', 'venv', '__pycache__', '.env', '.git', '.firstrun-filelist']) args.push(`--exclude=${ex}`);
      args.push('.');
    }
    await new Promise((resolve, reject) => {
      const tar = spawn('tar', args, { windowsHide: true });
      const dock = spawn('docker', ['exec', '-i', this.name, 'tar', '-x', '-f', '-', '-C', '/workspace'], { windowsHide: true });
      let err = '';
      tar.stderr.on('data', (d) => { err += d; });
      dock.stderr.on('data', (d) => { err += d; });
      tar.stdout.pipe(dock.stdin);
      dock.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`copying repo into sandbox failed: ${err}`))));
    }).finally(() => { try { fs.unlinkSync(listFile); } catch {} });
  }

  /** Run a raw command in the container (no shell-state wrapper). */
  sh(script, { timeoutMs = 120_000 } = {}) {
    return run('docker', ['exec', this.name, 'bash', '-c', script], { timeoutMs });
  }

  async writeFile(relPath, content) {
    const abs = relPath.startsWith('/') ? relPath : `/workspace/${relPath}`;
    const r = await run('docker', ['exec', '-i', this.name, 'bash', '-c', `mkdir -p "$(dirname ${shq(abs)})" && cat > ${shq(abs)}`], { input: content });
    if (r.code !== 0) throw new Error(`write ${relPath}: ${r.out}`);
  }

  async readFile(relPath) {
    const abs = relPath.startsWith('/') ? relPath : `/workspace/${relPath}`;
    const r = await run('docker', ['exec', this.name, 'cat', abs]);
    return r.code === 0 ? r.out : null;
  }

  async exists(relPath) {
    const abs = relPath.startsWith('/') ? relPath : `/workspace/${relPath}`;
    return (await run('docker', ['exec', this.name, 'test', '-e', abs])).code === 0;
  }

  wrap(command) {
    return [
      'source /firstrun/state.env >/dev/null 2>&1',
      'cd "$(cat /firstrun/cwd 2>/dev/null || echo /workspace)"',
      'exec </dev/null',
      command,
      '__fr_ec=$?',
      'export -p | grep -v -E "^declare -x (OLDPWD|PWD|SHLVL|_)=" > /firstrun/state.env',
      'pwd > /firstrun/cwd',
      'exit $__fr_ec',
      '',
    ].join('\n');
  }

  /**
   * Run one step the way a person would type it. Returns
   * { exitCode, out, durationMs }. `onData` streams output.
   */
  async exec(command, { onData, timeoutMs = 20 * 60_000, detectServer = true } = {}) {
    const id = ++this.seq;
    await this.writeFile(`/firstrun/step-${id}.sh`, this.wrap(command));
    const secs = Math.ceil(timeoutMs / 1000);
    const started = Date.now();
    let soFar = '';
    const baseline = detectServer ? await this.listeningPorts() : [];
    let finished = false;
    const runP = run('docker', ['exec', this.name, 'timeout', '--kill-after=10', String(secs), 'bash', `/firstrun/step-${id}.sh`], {
      onData: (d) => { soFar += d; onData?.(d); }, timeoutMs: timeoutMs + 30_000,
    }).then((r) => { finished = true; return { r }; });
    // A README step that never exits but starts listening is a server the docs
    // didn't label as one ("npm start" hidden behind a custom script name).
    const watcher = detectServer ? (async () => {
      await sleep(12_000);
      while (!finished) {
        const svc = this.services.map((s) => s.port);
        const fresh = (await this.listeningPorts()).filter((p) => p < 32768 && !baseline.includes(p) && !svc.includes(p));
        if (fresh.length && !finished) return { server: fresh[0] };
        await sleep(3000);
      }
      return new Promise(() => {});
    })() : new Promise(() => {});
    const first = await Promise.race([runP, watcher]);
    if (first.server) {
      return { exitCode: 0, out: `${soFar}\n[firstrun] still running and listening on port ${first.server}: treating this step as the app server\n`, durationMs: Date.now() - started, detectedServer: first.server };
    }
    const r = first.r;
    let out = r.out;
    if (r.code === 124) out += `\n[firstrun] step timed out after ${secs}s\n`;
    return { exitCode: r.code, out, durationMs: r.durationMs };
  }

  /** TCP ports in LISTEN state inside the sandbox (read from /proc; no tools needed). */
  async listeningPorts() {
    const r = await run('docker', ['exec', this.name, 'sh', '-c', 'cat /proc/net/tcp /proc/net/tcp6 2>/dev/null']);
    const ports = new Set();
    for (const line of r.out.split('\n')) {
      const cols = line.trim().split(/\s+/);
      if (cols[3] === '0A' && cols[1]?.includes(':')) ports.add(parseInt(cols[1].split(':').pop(), 16));
    }
    return [...ports];
  }

  /**
   * Start a long-running command (a dev server) in the background and wait
   * until it is reachable on `port`, it prints `readyPattern`, or it dies.
   */
  async serve(command, { port, readyPattern, timeoutMs = 120_000, onData } = {}) {
    const id = ++this.seq;
    const logFile = `/firstrun/serve-${id}.log`;
    // Persist state before backgrounding so the server sees exported vars / venv.
    await this.writeFile(`/firstrun/step-${id}.sh`, [
      'source /firstrun/state.env >/dev/null 2>&1',
      'cd "$(cat /firstrun/cwd 2>/dev/null || echo /workspace)"',
      'exec </dev/null',
      command,
      '',
    ].join('\n'));
    const started = Date.now();
    await run('docker', ['exec', '-d', this.name, 'bash', '-c', `setsid bash /firstrun/step-${id}.sh > ${logFile} 2>&1 & echo $! > /firstrun/serve-${id}.pid; wait`]);
    let seen = 0;
    let lastOut = '';
    let crashSeenAt = 0;
    let crashLen = 0;
    const ready = readyPattern ? new RegExp(readyPattern, 'i') : null;
    while (Date.now() - started < timeoutMs) {
      await sleep(1000);
      const logR = await run('docker', ['exec', this.name, 'cat', logFile]);
      lastOut = logR.out;
      if (lastOut.length > seen) { onData?.(lastOut.slice(seen)); seen = lastOut.length; }
      const alive = (await run('docker', ['exec', this.name, 'bash', '-c', `pid=$(cat /firstrun/serve-${id}.pid 2>/dev/null); [ -n "$pid" ] && kill -0 $pid 2>/dev/null`])).code === 0;
      const portOpen = port ? (await run('docker', ['exec', this.name, 'bash', '-c', `(echo > /dev/tcp/127.0.0.1/${port}) >/dev/null 2>&1`])).code === 0 : false;
      if (portOpen || (ready && ready.test(lastOut))) {
        return { exitCode: 0, out: lastOut, durationMs: Date.now() - started, pidFile: `/firstrun/serve-${id}.pid` };
      }
      // The app may announce a different port than the one we guessed ("Uvicorn running on
      // http://0.0.0.0:8000"). If that port is really listening, the app is up.
      const announced = announcedPort(lastOut);
      if (announced && announced !== port && (await run('docker', ['exec', this.name, 'bash', '-c', `(echo > /dev/tcp/127.0.0.1/${announced}) >/dev/null 2>&1`])).code === 0) {
        return { exitCode: 0, out: `${lastOut}\n[firstrun] the app is listening on port ${announced} (it says so in its output)${port ? `, not ${port}` : ''}\n`, durationMs: Date.now() - started, pidFile: `/firstrun/serve-${id}.pid`, port: announced };
      }
      // Watchers (node --watch, nodemon, uvicorn --reload) keep running after the app crashes.
      if (FATAL.test(lastOut)) {
        crashSeenAt = crashSeenAt || Date.now();
        if (lastOut.length !== crashLen) { crashLen = lastOut.length; crashSeenAt = Date.now(); }
        if (Date.now() - crashSeenAt > 6000) {
          return { exitCode: 1, out: `${lastOut}\n[firstrun] the server crashed during startup and is not listening${port ? ` on port ${port}` : ''}\n`, durationMs: Date.now() - started };
        }
      }
      if (!alive && Date.now() - started > 2000) {
        return { exitCode: 1, out: `${lastOut}\n[firstrun] server process exited before becoming ready${port ? ` on port ${port}` : ''}\n`, durationMs: Date.now() - started };
      }
    }
    return { exitCode: 124, out: `${lastOut}\n[firstrun] server did not become ready${port ? ` on port ${port}` : ''} within ${Math.round(timeoutMs / 1000)}s\n`, durationMs: Date.now() - started };
  }

  /** HTTP probe from inside the container (the app listens on its own localhost). */
  async probe(url, { timeoutMs = 30_000 } = {}) {
    const started = Date.now();
    let last;
    while (Date.now() - started < timeoutMs) {
      last = await run('docker', ['exec', this.name, 'bash', '-c',
        `if command -v curl >/dev/null; then curl -sS -o /tmp/fr-body -w '%{http_code}' --max-time 10 ${shq(url)}; else python3 -c "import urllib.request,sys;r=urllib.request.urlopen(sys.argv[1],timeout=10);open('/tmp/fr-body','wb').write(r.read());print(r.status,end='')" ${shq(url)}; fi`]);
      const code = Number(last.out.trim().slice(-3));
      if (code >= 200 && code < 400) {
        const body = (await run('docker', ['exec', this.name, 'head', '-c', '600', '/tmp/fr-body'])).out;
        return { ok: true, status: code, body, durationMs: Date.now() - started };
      }
      await sleep(1500);
    }
    return { ok: false, status: Number(last?.out.trim().slice(-3)) || 0, body: tail(last?.out || '', 10), durationMs: Date.now() - started };
  }

  /**
   * Start a backing service as a sidecar sharing this container's network, so
   * the app reaches it on localhost like on a developer laptop.
   */
  async addService({ name, image, env = {}, port }) {
    if (this.services.some((s) => s.name === name)) return { already: true };
    await this.ensureImage(image);
    const ctr = `${this.name}-${name}`.replace(/[^a-zA-Z0-9_.-]/g, '-');
    const args = ['run', '-d', '--name', ctr, '--label', `firstrun=${this.label}`, '--network', `container:${this.name}`];
    for (const [k, v] of Object.entries(env)) args.push('-e', `${k}=${v}`);
    args.push(image);
    await must('docker', args);
    this.services.push({ name, image, env, port, container: ctr });
    if (port) {
      const started = Date.now();
      while (Date.now() - started < 60_000) {
        const open = (await run('docker', ['exec', this.name, 'bash', '-c', `(echo > /dev/tcp/127.0.0.1/${port}) >/dev/null 2>&1`])).code === 0;
        if (open) {
          if (/postgres/i.test(image)) {
            // The port opens during initdb; wait for the real server.
            for (let i = 0; i < 30; i++) {
              if ((await run('docker', ['exec', ctr, 'pg_isready', '-q', '-h', '127.0.0.1'])).code === 0) break;
              await sleep(1000);
            }
            await sleep(1500);
          }
          return { ready: true, ms: Date.now() - started };
        }
        await sleep(1000);
      }
      return { ready: false };
    }
    return { ready: true };
  }

  /** Throw away this machine and start again from a different base image. */
  async rebase(image) {
    const services = this.services.map(({ name, image: img, env, port }) => ({ name, image: img, env, port }));
    await this.stop();
    this.image = image;
    this.name = `firstrun-${shortId()}`;
    this.services = [];
    this.seq = 0;
    await this.start();
    for (const s of services) await this.addService(s);
  }

  async stop() {
    const names = [...this.services.map((s) => s.container), this.name];
    if (this.started) await run('docker', ['rm', '-f', '-v', ...names]);
    this.started = false;
  }
}

/** Remove leftovers from crashed runs. */
export async function cleanupAll(label = null) {
  const r = await run('docker', ['ps', '-aq', '--filter', label ? `label=firstrun=${label}` : 'label=firstrun']);
  const ids = r.out.split(/\s+/).filter(Boolean);
  if (ids.length) await run('docker', ['rm', '-f', '-v', ...ids]);
  return ids.length;
}
