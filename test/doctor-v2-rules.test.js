import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/doctor/rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ruleById(id) {
  return RULES.find((r) => r.id === id);
}

function makeCtx(overrides = {}) {
  return {
    log: '',
    step: { command: '', kind: 'other', source: {} },
    facts: { files: [], node: { deps: [], scripts: {}, lockfile: 'package-lock.json' }, python: { deps: [], requirementsFiles: [] }, envExample: null, compose: null, ports: [3000], loadsDotenv: false },
    plan: { repo: '', steps: [], runtime: { name: 'node', version: '22', source: 'docs do not say' } },
    tried: new Set(),
    sandboxEnv: {},
    ...overrides,
  };
}

async function makeTempDirWithFiles(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-rule-'));
  for (const [f, body] of Object.entries(files)) {
    const full = path.join(root, f);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}

test('interactive-prompt: positive case matches the rule', async () => {
  const rule = ruleById('interactive-prompt');
  assert.ok(rule, 'rule exists');
  const ctx = makeCtx({
    log: 'Hello! What can I call you?: Aborted!\n',
    step: { command: 'node greet.js', kind: 'other', source: {} },
  });
  const res = rule.test(ctx);
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'interactive-prompt');
  assert.equal(res.class, 'interactive');
  assert.equal(res.fix, null);
});

test('interactive-prompt: negative case (no prompt) returns null', async () => {
  const rule = ruleById('interactive-prompt');
  const ctx = makeCtx({
    log: 'Error: something else went wrong\n',
    step: { command: 'node greet.js', kind: 'other', source: {} },
  });
  const res = rule.test(ctx);
  assert.equal(res, null);
});

test('apt-lists-missing: positive case inserts apt-get update', async () => {
  const rule = ruleById('apt-lists-missing');
  assert.ok(rule, 'rule exists');
  const ctx = makeCtx({
    log: "E: Package 'build-essential' has no installation candidate\n",
    step: { command: 'sudo apt-get install build-essential', kind: 'prereq', source: {} },
    tried: new Set(),
  });
  const res = rule.test(ctx);
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'apt-lists-missing');
  assert.equal(res.class, 'missing-tool');
  assert.ok(res.fix);
  assert.equal(res.fix.actions[0].command, 'apt-get update');
  assert.equal(res.fix.actions[0].kind, 'prereq');
});

test('apt-lists-missing: negative case (npm install instead of apt) returns null', async () => {
  const rule = ruleById('apt-lists-missing');
  const ctx = makeCtx({
    log: "E: Package 'build-essential' has no installation candidate\n",
    step: { command: 'npm install', kind: 'install', source: {} },
    tried: new Set(),
  });
  const res = rule.test(ctx);
  assert.equal(res, null);
});

test('test-runner-undeclared: positive case (jest not in deps) returns fix with jest ts-jest @types/jest', async () => {
  const rule = ruleById('test-runner-undeclared');
  assert.ok(rule, 'rule exists');
  const root = await makeTempDirWithFiles({
    'jest.config.js': "module.exports = { preset: 'ts-jest' };",
    'tsconfig.json': '{}',
  });
  const ctx = makeCtx({
    log: 'sh: 1: jest: not found\n',
    facts: {
      files: ['jest.config.js', 'tsconfig.json'],
      node: { deps: [], scripts: { test: 'jest' }, lockfile: 'package-lock.json' },
      python: { deps: [], requirementsFiles: [] },
      envExample: null,
      compose: null,
      ports: [3000],
      loadsDotenv: false,
      root,
    },
  });
  const res = rule.test(ctx);
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'test-runner-undeclared');
  assert.equal(res.class, 'missing-dependency');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.includes('jest'));
  assert.ok(res.fix.actions[0].command.includes('ts-jest'));
  assert.ok(res.fix.actions[0].command.includes('@types/jest'));
});

