import { askBob as realAskBob } from './bob.js';

/**
 * Bob reviews the plan before anything runs. The rules decide the lines they are sure about; only the lines they
 * are NOT sure about go to Bob, in one call per repo: "would a new contributor on Linux run this?". That is where
 * rules kept failing in the 31-repo audit (usage snippets, OS-specific lines, alternatives, prose in code blocks),
 * and it is a cheaper, better use of Bob than diagnosing a failure the plan should never have caused.
 *
 * Bob can only SKIP a step (with a reason) or leave it. He cannot add or rewrite commands here, so a bad answer
 * can hide a step but never run something the docs don't say.
 */

// Section words that mean "not the Linux contributor path, probably".
const DOUBT_SECTION = /(mac\s?os|macos|osx|windows|powershell|homebrew|alternative|optional|advanced|example|usage|recipe|cookbook|deploy|production|docker(?!-compose)|vs\s?code|editor|ide\b|troubleshoot|faq|benchmark|contribut.*(ide|editor))/i;

/** Planned steps the rules ran but can't vouch for. */
export function doubtfulSteps(plan) {
  return plan.steps.filter((s) => !s.skip && s.origin !== 'ci' && s.origin !== 'repair' && !s.synthetic && (
    s.kind === 'other' ||
    DOUBT_SECTION.test(String(s.source?.section || '')) ||
    /^\w+(\.\w+)*\s*=|^\S+\s+\S+\s+\S+\s+--\S+=/.test(s.command) && s.kind === 'other'
  ));
}

export function reviewRequest(plan, doubtful) {
  return `# HUMBLE plan review

HUMBLE follows a repository's setup docs on a clean Linux machine (Docker image \`${plan.image}\`, running as
root, from a fresh clone of ${plan.repo}). Its rules planned the steps below. For each step marked ASK, decide:
would a new contributor setting up THIS repository on Linux run this line? Answer "skip" when the line is a
usage example for the published package, a user install of the package itself, an alternative to another
planned step, macOS/Windows-only, output or config shown in the docs, or an editor/IDE/deploy instruction.
Answer "run" otherwise. Do not modify files. Do not run commands.

Reason about the shell the steps share before you decide: the steps run one after another in ONE terminal, so a
\`cd\`, an \`export\` or an activated environment changes every later step. A line that looks like a tip can still be
what makes the next lines work: \`cd backend/app\` before \`poetry install\` is required, not an editor tip. Give the
concrete reason for each decision (what the line does, and what would break or not if it were skipped).

Full plan (in order):
${plan.steps.map((s) => `- ${s.id} ${doubtful.includes(s) ? 'ASK ' : ''}\`${s.command}\` [${s.kind}${s.skip ? `, skipped: ${s.skip}` : ''}] (${s.source?.file || '?'}:${s.source?.line || '?'} § ${s.source?.section || ''})`).join('\n')}

Also, for EVERY step (ASK or not), give a one-line reason a newcomer would understand: what the line does for this repo.
And list prerequisites the docs never mention but the repo needs (a service, an env var, a runtime version), each with the file:line that proves it.
Reply with ONLY one JSON object in a \`\`\`json block: one entry per step in "decisions" ("run" matters only for ASK steps), plus "missing":
\`\`\`json
{ "decisions": [ { "id": "S4", "run": false, "reason": "usage example for users of the published package" }, { "id": "S5", "run": true, "reason": "installs the backend's Python dependencies" } ],
  "missing": [ { "what": "PostgreSQL 15 must be running", "evidence": "docker-compose.yml:12" } ] }
\`\`\`
`;
}

/**
 * Ask Bob about the doubtful steps and apply his skips. Returns what happened (for events and the passport).
 * `askBob` is injectable for tests; the real one spends Bobcoins, capped by `budget` (≤ maxCost).
 */
export async function bobReviewPlan({ plan, facts, budget, maxCost = 0.2, askBob = realAskBob }) {
  const doubtful = doubtfulSteps(plan);
  // Every repo gets the review now (reasons for all steps, missing prerequisites); only doubtful steps may be skipped.
  if (!plan.steps.some((s) => !s.skip)) return { asked: 0, skipped: [], bobcoins: 0, ok: true };
  const cap = Math.min(maxCost, budget?.cap?.() ?? maxCost);
  if (cap < 0.05) return { asked: doubtful.length, skipped: [], bobcoins: 0, ok: false, error: 'no Bobcoins left for the plan review' };
  const res = await askBob({ mode: 'firstrun-planner', request: reviewRequest(plan, doubtful), workspace: facts?.root, maxCost: cap, maxTurns: 6, name: 'plan-review' });
  budget?.spend?.(res.bobcoins || 0);
  const decisions = Array.isArray(res.json?.decisions) ? res.json.decisions : null;
  if (!res.ok || !decisions) return { asked: doubtful.length, skipped: [], bobcoins: res.bobcoins || 0, ok: false, error: res.error || 'no decisions in reply', taskId: res.taskId };
  const ids = new Set(doubtful.map((s) => s.id));
  const skipped = [];
  // Bob's one-line reasons become each step's "why" (shown in the passport and the onboarder).
  for (const d of decisions) {
    const st = d && plan.steps.find((x) => x.id === d.id);
    if (st && typeof d.reason === 'string' && d.reason.trim() && d.run !== false) st.bobWhy = d.reason.trim().slice(0, 160);
  }
  const missing = (Array.isArray(res.json?.missing) ? res.json.missing : [])
    .filter((m) => m && typeof m.what === 'string' && /\S+:\d+/.test(String(m.evidence || ''))) // only with file:line evidence
    .slice(0, 5).map((m) => ({ what: String(m.what).slice(0, 160), evidence: String(m.evidence).slice(0, 80) }));
  for (const d of decisions) {
    if (!d || !ids.has(d.id) || d.run !== false) continue; // Bob may only skip steps he was asked about
    const s = plan.steps.find((x) => x.id === d.id);
    if (/^cd\s+[^&|;]+$/.test(String(s.command).trim())) continue;
    const reason = String(d.reason || 'not part of the Linux contributor setup').slice(0, 160);
    s.skip = `IBM Bob: ${reason}`;
    s.skippedBy = 'bob';
    skipped.push({ id: s.id, command: s.command, reason });
  }
  return { asked: doubtful.length, reviewed: decisions.length, skipped, missing, bobcoins: res.bobcoins || 0, ok: true, taskId: res.taskId };
}
