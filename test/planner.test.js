import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
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

test('blockCommands drops sample output pasted under a command without a prompt', () => {
  const md = parseMarkdown('```bash\necho \'{"foo":1}\' | jello\n{\n  "foo": 1,\n  "baz": [\n    1,\n    2\n  ]\n}\n_.foo = "bar"\n```\n');
  assert.deepEqual(blockCommands(md.blocks[0]).map((c) => c.text), ['echo \'{"foo":1}\' | jello']);
});

test('classify skips placeholders, hand downloads, log tails, shell customisation and publishing', () => {
  const facts = { files: [], cli: [] };
  for (const cmd of [
    'git2txt https://github.com/username/repository',
    'pip install --user ~/Downloads/please_cli*',
    'docker-compose logs -f',
    'tail -f logs/app.log',
    "echo 'please' >> ~/.bashrc",
    'set fish_greeting please',
    'pip uninstall please-cli',
    'poetry publish',
  ]) assert.ok(classify(cmd, facts).skip, `should skip: ${cmd}`);
  assert.equal(classify('docker-compose exec node npm i', facts).skip, 'container-based alternative workflow');
});

test('CLI tools: usage examples are skipped and the plan checks the installed command instead', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-cli-'));
  fs.writeFileSync(path.join(root, 'README.md'), [
    '# tool', '', '## Install', '', '### Pip (macOS, linux, unix, Windows)', '', '```bash', 'pip3 install tool', '```', '',
    '## Usage', '', '```bash', '$ cat values.yaml', '$ tool -Rr \'x\'', '```', '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "tool"\n\n[project.scripts]\ntool = "tool.cli:main"\n');
  return scout(root).then((facts) => {
    assert.deepEqual(facts.cli, ['tool']);
    const plan = buildPlan(facts, { repo: 'x/tool' });
    assert.deepEqual(plan.steps.filter((s) => !s.skip).map((s) => s.command), ['pip3 install tool', 'tool --help']);
    assert.deepEqual(plan.verify, { kind: 'command', target: 'tool --help' });
  });
});

test('shell tests like "[ -f .env ]" are commands, not sample output', () => {
  const md = parseMarkdown('```bash\n[ -f .env ] || cp .env.example .env\n[[ -d node_modules ]] || npm install\nnpm start\n```\n');
  assert.deepEqual(blockCommands(md.blocks[0]).map((c) => c.text), ['[ -f .env ] || cp .env.example .env', '[[ -d node_modules ]] || npm install', 'npm start']);
});

test('apps that ship a CLI keep the setup steps that use it', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-app-cli-'));
  fs.writeFileSync(path.join(root, 'README.md'), '# acme\n\n## Getting started\n\n```bash\nnpm install\nacme migrate\nnpm start\n```\n');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'acme', bin: { acme: 'bin/acme.js' }, scripts: { start: 'node server.js' } }));
  const plan = buildPlan(await scout(root), { repo: 'x/acme' });
  assert.deepEqual(plan.steps.filter((s) => !s.skip).map((s) => s.command), ['npm install', 'acme migrate', 'npm start']);
});

test('prose output lines under a command are not run ("App is running ...")', () => {
  const md = parseMarkdown('```bash\nnpm run dev\nApp is running ...\n\nPress CTRL + C to stop the process.\nPORT=4000 npm start\n```\n');
  assert.deepEqual(blockCommands(md.blocks[0]).map((c) => c.text), ['npm run dev', 'PORT=4000 npm start']);
});

test('announcedPort reads the port a dev server prints', async () => {
  const { announcedPort } = await import('../src/sandbox.js');
  assert.equal(announcedPort('INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)'), 8000);
  assert.equal(announcedPort('Server listening on port 4000'), 4000);
  assert.equal(announcedPort('  ➜  Local:   http://localhost:5173/'), 5173);
  assert.equal(announcedPort('Compiled successfully in 1.2s'), null);
});

test('announcedPort ignores database ports and sidecar ports (MySQL ready … port 3306)', async () => {
  const { announcedPort } = await import('../src/sandbox.js');
  const log = 'MySQL ready for connections on port 3306\nINFO: Uvicorn running on http://0.0.0.0:8000';
  assert.equal(announcedPort(log), 8000);
  assert.equal(announcedPort('[db] connected, database ready at localhost:5432\nServer listening on port 4000'), 4000);
  assert.equal(announcedPort('Redis ready, port 6379'), null);
  assert.equal(announcedPort('listening on port 6379', [6379]), null);
});

test('a project in a subfolder (backend/app/pyproject.toml) is found when the root has no manifest (vargasjona)', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-nested-'));
  fs.mkdirSync(path.join(root, 'backend', 'app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), '# api\n\n## Setup\n\n```bash\ncd backend/app/\npoetry install\n```\n');
  fs.writeFileSync(path.join(root, 'backend', 'app', 'pyproject.toml'), '[tool.poetry]\nname = "api"\n\n[tool.poetry.dependencies]\npython = ">3.9,<3.12"\nfastapi = "*"\n');
  fs.writeFileSync(path.join(root, 'backend', 'app', 'poetry.lock'), '');
  const facts = await scout(root);
  assert.equal(facts.projectDir, 'backend/app');
  assert.equal(facts.stack, 'python');
  assert.equal(facts.python.manager, 'poetry');
  assert.match(buildPlan(facts, { repo: 'x/api' }).image, /^python:/);
});

test('two candidate project folders: no projectDir is guessed', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-nested2-'));
  for (const d of ['api', 'web']) fs.mkdirSync(path.join(root, d));
  fs.writeFileSync(path.join(root, 'README.md'), '# mono\n');
  fs.writeFileSync(path.join(root, 'api', 'requirements.txt'), 'flask\n');
  fs.writeFileSync(path.join(root, 'web', 'package.json'), '{"name":"web"}');
  const facts = await scout(root);
  assert.equal(facts.projectDir, undefined);
});
