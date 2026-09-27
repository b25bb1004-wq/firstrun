import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const CSS_FILE = path.join(ROOT, 'lens', 'humble', 'debugger-ui.css');
const JS_FILE = path.join(ROOT, 'lens', 'humble', 'debugger-ui.js');

test('HUMBLE Debugger UI: files exist', () => {
  assert.ok(fs.existsSync(CSS_FILE), 'debugger-ui.css missing');
  assert.ok(fs.existsSync(JS_FILE), 'debugger-ui.js missing');
});

test('HUMBLE Debugger UI: CSS includes verdict chips, shield, and sub-panel styles', () => {
  const css = fs.readFileSync(CSS_FILE, 'utf8');
  assert.ok(css.includes('.hb-guard-shield'), 'Missing shield styling');
  assert.ok(css.includes('.hb-guard-shield.shield-blocked'), 'Missing shield-blocked pulse');
  assert.ok(css.includes('.hb-verdict-chip.chip-warn'), 'Missing warn verdict chip');
  assert.ok(css.includes('.hb-verdict-chip.chip-block'), 'Missing block verdict chip');
  assert.ok(css.includes('.hb-debugger-panel'), 'Missing debugger panel layout');
  assert.ok(css.includes('margin: 10px 0 10px 12px;'), 'Missing 12px indentation');
  assert.ok(css.includes('--hb-dbg-fail'), 'Missing fail border color');
  assert.ok(css.includes('--hb-dbg-ok'), 'Missing ok border color');
});

test('HUMBLE Debugger UI: JS exports required functions', async () => {
  const mod = await import('../lens/humble/debugger-ui.js');
  assert.equal(typeof mod.createVerdictChip, 'function');
  assert.equal(typeof mod.createGuardBadge, 'function');
  assert.equal(typeof mod.createDebuggerPanel, 'function');
});
