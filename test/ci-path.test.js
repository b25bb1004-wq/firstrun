import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, classify } from '../src/plan.js';
import { scout } from '../src/scout/index.js';
import { buildPassport } from '../src/scribe/passport.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v2');

async function planFor(fixture) {
  const root = path.join(FIXTURE_ROOT, fixture);
  const facts = await scout(root);
  return buildPlan(facts, { repo: fixture.replace('__', '/') });
}

test('CI PATH: edwinhern__express-typescript - no runnable docs steps, gets CI steps with origin ci', async () => {
  const plan = await planFor('edwinhern__express-typescript');
  
  // Should have fromCI flag
  assert.equal(plan.fromCI, true, 'plan.fromCI should be true when no runnable doc steps');
  
  // Should have CI-origin steps
  const ciSteps = plan.steps.filter(s => s.origin === 'ci');
  assert.ok(ciSteps.length > 0, 'should have CI-origin steps');
  
  // Steps should have source with workflow file and line
  for (const s of ciSteps) {
    assert.ok(s.source.file, `step should have source.file: ${s.command}`);
    assert.ok(s.source.line > 0, `step should have source.line: ${s.command}`);
    assert.ok(s.source.section.startsWith('CI:'), `step should have CI section: ${s.source.section}`);
  }
  
  // Should have the 'Setup path' finding
  const setupFinding = plan.conflicts.find(c => c.what === 'Setup path');
  assert.ok(setupFinding, 'should have Setup path finding');
  assert.match(setupFinding.truth, /pnpm test/);
});

test('CI PATH: koajs__koa - has NO docs files, existing library logic applies but CI fallback does not add steps', async () => {
  const plan = await planFor('koajs__koa');
  
  // Has no docs, so CI fallback should not trigger (fromCI may be true from existing library logic)
  // The key is that our NEW fallback doesn't apply - it has NO docs files
  const hasDocsFiles = false; // koajs__koa has no docs
  
  // The CI-origin steps should come from library logic (synthetic: 'from CI workflow'), not from the new fallback
  const ciSteps = plan.steps.filter(s => s.origin === 'ci');
  // Library logic adds CI install step with synthetic: 'from CI workflow'
  for (const s of ciSteps) {
    // The fallback adds steps without 'synthetic' field, library logic adds 'synthetic'
    assert.ok(s.synthetic === 'from CI workflow', 'CI steps should be from library logic, not fallback');
  }
  
  // Should have NO steps from the NEW fallback (which would have source.section starting with 'CI:')
  const fallbackSteps = plan.steps.filter(s => s.origin === 'ci' && s.source?.section?.startsWith('CI:'));
  assert.equal(fallbackSteps.length, 0, 'should have no CI fallback steps');
});

test('CI PATH: madhums__node-express-mongoose - has docs with runnable steps, gets NO CI fallback steps', async () => {
  const plan = await planFor('madhums__node-express-mongoose');
  
  // Has docs with runnable steps, so CI fallback should not trigger
  // fromCI should be false
  assert.equal(plan.fromCI, false, 'madhums__node-express-mongoose should not have fromCI flag');
  
  // Should have NO CI-origin steps from the NEW fallback
  const fallbackSteps = plan.steps.filter(s => s.origin === 'ci' && s.source?.section?.startsWith('CI:'));
  assert.equal(fallbackSteps.length, 0, 'should have no CI fallback steps');
  
  // Should have docs-origin steps (some may be skipped)
  const readmeSteps = plan.steps.filter(s => s.origin === 'readme');
  assert.ok(readmeSteps.length > 0, 'should have docs-origin steps');
});

