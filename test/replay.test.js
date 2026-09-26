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

test('verifier alone: replays a finished run from zero, emits replay.start/step.start/step.end/replay.end/done', { skip: dockerAvailable ? false : 'Docker not available' }, async () => {
  // First create a finished run to replay
  const { runRunner } = await import('../src/solo.js');
  const runDir = tmp();
  await runRunner(acme, { out: runDir, asWritten: true });
  
  const out = tmp();
  const r = await runVerifier(runDir, { out });
  assert.equal(r.agent, 'verifier');
  assert.ok(r.replay);
  assert.ok(['passed', 'failed'].includes(r.replay.status));
  assert.ok(typeof r.replay.durationMs === 'number');
  
  const ev = events(r.runDir);
  const agents = [...new Set(ev.map((e) => e.agent))];
  assert.ok(agents.includes('verifier'));
  // Should have verifier events
  assert.ok(ev.some((e) => e.type === 'phase' && e.data.phase === 'replay'));
  assert.ok(ev.some((e) => e.type === 'step.start' && e.agent === 'verifier'));
  assert.ok(ev.some((e) => e.type === 'step.end' && e.agent === 'verifier'));
  assert.ok(ev.some((e) => e.type === 'replay.start'));
  assert.ok(ev.some((e) => e.type === 'replay.end'));
  assert.ok(ev.some((e) => e.type === 'done'));
  const last = ev.at(-1);
  assert.equal(last.type, 'done');
  assert.equal(last.data.verdict, r.replay.status === 'passed' ? 'REPLAY-PASSED' : 'REPLAY-FAILED');
});

test('verifier alone: writes events.ndjson to its own run folder', { skip: dockerAvailable ? false : 'Docker not available' }, async () => {
  const { runRunner } = await import('../src/solo.js');
  const runDir = tmp();
  await runRunner(acme, { out: runDir, asWritten: true });
  
  const out = tmp();
  const r = await runVerifier(runDir, { out });
  assert.ok(r.runDir.includes('verifier-'), 'run dir should be isolated');
  assert.ok(fs.existsSync(path.join(r.runDir, 'events.ndjson')));
  assert.ok(fs.existsSync(path.join(r.runDir, 'plan.json')));
});

test('verifier alone: rejects non-finished run directories', async () => {
  const out = tmp();
  await assert.rejects(runVerifier(out), /no run\.json|did not finish/);
});