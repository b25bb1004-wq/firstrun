#!/usr/bin/env node
// HUMBLE dashboard server. Zero dependencies. Implements the HTTP API in docs/ARCHITECTURE.md.
//
//   node src/server.js --root fixtures [--root other] [--run path/to/repo] [--port 4173]
//
// Discovery
//   * roots are scanned (depth <= 6, skipping node_modules/.git) for `.firstrun/run.json`
//     and for `audit/<id>/audit.json`. A root may itself be a repo dir or a `.firstrun` dir.
//   * `runs` is an explicit list of run dirs (repo dir or its `.firstrun`).
//   * each audit repo's `runDir` (absolute, or relative to the audit.json directory) is registered too.
//   * a run's id is RunState.id; on a collision the later dir gets `<id>~2`, `<id>~3`...
//
// SSE (`text/event-stream`)
//   * run events: every line of events.ndjson as a default `message` event (data = Event JSON,
//     id = line number), then `event: ready` once the backlog is sent, then live lines.
//     If the file shrinks (a fresh run into the same dir) the server sends `event: reset` and
//     replays from the start. Comment heartbeats every 15s.
//   * audit events: `audit/<id>/events.ndjson` (swarm events) replayed the same way, plus a
//     synthesized `event: snapshot` whose data is the enriched audit (GET /api/audits/:id)
//     whenever it changes (polled every 700ms).

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.resolve(HERE, '..', 'ui');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '__pycache__', 'out', 'logs', 'evidence']);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8',
  '.diff': 'text/x-diff; charset=utf-8', '.log': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.ndjson': 'application/x-ndjson; charset=utf-8', '.yml': 'text/yaml; charset=utf-8', '.yaml': 'text/yaml; charset=utf-8',
};

// ------------------------------------------------------------------ discovery
function toFirstrunDir(dir) {
  if (!dir) return null;
  if (fs.existsSync(path.join(dir, 'run.json')) || path.basename(dir) === '.firstrun') return dir;
  return path.join(dir, '.firstrun');
}

function walk(root, depth, onRun, onAudit) {
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = path.join(root, e.name);
    if (e.name === '.firstrun') { if (fs.existsSync(path.join(p, 'run.json'))) onRun(p); continue; }
    if (e.name === 'audit') {
      let ids = [];
      try { ids = fs.readdirSync(p, { withFileTypes: true }); } catch {}
      for (const a of ids) if (a.isDirectory() && fs.existsSync(path.join(p, a.name, 'audit.json'))) onAudit(path.join(p, a.name));
    }
    if (depth > 0 && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(p, depth - 1, onRun, onAudit);
  }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

class Registry {
  constructor(roots, runs) {
    this.roots = roots.map(r => path.resolve(r));
    this.explicit = runs.map(r => path.resolve(r));
    this.runs = new Map();   // id -> dir (.firstrun)
    this.audits = new Map(); // id -> dir (audit/<id>)
    this.last = 0;
  }
  scan(force = false) {
    const now = Date.now();
    if (!force && now - this.last < 1000) return;
    this.last = now;
    const runDirs = new Set();
    const auditDirs = new Set();
    for (const root of this.roots) {
      if (fs.existsSync(path.join(root, 'run.json'))) runDirs.add(root);
      if (fs.existsSync(path.join(root, '.firstrun', 'run.json'))) runDirs.add(path.join(root, '.firstrun'));
      if (fs.existsSync(path.join(root, 'audit.json'))) auditDirs.add(root);
      walk(root, 6, d => runDirs.add(d), d => auditDirs.add(d));
    }
    for (const r of this.explicit) { const d = toFirstrunDir(r); if (d) runDirs.add(d); }
    const audits = new Map();
    for (const dir of auditDirs) {
      const a = readJson(path.join(dir, 'audit.json'));
      if (!a) continue;
      audits.set(String(a.id || path.basename(dir)), dir);
      for (const repo of a.repos || []) {
        const d = resolveRunDir(dir, repo.runDir);
        if (d) runDirs.add(d);
      }
    }
    const runs = new Map();
    const byDir = new Map();
    for (const dir of [...runDirs].sort()) {
      const rs = readJson(path.join(dir, 'run.json'));
      if (!rs && !fs.existsSync(path.join(dir, 'events.ndjson'))) continue;
      let id = String(rs?.id || path.basename(path.dirname(dir)));
      if (runs.has(id)) { let k = 2; while (runs.has(`${id}~${k}`)) k++; id = `${id}~${k}`; }
      runs.set(id, dir);
      byDir.set(path.resolve(dir), id);
    }
    this.runs = runs;
    this.byDir = byDir;
    this.audits = audits;
  }
  runDir(id) {
    this.scan();
    if (!this.runs.has(id)) this.scan(true);
    return this.runs.get(id) || null;
  }
  auditDir(id) {
    this.scan();
    if (!this.audits.has(id)) this.scan(true);
    return this.audits.get(id) || null;
  }
  idForDir(dir) { return dir ? this.byDir?.get(path.resolve(dir)) || null : null; }
}

function resolveRunDir(auditDir, runDir) {
  if (!runDir) return null;
  const candidates = path.isAbsolute(runDir) ? [runDir] : [path.resolve(auditDir, runDir), path.resolve(runDir)];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'run.json'))) return c;
    if (fs.existsSync(path.join(c, '.firstrun'))) return path.join(c, '.firstrun');
  }
  return toFirstrunDir(candidates[0]); // may not exist yet (queued repo)
}

