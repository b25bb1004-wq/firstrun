import path from 'node:path';
import { scout, summarizeFacts } from './scout/index.js';
import { buildPlan } from './plan.js';
import { Sandbox } from './sandbox.js';
import { Recorder } from './recorder.js';
import { diagnose, fixSignature } from './doctor/index.js';
import { RULES } from './doctor/rules.js';
import { needsBobPlanner, bobPlan } from './brain/planner.js';
import { bobReviewPlan } from './brain/review.js';
import { runServicesStep } from './services-shim.js';
import { applyPatchOps, materialize } from './patches.js';
import { publish } from './scribe/index.js';
import { flagOn } from './flags.js';
import { run, tail, headTail, nowIso, shortId, readText, shq } from './util.js';

const MAX_REPAIRS_PER_STEP = 3;
const MAX_REBASES = 3;

/** Does the error a fix targeted still occur after the fix? */
export async function stillFailing(diagnosis, before, after, ctx) {
  if (diagnosis.ruleId) {
    const rule = RULES.find((r) => r.id === diagnosis.ruleId);
    if (rule) {
      try {
        const again = await rule.test({ ...ctx, attempt: after, log: headTail(after.out) });
        return !!again && again.ruleId === diagnosis.ruleId && again.cause === diagnosis.cause;
      } catch { return true; }
    }
  }
  const sig = tail(before.out, 40).split('\n').reverse().find((l) => /error|ERR!|refused|not found|missing|cannot|No such|Traceback|exception|fatal:|failed|already exists|denied/i.test(l));
  if (sig) return after.out.includes(sig.trim());
  // No recognisable error line: judge by the last line of output. A different ending means the
  // fix changed the failure (progress), so it shouldn't use up the step's repair budget.
  const last = (out) => (out || '').split('\n').map((l) => l.trim()).filter(Boolean).pop() || '';
  return last(before.out) === last(after.out);
}

/** Write `cwd` back to /firstrun/cwd so the next exec starts in the right dir.
 *  No-op when cwd is null/empty. Never touches /firstrun/state.env. */
export async function restoreCwd(sandbox, cwd) {
  if (!cwd) return;
  await sandbox.writeFile('/firstrun/cwd', cwd);
}

/**
 * A step the Doctor inserted (a fix) failed. Run the rules (never Bob) on it once; if one returns a
 * command-only fix (replace-step), rewrite the inserted step and report what changed. null otherwise.
 */
export async function repairInsertedStep(ns, attempt, { facts, plan, sandbox, tried }) {
  const log = attempt.out || '';
  for (const rule of RULES) {
    let d = null;
    try { d = await rule.test({ step: ns, attempt, log, facts, plan, sandbox, tried: tried || new Set(), history: [], sandboxEnv: {} }); } catch { d = null; }
    if (!d?.fix) continue;
    const acts = d.fix.actions || [];
    if (acts.length !== 1 || acts[0].type !== 'replace-step' || acts[0].command === ns.command) continue;
    const from = ns.command;
    ns.command = acts[0].command;
    return { from, ruleId: d.ruleId || rule.id, cause: d.cause };
  }
  return null;
}

// A failure in one of these kinds blocks every later step; any other failure only blocks its own doc section.
export const HARD_BLOCK_KINDS = new Set(['install', 'prereq', 'env', 'services', 'migrate', 'build']);
/** Test suites get a shorter limit than installs: a newcomer runs them to see things work (FIRSTRUN_TEST_MINUTES). */
const TEST_MINUTES = Number(process.env.FIRSTRUN_TEST_MINUTES) || 5;

