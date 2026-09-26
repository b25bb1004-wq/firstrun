import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diagnose } from '../src/doctor/index.js';
import { scout } from '../src/scout/index.js';
import { buildPlan } from '../src/plan.js';

// GeekyAnts/express-typescript build log excerpt (recorded from a clean node:22 container).
const GEEKY_LOG = [
  'src/models/User.ts(64,11): error TS2349: This expression is not callable.',
  'node_modules/mongoose/node_modules/mongodb/mongodb.d.ts(74,5): error TS2304: Cannot find name \'AsyncDisposable\'.',
].join('\n');

function tmpRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-unbounded-'));
  for (const [f, body] of Object.entries(files)) {
    const full = path.join(root, f);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}

async function ctxIn(root, command, log, { installCmd } = {}) {
  const facts = await scout(root);
  const plan = buildPlan(facts);
  plan.steps = [];
  if (installCmd) plan.steps.push({ id: 'S1', command: installCmd, kind: 'install', status: 'repaired', source: {} });
  const step = { id: 'S2', command, kind: 'build', source: {} };
  plan.steps.push(step);
  return { step, attempt: { out: log, exitCode: 1 }, log, facts, plan, sandbox: { services: [] }, tried: new Set(), history: [], sandboxEnv: {} };
}

// 1. GeekyAnts shape: mongoose >=6.4.6, no lockfile, TS error with node_modules/mongoose in log → fires.
test('unbounded-range-no-lockfile: GeekyAnts shape fires, pins to ^6.4.6', async () => {
  const root = tmpRepo({
    'package.json': { name: 'x', scripts: { build: 'tsc' }, dependencies: { mongoose: '>=6.4.6' } },
  });
  const { diagnosis, fix } = await diagnose(await ctxIn(root, 'npm run build', GEEKY_LOG), { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'unbounded-range-no-lockfile', diagnosis.cause);
  assert.equal(diagnosis.class, 'missing-dependency');
  assert.equal(diagnosis.confidence, 0.7);
  assert.equal(fix.actions[0].command, 'npm install --no-save mongoose@^6.4.6');
  assert.equal(fix.doc.kind, 'insert-step');
  assert.equal(fix.doc.text, 'npm install --no-save mongoose@^6.4.6');
  assert.match(diagnosis.cause, /mongoose/);
  assert.match(diagnosis.cause, />=6\.4\.6/);
  // BUG 1 regression: cause must NOT claim "6.x" (the floor major) as what a fresh install gets.
  assert.doesNotMatch(diagnosis.cause, /gets\s+\S+\s+6\.x/);
});

// 2. Same but package-lock.json present → no fire.
test('unbounded-range-no-lockfile: lockfile present → no fire', async () => {
  const root = tmpRepo({
    'package.json': { name: 'x', scripts: { build: 'tsc' }, dependencies: { mongoose: '>=6.4.6' } },
    'package-lock.json': '{}',
  });
  const { diagnosis } = await diagnose(await ctxIn(root, 'npm run build', GEEKY_LOG), { brain: 'rules' });
  assert.notEqual(diagnosis.ruleId, 'unbounded-range-no-lockfile', 'should not fire when lockfile exists');
});

// 3. mongoose: ^6.4.6 (bounded) → no fire.
test('unbounded-range-no-lockfile: bounded range → no fire', async () => {
  const root = tmpRepo({
    'package.json': { name: 'x', scripts: { build: 'tsc' }, dependencies: { mongoose: '^6.4.6' } },
  });
  const { diagnosis } = await diagnose(await ctxIn(root, 'npm run build', GEEKY_LOG), { brain: 'rules' });
  assert.notEqual(diagnosis.ruleId, 'unbounded-range-no-lockfile', 'should not fire for bounded range');
});

// 4. Two unbounded packages, neither in the log → no fire.
test('unbounded-range-no-lockfile: two unbounded packages, none in log → no fire', async () => {
  const log = 'src/app.ts(1,1): error TS2349: This expression is not callable.';
  const root = tmpRepo({
    'package.json': { name: 'x', scripts: { build: 'tsc' }, dependencies: { mongoose: '>=6.4.6', express: '>=4.0.0' } },
  });
  const { diagnosis } = await diagnose(await ctxIn(root, 'npm run build', log), { brain: 'rules' });
  assert.notEqual(diagnosis.ruleId, 'unbounded-range-no-lockfile', 'should not guess when multiple unbounded and none named in log');
});

// 5. mongoose: * → no fire (no floor).
test('unbounded-range-no-lockfile: wildcard range → no fire', async () => {
  const root = tmpRepo({
    'package.json': { name: 'x', scripts: { build: 'tsc' }, dependencies: { mongoose: '*' } },
  });
  const { diagnosis } = await diagnose(await ctxIn(root, 'npm run build', GEEKY_LOG), { brain: 'rules' });
  assert.notEqual(diagnosis.ruleId, 'unbounded-range-no-lockfile', 'should not fire for * (no floor to pin to)');
});

// 6. Plan install step uses --legacy-peer-deps → command includes --legacy-peer-deps.
test('unbounded-range-no-lockfile: --legacy-peer-deps propagates to the pin command', async () => {
  const root = tmpRepo({
    'package.json': { name: 'x', scripts: { build: 'tsc' }, dependencies: { mongoose: '>=6.4.6' } },
  });
  const { diagnosis, fix } = await diagnose(await ctxIn(root, 'npm run build', GEEKY_LOG, { installCmd: 'npm install --legacy-peer-deps' }), { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'unbounded-range-no-lockfile', diagnosis.cause);
  assert.equal(fix.actions[0].command, 'npm install --no-save --legacy-peer-deps mongoose@^6.4.6');
});

// 7. BUG 2 regression: `>=6.4.6 <7` is bounded → no fire.
test('unbounded-range-no-lockfile: >=6.4.6 <7 is bounded → no fire', async () => {
  const root = tmpRepo({
    'package.json': { name: 'x', scripts: { build: 'tsc' }, dependencies: { mongoose: '>=6.4.6 <7' } },
  });
  const { diagnosis } = await diagnose(await ctxIn(root, 'npm run build', GEEKY_LOG), { brain: 'rules' });
  assert.notEqual(diagnosis.ruleId, 'unbounded-range-no-lockfile', '>=X <Y is bounded, should not fire');
});

// 8. GeekyAnts real scenario: 3 unbounded deps (mongoose, passport, pug), log blames
//    src/models/User.ts which does NOT import mongoose directly but imports ../providers/Database
//    which imports mongoose → import tracing (one hop) identifies mongoose → fires with mongoose.
test('unbounded-range-no-lockfile: import tracing one-hop finds mongoose through Database.ts', async () => {
  const log = 'src/models/User.ts(64,11): error TS2349: This expression is not callable.\n  Type \'SaveOptions\' has no call signatures.';
  const userTs = [
    "import * as crypto from 'crypto';",
    "import * as bcrypt from 'bcrypt-nodejs';",
    "import { IUser } from '../interfaces/models/user';",
    "import mongoose from '../providers/Database';",
  ].join('\n');
  const databaseTs = [
    "import mongoose from 'mongoose';",
    "import * as bluebird from 'bluebird';",
    "import { MongoError } from 'mongodb';",
    "import Locals from './Locals';",
    "export default mongoose;",
  ].join('\n');
  const root = tmpRepo({
    'package.json': {
      name: 'x',
      scripts: { build: 'tsc' },
      dependencies: {
        mongoose: '>=6.4.6',
        passport: '>=0.6.0',
        pug: '>=3.0.1',
        bluebird: '^3.7.2',
        'bcrypt-nodejs': '^0.0.3',
      },
    },
    'src/models/User.ts': userTs,
    'src/providers/Database.ts': databaseTs,
  });
  const { diagnosis, fix } = await diagnose(await ctxIn(root, 'npm run build', log), { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'unbounded-range-no-lockfile', diagnosis?.cause ?? '(no diagnosis)');
  assert.match(diagnosis.cause, /mongoose/);
  assert.equal(fix.actions[0].command, 'npm install --no-save mongoose@^6.4.6');
});

// 9. Blamed file imports both mongoose and passport directly (both unbounded), no (a)/(b) evidence → no fire.
test('unbounded-range-no-lockfile: blamed file imports two unbounded deps directly → no fire', async () => {
  const log = 'src/app.ts(10,1): error TS2349: This expression is not callable.';
  const appTs = [
    "import mongoose from 'mongoose';",
    "import passport from 'passport';",
  ].join('\n');
  const root = tmpRepo({
    'package.json': {
      name: 'x',
      scripts: { build: 'tsc' },
      dependencies: {
        mongoose: '>=6.4.6',
        passport: '>=0.6.0',
      },
    },
    'src/app.ts': appTs,
  });
  const { diagnosis } = await diagnose(await ctxIn(root, 'npm run build', log), { brain: 'rules' });
  assert.notEqual(diagnosis.ruleId, 'unbounded-range-no-lockfile', 'ambiguous: two unbounded deps imported by blamed file');
});

// 10. mongoose only reachable TWO hops away → no fire.
test('unbounded-range-no-lockfile: mongoose two hops away → no fire', async () => {
  const log = 'src/controllers/Auth.ts(5,1): error TS2349: This expression is not callable.';
  // Auth.ts imports a relative, which imports Database.ts (which has mongoose) — but that's 2 hops.
  const authTs = "import { UserModel } from '../models/User';";
  const userTs = "import mongoose from '../providers/Database';";
  const databaseTs = "import mongoose from 'mongoose';";
  const root = tmpRepo({
    'package.json': {
      name: 'x',
      scripts: { build: 'tsc' },
      dependencies: { mongoose: '>=6.4.6' },
    },
    'src/controllers/Auth.ts': authTs,
    'src/models/User.ts': userTs,
    'src/providers/Database.ts': databaseTs,
  });
  const { diagnosis } = await diagnose(await ctxIn(root, 'npm run build', log), { brain: 'rules' });
  assert.notEqual(diagnosis.ruleId, 'unbounded-range-no-lockfile', 'mongoose is two hops away, should not fire');
});

// Runtime stack traces carry sandbox paths (/workspace/...); they must map back to the host checkout.
test('unbounded-range-no-lockfile: traces a /workspace stack path to the host file', async () => {
  const root = tmpRepo({
    'package.json': { name: 'x', dependencies: { chalk: '>=4.0.0', pug: '>=3.0.1' } },
    'src/log.js': "const chalk = require('chalk');\nmodule.exports = (m) => console.log(chalk.green(m));\n",
  });
  const log = 'TypeError: chalk.green is not a function\n    at module.exports (/workspace/src/log.js:2:43)';
  const ctx = await ctxIn(root, 'npm start', log);
  const d = await diagnose(ctx, { brain: 'rules' });
  assert.equal(d.diagnosis.ruleId, 'unbounded-range-no-lockfile');
  assert.equal(d.fix.actions[0].command, 'npm install --no-save chalk@^4.0.0');
});
