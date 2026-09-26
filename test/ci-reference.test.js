import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scout } from '../src/scout/index.js';
import { buildPlan, classify } from '../src/plan.js';
import { ciPlan } from '../src/ci-reference.js';

// Real saved docs and workflows (test/fixtures/v2), offline.
const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v2');
const planFor = async (s) => { const f = await scout(path.join(FIX, s)); return { f, p: buildPlan(f, { repo: s.replace('__', '/') }) }; };
const ciConflicts = (p) => p.conflicts.filter((c) => c.from === 'ci-reference');

test('scout records the workflow line, job and Linux-ness of each CI command', async () => {
  const f = await scout(path.join(FIX, 'expressjs__express'));
  const c = f.ci.commands.find((x) => x.run === 'npm install' && /ci\.yml$/.test(x.workflow));
  assert.equal(c.line, 71);
  assert.ok(c.job && c.linux);
});

test('the CI plan keeps only jobs that run tests (no docs builds, deploys or linters)', async () => {
  const f = await scout(path.join(FIX, 'fastapi__fastapi'));
  const ci = ciPlan(f, classify, f);
  assert.ok(!ci.some((s) => /docs|deploy|lint/i.test(s.workflow)), JSON.stringify(ci.map((s) => s.workflow)));
});

test('docs with no setup: CI\'s main tested job is the finding, cited by file:line (commander.js)', async () => {
  const { p } = await planFor('tj__commander.js');
  const c = ciConflicts(p).find((x) => x.what === 'Setup path');
  assert.equal(c.ci, '.github/workflows/tests.yml:27');
  assert.match(c.truth, /`npm ci`, `npm test`/);
});

test('docs that never install while CI does (wagtail): Install step finding', async () => {
  const { p } = await planFor('wagtail__bakerydemo');
  const c = ciConflicts(p).find((x) => x.what === 'Install step');
  assert.equal(c.ci, '.github/workflows/ci.yml:38');
  assert.match(c.truth, /uv pip install -r requirements\/development\.txt/);
});

test('uv run ./manage.py test is a test', () => {
  assert.equal(classify('uv run ./manage.py test', {}).kind, 'test');
  assert.equal(classify('poetry run pytest -x', {}).kind, 'test');
});

test('no findings when docs and CI agree (madhums: npm install + npm test on both sides)', async () => {
  const { p } = await planFor('madhums__node-express-mongoose');
  assert.deepEqual(ciConflicts(p), []);
});
