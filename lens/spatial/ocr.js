// Spatial context, layer 2: local OCR (Windows.Media.Ocr through ocr.ps1). The PNG goes over stdin and stays in
// memory; nothing is written to disk and nothing leaves the machine. Lines get stable ids (B1, B2 …) so Bob can
// cite a line without ever seeing the screenshot.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Windows OCR splits monospace terminal text into column fragments ("npm" / "ERR!" / "code EBADENGINE") and returns
// them column by column. Rebuild screen rows: fragments whose vertical centres sit within half a line height of each
// other are one row, read left to right.
export function mergeRows(lines) {
  const frags = lines.filter((l) => l.text && l.width > 0 && l.height > 0).map((l) => ({ ...l, cy: l.y + l.height / 2 }));
  if (!frags.length) return [];
  const hs = frags.map((f) => f.height).sort((a, b) => a - b), tol = hs[hs.length >> 1] / 2;
  const rows = [];
  for (const f of frags.sort((a, b) => a.cy - b.cy)) {
    const row = rows.find((r) => Math.abs(r.cy - f.cy) <= tol);
    if (row) { row.parts.push(f); row.cy = row.parts.reduce((s, p) => s + p.cy, 0) / row.parts.length; } else rows.push({ cy: f.cy, parts: [f] });
  }
  return rows.map(({ parts }) => {
    parts.sort((a, b) => a.x - b.x);
    const x = Math.min(...parts.map((p) => p.x)), y = Math.min(...parts.map((p) => p.y));
    const x2 = Math.max(...parts.map((p) => p.x + p.width)), y2 = Math.max(...parts.map((p) => p.y + p.height));
    return { text: parts.map((p) => p.text).join(' ').replace(/\bn pm\b/g, 'npm'), x, y, width: x2 - x, height: y2 - y };
  });
}

export function withIds(result) {
  return { width: result.width, height: result.height, lines: mergeRows(result.lines || []).map((l, i) => ({ id: `B${i + 1}`, ...l })) };
}

export function ocrPng(png, { timeoutMs = 20000 } = {}) {
  if (process.platform !== 'win32') return Promise.reject(new Error('local OCR: only Windows is implemented (macOS: Vision, planned)'));
  return new Promise((resolve, reject) => {
    const child = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(HERE, 'ocr.ps1')],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 16 << 20 }, (err, stdout) => {
        if (err) return reject(err);
        try { resolve(withIds(JSON.parse(stdout))); } catch { reject(new Error('local OCR: bad JSON from helper')); }
      });
    child.stdin.end(Buffer.from(png).toString('base64'));
  });
}
