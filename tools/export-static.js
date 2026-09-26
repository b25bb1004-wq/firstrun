#!/usr/bin/env node
// Rebuild the hosted dashboard's static snapshot (web/public/data) from committed audits, using
// the dashboard server itself so the files have exactly the shapes the live API returns.
//
//   node tools/export-static.js [auditId]...     default: real-16-v2
//
// Audits not named are dropped from the snapshot (with their runs); standalone runs listed in
// KEEP_RUNS (the /proof replay) are left as they are. vercel.json maps /api/* onto these files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'web', 'public', 'data');
const KEEP_RUNS = ['acme-shop-3c0bc2b2'];
const RUN_FILES = ['events.ndjson', 'plan.json', 'run.json', 'evidence', 'out'];

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['real-16-v2'];
const roots = ids.map((id) => path.join(ROOT, 'audit', id));
for (const r of roots) if (!fs.existsSync(path.join(r, 'audit.json'))) { console.error(`no audit at ${r}`); process.exit(1); }

const { url, close, registry } = await startServer({ roots, runs: [], port: 0, host: '127.0.0.1' });
const get = async (p) => { const res = await fetch(url.replace(/\/$/, '') + p); if (!res.ok) throw new Error(`${p}: ${res.status}`); return res.json(); };
const write = (rel, obj) => { const f = path.join(DATA, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj)); };

try {
  const oldRuns = JSON.parse(fs.readFileSync(path.join(DATA, 'runs.json'), 'utf8'));
  const keep = oldRuns.filter((r) => KEEP_RUNS.includes(r.id));

  // Start clean: drop every audit and run that isn't kept.
  fs.rmSync(path.join(DATA, 'audits'), { recursive: true, force: true });
  for (const d of fs.readdirSync(path.join(DATA, 'runs'))) {
    if (!KEEP_RUNS.includes(d)) fs.rmSync(path.join(DATA, 'runs', d), { recursive: true, force: true });
  }

  const audits = (await get('/api/audits')).filter((a) => ids.includes(a.id));
  write('audits.json', audits);
  for (const a of audits) write(`audits/${a.id}.json`, await get(`/api/audits/${encodeURIComponent(a.id)}`));

  const runs = await get('/api/runs');
  for (const r of runs) {
    write(`runs/${r.id}/run.json`, await get(`/api/runs/${encodeURIComponent(r.id)}`));
    const src = registry.runDir(r.id);
    for (const f of RUN_FILES) {
      if (fs.existsSync(path.join(src, f))) fs.cpSync(path.join(src, f), path.join(DATA, 'runs', r.id, 'f', f), { recursive: true });
    }
  }
  write('runs.json', [...runs, ...keep]);
  for (const a of audits) console.log(`${a.id}: ${a.done}/${a.repos} repos, ${JSON.stringify(a.verdicts)}, broke ${a.broke}`);
  console.log(`${runs.length} runs exported, kept ${keep.map((r) => r.id).join(', ') || 'none'}`);
} finally {
  await close();
}
