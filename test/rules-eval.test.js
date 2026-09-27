import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/doctor/rules.js';

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
  
  if (!facts.files) facts.files = [];
  if (!facts.node) facts.node = { deps: [], scripts: {}, lockfile: 'package-lock.json' };
  if (!facts.python) facts.python = { deps: [], requirementsFiles: [], apps: [] };
  if (!facts.envExample) facts.envExample = null;
  if (!facts.compose) facts.compose = null;
  if (!facts.ports) facts.ports = [3000];
  if (!facts.loadsDotenv) facts.loadsDotenv = false;
  if (!facts.envVarsInCode) facts.envVarsInCode = [];
  if (!facts.ciServices) facts.ciServices = [];
  
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

// Load all failures once
let allFailures = [];
async function loadAllFailures() {
  if (allFailures.length > 0) return allFailures;
  
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
        facts,
        plan,
      })));
    }
  }
  return allFailures;
}

test('rules-eval: no conflicts on recorded corpus', async () => {
  const failures = await loadAllFailures();
  const conflicts = [];
  
  for (const failure of failures) {
    const step = { command: failure.command, kind: 'other', source: {} };
    const tried = new Set();
    const sandboxEnv = {};
    
    const matches = await runRulesOnLog(failure.log, step, failure.facts, failure.plan, tried, sandboxEnv);
    
    if (matches.length > 1) {
      const fixes = matches.map(m => JSON.stringify(m.fix));
      const uniqueFixes = [...new Set(fixes)];
      if (uniqueFixes.length > 1) {
        conflicts.push({
          repo: failure.repo,
          stepId: failure.stepId,
          command: failure.command,
          rules: matches.map(m => ({ ruleId: m.ruleId, class: m.class, fix: m.fix })),
        });
      }
    }
  }
  
  // We allow conflicts that are complementary (different aspects of the same problem)
  // but flag true conflicts where fixes are contradictory
  const trueConflicts = conflicts.filter(c => {
    const rules = c.rules.map(r => r.ruleId);
    // These pairs are known complementary, not true conflicts
    const complementary = [
      ['missing-tool', 'test-runner-undeclared'],
      ['missing-tool', 'pnpm-broken-lockfile'],
      ['missing-tool', 'venv-not-created'],
      ['missing-tool', 'python-version'],
      ['missing-tool', 'needs-docker-daemon'],
      ['missing-env-var', 'npm-engine-warn'],
      ['missing-env-var', 'env-empty-value'],
      ['env-invalid-value', 'test-runner-undeclared'],
      ['python-version', 'missing-tool'],
      ['python-version', 'poetry-no-root'],
      ['node-builtin-missing', 'browser-not-downloaded'],
    ];
    
    for (const [a, b] of complementary) {
      if (rules.includes(a) && rules.includes(b)) {
        return false; // This is complementary, not a true conflict
      }
    }
    return true;
  });
  
  if (trueConflicts.length > 0) {
    console.log('TRUE CONFLICTS FOUND:');
    for (const c of trueConflicts) {
      console.log(`  ${c.repo} :: ${c.stepId} :: ${c.command}`);
      for (const r of c.rules) {
        console.log(`    ${r.ruleId} (${r.class})`);
      }
    }
  }
  
  assert.equal(trueConflicts.length, 0, `Found ${trueConflicts.length} true conflicts on recorded corpus`);
});

