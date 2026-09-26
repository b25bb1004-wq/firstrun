#!/usr/bin/env node
// Engine v2 suite: every offline gate in one command, then the exact 31-repo rerun, ready but NOT started.
//
//   node tools/v2-suite.js            offline gates only (no Docker, no Bobcoins)
//   node tools/v2-suite.js --json     same, machine-readable summary
//   node tools/v2-suite.js --v1 <dir> v1 checkout to compare against (default ../v1-main)
//
// Gates:
//   1. unit tests        node --test test/*.test.js
//   2. v1 vs v2          tools/v2-eval.js: plans for the 31 saved docs (0 risky skips) and every recorded failure
//                        re-diagnosed from committed logs (0 worse). Needs a v1 checkout: without one it is NOT RUN.
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

// 2. planner + diagnosis, v1 vs v2 (Edith's harness): section 1 plans the 31 saved docs, section 2 re-diagnoses every
// recorded failure from the logs committed with the audits. It needs a v1 checkout; without one this gate is NOT RUN
// (never a silent pass). Make one with: git worktree add ../v1-main origin/main   (then copy node_modules into it)
const v1 = (() => { const i = process.argv.indexOf('--v1'); return path.resolve(ROOT, i >= 0 ? process.argv[i + 1] : '../v1-main'); })();
const auditsHere = AUDITS.filter((a) => fs.existsSync(path.join(ROOT, a, 'audit.json')));
if (!fs.existsSync(path.join(ROOT, 'tools/v2-eval.js'))) {
  out.gates.push({ gate: 'v1 vs v2', ok: false, notRun: 'tools/v2-eval.js missing' });
  say('2. v1 vs v2: NOT RUN (tools/v2-eval.js missing)');
} else if (!fs.existsSync(path.join(v1, 'src', 'plan.js')) || !fs.existsSync(path.join(v1, 'node_modules'))) {
  out.gates.push({ gate: 'v1 vs v2', ok: false, notRun: `no v1 checkout with node_modules at ${v1}` });
  say(`2. v1 vs v2: NOT RUN (no v1 checkout with node_modules at ${v1}; git worktree add ../v1-main origin/main, then copy node_modules)`);
} else {
  const e = run(process.execPath, ['tools/v2-eval.js', '--v1', v1, '--audit', auditsHere.join(',')], 'v2-eval');
  const summary = (e.stdout.match(/\*\*Summary:\*\*.*$/m) || [''])[0];
  const diag = (e.stdout.match(/^(\d+) recorded failures diagnosed differently by v2, (\d+) unchanged/m) || []);
  const risky = Number((summary.match(/(\d+) risky skips/) || [])[1] ?? NaN);
  const failures = diag.length ? Number(diag[1]) + Number(diag[2]) : 0;
  const worse = (e.stdout.match(/\| unknown \|\s*$/gm) || []).length; // a row whose v2 column went back to unknown
  const ok = e.code === 0 && risky === 0 && failures > 0 && worse === 0;
  out.gates.push({ gate: 'v1 vs v2', ok, audits: auditsHere, risky, failuresChecked: failures, changed: Number(diag[1] || 0), worse, summary });
  say(`2. v1 vs v2 (tools/v2-eval.js, audits: ${auditsHere.join(', ')}):\n   ${summary.replace(/\*\*/g, '')}\n   ${failures} recorded failures re-diagnosed: ${diag[1] || 0} changed, ${worse} worse${failures === 0 ? '  <- 0 failures checked: NOT a pass' : ''}`);
}
if (auditsHere.length < AUDITS.length) say(`   note: missing audit logs on this machine: ${AUDITS.filter((a) => !auditsHere.includes(a)).join(', ')}`);

// The rerun: ready, not started. Concurrency 1 so timings are quotable (teamhide flaked at 3);
// 0.19 Bobcoins per repo keeps 31 repos under the 6-Bobcoin cap.
const list = 'audit/v2-31-repos.json';
// Rules only by default: 0 Bobcoins, and the Bob key should be unset in that shell (Arnav, 26 Sep).
// Bob passes run later, only on repos HUMBLE couldn't judge, on Karmanya's PC with his key.
const rerun = `node bin/firstrun.js audit ${list} --concurrency 1 --brain rules --bob-budget 0 --id v2-31`;
out.rerun = { list, command: rerun, needs: 'Docker Desktop running; rules only, 0 Bobcoins (unset BOB_API_KEY); several hours at concurrency 1. Optional Bob pass afterwards: only INCONCLUSIVE repos, --brain auto --bob-budget 0.19, on the PC of the teammate whose Bobcoins are used (Karmanya), max 5 Bobcoins', started: false };
say(`\nReady, NOT started (needs Docker + Bobcoins, a human decides):\n   ${rerun}\n   ${out.rerun.needs}`);

out.ok = out.gates.every((g) => g.ok !== false);
if (json) console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
