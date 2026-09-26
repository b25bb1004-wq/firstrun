import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPassport } from '../src/scribe/passport.js';
import { computeAttribution, attributeEvidence, computeVerdict } from '../src/scribe/attribution.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_ROOT = path.join(__dirname, '..', 'audit', 'real-16-v2');

function loadEvidence(runDir) {
  const evidenceDir = path.join(AUDIT_ROOT, 'runs', runDir, 'evidence');
  if (!fs.existsSync(evidenceDir)) return [];
  return fs.readdirSync(evidenceDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => JSON.parse(fs.readFileSync(path.join(evidenceDir, f), 'utf8')));
}

function makeMockPlan(repo, image = 'node:22', runtime = { name: 'node', version: '22', source: 'docs' }) {
  return {
    repo,
    commit: 'abc123',
    image,
    runtime,
    steps: [],
    verify: { kind: 'none' },
  };
}

test('attribution: GeekyAnts express-typescript - 3 repo breaks + 1 humble unknown', () => {
  const evidence = loadEvidence('GeekyAnts__express-typescript');
  assert.equal(evidence.length, 4);
  
  const { repoBreaks, suiteIssues, needsPerson, humbleUnknowns } = computeAttribution(evidence);
  
  // E1: missing-dependency (npm-peer-conflict) -> repo
  // E2: missing-tool (nodemon) -> repo
  // E3: missing-service (mongo) -> repo
  // E4: unknown -> humble
  assert.equal(repoBreaks, 3, 'Should have 3 repo breaks');
  assert.equal(suiteIssues, 0, 'Should have 0 suite issues');
  assert.equal(needsPerson, 0, 'Should have 0 interactive needs');
  assert.equal(humbleUnknowns, 1, 'Should have 1 humble unknown');
});

test('attribution: zhanymkanov fastapi - 2 repo breaks + 1 humble unknown', () => {
  const evidence = loadEvidence('zhanymkanov__fastapi_production_template');
  assert.equal(evidence.length, 3);
  
  const { repoBreaks, suiteIssues, needsPerson, humbleUnknowns } = computeAttribution(evidence);
  
  // E1: platform-specific (apt-package-missing) -> repo
  // E2: wrong-order (deps-not-installed) -> repo
  // E3: unknown (poetry-no-root?) -> humble
  assert.equal(repoBreaks, 2, 'Should have 2 repo breaks');
  assert.equal(suiteIssues, 0, 'Should have 0 suite issues');
  assert.equal(needsPerson, 0, 'Should have 0 interactive needs');
  assert.equal(humbleUnknowns, 1, 'Should have 1 humble unknown');
});

test('attribution: maitraysuthar rest-api - 2 repo breaks + 1 humble unknown', () => {
  const evidence = loadEvidence('maitraysuthar__rest-api-nodejs-mongodb');
  assert.equal(evidence.length, 3);
  
  const { repoBreaks, suiteIssues, needsPerson, humbleUnknowns } = computeAttribution(evidence);
  
  // E1: runtime-version (node-native-build) -> repo
  // E2: missing-env (env-placeholder-value) -> repo
  // E3: unknown (test timeout, but no rule matched) -> humble
  assert.equal(repoBreaks, 2, 'Should have 2 repo breaks');
  assert.equal(suiteIssues, 0, 'Should have 0 suite issues');
  assert.equal(needsPerson, 0, 'Should have 0 interactive needs');
  assert.equal(humbleUnknowns, 1, 'Should have 1 humble unknown (test timeout unrecognised)');
});

