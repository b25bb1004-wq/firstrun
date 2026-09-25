import path from 'node:path';
import { scout, summarizeFacts } from './scout/index.js';
import { buildPlan } from './plan.js';
import { Sandbox } from './sandbox.js';
import { Recorder } from './recorder.js';
import { diagnose, fixSignature } from './doctor/index.js';
import { RULES } from './doctor/rules.js';
import { needsBobPlanner, bobPlan } from './brain/planner.js';
import { runServicesStep } from './services-shim.js';
import { applyPatchOps, materialize } from './patches.js';
import { publish } from './scribe/index.js';
import { run, tail, nowIso, shortId, readText } from './util.js';

const MAX_REPAIRS_PER_STEP = 3;
const MAX_REBASES = 3;

/** Does the error a fix targeted still occur after the fix? */
async function stillFailing(diagnosis, before, after, ctx) {
  if (diagnosis.ruleId) {
    const rule = RULES.find((r) => r.id === diagnosis.ruleId);
    if (rule) {
      try {
        const again = await rule.test({ ...ctx, attempt: after, log: tail(after.out, 200) });
        return !!again && again.ruleId === diagnosis.ruleId && again.cause === diagnosis.cause;
      } catch { return true; }
    }
  }
  const sig = tail(before.out, 40).split('\n').reverse().find((l) => /error|ERR!|refused|not found|missing|cannot|No such|Traceback|exception/i.test(l));
  return sig ? after.out.includes(sig.trim()) : true;
}

export function makeBudget(total = 4, perCall = 1.5) {
  let spent = 0;
  return { total, perCall, spend: (x) => { spent += x; }, spent: () => spent, remaining: () => total - spent };
}

async function gitInfo(dir) {
  const sha = await run('git', ['-C', dir, 'rev-parse', '--short=10', 'HEAD']);
  const top = (await run('git', ['-C', dir, 'rev-parse', '--show-toplevel'])).out.trim();
  const nested = top && path.resolve(top) !== path.resolve(dir);
  const remote = nested ? { code: 1 } : await run('git', ['-C', dir, 'config', '--get', 'remote.origin.url']);
  const dirty = await run('git', ['-C', dir, 'status', '--porcelain', '--', '.']);
  return {
    commit: sha.code === 0 ? sha.out.trim() + (dirty.out.trim() ? '+dirty' : '') : 'working-tree',
    remote: remote.code === 0 ? remote.out.trim().replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/') : null,
  };
}

/**
 * Verify one repository end to end:
 * scout → plan → cold start with repairs → replay from zero → publish.
 */
