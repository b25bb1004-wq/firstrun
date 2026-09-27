// HUMBLE Lens: press the hotkey, circle anything on screen, get an answer.
//   npx electron lens [project dir]      (or: node bin/firstrun.js lens [project dir])
// HUMBLE Dock: floating always-on-top button + panel (issue #90, DOCK_CONTRACT §4-5).
import { app, BrowserWindow, globalShortcut, desktopCapturer, screen, ipcMain, Tray, Menu, nativeImage, dialog, clipboard } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ocr, warmOcr, loadKnownFixes, matchKnownFix, askBobAbout } from './engine.js';
import { runAgent, open as openArtifact } from './dock-bridge.js';
import { readWindows } from './spatial/windows.js';
import { ocrPng } from './spatial/ocr.js';
import { createCaptureGate, bobPayload } from './spatial/point.js';
import { look } from './spatial/look.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOTKEYS = ['CommandOrControl+Shift+Space', 'Alt+Shift+Q'];
const LOOK_HOTKEYS = ['CommandOrControl+Shift+L', 'Alt+Shift+L']; // "look at my screen" (spec section 17)
// Dock hotkey: Alt+Command+Space (Mac) / Control+Alt+Space (Windows/Linux) — DOCK_CONTRACT §5
const DOCK_HOTKEYS = process.platform === 'darwin'
  ? ['Alt+Command+Space']
  : ['Control+Alt+Space', 'Control+Alt+D', 'Alt+Shift+D']; // Ctrl+Alt+Space is often taken on Windows
const CACHE = path.join(app.getPath('userData'), 'ocr');
fs.mkdirSync(CACHE, { recursive: true });

const argDir = process.argv.slice(1).find((a) => !a.startsWith('-') && a !== '.' && fs.existsSync(a) && fs.statSync(a).isDirectory() && path.resolve(a) !== HERE);
let project = path.resolve(argDir || process.env.FIRSTRUN_PROJECT || path.join(HERE, '..'));
let hotkey = null;
let overlay = null;
let tray = null;
let busy = false;

// ── Dock state ────────────────────────────────────────────────────────────────
let dockButton = null; // 56×56 floating button
let dockPanel  = null; // 380×600 panel
let dockBridge = null; // current runAgent() handle
let consoleWindow = null; // 380×600 HUMBLE console window

const PRELOAD_DOCK = path.join(HERE, 'dock-preload.cjs');

function dockWebPrefs() {
  return { preload: PRELOAD_DOCK, contextIsolation: true, sandbox: true };
}

// The floating button can be dragged anywhere, on any display; its spot is remembered.
const BUTTON_POS = path.join(app.getPath('userData'), 'dock-button.json');
function savedButtonPos() {
  try {
    const p = JSON.parse(fs.readFileSync(BUTTON_POS, 'utf8'));
    const onScreen = screen.getAllDisplays().some((d) => { const b = d.bounds; return p.x >= b.x - 40 && p.y >= b.y - 40 && p.x < b.x + b.width - 16 && p.y < b.y + b.height - 16; });
    return onScreen ? p : null;
  } catch { return null; }
}
function clampToDisplays(x, y) {
  const d = screen.getDisplayNearestPoint({ x: x + 28, y: y + 28 }).bounds;
  return { x: Math.round(Math.min(Math.max(x, d.x - 20), d.x + d.width - 36)), y: Math.round(Math.min(Math.max(y, d.y - 20), d.y + d.height - 36)) };
}
let dragFrom = null;
ipcMain.on('dock:button:dragStart', () => { if (dockButton && !dockButton.isDestroyed()) dragFrom = dockButton.getBounds(); });
ipcMain.on('dock:button:drag', (_e, { dx, dy }) => {
  if (!dragFrom || !dockButton || dockButton.isDestroyed()) return;
  const p = clampToDisplays(dragFrom.x + dx, dragFrom.y + dy);
  dockButton.setBounds({ x: p.x, y: p.y, width: 56, height: 56 });
});
ipcMain.on('dock:button:dragEnd', () => {
  dragFrom = null;
  if (!dockButton || dockButton.isDestroyed()) return;
  const { x, y } = dockButton.getBounds();
  try { fs.writeFileSync(BUTTON_POS, JSON.stringify({ x, y })); } catch {}
});
ipcMain.on('dock:button:reset', () => {
  try { fs.unlinkSync(BUTTON_POS); } catch {}
  if (dockButton && !dockButton.isDestroyed()) { const b = screen.getPrimaryDisplay().bounds; dockButton.setBounds({ x: b.x, y: b.y, width: 56, height: 56 }); }
});

