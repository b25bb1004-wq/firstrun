import { RULES } from './rules.js';
import { askBob } from '../brain/bob.js';
import { summarizeFacts } from '../scout/index.js';
import { tail } from '../util.js';

const CLASSES = ['runtime-version', 'missing-script', 'missing-env', 'missing-service', 'missing-tool', 'missing-dependency', 'wrong-order', 'missing-file', 'platform-specific', 'needs-secret', 'unknown'];
const ACTIONS = ['exec', 'rebase', 'service', 'write', 'replace-step', 'insert-before'];
const DOC_KINDS = ['replace-command', 'insert-step', 'prerequisite', 'note'];

export function fixSignature(stepId, fix) {
  return `${stepId}:${JSON.stringify(fix?.actions || [])}`;
}

/**
 * Decide why a step failed and how to repair it. Deterministic rules go first
 * (free, instant, reproducible); IBM Bob handles what the rules don't
 * recognise, reading the repo itself to reason about the failure.
 */
export async function diagnose(ctx, { brain = 'auto', bobBudget, onBob } = {}) {
  const tried = ctx.tried || new Set();
  if (brain !== 'bob') {
    for (const rule of RULES) {
      let res;
      try { res = await rule.test(ctx); } catch (e) { res = null; }
      if (!res) continue;
      if (res.fix && tried.has(fixSignature(ctx.step.id, res.fix))) continue;
      return {
        diagnosis: { class: res.class, cause: res.cause, by: 'rules', ruleId: res.ruleId, confidence: res.confidence },
        fix: res.fix,
      };
    }
  }
  if (brain === 'rules') {
    return { diagnosis: { class: 'unknown', cause: 'No rule recognises this failure (run with --brain auto to ask IBM Bob).', by: 'rules', confidence: 0 }, fix: null };
  }
  if (bobBudget && (bobBudget.cap ? bobBudget.cap() : bobBudget.remaining()) < 0.05) {
    return { diagnosis: { class: 'unknown', cause: 'No rule recognises this failure and the Bobcoin budget for this run is spent.', by: 'rules', confidence: 0 }, fix: null };
  }
  const request = doctorRequest(ctx);
  let res = await askBob({ mode: 'firstrun-doctor', request, workspace: ctx.facts.root, maxCost: bobBudget?.cap?.() ?? bobBudget?.perCall ?? 1.5, name: `doctor-${ctx.step.id}` });
  bobBudget?.spend(res.bobcoins || 0);
  onBob?.(res);
  if (!res.ok && /no parsable JSON|expected JSON|json block/i.test(res.error || '') && (!bobBudget || (bobBudget.cap ? bobBudget.cap() : bobBudget.remaining()) >= 0.05)) {
    const retry = await askBob({ mode: 'firstrun-doctor', request: request + '\nYour previous reply was not valid JSON. Reply with exactly one JSON object in a ```json block and nothing else.', workspace: ctx.facts.root, maxCost: bobBudget?.cap?.() ?? bobBudget?.perCall ?? 1.5, name: `doctor-${ctx.step.id}-retry` });
    bobBudget?.spend(retry.bobcoins || 0);
    onBob?.(retry);
    res = { ...retry, bobcoins: (res.bobcoins || 0) + (retry.bobcoins || 0) };
  }
  if (!res.ok) {
    return { diagnosis: { class: 'unknown', cause: `No rule recognises this failure; IBM Bob could not help: ${res.error}`, by: 'rules', confidence: 0, bobcoins: res.bobcoins }, fix: null };
  }
  const v = validateBobFix(res.json);
  if (!v.ok) {
    return { diagnosis: { class: 'unknown', cause: `IBM Bob's answer was unusable (${v.error}).`, by: 'bob', confidence: 0, bobcoins: res.bobcoins, taskId: res.taskId }, fix: null };
  }
  // Source edits Bob proposed are not applied; keep them on the diagnosis so the evidence shows them to the maintainer.
  const suggestions = v.suggestions || v.fix?.suggestions;
  const diagnosis = { ...v.diagnosis, by: 'bob', bobcoins: res.bobcoins, taskId: res.taskId, ...(suggestions?.length ? { suggestions } : {}) };
  if (v.fix && tried.has(fixSignature(ctx.step.id, v.fix))) return { diagnosis, fix: null };
  return { diagnosis, fix: v.fix };
}

/** True when the path belongs to setup scaffolding, not application source. */
function isSetupFile(p) {
  if (!p) return false;
  const name = p.split('/').pop();
  if (/^(README|CONTRIBUTING|CHANGELOG|INSTALL)(\..*)?$/i.test(name)) return true;
  if (/\.(md|rst)$/.test(name)) return true;
  if (/^\.env\.(example|sample)$/.test(name) || /\.env\.example$/.test(name)) return true;
  if (/^docker-compose(\.[^/]*)?\.ya?ml$/.test(name)) return true;
  if (/^compose\.ya?ml$/.test(name)) return true;
  if (/^\.nvmrc$/.test(name) || /^\.node-version$/.test(name) || /^\.python-version$/.test(name) || /^\.tool-versions$/.test(name)) return true;
  if (/^tsconfig(\..*)?\.json$/.test(name)) return true;
  if (name === 'package.json') return true;
  return false;
}

