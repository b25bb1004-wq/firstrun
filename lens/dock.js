/**
 * FirstRun Dock UI Logic
 * Connects the 7 agent character avatars to live events.ndjson via IPC
 * or runs interactive simulation in browser preview mode.
 */

(function () {
  'use strict';

  // DOM Elements
  const repoInput = document.getElementById('repo-input');
  const btnBrowse = document.getElementById('btn-browse');
  const btnPlan = document.getElementById('btn-plan');
  const btnVerify = document.getElementById('btn-verify');
  const bobBtn = document.getElementById('bob-btn');
  const bobPrompt = document.getElementById('bob-prompt');
  const verdictPill = document.getElementById('verdict-pill');
  const stepCounter = document.getElementById('step-counter');
  const bobcoinMeter = document.getElementById('bobcoin-meter');
  const audioToggle = document.getElementById('audio-toggle');
  const minimizeBtn = document.getElementById('minimize-btn');
  const drawer = document.getElementById('drawer');
  const drawerTitle = document.getElementById('drawer-title');
  const drawerBody = document.getElementById('drawer-body');
  const drawerClose = document.getElementById('drawer-close');
  const drawerAction = document.getElementById('drawer-action-container');

  const agents = ['scout', 'planner', 'runner', 'doctor', 'verifier', 'scribe', 'guide'];
  let audioEnabled = false;
  let activeAgent = null;

  // Agent descriptions and solo modes
  const agentDetails = {
    scout: {
      name: 'Scout',
      cmd: 'firstrun scout',
      desc: 'Inspects project manifests (package.json, pyproject.toml, Cargo.toml), lockfiles, compose, CI workflows, and source files reading environment variables.',
      actionText: 'Run Solo Scout',
      action: (repo) => runSoloCommand('scout', repo)
    },
    planner: {
      name: 'Planner',
      cmd: 'firstrun plan',
      desc: 'Parses human README prose into ordered executable steps. Statically checks for docs-vs-code discrepancies (Node/Python versions, missing env vars, stale commands).',
      actionText: 'Inspect Plan & Conflicts',
      action: (repo) => runSoloCommand('plan', repo)
    },
    runner: {
      name: 'Runner',
      cmd: 'run --as-written',
      desc: 'Executes setup steps inside an isolated, clean-room Debian container with sidecar services (Postgres, Redis, MySQL). Captures stdout/stderr flight logs.',
      actionText: 'Run As-Written',
      action: (repo) => runSoloCommand('run', repo)
    },
    doctor: {
      name: 'Doctor',
      cmd: 'doctor --log / Lens',
      desc: 'Diagnoses setup failures. Runs deterministic rules first for speed & zero cost. Escalates unseen breaks to IBM Bob (Bob Shell headless) within budget caps.',
      actionText: 'Circle on Screen (Lens)',
      action: () => triggerLensOverlay()
    },
    verifier: {
      name: 'Verifier',
      cmd: 'replay <dir>',
      desc: 'Throws the machine away completely. Runs the repaired setup guide from zero in a brand-new container to prove every step reproduces cleanly.',
      actionText: 'Replay from Zero',
      action: (repo) => runSoloCommand('verify', repo)
    },
    scribe: {
      name: 'Scribe',
      cmd: 'scribe <dir>',
      desc: 'Publishes verified artifacts: smallest README diff, cryptographic Setup Passport (passport.svg), FIRSTRUN.md report, devcontainer.json, and CI drift guard.',
      actionText: 'View Setup Passport',
      action: () => viewPassportArtifact()
    },
    guide: {
      name: 'Guide',
      cmd: 'firstrun guide',
      desc: 'Ships into verified repositories as an interactive newcomer onboarding assistant. Walks you step-by-step with proven commands and context.',
      actionText: 'Start Interactive Guide',
      action: (repo) => runSoloCommand('guide', repo)
    }
  };

  // State Management
  function setAgentState(name, state, line) {
    const row = document.getElementById(`agent-${name}`);
    const badge = document.getElementById(`badge-${name}`);
    const statusLine = document.getElementById(`status-${name}`);
    if (!row || !badge) return;

    row.classList.remove('state-idle', 'state-working', 'state-done', 'state-needs-you');
    row.classList.add(`state-${state}`);

    badge.textContent = state === 'needs-you' ? 'alert' : state;
    if (line) {
      statusLine.textContent = line;
    }

    if (state === 'working' && audioEnabled) {
      speak(`${name} is now working: ${line || ''}`);
    }
  }

  function setVerdict(verdict) {
    verdictPill.className = `verdict-pill ${verdict.toLowerCase()}`;
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

    drawerAction.innerHTML = '';
    const actBtn = document.createElement('button');
    actBtn.className = 'drawer-action-btn';
    actBtn.textContent = `${info.actionText} →`;
    actBtn.onclick = () => info.action(repoInput.value.trim());
    drawerAction.appendChild(actBtn);

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

  // Actions
  btnPlan.addEventListener('click', () => {
    const target = repoInput.value.trim() || 'examples/acme-shop';
    runPlanFlow(target);
  });

  btnVerify.addEventListener('click', () => {
    const target = repoInput.value.trim() || 'examples/acme-shop';
    runVerifyFlow(target);
  });

  bobBtn.addEventListener('click', () => {
    openDrawer('guide');
  });

  minimizeBtn.addEventListener('click', () => {
    if (window.dockBridge?.minimize) {
      window.dockBridge.minimize();
    }
  });

  btnBrowse.addEventListener('click', async () => {
    if (window.dockBridge?.selectDirectory) {
      const dir = await window.dockBridge.selectDirectory();
      if (dir) repoInput.value = dir;
    }
  });

  function triggerLensOverlay() {
    if (window.dockBridge?.openLens) {
      window.dockBridge.openLens(repoInput.value.trim());
    } else {
      alert('FirstRun Lens: Press Ctrl+Shift+Space on screen to circle any error.');
    }
  }

  function viewPassportArtifact() {
    const url = 'http://localhost:3000/#/passport';
    if (window.dockBridge?.openExternal) {
      window.dockBridge.openExternal(url);
    } else {
      window.open('/passport.svg', '_blank');
    }
  }

  function runSoloCommand(cmd, repo) {
    if (window.dockBridge?.runSolo) {
      window.dockBridge.runSolo(cmd, repo);
    } else {
      alert(`Running solo agent: firstrun ${cmd} ${repo}`);
    }
  }

  // Simulation / IPC binding
  function runPlanFlow(target) {
    bobPrompt.textContent = `Planning ${target}…`;
    setVerdict('running');
    stepCounter.textContent = 'Analyzing…';

    setAgentState('scout', 'working', 'Reading manifests, package.json, compose');
    setAgentState('planner', 'idle', 'Waiting for scout facts');

    setTimeout(() => {
      setAgentState('scout', 'done', 'Found Node.js v16, Postgres, Redis dependencies');
      setAgentState('planner', 'working', 'Parsing README prose into 5 steps');

      setTimeout(() => {
        setAgentState('planner', 'done', '5 steps found; flagged Node version conflict');
        bobPrompt.textContent = `Plan ready for ${target}`;
        stepCounter.textContent = '5 steps mapped';
        setVerdict('passed');
        speak('Plan complete. 5 steps identified with 1 version drift flagged.');
      }, 900);
    }, 900);
  }

  function runVerifyFlow(target) {
    bobPrompt.textContent = `Proving ${target} in container…`;
    setVerdict('running');
    stepCounter.textContent = 'Step 1/5';
    bobcoinMeter.textContent = '0.00 Bobcoins';

    // 1. Scout
    setAgentState('scout', 'working', 'Scanning repository structure');
    setTimeout(() => {
      setAgentState('scout', 'done', 'Manifests analyzed');

      // 2. Planner
      setAgentState('planner', 'working', 'Ordering steps');
      setTimeout(() => {
        setAgentState('planner', 'done', '5 steps scheduled');

        // 3. Runner
        setAgentState('runner', 'working', 'Step 1: npm install (exit 0)');
        stepCounter.textContent = 'Step 1/5';

        setTimeout(() => {
          setAgentState('runner', 'needs-you', 'Step 2: Failed connect ECONNREFUSED 6379');
          stepCounter.textContent = 'Step 2/5 (Break)';

          // 4. Doctor
          setAgentState('doctor', 'working', 'Diagnosing: missing-service (Redis)');
          setTimeout(() => {
            setAgentState('doctor', 'done', 'Fix: docker compose up -d redis (0 Bobcoins)');
            bobcoinMeter.textContent = '0.00 Bobcoins';

            // 5. Runner replay repair
            setAgentState('runner', 'working', 'Applying Redis sidecar & restarting');
            setTimeout(() => {
              setAgentState('runner', 'done', 'App started & listening on port 3000');
              stepCounter.textContent = 'Step 5/5';

              // 6. Verifier
              setAgentState('verifier', 'working', 'Discarding machine; replay from zero');
              setTimeout(() => {
                setAgentState('verifier', 'done', 'Replay passed in 23s');

                // 7. Scribe
                setAgentState('scribe', 'working', 'Writing README diff & passport.svg');
                setTimeout(() => {
                  setAgentState('scribe', 'done', 'Passport generated: VERIFIED');
                  setAgentState('guide', 'done', 'Guide mode active for newcomers');

                  bobPrompt.textContent = `${target} verified! Ready for onboarding.`;
                  setVerdict('passed');
                  stepCounter.textContent = '5/5 steps proven';
                  speak('Verification complete. acme-shop is verified from zero.');
                }, 700);
              }, 900);
            }, 800);
          }, 900);
        }, 800);
      }, 800);
    }, 700);
  }

  // Live IPC state listener (bound to Friday's Electron IPC bridge)
  if (window.dockBridge?.onStateUpdate) {
    window.dockBridge.onStateUpdate((state) => {
      if (state.target) repoInput.value = state.target;
      if (state.verdict) setVerdict(state.verdict);
      if (state.bobcoins !== undefined) bobcoinMeter.textContent = `${state.bobcoins.toFixed(2)} Bobcoins`;
      if (state.stepText) stepCounter.textContent = state.stepText;
      if (state.prompt) bobPrompt.textContent = state.prompt;

      if (state.agents) {
        Object.keys(state.agents).forEach(agentName => {
          const info = state.agents[agentName];
          if (info) {
            setAgentState(agentName, info.state || 'idle', info.line || '');
          }
        });
      }
    });
  }
})();