// ------------------------------------------------------------------ summaries
function runSummary(id, dir) {
  const rs = readJson(path.join(dir, 'run.json')) || {};
  return {
    id, repo: rs.repo || rs.plan?.repo || '', phase: rs.phase || 'scout',
    verdict: rs.passport?.verdict || null, startedAt: rs.startedAt || null, dir,
  };
}

function runProgress(id, dir) {
  const rs = readJson(path.join(dir, 'run.json'));
  if (!rs) return null;
  const order = rs.plan?.steps?.map(s => s.id) || Object.keys(rs.steps || {});
  const steps = order.map(sid => ({ id: sid, status: rs.steps?.[sid]?.status || 'pending' }));
  const cur = steps.find(s => s.status === 'running');
  const def = cur && rs.plan?.steps?.find(s => s.id === cur.id);
  return {
    id, phase: rs.phase, startedAt: rs.startedAt, finishedAt: rs.finishedAt || null,
    steps, stepsTotal: steps.length,
    stepsDone: steps.filter(s => ['passed', 'repaired', 'skipped', 'needs-human', 'failed'].includes(s.status)).length,
    currentStep: cur ? { id: cur.id, command: def?.command || '' } : null,
    breaks: (rs.evidence || []).length, bobcoins: rs.bobcoins || 0,
    repairs: (rs.evidence || []).map(eid => {
      const e = /^[A-Za-z0-9_-]+$/.test(eid) ? readJson(path.join(dir, 'evidence', `${eid}.json`)) : null;
      return e ? { id: e.id, stepId: e.stepId, class: e.diagnosis?.class, by: e.diagnosis?.by, status: e.status } : { id: eid };
    }),
    runtime: rs.plan?.runtime || null, image: rs.plan?.image || null,
    replay: rs.replay || null, verdict: rs.passport?.verdict || null, passport: rs.passport || null,
  };
}

function enrichedAudit(reg, id, dir) {
  const a = readJson(path.join(dir, 'audit.json'));
  if (!a) return null;
  reg.scan();
  return {
    ...a, id: a.id || id, dir,
    repos: (a.repos || []).map(r => {
      const rd = resolveRunDir(dir, r.runDir);
      let runId = reg.idForDir(rd);
      if (rd && !runId && fs.existsSync(path.join(rd, 'run.json'))) { reg.scan(true); runId = reg.idForDir(rd); }
      return { ...r, runId, run: runId && rd ? runProgress(runId, rd) : null };
    }),
  };
}

// ------------------------------------------------------------------ SSE tailing
function sseHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
}

