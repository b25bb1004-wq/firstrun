#!/usr/bin/env node
// Builds the hosted demo into web/public: the landing page (committed), the dashboard under /app,
// and a static snapshot of REAL runs under /data (the dashboard reads it through vercel.json
// rewrites and web/static-shim.js). Synthetic fixtures are never exported.
//   node web/build.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(HERE, 'public');
const ROOTS = ['examples', 'audit/real-16'].map((r) => path.join(ROOT, r));
const RUN_FILES = /^(events\.ndjson|plan\.json|run\.json|evidence\/.*|logs\/.*|out\/.*)$/; // never bob/ (stand-in transcripts)

const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const write = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data)); };
function walk(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(dir, r)); else out.push(r);
  }
  return out;
}

rm(path.join(OUT, 'app'));
rm(path.join(OUT, 'data'));

// dashboard + static shim
fs.cpSync(path.join(ROOT, 'ui'), path.join(OUT, 'app'), { recursive: true });
fs.copyFileSync(path.join(HERE, 'static-shim.js'), path.join(OUT, 'app', 'static-shim.js'));
const idx = path.join(OUT, 'app', 'index.html');
fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8')
  .replace('<script type="module" src="app.js"></script>', '<script src="static-shim.js"></script>\n  <script type="module" src="app.js"></script>')
  .replace('<a class="brand" href="#/"', '<a class="brand" href="/"'));

// snapshot of real runs
const { url, close } = await startServer({ port: 0, roots: ROOTS });
const get = async (p) => (await fetch(url + p)).json();
const runs = await get('/api/runs');
write(path.join(OUT, 'data', 'runs.json'), runs);
for (const r of runs) {
  write(path.join(OUT, 'data', 'runs', r.id, 'run.json'), await get(`/api/runs/${encodeURIComponent(r.id)}`));
  for (const f of walk(r.dir).filter((f) => RUN_FILES.test(f))) {
    const dest = path.join(OUT, 'data', 'runs', r.id, 'f', f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(r.dir, f), dest);
  }
}
const audits = await get('/api/audits');
write(path.join(OUT, 'data', 'audits.json'), audits.map(({ dir, ...a }) => a));
for (const a of audits) {
  const { dir, ...full } = await get(`/api/audits/${encodeURIComponent(a.id)}`);
  write(path.join(OUT, 'data', 'audits', `${a.id}.json`), full);
}
await close();

// run dirs are local paths; don't publish them
write(path.join(OUT, 'data', 'runs.json'), runs.map(({ dir, ...r }) => r));
console.log(`web/public: ${runs.length} runs, ${audits.length} audits exported`);
