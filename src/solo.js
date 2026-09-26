import fs from 'node:fs';
import path from 'node:path';
import { scout, summarizeFacts } from './scout/index.js';
import { buildPlan } from './plan.js';
import { Recorder } from './recorder.js';
import { diagnose } from './doctor/index.js';
import { makeBudget } from './pipeline.js';
import { renderReport } from './scribe/report.js';
import { readJson, shortId, headTail, run } from './util.js';
import { Sandbox } from './sandbox.js';
import { runServicesStep } from './services-shim.js';

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

/** Planner: the ordered setup steps a newcomer would follow, plus docs-vs-code conflicts. No Docker. */
export async function runPlanner(repoDir, { out } = {}) {
  const root = path.resolve(repoDir);
  const dir = runDirFor(root, 'planner', out);
  const rec = new Recorder(dir, { id: path.basename(dir), repo: path.basename(root) });
  rec.phase('scout', 'scout');
  const facts = await scout(root);
  rec.emitEvent('scout', 'facts', summarizeFacts(facts));
  rec.phase('plan', 'planner');
  const plan = buildPlan(facts);
  rec.savePlan(plan);
  rec.emitEvent('planner', 'plan', plan);
  rec.emitEvent('planner', 'done', { verdict: plan.steps.some((s) => !s.skip) ? 'PLANNED' : 'NO-SETUP-DOCS' });
  return { agent: 'planner', plan, conflicts: plan.conflicts, runDir: dir };
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

/**
 * Runner (--as-written): follows the README exactly on a clean machine (shims on),
 * no Doctor, no repairs, no replay. Stops at the first failing step.
 * Verdict: WORKS-AS-WRITTEN | BROKEN-AS-WRITTEN with firstFailure.
 * Writes events.ndjson (phase coldstart, step.start/step.end, done) for the Dock's Runner character.
 */
export async function runRunner(repoDir, { out, asWritten = false } = {}) {
  if (!asWritten) throw new Error('runRunner requires asWritten: true');
  const root = path.resolve(repoDir);
  const dir = runDirFor(root, 'runner', out);
  const rec = new Recorder(dir, { id: path.basename(dir), repo: path.basename(root) });
  rec.phase('scout', 'scout');
  const facts = await scout(root);
  rec.emitEvent('scout', 'facts', summarizeFacts(facts));
  rec.phase('plan', 'planner');
  const plan = buildPlan(facts);
  rec.savePlan(plan);
  rec.emitEvent('planner', 'plan', plan);
  if (!plan.steps.some((s) => !s.skip)) {
    // Nothing to follow is a finding, never a pass.
    rec.phase('done', 'runner');
    rec.emitEvent('runner', 'done', { verdict: 'NO-SETUP-DOCS', firstFailure: null });
    return { agent: 'runner', verdict: 'NO-SETUP-DOCS', firstFailure: null, runDir: dir };
  }
  rec.phase('coldstart', 'runner');
  const cacheVolume = `firstrun-cache-${path.basename(dir)}`;
  await run('docker', ['volume', 'rm', '-f', cacheVolume]).catch(() => {});
  await run('docker', ['volume', 'create', '--label', `firstrun=${path.basename(dir)}`, cacheVolume]);
  const sandbox = new Sandbox({ image: plan.image, repoDir: root, label: path.basename(dir), cacheVolume, log: () => {} });
  let firstFailure = null;
  try {
  await sandbox.start();
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (step.skip) continue;
    rec.emitEvent('runner', 'step.start', { stepId: step.id, n: 1, command: step.command });
    let r;
    if (step.kind === 'services') {
      const { runServicesStep } = await import('./services-shim.js');
      r = await runServicesStep(step.command, { sandbox, facts });
    } else if (step.kind === 'serve') {
      r = await sandbox.serve(step.command, { port: step.serve?.port, timeoutMs: 150_000 });
      if (r.exitCode === 0 && plan.verify.kind === 'http') {
        const p = await sandbox.probe(plan.verify.target, { timeoutMs: 45_000 });
        if (!p.ok) r.exitCode = 1;
      }
    } else {
      r = await sandbox.exec(step.command, { timeoutMs: step.kind === 'install' ? 25 * 60_000 : step.kind === 'test' ? (Number(process.env.FIRSTRUN_TEST_MINUTES) || 5) * 60_000 : 12 * 60_000, detectServer: ['other', 'build'].includes(step.kind) });
    }
    const attempt = {
      stepId: step.id, n: 1, command: step.command, exitCode: r.exitCode, durationMs: r.durationMs,
      logTail: r.out.split('\n').slice(-60).join('\n'), logFile: rec.writeLog(`${step.id}-1`, r.out), out: r.out,
    };
    rec.flushLog(step.id, 1);
    rec.emitEvent('runner', 'step.end', { stepId: step.id, n: 1, command: step.command, exitCode: r.exitCode, durationMs: r.durationMs, status: r.exitCode === 0 ? 'passed' : 'failed' });
    if (r.exitCode !== 0 && !firstFailure) {
      firstFailure = { stepId: step.id, command: step.command, exitCode: r.exitCode, logTail: tail(r.out, 40) };
      break;
    }
  }
  } finally {
    // Always clean up: the box and this run's package cache.
    await sandbox.stop().catch(() => {});
    await run('docker', ['volume', 'rm', '-f', cacheVolume]).catch(() => {});
  }
  const verdict = firstFailure ? 'BROKEN-AS-WRITTEN' : 'WORKS-AS-WRITTEN';
  rec.phase('done', 'runner');
  rec.emitEvent('runner', 'done', { verdict, firstFailure });
  return { agent: 'runner', verdict, firstFailure, runDir: dir };
}

