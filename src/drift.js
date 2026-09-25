import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scout } from './scout/index.js';
import { buildPlan } from './plan.js';
import { Sandbox } from './sandbox.js';
import { runServicesStep } from './services-shim.js';
import { run, readJson, tail, fmtDuration } from './util.js';

/**
 * Static drift check: which docs-vs-code conflicts does this change introduce?
 * Runs in seconds with no Docker, so it can gate every pull request.
 */
export async function staticDrift(root, base) {
  const head = await scout(root);
  const headPlan = buildPlan(head);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'firstrun-base-'));
  let basePlan = null;
  try {
    const add = await run('git', ['-C', root, 'worktree', 'add', '--detach', '--quiet', tmp, base]);
    if (add.code !== 0) throw new Error(`cannot check out ${base}: ${add.out.trim()}`);
    const baseFacts = await scout(tmp);
    baseFacts.root = tmp;
    basePlan = buildPlan(baseFacts);
  } finally {
    await run('git', ['-C', root, 'worktree', 'remove', '--force', tmp]);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const key = (c) => `${c.what}|${c.docs}`;
  const baseKeys = new Set(basePlan.conflicts.map(key));
  const introduced = headPlan.conflicts.filter((c) => !baseKeys.has(key(c)));
  const resolved = basePlan.conflicts.filter((c) => !headPlan.conflicts.some((h) => key(h) === key(c)));
  const changed = (await run('git', ['-C', root, 'diff', '--name-only', `${base}...HEAD`])).out.split('\n').filter(Boolean);
  return { introduced, resolved, changed, headPlan };
}

/** Replay a committed, verified plan (.github/firstrun/plan.json) on a clean machine. */
export async function replayVerifiedPlan(root, { onStep } = {}) {
  const plan = readJson(path.join(root, '.github', 'firstrun', 'plan.json'));
  if (!plan?.steps?.length) return { status: 'skipped', reason: 'no .github/firstrun/plan.json in this repo yet' };
  const facts = await scout(root);
  const box = new Sandbox({ image: plan.image, repoDir: root, label: 'guard' });
  const t0 = Date.now();
  const results = [];
  try {
    await box.start();
    for (const s of plan.steps) {
      let r;
      // What the verified run's fixes set up before this step (a tool install, a .env value, a service).
      for (const a of s.prereqs || []) {
        if (a.type === 'exec') await box.exec(a.command, { timeoutMs: 10 * 60_000, detectServer: false });
        else if (a.type === 'write') await box.writeFile(a.path, a.content);
        else if (a.type === 'service') await box.addService({ name: a.name, image: a.image, env: a.env || {}, port: a.port });
      }
      if (s.kind === 'services') { const t = Date.now(); r = await runServicesStep(s.command, { sandbox: box, facts }); r.durationMs = Date.now() - t; }
      else if (s.kind === 'serve') {
        r = await box.serve(s.command, { port: s.serve?.port, timeoutMs: 150_000 });
        if (r.exitCode === 0 && plan.verify?.kind === 'http') {
          const p = await box.probe(plan.verify.target);
          if (!p.ok) { r.exitCode = 1; r.out += `\nGET ${plan.verify.target} → ${p.status}`; }
        }
      } else r = await box.exec(s.command, { timeoutMs: 20 * 60_000 });
      const res = { id: s.id, command: s.command, exitCode: r.exitCode, durationMs: r.durationMs, tail: tail(r.out, 12) };
      results.push(res);
      onStep?.(res);
      if (r.exitCode !== 0) return { status: 'failed', failed: res, results, durationMs: Date.now() - t0 };
    }
    return { status: 'passed', results, durationMs: Date.now() - t0 };
  } finally {
    await box.stop();
  }
}

export function guardComment({ drift, replay }) {
  const L = ['### FirstRun setup guard', ''];
  const bad = drift.introduced.length || replay?.status === 'failed';
  L.push(bad ? '❌ **This change would break a newcomer\'s first run.**' : '✅ Setup docs and code still agree.', '');
  if (drift.introduced.length) {
    L.push('**New docs-vs-code drift in this PR:**', '', '| What | Docs say | Code now says | Where |', '|---|---|---|---|');
    for (const c of drift.introduced) L.push(`| ${c.what} | ${c.docs} | ${c.truth} | ${c.source} |`);
    L.push('');
  }
  if (drift.resolved.length) L.push(`Resolved in this PR: ${drift.resolved.map((c) => c.what).join(', ')}.`, '');
  if (replay) {
    if (replay.status === 'passed') L.push(`Verified setup replayed from zero in ${fmtDuration(replay.durationMs)}: all ${replay.results.length} steps passed.`, '');
    else if (replay.status === 'failed') L.push(`Verified setup **fails** at \`${replay.failed.command}\` (exit ${replay.failed.exitCode}):`, '', '```', replay.failed.tail, '```', '');
    else L.push(`Replay skipped: ${replay.reason}.`, '');
  }
  L.push('<sub>Run `npx github:b25bb1004-wq/firstrun verify` locally to repair the docs with evidence.</sub>');
  return L.join('\n');
}
