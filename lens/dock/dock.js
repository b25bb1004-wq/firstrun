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
      if (project && repoInput) {
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
    if (window.dock?.cancel) {
      window.dock.cancel();
    }
    cancelBtn.style.display = 'none';
    bobPrompt.textContent = 'Job cancelled.';
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
    if (!callDockRun('planner', target)) {
      simulatePlan(target);
    }
  });

  btnVerify?.addEventListener('click', () => {
    const target = getTarget();
    if (!callDockRun('all', target)) {
      simulateVerify(target);
    }
  });

  bobBtn?.addEventListener('click', () => {
    openDrawer('guide');
  });

  function triggerSoloRun(agent, target) {
    const t = target || getTarget();
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

  // Live IPC state listener per docs/DOCK_CONTRACT.md §4:
  // { target, agent, phase, verdict, characters: { scout:{state,line}, … }, evidence:[…], bobcoins, runDir }
  if (window.dock?.onState) {
    window.dock.onState((state) => {
      if (!state) return;
      if (state.target) repoInput.value = state.target;
      if (state.verdict) setVerdict(state.verdict);
      if (state.runDir) currentRunDir = state.runDir;
      if (state.bobcoins !== undefined) bobcoinMeter.textContent = `${state.bobcoins.toFixed(2)} Bobcoins`;
      if (state.phase) bobPrompt.textContent = `Phase: ${state.phase}`;

      if (state.characters) {
        Object.keys(state.characters).forEach(agentName => {
          const info = state.characters[agentName];
          if (info) {
            setAgentState(agentName, info.state || 'idle', info.line || '');
          }
        });
      }

      if (state.verdict === 'VERIFIED' || state.verdict === 'FAILED') {
        cancelBtn.style.display = 'none';
      }
    });
  }

  // Browser preview mode (when window.dock Electron bridge is not connected)
  function isAcmeShop(target) {
    return target === 'examples/acme-shop' || target.endsWith('/acme-shop') || target === 'acme-shop';
  }

  function showDesktopRequired(target) {
    bobPrompt.textContent = 'Live proof requires FirstRun desktop app';
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

  function simulatePlan(target) {
    if (!isAcmeShop(target)) {
      showDesktopRequired(target);
      return;
    }

    bobPrompt.textContent = 'Recorded plan: examples/acme-shop';
    setVerdict('running');
    stepCounter.textContent = 'Planning (replay)…';

    setAgentState('scout', 'working', 'Reading manifests, package.json, compose');
    setAgentState('planner', 'idle', 'Waiting for facts');

    setTimeout(() => {
      setAgentState('scout', 'done', 'Node 16 LTS, Postgres, Redis dependencies');
      setAgentState('planner', 'working', 'Parsing README prose into 5 steps');

      setTimeout(() => {
        setAgentState('planner', 'done', '5 steps found · 1 version drift flagged');
        bobPrompt.textContent = 'Recorded plan: examples/acme-shop (demo)';
        stepCounter.textContent = '5 steps mapped';
        setVerdict('passed');
        verdictPill.textContent = 'REPLAY · PLAN';
        speak('Recorded plan complete. 5 steps identified with 1 version drift.');
      }, 700);
    }, 700);
  }

  function simulateVerify(target) {
    if (!isAcmeShop(target)) {
      showDesktopRequired(target);
      return;
    }

    bobPrompt.textContent = 'Replaying recorded run: examples/acme-shop (seeded breaks)…';
    setVerdict('running');
    verdictPill.textContent = 'REPLAYING';
    stepCounter.textContent = 'Step 1/5 (replay)';
    bobcoinMeter.textContent = '0.00 Bobcoins';

    setAgentState('scout', 'working', 'Scanning repo structure');
    setTimeout(() => {
      setAgentState('scout', 'done', 'Manifests analyzed');
      setAgentState('planner', 'working', 'Ordering steps');

      setTimeout(() => {
        setAgentState('planner', 'done', '5 steps scheduled');
        setAgentState('runner', 'working', 'Step 1: npm install (exit 0)');

        setTimeout(() => {
          setAgentState('runner', 'needs_you', 'Step 2: connect ECONNREFUSED 6379');
          stepCounter.textContent = 'Step 2/5 (Break)';
          setAgentState('doctor', 'working', 'Diagnosing missing-service rule (Redis)');

          setTimeout(() => {
            setAgentState('doctor', 'done', 'Fix: docker compose up -d redis (0 Bobcoins)');
            setAgentState('runner', 'working', 'Applying Redis sidecar & restarting');

            setTimeout(() => {
              setAgentState('runner', 'done', 'App started & listening on port 3000');
              setAgentState('verifier', 'working', 'Discarding machine; replay from zero');

              setTimeout(() => {
                setAgentState('verifier', 'done', 'Replay passed in 23s');
                setAgentState('scribe', 'working', 'Writing README diff & passport.svg');

                setTimeout(() => {
                  setAgentState('scribe', 'done', 'Passport generated: VERIFIED');
                  setAgentState('guide', 'done', 'Guide mode ready for newcomers');
                  bobPrompt.textContent = 'examples/acme-shop: recorded run replay VERIFIED';
                  setVerdict('passed');
                  verdictPill.textContent = 'REPLAY · VERIFIED';
                  stepCounter.textContent = '5/5 steps (recorded)';
                  speak('Recorded replay complete: acme-shop verified from zero.');
                }, 600);
              }, 700);
            }, 600);
          }, 700);
        }, 600);
      }, 600);
    }, 600);
  }
})();
