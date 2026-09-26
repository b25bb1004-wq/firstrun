#!/usr/bin/env node
// Offline regression harness for Engine v2: compares two versions of HUMBLE side by side, with no Docker and
// no IBM Bob (rules only, 0 Bobcoins). Run it before anything lands on friday/v2-integration.
//
//   node tools/v2-eval.js --v1 ../v1-main [--audit audit/real-16-v2] [--json out.json] [--only slugA,slugB]
//
// 1. PLAN: for each saved doc fixture (test/fixtures/v2/<slug>), scout + buildPlan with v1 and with v2, and
//    list every line whose fate changed (run -> skip, skip -> run, command rewritten), plus the "done when" check.
// 2. DIAGNOSIS: for every failure recorded in an audit (evidence/*.json, the real log tail), rerun the Doctor's
//    rules with v1 and with v2 and list where the diagnosis or the proposed fix changed.
// A change is not automatically a regression: the table is for a reviewer to read. Lines that v2 skips as
// "not a command" but v1 ran successfully in the recorded run are flagged, because skipping a step that
// worked is the one change that can quietly break a VERIFIED repo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const v1Root = path.resolve(opt('v1', path.join(ROOT, '..', 'v1-main')));
// One or more audits (comma-separated); their recorded logs feed both the risk check and the re-diagnosis.
const auditDirs = opt('audit', 'audit/real-16-v2,audit/known-10-v3,audit/known-5').split(',').map((a) => path.resolve(ROOT, a)).filter((a) => fs.existsSync(a));
const only = opt('only') ? opt('only').split(',') : null;
const FIX = path.join(ROOT, 'test', 'fixtures', 'v2');

if (!fs.existsSync(path.join(v1Root, 'src', 'plan.js'))) {
  console.error(`No v1 checkout at ${v1Root}. Make one with: git worktree add ../v1-main origin/main`);
  process.exit(2);
}

async function load(root) {
  const u = (f) => pathToFileURL(path.join(root, 'src', f)).href;
  const [{ scout }, { buildPlan }, { diagnose }] = await Promise.all([import(u('scout/index.js')), import(u('plan.js')), import(u('doctor/index.js'))]);
  return { scout, buildPlan, diagnose };
}
const V1 = await load(v1Root), V2 = await load(ROOT);

const fate = (s) => (s.skip ? 'skip: ' + s.skip : 'run');
const verifyOf = (p) => (p.verify ? `${p.verify.kind} ${p.verify.target}` : 'none');
const norm = (c) => String(c || '').trim();
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

// Commands that actually ran and passed in the recorded audit run, per slug: skipping one of these in v2 is a risk.
function passedInAudit(slug) {
  const ok = new Set();
  const ev = auditDirs.map((a) => path.join(a, 'runs', slug, 'events.ndjson')).find((f) => fs.existsSync(f));
  if (!ev) return ok;
  for (const line of fs.readFileSync(ev, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.type === 'step.end' && e.data?.exitCode === 0) ok.add(norm(e.data.command));
  }
  return ok;
}

const report = { v1: path.basename(v1Root), v2: path.basename(ROOT), audit: auditDirs.map((a) => path.relative(ROOT, a).split(path.sep).join('/')).join(', '), plan: [], diagnosis: [] };
const out = [];
const p = (s = '') => out.push(s);

// ── 1. PLAN ─────────────────────────────────────────────────────────────────────────────────────
const slugs = fs.readdirSync(FIX).filter((d) => fs.existsSync(path.join(FIX, d, 'meta.json')) && (!only || only.includes(d))).sort();
p(`# Engine v2 offline eval`);
p(`v1: ${path.basename(v1Root)}  |  v2: ${path.basename(ROOT)}  |  audit logs: ${report.audit}`);
p('');
p(`## 1. Plan: ${slugs.length} saved docs`);
p('');
p('| repo | source | v1 runs | v2 runs | changed lines | risky skips | done-when |');
p('|---|---|---|---|---|---|---|');
const detail = [];
for (const slug of slugs) {
  const dir = path.join(FIX, slug), meta = readJson(path.join(dir, 'meta.json')) || {};
  const repo = slug.replace('__', '/');
  let a, b, err = '';
  try { a = V1.buildPlan(await V1.scout(dir), { repo }); } catch (e) { err += ` v1 error: ${e.message}`; }
  try { b = V2.buildPlan(await V2.scout(dir), { repo }); } catch (e) { err += ` v2 error: ${e.message}`; }
  if (!a || !b) { p(`| ${slug} | ${meta.source || ''} | | | |${err} | |`); report.plan.push({ slug, error: err.trim() }); continue; }
  const byCmd = (plan) => new Map(plan.steps.map((s) => [norm(s.command), s]));
  const A = byCmd(a), B = byCmd(b), passed = passedInAudit(slug);
  const changes = [];
  for (const [cmd, s] of A) {
    const t = B.get(cmd);
    if (!t) changes.push({ cmd, v1: fate(s), v2: 'gone' });
    else if (fate(s) !== fate(t)) changes.push({ cmd, v1: fate(s), v2: fate(t) });
  }
  for (const [cmd, t] of B) if (!A.has(cmd)) changes.push({ cmd, v1: 'absent', v2: fate(t) });
  // Installing the published package (npm i axios in axios' own repo) passes but proves nothing about the clone,
  // so v2 skipping it is intended, not a regression.
  const intended = (f) => /installs the published package/.test(f);
  for (const c of changes) c.risky = (c.v2 === 'gone' || c.v2.startsWith('skip')) && !intended(c.v2) && passed.has(c.cmd);
  const runs = (plan) => plan.steps.filter((s) => !s.skip).length;
  const risky = changes.filter((c) => c.risky).length;
  const dw = verifyOf(a) === verifyOf(b) ? 'same' : `${verifyOf(a)} → ${verifyOf(b)}`;
  p(`| ${slug} | ${meta.source || ''} | ${runs(a)} | ${runs(b)} | ${changes.length} | ${risky ? '**' + risky + '**' : 0} | ${dw} |`);
  report.plan.push({ slug, source: meta.source, v1Runs: runs(a), v2Runs: runs(b), verify: { v1: verifyOf(a), v2: verifyOf(b) }, changes });
  if (changes.length) detail.push({ slug, changes });
}
p('');
for (const d of detail) {
  p(`### ${d.slug}`);
  for (const c of d.changes) p(`- ${c.risky ? '**RISK** ' : ''}\`${c.cmd.slice(0, 120)}\`: v1 ${c.v1} → v2 ${c.v2}`);
  p('');
}

