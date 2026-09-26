import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runVerifier } from '../src/solo.js';
import { run } from '../src/util.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const acme = path.join(ROOT, 'examples', 'acme-shop');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fr-replay-'));
const events = (dir) => fs.readFileSync(path.join(dir, 'events.ndjson'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const dockerAvailable = (await run('docker', ['info'])).code === 0;

// A finished run: a repo folder with .firstrun/{run.json with a passport, plan.json with the repaired steps}.
function finishedRun(command = 'node -e "console.log(42)"') {
  const repo = tmp();
  fs.writeFileSync(path.join(repo, 'README.md'), '# x\n');
  const dir = path.join(repo, '.firstrun');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ id: 'r1', repo: 'x/y', passport: { verdict: 'VERIFIED' } }));
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ image: 'node:22', verify: { kind: 'exit' }, steps: [{ id: 'S1', command, kind: 'other', status: 'passed' }] }));
  return dir;
}

test('verifier alone: replays a finished run from zero on a new machine (passes, then fails on a broken step)', { skip: dockerAvailable ? false : 'Docker not available' }, async () => {
  const r = await runVerifier(finishedRun(), { out: tmp() });
  assert.equal(r.agent, 'verifier');
  assert.equal(r.replay.status, 'passed');
  const ev = events(r.runDir);
  for (const t of ['replay.start', 'step.start', 'step.end', 'replay.end', 'done']) assert.ok(ev.some((e) => e.type === t && e.agent === 'verifier'), t);
  assert.equal(ev.at(-1).data.verdict, 'REPLAY-PASSED');
  const bad = await runVerifier(finishedRun('node -e "process.exit(3)"'), { out: tmp() });
  assert.equal(bad.replay.status, 'failed');
  assert.equal(bad.replay.failedStep, 'S1');
});

test('verifier alone: rejects non-finished run directories', async () => {
  const out = tmp();
  await assert.rejects(runVerifier(out), /no run\.json|did not finish/);
});