export function validateBobFix(j) {
  if (!j || typeof j !== 'object') return { ok: false, error: 'not an object' };
  const cls = CLASSES.includes(j.class) ? j.class : 'unknown';
  const diagnosis = { class: cls, cause: String(j.cause || '').slice(0, 400) || 'IBM Bob did not explain the cause.', confidence: Math.max(0, Math.min(1, Number(j.confidence) || 0.5)) };
  if (!j.fix || !Array.isArray(j.fix.actions) || !j.fix.actions.length) return { ok: true, diagnosis, fix: null };
  const actions = [];
  const suggestions = [];
  for (const a of j.fix.actions) {
    if (!a || !ACTIONS.includes(a.type)) continue;
    if (['exec', 'replace-step', 'insert-before'].includes(a.type) && typeof a.command !== 'string') continue;
    if (a.type === 'rebase' && !/^[\w./-]+:[\w.-]+$/.test(a.image || '')) continue;
    if (a.type === 'service' && !(a.image && a.port)) continue;
    if (a.type === 'write' && !(a.path && typeof a.content === 'string') ) continue;
    if (a.type === 'write' && /(^|\/)\.\.(\/|$)/.test(a.path)) continue;
    if (/\brm\s+-rf\s+\/(\s|$)|mkfs|:\(\)\s*\{/.test(a.command || '')) continue; // refuse destructive commands
    if (a.type === 'write' && !isSetupFile(a.path)) { suggestions.push({ path: a.path, why: diagnosis.cause }); continue; }
    actions.push({ ...a, name: a.name || a.image?.split(/[/:]/).slice(-2, -1)[0], kind: a.kind || 'other' });
  }
  const doc = j.fix.doc && DOC_KINDS.includes(j.fix.doc.kind) && j.fix.doc.text ? { kind: j.fix.doc.kind, text: String(j.fix.doc.text) } : { kind: 'note', text: diagnosis.cause };
  const rawPatches = Array.isArray(j.fix.patches) ? j.fix.patches.filter((p) => p && p.path && typeof p.content === 'string' && !/(^|\/)\.\.(\/|$)/.test(p.path)) : [];
  const patches = [];
  for (const p of rawPatches) {
    if (!isSetupFile(p.path)) { suggestions.push({ path: p.path, why: diagnosis.cause }); continue; }
    patches.push({ path: p.path, op: 'write', content: p.content });
  }
  if (!actions.length && !patches.length && !suggestions.length) return { ok: false, error: 'no valid actions' };
  if (!actions.length && !patches.length) return { ok: true, diagnosis, fix: null, suggestions };
  return { ok: true, diagnosis, fix: { actions, patches, doc, ...(suggestions.length ? { suggestions } : {}) } };
}

function doctorRequest(ctx) {
  const { step, attempt, facts, plan, history = [] } = ctx;
  return `# FirstRun Doctor request

A newcomer is following this repository's setup documentation, command by command, on a
clean Linux machine (Docker image \`${ctx.image}\`, working directory = repo root, running as root,
no host Docker available — backing services such as Postgres or Redis can only be started with a
"service" action). One command failed. Work out WHY and propose the smallest fix a maintainer
should make so the documented setup works for everyone.

Read the repository files you need (README, CONTRIBUTING, package manifests, config, the source
that raised the error). Do not modify any files. Do not run commands.

## The failing step
- Step: ${step.id} (${step.kind}), from ${step.source?.file}:${step.source?.line} (section "${step.source?.section}")
- Command: \`${step.command}\`
- Exit code: ${attempt.exitCode}

### Output (last lines)
\`\`\`
${tail(attempt.out, 80)}
\`\`\`

## Setup plan so far
${plan.steps.map((s) => `- ${s.id} [${s.status || 'pending'}] \`${s.command}\`${s.skip ? ` (skipped: ${s.skip})` : ''}${s.origin === 'repair' ? ' (added by FirstRun)' : ''}`).join('\n')}

## What FirstRun already knows
\`\`\`json
${JSON.stringify(summarizeFacts(facts), null, 2)}
\`\`\`
${history.length ? `\n## Earlier repair attempts on this step\n${history.map((h) => `- ${h.cause} → ${JSON.stringify(h.actions)} (${h.worked ? 'worked: cleared that error, keep it; the step now fails on something else' : 'did not work'})`).join('\n')}\n` : ''}
## Reply format
Reply with ONLY one JSON object (no prose), in a \`\`\`json block:

\`\`\`json
{
  "class": "runtime-version | missing-script | missing-env | missing-service | missing-tool | missing-dependency | wrong-order | missing-file | platform-specific | needs-secret | unknown",
  "cause": "One sentence a new contributor would understand, naming the file/line that proves it.",
  "confidence": 0.0,
  "fix": {
    "actions": [
      { "type": "exec", "command": "shell command run in the sandbox before retrying the step" },
      { "type": "replace-step", "command": "the corrected command the README should have said" },
      { "type": "insert-before", "command": "a command the README is missing, run before this step", "kind": "install|env|services|migrate|build|other" },
      { "type": "service", "name": "redis", "image": "redis:7-alpine", "port": 6379, "env": {} },
      { "type": "rebase", "image": "node:20" },
      { "type": "write", "path": "relative/path", "content": "file content" }
    ],
    "patches": [ { "path": "relative/path/in/repo", "content": "full new file content for the PR" } ],
    "doc": { "kind": "replace-command | insert-step | prerequisite | note", "text": "what the README should say" }
  }
}
\`\`\`

Use only the action types you need (usually one or two). If the step needs a real third-party
secret, use class "needs-secret" and "fix": null. If you cannot tell, use class "unknown" and "fix": null.
`;
}