// ── 2. DIAGNOSIS ────────────────────────────────────────────────────────────────────────────────
p(`## 2. Diagnosis: recorded failures in ${report.audit}`);
p('');
p('| repo | evidence | command | v1 | v2 | v2 fix |');
p('|---|---|---|---|---|---|');
let same = 0, changed = 0;
for (const auditDir of auditDirs) {
  const audit = readJson(path.join(auditDir, 'audit.json'));
  if (!audit) { p(`| no audit.json in ${path.basename(auditDir)}; skipped | | | | | |`); continue; }
  for (const r of audit.repos) {
    if (only && !only.includes(r.slug)) continue;
    const runDir = path.join(auditDir, 'runs', r.slug);
    const evDir = path.join(runDir, 'evidence');
    const fixture = path.join(FIX, r.slug);
    if (!fs.existsSync(evDir) || !fs.existsSync(fixture)) continue;
    const plan = readJson(path.join(runDir, 'plan.json')) || { steps: [] };
    const evidence = fs.readdirSync(evDir).sort().map((f) => readJson(path.join(evDir, f))).filter(Boolean);
    for (const e of evidence) {
      if (!e.before) continue;
      const step = plan.steps.find((s) => s.id === e.stepId) || { id: e.stepId, command: e.before.command, kind: 'other', source: {} };
      const run = async (V) => {
        const facts = await V.scout(fixture);
        const pl = { ...plan, runtime: V.buildPlan(facts).runtime };
        const log = e.before.logTail || '';
        const ctx = { step: { ...step, command: e.before.command }, attempt: { out: log, exitCode: e.before.exitCode }, log, facts, plan: pl,
          sandbox: { services: [] }, tried: new Set(), history: [], sandboxEnv: {} };
        try { const { diagnosis, fix } = await V.diagnose(ctx, { brain: 'rules', bobBudget: 0 }); return { id: diagnosis?.ruleId || diagnosis?.class || 'none', fix: fix ? fix.actions.map((x) => x.command || x.image || x.type).join(' ; ') : '' }; }
        catch (err) { return { id: 'error: ' + err.message, fix: '' }; }
      };
      const [d1, d2] = [await run(V1), await run(V2)];
      const diff = d1.id !== d2.id || d1.fix !== d2.fix;
      diff ? changed++ : same++;
      report.diagnosis.push({ slug: r.slug, evidence: e.id, status: e.status, command: e.before.command, v1: d1, v2: d2, changed: diff });
      if (diff) p(`| ${r.slug} | ${e.id} (${e.status}) | \`${norm(e.before.command).slice(0, 60)}\` | ${d1.id} | ${d2.id} | ${d2.fix ? '`' + d2.fix.slice(0, 70) + '`' : ''} |`);
    }
  }
}
p('');
p(`${changed} recorded failures diagnosed differently by v2, ${same} unchanged (rows above are the changed ones).`);

const risky = report.plan.reduce((n, r) => n + (r.changes || []).filter((c) => c.risky).length, 0);
p('');
p(`**Summary:** ${report.plan.length} docs planned, ${report.plan.filter((r) => r.changes?.length).length} with changed lines, ${risky} risky skips (a step that passed in the recorded run and v2 would no longer run).`);
console.log(out.join('\n'));
if (opt('json')) fs.writeFileSync(path.resolve(opt('json')), JSON.stringify(report, null, 2));
process.exitCode = risky ? 1 : 0;
