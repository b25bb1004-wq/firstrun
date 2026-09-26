#!/usr/bin/env node
// Engine v2 suite: every offline gate in one command, then the exact 31-repo rerun, ready but NOT started.
//
//   node tools/v2-suite.js            offline gates only (no Docker, no Bobcoins)
//   node tools/v2-suite.js --json     same, machine-readable summary
//
// Gates:
//   1. unit tests        node --test test/*.test.js
//   2. planner v1 vs v2  tools/v2-eval.js over the 31 saved docs + recorded failures (when present)
//   3. doctor replay     tools/rediagnose.js over the recorded failures of each audit: how many are still "unknown"
// Then it prints the rerun command. The rerun needs Docker and spends Bobcoins: only a human starts it.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDITS = ['audit/real-16-v2', 'audit/known-10-v3', 'audit/known-5'];
const json = process.argv.includes('--json');
const out = { at: new Date().toISOString(), gates: [] };
const say = (s) => { if (!json) console.log(s); };

function run(cmd, args, label) {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: false, maxBuffer: 64 * 1024 * 1024 });
  return { label, code: r.status, ms: Date.now() - t, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// 1. unit tests
const testFiles = fs.readdirSync(path.join(ROOT, 'test')).filter((f) => f.endsWith('.test.js')).map((f) => path.join('test', f));
const t = run(process.execPath, ['--test', ...testFiles], 'unit tests');
const num = (k) => Number((t.stdout.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm')) || [])[1] || 0);
out.gates.push({ gate: 'unit tests', ok: t.code === 0, tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), seconds: Math.round(t.ms / 1000) });
say(`1. unit tests: ${num('pass')}/${num('tests')} pass, ${num('fail')} fail, ${num('skipped')} skipped (${Math.round(t.ms / 1000)} s)`);

// 2. planner v1 vs v2 (Edith's harness, #127) when it is on this branch
if (fs.existsSync(path.join(ROOT, 'tools/v2-eval.js'))) {
  const e = run(process.execPath, ['tools/v2-eval.js'], 'v2-eval');
  const tail = e.stdout.trim().split('\n').slice(-8).join('\n');
  out.gates.push({ gate: 'planner v1 vs v2', ok: e.code === 0, summary: tail });
  say(`2. planner v1 vs v2 (tools/v2-eval.js): exit ${e.code}\n${tail.replace(/^/gm, '   ')}`);
} else {
  out.gates.push({ gate: 'planner v1 vs v2', ok: null, summary: 'tools/v2-eval.js not on this branch yet (Edith #127)' });
  say('2. planner v1 vs v2: tools/v2-eval.js not on this branch yet (Edith #127)');
}

// 3. doctor replay on recorded failures: which "unknown" failures the rules now name
const doc = [];
for (const a of AUDITS) {
  if (!fs.existsSync(path.join(ROOT, a, 'audit.json'))) { doc.push({ audit: a, missing: true }); continue; }
  const r = run(process.execPath, ['tools/rediagnose.js', a], `rediagnose ${a}`);
  const blocks = r.stdout.split(/\n(?=\S)/).filter((b) => /recorded:/.test(b));
  const wasUnknown = blocks.filter((b) => /recorded:\s+unknown/.test(b));
  const nowNamed = wasUnknown.filter((b) => !/now:\s+unknown/.test(b));
  // A diagnosis Bob made can't be reproduced by a rules-only replay: that is not a regression.
  const byBob = (b) => {
    const [slug, ev] = b.split(/\s+/);
    try { return JSON.parse(fs.readFileSync(path.join(ROOT, a, 'runs', slug, 'evidence', `${ev}.json`), 'utf8')).diagnosis?.by === 'bob'; } catch { return false; }
  };
  const lost = blocks.filter((b) => !/recorded:\s+unknown/.test(b) && /now:\s+unknown/.test(b));
  const regressed = lost.filter((b) => !byBob(b));
  doc.push({ audit: a, failures: blocks.length, wasUnknown: wasUnknown.length, nowNamed: nowNamed.length, stillUnknown: wasUnknown.length - nowNamed.length, regressed: regressed.length, bobOnly: lost.length - regressed.length });
}
out.gates.push({ gate: 'doctor replay', ok: doc.every((d) => d.missing || d.regressed === 0), audits: doc });
say('3. doctor replay on recorded failures (rules only):');
for (const d of doc) say(d.missing ? `   ${d.audit}: not on this machine` : `   ${d.audit}: ${d.failures} failures; ${d.wasUnknown} were unknown, ${d.nowNamed} now named, ${d.stillUnknown} still unknown; ${d.regressed} lost a rules diagnosis${d.bobOnly ? `, ${d.bobOnly} were Bob-diagnosed (not replayed offline)` : ""}`);

// The rerun: ready, not started.
const list = 'audit/v2-31-repos.json';
const rerun = `node bin/firstrun.js audit ${list} --concurrency 3 --brain auto --bob-budget 0.2 --id v2-31`;
out.rerun = { list, command: rerun, needs: 'Docker Desktop running; at most 0.2 Bobcoins per repo (31 repos, ~6.2 max)', started: false };
say(`\nReady, NOT started (needs Docker + Bobcoins, a human decides):\n   ${rerun}\n   ${out.rerun.needs}`);

out.ok = out.gates.every((g) => g.ok !== false);
if (json) console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
