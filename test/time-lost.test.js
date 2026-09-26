import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTimeLost, categoryOf, MINUTES_PER_BREAK } from '../src/time-lost.js';
import { flagOn } from '../src/flags.js';
import { renderReport } from '../src/scribe/report.js';

// ── helpers ───────────────────────────────────────────────────────────────────
function ev(id, cls, { by = 'rules', ruleId, status = 'verified' } = {}) {
  return { id, stepId: 'S1', diagnosis: { class: cls, by, ruleId: ruleId || cls, cause: 'x', confidence: 0.9 },
    before: { command: 'cmd', logTail: '' }, fix: null, after: null, status, at: '2024-01-01T00:00:00.000Z' };
}
const basePassport = {
  repo: 'test/repo', commit: 'abc', verifiedAt: '2024-01-01T00:00:00Z', verdict: 'VERIFIED',
  image: 'node:20', runtime: 'Node.js 20', stepsTotal: 1, stepsFromReadme: 1,
  breaksFound: 0, breaksFixed: 0, needsHuman: 0, replaySeconds: 30, bobcoins: 0,
  diagnosedByBob: 0, verify: { kind: 'command', target: 'echo ok' },
};
const basePlan = { steps: [{ id: 'S1', command: 'npm install', kind: 'install', status: 'passed', skip: false, source: { file: 'README.md', line: 5 } }] };

// ── estimateTimeLost: 0 breaks ────────────────────────────────────────────────
test('0 breaks → beforeMinutes 0, afterMinutes 0', () => {
  const r = estimateTimeLost({ evidence: [], replay: { status: 'passed' }, passport: { ...basePassport, needsHuman: 0 }, runMs: 5000 });
  assert.equal(r.beforeMinutes, 0);
  assert.equal(r.afterMinutes, 0);
  assert.equal(r.perBreak.length, 0);
  assert.equal(r.real.breaks, 0);
  assert.equal(r.real.runSeconds, 5);
});

// ── estimateTimeLost: mixed breaks, replay passed, needsHuman 0 ───────────────
test('multiple breaks, replay passed, needsHuman 0 → before = sum, after = 0; bob-diagnosed beats class', () => {
  const evidence = [
    ev('E1', 'missing-dependency'),                       // 10 min
    ev('E2', 'runtime-version'),                          // 20 min
    ev('E3', 'missing-env', { by: 'bob' }),               // 40 min (bob, not 25)
  ];
  const passport = { ...basePassport, needsHuman: 0 };
  const r = estimateTimeLost({ evidence, replay: { status: 'passed' }, passport, runMs: 0 });
  assert.equal(r.beforeMinutes, 10 + 20 + 40);
  assert.equal(r.afterMinutes, 0);
  // bob-diagnosed break is 40 even though class is missing-env (25)
  const e3 = r.perBreak.find((b) => b.id === 'E3');
  assert.equal(e3.minutes, 40);
  assert.equal(e3.category.key, 'bob-needed');
});

// ── estimateTimeLost: PARTIAL — one break still needs-human ───────────────────
test('replay passed but one break needs-human → after = that break minutes', () => {
  const evidence = [
    ev('E1', 'runtime-version', { status: 'verified' }),  // 20 min, fixed
    ev('E2', 'missing-env', { status: 'needs-human' }),   // 25 min, not fixed
  ];
  const passport = { ...basePassport, needsHuman: 1, verdict: 'PARTIAL' };
  // replay passed but needsHuman > 0 → not fully fixed
  const r = estimateTimeLost({ evidence, replay: { status: 'passed' }, passport, runMs: 0 });
  assert.equal(r.beforeMinutes, 20 + 25);
  assert.equal(r.afterMinutes, 25);  // only the unfixed break
});

