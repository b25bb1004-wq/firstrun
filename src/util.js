import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Run a process and collect its output. Never rejects on a non-zero exit;
 * callers inspect `code`. `onData` receives stdout+stderr chunks as they arrive.
 */
export function run(cmd, args, { cwd, input, onData, timeoutMs, env } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(cmd, args, { cwd, env: env ? { ...process.env, ...env } : process.env, windowsHide: true });
    let out = '';
    let timedOut = false;
    const onChunk = (b) => {
      const s = b.toString('utf8');
      out += s;
      if (out.length > 4_000_000) out = out.slice(-2_000_000);
      onData?.(s);
    };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);
    const timer = timeoutMs ? setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs) : null;
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({ code: 127, out: `${out}${err.message}\n`, durationMs: Date.now() - started, timedOut });
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: timedOut ? 124 : (code ?? 1), out, durationMs: Date.now() - started, timedOut });
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

/** Like run() but throws when the exit code is non-zero. Returns stdout+stderr. */
export async function must(cmd, args, opts) {
  const r = await run(cmd, args, opts);
  if (r.code !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.code}): ${tail(r.out, 20)}`);
  return r.out;
}

export function tail(text, lines = 60) {
  const all = String(text ?? '').replace(/\r\n/g, '\n').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').split('\n');
  while (all.length && all[all.length - 1] === '') all.pop();
  return all.slice(-lines).join('\n');
}

/** The start and the end of a long log: npm and node-gyp print the failing command first, then
 * pages of compiler notes, so the tail alone can miss the cause. Short logs come back whole. */
export function headTail(text, head = 60, tailLines = 200) {
  const all = tail(text, Infinity).split('\n');
  if (all.length <= head + tailLines) return all.join('\n');
  return [...all.slice(0, head), `[… ${all.length - head - tailLines} lines omitted …]`, ...all.slice(-tailLines)].join('\n');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const nowIso = () => new Date().toISOString();
export const shortId = () => crypto.randomBytes(4).toString('hex');

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file, fallback = undefined) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

/** Write JSON atomically so readers (the dashboard) never see a half-written file. */
export function writeJson(file, data) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameRetrying(tmp, file);
}

/** On Windows a rename onto a file someone has open (Defender scanning it, the dashboard reading it)
 * fails with EPERM/EBUSY/EACCES for a moment. Retry briefly; as a last resort, write in place. */
export function renameRetrying(tmp, file, tries = 8) {
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, file); return; } catch (e) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      if (i >= tries) {
        fs.copyFileSync(tmp, file);
        try { fs.unlinkSync(tmp); } catch {}
        return;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (i + 1)); // brief synchronous back-off
    }
  }
}

export function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'repo';
}

/** Levenshtein distance, used to find the file or script a stale README meant. */
export function editDistance(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

/**
 * Pick the candidate that most plausibly replaced `wanted`: containment wins
 * (migrate -> db:migrate), then shared tokens, then edit distance.
 */
export function closest(wanted, candidates) {
  const w = wanted.toLowerCase();
  const tokens = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const wt = new Set(tokens(w));
  let best = null;
  for (const c of candidates) {
    const cl = c.toLowerCase();
    if (cl === w) continue;
    const shared = tokens(cl).filter((t) => wt.has(t)).length;
    const contains = cl.includes(w) || w.includes(cl) ? 1 : 0;
    const dist = editDistance(w, cl);
    const score = contains * 10 + shared * 4 - dist * 0.5;
    if (!best || score > best.score) best = { value: c, score, dist, shared, contains };
  }
  if (!best) return null;
  const plausible = best.contains || best.shared > 0 || best.dist <= Math.max(2, Math.floor(w.length / 3));
  return plausible ? best : null;
}

/** The single most telling error line in a log tail (skips log paths, stack frames, boilerplate). */
export function errorSignature(logTail = '') {
  let best = null;
  for (const raw of String(logTail).split('\n')) {
    const l = raw.trim();
    if (!l || l.length < 8) continue;
    let score = 0;
    if (/EBADENGINE|Missing script|Missing required|ECONNREFUSED|cannot stat|No such file|not found|is required|ImportError|ModuleNotFoundError|Cannot find module|Unsupported engine|ERESOLVE|Unable to locate|does not exist|KeyError|RuntimeError|Error:/.test(l)) score += 5;
    if (/error|ERR!|refused|missing|cannot|failed/i.test(l)) score += 2;
    if (/_logs|complete log|full report|For a full|^at\s|^\s*at\s|node:internal|^npm (error|ERR!)\s*$|To see a list|Did you mean|^code: /i.test(l)) score -= 8;
    if (score > 0 && (!best || score >= best.score)) best = { line: l, score };
  }
  return best ? best.line.slice(0, 200) : '';
}

export function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
}

/** Quote a string for a POSIX shell. */
export function shq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

export { redactTokens, redactSecrets, redactDeep, isPlainPlaceholder, REDACTED, TOKEN_PATTERNS } from './redact.js';
