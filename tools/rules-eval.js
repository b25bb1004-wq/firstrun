#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { RULES } from '../src/doctor/rules.js';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const AUDIT_DIRS = [
  'audit/v2-31-final-combined/runs',
  'audit/factory-1/runs',
  'audit/v2-31-final-bob/runs',
];

function readAuditRuns(dir) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return [];
  const runs = [];
  for (const repo of fs.readdirSync(fullDir)) {
    const runDir = path.join(fullDir, repo);
    if (!fs.statSync(runDir).isDirectory()) continue;
    const eventsFile = path.join(runDir, 'events.ndjson');
    const runFile = path.join(runDir, 'run.json');
    const planFile = path.join(runDir, 'plan.json');
    if (!fs.existsSync(eventsFile)) continue;
    const events = fs.readFileSync(eventsFile, 'utf8')
      .trim().split('\n')
      .map(l => JSON.parse(l));
    const runInfo = fs.existsSync(runFile) ? JSON.parse(fs.readFileSync(runFile, 'utf8')) : { repo };
    const planInfo = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')) : {};
    runs.push({ repo, events, runInfo, planInfo, runDir });
  }
  return runs;
}

function extractFailures(events) {
  const failures = [];
  const stepLogs = new Map();
  for (const e of events) {
    if (e.type === 'step.log' && e.data?.stepId) {
      if (!stepLogs.has(e.data.stepId)) stepLogs.set(e.data.stepId, '');
      stepLogs.set(e.data.stepId, stepLogs.get(e.data.stepId) + e.data.chunk);
    }
    if (e.type === 'step.end' && e.data?.status === 'failed') {
      const stepId = e.data.stepId;
      const log = stepLogs.get(stepId) || e.data.logTail || '';
      const command = e.data.command;
      const exitCode = e.data.exitCode;
      const n = e.data.n;
      failures.push({ stepId, command, log, exitCode, attempt: n });
    }
  }
  return failures;
}

function buildFactsFromEvents(events, runDir) {
  const factsEvent = events.find(e => e.type === 'facts' && e.agent === 'scout');
  const facts = factsEvent?.data || {};
  
  // Ensure all expected fields exist
  if (!facts.files) facts.files = [];
  if (!facts.node) facts.node = { deps: [], scripts: {}, lockfile: 'package-lock.json' };
  if (!facts.python) facts.python = { deps: [], requirementsFiles: [], apps: [] };
  if (!facts.envExample) facts.envExample = null;
  if (!facts.compose) facts.compose = null;
  if (!facts.ports) facts.ports = [3000];
  if (!facts.loadsDotenv) facts.loadsDotenv = false;
  if (!facts.envVarsInCode) facts.envVarsInCode = [];
  if (!facts.ciServices) facts.ciServices = [];
  
  // Add root path for file reading
  facts.root = runDir;
  facts.projectDir = '';
  
  return facts;
}

function buildPlanFromEvents(events, planInfo) {
  const planEvent = events.find(e => e.type === 'plan' && e.agent === 'planner');
  const plan = planEvent?.data || planInfo?.plan || {};
  
  if (!plan.steps) plan.steps = [];
  if (!plan.runtime) plan.runtime = { name: 'node', version: '22', source: 'docs do not say' };
  if (!plan.repo) plan.repo = '';
  
  return plan;
}

async function runRulesOnLog(log, step, facts, plan, tried = new Set(), sandboxEnv = {}) {
  const ctx = { log, step, facts, plan, tried, sandboxEnv };
  const results = [];
  for (const rule of RULES) {
    try {
      const res = await rule.test(ctx);
      if (res) {
        results.push({ ruleId: rule.id, class: res.class, ...res });
      }
    } catch (err) {
      // Silently ignore rule errors for this evaluation
    }
  }
  return results;
}

