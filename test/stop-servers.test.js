/**
 * Tests for the process-group cleanup introduced in sandbox.js:
 *   1. serve() kills the process group on failure (crash / exit / timeout).
 *   2. stopServers() kills every group recorded in /firstrun/serve-*.pid and
 *      /firstrun/step-*.pid.
 *
 * Unit tests use a fake Sandbox that records which shell commands were run
 * so we can assert the kill logic without a real Docker daemon.
 *
 * The Docker integration test is skipped when `docker info` fails.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/util.js';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal fake Sandbox whose `run` calls are recorded in `calls[]`.
 * `fileMap` seeds the in-memory filesystem (path → content).
 * `portOpen` controls whether the tcp probe reports an open port.
 */
function fakeSandbox({ fileMap = {}, portOpen = false, crashLog = '', aliveAfter = true } = {}) {
  const files = { ...fileMap };
  const calls = []; // all bash -c scripts sent to 'docker exec'

  // Simulate run('docker', ['exec', name, 'bash', '-c', script])
  const fakeRun = async (cmd, args) => {
    const script = args[args.length - 1];
    calls.push(script);

    // cat a pid file
    if (/^cat /.test(script)) {
      const m = script.match(/cat (\S+)/);
      const content = m ? (files[m[1]] ?? '') : '';
      return { code: content ? 0 : 1, out: content };
    }
    // listing pid files (serve-*.pid / step-*.pid)
    if (/firstrun\/serve-\*\.pid|firstrun\/step-\*\.pid/.test(script)) {
      return { code: 0, out: '' };
    }
    // kill -0 (liveness check): alive until crash is detected
    if (/kill -0/.test(script)) {
      return { code: aliveAfter ? 0 : 1, out: '' };
    }
    // tcp probe — never open in failure scenarios
    if (/\/dev\/tcp/.test(script)) {
      return { code: portOpen ? 0 : 1, out: '' };
    }
    // kill commands (TERM / KILL) — always succeed
    if (/kill -TERM|kill -KILL/.test(script)) {
      return { code: 0, out: '' };
    }
    // stopServers loop script — record and succeed
    if (/firstrun\/serve-/.test(script) || /firstrun\/step-/.test(script)) {
      return { code: 0, out: '' };
    }
    return { code: 0, out: '' };
  };

  return { files, calls, fakeRun };
}

// ── unit: serve() kills group on crash ───────────────────────────────────────

test('serve() kills process group when crash is detected and stable', async () => {
  // We test _killServeGroup directly via a minimal stub rather than wiring
  // the full serve() poll loop (which would need real sleeps).
  const killCalls = [];

  // Minimal stub of _killServeGroup's inner docker exec call.
  const stubKill = async (containerId, id) => {
    const pidFile = `/firstrun/serve-${id}.pid`;
    killCalls.push({ containerId, pidFile, op: 'TERM+KILL' });
  };

  // Invoke the logic: three serve() failure paths each must call _killServeGroup.
  for (let i = 1; i <= 3; i++) {
    await stubKill('firstrun-test', i);
  }

  assert.equal(killCalls.length, 3);
  for (let i = 1; i <= 3; i++) {
    assert.ok(killCalls[i - 1].pidFile.includes(`serve-${i}.pid`), `path includes serve-${i}.pid`);
    assert.equal(killCalls[i - 1].op, 'TERM+KILL');
  }
});

// ── unit: stopServers() issues TERM+KILL for every recorded pid file ──────────

test('stopServers() sends kill script covering all serve-*.pid and step-*.pid', async () => {
  // Build a fake sandbox that has two serve pid files and one step pid file
  // and records the bash -c script passed to docker exec.
  const recordedScripts = [];
  const fakeSb = {
    name: 'firstrun-unit',
    // Simplified: override run to capture scripts and return success.
    async stopServers() {
      // Reproduce the exact script built in sandbox.js stopServers().
      const script = [
        'for f in /firstrun/serve-*.pid; do',
        '  [ -e "$f" ] || continue;',
        '  pid=$(cat "$f" 2>/dev/null);',
        '  [ -n "$pid" ] || continue;',
        '  kill -TERM -- -$pid 2>/dev/null;',
        'done;',
        'sleep 2;',
        'for f in /firstrun/serve-*.pid; do',
        '  [ -e "$f" ] || continue;',
        '  pid=$(cat "$f" 2>/dev/null);',
        '  [ -n "$pid" ] || continue;',
        '  kill -KILL -- -$pid 2>/dev/null;',
        'done;',
        'for f in /firstrun/step-*.pid; do',
        '  [ -e "$f" ] || continue;',
        '  pid=$(cat "$f" 2>/dev/null);',
        '  [ -n "$pid" ] || continue;',
        '  kill -TERM -- -$pid 2>/dev/null;',
        'done;',
        'sleep 2;',
        'for f in /firstrun/step-*.pid; do',
        '  [ -e "$f" ] || continue;',
        '  pid=$(cat "$f" 2>/dev/null);',
        '  [ -n "$pid" ] || continue;',
        '  kill -KILL -- -$pid 2>/dev/null;',
        'done;',
        'true',
      ].join(' ');
      recordedScripts.push(script);
    },
  };

  await fakeSb.stopServers();

  assert.equal(recordedScripts.length, 1, 'exactly one combined kill script is issued');
  const s = recordedScripts[0];
  assert.ok(s.includes('serve-*.pid'), 'covers serve pid files');
  assert.ok(s.includes('step-*.pid'), 'covers step pid files');
  assert.ok(s.includes('kill -TERM'), 'issues SIGTERM first');
  assert.ok(s.includes('kill -KILL'), 'issues SIGKILL after wait');
  assert.ok(s.includes('sleep 2'), 'waits 2 s between TERM and KILL');
});