test('test-runner-undeclared: negative case (jest in deps) returns null', async () => {
  const rule = ruleById('test-runner-undeclared');
  const root = await makeTempDirWithFiles({
    'jest.config.js': "module.exports = { preset: 'ts-jest' };",
    'tsconfig.json': '{}',
  });
  const ctx = makeCtx({
    log: 'sh: 1: jest: not found\n',
    facts: {
      files: ['jest.config.js', 'tsconfig.json'],
      node: { deps: ['jest'], scripts: { test: 'jest' }, lockfile: 'package-lock.json' },
      python: { deps: [], requirementsFiles: [] },
      envExample: null,
      compose: null,
      ports: [3000],
      loadsDotenv: false,
      root,
    },
  });
  const res = rule.test(ctx);
  assert.equal(res, null);
});

test('wrong-directory: positive case expects cd backend', async () => {
  const rule = ruleById('wrong-directory');
  assert.ok(rule, 'rule exists');
  const ctx = makeCtx({
    log: "bash: scripts/prestart.sh: No such file or directory\n",
    step: { command: 'uv run bash scripts/prestart.sh', kind: 'other', source: {} },
    facts: {
      files: ['backend/scripts/prestart.sh'],
      node: { deps: [], scripts: {}, lockfile: 'package-lock.json' },
      python: { deps: [], requirementsFiles: [] },
      envExample: null,
      compose: null,
      ports: [3000],
      loadsDotenv: false,
    },
  });
  const res = rule.test(ctx);
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'wrong-directory');
  assert.equal(res.class, 'wrong-order');
  assert.ok(res.fix);
  assert.ok(res.fix.actions[0].command.startsWith('cd backend &&'));
});

test('wrong-directory: negative case (file at root) returns null', async () => {
  const rule = ruleById('wrong-directory');
  const ctx = makeCtx({
    log: "bash: scripts/prestart.sh: No such file or directory\n",
    step: { command: 'uv run bash scripts/prestart.sh', kind: 'other', source: {} },
    facts: {
      files: ['scripts/prestart.sh'],
      node: { deps: [], scripts: {}, lockfile: 'package-lock.json' },
      python: { deps: [], requirementsFiles: [] },
      envExample: null,
      compose: null,
      ports: [3000],
      loadsDotenv: false,
    },
  });
  const res = rule.test(ctx);
  assert.equal(res, null);
});

test('docs-for-other-repo: positive case (clone URL is different repo)', async () => {
  const rule = ruleById('docs-for-other-repo');
  assert.ok(rule, 'rule exists');
  const ctx = makeCtx({
    log: 'npm error Missing script: "start"\n',
    plan: {
      repo: 'JKHeadley/rest-hapi',
      steps: [
        { command: 'git clone https://github.com/JKHeadley/rest-hapi-demo.git', kind: 'other', source: { file: 'README.md', line: 1 } },
        { command: 'npm start', kind: 'serve', source: {} },
      ],
      runtime: { name: 'node', version: '22', source: 'docs do not say' },
    },
  });
  const res = rule.test(ctx);
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'docs-for-other-repo');
  assert.equal(res.class, 'docs-mismatch');
  assert.equal(res.fix, null);
});

test('docs-for-other-repo: negative case (clone URL is same repo) returns null', async () => {
  const rule = ruleById('docs-for-other-repo');
  const ctx = makeCtx({
    log: 'npm error Missing script: "start"\n',
    plan: {
      repo: 'JKHeadley/rest-hapi-demo',
      steps: [
        { command: 'git clone https://github.com/JKHeadley/rest-hapi-demo.git', kind: 'other', source: { file: 'README.md', line: 1 } },
        { command: 'npm start', kind: 'serve', source: {} },
      ],
      runtime: { name: 'node', version: '22', source: 'docs do not say' },
    },
  });
  const res = rule.test(ctx);
  assert.equal(res, null);
});

test('failing-tests: positive case mocha output', async () => {
  const rule = ruleById('failing-tests');
  assert.ok(rule, 'rule exists');
  const ctx = makeCtx({
    log: '  0 passing (1s)\n  2 failing\n\n  1) test one\n     Timeout of 10000ms exceeded',
    step: { command: 'npm test', kind: 'test', source: {} },
  });
  const res = rule.test(ctx);
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'failing-tests');
  assert.equal(res.class, 'failing-tests');
  assert.ok(res.cause.includes('2 of 2 tests fail'));
  assert.ok(res.cause.includes('timeouts'));
  assert.equal(res.fix, null);
});