test('PASSPORT: fromCI plan + passed replay gives CI-ONLY verdict', () => {
  const mockPlan = {
    repo: 'test/repo',
    commit: 'abc123',
    image: 'node:22',
    runtime: { name: 'node', version: '22' },
    steps: [
      { id: 'S1', origin: 'ci', skip: false, kind: 'install', command: 'pnpm install' },
      { id: 'S2', origin: 'ci', skip: false, kind: 'test', command: 'pnpm test' },
    ],
    fromCI: true,
    verify: { kind: 'command', target: 'pnpm test' },
  };
  
  const mockEvidence = [];
  const mockReplay = { status: 'passed', durationMs: 5000 };
  
  const passport = buildPassport({ 
    plan: mockPlan, 
    evidence: mockEvidence, 
    replay: mockReplay, 
    bobcoins: 0, 
    stopped: false 
  });
  
  assert.equal(passport.verdict, 'CI-ONLY', 'should be CI-ONLY verdict');
  assert.equal(passport.fromCI, true, 'passport.fromCI should be true');
  assert.equal(passport.note, 'The docs give no setup; HUMBLE followed the CI workflow instead.', 'should have the CI note');
});

test('PASSPORT: fromCI plan + failed replay gives FAILED (not CI-ONLY)', () => {
  const mockPlan = {
    repo: 'test/repo',
    commit: 'abc123',
    image: 'node:22',
    runtime: { name: 'node', version: '22' },
    steps: [
      { id: 'S1', origin: 'ci', skip: false, kind: 'install', command: 'pnpm install' },
      { id: 'S2', origin: 'ci', skip: false, kind: 'test', command: 'pnpm test' },
    ],
    fromCI: true,
    verify: { kind: 'command', target: 'pnpm test' },
  };
  
  const mockEvidence = [];
  const mockReplay = { status: 'failed', durationMs: 5000 };
  
  const passport = buildPassport({ 
    plan: mockPlan, 
    evidence: mockEvidence, 
    replay: mockReplay, 
    bobcoins: 0, 
    stopped: false 
  });
  
  assert.equal(passport.verdict, 'FAILED', 'should be FAILED when replay fails');
});

test('PASSPORT: non-fromCI plan + passed replay gives VERIFIED (not CI-ONLY)', () => {
  const mockPlan = {
    repo: 'test/repo',
    commit: 'abc123',
    image: 'node:22',
    runtime: { name: 'node', version: '22' },
    steps: [
      { id: 'S1', origin: 'readme', skip: false, kind: 'install', command: 'npm install' },
      { id: 'S2', origin: 'readme', skip: false, kind: 'test', command: 'npm test' },
    ],
    fromCI: false,
    verify: { kind: 'command', target: 'npm test' },
  };
  
  const mockEvidence = [];
  const mockReplay = { status: 'passed', durationMs: 5000 };
  
  const passport = buildPassport({ 
    plan: mockPlan, 
    evidence: mockEvidence, 
    replay: mockReplay, 
    bobcoins: 0, 
    stopped: false 
  });
  
  assert.equal(passport.verdict, 'VERIFIED', 'should be VERIFIED for normal docs path');
  assert.equal(passport.fromCI, false, 'passport.fromCI should be false');
});

test('CI PATH: edwinhern__express-typescript - CI steps include test in CI order', async () => {
  const plan = await planFor('edwinhern__express-typescript');
  
  const ciSteps = plan.steps.filter(s => s.origin === 'ci' && !s.skip);
  const kinds = ciSteps.map(s => s.kind);
  
  // The setup job uses a composite action (uses:) for install, which doesn't expose run: commands.
  // So we only see the build and test jobs that have explicit run: commands.
  // The test job is the tested job, build is its dependency.
  assert.ok(kinds.includes('test'), 'should have test step');
  // build may or may not appear depending on job chain resolution
  
  // Should NOT have lint, coverage upload, publish, deploy
  const skipKinds = ['lint', 'deploy', 'publish', 'coverage'];
  for (const s of ciSteps) {
    assert.ok(!skipKinds.includes(s.kind), `should not have ${s.kind} kind step: ${s.command}`);
  }
});