#!/usr/bin/env node
// Re-run today's Doctor rules on the failures an audit recorded, without Docker.
// Useful after changing src/doctor/rules.js: shows which recorded failures the rules now claim.
//
//   node tools/rediagnose.js [audit/real-16]          needs the repos checked out under
//                                                     .firstrun-work/repos/<slug> at the audited commit
//
// Only the recorded log tail (last 60 lines) is available, so a rule that needs the head of the
// log can still miss here and fire in a real run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scout } from '../src/scout/index.js';
import { diagnose } from '../src/doctor/index.js';
import { buildPlan } from '../src/plan.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const auditDir = path.resolve(ROOT, process.argv[2] || 'audit/real-16');
const audit = JSON.parse(fs.readFileSync(path.join(auditDir, 'audit.json'), 'utf8'));

for (const r of audit.repos) {
  const runDir = path.join(auditDir, 'runs', r.slug);
  const repo = path.join(ROOT, '.firstrun-work', 'repos', r.slug);
  if (!fs.existsSync(path.join(runDir, 'evidence')) || !fs.existsSync(repo)) continue;
  const plan = JSON.parse(fs.readFileSync(path.join(runDir, 'plan.json'), 'utf8'));
  const facts = await scout(repo);
  // plan.json is saved after repairs (a rebase changes its runtime); diagnose against the machine the run started on.
  plan.runtime = buildPlan(facts).runtime;
  const evidence = fs.readdirSync(path.join(runDir, 'evidence')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(runDir, 'evidence', f), 'utf8')));
  for (const e of evidence) {
    if (!['needs-human', 'failed'].includes(e.status)) continue;
    const step = plan.steps.find((s) => s.id === e.stepId) || { id: e.stepId, command: e.before.command, kind: 'other', source: {} };
    const log = e.before.logTail;
    const ctx = {
      step: { ...step, command: e.before.command }, attempt: { out: log, exitCode: e.before.exitCode }, log, facts, plan,
      sandbox: { services: [] }, tried: new Set(), history: [], sandboxEnv: {},
    };
    const { diagnosis, fix } = await diagnose(ctx, { brain: 'rules' });
    const was = e.diagnosis.ruleId || e.diagnosis.class;
    const now = diagnosis.ruleId || diagnosis.class;
    console.log(`${r.slug} ${e.id} ${e.before.command}\n  recorded: ${was} (${e.status})\n  now:      ${now}: ${diagnosis.cause}${fix ? `\n  fix:      ${fix.actions.map((a) => a.command || a.image || a.type).join(' ; ')}` : ''}\n`);
  }
}