// Tails an ndjson file: calls onLine(line, n) for every complete line, onReset() on truncation.
function tailFile(file, { onLine, onReady, onReset }) {
  let offset = 0, lineNo = 0, partial = '', reading = false, again = false, closed = false, ready = false, watcher = null;
  const read = async () => {
    if (closed) return;
    if (reading) { again = true; return; }
    reading = true;
    try {
      let st;
      try { st = await fsp.stat(file); } catch { st = null; }
      if (st && st.size < offset) { offset = 0; lineNo = 0; partial = ''; onReset?.(); }
      if (st && st.size > offset) {
        const fh = await fsp.open(file, 'r');
        try {
          const len = st.size - offset;
          const buf = Buffer.alloc(len);
          const { bytesRead } = await fh.read(buf, 0, len, offset);
          offset += bytesRead;
          const text = partial + buf.subarray(0, bytesRead).toString('utf8');
          const lines = text.split('\n');
          partial = lines.pop();
          for (const l of lines) { const s = l.trim(); if (s) onLine(s, ++lineNo); }
        } finally { await fh.close(); }
      }
      if (!ready) { ready = true; onReady?.(); }
      if (!watcher && st) {
        try { watcher = fs.watch(file, { persistent: false }, () => read()); watcher.on('error', () => {}); } catch {}
      }
    } catch { /* transient (file being replaced on Windows) */ }
    reading = false;
    if (again) { again = false; read(); }
  };
  read();
  const poll = setInterval(read, 400);
  return () => { closed = true; clearInterval(poll); try { watcher?.close(); } catch {} };
}

function streamRunEvents(req, res, dir) {
  sseHeaders(res);
  const file = path.join(dir, 'events.ndjson');
  const stop = tailFile(file, {
    onLine: (line, n) => res.write(`id: ${n}\ndata: ${line}\n\n`),
    onReady: () => res.write('event: ready\ndata: {}\n\n'),
    onReset: () => res.write('event: reset\ndata: {}\n\n'),
  });
  const hb = setInterval(() => res.write(': hb\n\n'), 15000);
  req.on('close', () => { stop(); clearInterval(hb); });
}

function streamAuditEvents(req, res, reg, id, dir) {
  sseHeaders(res);
  let lastSnap = '';
  const snap = () => {
    const a = enrichedAudit(reg, id, dir);
    if (!a) return;
    const s = JSON.stringify(a);
    if (s !== lastSnap) { lastSnap = s; res.write(`event: snapshot\ndata: ${s}\n\n`); }
  };
  const stop = tailFile(path.join(dir, 'events.ndjson'), {
    onLine: (line, n) => res.write(`id: ${n}\ndata: ${line}\n\n`),
    onReady: () => { snap(); res.write('event: ready\ndata: {}\n\n'); },
    onReset: () => res.write('event: reset\ndata: {}\n\n'),
  });
  const iv = setInterval(snap, 700);
  const hb = setInterval(() => res.write(': hb\n\n'), 15000);
  req.on('close', () => { stop(); clearInterval(iv); clearInterval(hb); });
}

// ------------------------------------------------------------------ helpers
function send(res, status, body, type = 'application/json; charset=utf-8') {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(data);
}
const notFound = (res, what = 'not found') => send(res, 404, { error: what });

// Resolve `rel` inside `base`; null if it escapes (.., absolute, drive letters, symlinks out).
function safeJoin(base, rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0')) return null;
  const baseAbs = path.resolve(base);
  const target = path.resolve(baseAbs, rel);
  const inside = p => p === baseAbs || p.startsWith(baseAbs + path.sep);
  if (!inside(target)) return null;
  try {
    const real = fs.realpathSync(target);
    const realBase = fs.realpathSync(baseAbs);
    if (!(real === realBase || real.startsWith(realBase + path.sep))) return null;
    return real;
  } catch { return null; }
}

async function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath.replace(/^\/+/, '')) || 'index.html';
  let file = safeJoin(UI_DIR, rel);
  if (!file || !fs.statSync(file).isFile()) file = path.join(UI_DIR, 'index.html');
  const buf = await fsp.readFile(file);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(buf);
}