async function main() {
  const allFailures = [];
  const allRuns = [];

  for (const dir of AUDIT_DIRS) {
    const runs = readAuditRuns(dir);
    for (const run of runs) {
      const failures = extractFailures(run.events);
      const facts = buildFactsFromEvents(run.events, run.runDir);
      const plan = buildPlanFromEvents(run.events, run.planInfo);
      
      allFailures.push(...failures.map(f => ({
        ...f,
        repo: run.repo,
        auditDir: dir,
        events: run.events,
        runInfo: run.runInfo,
        facts,
        plan,
      })));
      allRuns.push(run);
    }
  }

  console.log(`Total failures across ${AUDIT_DIRS.length} audit dirs: ${allFailures.length}`);

  const ruleStats = new Map();
  const unmatchedFailures = [];
  const conflicts = [];

  for (const failure of allFailures) {
    const step = { command: failure.command, kind: 'other', source: {} };
    const tried = new Set();
    const sandboxEnv = {};

    const matches = await runRulesOnLog(failure.log, step, failure.facts, failure.plan, tried, sandboxEnv);

    if (matches.length === 0) {
      unmatchedFailures.push(failure);
    } else if (matches.length > 1) {
      const fixes = matches.map(m => JSON.stringify(m.fix));
      const uniqueFixes = [...new Set(fixes)];
      if (uniqueFixes.length > 1) {
        conflicts.push({
          failure: { repo: failure.repo, stepId: failure.stepId, command: failure.command },
          rules: matches.map(m => ({ ruleId: m.ruleId, class: m.class, fix: m.fix })),
        });
      }
      const first = matches[0];
      const stat = ruleStats.get(first.ruleId) || { fires: 0, matchedActualFix: 0, conflicts: 0 };
      stat.fires++;
      stat.conflicts++;
      ruleStats.set(first.ruleId, stat);
    } else {
      const m = matches[0];
      const stat = ruleStats.get(m.ruleId) || { fires: 0, matchedActualFix: 0, conflicts: 0 };
      stat.fires++;
      ruleStats.set(m.ruleId, stat);
    }
  }

  // Check for dead rules
  const ruleIds = RULES.map(r => r.id);
  for (const ruleId of ruleIds) {
    if (!ruleStats.has(ruleId)) {
      console.log(`DEAD RULE: ${ruleId} never fires on recorded logs`);
    }
  }

  // Print summary
  console.log('\n=== RULE COVERAGE ===');
  let totalCovered = 0;
  for (const [ruleId, stat] of ruleStats.entries()) {
    console.log(`${ruleId}: ${stat.fires} fires, ${stat.conflicts || 0} conflicts`);
    totalCovered += stat.fires;
  }
  console.log(`\nTotal failures with at least one rule match: ${totalCovered}`);
  console.log(`Total failures with NO rule match: ${unmatchedFailures.length}`);

  console.log('\n=== UNMATCHED FAILURES (BACKLOG) ===');
  const backlogByError = new Map();
  for (const f of unmatchedFailures) {
    const key = f.log.slice(0, 100).replace(/\n/g, ' ');
    if (!backlogByError.has(key)) backlogByError.set(key, []);
    backlogByError.get(key).push({ repo: f.repo, stepId: f.stepId, command: f.command });
  }
  for (const [error, instances] of backlogByError.entries()) {
    console.log(`\n[${instances.length}x] ${error}...`);
    for (const inst of instances.slice(0, 3)) {
      console.log(`  ${inst.repo} :: ${inst.stepId} :: ${inst.command}`);
    }
    if (instances.length > 3) console.log(`  ... and ${instances.length - 3} more`);
  }

  console.log('\n=== CONFLICTS ===');
  for (const c of conflicts) {
    console.log(`\n${c.failure.repo} :: ${c.failure.stepId} :: ${c.failure.command}`);
    for (const r of c.rules) {
      console.log(`  ${r.ruleId} (${r.class}) -> ${JSON.stringify(r.fix).slice(0, 120)}`);
    }
  }

  // Write detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFailures: allFailures.length,
      covered: totalCovered,
      unmatched: unmatchedFailures.length,
      conflicts: conflicts.length,
      ruleCount: RULES.length,
    },
    ruleStats: Object.fromEntries(ruleStats),
    unmatchedFailures: unmatchedFailures.map(f => ({
      repo: f.repo,
      stepId: f.stepId,
      command: f.command,
      logPreview: f.log.slice(0, 200),
    })),
    conflicts,
    deadRules: ruleIds.filter(id => !ruleStats.has(id)),
  };

  fs.writeFileSync(path.join(ROOT, 'audit/rules-eval-report.json'), JSON.stringify(report, null, 2));
  console.log('\nWrote detailed report to audit/rules-eval-report.json');

  return { allFailures, unmatchedFailures, ruleStats, conflicts };
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});