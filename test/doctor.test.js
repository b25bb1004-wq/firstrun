import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnose, validateBobFix } from '../src/doctor/index.js';
import { scout } from '../src/scout/index.js';
import { buildPlan } from '../src/plan.js';
import { extractJson } from '../src/brain/bob.js';
import { applyPatchOps } from '../src/patches.js';
import { cmpVersion } from '../src/doctor/rules.js';
import { serviceKind } from '../src/doctor/services.js';

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

// ── Rules from the real-16 audit triage (#7, #9). Minimal repos in a temp dir; logs are the recorded ones. ──
function tmpRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-doc-'));
  for (const [f, body] of Object.entries(files)) fs.writeFileSync(path.join(root, f), typeof body === 'string' ? body : JSON.stringify(body));
  return root;
}
async function ctxIn(root, command, log, { kind = 'other', runtime, installed } = {}) {
  const facts = await scout(root);
  const plan = buildPlan(facts);
  if (runtime) plan.runtime = runtime;
  plan.steps = installed ? [{ id: 'S1', command: installed, kind: 'install', status: 'repaired', source: {} }] : [];
  const step = { id: 'S2', command, kind, source: {} };
  plan.steps.push(step);
  return { step, attempt: { out: log, exitCode: 1 }, log, facts, plan, sandbox: { services: [] }, tried: new Set(), history: [], sandboxEnv: {} };
}