/**
 * Verifier (replay): takes a finished run directory (its plan.json with repaired
 * steps + prerequisites), starts a NEW clean sandbox and replays the repaired
 * guide from zero. Emits events: replay.start, step.start/step.end (agent
 * verifier), replay.end {status}, done.
 * Result: { agent:'verifier', replay:{ status, durationMs } }.
 * Exit 0 pass / 1 fail.
 */
export async function runVerifier(runDir, { out, repo } = {}) {
  const dir = path.resolve(runDir);
  const saved = readJson(path.join(dir, 'run.json'));
  if (!saved) throw new Error(`no run.json in ${dir}; point verifier at a finished run folder`);
  const plan = readJson(path.join(dir, 'plan.json')) || saved.plan;
  if (!plan?.steps?.length) throw new Error(`${dir} has no plan.json or empty steps; the run did not finish`);
  const passport = saved.passport;
  if (!passport) throw new Error(`${dir} has no passport yet; the run did not finish`);

  // Replay in a new isolated directory
  const replayDir = path.resolve(out || path.join(dir, `verifier-${shortId()}`)); // inside .firstrun, never in the repo
  const rec = new Recorder(replayDir, { id: path.basename(replayDir), repo: saved.repo });
  rec.phase('replay', 'verifier');
  rec.emitEvent('verifier', 'replay.start', { status: 'running', durationMs: 0, image: plan.image, steps: plan.steps.filter((s) => !s.skip && s.status !== 'needs-human').length });
  const t0 = Date.now();

  // The repo is the folder that holds .firstrun (run.json's repo is a label like owner/name).
  const repoDir = repo ? path.resolve(repo) : path.basename(dir) === '.firstrun' ? path.dirname(dir) : null;
  if (!repoDir || !fs.existsSync(repoDir)) throw new Error(`can't find the repo for ${dir}; pass --repo <dir>`);
  const facts = await scout(repoDir);
  const cacheVolume = `firstrun-cache-${path.basename(replayDir)}`;
  await run('docker', ['volume', 'rm', '-f', cacheVolume]).catch(() => {});
  await run('docker', ['volume', 'create', '--label', `firstrun=${path.basename(replayDir)}`, cacheVolume]);
  const sandbox = new Sandbox({ image: plan.image, repoDir, label: path.basename(replayDir), cacheVolume, log: () => {} });
  let failed = null;
  try {
  await sandbox.start();
  for (const step of plan.steps) {
    if (step.skip || step.status === 'needs-human') continue;
    // Apply prereqs from the verified run
    for (const a of step.prereqs || []) {
      if (a.type === 'exec') await sandbox.exec(a.command, { timeoutMs: 10 * 60_000, detectServer: false });
      else if (a.type === 'write') await sandbox.writeFile(a.path, a.content);
      else if (a.type === 'service') await sandbox.addService({ name: a.name, image: a.image, env: a.env || {}, port: a.port });
    }
    rec.emitEvent('verifier', 'step.start', { stepId: step.id, n: 1, command: step.command });
    let r;
    if (step.kind === 'services') { const t = Date.now(); r = await runServicesStep(step.command, { sandbox, facts }); r.durationMs = Date.now() - t; }
    else if (step.kind === 'serve') {
      r = await sandbox.serve(step.command, { port: step.serve?.port, timeoutMs: 150_000 });
      if (r.exitCode === 0 && plan.verify?.kind === 'http') {
        const p = await sandbox.probe(plan.verify.target, { timeoutMs: 45_000 });
        const answers = !plan.verify.fromDocs && p.status && p.status < 500;
        if (!p.ok && !answers) { r.exitCode = 1; r.out += `\nGET ${plan.verify.target} → ${p.status}`; }
      }
    } else {
      r = await sandbox.exec(step.command, { timeoutMs: step.kind === 'install' ? 25 * 60_000 : step.kind === 'test' ? (Number(process.env.FIRSTRUN_TEST_MINUTES) || 5) * 60_000 : 12 * 60_000, detectServer: ['other', 'build'].includes(step.kind) });
    }
    rec.flushLog(step.id, 1);
    rec.emitEvent('verifier', 'step.end', { stepId: step.id, n: 1, command: step.command, exitCode: r.exitCode, durationMs: r.durationMs, status: r.exitCode === 0 ? 'passed' : 'failed' });
    if (r.exitCode !== 0 && step.kind !== 'test' && !step.probe) { failed = step.id; break; }
    if (r.exitCode !== 0) failed = failed || step.id;
  }
  } finally {
    await sandbox.stop().catch(() => {});
    await run('docker', ['volume', 'rm', '-f', cacheVolume]).catch(() => {});
  }
  const replay = { status: failed ? 'failed' : 'passed', durationMs: Date.now() - t0, failedStep: failed || undefined };
  rec.phase('done', 'verifier');
  rec.emitEvent('verifier', 'replay.end', replay);
  const verdict = replay.status === 'passed' ? 'REPLAY-PASSED' : 'REPLAY-FAILED';
  rec.emitEvent('verifier', 'done', { verdict, replay });
  return { agent: 'verifier', replay, runDir: replayDir };
}

function tail(str, n) {
  return (str || '').split('\n').slice(-n).join('\n');
}