export function makeBudget(total = 4, perCall = 1.5) {
  let spent = 0;
  // cap(): what one Bob call may spend now, never more than the run has left (a 1-Bobcoin run spent 1.45 on huggingface_hub).
  return { total, perCall, spend: (x) => { spent += x; }, spent: () => spent, remaining: () => total - spent, cap: () => Math.max(0, Math.min(perCall, total - spent)) };
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
  const cacheVolume = opts.cacheVolume ?? (opts.cache === false ? null : `firstrun-cache-${id}`);
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
    // Bob reviews the lines the rules can't vouch for, once, before anything runs (≤ 0.2 Bobcoins).
    if (brain !== 'rules' && plan.plannedBy !== 'bob' && budget.remaining() > 0) {
      const rv = await bobReviewPlan({ plan, facts, budget, maxCost: Math.min(0.2, budget.remaining()) });
      if (rv.asked) {
        rec.state.bobcoins = budget.spent();
        rec.emitEvent('planner', 'bob', { mode: 'firstrun-planner', review: true, asked: rv.asked, skipped: rv.skipped.length, bobcoins: rv.bobcoins, ok: rv.ok, taskId: rv.taskId, error: rv.error });
        for (const s of rv.skipped) say('planner', `IBM Bob: skip \`${s.command}\` (${s.reason})`);
        plan.bobReview = { asked: rv.asked, skipped: rv.skipped, bobcoins: rv.bobcoins, ok: rv.ok };
      }
    }
    plan.originalImage = plan.image;
    plan.originalRuntime = { ...plan.runtime };
    for (const s of plan.steps) s.status = s.skip ? 'skipped' : 'pending';
    for (const s of plan.steps) rec.stepStatus(s.id, s.status, 0);
    rec.state.conflicts = plan.conflicts;
    rec.savePlan(plan);
    rec.emitEvent('planner', 'plan', plan);
    if (!plan.steps.some((s) => !s.skip)) {
      // A finding, not a crash: a newcomer has nothing to follow. Say which docs were read and why nothing counted.
      const skipped = plan.steps.filter((s) => s.skip).slice(0, 3).map((s) => `"${s.command}" (${s.skip})`).join('; ');
      throw Object.assign(new Error(`No setup docs: ${facts.docs.length ? `read ${facts.docs.join(', ')}` : 'no README found'}, found no setup commands a newcomer could follow${skipped ? `; skipped ${skipped}` : ''}.`), { code: 'NO_SETUP_DOCS' });
    }

    // ── Cold start ────────────────────────────────────────────────────
    rec.phase('coldstart', 'runner');
    const patchOps = [];
    const tried = new Set();
    let firstFailure = null;
    let rebases = 0;
    let stepSeq = plan.steps.length;
    if (cacheVolume) {
      await run('docker', ['volume', 'rm', '-f', cacheVolume]);
      await run('docker', ['volume', 'create', '--label', `firstrun=${id}`, cacheVolume]);
    }
    sandbox = new Sandbox({ image: plan.image, repoDir: root, label: id, cacheVolume, log: (m) => say('runner', m) });
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
        if (r.exitCode === 0 && r.port && r.port !== step.serve?.port) {
          const was = step.serve?.port;
          step.serve = { ...(step.serve || {}), port: r.port };
          if (plan.verify.kind === 'http') {
            // A port the README states is a docs claim: if the app disagrees, that's drift to report.
            if (plan.verify.fromDocs && !plan.conflicts.some((c) => c.what === 'app port')) {
              plan.conflicts.push({ what: 'app port', docs: `localhost:${was}`, truth: `the app listens on ${r.port}`, source: plan.verify.docsSource || 'README' });
            }
            plan.verify.target = plan.verify.target.replace(/:(\d{2,5})(?=\/|$)/, `:${r.port}`);
          }
          rec.savePlan(plan);
        }
        if (r.oneShot) {
          // Not a server after all: it ran to completion. Nothing to probe; the step passed on its exit code.
          step.oneShot = true;
          if (plan.verify.kind === 'http') {
            // Nothing will ever answer the URL. If the docs promised one, that promise is itself drift: say so.
            if (plan.verify.fromDocs && !plan.conflicts.some((c) => c.what === 'app URL')) {
              plan.conflicts.push({ what: 'app URL', docs: plan.verify.target, truth: `\`${step.command}\` finishes and exits; nothing serves that URL`, source: plan.verify.docsSource || 'README' });
            }
            plan.verify = { kind: 'exit', target: 'all steps exit 0' };
            rec.savePlan(plan);
          }
        } else if (r.exitCode === 0 && plan.verify.kind === 'http') {
          const p = await box.probe(plan.verify.target, { timeoutMs: 45_000 });
          r.out += `\n[firstrun] GET ${plan.verify.target} → ${p.status || 'no response'}${p.body ? `\n${tail(p.body, 6)}` : ''}\n`;
          // A URL the docs give must succeed. When the docs name none, "/" is our guess: an API
          // with no root route answers 404, which still proves the server is up and serving.
          const answers = !plan.verify.fromDocs && p.status && p.status < 500;
          if (!p.ok && answers) r.out += `[firstrun] the docs name no URL to check; the server answered ${p.status} on / so it is up\n`;
          if (!p.ok && !answers) {
            r.exitCode = 1;
            // It said "ready" but doesn't answer: show what it printed since, so the Doctor sees the real crash.
            const after = await box.serveAftermath(r);
            if (after.out.trim()) r.out += `\n[firstrun] the server's output after the check:\n${tail(after.out, 40)}\n`;
            r.out += after.alive ? '[firstrun] the server process is still running but does not answer\n' : '[firstrun] the server process has exited\n';
          }
          step.probe = { status: p.status, body: tail(p.body || '', 6) };
        }
      } else {
        const opts = { onData, timeoutMs: step.kind === 'install' ? 25 * 60_000 : step.kind === 'test' ? TEST_MINUTES * 60_000 : 12 * 60_000, detectServer: ['other', 'build'].includes(step.kind) };
        r = await box.exec(step.command, opts);
        // A script (justfile, Makefile) asked the docker shim for services: start them as sidecars, retry once.
        const req = r.exitCode === 97 ? await box.readFile('/firstrun/services.request') : null;
        if (req) {
          const [cwd, asked] = req.trim().split('\n');
          const sr = await runServicesStep(asked.replace(/^docker-compose\b/, 'docker compose'), { sandbox: box, facts, cwd });
          await box.sh(`printf '%s\\n' ${shq(asked)} >> /firstrun/services.done; rm -f /firstrun/services.request`);
          const note = `[firstrun] \`${asked}\` ran inside a script: started its services as sidecars, then retried the step\n`;
          onData?.(note + sr.out);
          const again = sr.exitCode === 0 ? await box.exec(step.command, opts) : { exitCode: 1, out: '', durationMs: 0 };
          r = { ...again, out: `${r.out}${note}${sr.out}${again.out}`, durationMs: r.durationMs + (sr.durationMs || 0) + again.durationMs };
        }
      }
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

    // Environment a fix set up for a step (installed a tool, wrote .env, exported PG vars, started a
    // service). A new machine (rebase) and the from-zero replay must redo these before the step.
    const applyPrereqs = async (box, step) => {
      for (const a of step.prereqs || []) {
        if (a.type === 'exec') await box.exec(a.command, { timeoutMs: 10 * 60_000, detectServer: false });
        else if (a.type === 'write') await box.writeFile(a.path, a.content);
        else if (a.type === 'service') await box.addService({ name: a.name, image: a.image, env: a.env || {}, port: a.port });
      }
    };
    const addPrereq = (step, a) => {
      step.prereqs = step.prereqs || [];
      if (!step.prereqs.some((p) => JSON.stringify(p) === JSON.stringify(a))) step.prereqs.push(a);
    };

    let repairSeq = 0;
    const newStep = (command, kind, before) => ({
      id: `R${++repairSeq}`, command, kind, origin: 'repair', status: 'pending',
      source: { ...before.source, insertedBefore: before.id },
    });

    let i = 0;
    let stopped = null;
    // Steps form a graph, not a chain: a failed install/env/services/migrate/build step blocks
    // everything after it (later steps need it), but a failed start, usage or other step only
    // blocks the rest of its own doc section. One bad line can't hide the rest of the docs
    // (vargasjona: 20 steps blocked by one line; fastify: a macOS-only snippet hid the real setup).
    const blockers = [];
    const blockedBy = (s) => blockers.find((b) => b.hard || (b.file === s.source?.file && b.section === s.source?.section));
    while (i < plan.steps.length) {
      const step = plan.steps[i];
      if (step.skip) { i++; continue; }
      const blocker = blockedBy(step);
      if (blocker) {
        step.status = 'blocked';
        step.blockedBy = blocker.id;
        rec.stepStatus(step.id, 'blocked');
        i++;
        continue;
      }
      if (opts.maxMinutes && Date.now() - startedAt > opts.maxMinutes * 60_000) {
        say('runner', `time budget of ${opts.maxMinutes} min reached; stopping before ${step.id}`);
        stopped = step.id;
        break;
      }
      let goodCwd = await sandbox.readFile('/firstrun/cwd');
      let attempt = await execStep(step);
      if (attempt.exitCode === 0) {
        step.status = step.status === 'repairing' ? 'repaired' : 'passed';
        rec.stepStatus(step.id, step.status);
        i++;
        continue;
      }
      if (!firstFailure) firstFailure = { stepId: step.id, command: step.command, source: step.source };
      rec.stepStatus(step.id, 'failed');
      // A test suite that doesn't finish in time is a finding, not something to retry: another attempt costs the
      // same minutes on a guess (huggingface_hub: 2 x 12 min). Record it, keep going, spend no Bobcoins.
      if (step.kind === 'test' && attempt.exitCode === 124) {
        const { out: _o, ...before } = attempt;
        rec.evidence({ id: `E${rec.state.evidence.length + 1}`, stepId: step.id, before, fix: null, after: null, status: 'needs-human', at: nowIso(),
          diagnosis: { class: 'slow-tests', by: 'rules', ruleId: 'test-timeout', confidence: 0.9, cause: `\`${step.command}\` did not finish within ${TEST_MINUTES} min on a clean machine. The setup before it is proven; the docs should name a quick subset for newcomers and say the full suite is for CI.` } });
        step.status = 'needs-human';
        rec.stepStatus(step.id, 'needs-human');
        i++;
        continue;
      }
      // ── Repair loop ────────────────────────────────────────────────
      let repaired = false;
      let restart = false;
      let totalRepairs = 0;
      const history = [];
      const stepEvidence = [];
      for (let k = 0; k < MAX_REPAIRS_PER_STEP && !repaired; k++) {
        rec.phase('repair', 'doctor');
        const ctx = {
          step, attempt, log: headTail(attempt.out), facts, plan, sandbox, tried, history,
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
        let fixFailed = null; // a fix whose own command fails was not applied (F3)
        // Stop any background servers before applying fixes: watchers left running (nodemon,
        // tsc --watch) can race with npm/pip install and crash on a half-replaced tree.
        // Servers are restarted automatically when the step is retried below.
        await sandbox.stopServers();
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
            addPrereq(step, a);
          } else if (a.type === 'exec') {
            const r = await sandbox.exec(a.command, { timeoutMs: 10 * 60_000, detectServer: false });
            fixLog.push(`$ ${a.command}\n${tail(r.out, 15)}${r.exitCode ? `\n(exit ${r.exitCode})` : ''}`);
            if (r.exitCode !== 0) { fixFailed = { command: a.command, exitCode: r.exitCode, out: r.out, durationMs: r.durationMs }; break; }
            addPrereq(step, a);
          } else if (a.type === 'write') {
            await sandbox.writeFile(a.path, a.content);
            fixLog.push(`wrote ${a.path}`);
            addPrereq(step, a);
          } else if (a.type === 'replace-step') {
            step.readmeCommand = step.readmeCommand || step.command;
            step.command = a.command;
            fixLog.push(`step command → ${a.command}`);
          } else if (a.type === 'insert-before') {
            // An inserted install must reuse the install command as already repaired (e.g. --legacy-peer-deps).
            let command = a.command;
            // Only a bare project install ("npm install"), not "npm install --global nodemon" or "pip install poetry".
            if ((a.kind || '') === 'install' && /^(npm\s+(i|install|ci)|yarn(\s+install)?|pnpm\s+(i|install)|bun\s+install)$/.test(command.trim())) {
              const mgr = command.split(/\s+/)[0];
              const repairedInstall = plan.steps.slice(0, i).find((s) => s.kind === 'install' && s.readmeCommand && s.command.split(/\s+/)[0] === mgr && s.status === 'repaired');
              if (repairedInstall) command = repairedInstall.command;
            }
            const ns = newStep(command, a.kind || 'other', step);
            if (a.silent) ns.silent = true;
            plan.steps.splice(i, 0, ns);
            i++;
            rec.stepStatus(ns.id, 'pending', 0);
            rec.savePlan(plan);
            rec.emitEvent('planner', 'step.inserted', { step: ns, before: step.id });
            rec.emitEvent('planner', 'plan', plan);
            if (!restart) {
              let ia = await execStep(ns);
              // The fix's own step can fail for a reason a rule already knows (zhanymkanov: the inserted
              // `poetry install` hit "No file/folder found for package", which poetry-no-root fixes).
              // Rules only, no Bob, one retry: diagnose the inserted step like any other step.
              if (ia.exitCode !== 0) {
                const again = await repairInsertedStep(ns, ia, { facts, plan, sandbox, tried });
                if (again) {
                  fixLog.push(`$ ${again.from} → exit ${ia.exitCode}; ${again.ruleId}: ${again.cause}; retrying as \`${ns.command}\``);
                  // The dashboard and replay must show what actually runs.
                  rec.savePlan(plan);
                  rec.emitEvent('planner', 'plan', plan);
                  ia = await execStep(ns);
                }
              }
              ns.status = ia.exitCode === 0 ? 'passed' : 'failed';
              rec.stepStatus(ns.id, ns.status);
              fixLog.push(`$ ${ns.command} → exit ${ia.exitCode}`);
              if (ia.exitCode !== 0) { fixFailed = { command: ns.command, exitCode: ia.exitCode, out: ia.out, durationMs: ia.durationMs }; break; }
              // An inserted step that succeeds may cd intentionally; keep that as the new baseline.
              const newCwd = await sandbox.readFile('/firstrun/cwd'); if (newCwd) goodCwd = newCwd;
            }
          }
        }
        step.status = 'repairing';
        step.evidence = [...(step.evidence || []), evId];
        rec.savePlan(plan);
        if (restart) {
          // A new machine: replay everything that already passed, with what earlier fixes set up
          // (a tool installed by a previous fix is gone after a rebase), then retry this step.
          say('runner', 'replaying earlier steps on the new machine');
          for (let j = 0; j < i; j++) {
            const prev = plan.steps[j];
            if (prev.skip || prev.status === 'failed') continue;
            await applyPrereqs(sandbox, prev);
            const pa = await execStep(prev, { quiet: true });
            if (pa.exitCode !== 0) fixLog.push(`warning: ${prev.id} failed on the new machine (exit ${pa.exitCode})`);
          }
          await applyPrereqs(sandbox, step);
          restart = false;
        }
        if (fixFailed) fixLog.push(`fix not applied: \`${fixFailed.command}\` exited ${fixFailed.exitCode}`);
        rec.phase('coldstart', 'runner');
        // A fix whose own command failed was not applied: don't retry the step as if it had been.
        if (!fixFailed) await restoreCwd(sandbox, goodCwd);
        const after = fixFailed
          ? { stepId: step.id, n: attempts[step.id], command: fixFailed.command, exitCode: fixFailed.exitCode, durationMs: fixFailed.durationMs || 0, logTail: tail(fixFailed.out || '', 60), out: fixFailed.out || '' }
          : await execStep(step);
        const { out: _a, ...afterPub } = after;
        const verified = after.exitCode === 0;
        // A fix can clear its own error and reveal the next one (a renamed script
        // that now runs and hits a missing env var). That fix worked: record it as
        // "progressed" and promote it once the step finally passes.
        const progressed = !verified && !fixFailed && !(await stillFailing(diagnosis, attempt, after, ctx));
        const record = {
          id: evId, stepId: step.id, before, diagnosis, fix: { ...fix, log: fixLog.join('\n') },
          after: afterPub, status: verified ? 'verified' : progressed ? 'progressed' : 'failed', at: nowIso(),
        };
        rec.evidence(record);
        stepEvidence.push(record);
        history.push({ cause: diagnosis.cause, actions: fix.actions, worked: progressed });
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
        // A fix that cleared its own error still worked, even if the step later failed on
        // something else: keep it as "progressed" (not counted as fixed) and link what it revealed.
        for (const r of stepEvidence.filter((x) => x.status === 'progressed')) {
          rec.evidence({ ...r, revealed: stepEvidence[stepEvidence.indexOf(r) + 1]?.id });
        }
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
      const hard = HARD_BLOCK_KINDS.has(step.kind);
      blockers.push({ id: step.id, hard, file: step.source?.file, section: step.source?.section });
      if (hard) { stopped = step.id; break; }
      i++;
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
      rec.emitEvent('verifier', 'replay.start', { status: 'running', durationMs: 0, image: plan.image, steps: plan.steps.filter((s) => !s.skip && s.status !== 'needs-human' && s.status !== 'blocked').length });
      const t0 = Date.now();
      replayBox = new Sandbox({ image: plan.image, repoDir: root, label: `${id}-replay`, cacheVolume, patches: patched.map(({ path: p, content }) => ({ path: p, content })) });
      await replayBox.start();
      let failed = null;
      for (const step of plan.steps) {
        if (step.skip || step.status === 'needs-human' || step.status === 'blocked') continue;
        await applyPrereqs(replayBox, step);
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
    // timeLost (flag): computed inside publish, so FIRSTRUN.md and passport.json include it.
    const timeLost = flagOn('timeLost', opts) ? { runMs: Date.now() - startedAt } : null;
    const result = await publish({ root, outDir, facts, plan, evidence, patched, replay, firstFailure, rec, bobcoins: budget.spent(), stopped, packageCache: Boolean(cacheVolume), timeLost });
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
    if (cacheVolume && !opts.keep) await run('docker', ['volume', 'rm', '-f', cacheVolume]).catch(() => {});
  }
}