function createDockButton() {
  if (dockButton && !dockButton.isDestroyed()) return;
  const { x, y } = savedButtonPos() || screen.getPrimaryDisplay().bounds;
  dockButton = new BrowserWindow({
    x, y, width: 56, height: 56, frame: false, resizable: false, movable: true,
    minimizable: false, maximizable: false, skipTaskbar: true, alwaysOnTop: true,
    transparent: true, hasShadow: false,
    webPreferences: dockWebPrefs(),
  });
  dockButton.setAlwaysOnTop(true, 'floating');
  dockButton.setVisibleOnAllWorkspaces(true);
  dockButton.loadFile(path.join(HERE, 'dock', 'button.html'));
  dockButton.on('closed', () => { dockButton = null; });
}

function toggleDockPanel() {
  if (dockPanel && !dockPanel.isDestroyed()) { dockPanel.close(); return; }
  // position: next to the button (or top-left if button gone)
  const bx = (dockButton && !dockButton.isDestroyed()) ? dockButton.getBounds() : { x: 0, y: 0, width: 56, height: 0 };
  const { bounds } = screen.getPrimaryDisplay();
  const pw = 380, ph = 600;
  const px = Math.min(bx.x + bx.width + 4, bounds.width - pw - 8);
  const py = Math.max(Math.min(bx.y, bounds.height - ph - 8), 0);
  dockPanel = new BrowserWindow({
    x: px, y: py, width: pw, height: ph, frame: false, resizable: false, movable: true,
    minimizable: false, maximizable: false, skipTaskbar: true, alwaysOnTop: true,
    webPreferences: dockWebPrefs(),
  });
  dockPanel.setAlwaysOnTop(true, 'floating');
  dockPanel.setVisibleOnAllWorkspaces(true);
  dockPanel.loadFile(path.join(HERE, 'dock', 'index.html'), { query: { project } }); // the panel pre-fills the repo field with it
  dockPanel.on('closed', () => { dockPanel = null; });
}

function pushState(state) {
  if (dockPanel && !dockPanel.isDestroyed()) dockPanel.webContents.send('dock:state', state);
  if (consoleWindow && !consoleWindow.isDestroyed()) consoleWindow.webContents.send('dock:state', state);
}

// ── Dock IPC ──────────────────────────────────────────────────────────────────
ipcMain.on('dock:run', (_e, { agent, target }) => {
  dockBridge?.cancel();
  dockBridge = runAgent({ agent, target, onState: pushState });
});

ipcMain.on('dock:cancel', () => { dockBridge?.cancel(); dockBridge = null; });

ipcMain.on('dock:open', (_e, { what, runDir }) => { openArtifact(what, runDir); });
ipcMain.on('dock:console', (_e, { runDir }) => { openConsole(runDir); });

ipcMain.on('dock:lens', () => openLens());

// ── Spatial context (spec section 17) ────────────────────────────────────────
// Capture only on the look hotkey or the Dock's "look at my screen" button; one window, in memory, flashed amber.
const gate = createCaptureGate({ userExcludes: (process.env.HUMBLE_NEVER_CAPTURE || '').split(',').map((x) => x.trim()).filter(Boolean) });
let lastLook = null;

async function grabWindow(win) {
  const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: win.bounds.width, height: win.bounds.height } });
  const src = sources.find((x) => x.id.startsWith(`window:${win.hwnd}:`));
  if (!src) throw new Error(`window "${win.title}" could not be captured`);
  return src.thumbnail.toPNG();
}