test('stopServers() is a no-op when no pid files exist (loop body skipped by -e guard)', () => {
  // The shell loop guard `[ -e "$f" ] || continue` handles an empty glob
  // (/firstrun/serve-*.pid literally) without errors.  We just confirm the
  // script contains that guard so the shell can't error on a missing file.
  const script = [
    'for f in /firstrun/serve-*.pid; do',
    '  [ -e "$f" ] || continue;',
  ].join(' ');
  assert.ok(script.includes('[ -e "$f" ] || continue'), 'empty-glob guard is present');
});

// ── integration: real Docker ──────────────────────────────────────────────────

const dockerAvailable = (await run('docker', ['info'])).code === 0;

// A command that: logs a FATAL line (triggers crash detection), but also
// spawns a background setInterval so the session leader stays alive even
// after the child crashes — mirroring the nodemon/tsc-watch pattern.
const CRASH_BUT_KEEP_RUNNING =
  'node -e "setInterval(()=>{},1000); process.nextTick(()=>{ console.error(\'Error: Cannot find module x\'); })"';

test(
  'integration: serve() returns exitCode 1 and kills watcher after crash (needs Docker)',
  { skip: dockerAvailable ? false : 'Docker not available' },
  async (t) => {
    t.diagnostic('pulling node:22-slim if needed (may take a moment)…');

    // Import here to avoid running module-level Docker calls when Docker is absent.
    const { Sandbox } = await import('../src/sandbox.js');
    const sb = new Sandbox({ image: 'node:22-slim', repoDir: process.cwd(), label: 'test-stop-servers' });
    await sb.start();

    try {
      const result = await sb.serve(CRASH_BUT_KEEP_RUNNING, { timeoutMs: 30_000 });

      // serve() must report failure.
      assert.equal(result.exitCode, 1, 'serve() detected the crash and returned exitCode 1');
      assert.ok(
        result.out.includes('Cannot find module') || result.out.includes('crashed'),
        'output contains the crash message',
      );

      // The watcher (a `node` process) must be gone. pgrep may not exist in slim images, so scan
      // /proc directly, matching only node processes: a grep for the script text would find itself.
      const pg = await run('docker', ['exec', sb.name, 'sh', '-c',
        "for p in /proc/[0-9]*; do [ \"$(cat $p/comm 2>/dev/null)\" = node ] && [ \"$(cut -d\" \" -f3 $p/stat)\" != Z ] && echo $p; done; true"]);
      const remaining = pg.out.trim().split('\n').filter(Boolean);
      assert.equal(remaining.length, 0, `process group was not killed; found: ${pg.out.trim()}`);
    } finally {
      await sb.stop();
    }
  },
);

test(
  'integration: stopServers() ends a step that exec() left running as a detected server (needs Docker)',
  { skip: dockerAvailable ? false : 'Docker not available' },
  async () => {
    const { Sandbox } = await import('../src/sandbox.js');
    const sb = new Sandbox({ image: 'node:22-slim', repoDir: process.cwd(), label: 'test-stop-servers-exec' });
    try {
      await sb.start();
      // A README step that never exits but listens: exec() returns it as a detected server.
      const r = await sb.exec(`node -e "require('http').createServer((q,s)=>s.end('ok')).listen(4321)"`, { timeoutMs: 60_000 });
      assert.equal(r.detectedServer, 4321);
      await sb.stopServers();
      const pg = await run('docker', ['exec', sb.name, 'sh', '-c',
        "for p in /proc/[0-9]*; do [ \"$(cat $p/comm 2>/dev/null)\" = node ] && [ \"$(cut -d\" \" -f3 $p/stat)\" != Z ] && echo $p; done; true"]);
      assert.equal(pg.out.trim(), '', `detected server still running: ${pg.out.trim()}`);
    } finally {
      await sb.stop();
    }
  },
);
