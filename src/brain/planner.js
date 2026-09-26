import { askBob } from './bob.js';
import { classify } from '../plan.js';
import { summarizeFacts } from '../scout/index.js';

/**
 * When the setup instructions aren't in shell code blocks (prose, PDFs, .rst,
 * wiki exports), ask IBM Bob to read the onboarding material and extract the
 * ordered commands a newcomer would run. HUMBLE then executes and verifies
 * them exactly like README steps: Bob proposes, the sandbox proves.
 */
export function needsBobPlanner(plan, facts) {
  return plan.steps.filter((s) => !s.skip).length < 2 || facts.extraDocs?.length > 0;
}

export async function bobPlan({ facts, plan, budget }) {
  const request = `# HUMBLE Planner request

A new contributor wants to get this repository running locally on a clean Linux machine
(Docker image \`${plan.image}\`, working directory = repo root, running as root, no Docker daemon:
databases/caches are started by HUMBLE when a step says \`docker compose up -d\` or
\`docker run ... <image>\`).

Read the onboarding material: ${[...facts.docs, ...(facts.extraDocs || [])].map((d) => `\`${d}\``).join(', ')}.
Also look at the manifests and CI workflows to understand what the docs mean. Do not modify files.
Do not run commands.

Extract the ordered shell commands the docs tell a newcomer to run, from a fresh clone to a
running app (and its tests if the docs describe them). Keep each command exactly as the docs
say it when they give one; when the docs describe a step only in prose ("create a database named
app", "set the API URL"), write the literal command a careful newcomer would type. Skip
\`git clone\`, OS-specific installers for macOS/Windows and editor commands.

HUMBLE already extracted these from code blocks (may be incomplete or empty):
${plan.steps.map((s) => `- \`${s.command}\`${s.skip ? ` (skipped: ${s.skip})` : ''}`).join('\n') || '- (nothing)'}

What HUMBLE knows about the repo:
\`\`\`json
${JSON.stringify(summarizeFacts(facts), null, 2)}
\`\`\`

Reply with ONLY one JSON object in a \`\`\`json block:
\`\`\`json
{ "steps": [ { "command": "npm ci", "source": "docs/Onboarding.pdf p.3", "why": "installs dependencies" } ],
  "serve": { "command": "npm run dev", "port": 3000, "healthPath": "/health" },
  "notes": "anything ambiguous in the docs" }
\`\`\`
`;
  const res = await askBob({ mode: 'firstrun-planner', request, workspace: facts.root, maxCost: budget?.cap?.() ?? budget?.perCall ?? 1.5, name: 'planner' });
  budget?.spend(res.bobcoins || 0);
  if (!res.ok || !Array.isArray(res.json?.steps)) return { ok: false, error: res.error || 'no steps in reply', bobcoins: res.bobcoins || 0 };
  const steps = res.json.steps
    .filter((s) => s && typeof s.command === 'string' && s.command.trim() && s.command.length < 500)
    .filter((s) => !/\brm\s+-rf\s+\/(\s|$)|mkfs|:\(\)\s*\{/.test(s.command))
    .map((s) => {
      const cls = classify(s.command, facts);
      const [file, where] = String(s.source || facts.docs[0] || 'docs').split(/\s+(?=p\.|page|line|§)/);
      return { id: '', command: s.command.trim(), kind: cls.kind, skip: cls.skip, source: { file, line: 0, where: where || '', section: 'extracted by IBM Bob' }, origin: 'readme', by: 'bob', why: s.why };
    });
  return { ok: steps.length > 0, steps, serve: res.json.serve, notes: res.json.notes, bobcoins: res.bobcoins || 0, taskId: res.taskId };
}
