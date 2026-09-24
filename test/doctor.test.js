import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnose, validateBobFix } from '../src/doctor/index.js';
import { scout } from '../src/scout/index.js';
import { buildPlan } from '../src/plan.js';
import { extractJson } from '../src/brain/bob.js';
import { applyPatchOps } from '../src/patches.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const acme = path.join(here, '..', 'examples', 'acme-shop');
const notes = path.join(here, '..', 'examples', 'notes-api-py');

async function ctxFor(root, stepCmd, log, extra = {}) {
  const facts = await scout(root);
  const plan = buildPlan(facts);
  const step = plan.steps.find((s) => s.command === stepCmd) || { id: 'S99', command: stepCmd, kind: 'other', source: {} };
  return { step, attempt: { out: log, exitCode: 1 }, log, facts, plan, sandbox: { services: [] }, tried: new Set(), sandboxEnv: {}, ...extra };
}

// Error lines below are exactly what the demo repos print (see examples/ANSWER_KEY.md).
const cases = [
  [acme, 'npm install', 'npm ERR! code EBADENGINE\nnpm ERR! engine Unsupported engine\nnpm ERR! notsup Required: {"node":">=20"}\nnpm ERR! notsup Actual:   {"npm":"8.19.4","node":"v16.20.2"}', 'runtime-version', /node:20/],
  [acme, 'cp .env.sample .env', "cp: cannot stat '.env.sample': No such file or directory", 'missing-file', /cp \.env\.example \.env/],
  [acme, 'npm run migrate', 'npm error Missing script: "migrate"\nnpm error\nnpm error To see a list of scripts, run:', 'missing-script', /npm run db:migrate/],
  [acme, 'npm run db:migrate', 'Error: Missing required environment variable SESSION_SECRET\n    at required (/workspace/src/config.js:13:11)', 'missing-env', /SESSION_SECRET/],
  [acme, 'npm run dev', 'Failed to start acme-shop: ReconnectStrategyError: connect ECONNREFUSED 127.0.0.1:6379', 'missing-service', /redis/],
  [notes, 'pip install -r requirements/dev.txt', "ERROR: Could not open requirements file: [Errno 2] No such file or directory: 'requirements/dev.txt'", 'missing-file', /requirements-dev\.txt/],
  [notes, 'python app.py', "python: can't open file '/workspace/app.py': [Errno 2] No such file or directory", 'missing-file', /uvicorn notes_api\.main:app/],
  [notes, 'uvicorn notes_api.main:app --port 8000', "ImportError: cannot import name 'Self' from 'typing' (/usr/local/lib/python3.8/typing.py)", 'runtime-version', /python:3\.12/],
  [notes, 'uvicorn notes_api.main:app --port 8000', 'RuntimeError: Missing required environment variable NOTES_API_TOKEN', 'missing-env', /NOTES_API_TOKEN/],
];

for (const [root, cmd, log, cls, expect] of cases) {
  test(`rules: ${path.basename(root)} · ${cls} · ${cmd}`, async () => {
    const ctx = await ctxFor(root, cmd, log);
    const { diagnosis, fix } = await diagnose(ctx, { brain: 'rules' });
    assert.equal(diagnosis.class, cls, diagnosis.cause);
    assert.equal(diagnosis.by, 'rules');
    assert.match(JSON.stringify(fix), expect);
  });
}

test('rules decline what they do not understand', async () => {
  const ctx = await ctxFor(acme, 'npm run dev', 'Segmentation fault (core dumped)');
  const { diagnosis, fix } = await diagnose(ctx, { brain: 'rules' });
  assert.equal(diagnosis.class, 'unknown');
  assert.equal(fix, null);
});

test('Bob replies are parsed and validated defensively', () => {
  const reply = 'Here you go:\n```json\n{"class":"missing-tool","cause":"make is not installed","confidence":0.8,"fix":{"actions":[{"type":"exec","command":"apt-get install -y make"},{"type":"exec","command":"rm -rf /"}],"doc":{"kind":"prerequisite","text":"make"}}}\n```';
  const v = validateBobFix(extractJson(reply));
  assert.equal(v.ok, true);
  assert.equal(v.fix.actions.length, 1, 'destructive command must be dropped');
  assert.equal(validateBobFix({ class: 'x', fix: { actions: [{ type: 'teleport' }] } }).ok, false);
});

test('patch ops: env append is idempotent, compose add keeps existing services', () => {
  const env = applyPatchOps('A=1\n', [{ op: 'append-env', key: 'B', value: '2' }, { op: 'append-env', key: 'B', value: '3' }]);
  assert.equal(env.match(/^B=/gm).length, 1);
  const compose = applyPatchOps('services:\n  db:\n    image: postgres:16 # keep me\n', [{ op: 'compose-add-service', name: 'redis', image: 'redis:7-alpine', port: 6379 }]);
  assert.match(compose, /# keep me/);
  assert.match(compose, /redis:\n\s+image: redis:7-alpine/);
});

test('unknown failures go to IBM Bob (Bob Shell headless), and its fix is validated', async () => {
  process.env.FIRSTRUN_BOB_JS = path.join(here, 'fixtures', 'fake-bob.js');
  const { bobStatus } = await import('../src/brain/bob.js');
  await bobStatus({ force: true });
  const ctx = await ctxFor(acme, 'npm run build:native', 'make: not a recognised build system here (exit 2)');
  const spent = [];
  const { diagnosis, fix } = await diagnose(ctx, { brain: 'auto', bobBudget: { perCall: 1, remaining: () => 5, spend: (x) => spent.push(x) } });
  assert.equal(diagnosis.by, 'bob');
  assert.equal(diagnosis.class, 'missing-tool');
  assert.equal(diagnosis.bobcoins, 0.42);
  assert.deepEqual(spent, [0.42]);
  assert.equal(fix.actions[0].command, 'apt-get install -y make');
  delete process.env.FIRSTRUN_BOB_JS;
});