function flash(rect) {
  const w = new BrowserWindow({ ...rect, frame: false, transparent: true, focusable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, resizable: false, show: false });
  w.setIgnoreMouseEvents(true);
  w.loadURL('data:text/html,' + encodeURIComponent('<body style="margin:0;height:100vh;box-sizing:border-box;border:3px solid #f5a623;border-radius:10px;box-shadow:inset 0 0 18px #f5a62380"></body>'));
  w.once('ready-to-show', () => { w.showInactive(); setTimeout(() => !w.isDestroyed() && w.close(), 1000); });
}

async function lookAtScreen(source, want = {}) {
  gate.allow(source);
  const r = await look(gate, {
    readWindows, ocrPng,
    displays: screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor })),
    grab: async (win) => { flash(physRect(win)); return grabWindow(win); },
  }, { hints: { repo: path.basename(project), cwd: project }, ...want });
  lastLook = r;
  const out = { ok: r.ok, reason: r.reason, how: r.how, lookedAt: r.lookedAt && { app: r.lookedAt.app, title: r.lookedAt.title }, target: r.target, captures: gate.log() };
  pushState({ spatial: out });
  return out;
}
const physRect = (win) => screen.screenToDipRect ? screen.screenToDipRect(null, win.bounds) : win.bounds;

ipcMain.handle('spatial:look', (_e, want) => lookAtScreen('button', want || {}).catch((e) => ({ ok: false, reason: e.message, captures: gate.log() })));
// Text-only view for Bob (redacted lines + ids); marks the capture log so the security tab can say "Bob saw text".
ipcMain.handle('spatial:forBob', () => (lastLook?.ocr ? bobPayload(lastLook.map, lastLook.ocr, lastLook.lookedAt?.entry) : null));
ipcMain.on('dock:toggle', () => toggleDockPanel());

if (!app.requestSingleInstanceLock()) app.quit();

async function capture(display) {
  const { width, height } = display.size;
  const sf = display.scaleFactor;
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(width * sf), height: Math.round(height * sf) } });
  const src = sources.find((s) => String(s.display_id) === String(display.id)) || sources[0];
  return src.thumbnail.toDataURL();
}

async function openLens() {
  if (busy) return;
  if (overlay) { overlay.close(); return; }
  busy = true;
  try {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const shot = await capture(display);
    const { x, y, width, height } = display.bounds;
    overlay = new BrowserWindow({
      x, y, width, height, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false,
      thickFrame: false, enableLargerThanScreen: true, skipTaskbar: true, alwaysOnTop: true, show: false, backgroundColor: '#000000', hasShadow: false,
      webPreferences: { preload: path.join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true },
    });
    overlay.setAlwaysOnTop(true, 'screen-saver');
    overlay.setVisibleOnAllWorkspaces(true);
    overlay.on('closed', () => { overlay = null; });
    await overlay.loadFile(path.join(HERE, 'overlay.html'));
    overlay.webContents.send('lens:shot', { image: shot, scale: display.scaleFactor, project: path.basename(project), hotkey });
    overlay.show();
    overlay.setBounds(display.bounds); // Windows clamps new windows to the work area; cover the taskbar too
    overlay.focus();
    if (process.env.FIRSTRUN_LENS_DEBUG) console.log('display', display.bounds, display.workArea, display.scaleFactor, 'window', overlay.getBounds());
  } catch (e) {
    dialog.showErrorBox('HUMBLE Lens', `Could not capture the screen: ${e.message}`);
    overlay?.close();
  } finally {
    busy = false;
  }
}

function openConsole(runDir) {
  if (dockPanel && !dockPanel.isDestroyed()) {
    dockPanel.webContents.send('dock:state', { what: 'console', runDir });
  }
  if (consoleWindow && !consoleWindow.isDestroyed()) {
    consoleWindow.focus();
    return;
  }

  // Anchor next to dockPanel, dockButton, or top-left (spec §2)
  const { bounds } = screen.getPrimaryDisplay();
  const pw = 380, ph = 600;
  let px = 100, py = 100;
  if (dockPanel && !dockPanel.isDestroyed()) {
    const db = dockPanel.getBounds();
    px = Math.min(db.x + db.width + 6, bounds.width - pw - 8);
    py = db.y;
  } else if (dockButton && !dockButton.isDestroyed()) {
    const bb = dockButton.getBounds();
    px = Math.min(bb.x + bb.width + 6, bounds.width - pw - 8);
    py = bb.y;
  }

  consoleWindow = new BrowserWindow({
    x: px, y: py, width: pw, height: ph, frame: false, resizable: false, movable: true,
    minimizable: false, maximizable: false, skipTaskbar: true, alwaysOnTop: true,
    webPreferences: dockWebPrefs(),
  });
  consoleWindow.setAlwaysOnTop(true, 'floating');
  consoleWindow.setVisibleOnAllWorkspaces(true);
  consoleWindow.loadFile(path.join(HERE, 'humble', 'console.html'), { query: { project: runDir || project } });
  consoleWindow.on('closed', () => { consoleWindow = null; });
}

