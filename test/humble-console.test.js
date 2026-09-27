import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildTimeline, buildWatchPanel, parseRecordedEvents, recordedElapsed } from '../web/public/assets/humble-console-core.js';

const root = path.resolve('web/public/data/runs');

function readRecording(folder) {
  const run = JSON.parse(fs.readFileSync(path.join(root, folder, 'run.json'), 'utf8'));
  const ndjson = fs.readFileSync(path.join(root, folder, 'f/events.ndjson'), 'utf8');
  const events = parseRecordedEvents(ndjson);
  return { run, events, frames: buildTimeline(events) };
}

test('recorded console frames link back to real allowlisted run events', () => {
  const { events, frames } = readRecording('acme-shop-3c0bc2b2');
  assert.ok(frames.length > 0);
  for (const item of frames) {
    assert.ok(events[item.sourceIndex], `missing source event ${item.sourceIndex}`);
    assert.equal(events[item.sourceIndex].t, item.time);
    assert.ok(['plan', 'note', 'step.start', 'step.end', 'diagnosis', 'evidence', 'fix', 'replay.start', 'replay.end', 'passport'].includes(events[item.sourceIndex].type));
  }
  assert.match(frames[0].text, /Scout read/);
});

test('recorded demo machine watch panel reads only values captured in its run', () => {
  const { run } = readRecording('acme-shop-3c0bc2b2');
  const values = buildWatchPanel(run).map(({ label, value }) => `${label}: ${value}`);
  assert.ok(values.some((value) => value.includes('Node.js: 20')));
  assert.ok(values.some((value) => value.includes('HTTP 200')));
  assert.ok(values.includes('DB: up'));
  assert.ok(values.includes('REDIS: up'));
});

test('recorded verdict is taken from the passport and does not imply every run is verified', () => {
  const partial = readRecording('real-16-v2-GeekyAnts__express-typescript');
  const p = partial.run.passport;
  const finalFrame = partial.frames.findLast((item) => item.kind === 'sys' || item.kind === 'pass');
  assert.equal(p.verdict, 'PARTIAL');
  assert.match(finalFrame.text, /^PARTIAL · 1 of 4 breaks fixed · replay 69s$/);
  assert.equal(recordedElapsed(partial.frames, partial.frames.length - 1) >= 0, true);
});

test('event parser ignores malformed lines and timeline excludes raw step output', () => {
  const events = parseRecordedEvents('{"type":"step.log","data":{"chunk":"private output"}}\nnot json');
  assert.equal(events.length, 1);
  assert.equal(buildTimeline(events).length, 0);
});

test('displayed commands redact token-shaped values and secret assignments', () => {
  const fakeToken = `ghp_${'a'.repeat(36)}`;
  const events = parseRecordedEvents(JSON.stringify({
    type: 'step.start',
    data: { command: `API_TOKEN=${fakeToken} npm run setup` },
  }));
  const [item] = buildTimeline(events);
  assert.match(item.text, /API_TOKEN=<redacted>/);
  assert.doesNotMatch(item.text, new RegExp(fakeToken));
});
