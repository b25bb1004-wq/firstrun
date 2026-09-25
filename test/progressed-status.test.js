import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPassport } from '../src/scribe/passport.js';
import { renderReport } from '../src/scribe/report.js';

// GeekyAnts shape: the nodemon fix cleared "nodemon: not found", then the same step failed on the
// app not answering (E3). That fix worked and must not be reported as "fix did not work".
const plan = {
  repo: 'demo/two-errors', commit: 'abc', image: 'node:22', runtime: { name: 'node', version: '22' },
  verify: { kind: 'http', target: 'http://localhost:4040/' },
  steps: [{ id: 'S1', command: 'npm run dev', origin: 'readme', status: 'failed', source: { file: 'README.md', line: 148 } }],
};
const ev = (id, status, extra = {}) => ({
  id, stepId: 'S1', status,
  before: { command: 'npm run dev', exitCode: 1, logTail: 'err' },
  diagnosis: { class: 'missing-tool', cause: `cause ${id}`, confidence: 0.85, ruleId: 'missing-tool' },
  fix: { actions: [], doc: { kind: 'prerequisite', text: 'npm install --global nodemon' }, log: '' },
  after: { command: 'npm run dev', exitCode: 1, logTail: 'next err' },
  ...extra,
});
const evidence = [ev('E2', 'progressed', { revealed: 'E3' }), ev('E3', 'failed')];
const passport = buildPassport({ plan, evidence, replay: { status: 'failed' } });

test('progressed fix is not counted as fixed', () => {
  assert.equal(passport.breaksFound, 2);
  assert.equal(passport.breaksFixed, 0);
});

test('report says a progressed fix worked and links the error it revealed', () => {
  const md = renderReport({ passport, plan, evidence, conflicts: [] });
  const e2 = md.slice(md.indexOf('### E2'), md.indexOf('### E3'));
  assert.match(e2, /\*\*Result:\*\* worked: cleared this error, then the step failed on a later problem \(\[E3\]\(#e3\)\)/);
  assert.doesNotMatch(e2, /fix did not work/);
  const e3 = md.slice(md.indexOf('### E3'));
  assert.match(e3, /\*\*Result:\*\* fix did not work/);
});

test('progressed without a revealed link still renders cleanly', () => {
  const md = renderReport({ passport, plan, evidence: [ev('E2', 'progressed')], conflicts: [] });
  assert.match(md, /\*\*Result:\*\* worked: cleared this error, then the step failed on a later problem\n/);
});