test('a CLI the project does not depend on is a missing global tool, not a skipped install (GeekyAnts)', async () => {
  const root = tmpRepo({ 'package.json': { name: 'x', scripts: { dev: 'tsc --watch & nodemon dist' }, devDependencies: { typescript: '5.0.3' } } });
  const log = '> tsc --watch & NODE_ENV=development nodemon dist\n\nsh: 1: nodemon: not found';
  for (const installed of [undefined, 'npm install --legacy-peer-deps']) {
    const { diagnosis, fix } = await diagnose(await ctxIn(root, 'npm run dev', log, { kind: 'serve', installed }), { brain: 'rules' });
    assert.equal(diagnosis.ruleId, 'missing-tool', diagnosis.cause);
    assert.equal(fix.actions[0].command, 'npm install --global nodemon');
  }
  const declared = tmpRepo({ 'package.json': { name: 'x', scripts: { dev: 'nodemon dist' }, devDependencies: { nodemon: '^3' } } });
  const { diagnosis } = await diagnose(await ctxIn(declared, 'npm run dev', log, { kind: 'serve' }), { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'deps-not-installed');
});

test('runtime causes say too new vs too old, and do not blame a README that names no version (teamhide)', async () => {
  const root = tmpRepo({ 'pyproject.toml': '[tool.poetry]\nname = "x"\n\n[tool.poetry.dependencies]\npython = "3.11.7"\n' });
  const log = 'The currently activated Python version 3.12.14 is not supported by the project (3.11.7).\nPoetry was unable to find a compatible version.';
  const runtime = { name: 'python', version: '3.12', source: 'docs do not say; a newcomer installs the current LTS' };
  const { diagnosis } = await diagnose(await ctxIn(root, 'poetry install', log, { kind: 'install', runtime }), { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'python-version');
  assert.match(diagnosis.cause, /too new/);
  assert.match(diagnosis.cause, /docs name no version/);
  assert.equal(cmpVersion('3.12', '3.11'), 1);
  assert.equal(cmpVersion('16', '20'), -1);
});

test('Joi "must be one of" gets a valid local value; under Jest the cause says why (przemek)', async () => {
  const root = tmpRepo({ 'package.json': { name: 'x', scripts: { test: 'jest' } } });
  const log = 'FAIL src/health.test.ts\n  Config validation error: "NODE_ENV" must be one of [production, integration, development]. \n\nTest Suites: 5 failed, 1 passed, 6 total';
  const { diagnosis, fix } = await diagnose(await ctxIn(root, 'npm test', log, { kind: 'test' }), { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'env-invalid-value');
  assert.match(diagnosis.cause, /Jest sets NODE_ENV=test/);
  assert.deepEqual(fix.actions, [{ type: 'insert-before', command: 'export NODE_ENV=development', kind: 'env' }]);
});

test('old bcrypt: straight to Node.js 16 per its compatibility table, then a human (maitraysuthar)', async () => {
  const root = tmpRepo({ 'package.json': { name: 'x', dependencies: { bcrypt: '^3.0.6' } } });
  const log = 'npm error > bcrypt@3.0.8 install\nnpm error                  from ../node_modules/nan/nan.h:53:\nnpm error /root/.cache/node-gyp/22.23.3/include/node/v8-template.h:1049:8: note: candidate';
  const on22 = await diagnose(await ctxIn(root, 'npm install', log, { kind: 'install', runtime: { name: 'node', version: '22', source: 'docs do not say' } }), { brain: 'rules' });
  assert.equal(on22.diagnosis.ruleId, 'node-native-build', on22.diagnosis.cause);
  assert.equal(on22.fix.actions[0].image, 'node:16');
  const on16 = await diagnose(await ctxIn(root, 'npm install', log.replace('22.23.3', '16.20.2'), { kind: 'install', runtime: { name: 'node', version: '16', source: 'x' } }), { brain: 'rules' });
  assert.equal(on16.diagnosis.ruleId, 'node-native-build');
  assert.equal(on16.fix, null, 'no fix FirstRun can replay: needs a human');
});

test('SMTP settings point at a local Mailpit, never a real mail server', async () => {
  assert.equal(serviceKind('axllent/mailpit'), 'mailpit');
  const root = tmpRepo({ 'package.json': { name: 'x', dependencies: { nodemailer: '^6' } } });
  const { diagnosis, fix } = await diagnose(await ctxIn(root, 'npm start', 'Error: connect ECONNREFUSED 127.0.0.1:1025\n    at TCPConnectWrap.afterConnect', { kind: 'serve' }), { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'missing-service');
  assert.equal(fix.actions[0].image, 'axllent/mailpit');
  const env = await diagnose(await ctxIn(root, 'npm start', 'Error: Missing required environment variable SMTP_HOST', { kind: 'serve' }), { brain: 'rules' });
  assert.match(JSON.stringify(env.fix), /SMTP_HOST=localhost/);
});

test('poetry run before poetry install: insert the install (zhanymkanov, found after the docker shim)', async () => {
  const root = tmpRepo({ 'pyproject.toml': '[tool.poetry]\nname = "x"\n\n[tool.poetry.dependencies]\npython = "^3.12"\nuvicorn = "*"\n', 'poetry.lock': '' });
  const log = 'poetry run uvicorn src.main:app --reload --host 0.0.0.0\nCommand not found: uvicorn\nerror: recipe `run` failed on line 12 with exit code 1';
  const { diagnosis, fix } = await diagnose(await ctxIn(root, 'just run', log, { installed: 'pip install poetry' }), { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'deps-not-installed', diagnosis.cause);
  assert.equal(fix.actions[0].command, 'poetry install');
});

test('placeholder values in .env.example: use the commented local example, patch the template (maitraysuthar)', async () => {
  const example = [
    'MONGODB_URL=YourConnectionString', '# Example Connection String:-  ', '# mongodb://127.0.0.1:27017/rest-api-nodejs-mongodb',
    '# mongodb://[MongodbHost]:[PORT]/[DatabaseName]', '', 'JWT_SECRET=YourSecret', 'EMAIL_SMTP_HOST=YourSMTPHost', '',
  ].join('\n');
  const root = tmpRepo({ 'package.json': { name: 'x', dependencies: { mongoose: '^5' } }, '.env.example': example });
  const ctx = await ctxIn(root, 'npm run dev', 'App starting error: Invalid connection string', { kind: 'serve' });
  ctx.sandboxEnv = { MONGODB_URL: 'YourConnectionString', JWT_SECRET: 'YourSecret', EMAIL_SMTP_HOST: 'YourSMTPHost' };
  const { diagnosis, fix } = await diagnose(ctx, { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'env-placeholder-value', diagnosis.cause);
  assert.deepEqual(fix.patches, [{ path: '.env.example', op: 'set-env', key: 'MONGODB_URL', value: 'mongodb://127.0.0.1:27017/rest-api-nodejs-mongodb' }]);
  const patched = applyPatchOps(example, fix.patches);
  assert.match(patched, /^MONGODB_URL=mongodb:\/\/127\.0\.0\.1:27017\/rest-api-nodejs-mongodb$/m);
  assert.match(patched, /# Example Connection String/, 'comments stay');
  assert.match(patched, /^JWT_SECRET=YourSecret$/m, 'placeholders the app did not fail on are left alone');
});

test('mail placeholder: fills all mail vars and adds Mailpit service action', async () => {
  const example = [
    'EMAIL_SMTP_HOST=YourSMTPHost', 'EMAIL_SMTP_PORT=YourSMTPPort',
    'EMAIL_SMTP_USERNAME=YourSMTPUsername', 'EMAIL_SMTP_PASSWORD=YourSMTPPassword',
    'APP_NAME=MyApp',
  ].join('\n');
  const root = tmpRepo({ 'package.json': { name: 'x', dependencies: { nodemailer: '^6' } }, '.env.example': example });
  const ctx = await ctxIn(root, 'npm start', 'Error: getaddrinfo ENOTFOUND YourSMTPHost', { kind: 'serve' });
  ctx.sandboxEnv = { EMAIL_SMTP_HOST: 'YourSMTPHost', EMAIL_SMTP_PORT: 'YourSMTPPort', EMAIL_SMTP_USERNAME: 'YourSMTPUsername', EMAIL_SMTP_PASSWORD: 'YourSMTPPassword', APP_NAME: 'MyApp' };
  const { diagnosis, fix } = await diagnose(ctx, { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'env-placeholder-value', diagnosis.cause);
  // all four mail vars patched
  const patchKeys = fix.patches.map((p) => p.key);
  assert.ok(patchKeys.includes('EMAIL_SMTP_HOST'), 'HOST patched');
  assert.ok(patchKeys.includes('EMAIL_SMTP_PORT'), 'PORT patched');
  assert.ok(patchKeys.includes('EMAIL_SMTP_USERNAME'), 'USERNAME patched');
  assert.ok(patchKeys.includes('EMAIL_SMTP_PASSWORD'), 'PASSWORD patched');
  const patchVals = Object.fromEntries(fix.patches.map((p) => [p.key, p.value]));
  assert.equal(patchVals.EMAIL_SMTP_HOST, 'localhost');
  assert.equal(patchVals.EMAIL_SMTP_PORT, '1025');
  assert.equal(patchVals.EMAIL_SMTP_USERNAME, 'dev');
  assert.ok(patchVals.EMAIL_SMTP_PASSWORD && patchVals.EMAIL_SMTP_PASSWORD !== 'YourSMTPPassword', 'password filled with a dev value');
  // non-mail placeholder left alone
  assert.ok(!patchKeys.includes('APP_NAME'), 'non-mail placeholder not touched');
  // Mailpit service action present
  const svc = fix.actions.find((a) => a.type === 'service');
  assert.ok(svc, 'service action present');
  assert.equal(svc.image, 'axllent/mailpit');
  // cause mentions local mail catcher
  assert.match(diagnosis.cause, /mail catcher/i);
  // the README tells a human to start it too, not only the sandbox
  assert.equal(fix.doc.kind, 'insert-step');
  assert.match(fix.doc.text, /mailpit/);
  assert.ok(fix.actions.some((a) => a.type === 'insert-before' && /mailpit/.test(a.command)), 'README step inserted');
  // an earlier fix already started Mailpit: no second one
  ctx.sandbox = { services: [{ name: 'mailpit', image: 'axllent/mailpit' }] };
  const again = await diagnose(ctx, { brain: 'rules' });
  assert.ok(!again.fix.actions.some((a) => a.type === 'service'), 'no duplicate Mailpit');
});

test('an exact Python pin (3.11.7) gets the exact image; python:3.11 ships 3.11.16 and Poetry rejects it (teamhide)', async () => {
  const root = tmpRepo({ 'pyproject.toml': '[tool.poetry]\nname = "x"\n\n[tool.poetry.dependencies]\npython = "3.11.7"\n' });
  const log = 'The currently activated Python version 3.11.16 is not supported by the project (3.11.7).';
  for (const version of ['3.12', '3.11']) {
    const { diagnosis, fix } = await diagnose(await ctxIn(root, 'poetry install', log, { kind: 'install', runtime: { name: 'python', version, source: 'docs do not say' } }), { brain: 'rules' });
    assert.equal(diagnosis.ruleId, 'python-version', `from ${version}: ${diagnosis.cause}`);
    assert.equal(fix.actions[0].image, 'python:3.11.7');
  }
});

test('Poetry app repos (no package dir): poetry install --no-root (teamhide, Docker)', async () => {
  const root = tmpRepo({ 'pyproject.toml': '[tool.poetry]\nname = "fastapi-boilerplate"\n\n[tool.poetry.dependencies]\npython = "3.11.7"\n' });
  const log = 'Installing the current project: fastapi-boilerplate (0.2.0)\n\nError: The current project could not be installed: No file/folder found for package fastapi-boilerplate\nIf you do not want to install the current project use --no-root.';
  const { diagnosis, fix } = await diagnose(await ctxIn(root, 'poetry install', log, { kind: 'install', runtime: { name: 'python', version: '3.11.7', source: 'x' } }), { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'poetry-no-root', diagnosis.cause);
  assert.deepEqual(fix.actions, [{ type: 'replace-step', command: 'poetry install --no-root' }]);
});

test('a sidecar gets the credentials hard-coded in config source (teamhide: mysql fastapi/fastapi)', async () => {
  const root = tmpRepo({ 'pyproject.toml': '[tool.poetry]\nname = "x"\n\n[tool.poetry.dependencies]\npython = "^3.11"\n' });
  fs.mkdirSync(path.join(root, 'core'));
  fs.writeFileSync(path.join(root, 'core', 'config.py'), 'class Config:\n    WRITER_DB_URL: str = "mysql+aiomysql://fastapi:fastapi@localhost:3306/fastapi"\n');
  const log = "sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (2003, \"Can't connect to MySQL server on 'localhost' ([Errno 111] Connection refused)\")";
  const { diagnosis, fix } = await diagnose(await ctxIn(root, 'alembic upgrade head', log, { kind: 'migrate' }), { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'missing-service', diagnosis.cause);
  assert.equal(fix.actions[0].image, 'mysql:8');
  assert.equal(fix.actions[0].env.MYSQL_USER, 'fastapi');
  assert.equal(fix.actions[0].env.MYSQL_PASSWORD, 'fastapi');
  assert.equal(fix.actions[0].env.MYSQL_DATABASE, 'fastapi');
});

test('blank env template + Joi "not allowed to be empty": local values, the app\'s own defaults, one port, Mailpit (Louis3797)', async () => {
  const root = tmpRepo({
    'package.json': { name: 'x', dependencies: { joi: '^17', nodemailer: '^6' } },
    '.env.example': 'NODE_ENV=\nPORT=\nSERVER_URL=\nACCESS_TOKEN_EXPIRE=\nMYSQL_DATABASE=\nMYSQL_ROOT_PASSWORD=\nDATABASE_URL=\nSMTP_HOST=\nSMTP_PORT=\n',
  });
  fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'config', 'config.ts'), "const s = Joi.object({\n  PORT: Joi.number().default(4000),\n  ACCESS_TOKEN_EXPIRE: Joi.string().required().default('20m'),\n  SMTP_PORT: Joi.number().default(587),\n});\n");
  const names = ['PORT', 'SERVER_URL', 'ACCESS_TOKEN_EXPIRE', 'MYSQL_DATABASE', 'MYSQL_ROOT_PASSWORD', 'DATABASE_URL', 'SMTP_HOST', 'SMTP_PORT'];
  const log = 'Error: Environment variable validation error: \n' + names.map((n) => `"${n}" is not allowed to be empty`).join('\n');
  const { diagnosis, fix } = await diagnose(await ctxIn(root, 'yarn start', log, { kind: 'serve' }), { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'env-empty-value', diagnosis.cause);
  const v = Object.fromEntries(fix.patches.map((p) => [p.key, p.value]));
  assert.equal(v.PORT, '4000');
  assert.equal(v.SERVER_URL, 'http://localhost:4000');
  assert.equal(v.ACCESS_TOKEN_EXPIRE, '20m');
  assert.equal(v.SMTP_HOST, 'localhost');
  assert.equal(v.SMTP_PORT, '1025', 'mail goes to Mailpit, not the app default 587');
  assert.equal(v.DATABASE_URL, `mysql://root:${v.MYSQL_ROOT_PASSWORD}@localhost:3306/app`);
});