// ── Onboarder & Console IPC Handlers ──────────────────────────────────────────
ipcMain.handle('dock:probe', async () => {
  const { probeHost } = await import('../src/onboarder/probe.js');
  return probeHost();
});

ipcMain.handle('dock:getGuide', async (_e, targetProject) => {
  const proj = path.resolve(targetProject || project);
  const { buildGuide } = await import('../src/onboarder/guide.js');
  const candidates = [
    path.join(proj, '.firstrun'),
    proj,
    path.join(HERE, '..', 'web', 'public', 'data', 'runs', 'acme-shop-3c0bc2b2', 'f'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'run.json')) && fs.existsSync(path.join(c, 'plan.json')) && fs.existsSync(path.join(c, 'evidence'))) {
      try {
        const guide = buildGuide(c);
        return { ok: true, guide };
      } catch (e) {}
    }
  }
  return { ok: false, error: `No verified run folder found for "${proj}"` };
});

ipcMain.handle('dock:getReel', async (_e, name = 'acme-shop') => {
  const reelFile = path.join(HERE, '..', 'web', 'public', 'data', 'reels', `${name}.json`);
  if (fs.existsSync(reelFile)) {
    return JSON.parse(fs.readFileSync(reelFile, 'utf8'));
  }
  return null;
});

async function evaluateStepCheck(check, repoRoot) {
  if (!check) return false; // missing check = unknown, never pass
  if (check.type === 'file-has') {
    const f = path.join(repoRoot, check.file);
    if (!fs.existsSync(f)) return false;
    const content = fs.readFileSync(f, 'utf8');
    return new RegExp(check.pattern).test(content);
  }
  if (check.type === 'exit') {
    // exit check must run the step and use its real exit code
    // This is evaluated in runStep after the command completes
    return false; // will be re-evaluated with actual exit code
  }
  if (check.type === 'http') {
    try {
      const res = await fetch(check.url);
      return res.status === (check.expect || 200);
    } catch {
      return false;
    }
  }
  return false;
}

ipcMain.handle('dock:runStep', async (_e, { command, cwd, check }) => {
  const repoRoot = path.resolve(cwd || project);
  const { classify } = await import('../src/onboarder/guard.js');
  const guard = classify(command, { repoDir: repoRoot });
  if (guard.verdict === 'block') {
    return { ok: false, blocked: true, reason: guard.reason, ruleId: guard.ruleId };
  }

  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : (process.env.SHELL || '/bin/bash');
    const shellArgs = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command];
    const proc = spawn(shell, shellArgs, { cwd: repoRoot, env: process.env });
    let stdout = '', stderr = '';

    proc.stdout?.on('data', (d) => {
      const chunk = d.toString();
      stdout += chunk;
      consoleWindow?.webContents.send('dock:step:output', { stream: 'stdout', text: chunk });
      dockPanel?.webContents.send('dock:step:output', { stream: 'stdout', text: chunk });
    });

    proc.stderr?.on('data', (d) => {
      const chunk = d.toString();
      stderr += chunk;
      consoleWindow?.webContents.send('dock:step:output', { stream: 'stderr', text: chunk });
      dockPanel?.webContents.send('dock:step:output', { stream: 'stderr', text: chunk });
    });

    proc.on('close', async (code) => {
      let checkPassed = false;
      if (check) {
        if (check.type === 'exit') {
          checkPassed = code === 0;
        } else {
          checkPassed = await evaluateStepCheck(check, repoRoot);
        }
      } else {
        checkPassed = code === 0;
      }
      resolve({
        ok: checkPassed && code === 0,
        exitCode: code,
        stdout,
        stderr,
        checkPassed,
        warn: guard.verdict === 'warn' ? guard.reason : null,
      });
    });

    proc.on('error', (err) => {
      resolve({ ok: false, exitCode: -1, error: err.message, checkPassed: false });
    });
  });
});