// ── estimateTimeLost: afterMinutes accumulates multiple unfixed breaks ─────────
test('replay failed → after = sum of all unfixed breaks', () => {
  const evidence = [
    ev('E1', 'missing-dependency', { status: 'needs-human' }),  // 10 min, not fixed
    ev('E2', 'missing-env', { status: 'needs-human' }),          // 25 min, not fixed
  ];
  const passport = { ...basePassport, needsHuman: 2, verdict: 'FAILED' };
  const r = estimateTimeLost({ evidence, replay: { status: 'failed' }, passport, runMs: 0 });
  assert.equal(r.beforeMinutes, 35);
  assert.equal(r.afterMinutes, 35);  // both unfixed
});

// ── categoryOf: rule id 'deps-not-installed' maps to missing-dep ──────────────
test('categoryOf maps deps-not-installed rule id to missing-dep key', () => {
  const c = categoryOf(ev('E1', 'deps-not-installed', { ruleId: 'deps-not-installed' }));
  assert.equal(c.key, 'missing-dep');
  assert.equal(c.minutes, MINUTES_PER_BREAK['missing-dep'].minutes);
});

// ── categoryOf: unknown class → other ─────────────────────────────────────────
test('categoryOf maps unknown class to other', () => {
  const c = categoryOf(ev('E1', 'some-weird-thing'));
  assert.equal(c.key, 'other');
  assert.equal(c.minutes, MINUTES_PER_BREAK['other'].minutes);
});

// ── flagOn ────────────────────────────────────────────────────────────────────
test('flagOn: off by default', () => {
  delete process.env.FIRSTRUN_FLAGS;
  assert.equal(flagOn('timeLost'), false);
  assert.equal(flagOn('timeLost', {}), false);
});

test('flagOn: opts.flags array works', () => {
  delete process.env.FIRSTRUN_FLAGS;
  assert.equal(flagOn('timeLost', { flags: ['timeLost'] }), true);
  assert.equal(flagOn('timeLost', { flags: ['other'] }), false);
});

test('flagOn: opts.flags comma string works', () => {
  delete process.env.FIRSTRUN_FLAGS;
  assert.equal(flagOn('timeLost', { flags: 'timeLost,other' }), true);
  assert.equal(flagOn('timeLost', { flags: 'other' }), false);
});

test('flagOn: FIRSTRUN_FLAGS env var works', () => {
  process.env.FIRSTRUN_FLAGS = 'timeLost,something';
  assert.equal(flagOn('timeLost'), true);
  assert.equal(flagOn('other'), false);
  delete process.env.FIRSTRUN_FLAGS;
});

// ── renderReport: timeLost present ───────────────────────────────────────────
test('renderReport: with timeLost the row and section appear', () => {
  const passport = {
    ...basePassport,
    timeLost: { beforeMinutes: 35, afterMinutes: 0, estimate: true, real: { breaks: 2, runSeconds: 120, replaySeconds: 30 } },
  };
  const out = renderReport({ passport, plan: basePlan, evidence: [], firstFailure: null, conflicts: [] });
  assert.match(out, /Time lost \(estimate\)/);
  assert.match(out, /~35 min before/);
  assert.match(out, /~0 min after/);
  assert.match(out, /## Time-lost estimate/);
  assert.match(out, /tunable heuristic table/);
});

// ── renderReport: timeLost absent → output unchanged ─────────────────────────
test('renderReport: without timeLost the output does not contain Time lost', () => {
  const out = renderReport({ passport: basePassport, plan: basePlan, evidence: [], firstFailure: null, conflicts: [] });
  assert.doesNotMatch(out, /Time lost/);
  assert.doesNotMatch(out, /Time-lost estimate/);
});

test('deps-not-installed counts as a missing package even though the rule reports class wrong-order', async () => {
  const { categoryOf } = await import('../src/time-lost.js');
  assert.equal(categoryOf({ diagnosis: { by: 'rules', ruleId: 'deps-not-installed', class: 'wrong-order' } }).key, 'missing-dep');
  assert.equal(categoryOf({ diagnosis: { by: 'rules', ruleId: 'missing-migrations', class: 'wrong-order' } }).key, 'other');
});
