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
const auditCandidate = process.env.AUDIT_DIR
  ? [process.env.AUDIT_DIR]
  : ['audit/real-31-v2', 'audit/v2-31', 'audit/real-16-v2'].filter((r) => fs.existsSync(path.join(ROOT, r))).slice(0, 1);
const ROOTS = ['examples', ...auditCandidate].map((r) => path.join(ROOT, r));
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

// Synchronize landing page index.html static figures with the exported audit
if (audits.length) {
  const primaryId = audits[0].id;
  const primaryDataPath = path.join(OUT, 'data', 'audits', `${primaryId}.json`);
  if (fs.existsSync(primaryDataPath)) {
    const primary = JSON.parse(fs.readFileSync(primaryDataPath, 'utf8'));
    const total = primary.summary?.total ?? primary.repos?.length ?? 0;
    const noDocs = (primary.repos || []).filter((r) => r.verdict === 'NO-SETUP-DOCS').length;
    const followable = Math.max(0, total - noDocs);
    const broke = primary.summary?.brokeOnCleanMachine ?? (primary.repos || []).filter((r) => r.verdict === 'FAILED' || r.verdict === 'PARTIAL').length;
    const fixed = primary.summary?.breaksFixed ?? 0;

    const landingPath = path.join(OUT, 'index.html');
    if (fs.existsSync(landingPath)) {
      let html = fs.readFileSync(landingPath, 'utf8');
      html = html.replace(/<b data-count="\d+" data-stat="total">\d+<\/b>/, `<b data-count="${total}" data-stat="total">${total}</b>`);
      html = html.replace(/<b data-count="\d+" data-suffix="[^"]*" data-stat="broke">[^<]+<\/b>/, `<b data-count="${broke}" data-suffix=" of ${followable}" data-stat="broke">${broke} of ${followable}</b>`);
      html = html.replace(/<b data-count="\d+" data-stat="fixed">\d+<\/b>/, `<b data-count="${fixed}" data-stat="fixed">${fixed}</b>`);
      html = html.replace(/<p class="fact" data-stat="fact"[^>]*>.*?<\/p>/, `<p class="fact" data-stat="fact" data-reveal>Numbers from an audit of ${total} public repositories pinned to exact commits. <a class="link" href="/audit">See the audit</a></p>`);
      html = html.replace(/<h3 data-stat="caption">.*?<\/h3>/, `<h3 data-stat="caption">${total} public repos, pinned to exact commits</h3>`);
      fs.writeFileSync(landingPath, html);
      console.log(`web/public/index.html synced to audit ${primaryId}: ${total} repos, ${broke}/${followable} broke, ${fixed} fixed`);
    }
  }
}

console.log(`web/public: ${runs.length} runs, ${audits.length} audits exported`);
