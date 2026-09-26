# FirstRun Dock, issue #90. Read docs/DOCK_CONTRACT.md first: it is the spec. Build ONLY Friday's part (sections 3, 4 and the Friday files in 5). Hard limits: spend at most 3 Bobcoins; do not edit any existing test file; when node --test test/*.test.js passes, stop and summarise. Do not commit.

1. src/dock-state.js (pure, no I/O): export initialState(target, agent) and reduce(state, event) that turn events.ndjson events (section 2) into the dock:state object (section 4), with each character's state idle/working/done/needs_you and a short line (section 3 table). Also export charactersFor(agent) so a solo run only lights its own character. Tests in a NEW file test/dock-state.test.js: feed the real event sequence from a full run (build a small fixture inline: phase scout, facts, phase plan, plan with 2 conflicts, step.start/step.end fail, diagnosis, evidence verified, replay.start, replay.end passed, passport, done) and assert the states; plus a solo doctor run and a needs_you case.

2. lens/dock-bridge.js (main process): runAgent({ agent, target }) spawns `node bin/firstrun.js <cmd>
<target> --json` per the section 1 table (agent 'all' = verify), finds the run dir from its output or the --out it passes, tails that run's events.ndjson (poll every 250 ms), reduces with src/dock-state.js and calls onState(state) at most 10 times a second; cancel() kills the child; open(what, runDir) opens out/FIRSTRUN.md, the README diff, the passport or the folder with shell.openPath.

3. lens/main.js: keep Lens exactly as it is. Add the Dock: a small frameless always-on-top floating button window (56x56, top-left of the primary display, draggable) that loads lens/dock/button.html (create a minimal one with a round Bob icon), a tray entry "Open FirstRun Dock", and the hotkey Alt+Command+Space (Mac) / Control+Alt+Space (Windows) that toggles a 380x600 frameless panel window loading lens/dock/index.html next to the button. Wire ipcMain for dock:run, dock:open, dock:cancel, dock:lens (opens the existing Lens) and push dock:state to the panel. Add the preload API window.dock = { run, open, cancel, lens, onState } in a new lens/dock-preload.cjs (contextIsolation true). If lens/dock/index.html does not exist yet, create a plain placeholder with an input, a Run button and a <pre> that prints the state (Zeus replaces it).

4. src/cli.js: add `firstrun dock` that starts the Electron app the same way `firstrun lens` does.

Match the surrounding code style (short, dense, same comment density). Never print or store credentials.

---

**Status:** active  **Date:** 2026-09-26

---

### 👤 User

FirstRun Dock, issue #90. Read docs/DOCK_CONTRACT.md first: it is the spec. Build ONLY Friday's part (sections 3, 4 and the Friday files in 5). Hard limits: spend at most 3 Bobcoins; do not edit any existing test file; when node --test test/*.test.js passes, stop and summarise. Do not commit.

1. src/dock-state.js (pure, no I/O): export initialState(target, agent) and reduce(state, event) that turn events.ndjson events (section 2) into the dock:state object (section 4), with each character's state idle/working/done/needs_you and a short line (section 3 table). Also export charactersFor(agent) so a solo run only lights its own character. Tests in a NEW file test/dock-state.test.js: feed the real event sequence from a full run (build a small fixture inline: phase scout, facts, phase plan, plan with 2 conflicts, step.start/step.end fail, diagnosis, evidence verified, replay.start, replay.end passed, passport, done) and assert the states; plus a solo doctor run and a needs_you case.

2. lens/dock-bridge.js (main process): runAgent({ agent, target }) spawns `node bin/firstrun.js <cmd>
<target> --json` per the section 1 table (agent 'all' = verify), finds the run dir from its output or the --out it passes, tails that run's events.ndjson (poll every 250 ms), reduces with src/dock-state.js and calls onState(state) at most 10 times a second; cancel() kills the child; open(what, runDir) opens out/FIRSTRUN.md, the README diff, the passport or the folder with shell.openPath.

