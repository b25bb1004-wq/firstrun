import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doubtfulSteps, bobReviewPlan, reviewRequest } from '../src/brain/review.js';

// Plan shaped like commander.js's (audit/known-5): the Quick Start usage lines the rules still ran.
const plan = () => ({
  repo: 'tj/commander.js', image: 'node:22',
  steps: [
    { id: 'S1', command: 'npm install', kind: 'install', source: { file: 'Readme.md', line: 20, section: 'Installation' } },
    { id: 'S2', command: 'extra --help', kind: 'other', source: { file: 'Readme.md', line: 431, section: 'Options › More configuration' } },
    { id: 'S3', command: 'program -b subcommand', kind: 'other', source: { file: 'Readme.md', line: 996, section: 'Bits and pieces' } },
    { id: 'S4', command: 'npm test', kind: 'test', source: { file: 'Readme.md', line: 60, section: 'Tests' } },
    { id: 'S5', command: 'brew install jq', kind: 'prereq', skip: 'macOS-only command', source: { file: 'Readme.md', line: 5, section: 'macOS' } },
  ],
});
const budget = (left = 1) => { let spent = 0; return { cap: () => Math.max(0, left - spent), spend: (n) => { spent += n; }, spent: () => spent, remaining: () => left - spent }; };

test('only lines the rules cannot vouch for are asked about', () => {
  const p = plan();
  assert.deepEqual(doubtfulSteps(p).map((s) => s.id), ['S2', 'S3']);
  assert.match(reviewRequest(p, doubtfulSteps(p)), /S2 ASK `extra --help`/);
  assert.doesNotMatch(reviewRequest(p, doubtfulSteps(p)), /S1 ASK/);
});

test("Bob's skips are applied, capped at 0.2 Bobcoins, and he can only skip what he was asked about", async () => {
  const p = plan();
  let asked;
  const fakeBob = async (req) => { asked = req; return { ok: true, bobcoins: 0.07, json: { decisions: [
    { id: 'S2', run: false, reason: 'usage example for users of commander' },
    { id: 'S3', run: false, reason: 'usage example' },
    { id: 'S1', run: false, reason: 'tries to skip a step it was not asked about' },
    { id: 'S4', run: true },
  ] } }; };
  const b = budget(1);
  const r = await bobReviewPlan({ plan: p, facts: { root: '.' }, budget: b, askBob: fakeBob });
  assert.equal(asked.maxCost, 0.2);
  assert.deepEqual(r.skipped.map((s) => s.id), ['S2', 'S3']);
  assert.equal(p.steps[0].skip, undefined, 'S1 was not asked about: untouched');
  assert.match(p.steps[1].skip, /^IBM Bob: usage example/);
  assert.equal(b.spent(), 0.07);
});

test('no doubtful lines: Bob still reviews the plan (reasons, missing prerequisites) but may skip nothing', async () => {
  const p = plan(); p.steps = p.steps.filter((s) => !['S2', 'S3'].includes(s.id));
  const target = p.steps.find((s) => !s.skip);
  const reply = { ok: true, bobcoins: 0.06, json: {
    decisions: p.steps.map((s) => ({ id: s.id, run: false, reason: 'installs the dependencies' })),
    missing: [{ what: 'Redis must be running', evidence: 'docker-compose.yml:9' }, { what: 'no evidence given' }],
  } };
  const r = await bobReviewPlan({ plan: p, facts: {}, budget: budget(1), askBob: async () => reply });
  assert.equal(r.asked, 0, 'nothing was doubtful');
  assert.equal(r.skipped.length, 0, 'Bob cannot skip a step he was not asked about');
  assert.equal(target.skip ?? false, false);
  assert.equal(target.bobWhy, undefined, 'a step Bob wanted skipped gets no endorsement as its why');
  assert.deepEqual(r.missing, [{ what: 'Redis must be running', evidence: 'docker-compose.yml:9' }], 'only prerequisites with file:line evidence');
});

test('Bob\'s reasons become the why of steps he keeps', async () => {
  const p = plan(); p.steps = p.steps.filter((s) => !['S2', 'S3'].includes(s.id));
  const keep = p.steps.find((s) => !s.skip);
  const r = await bobReviewPlan({ plan: p, facts: {}, budget: budget(1), askBob: async () => ({ ok: true, bobcoins: 0.05, json: { decisions: [{ id: keep.id, run: true, reason: 'installs the backend packages' }] } }) });
  assert.equal(r.ok, true);
  assert.equal(keep.bobWhy, 'installs the backend packages');
});

test('a bad or empty reply changes nothing', async () => {
  const p = plan();
  const r = await bobReviewPlan({ plan: p, facts: {}, budget: budget(1), askBob: async () => ({ ok: false, error: 'Bob replied without JSON', bobcoins: 0.05 }) });
  assert.equal(r.ok, false);
  assert.ok(p.steps.every((s) => !s.skip || s.id === 'S5'));
});

test('no budget left: not called', async () => {
  const r = await bobReviewPlan({ plan: plan(), facts: {}, budget: budget(0.01), askBob: async () => { throw new Error('must not be called'); } });
  assert.equal(r.ok, false);
});
