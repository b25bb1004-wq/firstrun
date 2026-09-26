import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compilingFirstTime } from '../src/sandbox.js';

// GeekyAnts: `tsc --watch & nodemon dist` on a fresh clone. nodemon starts before dist/ exists and crashes,
// then restarts once tsc finishes its first build. That early crash must not end the step.
const EARLY = [
  "Error: Cannot find module '/workspace/dist'",
  '[nodemon] app crashed - waiting for file changes before starting...',
  '9:36:01 AM - Starting compilation in watch mode...',
].join('\n');

test('a crash during the first watch-mode compile is not final', () => {
  assert.equal(compilingFirstTime(EARLY), true);
});

test('once the first compile has finished, a crash is real', () => {
  assert.equal(compilingFirstTime(`${EARLY}\n9:36:40 AM - Found 19 errors. Watching for file changes.`), false);
  assert.equal(compilingFirstTime(`${EARLY}\n9:36:40 AM - Found 0 errors. Watching for file changes.`), false);
});

test('no watch-mode compiler: behaviour unchanged', () => {
  assert.equal(compilingFirstTime('[nodemon] app crashed - waiting for file changes before starting...'), false);
});

// GeekyAnts, part 2: connect-mongo 2 ships a legacy driver that MongoDB 6+ rejects.
test('mongo-legacy-driver: legacy opcode error → run mongo:4.4', async () => {
  const { RULES } = await import('../src/doctor/rules.js');
  const rule = RULES.find((r) => r.id === 'mongo-legacy-driver');
  const log = "[ERROR] :: MongoError: Unsupported OP_QUERY command: insert. The client driver may require an upgrade. For more details see https://dochub.mongodb.org/core/legacy-opcode-removal";
  const r = rule.test({ log, sandbox: { services: [{ name: 'mongo', image: 'mongo:7' }] } });
  assert.equal(r.fix.actions[0].image, 'mongo:4.4');
  assert.equal(rule.test({ log, sandbox: { services: [{ name: 'mongo', image: 'mongo:4.4' }] } }), null, 'already on 4.4: not a fix to repeat');
  assert.equal(rule.test({ log: 'MongoError: connect ECONNREFUSED 127.0.0.1:27017', sandbox: { services: [] } }), null);
});
