import path from 'node:path';
import YAML from 'yaml';
import { serviceKind, SERVICE_CATALOG } from './doctor/services.js';

/**
 * The sandbox has no Docker daemon, so README lines such as
 * `docker compose up -d db` or `docker run -p 6379:6379 redis` are carried out
 * by starting the same images as sidecars on the sandbox's localhost. Services
 * that are built from source (the app itself) are not started: HUMBLE runs
 * the app natively, the way the rest of the README does.
 */
export async function runServicesStep(command, { sandbox, facts, cwd = null }) {
  const lines = [];
  const say = (s) => lines.push(`[firstrun] ${s}`);
  const c = command.trim();

  if (/^docker\s+run\b/.test(c)) {
    const tokens = c.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g).map((t) => t.replace(/^['"]|['"]$/g, ''));
    const env = {};
    let name = null, hostPort = null, containerPort = null, image = null;
    for (let i = 2; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === '-e' || t === '--env') { const [k, ...v] = tokens[++i].split('='); env[k] = v.join('='); }
      else if (t.startsWith('--env=')) { const [k, ...v] = t.slice(6).split('='); env[k] = v.join('='); }
      else if (t === '-p' || t === '--publish') { const p = tokens[++i].split(':'); hostPort = Number(p[p.length - 2] || p[0]); containerPort = Number(p[p.length - 1]); }
      else if (t === '--name') name = tokens[++i];
      else if (t.startsWith('--name=')) name = t.slice(7);
      else if (['-v', '--volume', '--network', '--restart', '-w', '--health-cmd', '--mount', '--user', '-u'].includes(t)) i++;
      else if (t.startsWith('-')) continue;
      else { image = t; break; }
    }
    if (!image) return { exitCode: 1, out: 'docker: "docker run" requires at least 1 argument.\n' };
    const kind = serviceKind(image, name);
    const port = hostPort || containerPort || SERVICE_CATALOG[kind]?.port;
    const res = await sandbox.addService({ name: name || kind || 'service', image, env, port });
    say(`started ${image} as a sidecar on localhost:${port}${res.already ? ' (already running)' : ''}`);
    return { exitCode: res.ready === false ? 1 : 0, out: lines.join('\n') + '\n' };
  }

  // docker compose [-f file] up [-d] [services...]
  const fileArg = c.match(/\s-f\s+(\S+)|\s--file[= ](\S+)/);
  let file = fileArg ? (fileArg[1] || fileArg[2]) : null;
  let text = null;
  if (file) {
    const candidate = (cwd && !file.startsWith('/')) ? `${cwd}/${file}` : file;
    text = await sandbox.readFile(candidate);
    if (text == null && candidate !== file) text = await sandbox.readFile(file);
    if (text != null) file = candidate;
  }
  if (text == null) {
    const candidates = [];
    if (cwd) candidates.push(...['compose.yaml', 'compose.yml', 'docker-compose.yml', 'docker-compose.yaml'].map((f) => `${cwd}/${f}`));
    candidates.push('compose.yaml', 'compose.yml', 'docker-compose.yml', 'docker-compose.yaml');
    if (facts?.compose?.file) {
      if (cwd) candidates.push(`${cwd}/${facts.compose.file}`);
      candidates.push(facts.compose.file);
    }
    for (const f of candidates) {
      text = await sandbox.readFile(f);
      if (text != null) { file = f; break; }
    }
  }
  if (text == null) {
    return { exitCode: 1, out: 'no configuration file provided: not found\n' };
  }
  let doc;
  try { doc = YAML.parse(text) || {}; } catch (e) { return { exitCode: 1, out: `yaml: ${e.message}\n` }; }
  const upIdx = c.split(/\s+/).indexOf('up');
  const wanted = c.split(/\s+/).slice(upIdx + 1).filter((t) => !t.startsWith('-'));
  const services = Object.entries(doc.services || {}).filter(([n]) => !wanted.length || wanted.includes(n));
  if (wanted.length && !services.length) return { exitCode: 1, out: `no such service: ${wanted[0]}\n` };
  let ok = true;
  const composeDir = file ? path.dirname(file.replace(/^\/workspace\/?/, '')) : null;
  for (const [svcName, svc] of services) {
    // `build:` means the project builds this image itself (full-stack-fastapi: image: backend:latest + build:), so
    // there is nothing to pull: the app runs natively in the walkthrough.
    if (!svc.image || svc.build) { say(`skipping "${svcName}": built from source (the app itself runs natively in this walkthrough)`); continue; }
    const kind = serviceKind(svc.image, svcName);
    const env = Array.isArray(svc.environment)
      ? Object.fromEntries(svc.environment.map((e) => String(e).split(/=(.*)/s).slice(0, 2)))
      : { ...(svc.environment || {}) };
    let port = SERVICE_CATALOG[kind]?.port || null;
    const mapping = (svc.ports || []).map(String)[0];
    if (mapping) {
      const parts = mapping.replace(/\/\w+$/, '').split(':');
      const host = Number(parts.length >= 2 ? parts[parts.length - 2] : parts[0]);
      const target = Number(parts[parts.length - 1]);
      port = target || host;
      if (host && target && host !== target) say(`note: ${svcName} publishes ${host}->${target}; the app will reach it on localhost:${target} in the sandbox`);
    }
    const volumes = (svc.volumes || []).map((v) => typeof v === 'object' ? `${v.source || ''}:${v.target || ''}` : String(v));
    // A service that cannot start (image not pullable, bad config) fails this step; it must not abort the whole run.
    let res;
    try { res = await sandbox.addService({ name: svcName, image: svc.image, env, port, volumes, composeDir: composeDir === '.' ? null : composeDir }); }
    catch (e) { ok = false; say(`could not start ${svcName}: ${String(e.message).split('\n')[0]}`); continue; }
    say(`${res.already ? 'already running' : 'started'} ${svcName} (${svc.image})${port ? ` on localhost:${port}` : ''}`);
    if (res.ready === false) { ok = false; say(`${svcName} did not become ready`); }
  }
  return { exitCode: ok ? 0 : 1, out: lines.join('\n') + '\n' };
}
