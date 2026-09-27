// Spatial context, layer 1: the window map (spec section 17). Deterministic, no pixels: which windows are open, where,
// on which screen, and which of them matter for setup (the project's terminal, its editor, the browser on localhost,
// Docker Desktop). Enumeration is a read-only PowerShell/user32 helper on Windows; classification is pure and tested.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const APPS = {
  terminal: ['windowsterminal', 'cmd', 'conhost', 'powershell', 'pwsh', 'wezterm-gui', 'alacritty', 'mintty', 'hyper', 'tabby', 'warp', 'iterm2', 'terminal', 'kitty', 'ghostty'],
  editor: ['code', 'code - insiders', 'cursor', 'windsurf', 'ibm bob', 'devenv', 'idea64', 'pycharm64', 'webstorm64', 'goland64', 'rider64', 'sublime_text', 'notepad++', 'zed', 'notepad'],
  browser: ['chrome', 'msedge', 'firefox', 'brave', 'opera', 'vivaldi', 'arc', 'safari'],
  docker: ['docker desktop'],
};
// Windows that are never useful targets: the desktop, overlays, shell surfaces.
const IGNORE_APPS = ['nvidia overlay', 'textinputhost', 'shellexperiencehost', 'searchhost', 'startmenuexperiencehost', 'lockapp'];
const IGNORE_CLASSES = ['Progman', 'WorkerW', 'Shell_TrayWnd', 'Windows.UI.Core.CoreWindow', 'CEF-OSC-WIDGET'];
const EDITOR_TITLE = / - (Visual Studio Code|Cursor|Windsurf|IBM Bob|Sublime Text|Notepad\+\+|Zed)$/;

export function roleOf(win) {
  const app = String(win.app || '').toLowerCase();
  if (win.cls === 'ConsoleWindowClass' || win.cls === 'CASCADIA_HOSTING_WINDOW_CLASS') return 'terminal';
  for (const [role, apps] of Object.entries(APPS)) if (apps.includes(app)) return role;
  if (EDITOR_TITLE.test(win.title || '')) return 'editor';
  if (/^Docker Desktop/i.test(win.title || '')) return 'docker';
  return 'other';
}

export function ignorable(win) {
  return IGNORE_APPS.includes(String(win.app || '').toLowerCase()) || IGNORE_CLASSES.includes(win.cls);
}

// Screen of a rect = the monitor holding its centre (else the nearest one). screen1 is the primary monitor.
export function orderMonitors(monitors) {
  return [...monitors].sort((a, b) => (b.primary === true) - (a.primary === true) || a.x - b.x || a.y - b.y);
}
export function screenOf(rect, monitors) {
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
  let best = 0, bestD = Infinity;
  monitors.forEach((m, i) => {
    const dx = Math.max(m.x - cx, 0, cx - (m.x + m.width)), dy = Math.max(m.y - cy, 0, cy - (m.y + m.height));
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best + 1;
}

const norm = (s) => String(s || '').toLowerCase().replace(/\\/g, '/');

// hints: { repo: 'express-typescript', cwd: 'C:/Code/x', port: 3000, pageTitle: 'My App' }
export function classify(raw, hints = {}) {
  const monitors = orderMonitors(raw.monitors || []);
  const repo = norm(hints.repo), cwd = norm(hints.cwd), cwdBase = cwd.split('/').filter(Boolean).pop() || '';
  const port = hints.port ? String(hints.port) : '';
  const out = [];
  for (const w of raw.windows || []) {
    if (ignorable(w)) continue;
    const role = roleOf(w);
    const t = norm(w.title);
    const entry = {
      id: `W${out.length + 1}`, hwnd: w.hwnd, app: w.app, title: w.title, role,
      bounds: { x: w.x, y: w.y, width: w.width, height: w.height },
      screen: monitors.length ? screenOf(w, monitors) : 1, z: w.z, focused: !!w.focused,
    };
    if ((role === 'terminal' || role === 'editor') && ((repo && t.includes(repo)) || (cwd && t.includes(cwd)) || (cwdBase && t.includes(cwdBase)))) entry.project = true;
    if (role === 'browser') {
      const onLocal = /\b(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/.test(t);
      if ((onLocal && (!port || t.includes(':' + port) || !/:\d+/.test(t))) || (hints.pageTitle && t.includes(norm(hints.pageTitle)))) entry.localhost = true;
    }
    out.push(entry);
  }
  return { monitors: monitors.map((m, i) => ({ screen: i + 1, ...m })), windows: out };
}

// The window HUMBLE should use for a role: flagged project/localhost window first, then the top-most of that role.
export function pick(map, role) {
  const ofRole = map.windows.filter((w) => w.role === role);
  const flag = role === 'browser' ? 'localhost' : 'project';
  return ofRole.find((w) => w[flag]) || (role === 'terminal' ? ofRole.find((w) => w.focused) || ofRole[0] : null) || null;
}

export function readWindows({ timeoutMs = 8000 } = {}) {
  if (process.platform !== 'win32') return Promise.reject(new Error('window map: only Windows is implemented (macOS: CGWindowListCopyWindowInfo, planned)'));
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(HERE, 'windows.ps1')],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 << 20 }, (err, stdout) => {
        if (err) return reject(err);
        try { resolve(JSON.parse(stdout)); } catch (e) { reject(new Error('window map: bad JSON from helper')); }
      });
  });
}

export async function windowMap(hints) {
  return classify(await readWindows(), hints);
}
