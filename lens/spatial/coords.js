// Spatial context: coordinate spaces (spec section 17). image = captured thumbnail pixels (OCR boxes);
// physical = desktop pixels from the DPI-aware window map; screen = Electron DIP across displays; overlay = CSS
// pixels inside one display's overlay. Pure; mixed DPI, two monitors and negative offsets are covered by tests.

// Pair the helper's physical monitors with Electron displays ({ bounds (DIP), scaleFactor }) by physical size.
export function matchDisplays(monitors, displays) {
  const left = [...displays];
  return monitors.map((m) => {
    let best = -1, bestScore = Infinity;
    left.forEach((d, i) => {
      const score = Math.abs(Math.round(d.bounds.width * d.scaleFactor) - m.width) + Math.abs(Math.round(d.bounds.height * d.scaleFactor) - m.height)
        + (Math.sign(d.bounds.x) !== Math.sign(m.x)) + (Math.sign(d.bounds.y) !== Math.sign(m.y));
      if (score < bestScore) { bestScore = score; best = i; }
    });
    return { monitor: m, display: best >= 0 ? left.splice(best, 1)[0] : null };
  });
}

const dist2 = (r, p) => {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width)), dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  return dx * dx + dy * dy;
};

// Physical point -> DIP through the monitor holding it (else the nearest one).
export function physToDip(pt, pairs) {
  const pair = pairs.filter((p) => p.display).reduce((a, p) => (!a || dist2(p.monitor, pt) < dist2(a.monitor, pt) ? p : a), null);
  const { monitor: m, display: d } = pair;
  return { x: d.bounds.x + (pt.x - m.x) / d.scaleFactor, y: d.bounds.y + (pt.y - m.y) / d.scaleFactor, display: d };
}

export function physRectToDip(r, pairs) {
  const a = physToDip({ x: r.x, y: r.y }, pairs);
  return { x: a.x, y: a.y, width: r.width / a.display.scaleFactor, height: r.height / a.display.scaleFactor, display: a.display };
}

// OCR box (image pixels) -> screen DIP; the thumbnail maps onto the window's DIP rect whatever its size.
export function imageBoxToScreen(box, image, win) {
  const sx = win.width / image.width, sy = win.height / image.height;
  return { x: win.x + box.x * sx, y: win.y + box.y * sy, width: box.width * sx, height: box.height * sy };
}

export const screenToOverlay = (pt, display) => ({ x: pt.x - display.bounds.x, y: pt.y - display.bounds.y });

export const displayAt = (pt, displays) => displays.find((d) => dist2(d.bounds, pt) === 0 && pt.x < d.bounds.x + d.bounds.width && pt.y < d.bounds.y + d.bounds.height) || null;

export function clampToDisplay(pt, display, margin = 8) {
  const b = display.bounds;
  return { x: Math.min(Math.max(pt.x, b.x + margin), b.x + b.width - margin), y: Math.min(Math.max(pt.y, b.y + margin), b.y + b.height - margin) };
}

// Target on another screen: wait at this display's edge in the target's direction ("over on your other screen").
export function edgeToward(target, display, margin = 24) {
  const b = display.bounds, cx = b.x + b.width / 2, cy = b.y + b.height / 2, dx = target.x - cx, dy = target.y - cy;
  const t = Math.min(dx ? (b.width / 2 - margin) / Math.abs(dx) : Infinity, dy ? (b.height / 2 - margin) / Math.abs(dy) : Infinity, 1);
  return { x: cx + dx * t, y: cy + dy * t };
}

// Beam lands at the start of the line, vertically centred (terminal lines read left to right).
export const beamPoint = (box) => ({ x: box.x + Math.min(24, box.width / 2), y: box.y + box.height / 2 });