ipcMain.handle('dock:checkStep', async (_e, { check, cwd }) => {
  const repoRoot = path.resolve(cwd || project);
  return evaluateStepCheck(check, repoRoot);
});

// The overlay sends the circled area; answer from proven fixes first, then offer Bob.
ipcMain.handle('lens:read', async (_e, { png }) => {
  const buf = Buffer.from(png.split(',')[1], 'base64');
  const t0 = Date.now();
  const text = await ocr(buf, CACHE);
  const known = matchKnownFix(text, loadKnownFixes(project));
  const imageFile = path.join(os.tmpdir(), `firstrun-lens-${Date.now()}.png`);
  fs.writeFileSync(imageFile, buf);
  return { text, known, imageFile, ms: Date.now() - t0 };
});

ipcMain.handle('lens:ask', async (_e, { text, question, imageFile }) => {
  const r = await askBobAbout({ project, text, question, imageFile });
  return { ok: r.ok, json: r.json, text: r.text, error: r.error, bobcoins: r.bobcoins || 0, ms: r.ms };
});

ipcMain.on('lens:copy', (_e, s) => clipboard.writeText(String(s)));
ipcMain.on('lens:close', () => overlay?.close());

function trayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-90 -180 897 897"><rect x="-90" y="-180" width="897" height="897" rx="180" fill="#0d1030"/><g fill="#fffefe"><polygon points="0 358.46 179.23 358.46 179.23 537.7 268.85 537.7 268.85 268.85 0 268.85 0 358.46"/><polygon points="537.7 179.23 537.7 0 268.85 0 268.85 268.85 358.47 268.85 358.47 89.61 448.09 89.61 448.09 268.85 716.94 268.85 716.94 179.23 537.7 179.23"/></g></svg>`; // brand face, lens/assets/humble-face.svg
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`).resize({ width: 16, height: 16 });
}

function buildTray() {
  tray ??= new Tray(trayIcon());
  tray.setToolTip(`HUMBLE Lens · ${hotkey || 'no hotkey'} · ${project}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Circle to ask  (${hotkey || 'no hotkey'})`, click: openLens },
    { label: 'Open HUMBLE Dock', click: toggleDockPanel },
    { label: `Project: ${path.basename(project)}`, enabled: false },
    { label: 'Change project folder…', click: async () => {
      const r = await dialog.showOpenDialog({ properties: ['openDirectory'], defaultPath: project });
      if (!r.canceled && r.filePaths[0]) { project = r.filePaths[0]; buildTray(); }
    } },
    { type: 'separator' },
    { label: 'Quit HUMBLE Lens', click: () => app.quit() },
  ]));
  tray.on('click', openLens);
}

app.whenReady().then(() => {
  hotkey = HOTKEYS.find((k) => globalShortcut.register(k, openLens)) || null;
  // Dock hotkey toggles the panel; try each candidate, stop at first success.
  let dockHotkey = DOCK_HOTKEYS.find((k) => globalShortcut.register(k, toggleDockPanel)) || null;
  LOOK_HOTKEYS.find((k) => globalShortcut.register(k, () => lookAtScreen('hotkey').catch((e) => pushState({ spatial: { ok: false, reason: e.message } }))));
  buildTray();
  createDockButton();
  warmOcr(CACHE).catch(() => {});
  console.log(`HUMBLE Lens ready. Press ${hotkey || '(no hotkey available; click the tray icon)'} and circle anything. Project: ${project}`);
  console.log(`HUMBLE Dock ready. ${dockHotkey ? `Press ${dockHotkey} or click` : 'Click'} the Bob button (top-left) to open it.`);
});
app.on('window-all-closed', (e) => e.preventDefault?.()); // stay in the tray
app.on('will-quit', () => globalShortcut.unregisterAll());