// Dry run for the capped IBM Bob pass: spends 0 Bobcoins and calls nothing. It reads a finished audit and lists,
// per repo, every failure the rules could not diagnose. In a `--brain auto` rerun, those are the moments the doctor
// asks IBM Bob. For each one it prints the step, its command, exit code and the redacted log tail Bob would read,
// then the worst-case cost and the exact command to run.
// Plan-time calls count too: in auto mode Bob reviews doubtful plan steps (<= 0.2 per repo) and plans repos whose
// README gives fewer than 2 steps (<= 1.5). By default only repos with an open question for Bob are selected, so the
// budget goes where Bob can change a verdict; --all selects every repo with the listed verdicts.
//   node tools/bob-pass-plan.mjs audit/v2-31-final [--total 4.5] [--verdicts PARTIAL,INCONCLUSIVE,FAILED] [--all] [--also a,b]
import fs from 'node:fs';
import path from 'node:path';
import { redactSecrets } from '../src/redact.js';
import { doubtfulSteps } from '../src/brain/review.js';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const dir = argv.find((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--')) || 'audit/v2-31-final';
const total = Number(opt('total', 4.5));
const PER_CALL = 1.5; // makeBudget(total, 1.5) in src/pipeline.js
const verdicts = opt('verdicts', 'PARTIAL,INCONCLUSIVE,FAILED').split(',');

const audit = JSON.parse(fs.readFileSync(path.join(dir, 'audit.json'), 'utf8'));
const repos = (audit.repos || []).filter((r) => verdicts.includes(r.verdict || r.result?.verdict));
const tailLines = (s, n) => s.split(/\r?\n/).filter((l) => l.trim()).slice(-n).join('\n');

let calls = 0;
const picked = [], skipped = [], planCalls = [];
const also = String(opt('also', '')).split(',').filter(Boolean);
const out = [];
for (const r of repos) {
  const file = path.join(dir, 'runs', r.slug, 'events.ndjson');
  if (!fs.existsSync(file)) { out.push(`### ${r.slug} (${r.verdict})\n_no events.ndjson: rerun it and let Bob look from scratch._\n`); continue; }
  const steps = {};
  let planInfo = { review: false, planner: false };
  const unknown = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    const d = e.data || {};
    if (e.type === 'plan' && Array.isArray(d.steps)) planInfo = { review: doubtfulSteps(d).length > 0, planner: d.steps.filter((x) => !x.skip).length < 2 };
    if (e.type === 'step.start') steps[d.stepId] = { command: d.command, log: '', exit: null, n: d.n };
    else if (e.type === 'step.log' && steps[d.stepId]) steps[d.stepId].log += d.chunk + '\n';
    else if ((e.type === 'step.end' || e.type === 'step.result') && steps[d.stepId]) steps[d.stepId].exit = d.exitCode ?? d.code ?? steps[d.stepId].exit;
    else if (e.type === 'diagnosis' && d.diagnosis?.class === 'unknown') unknown.push({ stepId: d.stepId, snap: { ...steps[d.stepId] } });
  }
  for (const u of unknown) {
    const lf = path.join(dir, 'runs', r.slug, 'logs', `${u.stepId}-${u.snap.n || 1}.log`);
    if (!u.snap.log?.trim() && fs.existsSync(lf)) u.snap.log = fs.readFileSync(lf, 'utf8');
  }
  const wanted = argv.includes('--all') || unknown.length > 0 || also.includes(r.slug);
  if (!wanted) { skipped.push(r.slug); continue; }
  picked.push(r.slug);
  if (planInfo.planner) { planCalls.push(`${r.slug}: planner (<= ${PER_CALL})`); }
  if (planInfo.review) { planCalls.push(`${r.slug}: plan review (<= 0.2)`); }
  out.push(`### ${r.slug} (${r.verdict}): ${unknown.length} question${unknown.length === 1 ? '' : 's'} for Bob`);
  for (const u of unknown) {
    calls++;
    out.push(`- **${u.stepId}** \`${u.snap.command || '?'}\` exit ${u.snap.exit ?? '?'}\n\n\`\`\`\n${redactSecrets(tailLines(u.snap.log || '', 12))}\n\`\`\``);
  }
  if (!unknown.length) out.push('_No undiagnosed failure recorded; a rerun may still ask Bob to review the plan._');
  out.push('');
}

const only = picked.join(',');
const worst = calls * PER_CALL + planCalls.reduce((a, c) => a + (c.includes('planner') ? PER_CALL : 0.2), 0);
console.log(`# Bob pass dry run (0 Bobcoins spent)\n`);
console.log(`Source: ${path.basename(dir)} · selected ${picked.length} of ${repos.length} ${verdicts.join('/')} repos · doctor questions: ${calls} · plan-time calls: ${planCalls.length}`);
if (skipped.length) console.log(`Not selected (no open question for Bob; their gaps are upstream tests, timeouts or rules): ${skipped.join(', ')}`);
if (planCalls.length) console.log(`Plan-time Bob calls: ${planCalls.join('; ')}`);
console.log(`Budget: --bob-budget ${total} is ONE shared total for the whole audit; each call is capped at ${PER_CALL} and never more than what is left (src/pipeline.js makeBudget). Worst case if every call hits its cap: ${worst.toFixed(2)} Bobcoins, stopped at ${total} by the shared budget. The pass stops asking Bob once less than 0.05 is left.\n`);
console.log(out.join('\n'));
console.log(`## The command (run only on Karmanya's go)\n\n\`\`\`bash\nnode bin/firstrun.js audit audit/v2-31-repos.json --brain auto --bob-budget ${total} --concurrency 1 --id v2-31-final-bob --only ${only}\n\`\`\``);
