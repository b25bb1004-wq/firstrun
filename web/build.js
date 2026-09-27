#!/usr/bin/env node
// Builds the hosted demo into web/public: the landing page (committed), the dashboard under /app,
// and a static snapshot of REAL runs under /data (the dashboard reads it through vercel.json
// rewrites and web/static-shim.js). Synthetic fixtures are never exported.
//   node web/build.js [--audit audit/real-16-v2] [--out web/public]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';
import { redactDeep } from '../src/redact.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// Parse CLI args
function parseArgs(argv) {
  const args = { audit: 'audit/real-16-v2', out: 'web/public' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--audit') args.audit = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log('usage: node web/build.js [--audit <path>] [--out <dir>]');
      console.log('  --audit  Audit folder to export (default: audit/real-16-v2)');
      console.log('  --out    Output directory (default: web/public)');
      process.exit(0);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(ROOT, args.out); // --out is relative to the repo root (it resolved against web/, writing to web/web/public)
const AUDIT_PATH = path.resolve(ROOT, args.audit);
const EXAMPLES_PATH = path.resolve(ROOT, 'examples');
const ROOTS = [EXAMPLES_PATH, AUDIT_PATH];

const RUN_FILES = /^(events\.ndjson|plan\.json|run\.json|evidence\/.*|logs\/.*|out\/.*|$)/; // never bob/ (stand-in transcripts)

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

// Validate audit folder
function validateAudit(auditDir) {
  const auditJson = path.join(auditDir, 'audit.json');
  if (!fs.existsSync(auditJson)) {
    throw new Error(`Audit folder missing audit.json: ${auditDir}`);
  }
  const audit = JSON.parse(fs.readFileSync(auditJson, 'utf8'));
  
  // Check for any repo still queued or running
  for (const repo of audit.repos || []) {
    const status = repo.status || repo.phase;
    if (status === 'queued' || status === 'running') {
      throw new Error(`Audit has repo still ${status}: ${repo.slug}`);
    }
  }
  
  return audit;
}

// Redact and write file (applies redactDeep with tokensOnly: true for text files)
function writeRedacted(dest, data) {
  const redacted = redactDeep(data, { tokensOnly: true });
  write(dest, redacted);
}

async function main() {
  // Validate audit before doing any work
  const audit = validateAudit(AUDIT_PATH);
  
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
  writeRedacted(path.join(OUT, 'data', 'runs.json'), runs);
  for (const r of runs) {
    writeRedacted(path.join(OUT, 'data', 'runs', r.id, 'run.json'), await get(`/api/runs/${encodeURIComponent(r.id)}`));
    for (const f of walk(r.dir).filter((f) => RUN_FILES.test(f))) {
      const dest = path.join(OUT, 'data', 'runs', r.id, 'f', f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      // Read file, redact if text, then write
      const src = path.join(r.dir, f);
      if (f.endsWith('.json') || f.endsWith('.ndjson') || f.endsWith('.log') || f.endsWith('.txt') || f.endsWith('.md') || f.endsWith('.diff') || f.endsWith('.yaml') || f.endsWith('.yml')) {
        const content = fs.readFileSync(src, 'utf8');
        writeRedacted(dest, content);
      } else {
        fs.copyFileSync(src, dest);
      }
    }
  }
  const audits = await get('/api/audits');
  writeRedacted(path.join(OUT, 'data', 'audits.json'), audits.map(({ dir, ...a }) => a));
  for (const a of audits) {
    const { dir, ...full } = await get(`/api/audits/${encodeURIComponent(a.id)}`);
    writeRedacted(path.join(OUT, 'data', 'audits', `${a.id}.json`), full);
  }
  await close();

  // run dirs are local paths; don't publish them
  writeRedacted(path.join(OUT, 'data', 'runs.json'), runs.map(({ dir, ...r }) => r));
  
  // Count verdicts
  const verdictCounts = {};
  for (const r of runs) {
    const v = r.verdict || 'UNKNOWN';
    verdictCounts[v] = (verdictCounts[v] || 0) + 1;
  }
  
  console.log(`Audit: ${audit.id}`);
  console.log(`Repos: ${audit.repos?.length || 0}`);
  console.log(`Verdicts: ${Object.entries(verdictCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`web/public: ${runs.length} runs, ${audits.length} audits exported`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
