import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const CSS_FILE = path.join(ROOT, 'lens', 'humble', 'timeline-controls.css');
const JS_FILE = path.join(ROOT, 'lens', 'humble', 'timeline-controls.js');

test('HUMBLE Timeline & Step Controls: files exist', () => {
  assert.ok(fs.existsSync(CSS_FILE), 'timeline-controls.css missing');
  assert.ok(fs.existsSync(JS_FILE), 'timeline-controls.js missing');
});

test('HUMBLE Timeline & Step Controls: CSS includes D1 step controls and D5 timeline styles', () => {
  const css = fs.readFileSync(CSS_FILE, 'utf8');
  assert.ok(css.includes('.hb-step-controls'), 'Missing step controls toolbar');
  assert.ok(css.includes('.hb-gutter-breakpoint'), 'Missing gutter breakpoint style');
  assert.ok(css.includes('.hb-timeline-scrubber'), 'Missing timeline scrubber container');
  assert.ok(css.includes('.hb-timeline-pip'), 'Missing timeline pip style');
  assert.ok(css.includes('.hb-pip-tooltip'), 'Missing snapshot tooltip style');
  assert.ok(css.includes('.hb-rewind-btn'), 'Missing rewind action button style');
});

test('HUMBLE Timeline & Step Controls: JS exports required functions', async () => {
  const mod = await import('../lens/humble/timeline-controls.js');
  assert.equal(typeof mod.createStepControls, 'function');
  assert.equal(typeof mod.createTimelineScrubber, 'function');
});