export async function verifyRepo(repoDir, opts = {}) {
  const root = path.resolve(repoDir);
  const git = await gitInfo(root);
  const repo = opts.repoLabel || git.remote?.replace(/^https:\/\/github\.com\//, '') || path.basename(root);
  const outDir = path.resolve(opts.out || path.join(root, '.firstrun'));
  const id = opts.id || `${path.basename(root)}-${shortId()}`;
  const rec = new Recorder(outDir, { id, repo, commit: git.commit });
  opts.onRecorder?.(rec);
  const brain = opts.brain || 'auto';
  const budget = opts.budget || makeBudget(opts.bobBudget ?? 4, opts.bobPerCall ?? 1.5);
  const say = (agent, msg) => rec.emitEvent(agent, 'note', { message: msg });
  const startedAt = Date.now();
  let sandbox = null;
  let replayBox = null;
  try {
    // ── Scout ─────────────────────────────────────────────────────────
    rec.phase('scout', 'scout');
    const facts = await scout(root);
    rec.emitEvent('scout', 'facts', summarizeFacts(facts));
    if (!facts.docs.length) throw new Error('No README found.');

    // ── Plan ──────────────────────────────────────────────────────────
    rec.phase('plan', 'planner');
    const plan = buildPlan(facts, { repo, commit: git.commit });
    if (brain !== 'rules' && needsBobPlanner(plan, facts) && budget.remaining() > 0) {
      say('planner', `asking IBM Bob to read the onboarding docs${facts.extraDocs?.length ? ` (${facts.extraDocs.join(', ')})` : ''}`);
      const bp = await bobPlan({ facts, plan, budget });
      rec.state.bobcoins = budget.spent();
      rec.emitEvent('planner', 'bob', { mode: 'firstrun-planner', bobcoins: bp.bobcoins, ok: bp.ok, taskId: bp.taskId, error: bp.error });
      if (bp.ok && plan.steps.filter((s) => !s.skip).length < 2) {
        plan.steps = bp.steps;
        plan.plannedBy = 'bob';
        plan.steps.forEach((s, k) => { s.id = `S${k + 1}`; });
        const serve = plan.steps.find((s) => !s.skip && (s.kind === 'serve' || (bp.serve?.command && s.command === bp.serve.command)));
        if (serve) {
          serve.kind = 'serve';
          serve.serve = { port: Number(bp.serve?.port) || facts.ports[0] || 3000 };
          plan.verify = { kind: 'http', target: `http://127.0.0.1:${serve.serve.port}${bp.serve?.healthPath || '/'}` };
        }
        if (bp.notes) say('planner', `IBM Bob: ${bp.notes}`);
      } else if (bp.ok) {
        const known = new Set(plan.steps.map((s) => s.command));
        for (const s of bp.steps.filter((x) => !known.has(x.command) && !x.skip)) {
          plan.conflicts.push({ what: 'step only in other docs', docs: s.command, truth: `found by IBM Bob in ${s.source.file}${s.source.where ? ` ${s.source.where}` : ''}`, source: s.source.file });
        }
      }
    }
    plan.originalImage = plan.image;
    plan.originalRuntime = { ...plan.runtime };
    for (const s of plan.steps) s.status = s.skip ? 'skipped' : 'pending';
    for (const s of plan.steps) rec.stepStatus(s.id, s.status, 0);
    rec.state.conflicts = plan.conflicts;
    rec.savePlan(plan);
    rec.emitEvent('planner', 'plan', plan);
    if (!plan.steps.some((s) => !s.skip)) throw new Error('The docs contain no setup commands FirstRun can follow.');

    // ── Cold start ────────────────────────────────────────────────────
    rec.phase('coldstart', 'runner');
    const patchOps = [];
    const tried = new Set();
    let firstFailure = null;
    let rebases = 0;
    let stepSeq = plan.steps.length;
    sandbox = new Sandbox({ image: plan.image, repoDir: root, label: id, log: (m) => say('runner', m) });
    await sandbox.start();
    say('runner', `clean machine ready: ${plan.image}`);

    const attempts = {};
    const execStep = async (step, { agent = 'runner', box = sandbox, quiet = false } = {}) => {
      attempts[step.id] = (attempts[step.id] || 0) + 1;
      const n = attempts[step.id];
      if (!quiet) {
        if (agent !== 'verifier') rec.stepStatus(step.id, 'running', n);
        rec.emitEvent(agent, 'step.start', { stepId: step.id, n, command: step.command });
      }
      const onData = quiet ? undefined : (chunk) => rec.log(step.id, n, chunk);
      let r;
      if (step.kind === 'services') { const t = Date.now(); r = await runServicesStep(step.command, { sandbox: box, facts }); r.durationMs = Date.now() - t; }
      else if (step.kind === 'serve') {
        r = await box.serve(step.command, { port: step.serve?.port, onData, timeoutMs: 150_000 });
        if (r.exitCode === 0 && plan.verify.kind === 'http') {
          const p = await box.probe(plan.verify.target, { timeoutMs: 45_000 });
          r.out += `\n[firstrun] GET ${plan.verify.target} → ${p.status || 'no response'}${p.body ? `\n${tail(p.body, 6)}` : ''}\n`;
          if (!p.ok) r.exitCode = 1;
          step.probe = { status: p.status, body: tail(p.body || '', 6) };
        }
      } else r = await box.exec(step.command, { onData, timeoutMs: step.kind === 'install' ? 25 * 60_000 : 12 * 60_000, detectServer: ['other', 'build'].includes(step.kind) });
      const attempt = {
        stepId: step.id, n, command: step.command, exitCode: r.exitCode, durationMs: r.durationMs,
        logTail: tail(r.out, 60), logFile: rec.writeLog(`${agent === 'verifier' ? 'replay-' : ''}${step.id}-${n}`, r.out), out: r.out,
      };
      if (!quiet) {
        rec.flushLog(step.id, n);
        const { out, ...pub } = attempt;
        rec.emitEvent(agent, 'step.end', { ...pub, status: r.exitCode === 0 ? 'passed' : 'failed' });
      }
      return attempt;
    };

    const readSandboxEnv = async () => {
      const env = {};
      const dotenv = (await sandbox.readFile('.env')) || '';
      for (const l of dotenv.split('\n')) { const m = l.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
      const st = (await sandbox.readFile('/firstrun/state.env')) || '';
      for (const l of st.split('\n')) { const m = l.match(/^declare -x ([A-Za-z_]\w*)="(.*)"$/); if (m) env[m[1]] = m[2]; }
      return env;
    };

    let repairSeq = 0;
    const newStep = (command, kind, before) => ({
      id: `R${++repairSeq}`, command, kind, origin: 'repair', status: 'pending',
      source: { ...before.source, insertedBefore: before.id },
    });

    let i = 0;
    let stopped = null;
    while (i < plan.steps.length) {
      const step = plan.steps[i];
      if (step.skip) { i++; continue; }
      if (opts.maxMinutes && Date.now() - startedAt > opts.maxMinutes * 60_000) {
        say('runner', `time budget of ${opts.maxMinutes} min reached; stopping before ${step.id}`);
        stopped = step.id;
        break;
      }
      let attempt = await execStep(step);
      if (attempt.exitCode === 0) {
        step.status = step.status === 'repairing' ? 'repaired' : 'passed';
        rec.stepStatus(step.id, step.status);
        i++;
        continue;
      }
      if (!firstFailure) firstFailure = { stepId: step.id, command: step.command, source: step.source };
      rec.stepStatus(step.id, 'failed');
      // ── Repair loop ────────────────────────────────────────────────
      let repaired = false;
      let restart = false;
      let totalRepairs = 0;
      const history = [];
      const stepEvidence = [];
      for (let k = 0; k < MAX_REPAIRS_PER_STEP && !repaired; k++) {
        rec.phase('repair', 'doctor');
        const ctx = {
          step, attempt, log: tail(attempt.out, 200), facts, plan, sandbox, tried, history,
          image: sandbox.image, sandboxEnv: await readSandboxEnv(),
        };
        const { diagnosis, fix } = await diagnose(ctx, {
          brain, bobBudget: budget,
          onBob: (res) => {
            rec.state.bobcoins = budget.spent();
            rec.emitEvent('doctor', 'bob', { mode: 'firstrun-doctor', bobcoins: res.bobcoins || 0, ok: res.ok, taskId: res.taskId, error: res.error });
          },
        });
        rec.emitEvent('doctor', 'diagnosis', { stepId: step.id, diagnosis });
        const evId = `E${rec.state.evidence.length + 1}`;
        const { out: _o, ...before } = attempt;
        if (!fix) {
          rec.evidence({ id: evId, stepId: step.id, before, diagnosis, fix: null, after: null, status: 'needs-human', at: nowIso() });
          break;
        }
        tried.add(fixSignature(step.id, fix));
        rec.emitEvent('doctor', 'fix', { stepId: step.id, fix });
        const fixLog = [];
        // Repo patches (PR content) land in the sandbox first so the fix's commands see them.
        for (const p of fix.patches || []) {
          patchOps.push(p);
          const current = (await sandbox.readFile(p.path)) ?? '';
          await sandbox.writeFile(p.path, applyPatchOps(current, [p]));
          fixLog.push(`patched ${p.path}`);
        }
        // Apply the fix in the sandbox.
        for (const a of fix.actions) {
          if (a.type === 'rebase') {
            if (rebases >= MAX_REBASES) { fixLog.push('rebase limit reached'); continue; }
            rebases++;
            say('runner', `switching the clean machine to ${a.image}`);
            await sandbox.rebase(a.image);
            plan.image = a.image;
            if (a.runtime) plan.runtime = { ...a.runtime };
            for (const p of materialize(root, patchOps)) await sandbox.writeFile(p.path, p.content);
            restart = true;
            fixLog.push(`rebased onto ${a.image}`);
          } else if (a.type === 'service') {
            const r = await sandbox.addService({ name: a.name, image: a.image, env: a.env || {}, port: a.port });
            fixLog.push(`started ${a.image} as "${a.name}" on localhost:${a.port}${r.ready === false ? ' (not ready!)' : ''}`);
          } else if (a.type === 'exec') {
            const r = await sandbox.exec(a.command, { timeoutMs: 10 * 60_000 });
            fixLog.push(`$ ${a.command}\n${tail(r.out, 15)}${r.exitCode ? `\n(exit ${r.exitCode})` : ''}`);
          } else if (a.type === 'write') {
            await sandbox.writeFile(a.path, a.content);
            fixLog.push(`wrote ${a.path}`);
          } else if (a.type === 'replace-step') {
            step.readmeCommand = step.readmeCommand || step.command;
            step.command = a.command;
            fixLog.push(`step command → ${a.command}`);
          } else if (a.type === 'insert-before') {
            const ns = newStep(a.command, a.kind || 'other', step);
            if (a.silent) ns.silent = true;
            plan.steps.splice(i, 0, ns);
            i++;
            rec.stepStatus(ns.id, 'pending', 0);
            rec.savePlan(plan);
            rec.emitEvent('planner', 'step.inserted', { step: ns, before: step.id });
            rec.emitEvent('planner', 'plan', plan);
            if (!restart) {
              const ia = await execStep(ns);
              ns.status = ia.exitCode === 0 ? 'passed' : 'failed';
              rec.stepStatus(ns.id, ns.status);
              fixLog.push(`$ ${ns.command} → exit ${ia.exitCode}`);
            }
          }
        }
        step.status = 'repairing';
        step.evidence = [...(step.evidence || []), evId];
        rec.savePlan(plan);
        if (restart) {
          // A new machine: replay everything that already passed, then retry this step.
          say('runner', 'replaying earlier steps on the new machine');
          for (let j = 0; j < i; j++) {
            const prev = plan.steps[j];
            if (prev.skip || prev.status === 'failed') continue;
            const pa = await execStep(prev, { quiet: true });
            if (pa.exitCode !== 0) fixLog.push(`warning: ${prev.id} failed on the new machine (exit ${pa.exitCode})`);
          }
          restart = false;
        }
        rec.phase('coldstart', 'runner');
        const after = await execStep(step);
        const { out: _a, ...afterPub } = after;
        const verified = after.exitCode === 0;
        // A fix can clear its own error and reveal the next one (a renamed script
        // that now runs and hits a missing env var). That fix worked: record it as
        // "progressed" and promote it once the step finally passes.
        const progressed = !verified && !(await stillFailing(diagnosis, attempt, after, ctx));
        const record = {
          id: evId, stepId: step.id, before, diagnosis, fix: { ...fix, log: fixLog.join('\n') },
          after: afterPub, status: verified ? 'verified' : progressed ? 'progressed' : 'failed', at: nowIso(),
        };
        rec.evidence(record);
        stepEvidence.push(record);
        history.push({ cause: diagnosis.cause, actions: fix.actions });
        if (verified) {
          repaired = true;
          for (const r of stepEvidence.filter((x) => x.status === 'progressed')) {
            rec.evidence({ ...r, status: 'verified', after: afterPub, revealed: stepEvidence[stepEvidence.indexOf(r) + 1]?.id });
          }
        } else {
          attempt = after;
          if (progressed) k--; // progress doesn't use up this step's repair budget…
          if (++totalRepairs > 8) break; // …but a hard cap still prevents loops
        }
      }
      if (!repaired) {
        for (const r of stepEvidence.filter((x) => x.status === 'progressed')) rec.evidence({ ...r, status: 'failed' });
      }
      if (repaired) {
        step.status = 'repaired';
        rec.stepStatus(step.id, 'repaired');
        i++;
        continue;
      }
      step.status = 'needs-human';
      rec.stepStatus(step.id, 'needs-human');
      if (step.kind === 'test' || step.probe) { i++; continue; }
      stopped = step.id;
      break;
    }
    if (stopped) {
      for (const s of plan.steps) if (s.status === 'pending') { s.status = 'blocked'; rec.stepStatus(s.id, 'blocked'); }
    }
    rec.savePlan(plan);
    await sandbox.stop();
    sandbox = null;

    // ── Replay from zero ─────────────────────────────────────────────
    const patched = materialize(root, patchOps);
    let replay = null;
    const replayable = !stopped;
    if (replayable && opts.replay !== false) {
      rec.phase('replay', 'verifier');
      rec.emitEvent('verifier', 'replay.start', { status: 'running', durationMs: 0, image: plan.image, steps: plan.steps.filter((s) => !s.skip && s.status !== 'needs-human').length });
      const t0 = Date.now();
      replayBox = new Sandbox({ image: plan.image, repoDir: root, label: `${id}-replay`, patches: patched.map(({ path: p, content }) => ({ path: p, content })) });
      await replayBox.start();
      let failed = null;
      for (const step of plan.steps) {
        if (step.skip || step.status === 'needs-human') continue;
        const a = await execStep(step, { agent: 'verifier', box: replayBox });
        if (a.exitCode !== 0 && step.kind !== 'test' && !step.probe) { failed = step.id; break; }
        if (a.exitCode !== 0) failed = failed || step.id;
      }
      replay = { status: failed ? 'failed' : 'passed', durationMs: Date.now() - t0, failedStep: failed || undefined };
      rec.state.replay = replay;
      rec.emitEvent('verifier', 'replay.end', replay);
      await replayBox.stop();
      replayBox = null;
    }

    // ── Publish ──────────────────────────────────────────────────────
    rec.phase('publish', 'scribe');
    const evidence = rec.state.evidence.map((eid) => JSON.parse(readText(path.join(outDir, 'evidence', `${eid}.json`))));
    const result = await publish({ root, outDir, facts, plan, evidence, patched, replay, firstFailure, rec, bobcoins: budget.spent(), stopped });
    rec.state.passport = result.passport;
    rec.state.bobcoins = budget.spent();
    rec.state.finishedAt = nowIso();
    rec.phase('done', 'swarm');
    rec.emitEvent('swarm', 'done', { verdict: result.passport.verdict, passport: result.passport });
    return { ok: true, dir: outDir, state: rec.state, passport: result.passport };
  } catch (err) {
    rec.state.error = err.message;
    rec.state.finishedAt = nowIso();
    rec.phase('error', 'swarm');
    rec.emitEvent('swarm', 'error', { message: err.message });
    return { ok: false, dir: outDir, state: rec.state, error: err };
  } finally {
    if (sandbox && !opts.keep) await sandbox.stop().catch(() => {});
    if (replayBox && !opts.keep) await replayBox.stop().catch(() => {});
  }
}
