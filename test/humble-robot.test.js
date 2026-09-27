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

test('HUMBLE Robot: flight math matches Section 6 of spec (duration clamp, scale peak, bezier, glow)', () => {
  import('../lens/humble/robot.js').then(({ flightMath }) => {
    // 1. Duration clamp: clamp(distance / 800, 0.6s, 1.4s)
    assert.equal(flightMath.duration(0), 0.6, 'dist 0 should clamp to 0.6s');
    assert.equal(flightMath.duration(400), 0.6, 'dist 400 (0.5s) should clamp to 0.6s');
    assert.equal(flightMath.duration(800), 1.0, 'dist 800 should equal 1.0s');
    assert.equal(flightMath.duration(960), 1.2, 'dist 960 should equal 1.2s');
    assert.equal(flightMath.duration(2000), 1.4, 'dist 2000 (2.5s) should clamp to 1.4s');

    // 2. Scale peak: 1 + sin(u * PI) * 0.3 (1.3x mid-flight)
    assert.equal(flightMath.scalePeak(0), 1.0, 'start scale should be 1.0');
    assert.ok(Math.abs(flightMath.scalePeak(0.5) - 1.3) < 1e-6, 'mid-flight scale should peak at 1.3x');
    assert.ok(Math.abs(flightMath.scalePeak(1) - 1.0) < 1e-6, 'end scale should settle back to 1.0');

    // 3. Glow radius: 8 + (scale - 1) * 20 px
    assert.equal(flightMath.glowRadius(1.0), 8, 'rest glow radius should be 8px');
    assert.equal(flightMath.glowRadius(1.3), 14, 'peak glow radius should be 14px');

    // 4. Eased progress: t = 3u^2 - 2u^3
    assert.equal(flightMath.easedProgress(0), 0);
    assert.equal(flightMath.easedProgress(0.5), 0.5);
    assert.equal(flightMath.easedProgress(1), 1);

    // 5. Quadratic Bezier curve point evaluation
    const P0 = { x: 0, y: 0 };
    const P1 = { x: 50, y: -60 };
    const P2 = { x: 100, y: 0 };
    const startPoint = flightMath.bezierPoint(P0, P1, P2, 0);
    assert.deepEqual(startPoint, { x: 0, y: 0 });
    const endPoint = flightMath.bezierPoint(P0, P1, P2, 1);
    assert.deepEqual(endPoint, { x: 100, y: 0 });
    const midPoint = flightMath.bezierPoint(P0, P1, P2, 0.5);
    assert.deepEqual(midPoint, { x: 50, y: -30 });
  });
});
