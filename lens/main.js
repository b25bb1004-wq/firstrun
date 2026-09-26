// FirstRun Lens: press the hotkey, circle anything on screen, get an answer.
//   npx electron lens [project dir]      (or: node bin/firstrun.js lens [project dir])
// FirstRun Dock: floating always-on-top button + panel (issue #90, DOCK_CONTRACT §4-5).
import { app, BrowserWindow, globalShortcut, desktopCapturer, screen, ipcMain, Tray, Menu, nativeImage, dialog, clipboard } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ocr, warmOcr, loadKnownFixes, matchKnownFix, askBobAbout } from './engine.js';
import { runAgent, open as openArtifact } from './dock-bridge.js';
import { initialState } from '../src/dock-state.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOTKEYS = ['CommandOrControl+Shift+Space', 'Alt+Shift+Q'];
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

const PRELOAD_DOCK = path.join(HERE, 'dock-preload.cjs');

function dockWebPrefs() {
  return { preload: PRELOAD_DOCK, contextIsolation: true, sandbox: true };
}

function createDockButton() {
  if (dockButton && !dockButton.isDestroyed()) return;
  const { x, y } = screen.getPrimaryDisplay().bounds;
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
  dockPanel.loadFile(path.join(HERE, 'dock', 'index.html'), { query: { project } });
  dockPanel.webContents.on('did-finish-load', () => {
    pushState(initialState(project, 'all'));
  });
  dockPanel.on('closed', () => { dockPanel = null; });
}

function pushState(state) {
  if (dockPanel && !dockPanel.isDestroyed()) dockPanel.webContents.send('dock:state', state);
}

// ── Dock IPC ──────────────────────────────────────────────────────────────────
ipcMain.on('dock:run', (_e, { agent, target }) => {
  dockBridge?.cancel();
  dockBridge = runAgent({ agent, target, onState: pushState });
});

ipcMain.on('dock:cancel', () => { dockBridge?.cancel(); dockBridge = null; });

ipcMain.on('dock:open', (_e, { what, runDir }) => { openArtifact(what, runDir); });

ipcMain.on('dock:lens', () => openLens());
ipcMain.on('dock:toggle', () => toggleDockPanel());
ipcMain.on('dock:secret:set', async (_e, { name, value }) => {
  try {
    const { setSecret } = await import('../src/secrets.js');
    setSecret(name, value);
  } catch (err) {
    console.error('Failed to set secret:', err.message);
  }
});
ipcMain.on('dock:ask:answer', (_e, { id, answer }) => {
  dockBridge?.answerAsk?.(id, answer);
});

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
    dialog.showErrorBox('FirstRun Lens', `Could not capture the screen: ${e.message}`);
    overlay?.close();
  } finally {
    busy = false;
  }
}

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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="6" fill="#0E1726"/><circle cx="16" cy="16" r="8" stroke="#3DD68C" stroke-width="3" fill="none"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`).resize({ width: 16, height: 16 });
}

function buildTray() {
  tray ??= new Tray(trayIcon());
  tray.setToolTip(`FirstRun Lens · ${hotkey || 'no hotkey'} · ${project}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Circle to ask  (${hotkey || 'no hotkey'})`, click: openLens },
    { label: 'Open HUMBLE Dock', click: toggleDockPanel },
    { label: `Project: ${path.basename(project)}`, enabled: false },
    { label: 'Change project folder…', click: async () => {
      const r = await dialog.showOpenDialog({ properties: ['openDirectory'], defaultPath: project });
      if (!r.canceled && r.filePaths[0]) { project = r.filePaths[0]; buildTray(); }
    } },
    { type: 'separator' },
    { label: 'Quit FirstRun Lens', click: () => app.quit() },
  ]));
  tray.on('click', openLens);
}

app.whenReady().then(() => {
  hotkey = HOTKEYS.find((k) => globalShortcut.register(k, openLens)) || null;
  // Dock hotkey toggles the panel; try each candidate, stop at first success.
  let dockHotkey = DOCK_HOTKEYS.find((k) => globalShortcut.register(k, toggleDockPanel)) || null;
  buildTray();
  createDockButton();
  warmOcr(CACHE).catch(() => {});
  console.log(`FirstRun Lens ready. Press ${hotkey || '(no hotkey available; click the tray icon)'} and circle anything. Project: ${project}`);
  console.log(`HUMBLE Dock ready. ${dockHotkey ? `Press ${dockHotkey} or click` : 'Click'} the Bob button (top-left) to open it.`);
});
app.on('window-all-closed', (e) => e.preventDefault?.()); // stay in the tray
app.on('will-quit', () => globalShortcut.unregisterAll());
