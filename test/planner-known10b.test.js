import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildPlan, declaredRuntime} from '../src/plan.js';
import { RULES } from '../src/doctor/rules.js';
import { scout } from '../src/scout/index.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'fr-k10b-')); }
function rule(id) { return RULES.find((r) => r.id === id); }

// ── 1. express: npm install -g <pkg>-generator scaffolder detection ───────────
// "npm install -g express-generator@4" inside a block → entire block is skipped.

test('SCAFFOLDER_RE: npm install -g <foo>-generator is a scaffolder block', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# express', '', '## Quick Start', '',
    '```bash',
    'npm install -g express-generator@4',
    'express /tmp/foo',
    'cd /tmp/foo',
    'npm install',
    'npm start',
    '```', '',
    '## Contributing', '',
    '```bash', 'npm install', 'npm test', '```',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'express', scripts: { test: 'mocha' } }));
  const plan = buildPlan(await scout(root));
  const scaffoldSkipped = plan.steps.filter((s) => s.skip?.includes('scaffolds a new app'));
  // All 5 commands in the Quick Start block should be skipped
  assert.ok(scaffoldSkipped.length >= 4, `expected ≥4 scaffolder-skipped steps, got ${scaffoldSkipped.length}`);
  // npm install / npm test from Contributing block stay active
  const active = plan.steps.filter((s) => !s.skip).map((s) => s.command);
  assert.ok(active.includes('npm install'), 'npm install in Contributing block must remain active');
});

test('SCAFFOLDER_RE: yarn global add create-react-app is a scaffolder block', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# myapp', '', '## Quick Start', '',
    '```bash',
    'yarn global add create-react-app',
    'create-react-app my-project',
    '```', '',
    '## Setup', '',
    '```bash', 'npm install', '```',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'myapp', scripts: {} }));
  const plan = buildPlan(await scout(root));
  const scaffoldSkipped = plan.steps.filter((s) => s.skip?.includes('scaffolds a new app'));
  assert.ok(scaffoldSkipped.length >= 1, 'yarn global add create-react-app should trigger scaffolder skip');
});

test('npm init -y is NOT a scaffolder (just writes package.json)', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# myapp', '', '## Setup', '',
    '```bash',
    'npm init -y',
    'npm install express',
    '```',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'myapp', scripts: {} }));
  const plan = buildPlan(await scout(root));
  const scaffoldSkipped = plan.steps.filter((s) => s.skip?.includes('scaffolds a new app'));
  assert.equal(scaffoldSkipped.length, 0, 'npm init -y must NOT be treated as a scaffolder');
});

test('npm init --yes is NOT a scaffolder', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# myapp', '', '## Setup', '',
    '```bash', 'npm init --yes', '```',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'myapp', scripts: {} }));
  const plan = buildPlan(await scout(root));
  const scaffoldSkipped = plan.steps.filter((s) => s.skip?.includes('scaffolds a new app'));
  assert.equal(scaffoldSkipped.length, 0, 'npm init --yes must NOT be treated as a scaffolder');
});

// ── 2. koa: "node v7.6+" is tested as written and flagged against engines ─────
// "node v7.6+" is a minimum-only statement; a newcomer installs the current LTS.

test('declaredRuntime: "node v7.6+" returns minimum=true', () => {
  const r = declaredRuntime('requires node v7.6+ to run', 'node');
  assert.ok(r, 'should find a version');
  assert.equal(r.version, '7');
  assert.equal(r.minimum, true);
});

test('declaredRuntime: "use Node 16" returns minimum=false', () => {
  const r = declaredRuntime('Please use Node 16 for this project', 'node');
  assert.ok(r);
  assert.equal(r.version, '16');
  assert.equal(r.minimum, false);
});

test('declaredRuntime: "Node.js >= 18" returns minimum=true', () => {
  const r = declaredRuntime('Requires Node.js >= 18', 'node');
  assert.ok(r);
  assert.equal(r.minimum, true);
});

test('buildPlan: "node v7.6+" is tested as written (Node 7) and flagged against engines >= 18 (koa); the Doctor rebases', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# koa', '', '## Requires', '',
    'Requires node v7.6+ to run.', '',
    '## Running tests', '',
    '```bash', 'npm test', '```',
  ].join('\n'));
  // engines ">= 18" is the truth
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'koa', scripts: { test: 'node --test' }, engines: { node: '>= 18' },
  }));
  const plan = buildPlan(await scout(root));
  // A newcomer who installs exactly what the docs say is who a stale README breaks (acme-shop's seeded "16+" works the same way).
  assert.equal(plan.image, 'node:7');
  const c = plan.conflicts.find((x) => x.what === 'Node.js version');
  assert.ok(c, 'docs minimum below engines is a conflict');
  assert.match(c.truth, /18/);
});