// ------------------------------------------------------------------ server
export function startServer({ port = 4173, host = '127.0.0.1', roots = [process.cwd()], runs = [] } = {}) {
  const reg = new Registry(roots, runs);
  reg.scan(true);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });
      if (parts[0] !== 'api') return serveStatic(res, url.pathname);

      // /api/runs
      if (parts[1] === 'runs') {
        if (parts.length === 2) {
          reg.scan(true);
          const list = [...reg.runs].map(([id, dir]) => runSummary(id, dir))
            .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
          return send(res, 200, list);
        }
        const dir = reg.runDir(parts[2]);
        if (!dir) return notFound(res, `run ${parts[2]} not found`);
        if (parts.length === 3) {
          const rs = readJson(path.join(dir, 'run.json'));
          return rs ? send(res, 200, rs) : notFound(res, 'run.json not written yet');
        }
        if (parts[3] === 'events' && parts.length === 4) return streamRunEvents(req, res, dir);
        if (parts[3] === 'evidence' && parts.length === 5) {
          if (!/^[A-Za-z0-9_-]+$/.test(parts[4])) return send(res, 400, { error: 'bad evidence id' });
          const ev = readJson(path.join(dir, 'evidence', `${parts[4]}.json`));
          return ev ? send(res, 200, ev) : notFound(res, `evidence ${parts[4]} not found`);
        }
        if (parts[3] === 'file' && parts.length === 4) {
          const rel = url.searchParams.get('path') || '';
          const file = safeJoin(dir, rel);
          if (!file) {
            const lexical = path.resolve(dir, rel);
            const inside = rel && !rel.includes('\0') && lexical.startsWith(path.resolve(dir) + path.sep);
            return inside && !fs.existsSync(lexical) ? notFound(res, `${rel} not written yet`) : send(res, 403, { error: 'path is outside the run directory' });
          }
          let st; try { st = fs.statSync(file); } catch { return notFound(res); }
          if (!st.isFile()) return notFound(res);
          const ext = path.extname(file).toLowerCase();
          const type = ext === '.svg' ? MIME['.svg'] : ext === '.json' ? MIME['.json'] : 'text/plain; charset=utf-8';
          return send(res, 200, await fsp.readFile(file), type);
        }
        return notFound(res);
      }

      // /api/audits
      if (parts[1] === 'audits') {
        if (parts.length === 2) {
          reg.scan(true);
          const list = [...reg.audits].map(([id, dir]) => {
            const a = enrichedAudit(reg, id, dir) || { repos: [] };
            const repos = a.repos || [];
            return {
              id, startedAt: a.startedAt || null, dir, repos: repos.length,
              done: repos.filter(r => r.status === 'done' || r.verdict).length,
              verdicts: repos.reduce((acc, r) => { if (r.verdict) acc[r.verdict] = (acc[r.verdict] || 0) + 1; return acc; }, {}),
              broke: repos.filter(r => (r.passport ? r.passport.breaksFound || 0 : r.run?.breaks || 0) > 0).length,
            };
          }).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
          return send(res, 200, list);
        }
        const dir = reg.auditDir(parts[2]);
        if (!dir) return notFound(res, `audit ${parts[2]} not found`);
        if (parts.length === 3) return send(res, 200, enrichedAudit(reg, parts[2], dir));
        if (parts[3] === 'events' && parts.length === 4) return streamAuditEvents(req, res, reg, parts[2], dir);
        return notFound(res);
      }
      return notFound(res);
    } catch (err) {
      if (!res.headersSent) send(res, 500, { error: String(err?.message || err) });
      else res.end();
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${server.address().port}`;
      resolve({ server, url, registry: reg, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); }) });
    });
  });
}

// ------------------------------------------------------------------ CLI
function parseArgs(argv) {
  const o = { roots: [], runs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') o.roots.push(argv[++i]);
    else if (a === '--run') o.runs.push(argv[++i]);
    else if (a === '--port') o.port = Number(argv[++i]);
    else if (a === '--host') o.host = argv[++i];
    else if (a === '-h' || a === '--help') o.help = true;
    else o.roots.push(a);
  }
  if (!o.roots.length && !o.runs.length) o.roots.push(process.cwd());
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) {
    console.log('usage: node src/server.js [--root <dir>]... [--run <runDir>]... [--port 4173] [--host 127.0.0.1]');
    process.exit(0);
  }
  const { url, registry } = await startServer(o);
  console.log(`HUMBLE dashboard on ${url}  (${registry.runs.size} runs, ${registry.audits.size} audits)`);
}
