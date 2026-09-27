import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HUMBLE_STATES, AGENT_COLORS, HUMBLE_SIZES, HumbleRobot } from '../lens/humble/robot.js';

const ROOT = path.resolve('.');
const SPRITES_DIR = path.join(ROOT, 'lens', 'humble', 'sprites');
const MASTER_SVG = path.join(ROOT, 'lens', 'humble', 'robot.svg');
const CSS_FILE = path.join(ROOT, 'lens', 'humble', 'robot.css');

test('HUMBLE Robot: exports all 7 required states', () => {
  assert.deepEqual(HUMBLE_STATES, [
    'sleep',
    'think',
    'walk',
    'point',
    'talk',
    'celebrate',
    'worried'
  ]);
});

test('HUMBLE Robot: defines all 7 crew/pipeline agent colors', () => {
  const agents = ['harvey', 'unity', 'mach', 'drbo', 'larp', 'echo', 'vigil', 'default'];
  for (const a of agents) {
    assert.ok(AGENT_COLORS[a], `Missing color for agent: ${a}`);
    assert.match(AGENT_COLORS[a], /^#[0-9a-f]{6}$/i);
  }
});

test('HUMBLE Robot: exports 24/56/96/256 px size variants', () => {
  assert.ok(HUMBLE_SIZES.includes('24'));
  assert.ok(HUMBLE_SIZES.includes('56'));
  assert.ok(HUMBLE_SIZES.includes('96'));
  assert.ok(HUMBLE_SIZES.includes('256'));
});

test('HUMBLE Robot: all 7 standalone SVG sprite files exist and contain valid CRT mascot markup', () => {
  for (const state of HUMBLE_STATES) {
    const file = path.join(SPRITES_DIR, `${state}.svg`);
    assert.ok(fs.existsSync(file), `Missing SVG file: ${file}`);
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.startsWith('<svg'), `${state}.svg does not start with <svg`);
    assert.ok(/viewBox="0 (-25|0) 200 (250|275)"/.test(content), `${state}.svg missing or invalid viewBox`);
    assert.ok(content.includes(`humble-robot-${state}`), `${state}.svg missing class humble-robot-${state}`);
  }
});

test('HUMBLE Robot: master sprite sheet contains all 7 symbol IDs', () => {
  assert.ok(fs.existsSync(MASTER_SVG), 'Master robot.svg missing');
  const content = fs.readFileSync(MASTER_SVG, 'utf8');
  for (const state of HUMBLE_STATES) {
    const symbolTag = `id="hb-robot-${state}"`;
    assert.ok(content.includes(symbolTag), `Master sprite sheet missing symbol: ${symbolTag}`);
  }
});

test('HUMBLE Robot: CSS includes tokens, reduced-motion overrides, sizes, and state animations', () => {
  assert.ok(fs.existsSync(CSS_FILE), 'robot.css missing');
  const css = fs.readFileSync(CSS_FILE, 'utf8');
  assert.ok(css.includes('--robot-core: #ff9a3c'), 'Missing amber core light token');
  assert.ok(css.includes('--robot-hi: #ffc47a'), 'Missing amber highlight token');
  assert.ok(css.includes('--robot-screen: #2a1406'), 'Missing dark CRT screen token');
  assert.ok(css.includes('--robot-blue: #2440ff'), 'Missing celebrate flash blue token');
  assert.ok(css.includes('--robot-pink: #ff2d87'), 'Missing worried pink token');
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'Missing reduced motion media query');

  // Verify size classes
  ['24', '56', '96', '256'].forEach(sz => {
    assert.ok(css.includes(`.humble-robot-${sz}`), `Missing size class for ${sz}px`);
  });

  for (const state of HUMBLE_STATES) {
    assert.ok(css.includes(`.humble-robot-${state}`), `Missing CSS class for state: ${state}`);
  }
});