// ── 3. Doctor rule: node-test-flag ────────────────────────────────────────────
// "node: bad option: --test" in log → fix to Node 18+

test('doctor node-test-flag: fires on "node: bad option: --test"', () => {
  const r = rule('node-test-flag');
  const log = 'npm info lifecycle koa@3.2.1~test: koa@3.2.1\nnode: bad option: --test\nnpm ERR! Test failed.';
  const plan = { runtime: { name: 'node', version: '7' } };
  const facts = { node: { truth: null } };
  const result = r.test({ log, facts, plan, step: {} });
  assert.ok(result, 'rule should fire');
  assert.equal(result.ruleId, 'node-test-flag');
  assert.equal(result.class, 'runtime-version');
  const rebase = result.fix.actions.find((a) => a.type === 'rebase');
  assert.ok(rebase, 'fix should include a rebase action');
  assert.ok(Number(rebase.runtime.version) >= 18, `target version must be >= 18, got ${rebase.runtime.version}`);
});

test('doctor node-test-flag: does NOT fire when runtime is already >= 18', () => {
  const r = rule('node-test-flag');
  const log = 'node: bad option: --test';
  const plan = { runtime: { name: 'node', version: '22' } };
  const facts = { node: {} };
  assert.equal(r.test({ log, facts, plan, step: {} }), null, 'should not fire when already on a sufficient version');
});

test('doctor node-test-flag: does NOT fire for unrelated errors', () => {
  const r = rule('node-test-flag');
  const log = 'Error: Cannot find module express';
  const plan = { runtime: { name: 'node', version: '7' } };
  const facts = { node: {} };
  assert.equal(r.test({ log, facts, plan, step: {} }), null, 'should not fire for unrelated errors');
});

// ── 4. fastapi/full-stack: dual-stack → pick Python image when uv is first ────

test('buildPlan: dual-stack repo with uv as first install → Python image', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), '# project\n\nSee development.md\n');
  fs.writeFileSync(path.join(root, 'development.md'), [
    '# Dev', '', '## Local Development', '',
    '```bash',
    'uv sync',
    'bun install',
    '```',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'frontend', scripts: { dev: 'bun run dev' } }));
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "backend"\n\n[tool.uv]\n');
  fs.writeFileSync(path.join(root, 'uv.lock'), '');
  const plan = buildPlan(await scout(root));
  assert.equal(plan.runtime.name, 'python', `expected python runtime, got ${plan.runtime.name}`);
  assert.ok(plan.image.startsWith('python:'), `expected python: image, got ${plan.image}`);
  // Should note the secondary (Node.js) stack in conflicts
  const nodeConflict = plan.conflicts.find((c) => c.what === 'Node.js stack');
  assert.ok(nodeConflict, 'should record Node.js stack conflict for dual-stack repo');
});

test('buildPlan: dual-stack repo with npm as first install → Node image', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# project', '', '## Setup', '',
    '```bash',
    'npm install',
    'uv sync',
    '```',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'web', scripts: {} }));
  fs.writeFileSync(path.join(root, 'requirements.txt'), 'flask\n');
  const plan = buildPlan(await scout(root));
  assert.equal(plan.runtime.name, 'node', `expected node runtime, got ${plan.runtime.name}`);
  assert.ok(plan.image.startsWith('node:'), `expected node: image, got ${plan.image}`);
  const pyConflict = plan.conflicts.find((c) => c.what === 'Python stack');
  assert.ok(pyConflict, 'should record Python stack conflict for dual-stack repo');
});

// ── 5. Python self-install reads pyproject.toml [project] name ────────────────

test('buildPlan: pip install <own-pyproject-name> is skipped', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# mylib', '', '## Install', '',
    '```bash', 'pip install mylib', '```', '',
    '## Development', '',
    '```bash', 'pip install -e .', '```',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "mylib"\n');
  fs.writeFileSync(path.join(root, 'requirements.txt'), 'requests\n');
  const plan = buildPlan(await scout(root));
  const selfSkip = plan.steps.filter((s) => s.skip?.includes('published package'));
  assert.ok(selfSkip.length >= 1, 'pip install <own-name> from pyproject [project] should be skipped');
  const active = plan.steps.filter((s) => !s.skip).map((s) => s.command);
  assert.ok(active.includes('pip install -e .'), 'editable install should still be active');
});

test('buildPlan: selfName not written back to facts object', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), '# koa\n\n## Setup\n\n```bash\nnpm install\n```\n');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'koa', scripts: {} }));
  const facts = await scout(root);
  assert.equal(facts.selfName, undefined, 'scout should not set selfName');
  buildPlan(facts);
  assert.equal(facts.selfName, undefined, 'buildPlan must not write selfName back to facts');
});
