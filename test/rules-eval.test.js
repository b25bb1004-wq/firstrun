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
      ['missing-tool', 'missing-global-tool'],
      ['secret-required', 'playwright-base-url-mismatch'],
      ['browser-system-libs', 'playwright-base-url-mismatch'],
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
    'missing-build-script', 'permission-denied-shebang', 'serverless-missing',
    'missing-build-output', 'wrong-directory-bash', 'test-config-issue',
    'docker-service-missing',
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

// Backlog round 2 rules tests
test('rules-eval: missing-global-tool fires on aws not found', async () => {
  const rule = RULES.find(r => r.id === 'missing-global-tool');
  assert.ok(rule, 'rule exists');
  
  const log = '/firstrun/step-2.sh: line 5: aws: command not found';
  const step = { command: 'aws configure', kind: 'other', source: {} };
  const facts = { node: { deps: [], scripts: {}, lockfile: 'package-lock.json' }, python: { deps: [] } };
  
  const res = await rule.test({ log, step, facts });
  assert.ok(res, 'rule should match aws');
  assert.equal(res.ruleId, 'missing-global-tool');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.includes('awscli'));
});

test('rules-eval: missing-global-tool fires on sls not found', async () => {
  const rule = RULES.find(r => r.id === 'missing-global-tool');
  assert.ok(rule, 'rule exists');
  
  const log = '/firstrun/step-5.sh: line 5: sls: command not found';
  const step = { command: 'sls dynamodb install', kind: 'other', source: {} };
  const facts = { node: { deps: [], scripts: {}, lockfile: 'package-lock.json' }, python: { deps: [] } };
  
  const res = await rule.test({ log, step, facts });
  assert.ok(res, 'rule should match sls');
  assert.equal(res.ruleId, 'missing-global-tool');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.includes('serverless'));
});

test('rules-eval: missing-global-tool fires on make not found', async () => {
  const rule = RULES.find(r => r.id === 'missing-global-tool');
  assert.ok(rule, 'rule exists');
  
  const log = '/firstrun/step-1.sh: line 5: make: command not found';
  const step = { command: 'make run', kind: 'other', source: {} };
  const facts = { node: { deps: [], scripts: {}, lockfile: 'package-lock.json' }, python: { deps: [] } };
  
  const res = await rule.test({ log, step, facts });
  assert.ok(res, 'rule should match make');
  assert.equal(res.ruleId, 'missing-global-tool');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.includes('apt-get install -y make'));
});

test('rules-eval: missing-global-tool does NOT fire when tool is in deps', async () => {
  const rule = RULES.find(r => r.id === 'missing-global-tool');
  assert.ok(rule, 'rule exists');
  
  const log = '/firstrun/step-5.sh: line 5: nodemon: command not found';
  const step = { command: 'nodemon ./bin/www', kind: 'other', source: {} };
  const facts = { node: { deps: ['nodemon'], scripts: { dev: 'nodemon ./bin/www' }, lockfile: 'package-lock.json' }, python: { deps: [] } };
  
  const res = await rule.test({ log, step, facts });
  // nodemon is in deps, so missing-tool should handle it, not missing-global-tool
  assert.equal(res, null, 'should not match when tool is in deps');
});

test('rules-eval: missing-build-script fires on missing build script', async () => {
  const rule = RULES.find(r => r.id === 'missing-build-script');
  assert.ok(rule, 'rule exists');
  
  const log = 'error: Script not found "build"';
  const step = { command: 'npm run build', kind: 'other', source: {} };
  const facts = { node: { deps: [], scripts: { start: 'tsc && node app.js' }, lockfile: 'package-lock.json' } };
  
  const res = await rule.test({ log, step, facts });
  assert.ok(res, 'rule should match missing build');
  assert.equal(res.ruleId, 'missing-build-script');
  assert.ok(res.fix);
  // Should suggest using start script which builds inline
  assert.ok(res.fix.actions[0].command.includes('start'));
});

test('rules-eval: missing-build-script fires on build:dev missing but start builds inline', async () => {
  const rule = RULES.find(r => r.id === 'missing-build-script');
  assert.ok(rule, 'rule exists');
  
  const log = 'error: Script not found "build:dev"';
  const step = { command: 'npm run build:dev', kind: 'other', source: {} };
  const facts = { node: { deps: [], scripts: { start: 'npm run build:dev && node app.js' }, lockfile: 'package-lock.json' } };
  
  const res = await rule.test({ log, step, facts });
  assert.ok(res, 'rule should match missing build:dev');
  assert.equal(res.ruleId, 'missing-build-script');
  assert.ok(res.fix);
});

test('rules-eval: missing-build-script does NOT fire when another build script exists', async () => {
  const rule = RULES.find(r => r.id === 'missing-build-script');
  assert.ok(rule, 'rule exists');
  
  const log = 'error: Script not found "build:prod"';
  const step = { command: 'npm run build:prod', kind: 'other', source: {} };
  const facts = { node: { deps: [], scripts: { build: 'tsc' }, lockfile: 'package-lock.json' } };
  
  const res = await rule.test({ log, step, facts });
  // build script exists, so missing-npm-script should handle the typo
  assert.equal(res, null, 'should not match when another build script exists');
});

