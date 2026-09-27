// Spatial context, layers 3-4 (spec section 17): Bob points by citing ids, never pixels, and HUMBLE verifies every
// point before the Lamplighter flies. Also the capture gate: no capture without the hotkey or the "look at my
// screen" button, never of denied windows, and every capture is logged (never the image).
import { squash, overlap } from './match.js';
import { redactSecrets } from '../../src/redact.js';

// [POINT:B17:the error:screen1] | [POINT:W3:your terminal] | [POINT:none]
const TAG = /\[POINT:(none|[BW]\d+)(?::([^:\]]*))?(?::screen(\d+))?\]/;

export function parsePoint(text) {
  const m = TAG.exec(String(text || ''));
  if (!m) return null;
  if (m[1] === 'none') return { none: true };
  return { id: m[1], label: (m[2] || '').trim(), screen: m[3] ? Number(m[3]) : null, spoken: String(text).replace(TAG, '').trim() };
}

// ctx: { map (window map), ocr (lines with ids, from the capture of ocrWindowId), ocrWindowId, liveBounds(id) -> rect|null }
// Returns { ok: true, target } or { ok: false, reason }. Unknown id, stale window, label mismatch => rejected.
export function verifyPoint(point, ctx) {
  if (!point) return { ok: false, reason: 'no POINT tag' };
  if (point.none) return { ok: false, reason: 'Bob found nothing to point at' };
  if (point.id.startsWith('W')) {
    const win = ctx.map?.windows.find((w) => w.id === point.id);
    if (!win) return { ok: false, reason: `unknown window id ${point.id}` };
    const live = ctx.liveBounds?.(win.id);
    if (live === null) return { ok: false, reason: `${point.id} is gone or minimised` };
    return { ok: true, target: { kind: 'window', window: win, bounds: live || win.bounds } };
  }
  const line = ctx.ocr?.lines.find((l) => l.id === point.id);
  if (!line) return { ok: false, reason: `unknown box id ${point.id}` };
  // A descriptive label ("the error") is fine; a label that quotes text must quote THIS box.
  const quoted = (point.label.match(/["'`](.+?)["'`]/) || [])[1];
  if (quoted && overlap(line.text, quoted) < 0.6) return { ok: false, reason: `label "${quoted}" does not match ${point.id}: "${line.text}"` };
  const win = ctx.map?.windows.find((w) => w.id === ctx.ocrWindowId);
  const live = win && ctx.liveBounds?.(win.id);
  if (!win || live === null) return { ok: false, reason: 'the captured window moved away; look again' };
  if (live && (live.x !== win.bounds.x || live.y !== win.bounds.y || live.width !== win.bounds.width || live.height !== win.bounds.height))
    return { ok: false, reason: 'the captured window moved since the capture; look again' };
  return { ok: true, target: { kind: 'box', line, window: win } };
}

// Never captured: password managers, private browsing, anything the user excludes.
export const DENY = ['1password', 'bitwarden', 'keepass', 'keepassxc', 'lastpass', 'dashlane', 'keeper', 'nordpass', 'enpass', 'proton pass', 'credentialuibroker'];
const PRIVATE_TITLE = /InPrivate|Incognito|Private Browsing|Private Window/i;

export function denied(win, userExcludes = []) {
  const app = squash(win.app), title = String(win.title || '');
  if (DENY.some((d) => app === squash(d) || squash(title).includes(squash(d)))) return 'password manager';
  if (PRIVATE_TITLE.test(title)) return 'private browsing window';
  if (userExcludes.some((x) => app === squash(x) || title.toLowerCase().includes(String(x).toLowerCase()))) return 'excluded by you';
  return null;
}

// One-shot grants: only the hotkey or the button handler may call allow(); capture() consumes it within ttlMs.
export function createCaptureGate({ ttlMs = 5000, now = Date.now, userExcludes = [] } = {}) {
  let grant = null;
  const log = [];
  return {
    allow(source) {
      if (source !== 'hotkey' && source !== 'button') throw new Error('capture can only be granted by the hotkey or the "look at my screen" button');
      grant = { source, at: now() };
    },
    // grab(win) does the real capture (Electron desktopCapturer); it only runs when the gate says yes.
    async capture(win, grab) {
      const g = grant; grant = null;
      if (!g || now() - g.at > ttlMs) throw new Error('no capture without the hotkey or the "look at my screen" button');
      const why = denied(win, userExcludes);
      if (why) { log.push({ at: new Date(now()).toISOString(), window: win.title, app: win.app, captured: false, reason: why }); throw new Error(`not captured: ${why}`); }
      const entry = { at: new Date(now()).toISOString(), window: win.title, app: win.app, captured: true, source: g.source, bobSawText: false };
      log.push(entry);
      return { png: await grab(win), entry };
    },
    log: () => log.map((e) => ({ ...e })),
  };
}

// What Bob may see (layer 3): window ids + app/title/role and redacted OCR lines with box ids. No pixels, no
// coordinates, no hwnds. Marks the capture log entry so the security tab can show "Bob saw text".
export function bobPayload(map, ocr, entry) {
  if (entry) entry.bobSawText = !!ocr;
  return {
    windows: (map?.windows || []).map((w) => ({ id: w.id, app: w.app, title: redactSecrets(w.title), role: w.role, screen: w.screen })),
    lines: (ocr?.lines || []).map((l) => `${l.id}: ${JSON.stringify(redactSecrets(l.text))}`),
    answer: 'Reply with one tag: [POINT:<B# or W#>:<short label>:screen<N>] or [POINT:none]. Cite only ids listed here.',
  };
}
