import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { run, ensureDir, tail } from '../util.js';

/**
 * IBM Bob as FirstRun's reasoning engine, driven headlessly through Bob Shell:
 *   bob run --format json --mode <firstrun-mode> --max-cost <n> -w <repo> "<prompt>"
 * The prompt points Bob at a request file inside the workspace, so Bob reads the
 * repo's own docs and manifests (document understanding) before answering.
 */

let availability = null;

/** Resolve how to launch Bob Shell. On Windows, run its JS entry with node (spawning .cmd shims needs a shell). */
function bobCommand() {
  if (process.env.FIRSTRUN_BOB_JS) return [process.execPath, [process.env.FIRSTRUN_BOB_JS]];
  if (process.platform === 'win32') {
    const js = path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'bobshell', 'dist', 'bob.js');
    if (fs.existsSync(js)) return [process.execPath, [js]];
  }
  return ['bob', []];
}

function runBob(args, opts = {}) {
  const [cmd, pre] = bobCommand();
  // Inside Electron (FirstRun Lens), execPath is Electron itself: make it run bob.js as plain Node.
  const env = process.versions.electron && cmd === process.execPath ? { ...opts.env, ELECTRON_RUN_AS_NODE: '1' } : opts.env;
  return run(cmd, [...pre, ...args], { ...opts, env });
}

export async function bobStatus({ force = false } = {}) {
  if (availability && !force) return availability;
  const v = await runBob(['--version'], { timeoutMs: 20_000 });
  if (v.code !== 0) return (availability = { ok: false, reason: 'Bob Shell is not installed (npm i -g bobshell, see bob.ibm.com)' });
  availability = { ok: true, version: v.out.trim().split('\n')[0] };
  return availability;
}

/** Is the mode where Bob Shell 2.x reads global modes (~/.bob/settings/custom_modes.yaml)?
 * The 1.x location (~/.bob/custom_modes.yaml) is no longer read, so it doesn't count. */
export function modeInstalled(slug) {
  const file = path.join(os.homedir(), '.bob', 'settings', 'custom_modes.yaml');
  try { return fs.readFileSync(file, 'utf8').includes(`slug: ${slug}`); } catch { return false; }
}

/** Pull the first JSON object out of Bob's reply (fenced or bare). */
export function extractJson(text) {
  if (!text) return null;
  const fenced = [...String(text).matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  for (const cand of [...fenced, String(text)]) {
    const start = cand.indexOf('{');
    if (start < 0) continue;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < cand.length; i++) {
      const c = cand[i];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try { return JSON.parse(cand.slice(start, i + 1)); } catch { break; }
      }
    }
  }
  return null;
}

/**
 * Ask Bob one question. Returns { ok, json, text, bobcoins, taskId, error, ms }.
 */
export async function askBob({ mode, request, workspace, maxCost = 1.5, maxTurns = 12, name = 'request', onEvent }) {
  const status = await bobStatus();
  if (!status.ok) return { ok: false, error: status.reason, bobcoins: 0 };
  const dir = ensureDir(path.join(workspace, '.firstrun', 'bob'));
  const stamp = `${name}-${Date.now()}`;
  const reqFile = path.join(dir, `${stamp}.md`);
  fs.writeFileSync(reqFile, request);
  const rel = path.relative(workspace, reqFile).replace(/\\/g, '/');
  const useMode = modeInstalled(mode) ? mode : 'ask';
  const prompt = `You are running as FirstRun's ${mode.replace('firstrun-', '')} agent. Read the file ${rel} and do exactly what it asks. Reply with only the JSON object it specifies.`;
  const args = ['run', '--format', 'json', '--mode', useMode, '--max-cost', String(maxCost), '--max-turns', String(maxTurns), '--accept-license', '--trust', '--disable-subagents', '-w', workspace, prompt];
  onEvent?.({ type: 'bob.start', mode: useMode });
  const r = await runBob(args, { cwd: workspace, timeoutMs: 6 * 60_000 });
  fs.writeFileSync(path.join(dir, `${stamp}.response.log`), r.out);
  const lines = r.out.split(/\r?\n/).filter((l) => l.trim().startsWith('{'));
  let result = null;
  const errors = [];
  for (const l of lines) {
    try {
      const o = JSON.parse(l);
      if (o.type === 'result') result = o;
      else if (o.type === 'error') errors.push(o.message || o.error);
    } catch {}
  }
  const bobcoins = Number(result?.stats?.session_costs) || 0;
  if (!result) {
    const hint = /login|authenticat|api key|unauthori[sz]ed|not logged in|IBMid/i.test(r.out)
      ? 'Bob Shell is not signed in (run `bob` once and log in with the hackathon IBMid)'
      : errors[0] || tail(r.out, 6) || `bob exited with ${r.code}`;
    return { ok: false, error: hint, bobcoins, ms: r.durationMs };
  }
  const text = typeof result.last_message === 'string' ? result.last_message : JSON.stringify(result.last_message);
  const json = extractJson(text);
  return { ok: !!json, json, text, bobcoins, taskId: result.stats?.task_id, error: json ? null : `Bob replied without the expected JSON: ${tail(text, 4)}`, ms: r.durationMs, errors };
}
