import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
import path from 'node:path';
import { classify, buildPlan } from '../src/plan.js';
import { scout } from '../src/scout/index.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'fr-k10-')); }

// ── 1. Self-install (koajs/koa) ───────────────────────────────────────────────
// README says `npm install koa`; running that inside the koa repo fails with
// ENOSELF.  classify() must skip it when facts.selfName matches.

test('classify skips npm install <own-name>', () => {
  const facts = { selfName: 'koa' };
  assert.match(classify('npm install koa', facts).skip, /published package/);
  assert.match(classify('npm i koa', facts).skip, /published package/);
  assert.match(classify('yarn add koa', facts).skip, /published package/);
  assert.match(classify('pnpm add koa', facts).skip, /published package/);
  // versioned form: npm install koa@2.x
  assert.match(classify('npm install koa@2.x', facts).skip, /published package/);
  // different name → must NOT skip
  assert.ok(!classify('npm install express', facts).skip?.includes('published'));
  // npm install (no args) → not skipped, it's a normal install
  assert.equal(classify('npm install', { selfName: 'koa' }).kind, 'install');
});

test('classify skips pip install <own-name> (normalised)', () => {
  const facts = { selfName: 'my-tool' };
  assert.match(classify('pip install my-tool', facts).skip, /published package/);
  // underscore/hyphen normalisation
  assert.match(classify('pip install my_tool', facts).skip, /published package/);
  assert.match(classify('pip3 install my-tool==1.2.3', facts).skip, /published package/);
  // different package → not skipped
  assert.ok(!classify('pip install flask', facts).skip?.includes('published'));
});

test('buildPlan: self-install block is skipped in the plan (koa-style)', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# koa', '', '## Installation', '',
    '```bash', 'npm install koa', '```', '',
    '## Getting started', '',
    '```bash', 'npm install', 'npm test', '```',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'koa', scripts: { test: 'mocha' } }));
  const plan = buildPlan(await scout(root));
  const skipped = plan.steps.filter((s) => s.skip?.includes('published package'));
  assert.ok(skipped.length >= 1, 'npm install koa should be skipped');
  // The plain `npm install` (no args) must still be an active install step
  const active = plan.steps.filter((s) => !s.skip).map((s) => s.command);
  assert.ok(active.includes('npm install'), 'npm install (no args) should remain active');
});

// ── 2. Scaffolding block (expressjs/express Quick Start) ──────────────────────
// The Quick Start runs `npx express-generator@4 /tmp/foo && cd /tmp/foo` then
// `npm install` / `npm start` inside the generated folder.  All commands in
// any block that contains a scaffolder are skipped.

test('classify does not skip plain npm install (no scaffolder role)', () => {
  // Sanity check: classify itself does not know about scaffolding — buildPlan does.
  assert.equal(classify('npm install').kind, 'install');
});

test('buildPlan: scaffolder block is skipped entirely', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# express', '', '## Quick Start', '',
    '```bash',
    'npx express-generator@4 /tmp/foo',
    'cd /tmp/foo',
    'npm install',
    'npm start',
    '```', '',
    '## Installation', '',
    '```bash', 'npm install', '```',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'express', scripts: { test: 'mocha' } }));
  const plan = buildPlan(await scout(root));
  const scaffoldSkipped = plan.steps.filter((s) => s.skip?.includes('scaffolds a new app'));
  assert.ok(scaffoldSkipped.length >= 2, 'all commands in a scaffolder block must be skipped');
  // Sanity: commands from a non-scaffolder block still appear
  const active = plan.steps.filter((s) => !s.skip).map((s) => s.command);
  assert.ok(active.some((c) => c === 'npm install'), 'npm install in a non-scaffolder block stays');
});

// ── 3. Vagrant alternative (wagtail/bakerydemo) ───────────────────────────────
// bakerydemo offers Vagrant, Docker and virtualenv.  vagrant commands must be
// skipped with "VM-based alternative workflow".

test('classify skips vagrant commands', () => {
  for (const cmd of ['vagrant up', 'vagrant ssh', 'vagrant provision', 'vagrant halt']) {
    assert.match(classify(cmd).skip, /VM-based alternative workflow/, `should skip: ${cmd}`);
  }
  // vagrant status (not in the list) passes through without a skip
  assert.ok(!classify('vagrant status').skip?.includes('VM-based'));
});

test('buildPlan: vagrant section is dropped when a non-vagrant path exists (bakerydemo-style)', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# bakerydemo', '',
    '## Setup with Vagrant', '',
    '```bash', 'vagrant up', 'vagrant ssh', '```', '',
    '## Setup with virtualenv', '',
    '```bash', 'pip install -r requirements/dev.txt', 'python manage.py migrate', '```',
  ].join('\n'));
  fs.mkdirSync(path.join(root, 'requirements'), { recursive: true });
  fs.writeFileSync(path.join(root, 'requirements', 'dev.txt'), 'django\n');
  fs.writeFileSync(path.join(root, 'manage.py'), '');
  const plan = buildPlan(await scout(root));
  const active = plan.steps.filter((s) => !s.skip).map((s) => s.command);
  assert.ok(!active.some((c) => /vagrant/.test(c)), 'no vagrant command in active steps');
});

// ── 4. Live third-party tests (hackathon-starter) ─────────────────────────────
// npm run test:e2e:live needs real API accounts and must be skipped.

test('classify skips scripts with :live or -live', () => {
  assert.match(classify('npm run test:e2e:live').skip, /live third-party/);
  assert.match(classify('yarn run test:e2e:live').skip, /live third-party/);
  assert.match(classify('pnpm run integration-live').skip, /live third-party/);
  // regular test scripts must NOT be skipped here
  assert.equal(classify('npm run test').kind, 'test');
  assert.equal(classify('npm test').kind, 'test');
});

// ── 5. Node CLI probe via `node <bin>` (hagopj13/node-express-boilerplate) ─────
// After `yarn install` the CLI bin is not on PATH; we must run
// `node ./src/index.js --help` (or whatever bin the package.json declares).

test('buildPlan: Node CLI probe uses `node <bin>` not `<cli> --help`', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# myapp', '', '## Install', '',
    '```bash', 'npm install', '```', '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'myapp',
    bin: { myapp: './bin/myapp.js' },
    scripts: {},
  }));
  const plan = buildPlan(await scout(root));
  const probe = plan.steps.find((s) => s.probe && s.synthetic);
  assert.ok(probe, 'synthetic probe step should be generated');
  assert.match(probe.command, /^node\s+/, 'probe should use `node <bin>` for Node projects');
  assert.match(probe.command, /myapp\.js/, 'probe should include the bin path');
});

test('buildPlan: Node CLI probe with string bin uses the path directly', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# mypkg', '', '## Install', '',
    '```bash', 'npm install', '```', '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'mypkg',
    bin: './cli.js',    // string form: bin name = package name
    scripts: {},
  }));
  const plan = buildPlan(await scout(root));
  const probe = plan.steps.find((s) => s.probe && s.synthetic);
  assert.ok(probe, 'synthetic probe step should be generated');
  assert.match(probe.command, /^node\s+\.\/cli\.js/, 'string bin form should resolve to node path');
});