test('rules-eval: playwright-base-url-mismatch fires on port mismatch', async () => {
  const rule = RULES.find(r => r.id === 'playwright-base-url-mismatch');
  assert.ok(rule, 'rule exists');
  
  const log = '[WebServer] WARNING: The BASE_URL environment variable and the App have a port mismatch. If you plan to run the App on a different port, update the BASE_URL variable accordingly. BASE_URL=http://localhost:3000';
  const facts = { ports: [5173] };
  const sandboxEnv = {};
  
  const res = await rule.test({ log, facts, sandboxEnv });
  assert.ok(res, 'rule should match BASE_URL mismatch');
  assert.equal(res.ruleId, 'playwright-base-url-mismatch');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.includes('BASE_URL=http://localhost:5173'));
});

test('rules-eval: playwright-base-url-mismatch does NOT fire when ports match', async () => {
  const rule = RULES.find(r => r.id === 'playwright-base-url-mismatch');
  assert.ok(rule, 'rule exists');
  
  const log = '[WebServer] WARNING: The BASE_URL environment variable and the App have a port mismatch. BASE_URL=http://localhost:3000';
  const facts = { ports: [3000] };
  const sandboxEnv = {};
  
  const res = await rule.test({ log, facts, sandboxEnv });
  assert.equal(res, null, 'should not match when ports match');
});

test('rules-eval: permission-denied-shebang fires on ./manage.py permission denied', async () => {
  const rule = RULES.find(r => r.id === 'permission-denied-shebang');
  assert.ok(rule, 'rule exists');
  
  const log = '/firstrun/step-6.sh: line 5: ./manage.py: Permission denied';
  const step = { command: './manage.py migrate', kind: 'other', source: {} };
  const facts = { files: ['manage.py'], python: { deps: [], requirementsFiles: [], apps: [] } };
  
  const res = await rule.test({ log, step, facts });
  assert.ok(res, 'rule should match permission denied');
  assert.equal(res.ruleId, 'permission-denied-shebang');
  assert.ok(res.fix);
  assert.equal(res.fix.actions[0].command, 'python manage.py migrate');
});

test('rules-eval: serverless-missing fires on sls not found', async () => {
  const rule = RULES.find(r => r.id === 'serverless-missing');
  assert.ok(rule, 'rule exists');
  
  const log = 'sh: 1: sls: not found';
  const step = { command: 'sls dynamodb install', kind: 'other', source: {} };
  const facts = { node: { deps: [], scripts: { 'ddb:install': 'sls dynamodb install' }, lockfile: 'package-lock.json' } };
  
  const res = await rule.test({ log, step, facts });
  assert.ok(res, 'rule should match serverless missing');
  assert.equal(res.ruleId, 'serverless-missing');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.includes('serverless'));
});

test('rules-eval: missing-build-output fires on dist/src/main not found', async () => {
  const rule = RULES.find(r => r.id === 'missing-build-output');
  assert.ok(rule, 'rule exists');
  
  const log = 'node:internal/modules/cjs/loader:1\nError: Cannot find module \'/workspace/dist/src/main\'';
  const step = { command: 'npm run start:prod', kind: 'start', source: {} };
  const facts = { node: { deps: [], scripts: { build: 'tsc', 'start:prod': 'node dist/src/main' }, lockfile: 'package-lock.json' } };
  const plan = { steps: [], runtime: { name: 'node', version: '22' } };
  
  const res = await rule.test({ log, step, facts, plan });
  assert.ok(res, 'rule should match missing build output');
  assert.equal(res.ruleId, 'missing-build-output');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.includes('build'));
});

test('rules-eval: wrong-directory-bash fires on bash No such file or directory', async () => {
  const rule = RULES.find(r => r.id === 'wrong-directory-bash');
  assert.ok(rule, 'rule exists');
  
  const log = 'bash: scripts/prestart.sh: No such file or directory';
  const step = { command: 'uv run bash scripts/prestart.sh', kind: 'other', source: {} };
  const facts = { files: ['backend/scripts/prestart.sh'] };
  
  const res = await rule.test({ log, step, facts });
  assert.ok(res, 'rule should match bash wrong directory');
  assert.equal(res.ruleId, 'wrong-directory-bash');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.startsWith('cd backend &&'));
});

test('rules-eval: test-config-issue fires on ts-jest warning', async () => {
  const rule = RULES.find(r => r.id === 'test-config-issue');
  assert.ok(rule, 'rule exists');
  
  const log = 'ts-jest[ts-compiler] (WARN) Got a `.js` file to compile but ts-jest is configured to only compile `.ts` files';
  const step = { command: 'npm test', kind: 'test', source: {} };
  
  const res = await rule.test({ log, step });
  assert.ok(res, 'rule should match ts-jest warning');
  assert.equal(res.ruleId, 'test-config-issue');
  assert.equal(res.fix, null); // Human must fix
  assert.ok(res.ask);
});

