import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMarkdown, blockCommands, isShellBlock } from '../src/markdown.js';
import { classify, declaredRuntime, buildPlan } from '../src/plan.js';
import { scout } from '../src/scout/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.join(here, '..', 'examples');

test('blockCommands strips prompts, output lines, comments and continuations', () => {
  const md = parseMarkdown([
    '## Setup', '```console', '$ npm install', 'added 92 packages', '$ cp .env.example \\', '    .env', '# a comment', '$ npm run dev # starts the server', '```',
  ].join('\n'));
  const cmds = blockCommands(md.blocks[0]).map((c) => c.text);
  assert.deepEqual(cmds, ['npm install', 'cp .env.example .env', 'npm run dev']);
});

test('"> " is treated as a prompt only when every line uses it', () => {
  const md = parseMarkdown(['## Run', '```', '> poetry install', '> alembic upgrade head', '```'].join('\n'));
  assert.ok(isShellBlock(md.blocks[0]));
  assert.deepEqual(blockCommands(md.blocks[0]).map((c) => c.text), ['poetry install', 'alembic upgrade head']);
});

test('classify recognises the kinds of setup steps', () => {
  assert.equal(classify('npm ci').kind, 'install');
  assert.equal(classify('docker compose up -d db').kind, 'services');
  assert.equal(classify('cp .env.example .env').kind, 'env');
  assert.equal(classify('npm run db:migrate').kind, 'migrate');
  assert.equal(classify('npm run dev').kind, 'serve');
  assert.equal(classify('uvicorn app.main:app --reload').kind, 'serve');
  assert.equal(classify('pytest -q').kind, 'test');
  assert.match(classify('git clone https://x/y.git').skip, /clone/);
  assert.match(classify('brew install postgresql').skip, /macOS/);
  assert.match(classify('yarn test:watch').skip, /tooling/);
  assert.match(classify('poetry shell').skip, /subshell/);
});

test('declaredRuntime reads the version the docs tell a newcomer to install', () => {
  assert.equal(declaredRuntime('- Node.js 16+\n', 'node').version, '16');
  assert.equal(declaredRuntime('Requires Python 3.8 or higher', 'python').version, '3.8');
  assert.equal(declaredRuntime('Built on node streams', 'node'), null);
});

test('acme-shop: planner finds every drift statically', async () => {
  const facts = await scout(path.join(examples, 'acme-shop'));
  const plan = buildPlan(facts);
  assert.equal(plan.image, 'node:16');
  assert.equal(plan.verify.target, 'http://127.0.0.1:3000/health');
  const what = plan.conflicts.map((c) => c.what);
  for (const w of ['Node.js version', 'file .env.sample', 'npm script "migrate"', 'env var SESSION_SECRET', 'redis service']) {
    assert.ok(what.includes(w), `expected conflict "${w}" in ${JSON.stringify(what)}`);
  }
  assert.deepEqual(plan.steps.filter((s) => !s.skip).map((s) => s.kind), ['install', 'env', 'services', 'migrate', 'migrate', 'serve', 'test']);
});

test('notes-api-py: planner finds the Python drifts statically', async () => {
  const plan = buildPlan(await scout(path.join(examples, 'notes-api-py')));
  assert.equal(plan.image, 'python:3.8');
  const what = plan.conflicts.map((c) => c.what);
  for (const w of ['Python version', 'file requirements/dev.txt', 'file app.py', 'env var NOTES_API_TOKEN']) assert.ok(what.includes(w), w);
});
