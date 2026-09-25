// Small shared helpers for the dashboard. No dependencies.

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Raw(String(s));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = v => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(fmt).join('') : esc(v));
// Tagged template: interpolations are escaped unless wrapped in raw()/h``.
export function h(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += fmt(vals[i]); });
  return new Raw(out);
}

export async function api(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}
export async function apiText(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.text();
}

export function dur(ms) {
  if (ms == null || isNaN(ms)) return '';
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m${String(Math.round(s % 60)).padStart(2, '0')}s`;
}
export function secs(n) { return dur((n || 0) * 1000); }
export function clock(ms) {
  if (ms == null || isNaN(ms) || ms < 0) ms = 0;
  const t = Math.floor(ms / 1000), hh = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), ss = t % 60;
  const p = n => String(n).padStart(2, '0');
  return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
}
export const short = sha => (sha || '').slice(0, 7);
export const when = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const STATUS_LABEL = {
  pending: 'Pending', running: 'Running', passed: 'Passed', failed: 'Failed', repaired: 'Repaired',
  skipped: 'Skipped', 'needs-human': 'Needs a human',
};
export const CLASS_LABEL = {
  'runtime-version': 'Runtime version', 'missing-script': 'Missing script', 'missing-env': 'Missing env var',
  'missing-service': 'Missing service', 'missing-tool': 'Missing tool', 'missing-dependency': 'Missing dependency',
  'wrong-order': 'Wrong order', 'missing-file': 'Missing file', 'platform-specific': 'Platform-specific',
  'needs-secret': 'Needs a secret', unknown: 'Unknown',
};
export const PHASE_LABEL = {
  scout: 'Scout', plan: 'Plan', coldstart: 'Cold start', repair: 'Repair', replay: 'Replay', publish: 'Publish', done: 'Done', error: 'Error',
};

const I = {
  check: '<path d="M3.5 8.5l3 3 6-7"/>',
  cross: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
  wrench: '<path d="M10.5 2.5a3 3 0 0 0-2.9 3.8L3 10.9 5.1 13l4.6-4.6a3 3 0 0 0 3.8-2.9l-1.8 1-1.6-.4-.4-1.6 1-1.8z"/>',
  skip: '<path d="M4 4l5 4-5 4zM11.5 4v8"/>',
  hand: '<path d="M5.5 8V3.5a1 1 0 0 1 2 0V7m0-3.5a1 1 0 0 1 2 0V7m0-2.5a1 1 0 0 1 2 0V9c0 2.5-1.6 4.5-4 4.5-1.8 0-2.8-.9-3.8-2.5L2.6 8.8a1 1 0 0 1 1.6-1.1L5.5 9"/>',
  dot: '<circle cx="8" cy="8" r="2.5"/>',
  copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5"/>',
  arrow: '<path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>',
  moon: '<path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"/>',
  file: '<path d="M4 1.5h5l3 3v10H4z"/><path d="M9 1.5v3h3"/>',
  back: '<path d="M13 8H4M7.5 4.5L4 8l3.5 3.5"/>',
  bob: '<path d="M8 1.8l5.4 3.1v6.2L8 14.2l-5.4-3.1V4.9z"/><circle cx="8" cy="8" r="1.8"/>',
};
export const icon = (name, cls = '') => raw(`<svg class="ic ${cls}" viewBox="0 0 16 16" aria-hidden="true">${I[name] || ''}</svg>`);
export const STATUS_ICON = { passed: 'check', repaired: 'wrench', failed: 'cross', skipped: 'skip', 'needs-human': 'hand', running: 'dot', pending: 'dot' };

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

// Pick the line of a failing log that a human would recognise.
export function errorSignature(logTail = '') {
  const lines = logTail.split('\n').map(l => l.trim()).filter(Boolean);
  const pats = [/ERR! code (?!1$)\w+/, /Missing script/i, /^[A-Z][\w.]*(Error|Exception)\b/, /FATAL/, /ECONNREFUSED/, /No such file/i, /not found/i, /fatal error|Error:|error:/, /cannot|refused|requires/i];
  for (const p of pats) {
    const k = lines.findIndex(x => p.test(x));
    if (k < 0) continue;
    let l = lines[k];
    if (/[[{]$/.test(l)) { // structured error dump: name the variable it is about
      const rest = lines.slice(k + 1, k + 16).join(' ');
      const v = rest.match(/"([A-Z][A-Z0-9_]{2,})"/);
      const code = rest.match(/"code":\s*"([\w-]+)"/);
      l = l.replace(/\s*[[{]$/, '') + (v ? ` ${v[1]}` : '') + (code ? ` ${code[1]}` : '');
    }
    return l.length > 110 ? l.slice(0, 107) + '...' : l;
  }
  return lines[lines.length - 1] || '';
}
export function isErrorLine(l) {
  return /ERR!|Error|error:|ECONNREFUSED|No such file|not found|FATAL|Traceback|exited-with-error|\*\*\*|401/.test(l);
}

export function fixActionText(a) {
  switch (a.type) {
    case 'rebase': return h`Rebase the sandbox onto <code>${a.image}</code>`;
    case 'service': return h`Start a <code>${a.name}</code> sidecar (${a.image}) on :${a.port}`;
    case 'replace-step': return h`Run <code>${a.command}</code> instead`;
    case 'insert-before': return h`Insert a step before it: <code>${a.command}</code>`;
    case 'exec': return h`Run <code>${a.command}</code> in the sandbox`;
    case 'write': return h`Write <code>${a.path}</code>`;
    default: return h`${a.type}`;
  }
}
export const DOC_LABEL = { 'replace-command': 'README command replaced', 'insert-step': 'README step added', prerequisite: 'README prerequisite updated', note: 'README note added' };

// Deterministic 5x5 mirrored identicon from a hex string.
export function identicon(hex = '', size = 5) {
  const bits = [...(hex || '0').padEnd(16, '0')].map(c => parseInt(c, 16) || 0);
  let cells = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < Math.ceil(size / 2); x++) {
    const on = bits[(y * 3 + x) % bits.length] % 2 === 0;
    if (!on) continue;
    cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    if (x !== size - 1 - x) cells += `<rect x="${size - 1 - x}" y="${y}" width="1" height="1"/>`;
  }
  return raw(`<svg viewBox="-1 -1 ${size + 2} ${size + 2}" class="identicon" aria-hidden="true">${cells}</svg>`);
}

export function rafBatch(fn) {
  // rAF when visible; a timer fallback keeps hidden/background tabs current too.
  let queued = false;
  const run = () => { if (!queued) return; queued = false; fn(); };
  return () => { if (queued) return; queued = true; requestAnimationFrame(run); setTimeout(run, 250); };
}