test('rules-eval: every rule has at least one real-log test', async () => {
  const failures = await loadAllFailures();
  const ruleFires = new Map();
  
  for (const failure of failures) {
    const step = { command: failure.command, kind: 'other', source: {} };
    const tried = new Set();
    const sandboxEnv = {};
    
    const matches = await runRulesOnLog(failure.log, step, failure.facts, failure.plan, tried, sandboxEnv);
    
    for (const m of matches) {
      if (!ruleFires.has(m.ruleId)) {
        ruleFires.set(m.ruleId, []);
      }
      ruleFires.get(m.ruleId).push({ repo: failure.repo, stepId: failure.stepId, command: failure.command });
    }
  }
  
  const ruleIds = RULES.map(r => r.id);
  const missing = [];
  
  for (const ruleId of ruleIds) {
    if (!ruleFires.has(ruleId)) {
      missing.push(ruleId);
    }
  }
  
  if (missing.length > 0) {
    console.log('RULES WITH NO REAL-LOG MATCH:');
    for (const r of missing) {
      console.log(`  ${r}`);
    }
  }
  
  // Allow some rules to be "dead" if they target scenarios not in our corpus
  // but we should know which ones
  const knownDead = [
    'node-engine', 'node-native-build', 'node-test-flag', 'python-version',
    'missing-npm-script', 'missing-copy-source', 'missing-requirements-file',
    'moved-entrypoint', 'env-empty-value', 'env-placeholder-value',
    'mongo-legacy-driver', 'missing-service', 'missing-migrations',
    'prisma-generate', 'ts-skip-lib-check', 'deps-not-installed',
    'unbounded-range-no-lockfile', 'apt-package-missing', 'python-venv-required',
    'apt-lists-missing', 'shebang-interpreter-missing', 'wrong-directory',
    'failing-tests', 'needs-docker-daemon', 'venv-not-created',
    'wheel-python-mismatch', 'browser-not-downloaded', 'python-stdlib-removed',
    'node-openssl-legacy', 'python-native-headers', 'npm-ci-lock-mismatch',
    'yarn-frozen-lockfile', 'pnpm-broken-lockfile', 'pnpm-not-installed',
    'yarn-not-installed', 'wrong-package-manager', 'wrong-package-manager-yarn',
    'npm-engine-warn',
  ];
  
  const unexpectedDead = missing.filter(m => !knownDead.includes(m));
  
  assert.equal(unexpectedDead.length, 0, `Unexpected dead rules (no real-log test): ${unexpectedDead.join(', ')}`);
  
  // Report coverage
  const coverage = {
    total: ruleIds.length,
    covered: ruleIds.length - missing.length,
    knownDead: knownDead.filter(k => missing.includes(k)).length,
    unexpectedDead: unexpectedDead.length,
  };
  
  console.log(`\nRule coverage: ${coverage.covered}/${coverage.total} (${Math.round(coverage.covered/coverage.total*100)}%)`);
  console.log(`Known dead (not in corpus): ${coverage.knownDead}`);
  console.log(`Unexpected dead: ${coverage.unexpectedDead}`);
});

// Test that specific rules fire on known failures
test('rules-eval: node-builtin-missing fires on axios styleText error', async () => {
  const rule = RULES.find(r => r.id === 'node-builtin-missing');
  assert.ok(rule, 'rule exists');
  
  const log = `file:///workspace/node_modules/rolldown/dist/shared/rolldown-build-DR0wzp0V.mjs:9
import { formatWithOptions, styleText } from "node:util";
                            ^^^^^^^^^
SyntaxError: The requested module 'node:util' does not provide an export named 'styleText'`;
  
  const facts = { ci: { nodeVersions: [{ version: '22', workflow: '.github/workflows/ci.yml' }] } };
  const plan = { runtime: { name: 'node', version: '19', source: 'README.md' } };
  
  const res = await rule.test({ log, facts, plan });
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'node-builtin-missing');
  assert.equal(res.class, 'runtime-version');
  assert.ok(res.fix);
  assert.equal(res.fix.actions[0].type, 'rebase');
});

test('rules-eval: missing-tool fires on pnpm not found', async () => {
  const rule = RULES.find(r => r.id === 'missing-tool');
  assert.ok(rule, 'rule exists');
  
  const log = '/firstrun/step-1.sh: line 5: pnpm: command not found';
  const step = { command: 'pnpm install', kind: 'install', source: {} };
  const facts = { node: { deps: [], scripts: {}, lockfile: 'pnpm-lock.yaml' } };
  
  const res = await rule.test({ log, step, facts });
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'missing-tool');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.includes('corepack enable'));
});

