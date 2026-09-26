import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scout, makeInstallTargets } from '../src/scout/index.js';

function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-scout-'));
  for (const [f, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), body); }
  return root;
}

test('reStructuredText setup docs are listed (flask/httpie keep setup in .rst)', async () => {
  const facts = await scout(repo({ 'README.rst': 'x', 'CONTRIBUTING.rst': 'x', 'docs/contributing.rst': 'x', 'docs/api.rst': 'x', 'CHANGES.rst': 'x', 'tests/setup.rst': 'x' }));
  assert.deepEqual(facts.docsRst.sort(), ['CONTRIBUTING.rst', 'docs/contributing.rst']);
});

test('Makefile install targets come with their commands; other targets are ignored', () => {
  const mk = 'install:\n\t@pip install -e .[dev]\n\t# comment\n\t-pre-commit install\n\ntest:\n\tpytest\n\ndev-setup: venv\n\tpython -m venv .venv\nVAR := 1\n';
  assert.deepEqual(makeInstallTargets(mk), [
    { target: 'install', commands: ['pip install -e .[dev]', 'pre-commit install'] },
    { target: 'dev-setup', commands: ['python -m venv .venv'] },
  ]);
});

test('scout exposes makeInstall from the repo Makefile', async () => {
  const facts = await scout(repo({ 'README.md': '# x\n', 'Makefile': 'install:\n\tnpm ci\n' }));
  assert.deepEqual(facts.makeInstall, [{ target: 'install', commands: ['npm ci'] }]);
});
