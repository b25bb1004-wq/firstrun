// test/spatial-bridge.test.js — tests for Section 17 Spatial UI wiring ({ spatial }: target.overlay, target.box, lookedAt)
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSpatialState, updateLookedAtChip, attachSpatialDock } from '../lens/humble/spatial-bridge.js';

function createMockMascot() {
  const calls = {
    showSpatialTarget: [],
    triggerCaptureFlash: [],
    showBeam: [],
    hideBeam: 0,
    hideSpatialTarget: 0,
    say: [],
    setState: [],
  };

  return {
    calls,
    showSpatialTarget: (box) => calls.showSpatialTarget.push(box),
    triggerCaptureFlash: (box) => calls.triggerCaptureFlash.push(box),
    showBeam: (coords) => calls.showBeam.push(coords),
    hideBeam: () => { calls.hideBeam++; },
    hideSpatialTarget: () => { calls.hideSpatialTarget++; },
    say: (text, ms) => calls.say.push({ text, ms }),
    setState: (state) => calls.setState.push(state),
  };
}

function createMockElement(tag = 'div') {
  const children = [];
  const classList = new Set();
  const attributes = {};

  const el = {
    tagName: tag.toUpperCase(),
    children,
    classList: {
      add: (cls) => classList.add(cls),
      remove: (cls) => classList.delete(cls),
      contains: (cls) => classList.has(cls),
    },
    textContent: '',
    setAttribute: (k, v) => { attributes[k] = v; },
    getAttribute: (k) => attributes[k],
    appendChild: (child) => {
      children.push(child);
      return child;
    },
    querySelector: (selector) => {
      if (selector === '.humble-looked-at-chip') {
        return children.find((c) => c.classList.contains('humble-looked-at-chip')) || null;
      }
      return null;
    },
  };
  return el;
}

test('spatial-bridge: handleSpatialState creates lookedAt chip with app and title', () => {
  const headerEl = createMockElement('div');
  globalThis.document = {
    createElement: (tag) => createMockElement(tag),
    querySelector: () => headerEl,
  };

  const spatial = {
    ok: true,
    how: 'rule',
    lookedAt: { app: 'WindowsTerminal', title: 'C:\\Code\\acme-shop' },
    target: {
      kind: 'box',
      id: 'B1',
      text: 'npm ERR! code EBADENGINE',
      box: { x: 200, y: 150, width: 420, height: 32 },
      overlay: { x: 410, y: 166 },
    },
  };

  const mascot = createMockMascot();
  const result = handleSpatialState(spatial, { mascot, headerEl, holdMs: 50 });

  assert.equal(result.ok, true);
  assert.equal(result.lookedAt.app, 'WindowsTerminal');
  assert.match(result.chipEl.textContent, /WindowsTerminal/);
  assert.equal(headerEl.children.length, 1);
});

test('spatial-bridge: handleSpatialState wires target.box to spatialTargetBox and captureFlash', () => {
  const mascot = createMockMascot();
  const headerEl = createMockElement('div');

  const spatial = {
    ok: true,
    lookedAt: { app: 'VS Code' },
    target: {
      kind: 'box',
      id: 'B2',
      text: 'connect ECONNREFUSED 127.0.0.1:5432',
      box: { x: 120, y: 340, width: 500, height: 28 },
      overlay: { x: 370, y: 354 },
    },
  };

  handleSpatialState(spatial, { mascot, headerEl, holdMs: 20 });

  assert.equal(mascot.calls.showSpatialTarget.length, 1);
  assert.deepEqual(mascot.calls.showSpatialTarget[0], { x: 120, y: 340, width: 500, height: 28 });

  assert.equal(mascot.calls.triggerCaptureFlash.length, 1);
  assert.deepEqual(mascot.calls.triggerCaptureFlash[0], { x: 120, y: 340, width: 500, height: 28 });
});

test('spatial-bridge: handleSpatialState wires target.overlay to lantern BEAM', () => {
  const mascot = createMockMascot();
  const headerEl = createMockElement('div');

  const spatial = {
    ok: true,
    lookedAt: { app: 'iTerm2' },
    target: {
      kind: 'box',
      id: 'B3',
      text: 'error: recipe failed',
      box: { x: 50, y: 80, width: 300, height: 24 },
      overlay: { x: 200, y: 92 },
    },
  };

  handleSpatialState(spatial, { mascot, headerEl, holdMs: 30 });

  assert.equal(mascot.calls.showBeam.length, 1);
  assert.deepEqual(mascot.calls.showBeam[0], { x: 200, y: 92 });
});

test('spatial-bridge: handleSpatialState handles failed look with reason and worried state', () => {
  const mascot = createMockMascot();
  const headerEl = createMockElement('div');
  const statusEl = createMockElement('span');

  const spatial = {
    ok: false,
    reason: 'the captured window moved away; look again',
  };

  const result = handleSpatialState(spatial, { mascot, headerEl, statusEl, holdMs: 50 });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'the captured window moved away; look again');
  assert.equal(mascot.calls.setState.includes('worried'), true);
  assert.match(statusEl.textContent, /moved away/);
});

test('spatial-bridge: attachSpatialDock triggers window.dock.look and handles state', async () => {
  const mascot = createMockMascot();
  const headerEl = createMockElement('div');
  let stateListener = null;

  const mockDock = {
    look: async (want) => {
      assert.equal(want.role, 'terminal');
      return {
        ok: true,
        lookedAt: { app: 'WindowsTerminal' },
        target: {
          kind: 'box',
          id: 'B1',
          text: 'EBADENGINE',
          box: { x: 100, y: 100, width: 200, height: 20 },
          overlay: { x: 200, y: 110 },
        },
      };
    },
    onState: (fn) => {
      stateListener = fn;
      return () => { stateListener = null; };
    },
  };

  const buttonEl = {
    disabled: false,
    classList: { add: () => {}, remove: () => {} },
    addEventListener: (evt, handler) => {
      buttonEl._handler = handler;
    },
  };

  const bridge = attachSpatialDock(mockDock, { mascot, headerEl, buttonEl, holdMs: 10 });
  const lookResult = await bridge.look();

  assert.equal(lookResult.ok, true);
  assert.equal(mascot.calls.showBeam.length, 1);

  // Test pushing state through onState
  stateListener({
    spatial: {
      ok: true,
      lookedAt: { app: 'PowerShell' },
      target: {
        kind: 'box',
        id: 'B5',
        text: 'exit 1',
        box: { x: 10, y: 20, width: 100, height: 15 },
        overlay: { x: 60, y: 27 },
      },
    },
  });

  assert.equal(mascot.calls.showBeam.length, 2);
  assert.deepEqual(mascot.calls.showBeam[1], { x: 60, y: 27 });

  bridge.destroy();
  assert.equal(stateListener, null);
});