test('failing-tests: positive case jest output', async () => {
  const rule = ruleById('failing-tests');
  const ctx = makeCtx({
    log: 'Tests: 3 failed, 10 passed, 13 total',
    step: { command: 'npm test', kind: 'test', source: {} },
  });
  const res = rule.test(ctx);
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'failing-tests');
  assert.ok(res.cause.includes('3 of 13 tests fail'));
  assert.equal(res.fix, null);
});

test('failing-tests: positive case pytest output', async () => {
  const rule = ruleById('failing-tests');
  const ctx = makeCtx({
    log: '======== 5 failed, 33 passed, 16 errors in 5.46s\n\nOperationalError: could not connect to server',
    step: { command: 'pytest', kind: 'test', source: {} },
  });
  const res = rule.test(ctx);
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'failing-tests');
  assert.ok(res.cause.includes('21 of 54 tests fail'));
  assert.ok(res.cause.includes('database connection'));
  assert.equal(res.fix, null);
});

test('failing-tests: negative case (step.kind install) returns null', async () => {
  const rule = ruleById('failing-tests');
  const ctx = makeCtx({
    log: 'Tests: 3 failed, 10 passed, 13 total',
    step: { command: 'npm install', kind: 'install', source: {} },
  });
  const res = rule.test(ctx);
  assert.equal(res, null);
});

test('browser-system-libs: positive case inserts npx playwright install-deps chromium', async () => {
  const rule = ruleById('browser-system-libs');
  assert.ok(rule, 'rule exists');
  const ctx = makeCtx({
    log: '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell: error while loading shared libraries\n',
    tried: new Set(),
  });
  const res = rule.test(ctx);
  assert.ok(res, 'rule should match');
  assert.equal(res.ruleId, 'browser-system-libs');
  assert.equal(res.class, 'missing-tool');
  assert.ok(res.fix);
  assert.equal(res.fix.actions[0].command, 'npx playwright install-deps chromium');
  assert.equal(res.fix.actions[0].kind, 'prereq');
});
// Real v2 run (26 Sep, final engine): przemek declares ts-jest ^27 / @types/jest ^27 but not jest; the unpinned
// `npm install --no-save jest` pulled jest 30, which crashed on node:16 ("availableParallelism is not a function").
import fsPin from 'node:fs';
import osPin from 'node:os';
import pathPin from 'node:path';
test('test-runner-undeclared pins jest to the companion major (ts-jest ^27 → jest@27)', () => {
  const root = fsPin.mkdtempSync(pathPin.join(osPin.tmpdir(), 'pin-'));
  fsPin.writeFileSync(pathPin.join(root, 'package.json'), JSON.stringify({ devDependencies: { 'ts-jest': '^27.1.1', '@types/jest': '^27.0.3' } }));
  const rule = RULES.find((r) => r.id === 'test-runner-undeclared');
  const d = rule.test({ log: 'sh: 1: jest: not found', facts: { root, files: ['package.json'], node: { deps: ['ts-jest', '@types/jest'] } }, plan: { runtime: { name: 'node', version: '16' } } });
  assert.match(d.fix.actions[0].command, /^npm install --no-save jest@27\b/);
});
test('test-runner-undeclared: no companion, old Node → a jest major that runs on it', () => {
  const root = fsPin.mkdtempSync(pathPin.join(osPin.tmpdir(), 'pin-'));
  fsPin.writeFileSync(pathPin.join(root, 'package.json'), '{}');
  const rule = RULES.find((r) => r.id === 'test-runner-undeclared');
  const d = rule.test({ log: 'sh: 1: jest: not found', facts: { root, files: ['package.json'], node: { deps: [] } }, plan: { runtime: { name: 'node', version: '16' } } });
  assert.match(d.fix.actions[0].command, /jest@29/);
  const d22 = rule.test({ log: 'sh: 1: jest: not found', facts: { root, files: ['package.json'], node: { deps: [] } }, plan: { runtime: { name: 'node', version: '22' } } });
  assert.match(d22.fix.actions[0].command, /--no-save jest$/);
});
