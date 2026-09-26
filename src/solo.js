import fs from 'node:fs';
import path from 'node:path';
import { scout, summarizeFacts } from './scout/index.js';
import { buildPlan } from './plan.js';
import { Recorder } from './recorder.js';
import { diagnose } from './doctor/index.js';
import { makeBudget } from './pipeline.js';
import { renderReport } from './scribe/report.js';
import { readJson, shortId, headTail } from './util.js';

/**
 * Solo agents (#90, docs/DOCK_CONTRACT.md): each character of the team, run on its own. A newcomer who only
 * needs one onboarding person calls just that one. Each writes the same events.ndjson as the full pipeline,
 * so its Dock character animates, and returns the result the contract lists for `--json`.
 */

const runDirFor = (root, agent, out) => path.resolve(out || path.join(root, '.firstrun', `${agent}-${shortId()}`));

/** Scout: what a newcomer reads (docs) next to what is true (manifests, runtimes, services, env vars). */
export async function runScout(repoDir, { out } = {}) {
  const root = path.resolve(repoDir);
  const dir = runDirFor(root, 'scout', out);
  const rec = new Recorder(dir, { id: path.basename(dir), repo: path.basename(root) });
  rec.phase('scout', 'scout');
  const facts = summarizeFacts(await scout(root));
  rec.emitEvent('scout', 'facts', facts);
  rec.emitEvent('scout', 'done', { verdict: 'SCOUTED' });
  return { agent: 'scout', facts, runDir: dir };
}

/**
 * Doctor: diagnose one failure log, the moment a newcomer is stuck. Rules first (free); IBM Bob only when
 * a budget is given. The repo gives context (manifests, env files, code the error names).
 */
export async function runDoctor({ log, repo = '.', command = '', out, bobBudget = 0 } = {}) {
  if (!String(log || '').trim()) throw new Error('doctor needs a failure log (--log <file> or stdin)');
  const root = path.resolve(repo);
  const dir = runDirFor(root, 'doctor', out);
  const rec = new Recorder(dir, { id: path.basename(dir), repo: path.basename(root) });
  const facts = await scout(root);
  const plan = buildPlan(facts);
  const step = { id: 'S1', command: command || '(pasted log)', kind: 'other', source: {} };
  plan.steps = [step];
  rec.phase('repair', 'doctor');
  const budget = makeBudget(bobBudget, Math.min(bobBudget, 1.5) || 1.5);
  const ctx = { step, attempt: { out: log, exitCode: 1 }, log: headTail(log), facts, plan, image: plan.image, sandbox: { services: [] }, tried: new Set(), history: [], sandboxEnv: {} };
  const { diagnosis, fix } = await diagnose(ctx, { brain: bobBudget > 0 ? 'auto' : 'rules', bobBudget: budget });
  rec.emitEvent('doctor', 'diagnosis', { stepId: 'S1', diagnosis });
  if (fix) rec.emitEvent('doctor', 'fix', { stepId: 'S1', fix });
  rec.emitEvent('doctor', 'evidence', { id: 'E1', stepId: 'S1', status: fix ? 'proposed' : 'needs-human' });
  rec.emitEvent('doctor', 'done', { verdict: fix ? 'DIAGNOSED' : 'NEEDS-HUMAN' });
  return { agent: 'doctor', diagnosis, fix: fix || null, bobcoins: budget.spent(), runDir: dir };
}

/** Scribe: rewrite the report from a finished run (no Docker, no rerun). */
export async function runScribe(runDir) {
  const dir = path.resolve(runDir);
  const run = readJson(path.join(dir, 'run.json'));
  if (!run) throw new Error(`no run.json in ${dir}; point scribe at a finished run folder`);
  const plan = readJson(path.join(dir, 'plan.json')) || run.plan;
  const evDir = path.join(dir, 'evidence');
  const evidence = fs.existsSync(evDir) ? fs.readdirSync(evDir).filter((f) => f.endsWith('.json')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map((f) => readJson(path.join(evDir, f))).filter(Boolean) : [];
  const passport = run.passport;
  if (!passport || !plan) throw new Error(`${dir} has no passport or plan yet; the run did not finish`);
  const outDir = path.join(dir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const report = path.join(outDir, 'FIRSTRUN.md');
  fs.writeFileSync(report, renderReport({ passport, plan, evidence, conflicts: run.conflicts || plan.conflicts || [] }));
  const passportFile = path.join(outDir, 'passport.json');
  fs.writeFileSync(passportFile, JSON.stringify(passport, null, 2));
  const readmeDiff = ['README.diff', 'readme.diff'].map((f) => path.join(outDir, f)).find((f) => fs.existsSync(f)) || null;
  // Events go to the run's own log so the Scribe character lights up on the same run.
  fs.appendFileSync(path.join(dir, 'events.ndjson'), `${JSON.stringify({ t: new Date().toISOString(), run: run.id, agent: 'scribe', type: 'artifact', data: { path: 'out/FIRSTRUN.md' } })}\n`);
  return { agent: 'scribe', files: { report, readmeDiff, passport: passportFile }, runDir: dir };
}
