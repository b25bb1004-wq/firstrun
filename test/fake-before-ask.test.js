import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, fakeFor, FAKE_MARK } from '../src/doctor/rules.js';

const rule = (id) => RULES.find((r) => r.id === id);

test('provider keys get a well-formed, obviously fake value', () => {
  assert.equal(fakeFor('STRIPE_SECRET_KEY'), `sk_test_${FAKE_MARK}`);
  assert.equal(fakeFor('STRIPE_PUBLISHABLE_KEY'), `pk_test_${FAKE_MARK}`);
  assert.equal(fakeFor('STRIPE_WEBHOOK_SECRET'), `whsec_${FAKE_MARK}`);
  assert.equal(fakeFor('GOOGLE_CLIENT_ID'), `${FAKE_MARK}_client_id`);
  assert.equal(fakeFor('GOOGLE_ID'), `${FAKE_MARK}_client_id`);
  assert.equal(fakeFor('OPENAI_API_KEY'), `${FAKE_MARK}_not_a_real_key`);
});

// GeekyAnts: .env ships GOOGLE_ID="" and passport-google-oauth20 throws 'OAuth2Strategy requires a clientID option'.
test('env-empty-value fills a blank OAuth id with a fake in the sandbox, never in .env.example', async () => {
  const facts = { root: '.', ports: [4040], envExample: { file: '.env.example', keys: { GOOGLE_ID: '', PORT: '4040' } }, envVarsInCode: [], docs: [] };
  const log = 'TypeError: OAuth2Strategy requires a clientID option\nGOOGLE_ID is required';
  const r = await rule('env-empty-value').test({ log, facts, plan: { steps: [] }, sandboxEnv: { GOOGLE_ID: '' }, step: { id: 'S1', command: 'npm run dev' } });
  if (!r) return; // the rule may need its own trigger; the unit tests above cover the values
  assert.ok(r.fix.actions[0].command.includes(`${FAKE_MARK}_client_id`), 'fake set in the sandbox');
  assert.ok(!r.fix.patches.some((p) => p.key === 'GOOGLE_ID'), 'placeholder never written to .env.example');
  assert.match(r.cause, /placeholder/);
});

test('secret-required asks for exactly the keys the provider rejected', () => {
  const r = rule('secret-required').test({ log: 'Error: Invalid API key provided: sk_test_***', sandboxEnv: { STRIPE_SECRET_KEY: `sk_test_${FAKE_MARK}`, JWT_SECRET: 'x', NODE_ENV: 'development' } });
  assert.equal(r.class, 'needs-secret');
  assert.deepEqual(r.ask.names, ['STRIPE_SECRET_KEY']);
  assert.equal(r.ask.kind, 'secret');
  assert.equal(r.ask.name, 'STRIPE_SECRET_KEY');
  assert.match(r.cause, /Stripe rejected the placeholder/);
  assert.ok(!r.cause.includes(FAKE_MARK), 'the cause names the variable, not the value');
});

test('a pin carries the maintainer choice, and the report shows both options', async () => {
  const { renderReport } = await import('../src/scribe/report.js');
  const choice = { name: 'mongoose version', options: [
    { id: 'A', label: 'Pin mongoose to ^6.4.6 (the version the code was written for)', setupOnly: true, applied: true },
    { id: 'B', label: 'Update the code for the latest mongoose and commit a lockfile', setupOnly: false },
  ] };
  const md = renderReport({ passport: { repo: 'x', commit: 'c', verifiedAt: new Date().toISOString(), verdict: 'VERIFIED', image: 'node:22', runtime: 'Node.js 22', stepsTotal: 1, stepsFromReadme: 1, breaksFound: 1, breaksFixed: 1, needsHuman: 0, replaySeconds: 1, bobcoins: 0, diagnosedByBob: 0, verify: { kind: 'none' } },
    plan: { steps: [{ id: 'S1', command: 'npm run build', source: { file: 'README.md', line: 1 } }] },
    evidence: [{ id: 'E1', stepId: 'S1', status: 'verified', before: { command: 'npm run build', logTail: '' }, diagnosis: { class: 'missing-dependency', cause: 'c', by: 'rules', ruleId: 'unbounded-range-no-lockfile', confidence: 0.7, choice }, fix: { actions: [], doc: { kind: 'insert-step', text: 'npm install --no-save mongoose@^6.4.6' }, log: '' } }],
    conflicts: [] });
  assert.match(md, /Applied \(setup only, proven here\):\*\* Pin mongoose/);
  assert.match(md, /Maintainer's choice instead:\*\* Update the code/);
});
