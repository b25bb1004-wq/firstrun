// test/dock-state.test.js — new file. Do not edit existing test files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduce, charactersFor } from '../src/dock-state.js';

function applyAll(target, agent, events) {
  return events.reduce((s, ev) => reduce(s, ev), initialState(target, agent));
}

// ── Fixture: a full run (scout → plan → runner → doctor → verifier → scribe → done) ──
const FULL_RUN_EVENTS = [
  { type: 'phase',      agent: 'scout',    data: { phase: 'scout' } },
  { type: 'facts',      agent: 'scout',    data: { stack: 'node', node: '20', python: null, docs: 1, services: 0 } },
  { type: 'phase',      agent: 'planner',  data: { phase: 'plan' } },
  { type: 'plan',       agent: 'planner',  data: { image: 'node:20', steps: [{ id: 'S1', command: 'npm install' }, { id: 'S2', command: 'npm test' }], conflicts: [{ what: 'c1' }, { what: 'c2' }] } },
  { type: 'step.start', agent: 'runner',   data: { stepId: 'S1', command: 'npm install' } },
  { type: 'step.end',   agent: 'runner',   data: { stepId: 'S1', command: 'npm install', exitCode: 1, status: 'failed' } },
  { type: 'phase',      agent: 'doctor',   data: { phase: 'repair' } },
  { type: 'diagnosis',  agent: 'doctor',   data: { stepId: 'S1', diagnosis: { cause: 'wrong node version', class: 'runtime-version' } } },
  { type: 'evidence',   agent: 'doctor',   data: { id: 'E1', stepId: 'S1', status: 'verified' } },
  { type: 'phase',      agent: 'verifier', data: { phase: 'replay' } },
  { type: 'replay.start', agent: 'verifier', data: {} },
  { type: 'replay.end', agent: 'verifier', data: { status: 'passed', durationMs: 42000 } },
  { type: 'phase',      agent: 'scribe',   data: { phase: 'publish' } },
  { type: 'passport',   agent: 'scribe',   data: { verdict: 'VERIFIED' } },
  { type: 'done',       agent: 'swarm',    data: { verdict: 'VERIFIED' } },
];

test('full run: scout done with node info', () => {
  const s = applyAll('/repo', 'all', FULL_RUN_EVENTS);
  assert.equal(s.characters.scout.state, 'done');
  assert.match(s.characters.scout.line, /node 20/i);
});

test('full run: planner done, 2 steps 2 conflicts', () => {
  const s = applyAll('/repo', 'all', FULL_RUN_EVENTS);
  assert.equal(s.characters.planner.state, 'done');
  assert.match(s.characters.planner.line, /2 steps/);
  assert.match(s.characters.planner.line, /2 conflicts/);
});

test('full run: runner needs_you after step.end failed', () => {
  // up to the failed step only
  const s = applyAll('/repo', 'all', FULL_RUN_EVENTS.slice(0, 6));
  assert.equal(s.characters.runner.state, 'needs_you');
  assert.equal(s.characters.runner.line, 'npm install');
});

test('full run: doctor done after evidence verified', () => {
  const s = applyAll('/repo', 'all', FULL_RUN_EVENTS);
  assert.equal(s.characters.doctor.state, 'done');
});

test('full run: verifier done after replay.end passed', () => {
  const s = applyAll('/repo', 'all', FULL_RUN_EVENTS);
  assert.equal(s.characters.verifier.state, 'done');
  assert.equal(s.characters.verifier.line, 'passed');
});

test('full run: scribe done after passport', () => {
  const s = applyAll('/repo', 'all', FULL_RUN_EVENTS);
  assert.equal(s.characters.scribe.state, 'done');
});

test('full run: verdict and evidence recorded', () => {
  const s = applyAll('/repo', 'all', FULL_RUN_EVENTS);
  assert.equal(s.verdict, 'VERIFIED');
  assert.equal(s.evidence.length, 1);
  assert.equal(s.evidence[0].status, 'verified');
});

// ── needs_you cases ──

test('planner needs_you when plan has 0 runnable steps', () => {
  const s = applyAll('/repo', 'all', [
    { type: 'phase', agent: 'planner', data: { phase: 'plan' } },
    { type: 'plan',  agent: 'planner', data: { image: 'node:20', steps: [{ id: 'S1', command: 'npm install', skip: 'NO-SETUP-DOCS' }], conflicts: [] } },
  ]);
  assert.equal(s.characters.planner.state, 'needs_you');
});

test('doctor needs_you when evidence is needs-human', () => {
  const s = applyAll('/repo', 'all', [
    { type: 'phase',     agent: 'doctor', data: { phase: 'repair' } },
    { type: 'evidence',  agent: 'doctor', data: { id: 'E2', stepId: 'S1', status: 'needs-human' } },
  ]);
  assert.equal(s.characters.doctor.state, 'needs_you');
  assert.match(s.characters.doctor.line, /human/);
});

test('verifier needs_you when replay.end failed', () => {
  const s = applyAll('/repo', 'all', [
    { type: 'replay.start', agent: 'verifier', data: {} },
    { type: 'replay.end',   agent: 'verifier', data: { status: 'failed' } },
  ]);
  assert.equal(s.characters.verifier.state, 'needs_you');
  assert.equal(s.characters.verifier.line, 'failed');
});

test('scout needs_you on error', () => {
  const s = applyAll('/repo', 'all', [
    { type: 'phase', agent: 'scout', data: { phase: 'scout' } },
    { type: 'error', agent: 'scout', data: { message: 'no README found' } },
  ]);
  assert.equal(s.characters.scout.state, 'needs_you');
  assert.match(s.characters.scout.line, /README/);
});

// ── Solo doctor run ──

test('solo doctor: only doctor lights up, others stay idle', () => {
  const events = [
    { type: 'phase',    agent: 'doctor', data: { phase: 'repair' } },
    { type: 'evidence', agent: 'doctor', data: { id: 'E3', stepId: 'S1', status: 'progressed' } },
  ];
  const s = applyAll('/log', 'doctor', events);
  assert.equal(s.characters.doctor.state, 'done');
  assert.equal(s.characters.scout.state, 'idle');
  assert.equal(s.characters.runner.state, 'idle');
});

test('charactersFor returns only doctor for solo doctor agent', () => {
  assert.deepEqual(charactersFor('doctor'), ['doctor']);
});

test('charactersFor returns all agents for all', () => {
  const c = charactersFor('all');
  assert.ok(c.includes('scout'));
  assert.ok(c.includes('planner'));
  assert.ok(c.includes('verifier'));
});

// ── initialState shape ──

test('initialState has correct defaults', () => {
  const s = initialState('/my/repo', 'scout');
  assert.equal(s.target, '/my/repo');
  assert.equal(s.agent, 'scout');
  assert.equal(s.phase, null);
  assert.equal(s.verdict, null);
  assert.equal(s.bobcoins, 0);
  for (const n of ['scout', 'planner', 'runner', 'doctor', 'verifier', 'scribe', 'guide']) {
    assert.equal(s.characters[n].state, 'idle', `${n} should be idle`);
  }
});

test('reduce is pure: original state is not mutated', () => {
  const orig = initialState('/r', 'all');
  const origJson = JSON.stringify(orig);
  reduce(orig, { type: 'phase', agent: 'scout', data: { phase: 'scout' } });
  assert.equal(JSON.stringify(orig), origJson);
});
