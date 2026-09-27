// vargasjona/fastapi-alembic-sqlmodel-async (Bob pass, 27 Sep): the plan review skipped `cd backend/app/` as an
// "editor/IDE tip", so poetry ran from the repo root; then a repair `cd backend/app && ...` ran while the shell was
// already inside backend/app ("cd: backend/app: No such file or directory").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bobReviewPlan, reviewRequest } from '../src/brain/review.js';
import * as sandbox from '../src/sandbox.js';

const plan = {
  repo: 'x/y', image: 'python:3.11',
  steps: [
    { id: 'S6', command: 'cd backend/app/', kind: 'other', source: { file: 'README.md', line: 10, section: 'Setup' } },
    { id: 'S7', command: 'poetry run uvicorn app.main:app', kind: 'other', source: { file: 'README.md', line: 11, section: 'Setup' } },
  ],
};

test('Bob may not skip a plain cd: it moves every later step', async () => {
  const fake = async () => ({ ok: true, bobcoins: 0.05, json: { decisions: [
    { id: 'S6', run: false, reason: 'editor/IDE tip only' },
    { id: 'S7', run: false, reason: 'usage example' },
  ] } });
  const rv = await bobReviewPlan({ plan: structuredClone(plan), facts: {}, budget: null, askBob: fake });
  assert.deepEqual(rv.skipped.map((s) => s.id), ['S7']);
});

test('the review prompt asks Bob to reason about the shared shell', () => {
  const req = reviewRequest(plan, plan.steps);
  assert.match(req, /ONE terminal/);
  assert.match(req, /cd backend\/app/);
});

test('a leading cd into the folder the shell is already in does not nest', () => {
  const S = Object.values(sandbox).find((v) => typeof v === 'function' && v.prototype?.wrap);
  const line = S.prototype.wrap.call({}, 'cd backend/app && poetry install').split('\n')[3];
  assert.match(line, /\$\{PWD%\/backend\/app\}/);
  assert.match(line, /&& poetry install$/);
  assert.equal(S.prototype.wrap.call({}, 'npm install').split('\n')[3], 'npm install');
  assert.equal(S.prototype.wrap.call({}, 'cd /abs && x').split('\n')[3], 'cd /abs && x', 'absolute paths are left alone');
});