3. lens/main.js: keep Lens exactly as it is. Add the Dock: a small frameless always-on-top floating button window (56x56, top-left of the primary display, draggable) that loads lens/dock/button.html (create a minimal one with a round Bob icon), a tray entry "Open FirstRun Dock", and the hotkey Alt+Command+Space (Mac) / Control+Alt+Space (Windows) that toggles a 380x600 frameless panel window loading lens/dock/index.html next to the button. Wire ipcMain for dock:run, dock:open, dock:cancel, dock:lens (opens the existing Lens) and push dock:state to the panel. Add the preload API window.dock = { run, open, cancel, lens, onState } in a new lens/dock-preload.cjs (contextIsolation true). If lens/dock/index.html does not exist yet, create a plain placeholder with an input, a Run button and a <pre> that prints the state (Zeus replaces it).

4. src/cli.js: add `firstrun dock` that starts the Electron app the same way `firstrun lens` does.

Match the surrounding code style (short, dense, same comment density). Never print or store credentials.

---

### 🤖 Assistant

> 🔧 called: update_todo_list



> 🔧 **update_todo_list** — 
[-] Read docs/DOCK_CONTRACT.md to understand the spec
[ ] Read existing codebase structure (src/dock-state.js area, lens/main.js, src/cli.js)
[ ] Build src/dock-state.js (pure state machine)
[ ] Build test/dock-state.test.js (new test file)
[ ] Build lens/dock-bridge.js (main process bridge)
[ ] Build lens/dock-preload.cjs (preload API)
[ ] Build lens/dock/button.html (floating button)
[ ] Build lens/dock/index.html (placeholder panel)
[ ] Update lens/main.js (add Dock windows, ipc, tray, hotkey)
[ ] Update src/cli.js (add `firstrun dock` command)
[ ] Run node --test test/*.test.js and verify passing


### 🤖 Assistant

> 🔧 called: read_file, list_files



> 🔧 **list_files** — .

> 🔧 **read_file** — docs/DOCK_CONTRACT.md

### 🤖 Assistant

> 🔧 called: list_files, list_files, list_files



> 🔧 **list_files** — test

> 🔧 **list_files** — src

> 🔧 **list_files** — lens

### 🤖 Assistant

> 🔧 called: read_file, read_file



> 🔧 **read_file** — lens/main.js

> 🔧 **read_file** — src/cli.js

### 🤖 Assistant

> 🔧 called: read_file, read_file, read_file



> 🔧 **read_file** — lens/package.json

> 🔧 **read_file** — lens/preload.cjs

### 🤖 Assistant

> 🔧 called: read_file, read_file



> 🔧 **read_file** — package.json

> 🔧 **read_file** — test/doctor.test.js

### 🤖 Assistant

> 🔧 called: update_todo_list

Now I have everything I need. Let me build all four pieces.

> 🔧 **update_todo_list** — 
[x] Read docs/DOCK_CONTRACT.md to understand the spec
[x] Read existing codebase structure (src/dock-state.js area, lens/main.js, src/cli.js)
[-] Build src/dock-state.js (pure state machine)
[ ] Build test/dock-state.test.js (new test file)
[ ] Build lens/dock-bridge.js (main process bridge)
[ ] Build lens/dock-preload.cjs (preload API)
[ ] Build lens/dock/button.html (floating button)
[ ] Build lens/dock/index.html (placeholder panel)
[ ] Update lens/main.js (add Dock windows, ipc, tray, hotkey)
[ ] Update src/cli.js (add `firstrun dock` command)
[ ] Run node --test test/*.test.js and verify passing


### 🤖 Assistant

> 🔧 called: write_file



> 🔧 **write_file** — src/dock-state.js

### 🤖 Assistant

> 🔧 called: write_file



> 🔧 **write_file** — test/dock-state.test.js

### 🤖 Assistant

> 🔧 called: execute_command

Now let me run the tests to verify before building the rest:

> 🔧 **execute_command** — node --test test/dock-state.test.js 2>&1

### 🤖 Assistant

> 🔧 called: update_todo_list

All 16 tests pass. Now build the lens files:

> 🔧 **update_todo_list** — 
[x] Read docs/DOCK_CONTRACT.md to understand the spec
[x] Read existing codebase structure (src/dock-state.js area, lens/main.js, src/cli.js)
[x] Build src/dock-state.js (pure state machine)
[x] Build test/dock-state.test.js (new test file)
[-] Build lens/dock-bridge.js (main process bridge)
[ ] Build lens/dock-preload.cjs (preload API)
[ ] Build lens/dock/button.html (floating button)
[ ] Build lens/dock/index.html (placeholder panel)
[ ] Update lens/main.js (add Dock windows, ipc, tray, hotkey)
[ ] Update src/cli.js (add `firstrun dock` command)
[ ] Run node --test test/*.test.js and verify passing


### 🤖 Assistant

> 🔧 called: write_file



> 🔧 **write_file** — // lens/dock-bridge.js — main process only. Spawn an agent, tail its events.ndjson,
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
function agentArgs(agent, target) {
  switch (agent) {
    case 'scout':    return ['scout',   target, '--json'];
    case 'planner':  return ['plan',    target, '--json'];
    case 'runner':   return ['run',     target, '--as-written', '--json'];
    case 'doctor':   return ['doctor',  '--log', target, '--json'];
    case 'verifier': return ['replay',  target, '--json'];
    case 'scribe':   return ['scribe',  target, '--json'];
    case 'guide':    return ['guide',   target];
    case 'all':
    default:         return ['verify',  target, '--json'];
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


### 🤖 Assistant

> 🔧 called: update_todo_list



> 🔧 **update_todo_list** — 
[x] Read docs/DOCK_CONTRACT.md to understand the spec
[x] Read existing codebase structure (src/dock-state.js area, lens/main.js, src/cli.js)
[x] Build src/dock-state.js (pure state machine)
[x] Build test/dock-state.test.js (new test file)
[x] Build lens/dock-bridge.js (main process bridge)
[-] Build lens/dock-preload.cjs (preload API)
[ ] Build lens/dock/button.html (floating button)
[ ] Build lens/dock/index.html (placeholder panel)
[ ] Update lens/main.js (add Dock windows, ipc, tray, hotkey)
[ ] Update src/cli.js (add `firstrun dock` command)
[ ] Run node --test test/*.test.js and verify passing


### 🤖 Assistant

> 🔧 called: write_file



> 🔧 **write_file** — // lens/dock-preload.cjs — context-isolated preload for every Dock window.
// Exposes window.dock = { run, open, cancel, lens, onState }.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dock', {
  run:     (agent, target) => ipcRenderer.send('dock:run',    { agent, target }),
  open:    (what, runDir)  => ipcRenderer.send('dock:open',   { what, runDir }),
  cancel:  ()              => ipcRenderer.send('dock:cancel',  {}),
  lens:    ()              => ipcRenderer.send('dock:lens',    {}),
  onState: (fn)            => ipcRenderer.on('dock:state', (_e, state) => fn(state)),
});


### 🤖 Assistant

> 🔧 called: update_todo_list



> 🔧 **update_todo_list** — 
[x] Read docs/DOCK_CONTRACT.md to understand the spec
[x] Read existing codebase structure (src/dock-state.js area, lens/main.js, src/cli.js)
[x] Build src/dock-state.js (pure state machine)
[x] Build test/dock-state.test.js (new test file)
[x] Build lens/dock-bridge.js (main process bridge)
[x] Build lens/dock-preload.cjs (preload API)
[-] Build lens/dock/button.html (floating button)
[ ] Build lens/dock/index.html (placeholder panel)
[ ] Update lens/main.js (add Dock windows, ipc, tray, hotkey)
[ ] Update src/cli.js (add `firstrun dock` command)
[ ] Run node --test test/*.test.js and verify passing


### 🤖 Assistant

> 🔧 called: write_file



> 🔧 **write_file** — <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 56px; height: 56px; overflow: hidden; background: transparent;
               -webkit-app-region: drag; user-select: none; }
  button { -webkit-app-region: no-drag; position: absolute; inset: 4px; border: none; cursor: pointer;
           border-radius: 50%; background: #0E1726; box-shadow: 0 2px 8px rgba(0,0,0,.5); }
  button:hover { background: #1a2540; }
  svg { display: block; margin: auto; width: 32px; height: 32px; }
</style>
</head>
<body>
<!-- draggable frame; button opens the panel -->
<button id="btn" title="Open FirstRun Dock">
  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="28" height="28" rx="6" fill="#0E1726"/>
    <circle cx="16" cy="16" r="8" stroke="#3DD68C" stroke-width="3" fill="none"/>
    <circle cx="16" cy="16" r="3" fill="#3DD68C"/>
  </svg>
</button>
<script>
  document.getElementById('btn').addEventListener('click', () => window.dock?.lens?.() || window.dock?.run?.());
</script>
</body>
</html>


### 🤖 Assistant

> 🔧 called: write_file



> 🔧 **write_file** — <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif;
         background: #0E1726; color: #e1e4e8; height: 600px; overflow: hidden;
         display: flex; flex-direction: column; }
  header { padding: 10px 12px 6px; -webkit-app-region: drag; flex-shrink: 0;
           border-bottom: 1px solid #1e2d45; display: flex; align-items: center; gap: 8px; }
  header span { font-weight: 600; font-size: 14px; color: #3DD68C; }
  header small { color: #57606a; font-size: 11px; flex: 1; overflow: hidden;
                 text-overflow: ellipsis; white-space: nowrap; }
  .row { display: flex; gap: 8px; padding: 10px 12px; flex-shrink: 0; -webkit-app-region: no-drag; }
  input { flex: 1; background: #1a2540; border: 1px solid #2a3f60; border-radius: 4px;
          color: #e1e4e8; padding: 5px 8px; font-size: 12px; outline: none; }
  input:focus { border-color: #3DD68C; }
  select { background: #1a2540; border: 1px solid #2a3f60; border-radius: 4px;
           color: #e1e4e8; padding: 5px 6px; font-size: 12px; }
  button { background: #3DD68C; color: #0E1726; border: none; border-radius: 4px;
           padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
  button:hover { background: #50e8a0; }
  button.cancel { background: #e05353; color: #fff; }
  button.cancel:hover { background: #f06060; }
  pre { flex: 1; margin: 0; padding: 10px 12px; overflow: auto; font-size: 11px;
        font-family: "Cascadia Code","Fira Mono",monospace; white-space: pre-wrap;
        word-break: break-all; color: #adbac7; border-top: 1px solid #1e2d45; }
</style>
</head>
<body>
<!-- Placeholder: Zeus replaces this with the real Dock UI (lens/dock/dock.js + dock.css) -->
<header>
  <span>FirstRun Dock</span>
  <small id="hdr">idle</small>
</header>
<div class="row">
  <input id="target" placeholder="repo path or GitHub URL" value="">
  <select id="agent">
    <option value="all">all</option>
    <option value="scout">scout</option>
    <option value="planner">planner</option>
    <option value="runner">runner</option>
    <option value="doctor">doctor</option>
    <option value="verifier">verifier</option>
    <option value="scribe">scribe</option>
  </select>
  <button id="run">Run</button>
  <button id="stop" class="cancel" style="display:none">Stop</button>
</div>
<pre id="out">waiting…</pre>
<script>
  const out = document.getElementById('out');
  const hdr = document.getElementById('hdr');
  let running = false;

  document.getElementById('run').addEventListener('click', () => {
    const t = document.getElementById('target').value.trim();
    const a = document.getElementById('agent').value;
    if (!t) { out.textContent = 'Enter a repo path or URL.'; return; }
    window.dock?.run(a, t);
    running = true;
    document.getElementById('run').style.display  = 'none';
    document.getElementById('stop').style.display = '';
  });

  document.getElementById('stop').addEventListener('click', () => {
    window.dock?.cancel();
    document.getElementById('run').style.display  = '';
    document.getElementById('stop').style.display = 'none';
  });

  window.dock?.onState((s) => {
    hdr.textContent = s.phase ?? 'idle';
    out.textContent = JSON.stringify(s, null, 2);
    if (s.verdict) {
      document.getElementById('run').style.display  = '';
      document.getElementById('stop').style.display = 'none';
    }
  });
</script>
</body>
</html>


### 🤖 Assistant

> 🔧 called: update_todo_list

Now update [`lens/main.js`](lens/main.js) to add the Dock windows, IPC handlers, and hotkey:

> 🔧 **update_todo_list** — 
[x] Read docs/DOCK_CONTRACT.md to understand the spec
[x] Read existing codebase structure (src/dock-state.js area, lens/main.js, src/cli.js)
[x] Build src/dock-state.js (pure state machine)
[x] Build test/dock-state.test.js (new test file)
[x] Build lens/dock-bridge.js (main process bridge)
[x] Build lens/dock-preload.cjs (preload API)
[x] Build lens/dock/button.html (floating button)
[x] Build lens/dock/index.html (placeholder panel)
[-] Update lens/main.js (add Dock windows, ipc, tray, hotkey)
[ ] Update src/cli.js (add `firstrun dock` command)
[ ] Run node --test test/*.test.js and verify passing


### 🤖 Assistant

> 🔧 called: apply_diff



> 🔧 **apply_diff** — lens/main.js

### 🤖 Assistant

> 🔧 called: read_file

Now update the `app.whenReady()` section to start the Dock button and register the Dock hotkey, and add a tray entry for it:

> 🔧 **read_file** — lens/main.js

### 🤖 Assistant

> 🔧 called: apply_diff



> 🔧 **apply_diff** — lens/main.js

### 🤖 Assistant

> 🔧 called: update_todo_list

Now add `firstrun dock` to [`src/cli.js`](src/cli.js):

> 🔧 **update_todo_list** — 
[x] Read docs/DOCK_CONTRACT.md to understand the spec
[x] Read existing codebase structure (src/dock-state.js area, lens/main.js, src/cli.js)
[x] Build src/dock-state.js (pure state machine)
[x] Build test/dock-state.test.js (new test file)
[x] Build lens/dock-bridge.js (main process bridge)
[x] Build lens/dock-preload.cjs (preload API)
[x] Build lens/dock/button.html (floating button)
[x] Build lens/dock/index.html (placeholder panel)
[x] Update lens/main.js (add Dock windows, ipc, tray, hotkey)
[-] Update src/cli.js (add `firstrun dock` command)
[ ] Run node --test test/*.test.js and verify passing


### 🤖 Assistant

> 🔧 called: apply_diff



> 🔧 **apply_diff** — <<<<<<< SEARCH
:start_line:31
-------
  firstrun lens   [path]                 circle anything on screen and ask about it (Ctrl+Shift+Space)
=======
  firstrun lens   [path]                 circle anything on screen and ask about it (Ctrl+Shift+Space)
  firstrun dock   [path]                 floating Dock: run agents and watch them live (Alt+Command+Space / Ctrl+Alt+Space)
>>>>>>> REPLACE

<<<<<<< SEARCH
:start_line:168
-------
    case 'lens': {
      const { spawn } = await import('node:child_process');
      const lensDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lens');
      const electron = path.join(lensDir, 'node_modules', 'electron', 'cli.js');
      if (!fs.existsSync(electron)) { console.log(`Install FirstRun Lens first: ${bold(`cd ${lensDir} && npm install`)}`); return 1; }
      const project = path.resolve(args._[0] || '.');
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      const child = spawn(process.execPath, [electron, lensDir, project], { stdio: 'inherit', env });
      return new Promise((resolve) => child.on('close', (code) => resolve(code ?? 0)));
    }
=======
    case 'lens': {
      const { spawn } = await import('node:child_process');
      const lensDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lens');
      const electron = path.join(lensDir, 'node_modules', 'electron', 'cli.js');
      if (!fs.existsSync(electron)) { console.log(`Install FirstRun Lens first: ${bold(`cd ${lensDir} && npm install`)}`); return 1; }
      const project = path.resolve(args._[0] || '.');
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      const child = spawn(process.execPath, [electron, lensDir, project], { stdio: 'inherit', env });
      return new Promise((resolve) => child.on('close', (code) => resolve(code ?? 0)));
    }
    case 'dock': {
      const { spawn } = await import('node:child_process');
      const lensDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lens');
      const electron = path.join(lensDir, 'node_modules', 'electron', 'cli.js');
      if (!fs.existsSync(electron)) { console.log(`Install FirstRun Dock first: ${bold(`cd ${lensDir} && npm install`)}`); return 1; }
      const project = path.resolve(args._[0] || '.');
      const env = { ...process.env, FIRSTRUN_DOCK: '1' };
      delete env.ELECTRON_RUN_AS_NODE;
      const child = spawn(process.execPath, [electron, lensDir, project], { stdio: 'inherit', env });
      return new Promise((resolve) => child.on('close', (code) => resolve(code ?? 0)));
    }
>>>>>>> REPLACE


### 🤖 Assistant

> 🔧 called: update_todo_list

Now run the full test suite to verify nothing is broken:

> 🔧 **update_todo_list** — 
[x] Read docs/DOCK_CONTRACT.md to understand the spec
[x] Read existing codebase structure (src/dock-state.js area, lens/main.js, src/cli.js)
[x] Build src/dock-state.js (pure state machine)
[x] Build test/dock-state.test.js (new test file)
[x] Build lens/dock-bridge.js (main process bridge)
[x] Build lens/dock-preload.cjs (preload API)
[x] Build lens/dock/button.html (floating button)
[x] Build lens/dock/index.html (placeholder panel)
[x] Update lens/main.js (add Dock windows, ipc, tray, hotkey)
[x] Update src/cli.js (add `firstrun dock` command)
[-] Run node --test test/*.test.js and verify passing


### 🤖 Assistant

> 🔧 called: execute_command



> 🔧 **execute_command** — node --test test/*.test.js 2>&1

### 🤖 Assistant

> 🔧 called: update_todo_list

All 146 tests pass (16 new dock-state tests + 130 existing). Zero failures.

> 🔧 **update_todo_list** — 
[x] Read docs/DOCK_CONTRACT.md to understand the spec
[x] Read existing codebase structure (src/dock-state.js area, lens/main.js, src/cli.js)
[x] Build src/dock-state.js (pure state machine)
[x] Build test/dock-state.test.js (new test file)
[x] Build lens/dock-bridge.js (main process bridge)
[x] Build lens/dock-preload.cjs (preload API)
[x] Build lens/dock/button.html (floating button)
[x] Build lens/dock/index.html (placeholder panel)
[x] Update lens/main.js (add Dock windows, ipc, tray, hotkey)
[x] Update src/cli.js (add `firstrun dock` command)
[x] Run node --test test/*.test.js and verify passing


### 🤖 Assistant

All 146 tests pass (16 new + 130 pre-existing). Here's what was built:

---

## Summary — FirstRun Dock (issue #90, Friday's parts)

### [`src/dock-state.js`](src/dock-state.js) — pure state machine, no I/O
- **`initialState(target, agent)`** — blank state with all 7 characters at `idle`.
- **`reduce(state, event)`** — handles every event type from §2 of the contract, flipping each character through `idle → working → done / needs_you` per the §3 rules table. Pure: original state is never mutated.
- **`charactersFor(agent)`** — returns the character names relevant to a solo agent (e.g. `['doctor']` for a doctor run, all 7 for `all`).

### [`test/dock-state.test.js`](test/dock-state.test.js) — 16 new tests
Full fixture: `phase:scout → facts → phase:plan → plan(2 steps, 2 conflicts) → step.start → step.end failed → phase:repair → diagnosis → evidence verified → phase:replay → replay.start → replay.end passed → phase:publish → passport → done`. Asserts every character's final state plus three `needs_you` cases (planner/doctor/verifier), a solo-doctor run, and a purity check.

### [`lens/dock-bridge.js`](lens/dock-bridge.js) — main process
- **`runAgent({ agent, target, onState })`** — maps agent names to CLI args per §1, spawns `node bin/firstrun.js`, writes to `--out`, tails `events.ndjson` every 250 ms, reduces state, calls `onState` throttled to ≤10/s. Returns `{ cancel() }`.
- **`open(what, runDir)`** — opens `FIRSTRUN.md`, `README.diff`, `passport.json` or the folder via `shell.openPath`.

### [`lens/dock-preload.cjs`](lens/dock-preload.cjs) — context-isolated preload
Exposes `window.dock = { run, open, cancel, lens, onState }` via `contextBridge`.

### [`lens/dock/button.html`](lens/dock/button.html) + [`lens/dock/index.html`](lens/dock/index.html)
Button: 56×56 round Bob icon, draggable frame. Panel: placeholder with target input, agent selector, Run/Stop buttons, `<pre>` that prints raw state (Zeus replaces with `dock.js`).

### [`lens/main.js`](lens/main.js) — Lens unchanged, Dock added
- `createDockButton()` — 56×56 frameless always-on-top button, top-left of primary display, draggable.
- `toggleDockPanel()` — 380×600 frameless panel positioned beside the button.
- `ipcMain.on` handlers for `dock:run`, `dock:cancel`, `dock:open`, `dock:lens`.
- Tray menu entry **"Open FirstRun Dock"**.
- Hotkey: `Alt+Command+Space` (Mac) / `Control+Alt+Space` (Windows/Linux).

### [`src/cli.js`](src/cli.js) — `firstrun dock` command
Mirrors the `lens` case exactly: resolves the lens dir, checks electron is installed, spawns with `FIRSTRUN_DOCK=1`. Help string updated.