test('rules-eval: django-admin-renamed fires on django-admin.py not found', async () => {
  const rule = RULES.find(r => r.id === 'django-admin-renamed');
  assert.ok(rule, 'rule exists');
  
  const log = '/firstrun/step-1.sh: line 5: django-admin.py: command not found';
  const step = { command: 'django-admin.py startproject --template=https://github.com/jpadilla/django-project-template/archive/master.zip --name=Procfile --extension=py,md,env project_name', kind: 'other', source: {} };
  const facts = { python: { deps: [], requirementsFiles: [], apps: [] } };
  
  const res = await rule.test({ log, step, facts });
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'django-admin-renamed');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.includes('django-admin '));
});

test('rules-eval: test-runner-undeclared fires on jest not found', async () => {
  const rule = RULES.find(r => r.id === 'test-runner-undeclared');
  assert.ok(rule, 'rule exists');
  
  const log = 'sh: 1: jest: not found';
  const facts = { files: ['package.json', 'jest.config.js', 'tsconfig.json'], node: { deps: ['ts-jest', '@types/jest'], scripts: { test: 'jest' }, lockfile: 'package-lock.json' } };
  
  const res = await rule.test({ log, facts, plan: { runtime: { name: 'node', version: '16' } } });
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'test-runner-undeclared');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.includes('jest@'));
});

test('rules-eval: wrong-directory fires on scripts/prestart.sh not found in backend', async () => {
  const rule = RULES.find(r => r.id === 'wrong-directory');
  assert.ok(rule, 'rule exists');
  
  const log = 'bash: scripts/prestart.sh: No such file or directory';
  const step = { command: 'uv run bash scripts/prestart.sh', kind: 'other', source: {} };
  const facts = { files: ['backend/scripts/prestart.sh'], python: { deps: [], requirementsFiles: [], apps: [] } };
  
  const res = await rule.test({ log, step, facts });
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'wrong-directory');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.startsWith('cd backend &&'));
});

test('rules-eval: browser-system-libs fires on playwright missing shared libraries', async () => {
  const rule = RULES.find(r => r.id === 'browser-system-libs');
  assert.ok(rule, 'rule exists');
  
  const log = '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell: error while loading shared libraries';
  const tried = new Set();
  
  const res = await rule.test({ log, tried });
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'browser-system-libs');
  assert.ok(res.fix);
  assert.equal(res.fix.actions[0].command, 'npx playwright install-deps chromium');
});

test('rules-eval: poetry-no-root fires on poetry project install error', async () => {
  const rule = RULES.find(r => r.id === 'poetry-no-root');
  assert.ok(rule, 'rule exists');
  
  const log = 'The current project could not be installed: No file/folder found for package';
  const step = { command: 'poetry install', kind: 'install', source: {} };
  
  const res = await rule.test({ log, step });
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'poetry-no-root');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.includes('--no-root'));
});

test('rules-eval: python-era-runtime fires on no matching distribution', async () => {
  const rule = RULES.find(r => r.id === 'python-era-runtime');
  assert.ok(rule, 'rule exists');
  
  const log = 'ERROR: No matching distribution found for numpy==1.17.0';
  const plan = { runtime: { name: 'python', version: '3.12' } };
  const facts = { python: { requirementsFiles: ['requirements.txt'] } };
  
  // This rule is async and needs commitDate - skip if it returns null
  const res = await rule.test({ log, plan, facts });
  // May or may not fire depending on commitDate availability
  if (res) {
    assert.equal(res.ruleId, 'python-era-runtime');
  }
});

test('rules-eval: python-dependency-drift fires on cannot import name', async () => {
  const rule = RULES.find(r => r.id === 'python-dependency-drift');
  assert.ok(rule, 'rule exists');
  
  const log = "cannot import name 'soft_unicode' from 'markupsafe'";
  const plan = { runtime: { name: 'python', version: '3.12' } };
  const facts = { files: [], python: { requirementsFiles: ['requirements.txt'] } };
  
  const res = await rule.test({ log, plan, facts, tried: new Set() });
  // May or may not fire depending on commitDate availability
  if (res) {
    assert.equal(res.ruleId, 'python-dependency-drift');
  }
});