#!/usr/bin/env node
// Re-emits a recorded fixture run into a fresh run dir with realistic timing, so the live
// dashboard can be recorded without the engine.
//
//   node fixtures/replay.js --speed 4                  # acme-shop -> fixtures/live/acme-shop/.firstrun (id acme-shop-live)
//   node fixtures/replay.js --run ledger-api --speed 8
//   node fixtures/replay.js --audit --speed 8          # whole swarm -> fixtures/live/audit/swarm-live (+ fixtures/live/swarm/*)
//
// Options: --speed N (default 4), --max-gap ms (cap on any real-time pause, default 2500),
//          --concurrency N (audit, default 4), --loop (restart when finished).
// Writes events.ndjson line by line, run.json/plan.json as state changes, and copies logs,
// evidence and out/ files at the moment the matching event is emitted (as the engine would).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createModel, applyEvent, toRunState } from '../ui/model.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function args(argv) {
  const o = { speed: 4, maxGap: 2500, concurrency: 4, run: 'acme-shop', audit: false, loop: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--speed') o.speed = Number(argv[++i]);
    else if (a === '--max-gap') o.maxGap = Number(argv[++i]);
    else if (a === '--concurrency') o.concurrency = Number(argv[++i]);
    else if (a === '--run') o.run = argv[++i];
    else if (a === '--audit') o.audit = true;
    else if (a === '--loop') o.loop = true;
  }
  return o;
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  try { fs.writeFileSync(tmp, content); fs.renameSync(tmp, file); }
  catch { try { fs.writeFileSync(file, content); } catch {} try { fs.rmSync(tmp, { force: true }); } catch {} }
}

function copy(srcDir, dstDir, rel) {
  const s = path.join(srcDir, rel);
  if (!fs.existsSync(s)) return;
  fs.mkdirSync(path.dirname(path.join(dstDir, rel)), { recursive: true });
  fs.copyFileSync(s, path.join(dstDir, rel));
}

export async function replayRun(srcDir, dstDir, id, { speed = 4, maxGap = 2500, log = true } = {}) {
  const events = fs.readFileSync(path.join(srcDir, 'events.ndjson'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  // A dashboard may be tailing this dir (Windows holds watch handles): fall back to truncating.
  try { fs.rmSync(dstDir, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(dstDir, { recursive: true });
  const evFile = path.join(dstDir, 'events.ndjson');
  fs.writeFileSync(evFile, '');
  const m = createModel({ id });
  let prevT = null;
  let lastState = 0;
  const flushState = () => { writeAtomic(path.join(dstDir, 'run.json'), JSON.stringify(toRunState(m), null, 2) + '\n'); lastState = Date.now(); };
  for (const src of events) {
    const t = Date.parse(src.t);
    if (prevT !== null) await sleep(Math.min(maxGap, Math.max(0, (t - prevT) / speed)));
    prevT = t;
    const ev = { ...src, run: id, t: new Date().toISOString() };
    applyEvent(m, ev);
    fs.appendFileSync(evFile, JSON.stringify(ev) + '\n');
    const d = ev.data || {};
    if (ev.type === 'plan') writeAtomic(path.join(dstDir, 'plan.json'), JSON.stringify(d, null, 2) + '\n');
    if (ev.type === 'step.end' && d.logFile) copy(srcDir, dstDir, d.logFile);
    if (ev.type === 'evidence') writeAtomic(path.join(dstDir, 'evidence', `${d.id}.json`), JSON.stringify(d, null, 2) + '\n');
    if (ev.type === 'artifact' && d.path) copy(srcDir, dstDir, d.path);
    if (ev.type !== 'step.log' || Date.now() - lastState > 1000) flushState();
    if (log && ev.type !== 'step.log') console.log(`${id.padEnd(22)} ${ev.agent.padEnd(9)} ${ev.type}${d.stepId ? ' ' + d.stepId : ''}${d.phase ? ' ' + d.phase : ''}`);
  }
  flushState();
  return m;
}

async function replayAudit(o) {
  const src = JSON.parse(fs.readFileSync(path.join(HERE, 'audit', 'demo', 'audit.json'), 'utf8'));
  const auditDir = path.join(HERE, 'live', 'audit', 'swarm-live');
  try { fs.rmSync(auditDir, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(path.join(HERE, 'live', 'swarm'), { recursive: true, force: true }); } catch {}
  fs.mkdirSync(auditDir, { recursive: true });
  const evFile = path.join(auditDir, 'events.ndjson');
  fs.writeFileSync(evFile, '');
  const audit = {
    id: 'swarm-live', startedAt: new Date().toISOString(),
    repos: src.repos.map(r => ({ slug: r.slug, url: r.url, status: 'queued', verdict: null, passport: null,
      runDir: `../../swarm/${path.basename(r.runDir)}` })),
  };
  const save = () => writeAtomic(path.join(auditDir, 'audit.json'), JSON.stringify(audit, null, 2) + '\n');
  const emit = (type, data) => fs.appendFileSync(evFile, JSON.stringify({ t: new Date().toISOString(), run: audit.id, agent: 'swarm', type, data }) + '\n');
  save();
  for (const r of audit.repos) emit('repo.queued', { slug: r.slug });
  let next = 0;
  const worker = async (w) => {
    await sleep(w * 900);
    while (next < audit.repos.length) {
      const k = next++;
      const r = audit.repos[k];
      const name = path.basename(src.repos[k].runDir);
      r.status = 'running'; save(); emit('repo.start', { slug: r.slug });
      const m = await replayRun(path.join(HERE, 'runs', name, '.firstrun'), path.join(HERE, 'live', 'swarm', name, '.firstrun'), `${name}-swarm`, { ...o, log: false });
      r.status = 'done'; r.verdict = m.verdict; r.passport = m.passport; save();
      emit('repo.done', { slug: r.slug, verdict: m.verdict, passport: m.passport });
      console.log(`${r.slug.padEnd(30)} ${m.verdict}`);
    }
  };
  await Promise.all(Array.from({ length: o.concurrency }, (_, w) => worker(w)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const o = args(process.argv.slice(2));
  do {
    if (o.audit) {
      console.log(`replaying the demo swarm at ${o.speed}x into fixtures/live/audit/swarm-live (open #/audit/swarm-live)`);
      await replayAudit(o);
    } else {
      const id = `${o.run}-live`;
      console.log(`replaying ${o.run} at ${o.speed}x into fixtures/live/${o.run}/.firstrun (open #/run/${id})`);
      await replayRun(path.join(HERE, 'runs', o.run, '.firstrun'), path.join(HERE, 'live', o.run, '.firstrun'), id, o);
    }
    if (o.loop) await sleep(8000);
  } while (o.loop);
}
