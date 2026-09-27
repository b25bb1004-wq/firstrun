// Spatial context (spec section 17): window map, coordinates, on-screen matching, Bob point verification, capture gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classify, pick, roleOf } from '../lens/spatial/windows.js';
import { withIds } from '../lens/spatial/ocr.js';
import { matchDisplays, physToDip, physRectToDip, imageBoxToScreen, screenToOverlay, edgeToward, clampToDisplay, displayAt } from '../lens/spatial/coords.js';
import { findOnScreen } from '../lens/spatial/match.js';
import { parsePoint, verifyPoint, createCaptureGate, denied } from '../lens/spatial/point.js';

const fixture = (f) => JSON.parse(fs.readFileSync(new URL(`./fixtures/spatial/${f}`, import.meta.url), 'utf8'));

test('window map: real titles from a Windows desktop are classified, overlays and the desktop dropped', () => {
  const map = classify(fixture('windows-karmanya.json'), { repo: 'firstrun' });
  const byApp = Object.fromEntries(map.windows.map((w) => [w.app, w]));
  assert.equal(byApp.WindowsTerminal.role, 'terminal');
  assert.equal(byApp.Code.role, 'editor');
  assert.equal(byApp['IBM Bob'].role, 'editor');
  assert.equal(byApp['IBM Bob'].project, true, 'title "AGENTS.md - firstrun - IBM Bob" names the repo');
  assert.equal(byApp.Discord.role, 'other');
  assert.ok(!byApp['NVIDIA Overlay'] && !byApp.explorer, 'overlay + Program Manager ignored');
  assert.deepEqual(map.windows.map((w) => w.id), map.windows.map((_, i) => `W${i + 1}`));
  assert.equal(pick(map, 'terminal').app, 'WindowsTerminal');
});

test('window map: project terminal, localhost browser, docker, screen assignment', () => {
  const raw = {
    monitors: [{ x: -2560, y: 0, width: 2560, height: 1440, primary: false }, { x: 0, y: 0, width: 2880, height: 1800, primary: true }],
    windows: [
      { hwnd: 1, app: 'WindowsTerminal', cls: 'CASCADIA_HOSTING_WINDOW_CLASS', title: 'PowerShell', x: 100, y: 100, width: 1200, height: 800, z: 0 },
      { hwnd: 2, app: 'WindowsTerminal', cls: 'CASCADIA_HOSTING_WINDOW_CLASS', title: 'C:\\Code\\express-typescript', x: -2400, y: 80, width: 1400, height: 900, z: 1 },
      { hwnd: 3, app: 'chrome', cls: 'Chrome_WidgetWin_1', title: 'localhost:3000 - Google Chrome', x: 1300, y: 0, width: 1500, height: 1700, z: 2 },
      { hwnd: 4, app: 'chrome', cls: 'Chrome_WidgetWin_1', title: 'localhost:8080 - Google Chrome', x: 0, y: 0, width: 900, height: 900, z: 3 },
      { hwnd: 5, app: 'Docker Desktop', cls: 'Chrome_WidgetWin_1', title: 'Docker Desktop', x: 0, y: 0, width: 900, height: 700, z: 4 },
      { hwnd: 6, app: 'cmd', cls: 'ConsoleWindowClass', title: 'Command Prompt', x: 0, y: 0, width: 600, height: 400, z: 5 },
    ],
  };
  const map = classify(raw, { cwd: 'C:\\Code\\express-typescript', port: 3000 });
  const t = pick(map, 'terminal');
  assert.equal(t.hwnd, 2); assert.equal(t.project, true); assert.equal(t.screen, 2, 'left monitor is screen2, primary is screen1');
  assert.equal(pick(map, 'browser').hwnd, 3, 'only the tab on the expected port is marked');
  assert.equal(map.windows.find((w) => w.hwnd === 5).role, 'docker');
  assert.equal(roleOf(raw.windows[5]), 'terminal');
});

// Two monitors: primary 2880x1800 physical at 150% (1920x1200 DIP); secondary 2560x1440 at 100% on the LEFT.
const monitors = [{ x: 0, y: 0, width: 2880, height: 1800, primary: true }, { x: -2560, y: 180, width: 2560, height: 1440 }];
const displays = [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1200 }, scaleFactor: 1.5 }, { id: 2, bounds: { x: -2560, y: 120, width: 2560, height: 1440 }, scaleFactor: 1 }];

test('coords: physical -> DIP across 150% scaling and a negative-offset monitor', () => {
  const pairs = matchDisplays(monitors, displays);
  assert.equal(pairs[0].display.id, 1); assert.equal(pairs[1].display.id, 2);
  assert.deepEqual((({ x, y }) => ({ x, y }))(physToDip({ x: 1500, y: 900 }, pairs)), { x: 1000, y: 600 });
  assert.deepEqual((({ x, y }) => ({ x, y }))(physToDip({ x: -1000, y: 380 }, pairs)), { x: -1000, y: 320 });
  const r = physRectToDip({ x: 300, y: 150, width: 1500, height: 900 }, pairs);
  assert.deepEqual([r.x, r.y, r.width, r.height], [200, 100, 1000, 600]);
});

test('coords: OCR box -> screen -> overlay, clamping, other-screen edge', () => {
  const win = { x: 200, y: 100, width: 1000, height: 600 }; // DIP
  const box = imageBoxToScreen({ x: 150, y: 90, width: 300, height: 30 }, { width: 1500, height: 900 }, win); // thumbnail at 150%
  assert.deepEqual(box, { x: 300, y: 160, width: 200, height: 20 });
  assert.deepEqual(screenToOverlay({ x: -1000, y: 320 }, displays[1]), { x: 1560, y: 200 });
  assert.equal(displayAt({ x: -5, y: 500 }, displays).id, 2);
  assert.equal(displayAt({ x: 1920, y: 10 }, displays), null, 'right edge is exclusive');
  assert.deepEqual(clampToDisplay({ x: 5000, y: -50 }, displays[0]), { x: 1912, y: 8 });
  const e = edgeToward({ x: -1000, y: 600 }, displays[0]);
  assert.equal(e.x, 24); assert.equal(e.y, 600);
});