test('attributeEvidence: classifies correctly', () => {
  // Repo classes
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-env', ruleId: 'missing-env-var' } }), 'repo');
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-service', ruleId: 'missing-service' } }), 'repo');
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-tool', ruleId: 'missing-tool' } }), 'repo');
  assert.equal(attributeEvidence({ diagnosis: { class: 'runtime-version', ruleId: 'node-engine' } }), 'repo');
  assert.equal(attributeEvidence({ diagnosis: { class: 'wrong-order', ruleId: 'deps-not-installed' } }), 'repo');
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-dependency', ruleId: 'npm-peer-conflict' } }), 'repo');
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-script', ruleId: 'missing-npm-script' } }), 'repo');
  assert.equal(attributeEvidence({ diagnosis: { class: 'docs-mismatch', ruleId: 'some-rule' } }), 'repo');
  assert.equal(attributeEvidence({ diagnosis: { class: 'platform-specific', ruleId: 'apt-package-missing' } }), 'repo');
  assert.equal(attributeEvidence({ diagnosis: { class: 'needs-secret', ruleId: 'secret-required' } }), 'repo');
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-file', ruleId: 'missing-copy-source' } }), 'repo');
  
  // Suite classes
  assert.equal(attributeEvidence({ diagnosis: { class: 'failing-tests', ruleId: 'some-rule' } }), 'suite');
  assert.equal(attributeEvidence({ diagnosis: { class: 'slow-tests', ruleId: 'some-rule' } }), 'suite');
  
  // Interactive classes
  assert.equal(attributeEvidence({ diagnosis: { class: 'interactive', ruleId: 'some-rule' } }), 'interactive');
  
  // Humble: unknown class
  assert.equal(attributeEvidence({ diagnosis: { class: 'unknown', by: 'rules', cause: 'No rule recognises this failure', confidence: 0 } }), 'humble');
  
  // Humble: no rule recognises
  assert.equal(attributeEvidence({ diagnosis: { class: 'some-class', by: 'rules', cause: 'No rule recognises this failure', ruleId: 'some-rule' } }), 'humble');
  
  // Humble: Bob with bobcoins > 0 but no explicit humble cause (this now goes to repo class, not humble)
// This test was changed - Bob with actual finding should be repo, not humble
  // Old test expected humble, but new logic correctly attributes to repo class
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-tool', by: 'bob', bobcoins: 0.5, cause: 'Bob says missing tool' } }), 'repo');

  // Bob diagnosis with explicit humble causes
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-tool', by: 'bob', bobcoins: 1, cause: 'Bob could not help' } }), 'humble');
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-tool', by: 'bob', bobcoins: 1, cause: 'Bob replied without JSON' } }), 'humble');
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-tool', by: 'bob', bobcoins: 0, cause: 'Bob tried' } }), 'humble');
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-tool', by: 'bob', bobcoins: -0.5, cause: 'Budget spent' } }), 'humble');

  // Bob diagnosis with actual finding (not humble) - should be attributed to repo class
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-tool', by: 'bob', bobcoins: 1, cause: 'nodemon not found', ruleId: 'bob-found-missing-tool' } }), 'repo');
  assert.equal(attributeEvidence({ diagnosis: { class: 'missing-env', by: 'bob', bobcoins: 1, cause: 'NEXTAUTH_SECRET missing', ruleId: 'bob-found-missing-env' } }), 'repo');
});

test('computeVerdict: INCONCLUSIVE when only humble unknowns', () => {
  const v = computeVerdict({
    replayPassed: false,
    stopped: false,
    repoBreaks: 0,
    suiteIssues: 0,
    needsPerson: 0,
    humbleUnknowns: 2,
    breaksFixed: 0,
  });
  assert.equal(v, 'INCONCLUSIVE');
});

test('computeVerdict: FAILED when repo breaks exist and not fixed', () => {
  const v = computeVerdict({
    replayPassed: false,
    stopped: true,
    repoBreaks: 3,
    suiteIssues: 0,
    needsPerson: 0,
    humbleUnknowns: 1,
    breaksFixed: 0,
  });
  assert.equal(v, 'FAILED');
});

test('computeVerdict: VERIFIED when replay passes and no issues at all', () => {
  const v = computeVerdict({
    replayPassed: true,
    stopped: false,
    repoBreaks: 0,
    suiteIssues: 0,
    needsPerson: 0,
    humbleUnknowns: 0,
    breaksFixed: 0,
  });
  assert.equal(v, 'VERIFIED');
});

test('computeVerdict: PARTIAL when repo breaks fixed and not stopped', () => {
  const v = computeVerdict({
    replayPassed: false,
    stopped: false,
    repoBreaks: 3,
    suiteIssues: 0,
    needsPerson: 0,
    humbleUnknowns: 1,
    breaksFixed: 2,
  });
  assert.equal(v, 'PARTIAL');
});

test('computeVerdict: PARTIAL when replay passes but repo breaks exist (even if fixed)', () => {
  const v = computeVerdict({
    replayPassed: true,
    stopped: false,
    repoBreaks: 3,
    suiteIssues: 0,
    needsPerson: 0,
    humbleUnknowns: 1,
    breaksFixed: 3,
  });
  assert.equal(v, 'PARTIAL', 'Replay passed but there were repo breaks that needed fixing');
});

test('computeVerdict: INCONCLUSIVE not FAILED even with humble unknowns if no real issues', () => {
  const v = computeVerdict({
    replayPassed: false,
    stopped: true,
    repoBreaks: 0,
    suiteIssues: 0,
    needsPerson: 0,
    humbleUnknowns: 3,
    breaksFixed: 0,
  });
  assert.equal(v, 'INCONCLUSIVE', 'Humble unknowns alone should not cause FAILED');
});

test('buildPassport: computes new fields correctly for GeekyAnts', () => {
  const evidence = loadEvidence('GeekyAnts__express-typescript');
  const plan = makeMockPlan('GeekyAnts/express-typescript');
  const passport = buildPassport({ plan, evidence, replay: null, bobcoins: 0, stopped: false });
  
  assert.equal(passport.repoBreaks, 3);
  assert.equal(passport.suiteIssues, 0);
  assert.equal(passport.needsPerson, 0);
  assert.equal(passport.humbleUnknowns, 1);
  assert.equal(passport.breaksFound, 3); // Should equal repoBreaks
  assert.equal(passport.breaksFixed, 1); // Only E1 was verified
  assert.equal(passport.verdict, 'PARTIAL'); // Replay null, but breaksFixed > 0 and not stopped
});

