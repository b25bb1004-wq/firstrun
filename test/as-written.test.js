import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRunner } from '../src/solo.js';
import { run } from '../src/util.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const acme = path.join(ROOT, 'examples', 'acme-shop');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fr-as-written-'));
const events = (dir) => fs.readFileSync(path.join(dir, 'events.ndjson'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const dockerAvailable = (await run('docker', ['info'])).code === 0;

test('runner alone --as-written: follows README steps on a clean machine, no Doctor, no replay, stops at first failure', { skip: dockerAvailable ? false : 'Docker not available' }, async () => {
  const out = tmp();
  const r = await runRunner(acme, { out, asWritten: true });
  assert.equal(r.agent, 'runner');
  // Should have a verdict
  assert.ok(r.verdict === 'WORKS-AS-WRITTEN' || r.verdict === 'BROKEN-AS-WRITTEN');
  if (r.verdict === 'BROKEN-AS-WRITTEN') {
    assert.ok(r.firstFailure, 'firstFailure should be present when broken');
    assert.ok(r.firstFailure.stepId);
    assert.ok(r.firstFailure.command);
    assert.ok(typeof r.firstFailure.exitCode === 'number');
  }
  // Events should only have runner agent (plus scout/planner for coldstart)
  const ev = events(out);
  const agents = [...new Set(ev.map((e) => e.agent))];
  // Should have scout, planner, runner
  assert.ok(agents.includes('scout'));
  assert.ok(agents.includes('planner'));
  assert.ok(agents.includes('runner'));
  // Should NOT have doctor, verifier, scribe
  assert.ok(!agents.includes('doctor'), 'Doctor should not run in --as-written mode');
  assert.ok(!agents.includes('verifier'), 'Verifier should not run in --as-written mode');
  assert.ok(!agents.includes('scribe'), 'Scribe should not run in --as-written mode');
  // Last event should be done with the verdict
  const last = ev.at(-1);
  assert.equal(last.type, 'done');
  assert.equal(last.data.verdict, r.verdict);
  // events.ndjson should have phase coldstart and step.start/step.end
  assert.ok(ev.some((e) => e.type === 'phase' && e.data.phase === 'coldstart'));
  assert.ok(ev.some((e) => e.type === 'step.start'));
  assert.ok(ev.some((e) => e.type === 'step.end'));
});

test('runner alone --as-written: emits step.start/step.end for Dock runner character', { skip: dockerAvailable ? false : 'Docker not available' }, async () => {
  const out = tmp();
  const r = await runRunner(acme, { out, asWritten: true });
  const ev = events(out);
  const stepStarts = ev.filter((e) => e.type === 'step.start');
  const stepEnds = ev.filter((e) => e.type === 'step.end');
  assert.ok(stepStarts.length > 0, 'should have step.start events');
  assert.equal(stepStarts.length, stepEnds.length, 'each step.start should have a step.end');
  // Each step.start should have stepId, command
  for (const s of stepStarts) {
    assert.ok(s.data.stepId);
    assert.ok(s.data.command);
  }
  // Each step.end should have stepId, exitCode, status
  for (const s of stepEnds) {
    assert.ok(s.data.stepId);
    assert.ok(typeof s.data.exitCode === 'number');
    assert.ok(['passed', 'failed'].includes(s.data.status));
  }
});

test('runner alone --as-written: writes events.ndjson to its own run folder, never overwrites a FirstRun run', { skip: dockerAvailable ? false : 'Docker not available' }, async () => {
  const out = tmp();
  const r = await runRunner(acme, { out, asWritten: true });
  assert.ok(r.runDir.includes('-as-written') || r.runDir.includes('runner-'), 'run dir should be isolated');
  assert.ok(fs.existsSync(path.join(r.runDir, 'events.ndjson')));
  assert.ok(fs.existsSync(path.join(r.runDir, 'plan.json'))); // planner saves plan
});
test('runner --as-written: a README with nothing to follow is NO-SETUP-DOCS, never a pass', async () => {
  const { runRunner } = await import('../src/solo.js');
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-nsd-'));
  fs.writeFileSync(path.join(root, 'README.md'), '# A library\n\nIt does useful things. See the docs site.\n');
  const r = await runRunner(root, { out: fs.mkdtempSync(path.join(os.tmpdir(), 'fr-nsd-out-')), asWritten: true });
  assert.equal(r.verdict, 'NO-SETUP-DOCS');
});
