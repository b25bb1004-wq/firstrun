// Spatial context, the whole "look at my screen" pass (spec section 17), Electron-agnostic so it is testable:
// window map -> pick the window -> gated capture -> local OCR -> find the line -> verify -> overlay target.
// deps: { readWindows, grab(win) -> png, ocrPng(png) -> {width,height,lines}, displays: [{ id, bounds, scaleFactor }] }
import { classify, pick } from './windows.js';
import { matchDisplays, physRectToDip, imageBoxToScreen, beamPoint, screenToOverlay } from './coords.js';
import { findOnScreen } from './match.js';
import { verifyPoint } from './point.js';


// want: { role = 'terminal', matchedLine?, command?, hints: { repo, cwd, port } }
export async function look(gate, deps, want = {}) {
  const raw = await deps.readWindows();
  const map = classify(raw, want.hints || {});
  const win = pick(map, want.role || 'terminal');
  if (!win) return { ok: false, reason: `no ${want.role || 'terminal'} window found`, map };
  const pairs = matchDisplays(map.monitors, deps.displays);
  const winDip = physRectToDip(win.bounds, pairs);
  const shot = await gate.capture(win, deps.grab); // throws without a hotkey/button grant or for denied windows
  const ocr = await deps.ocrPng(shot.png);
  shot.png = null; // discarded after OCR
  const hit = findOnScreen(ocr, want);
  const line = hit.error || hit.prompt;
  const lookedAt = { app: win.app, title: win.title, windowDip: strip(winDip), entry: shot.entry };
  if (!line) return { ok: true, lookedAt, target: windowTarget(win, winDip), how: 'window', map, ocr };

  // Re-read the map right before the flight: the window must still be where it was captured.
  const again = classify(await deps.readWindows(), want.hints || {});
  const liveBounds = (id) => { const w = again.windows.find((x) => x.hwnd === map.windows.find((m) => m.id === id)?.hwnd); return w ? w.bounds : null; };
  const v = verifyPoint({ id: line.id, label: '' }, { map, ocr, ocrWindowId: win.id, liveBounds });
  if (!v.ok) return { ok: false, reason: v.reason, lookedAt, map, ocr };
  const box = imageBoxToScreen(line, ocr, winDip);
  const beam = beamPoint(box);
  return {
    ok: true, lookedAt, how: hit.error ? hit.how : 'prompt', map, ocr,
    target: { kind: 'box', id: line.id, text: line.text, box, beam, display: winDip.display.id, overlay: screenToOverlay(beam, winDip.display) },
  };
}

function strip(r) { return { x: r.x, y: r.y, width: r.width, height: r.height }; }
function windowTarget(win, winDip) {
  const beam = { x: winDip.x + 24, y: winDip.y + winDip.height - 24 };
  return { kind: 'window', id: win.id, box: strip(winDip), beam, display: winDip.display.id, overlay: screenToOverlay(beam, winDip.display) };
}