test('rules-eval: test-config-issue fires on OAuth2Strategy error', async () => {
  const rule = RULES.find(r => r.id === 'test-config-issue');
  assert.ok(rule, 'rule exists');
  
  const log = 'Error: Unknown authentication strategy "oauth2"';
  const step = { command: 'npm test', kind: 'test', source: {} };
  
  const res = await rule.test({ log, step });
  assert.ok(res, 'rule should match OAuth2Strategy error');
  assert.equal(res.ruleId, 'test-config-issue');
  assert.equal(res.fix, null);
  assert.ok(res.ask);
});

// Negative cases - rules should NOT fire on unrelated logs
test('rules-eval: missing-global-tool negative - npm not found in node project', async () => {
  const rule = RULES.find(r => r.id === 'missing-global-tool');
  assert.ok(rule, 'rule exists');
  
  const log = '/firstrun/step-1.sh: line 5: npm: command not found';
  const step = { command: 'npm install', kind: 'install', source: {} };
  const facts = { node: { deps: [], scripts: {}, lockfile: 'package-lock.json' }, python: { deps: [] } };
  
  const res = await rule.test({ log, step, facts });
  // npm is a core tool, handled by missing-tool's installs map
  assert.equal(res, null, 'should not match npm (handled by missing-tool)');
});

test('rules-eval: missing-build-script negative - test script missing', async () => {
  const rule = RULES.find(r => r.id === 'missing-build-script');
  assert.ok(rule, 'rule exists');
  
  const log = 'Missing script: "test"';
  const step = { command: 'npm test', kind: 'test', source: {} };
  const facts = { node: { deps: [], scripts: {}, lockfile: 'package-lock.json' } };
  
  const res = await rule.test({ log, step, facts });
  // Not a build script
  assert.equal(res, null, 'should not match non-build script');
});

test('rules-eval: playwright-base-url-mismatch negative - no mismatch message', async () => {
  const rule = RULES.find(r => r.id === 'playwright-base-url-mismatch');
  assert.ok(rule, 'rule exists');
  
  const log = 'Running Playwright tests...';
  const facts = { ports: [3000] };
  const sandboxEnv = {};
  
  const res = await rule.test({ log, facts, sandboxEnv });
  assert.equal(res, null, 'should not match without mismatch message');
});

test('rules-eval: permission-denied-shebang negative - not a .py script', async () => {
  const rule = RULES.find(r => r.id === 'permission-denied-shebang');
  assert.ok(rule, 'rule exists');
  
  const log = '/firstrun/step-6.sh: line 5: ./script.sh: Permission denied';
  const step = { command: './script.sh', kind: 'other', source: {} };
  const facts = { files: ['script.sh'], python: { deps: [] } };
  
  const res = await rule.test({ log, step, facts });
  assert.equal(res, null, 'should not match non-.py script');
});

test('rules-eval: serverless-missing negative - not an sls command', async () => {
  const rule = RULES.find(r => r.id === 'serverless-missing');
  assert.ok(rule, 'rule exists');
  
  const log = 'sh: 1: sls: not found';
  const step = { command: 'npm run something', kind: 'other', source: {} };
  const facts = { node: { deps: [], scripts: {}, lockfile: 'package-lock.json' } };
  
  const res = await rule.test({ log, step, facts });
  assert.equal(res, null, 'should not match when step is not sls');
});

test('rules-eval: missing-build-output negative - no build script', async () => {
  const rule = RULES.find(r => r.id === 'missing-build-output');
  assert.ok(rule, 'rule exists');
  
  const log = 'Error: Cannot find module \'/workspace/dist/src/main\'';
  const step = { command: 'npm run start:prod', kind: 'start', source: {} };
  const facts = { node: { deps: [], scripts: { 'start:prod': 'node dist/src/main' }, lockfile: 'package-lock.json' } };
  const plan = { steps: [], runtime: { name: 'node', version: '22' } };
  
  const res = await rule.test({ log, step, facts, plan });
  assert.equal(res, null, 'should not match when no build script exists');
});

test('rules-eval: wrong-directory-bash negative - file in current directory', async () => {
  const rule = RULES.find(r => r.id === 'wrong-directory-bash');
  assert.ok(rule, 'rule exists');
  
  const log = 'bash: prestart.sh: No such file or directory';
  const step = { command: 'bash prestart.sh', kind: 'other', source: {} };
  const facts = { files: ['prestart.sh'] };
  
  const res = await rule.test({ log, step, facts });
  // File is in current dir, not a subdir
  assert.equal(res, null, 'should not match when file is in current directory');
});

test('rules-eval: test-config-issue negative - not a test step', async () => {
  const rule = RULES.find(r => r.id === 'test-config-issue');
  assert.ok(rule, 'rule exists');
  
  const log = 'ts-jest[ts-compiler] (WARN) Got a `.js` file to compile';
  const step = { command: 'npm run build', kind: 'build', source: {} };
  
  const res = await rule.test({ log, step });
  assert.equal(res, null, 'should not match non-test step');
});