import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { repairInsertedStep } from '../src/pipeline.js';

// Real log: zhanymkanov/fastapi_production_template, audit/real-16-v2 E3 (the inserted `poetry install` failed).
const ev = 'audit/real-16-v2/runs/zhanymkanov__fastapi_production_template/evidence/E3.json';

test('an inserted fix that fails is diagnosed by the rules and rewritten (poetry-no-root)', async (t) => {
  if (!fs.existsSync(ev)) return t.skip('audit evidence not present');
  const j = JSON.parse(fs.readFileSync(ev, 'utf8'));
  const log = (j.before || j.after).logTail;
  const ns = { id: 'R1', command: 'poetry install', kind: 'install', source: {} };
  const r = await repairInsertedStep(ns, { out: log, exitCode: 1 }, { facts: { files: [] }, plan: { steps: [ns], repo: 'zhanymkanov/fastapi_production_template' }, sandbox: null, tried: new Set() });
  assert.equal(r.ruleId, 'poetry-no-root');
  assert.equal(r.from, 'poetry install');
  assert.equal(ns.command, 'poetry install --no-root');
});

test('no known cause: the inserted step is left alone', async () => {
  const ns = { id: 'R1', command: 'npm install --global nodemon', kind: 'install', source: {} };
  const r = await repairInsertedStep(ns, { out: 'something unrelated went wrong', exitCode: 1 }, { facts: { files: [] }, plan: { steps: [ns] }, sandbox: null, tried: new Set() });
  assert.equal(r, null);
  assert.equal(ns.command, 'npm install --global nodemon');
});