test('match: real OCR of the acme-shop EBADENGINE error finds the rule line and the prompt', () => {
  const ocr = withIds(fixture('acme-ebadengine.ocr.json'));
  assert.ok(ocr.lines.length >= 6 && ocr.lines.length < fixture('acme-ebadengine.ocr.json').lines.length, 'column fragments merged into rows');
  const hit = findOnScreen(ocr, { matchedLine: 'npm ERR! code EBADENGINE', command: 'npm install' });
  assert.equal(hit.how, 'rule');
  assert.match(hit.error.text, /code EBADENGINE/);
  assert.match(hit.prompt.text, /npm install/);
  const generic = findOnScreen(ocr, {});
  assert.equal(generic.how, 'generic');
  assert.match(generic.error.text, /npm ERR!/);
});

test('Bob points: ids verified, unknown ids and mismatched labels rejected, moved windows rejected', () => {
  const ocr = withIds(fixture('acme-ebadengine.ocr.json'));
  const map = { windows: [{ id: 'W1', app: 'WindowsTerminal', title: 'PowerShell', bounds: { x: 0, y: 0, width: 1500, height: 330 } }] };
  const errId = findOnScreen(ocr, { matchedLine: 'npm ERR! code EBADENGINE' }).error.id;
  const still = () => ({ x: 0, y: 0, width: 1500, height: 330 });
  const ctx = { map, ocr, ocrWindowId: 'W1', liveBounds: still };

  const p = parsePoint(`this broke here [POINT:${errId}:the error:screen1]`);
  assert.deepEqual([p.id, p.label, p.screen, p.spoken], [errId, 'the error', 1, 'this broke here']);
  assert.equal(verifyPoint(p, ctx).ok, true);
  assert.equal(verifyPoint(parsePoint('[POINT:W1:your terminal]'), ctx).target.kind, 'window');
  assert.match(verifyPoint(parsePoint('[POINT:B99:the error]'), ctx).reason, /unknown box/);
  assert.match(verifyPoint(parsePoint('[POINT:W7:your terminal]'), ctx).reason, /unknown window/);
  assert.match(verifyPoint(parsePoint(`[POINT:${errId}:"ECONNREFUSED 127.0.0.1"]`), ctx).reason, /does not match/);
  assert.equal(verifyPoint(parsePoint(`[POINT:${errId}:"code EBADENGINE"]`), ctx).ok, true);
  assert.match(verifyPoint(p, { ...ctx, liveBounds: () => ({ x: 40, y: 0, width: 1500, height: 330 }) }).reason, /moved/);
  assert.match(verifyPoint(p, { ...ctx, liveBounds: () => null }).reason, /moved away/);
  assert.equal(verifyPoint(parsePoint('[POINT:none]'), ctx).ok, false);
  assert.equal(parsePoint('no tag here'), null);
});

test('capture gate: nothing is captured without the hotkey/button; deny-list honoured; log has no image', async () => {
  let t = 1000;
  const gate = createCaptureGate({ now: () => t, userExcludes: ['Slack'] });
  const term = { app: 'WindowsTerminal', title: 'PowerShell' };
  let grabs = 0;
  const grab = async () => { grabs++; return Buffer.from('png'); };

  await assert.rejects(gate.capture(term, grab), /no capture without/);
  assert.throws(() => gate.allow('timer'), /only be granted/);
  gate.allow('hotkey');
  const shot = await gate.capture(term, grab);
  assert.equal(grabs, 1); assert.equal(shot.entry.source, 'hotkey');
  await assert.rejects(gate.capture(term, grab), /no capture without/, 'a grant is one-shot');
  gate.allow('button'); t += 6000;
  await assert.rejects(gate.capture(term, grab), /no capture without/, 'grants expire');

  for (const w of [{ app: '1Password', title: '1Password' }, { app: 'msedge', title: 'New tab - [InPrivate] - Microsoft Edge' }, { app: 'slack', title: 'Slack' }]) {
    gate.allow('button');
    await assert.rejects(gate.capture(w, grab), /not captured/);
  }
  assert.equal(grabs, 1, 'denied windows are never grabbed');
  assert.equal(denied({ app: 'Code', title: 'app.js - Visual Studio Code' }), null);
  const log = gate.log();
  assert.equal(log.length, 4);
  assert.ok(log.every((e) => !('png' in e) && 'window' in e && 'at' in e));
});

test('Bob payload: text + ids only, secrets redacted, capture log marked', async () => {
  const { bobPayload } = await import('../lens/spatial/point.js');
  const map = { windows: [{ id: 'W1', hwnd: 99, app: 'WindowsTerminal', title: 'PowerShell', role: 'terminal', screen: 1, bounds: { x: 1, y: 2, width: 3, height: 4 } }] };
  const ocr = { lines: [{ id: 'B1', text: 'GITHUB_TOKEN=ghp_' + 'a'.repeat(36), x: 1, y: 2, width: 3, height: 4 }] };
  const entry = { bobSawText: false };
  const p = bobPayload(map, ocr, entry);
  const s = JSON.stringify(p);
  assert.ok(!s.includes('ghp_' + 'a'.repeat(36)), 'token redacted');
  assert.ok(!/hwnd|bounds|"x"/.test(s), 'no coordinates or handles');
  assert.match(p.lines[0], /^B1: /);
  assert.equal(entry.bobSawText, true);
});
