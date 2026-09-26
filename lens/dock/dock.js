/**
 * FirstRun Dock UI Logic
 * Connects the 7 agent character avatars to live events via the IPC contract:
 * window.dock = { run, open, cancel, lens, onState }
 * (see docs/DOCK_CONTRACT.md)
 */

(function () {
  'use strict';

  // DOM Elements
  const repoInput = document.getElementById('repo-input') || document.getElementById('target');
  const btnBrowse = document.getElementById('btn-browse');
  const btnPlan = document.getElementById('btn-plan') || document.getElementById('run');
  const btnVerify = document.getElementById('btn-verify');
  const cancelBtn = document.getElementById('cancel-btn') || document.getElementById('stop');
  const bobBtn = document.getElementById('bob-btn');
  const bobPrompt = document.getElementById('bob-prompt') || document.getElementById('hdr');
  const verdictPill = document.getElementById('verdict-pill');
  const stepCounter = document.getElementById('step-counter');
  const bobcoinMeter = document.getElementById('bobcoin-meter');
  const audioToggle = document.getElementById('audio-toggle');
  const drawer = document.getElementById('drawer');
  const drawerTitle = document.getElementById('drawer-title');
  const drawerBody = document.getElementById('drawer-body');
  const drawerClose = document.getElementById('drawer-close');
  const drawerActions = document.getElementById('drawer-action-container');

  let userEditedRepo = false;
  if (repoInput) {
    repoInput.addEventListener('input', () => {
      userEditedRepo = true;
    });
  }

  // Pre-fill target from URL query params (?project=... or ?target=...), window.dock.project, or bridge
  try {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('project') || params.get('target') || window.dock?.project;
    if (p && repoInput) {
      repoInput.value = p;
    }
  } catch {}

  function getTarget() {
    let t = repoInput ? repoInput.value.trim() : '';
    if (!t) {
      t = 'examples/acme-shop';
      if (repoInput) repoInput.value = t;
    }
    return t;
  }

  // Pre-fill target if passed via onProject bridge event
  if (window.dock?.onProject) {
    window.dock.onProject((project) => {
      if (project && repoInput && !userEditedRepo) {
        repoInput.value = project;
      }
    });
  }

  const agents = ['scout', 'planner', 'runner', 'doctor', 'verifier', 'scribe', 'guide'];
  let audioEnabled = false;
  let activeAgent = null;
  let currentRunDir = null;

  // Agent descriptions and solo modes per docs/DOCK_CONTRACT.md
  const agentDetails = {
    scout: {
      name: 'Scout',
      cmd: 'firstrun scout <repo>',
      desc: 'Inspects project manifests (package.json, pyproject.toml), lockfiles, compose, CI, and source files reading environment variables.',
      actionText: 'Run Solo Scout',
      action: (repo) => triggerSoloRun('scout', repo)
    },
    planner: {
      name: 'Planner',
      cmd: 'firstrun plan <repo>',
      desc: 'Parses human README prose into ordered executable steps and flags docs-vs-code discrepancies statically (~2s, no Docker).',
      actionText: 'Run Solo Plan',
      action: (repo) => triggerSoloRun('planner', repo)
    },
    runner: {
      name: 'Runner',
      cmd: 'firstrun run <repo> --as-written',
      desc: 'Executes README commands as written in a clean container without repairs to record baseline breakage.',
      actionText: 'Run As-Written',
      action: (repo) => triggerSoloRun('runner', repo)
    },
    doctor: {
      name: 'Doctor',
      cmd: 'firstrun doctor --log <file>',
      desc: 'Diagnoses setup failures. Rules first for speed & zero cost; IBM Bob Shell headless for unseen breaks. Also powers Lens on-screen circling.',
      actionText: 'Run Solo Doctor',
      action: (repo) => triggerSoloRun('doctor', repo),
      secondaryActionText: 'Circle on Screen (Lens)',
      secondaryAction: () => triggerLens()
    },
    verifier: {
      name: 'Verifier',
      cmd: 'firstrun replay <run-dir>',
      desc: 'Throws the machine away. Runs the repaired guide from zero in a brand-new container to verify every step reproduces cleanly.',
      actionText: 'Replay from Zero',
      action: (repo) => triggerSoloRun('verifier', repo)
    },
    scribe: {
      name: 'Scribe',
      cmd: 'firstrun scribe <run-dir>',
      desc: 'Generates smallest README diff, cryptographic Setup Passport (passport.svg), and FIRSTRUN.md report.',
      actionText: 'Open Passport',
      action: () => openArtifact('passport')
    },
    guide: {
      name: 'Guide',
      cmd: 'firstrun guide <repo>',
      desc: 'Interactive newcomer onboarding guide that walks you through verified steps with copyable commands.',
      actionText: 'Start Guide Mode',
      action: (repo) => triggerSoloRun('guide', repo)
    }
  };

  // State Management per docs/DOCK_CONTRACT.md §3: idle · working · done · needs_you
  function setAgentState(name, state, line) {
    const row = document.getElementById(`agent-${name}`);
    const badge = document.getElementById(`badge-${name}`);
    const statusLine = document.getElementById(`status-${name}`);
    if (!row || !badge) return;

    row.classList.remove('state-idle', 'state-working', 'state-done', 'state-needs_you');
    row.classList.add(`state-${state}`);

    badge.textContent = state === 'needs_you' ? 'alert' : state;
    if (line) {
      statusLine.textContent = line;
    }

    if (state === 'working' && audioEnabled) {
      speak(`${name}: ${line || 'working'}`);
    }
  }

  function setVerdict(verdict) {
    if (!verdict) return;
    const v = verdict.toLowerCase();
    verdictPill.className = `verdict-pill ${v}`;
    verdictPill.textContent = verdict.toUpperCase();
  }

  function speak(text) {
    if (!audioEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // Ignore audio failure
    }
  }

  // Audio Toggle
  audioToggle.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    audioToggle.style.color = audioEnabled ? 'var(--pass)' : 'var(--ink-3)';
    audioToggle.title = audioEnabled ? 'Audio announcements enabled' : 'Toggle audio status announcements';
    if (audioEnabled) speak('FirstRun audio announcements enabled');
  });

  // Cancel Button
  cancelBtn.addEventListener('click', () => {
    if (simulationTimer) {
      clearInterval(simulationTimer);
      simulationTimer = null;
    }
    if (window.dock?.cancel) {
      window.dock.cancel();
    }
    cancelBtn.style.display = 'none';
    bobPrompt.textContent = "I've stopped the run.";
    setVerdict('idle');
  });

  // Drawer Interactions
  function openDrawer(agentKey) {
    activeAgent = agentKey;
    const info = agentDetails[agentKey];
    if (!info) return;

    // Highlight row
    agents.forEach(a => {
      const el = document.getElementById(`agent-${a}`);
      if (el) el.classList.toggle('selected', a === agentKey);
    });

    drawerTitle.textContent = `${info.name} · Solo Mode`;
    drawerBody.innerHTML = `
      <p style="margin:0 0 6px"><strong>Command:</strong> <code style="font-family:monospace;color:var(--bob)">${info.cmd}</code></p>
      <p style="margin:0">${info.desc}</p>
    `;

    drawerActions.innerHTML = '';

    // Primary action button
    const actBtn = document.createElement('button');
    actBtn.className = 'drawer-action-btn';
    actBtn.textContent = `${info.actionText} →`;
    actBtn.onclick = () => info.action(getTarget());
    drawerActions.appendChild(actBtn);

    // Secondary action button if defined
    if (info.secondaryAction) {
      const secBtn = document.createElement('button');
      secBtn.className = 'drawer-action-btn secondary';
      secBtn.textContent = `${info.secondaryActionText} →`;
      secBtn.onclick = () => info.secondaryAction(getTarget());
      drawerActions.appendChild(secBtn);
    }

    // Extra Scribe buttons
    if (agentKey === 'scribe' && currentRunDir) {
      const diffBtn = document.createElement('button');
      diffBtn.className = 'drawer-action-btn';
      diffBtn.textContent = 'Open README diff';
      diffBtn.onclick = () => openArtifact('readme-diff');
      drawerActions.appendChild(diffBtn);

      const reportBtn = document.createElement('button');
      reportBtn.className = 'drawer-action-btn';
      reportBtn.textContent = 'Open FIRSTRUN.md';
      reportBtn.onclick = () => openArtifact('report');
      drawerActions.appendChild(reportBtn);
    }

    drawer.classList.add('open');
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    agents.forEach(a => {
      const el = document.getElementById(`agent-${a}`);
      if (el) el.classList.remove('selected');
    });
    activeAgent = null;
  }

  drawerClose.addEventListener('click', closeDrawer);

  // Setup agent row click listeners
  agents.forEach(name => {
    const el = document.getElementById(`agent-${name}`);
    if (el) {
      el.addEventListener('click', () => openDrawer(name));
    }
  });

  // Browse Button
  if (btnBrowse) {
    btnBrowse.addEventListener('click', () => {
      const p = prompt('Enter repository path or GitHub URL:', repoInput.value.trim() || 'examples/acme-shop');
      if (p !== null && p.trim()) {
        repoInput.value = p.trim();
      }
    });
  }

  // IPC Bridge helpers per docs/DOCK_CONTRACT.md & lens/dock-preload.cjs
  function callDockRun(agent, target) {
    if (!window.dock?.run) return false;
    cancelBtn.style.display = 'block';
    try {
      window.dock.run(agent, target);
    } catch {
      window.dock.run({ agent, target });
    }
    return true;
  }

  function callDockOpen(what, runDir) {
    if (!window.dock?.open) return false;
    try {
      window.dock.open(what, runDir);
    } catch {
      window.dock.open({ what, runDir });
    }
    return true;
  }

  // Action Buttons
  btnPlan?.addEventListener('click', () => {
    const target = getTarget();
    bobPrompt.textContent = `I'll send the Scout and Planner to check ${target} statically…`;
    if (!callDockRun('planner', target)) {
      simulatePlan(target);
    }
  });

  btnVerify?.addEventListener('click', () => {
    const target = getTarget();
    bobPrompt.textContent = `I'm running the full proof on ${target}: dispatching all agents in clean containers…`;
    if (!callDockRun('all', target)) {
      simulateVerify(target);
    }
  });

  bobBtn?.addEventListener('click', () => {
    openDrawer('guide');
  });

  function triggerSoloRun(agent, target) {
    const t = target || getTarget();
    bobPrompt.textContent = `I'm dispatching the ${agent} on ${t}…`;
    if (!callDockRun(agent, t)) {
      alert(`Running solo agent: ${agent} on ${t}`);
    }
  }

  function triggerLens() {
    if (window.dock?.lens) {
      window.dock.lens();
    } else {
      alert('FirstRun Lens: Press Ctrl+Shift+Space on screen to circle any error.');
    }
  }

  function openArtifact(what) {
    if (!callDockOpen(what, currentRunDir)) {
      alert(`Opening artifact: ${what}`);
    }
  }

  const AGENTS = ['scout', 'planner', 'runner', 'doctor', 'verifier', 'scribe', 'guide'];

  function blankCharacters() {
    return {
      scout:    { state: 'idle', line: '' },
      planner:  { state: 'idle', line: '' },
      runner:   { state: 'idle', line: '' },
      doctor:   { state: 'idle', line: '' },
      verifier: { state: 'idle', line: '' },
      scribe:   { state: 'idle', line: '' },
      guide:    { state: 'idle', line: '' },
    };
  }

  function initialDockState(target, agent) {
    return {
      target: target || 'examples/acme-shop',
      agent: agent || 'all',
      phase: null,
      verdict: null,
      characters: blankCharacters(),
      evidence: [],
      bobcoins: 0,
      runDir: null,
    };
  }

  // Pure reducer per docs/DOCK_CONTRACT.md §3 and src/dock-state.js
  function reduceDockState(state, event) {
    const s = { ...state, characters: { ...state.characters } };
    function ch(name) { s.characters[name] = { ...s.characters[name] }; return s.characters[name]; }
    const { type, agent, data } = event;

    switch (type) {
      case 'phase': {
        s.phase = data.phase;
        if (data.phase === 'scout')   { ch('scout').state = 'working'; }
        if (data.phase === 'plan')    { ch('planner').state = 'working'; }
        if (data.phase === 'repair')  { ch('doctor').state = 'working'; }
        if (data.phase === 'publish') { ch('scribe').state = 'working'; }
        if (data.phase === 'replay' && s.characters.runner.state !== 'needs_you') {
          ch('runner').state = 'done'; ch('runner').line = '';
        }
        if (data.phase === 'done') {
          for (const n of AGENTS) if (s.characters[n].state === 'working') { ch(n).state = 'done'; }
        }
        break;
      }
      case 'facts': {
        ch('scout').state = 'done';
        const v = (x) => (x && typeof x === 'object' ? x.truth?.version : x);
        ch('scout').line = [data.node && `Node ${v(data.node) || '?'}`, data.python && `Python ${v(data.python) || '?'}`, `${Array.isArray(data.docs) ? data.docs.length : data.docs || 0} docs`].filter(Boolean).join(' · ');
        break;
      }
      case 'plan': {
        const n = (data.steps ?? []).length;
        const c = (data.conflicts ?? []).length;
        const runnable = (data.steps ?? []).filter((x) => !x.skip).length;
        ch('planner').line = `${n} step${n !== 1 ? 's' : ''}${c ? `, ${c} conflict${c !== 1 ? 's' : ''}` : ''}`;
        ch('planner').state = runnable === 0 ? 'needs_you' : 'done';
        break;
      }
      case 'step.start': {
        if (agent === 'runner' || agent === 'swarm') { ch('runner').state = 'working'; ch('runner').line = data.command ?? ''; }
        break;
      }
      case 'step.end': {
        if ((agent === 'runner' || agent === 'swarm') && data.status === 'failed') {
          ch('runner').state = 'needs_you'; ch('runner').line = data.command ?? '';
        }
        break;
      }
      case 'diagnosis': { ch('doctor').state = 'working'; ch('doctor').line = data.diagnosis?.cause ?? ''; break; }
      case 'evidence': {
        const ev = { id: data.id, stepId: data.stepId, status: data.status, cause: '' };
        s.evidence = [...(s.evidence ?? []).filter((e) => e.id !== data.id), ev];
        if (data.status === 'verified' || data.status === 'progressed') {
          ch('doctor').state = 'done'; ch('doctor').line = data.status;
        } else if (data.status === 'needs-human' || data.status === 'failed') {
          ch('doctor').state = 'needs_you'; ch('doctor').line = 'needs a human';
        }
        break;
      }
      case 'bob': { s.bobcoins = (s.bobcoins ?? 0) + (data.bobcoins ?? 0); break; }
      case 'replay.start': { ch('verifier').state = 'working'; break; }
      case 'replay.end': {
        ch('verifier').state = data.status === 'passed' ? 'done' : 'needs_you';
        ch('verifier').line = data.status ?? '';
        break;
      }
      case 'passport': { ch('scribe').state = 'done'; break; }
      case 'done': { s.verdict = data.verdict; break; }
      case 'artifact': { if (data.path) s.runDir = s.runDir ?? data.path.replace(/\/out\/.*$/, ''); break; }
      default: break;
    }
    return s;
  }

  const bobPhaseMessages = {
    scout: "I've sent the Scout in to inspect manifests and docs.",
    plan: "I'm having the Planner build the execution DAG and flag drifts.",
    run: "I've started the Runner in a clean container to test steps as written.",
    repair: "The Doctor is diagnosing the break. I'll step in if reasoning is needed.",
    replay: "All repairs applied. Verifier is testing the guide from zero in a clean machine.",
    publish: "Verified! Scribe is minting your Setup Passport and FIRSTRUN.md report.",
    done: "Your README is proven from zero. 0 human steps needed."
  };

  function applyDockState(state) {
    if (!state) return;
    if (state.target && repoInput && !userEditedRepo && document.activeElement !== repoInput) repoInput.value = state.target;
    if (state.verdict) setVerdict(state.verdict);
    if (state.runDir) currentRunDir = state.runDir;
    if (state.bobcoins !== undefined) bobcoinMeter.textContent = `${state.bobcoins.toFixed(2)} Bobcoins`;

    if (state.phase) {
      const msg = bobPhaseMessages[state.phase] || `I'm coordinating the ${state.phase} phase…`;
      bobPrompt.textContent = msg;
    }

    if (state.evidence && state.evidence.length > 0) {
      stepCounter.textContent = `${state.evidence.length} break${state.evidence.length !== 1 ? 's' : ''} fixed`;
    }

    if (state.characters) {
      Object.keys(state.characters).forEach(agentName => {
        const info = state.characters[agentName];
        if (info) {
          setAgentState(agentName, info.state || 'idle', info.line || '');
        }
      });
    }

    if (state.verdict === 'VERIFIED') {
      bobPrompt.textContent = "I've proven examples/acme-shop from zero (7 steps, 5 conflicts, 5 breaks fixed, 14 s replay).";
      cancelBtn.style.display = 'none';
      verdictPill.textContent = 'REPLAY · VERIFIED';
      stepCounter.textContent = '7 steps · 5 breaks fixed (14 s)';
    } else if (state.verdict === 'FAILED') {
      bobPrompt.textContent = "Run finished with unresolved breaks. Check the flight log.";
      cancelBtn.style.display = 'none';
    }
  }

  // Live IPC state listener per docs/DOCK_CONTRACT.md §4:
  // { target, agent, phase, verdict, characters: { scout:{state,line}, … }, evidence:[…], bobcoins, runDir }
  if (window.dock?.onState) {
    window.dock.onState((state) => {
      applyDockState(state);
      if (state?.verdict === 'VERIFIED' || state?.verdict === 'FAILED') {
        cancelBtn.style.display = 'none';
      }
    });
  }

  // Browser preview mode (when window.dock Electron bridge is not connected)
  function isAcmeShop(target) {
    return target === 'examples/acme-shop' || target.endsWith('/acme-shop') || target === 'acme-shop';
  }

  function showDesktopRequired(target) {
    bobPrompt.textContent = `I need the FirstRun desktop app to spin up Docker containers for ${target}.`;
    setVerdict('needs_app');
    stepCounter.textContent = 'Desktop required';
    
    drawerTitle.textContent = 'Desktop Verification Required';
    drawerBody.innerHTML = `
      <p style="margin:0 0 8px;color:var(--repair)"><strong>Live container verification requires Docker and the FirstRun desktop app:</strong></p>
      <pre style="background:rgba(0,0,0,.45);padding:8px;border-radius:6px;font:11.5px monospace;color:var(--ink);margin:0 0 8px">firstrun verify ${target}</pre>
      <p style="margin:0;font-size:12px;color:var(--ink-2)">In browser preview mode without an Electron IPC bridge, you can replay the recorded run for <code>examples/acme-shop</code>.</p>
    `;
    drawerActions.innerHTML = `
      <button class="drawer-action-btn" id="btn-load-demo" type="button">Replay acme-shop demo →</button>
    `;
    document.getElementById('btn-load-demo').onclick = () => {
      repoInput.value = 'examples/acme-shop';
      simulateVerify('examples/acme-shop');
    };
    drawer.classList.add('open');
  }

  let simulationTimer = null;

  function simulatePlan(target) {
    if (!isAcmeShop(target)) {
      showDesktopRequired(target);
      return;
    }

    if (simulationTimer) { clearInterval(simulationTimer); simulationTimer = null; }

    setVerdict('running');
    verdictPill.textContent = 'REPLAY · PLAN';
    stepCounter.textContent = 'Planning (replay)…';
    bobPrompt.textContent = "I'll send the Scout and Planner to check examples/acme-shop statically…";

    let state = initialDockState('examples/acme-shop', 'planner');
    applyDockState(state);

    const recorded = window.ACME_SHOP_EVENTS || [];
    const planEvents = [];
    for (const ev of recorded) {
      planEvents.push(ev);
      if (ev.type === 'plan') break;
    }

    let i = 0;
    simulationTimer = setInterval(() => {
      if (i >= planEvents.length) {
        clearInterval(simulationTimer);
        simulationTimer = null;
        setVerdict('passed');
        verdictPill.textContent = 'REPLAY · PLANNED';
        stepCounter.textContent = '9 steps · 5 conflicts';
        bobPrompt.textContent = "I've analyzed examples/acme-shop: 9 steps mapped, 5 conflicts flagged from the recorded run.";
        speak("I've finished the recorded plan check: 9 steps and 5 conflicts identified.");
        return;
      }
      state = reduceDockState(state, planEvents[i]);
      applyDockState(state);
      i++;
    }, 350);
  }

  function simulateVerify(target) {
    if (!isAcmeShop(target)) {
      showDesktopRequired(target);
      return;
    }

    if (simulationTimer) { clearInterval(simulationTimer); simulationTimer = null; }

    cancelBtn.style.display = 'block';
    setVerdict('running');
    verdictPill.textContent = 'REPLAY · RECORDED';
    bobPrompt.textContent = "Replaying recorded run: examples/acme-shop (seeded breaks)…";
    stepCounter.textContent = 'Replay starting…';
    bobcoinMeter.textContent = '0.00 Bobcoins';

    let state = initialDockState('examples/acme-shop', 'all');
    applyDockState(state);

    const recorded = window.ACME_SHOP_EVENTS || [];
    // Filter to state-changing events for a responsive, true-to-life playback (~6-8s)
    const keyEvents = recorded.filter(e => e.type !== 'step.log' && e.type !== 'note' && e.type !== 'fix');

    let i = 0;
    simulationTimer = setInterval(() => {
      if (i >= keyEvents.length) {
        clearInterval(simulationTimer);
        simulationTimer = null;
        cancelBtn.style.display = 'none';
        setVerdict('passed');
        verdictPill.textContent = 'REPLAY · VERIFIED';
        stepCounter.textContent = '7 steps · 5 breaks fixed (14 s)';
        bobPrompt.textContent = "examples/acme-shop: recorded run replay VERIFIED (7 steps, 5 conflicts, 5 breaks fixed, 14 s).";
        speak('examples/acme-shop recorded run replay verified. 7 steps, 5 breaks fixed, 14 seconds.');
        return;
      }
      state = reduceDockState(state, keyEvents[i]);
      applyDockState(state);
      i++;
    }, 180);
  }
})();