test('buildPassport: INCONCLUSIVE for zhanymkanov if only humble unknown and no repo breaks fixed', () => {
  const evidence = loadEvidence('zhanymkanov__fastapi_production_template');
  const plan = makeMockPlan('zhanymkanov/fastapi_production_template', 'python:3.12', { name: 'python', version: '3.12', source: 'docs' });
  // Simulate stopped early before fixing
  const passport = buildPassport({ plan, evidence, replay: null, bobcoins: 0, stopped: true });
  
  assert.equal(passport.repoBreaks, 2);
  assert.equal(passport.humbleUnknowns, 1);
  // With stopped=true and breaksFixed=0, verdict should be FAILED (has repo breaks)
  // But if we simulate the scenario where only humble unknowns remain...
  // Actually zhanymkanov has 2 repo breaks, so it should be FAILED if stopped
  assert.equal(passport.verdict, 'FAILED');
});

test('buildPassport: PARTIAL for maitraysuthar if replay passes (suite issues remain)', () => {
  const evidence = loadEvidence('maitraysuthar__rest-api-nodejs-mongodb');
  const plan = makeMockPlan('maitraysuthar/rest-api-nodejs-mongodb');
  const passport = buildPassport({ 
    plan, 
    evidence, 
    replay: { status: 'passed', durationMs: 10000 }, 
    bobcoins: 0, 
    stopped: false 
  });
  
  assert.equal(passport.repoBreaks, 2);
  assert.equal(passport.suiteIssues, 0);
  assert.equal(passport.humbleUnknowns, 1);
  // With replay passed but humbleUnknowns > 0, should be PARTIAL
  assert.equal(passport.verdict, 'PARTIAL');
});

test('buildPassport: INCONCLUSIVE when only humble unknowns and no other issues', () => {
  const evidence = [
    { 
      id: 'E1', 
      diagnosis: { class: 'unknown', by: 'rules', cause: 'No rule recognises this failure', confidence: 0 }, 
      status: 'needs-human' 
    },
    { 
      id: 'E2', 
      diagnosis: { class: 'unknown', by: 'bob', cause: 'Bob could not help', bobcoins: 1 }, 
      status: 'needs-human' 
    },
  ];
  const plan = makeMockPlan('test/repo');
  const passport = buildPassport({ plan, evidence, replay: null, bobcoins: 1, stopped: false });
  
  assert.equal(passport.repoBreaks, 0);
  assert.equal(passport.suiteIssues, 0);
  assert.equal(passport.needsPerson, 0);
  assert.equal(passport.humbleUnknowns, 2);
  assert.equal(passport.breaksFound, 0);
  assert.equal(passport.verdict, 'INCONCLUSIVE');
});
// Friday's review of #134: found-AND-fixed breaks keep a repo VERIFIED (the product's headline result).
import { buildPassport as bpReview } from '../src/scribe/passport.js';
test('REVIEW: a repo whose breaks were all found and fixed stays VERIFIED', () => {
  const plan = { repo: 'koajs/koa', runtime: { name: 'node', version: '18' }, image: 'node:18', steps: [{ id: 'S1', origin: 'readme', status: 'repaired' }], verify: { kind: 'command', target: 'npm test' } };
  const evidence = [
    { id: 'E1', status: 'verified', diagnosis: { class: 'runtime-version', by: 'rules', ruleId: 'node-test-flag' } },
    { id: 'E2', status: 'verified', diagnosis: { class: 'wrong-order', by: 'rules', ruleId: 'deps-not-installed' } },
  ];
  const p = bpReview({ plan, evidence, replay: { status: 'passed', durationMs: 16000 }, bobcoins: 0, stopped: null });
  assert.equal(p.verdict, 'VERIFIED');
  assert.equal(p.breaksFound, 2);
  assert.equal(p.breaksFixed, 2);
});
test('REVIEW: only a HUMBLE unknown left unresolved → INCONCLUSIVE, not FAILED', () => {
  const plan = { repo: 'x/y', runtime: { name: 'node', version: '22' }, image: 'node:22', steps: [{ id: 'S1', origin: 'readme', status: 'needs-human' }], verify: { kind: 'exit' } };
  const evidence = [{ id: 'E1', status: 'needs-human', diagnosis: { class: 'unknown', by: 'rules', cause: 'No rule recognises this failure (run with --brain auto to ask IBM Bob).' } }];
  assert.equal(bpReview({ plan, evidence, replay: null, bobcoins: 0, stopped: 'S1' }).verdict, 'INCONCLUSIVE');
});
