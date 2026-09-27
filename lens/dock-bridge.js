// lens/dock-bridge.js — main process only. Spawn an agent, tail its events.ndjson,
// reduce with src/dock-state.js and push dock:state to the panel at ≤10 Hz.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shell } from 'electron';
import { initialState, reduce } from '../src/dock-state.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN  = path.join(HERE, '..', 'bin', 'firstrun.js');
const POLL = 250; // ms between event file reads
const RATE = 100; // ms between onState pushes (≤10/s)

/** Map agent name → CLI args per DOCK_CONTRACT §1. */
// Bob runs the engine (decision 26 Sep): rules first, and Bob takes what they can't explain, within a small
// per-run Bobcoin cap. Override with FIRSTRUN_BOB_RUN / FIRSTRUN_BOB_SOLO; '0' keeps a run rules-only.
const BOB = { run: process.env.FIRSTRUN_BOB_RUN || '1', solo: process.env.FIRSTRUN_BOB_SOLO || '0.5' };

function agentArgs(agent, target) {
  switch (agent) {
    case 'scout':    return ['scout',   target, '--json'];
    case 'planner':  return ['plan',    target, '--json'];
    case 'runner':   return ['run',     target, '--as-written', '--json'];
    case 'doctor':   return ['doctor',  '--log', target, '--json', '--bob-budget', BOB.solo];
    case 'verifier': return ['replay',  target, '--json'];
    case 'scribe':   return ['scribe',  target, '--json'];
    case 'guide':    return ['guide',   target];
    case 'all':
    default:         return ['verify',  target, '--json', '--brain', 'auto', '--bob-budget', BOB.run];
  }
}

/**
 * Run one agent against a target.
 *
 * @param {{ agent: string, target: string, outDir?: string,
 *            onState: (state: object) => void }} opts
 * @returns {{ cancel: () => void }}
 */
export function runAgent({ agent, target, outDir, onState }) {
  let child = null;
  let state = initialState(target, agent);
  let eventsFile = null;
  let offset = 0;
  let pollTimer = null;
  let rateTimer = null;
  let pendingPush = false;
  let cancelled = false;

  function push() {
    if (pendingPush) return;
    pendingPush = true;
    if (!rateTimer) rateTimer = setInterval(() => { if (pendingPush) { onState(state); pendingPush = false; } }, RATE);
  }

  function stopTimers() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (rateTimer) { clearInterval(rateTimer); rateTimer = null; }
  }

  function processLines(raw) {
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try { state = reduce(state, JSON.parse(line)); pendingPush = true; }
      catch { /* malformed line — skip */ }
    }
  }

  function tailFile() {
    if (!eventsFile || !fs.existsSync(eventsFile)) return;
    try {
      const buf = fs.readFileSync(eventsFile);
      if (buf.length <= offset) return;
      processLines(buf.slice(offset).toString('utf8'));
      offset = buf.length;
    } catch { /* file not ready yet */ }
  }

  // Start the child. Pass --out so we know the run dir immediately.
  const runId = `dock-${Date.now()}`;
  const effectiveOut = outDir ?? path.join(process.cwd(), '.firstrun', `${agent}-${runId}`);
  const args = [...agentArgs(agent, target), '--out', effectiveOut];

  // Keep a last-stdout-line buffer to extract JSON result.
  let lastLine = '';

  child = spawn(process.execPath, [BIN, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    for (const l of text.split('\n')) if (l.trim()) lastLine = l;
  });
  child.stderr.on('data', () => {}); // suppress; errors come through events.ndjson

  child.on('error', (err) => {
    if (cancelled) return;
    stopTimers();
    onState({ ...state, type: 'error', agent, data: { message: `spawn failed: ${err.message}` } });
  });

  child.on('spawn', () => {
    // The run dir may not exist yet; poll until events.ndjson appears.
    eventsFile = path.join(effectiveOut, 'events.ndjson');
    state = { ...state, runDir: effectiveOut };
    push();
    pollTimer = setInterval(tailFile, POLL);
  });

  child.on('close', (code) => {
    if (cancelled) return;
    tailFile(); // drain any remaining events
    // Try to parse the JSON result line (--json last stdout line).
    if (lastLine) {
      try { const r = JSON.parse(lastLine); if (r.verdict) state = reduce(state, { type: 'done', agent, data: r }); }
      catch { /* not JSON */ }
    }
    // Mark non-zero exit as an error event so the UI can react.
    if (code && code !== 0 && code !== 1) {
      state = reduce(state, { type: 'error', agent, data: { message: `process exited ${code}` } });
    }
    onState(state);
    stopTimers();
  });

  return {
    cancel() {
      cancelled = true;
      stopTimers();
      child?.kill();
    },
  };
}

/**
 * Open a run artefact in the OS default viewer.
 * what: 'report' | 'readme-diff' | 'passport' | 'folder'
 */
export function open(what, runDir) {
  const out = path.join(runDir, 'out');
  const targets = {
    report:      path.join(out, 'FIRSTRUN.md'),
    'readme-diff': path.join(out, 'README.diff'),
    passport:    path.join(out, 'passport.json'),
    folder:      out,
  };
  const p = targets[what] ?? out;
  shell.openPath(fs.existsSync(p) ? p : runDir);
}
