import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScout, runPlanner, runDoctor, runScribe } from '../src/solo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const acme = path.join(ROOT, 'examples', 'acme-shop');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fr-solo-'));
const events = (dir) => fs.readFileSync(path.join(dir, 'events.ndjson'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('scout alone: facts for acme-shop, and events that light only the Scout', async () => {
  const out = tmp();
  const r = await runScout(acme, { out });
  assert.equal(r.agent, 'scout');
  assert.equal(r.facts.stack, 'node');
  const ev = events(out);
  assert.deepEqual([...new Set(ev.map((e) => e.agent))], ['scout']);
  assert.ok(ev.some((e) => e.type === 'facts') && ev.at(-1).type === 'done');
});

test('doctor alone: a pasted EBADENGINE log gets the runtime fix, rules only, 0 Bobcoins', async () => {
  const log = 'npm ERR! code EBADENGINE\nnpm ERR! engine Unsupported engine\nnpm ERR! notsup Required: {"node":">=20"}\nnpm ERR! notsup Actual:   {"npm":"8.19.4","node":"v16.20.2"}';
  const out = tmp();
  const r = await runDoctor({ log, repo: acme, command: 'npm install', out });
  assert.equal(r.diagnosis.class, 'runtime-version');
  assert.ok(r.fix, 'a fix is proposed');
  assert.equal(r.bobcoins, 0);
  const ev = events(out);
  assert.ok(ev.every((e) => e.agent === 'doctor'));
  assert.equal(ev.at(-1).data.verdict, 'DIAGNOSED');
});

test('doctor alone: an unknown failure with no Bob budget says it needs a human, never guesses', async () => {
  const r = await runDoctor({ log: 'Segmentation fault (core dumped)', repo: acme, out: tmp() });
  assert.equal(r.fix, null);
  await assert.rejects(runDoctor({ log: '  ', repo: acme, out: tmp() }), /needs a failure log/);
});

test('scribe alone: rewrites FIRSTRUN.md + passport from a real finished run (GeekyAnts, real-16-v2)', async () => {
  const src = path.join(ROOT, 'audit', 'real-16-v2', 'runs', 'GeekyAnts__express-typescript');
  const dir = path.join(tmp(), 'run');
  fs.cpSync(src, dir, { recursive: true });
  fs.rmSync(path.join(dir, 'out', 'FIRSTRUN.md'), { force: true });
  const r = await runScribe(dir);
  const md = fs.readFileSync(r.files.report, 'utf8');
  assert.match(md, /E1/, 'evidence records are in the report');
  assert.equal(JSON.parse(fs.readFileSync(r.files.passport, 'utf8')).verdict, JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8')).passport.verdict);
  assert.equal(events(dir).at(-1).agent, 'scribe');
  await assert.rejects(runScribe(tmp()), /no run\.json/);
});

test('planner alone: plan + conflicts for acme-shop, events for Scout then Planner', async () => {
  const out = tmp();
  const r = await runPlanner(acme, { out });
  assert.ok(r.plan.steps.length > 0);
  assert.ok(r.conflicts.some((c) => c.what === 'Node.js version'), 'the seeded Node break is found statically');
  const ev = events(out);
  assert.deepEqual([...new Set(ev.map((e) => e.agent))], ['scout', 'planner']);
  assert.equal(ev.at(-1).data.verdict, 'PLANNED');
});
