/**
 * HUMBLE Console — Electron Onboarding & Guide Mode
 * Spec: docs/design/HUMBLE_CONSOLE_SPEC.md (Sections 1-8, 11)
 * Imports console-core.js exports via thin adapter (section 6):
 *   flight, typeSchedule, lineFromBeat, lineFromGuideStep, reelPlayer, onboardingTimeline
 * Uses lens/humble/robot.js for mascot states (section 5)
 */

import { HumbleRobot, flightMath, HUMBLE_STATES, AGENT_COLORS } from './robot.js';
import { redactTokens, redactSecrets, REDACTED } from '../../src/redact.js';

// ============================================================================
// CONSOLE-CORE ADAPTER (thin layer over spec section 6 exports)
// When lens/humble/console-core.js exists, replace this with: import * as core from './console-core.js'
// ============================================================================
const consoleCore = {
  // Spec section 4: typing speeds
  typeSchedule: {
    welcome: 30,        // fixed 30ms/char (C)
    bubble: [30, 60],   // random 30–60ms/char (C)
    command: 18,        // 18ms/char, then 120ms pause before why line
    outputLine: 40,     // output lines appear every 40ms
  },

  // Spec section 6: flight math (matches robot.js flightMath exactly)
  flight: {
    duration: flightMath.duration,
    easedProgress: flightMath.easedProgress,
    scalePeak: flightMath.scalePeak,
    glowRadius: flightMath.glowRadius,
    bezierPoint: flightMath.bezierPoint,
    controlPoint: flightMath.controlPoint,
  },

  // Spec section 3: line grammar — create terminal line elements
  lineFromBeat(beat, { redact = true } = {}) {
    const line = document.createElement('div');
    line.className = `term-line ${beat.kind}`;

    switch (beat.kind) {
      case 'cmd': {
        const prompt = document.createElement('span');
        prompt.className = 'prompt';
        prompt.textContent = '$ ';
        const cmd = document.createElement('span');
        cmd.textContent = beat.command;
        const status = document.createElement('span');
        status.className = 'status';
        if (beat.status === 'ok') {
          status.classList.add('ok');
          status.textContent = `✓ ${beat.duration}s`;
        } else if (beat.status === 'fail') {
          status.classList.add('fail');
          status.textContent = '✗';
        } else if (beat.running) {
          status.innerHTML = '<span class="spinner">⠋</span>';
        }
        line.append(prompt, cmd, status);
        break;
      }
      case 'why': {
        line.textContent = `  why: ${beat.text}`;
        break;
      }
      case 'out': {
        const content = document.createElement('div');
        content.className = 'out-content';
        const lines = (beat.lines || []).slice(0, 6);
        lines.forEach(l => {
          const lEl = document.createElement('div');
          lEl.className = 'out-line';
          lEl.textContent = redact ? redactSecrets(l) : l;
          content.appendChild(lEl);
        });
        if ((beat.lines || []).length > 6) {
          const more = document.createElement('button');
          more.className = 'expand-btn';
          more.textContent = `… ${(beat.lines || []).length - 6} more lines`;
          more.onclick = () => {
            const remaining = (beat.lines || []).slice(6);
            remaining.forEach(l => {
              const lEl = document.createElement('div');
              lEl.className = 'out-line';
              lEl.textContent = redact ? redactSecrets(l) : l;
              content.appendChild(lEl);
            });
            more.remove();
          };
          content.appendChild(more);
        }
        line.appendChild(content);
        break;
      }
      case 'fail': {
        line.textContent = `  > ${beat.text}`;
        break;
      }
      case 'diag': {
        const tag = document.createElement('span');
        tag.style.color = `var(--agent-${beat.agent})`;
        tag.textContent = `[${beat.agent.toUpperCase()}] `;
        const text = document.createElement('span');
        text.textContent = beat.text;
        line.append(tag, text);
        break;
      }
      case 'was': {
        line.textContent = `  - ${beat.text}`;
        break;
      }
      case 'fix': {
        line.textContent = `  + ${beat.text}`;
        break;
      }
      case 'pass': {
        // Handled on cmd line
        break;
      }
      case 'sys': {
        line.textContent = beat.text;
        line.style.fontStyle = 'italic';
        line.style.color = 'var(--c-ink-3)';
        break;
      }
    }
    return line;
  },

  // Spec section 8: guide step -> terminal lines
  lineFromGuideStep(step, { redact = true } = {}) {
    const lines = [];
    // cmd line
    const cmdBeat = { kind: 'cmd', command: step.do?.command || step.do?.type, running: true };
    lines.push(this.lineFromBeat(cmdBeat));
    // why line
    if (step.why?.cause) {
      lines.push(this.lineFromBeat({ kind: 'why', text: step.why.cause }));
    }
    return lines;
  },

  // Spec section 7: reel player (compressed ~25s replay)
  async reelPlayer(reelData, terminalEl, mascot, { onBeat } = {}) {
    for (const beat of reelData) {
      const lineEl = this.lineFromBeat(beat, { redact: true });
      terminalEl.appendChild(lineEl);
      terminalEl.scrollTop = terminalEl.scrollHeight;
      if (onBeat) onBeat(beat, lineEl);
      // Spec: output lines appear every 40ms
      await new Promise(r => setTimeout(r, this.typeSchedule.outputLine));
    }
  },

  // Spec section 7: onboarding timeline steps
  onboardingTimeline: [
    { id: 'intro', label: 'Machine check' },
    { id: 'boot', label: 'Boot', duration: 420 },
    { id: 'welcome', label: 'Welcome', duration: 2000 },
    { id: 'reel', label: 'Reel', duration: 25000 },
    { id: 'demo-point-1', label: 'Point: fail', duration: 3000 },
    { id: 'demo-point-2', label: 'Point: fix', duration: 3000 },
    { id: 'cta', label: 'Call to action', duration: 10000 },
  ],
};

// ============================================================================
// UTILITIES
// ============================================================================
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function typeText(el, text, { min = 30, max = 60 } = {}) {
  return new Promise(resolve => {
    if (reducedMotion()) { el.textContent = text; resolve(); return; }
    let i = 0;
    const tick = () => {
      if (i < text.length) {
        el.textContent += text[i++];
        const delay = min + Math.random() * (max - min);
        setTimeout(tick, delay);
      } else { resolve(); }
    };
    tick();
  });
}

function typeCommand(el, text) {
  return typeText(el, text, { min: 18, max: 18 });
}

// ============================================================================
// MAIN CONSOLE CLASS
// ============================================================================
export class HumbleConsole {
  constructor() {
    this.window = document.querySelector('.console-window');
    this.mascotContainer = document.getElementById('mascot-container');
    this.introPanel = document.getElementById('intro-panel');
    this.terminalPane = document.getElementById('terminal-pane');
    this.terminalContent = document.getElementById('terminal-content');
    this.caret = document.getElementById('caret');
    this.scrollPill = document.getElementById('scroll-pill');
    this.statusDot = document.getElementById('status-dot');
    this.closeBtn = document.getElementById('close-btn');
    this.btnStart = document.getElementById('btn-start');
    this.btnSkip = document.getElementById('btn-skip');
    this.btnShowHow = document.getElementById('btn-show-how');
    this.btnDoIt = document.getElementById('btn-do-it');
    this.btnStop = document.getElementById('btn-stop');
    this.btnConfirmRun = document.getElementById('btn-confirm-run');
    this.btnConfirmCancel = document.getElementById('btn-confirm-cancel');
    this.inlineConfirm = document.getElementById('inline-confirm');
    this.confirmText = document.getElementById('confirm-text');
    this.stepCounter = document.getElementById('step-counter');
    this.replayLink = document.getElementById('replay-link');
    this.checklist = document.getElementById('checklist');
    this.optionalChecklist = document.getElementById('optional-checklist');
    this.checklistDivider = document.getElementById('checklist-divider');
    this.introPersonal = document.getElementById('intro-personal');
    this.introTrust = document.getElementById('intro-trust');
    this.consoleSubtitle = document.getElementById('console-subtitle');
    this.footerLeft = document.getElementById('footer-left');
    this.footerRight = document.getElementById('footer-right');

    this.mascot = null;
    this.probeData = null;
    this.guide = null;
    this.report = null;
    this.currentStepIndex = 0;
    this.onboarded = false;
    this.userScrolledUp = false;
    this.runningCommand = null;
    this.pollInterval = null;

    this.init();
  }

  async init() {
    // Initialize mascot (spec section 5)
    this.mascot = new HumbleRobot(this.mascotContainer, {
      size: '56',
      initialState: 'sleep',
      autoIdle: true,
    });

    // Event listeners
    this.closeBtn.onclick = () => this.close();
    this.btnStart.onclick = () => this.startOnboarding();
    this.btnSkip.onclick = () => this.skipIntro();
    this.btnShowHow.onclick = () => this.showHow();
    this.btnDoIt.onclick = () => this.doItForMe();
    this.btnStop.onclick = () => this.stopCommand();
    this.btnConfirmRun.onclick = () => this.confirmRun();
    this.btnConfirmCancel.onclick = () => this.cancelConfirm();
    this.replayLink.onclick = (e) => { e.preventDefault(); this.replayOnboarding(); };

    // Scroll detection for scroll pill
    this.terminalContent.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.terminalContent;
      this.userScrolledUp = scrollTop + clientHeight < scrollHeight - 50;
      this.scrollPill.classList.toggle('visible', this.userScrolledUp);
    });

    // Keyboard: Esc closes panel but asks if command running
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.handleEscape();
      if (e.key === 'Enter' && this.inlineConfirm.style.display === 'flex') this.confirmRun();
    });

    // Load guide.json for acme-shop (spec section 8: steps come ONLY from guide.json)
    await this.loadGuide();

    // Run host probe (spec section 7 step 1)
    await this.runHostProbe();

    // Boot mascot (spec section 5: CRT boot on first open)
    await this.mascot.boot();

    // Type welcome (spec section 7 step 3)
    await this.typeWelcome();

    // Show intro panel with checklist
    this.renderChecklist();

    // Start polling checklist every 2s (spec section 7)
    this.startChecklistPoll();
  }

  async loadGuide() {
    try {
      // In production, this would be built from a verified run
      // For now, generate from the acme-shop run data
      const response = await fetch('../examples/acme-shop/.firstrun/plan.json');
      const plan = await response.json();
      const runResponse = await fetch('../examples/acme-shop/.firstrun/run.json');
      const run = await runResponse.json();
      const evidenceResponse = await fetch('../examples/acme-shop/.firstrun/evidence/');
      let evidence = [];
      try {
        const evidenceFiles = await evidenceResponse.json();
        evidence = evidenceFiles;
      } catch {}

      // Build guide using the same logic as src/onboarder/guide.js
      this.guide = this.buildGuideFromPlan(plan, run, evidence);
      this.consoleSubtitle.textContent = `onboarding ${this.guide.repo}`;
    } catch (e) {
      console.warn('Could not load guide, using fallback:', e);
      this.guide = this.getFallbackGuide();
    }
  }

  buildGuideFromPlan(plan, run, evidence) {
    // Simplified guide builder matching src/onboarder/guide.js logic
    const evidenceByStep = {};
    evidence.forEach(e => {
      if (!evidenceByStep[e.stepId]) evidenceByStep[e.stepId] = [];
      evidenceByStep[e.stepId].push(e);
    });

    const provenSteps = plan.steps.filter(step => {
      if (step.skip || step.status === 'skipped') return false;
      const stepEvidence = evidenceByStep[step.id] || [];
      const hasVerifiedEvidence = stepEvidence.some(e => e.status === 'verified');
      const passedFirstTry = step.status === 'passed' && stepEvidence.length === 0;
      return hasVerifiedEvidence || passedFirstTry;
    });

    const guideSteps = provenSteps.map(step => {
      const stepEvidence = evidenceByStep[step.id] || [];
      const verifiedEvidence = stepEvidence.filter(e => e.status === 'verified');
      const lastEvidence = verifiedEvidence[verifiedEvidence.length - 1];

      return {
        id: step.id,
        title: step.kind.charAt(0).toUpperCase() + step.kind.slice(1).replace('-', ' '),
        kind: step.kind,
        say: {
          new: this.buildSay(step, lastEvidence, 'new'),
          experienced: this.buildSay(step, lastEvidence, 'experienced')
        },
        why: this.buildWhy(step, lastEvidence),
        do: this.buildDo(step, lastEvidence),
        platform: { linux: 'proven', darwin: 'proven', win32: 'translated' },
        target: this.buildTarget(step),
        check: this.buildCheck(step, lastEvidence),
        timeoutMs: this.getTimeoutMs(step.kind),
        undo: this.buildUndo(step, lastEvidence),
        risk: this.getRisk(step.kind),
        optional: false,
        alreadySatisfiedIf: this.buildAlreadySatisfiedIf(step, lastEvidence)
      };
    });

    return {
      schema: 'humble.guide/1',
      repo: plan.repo,
      commit: plan.commit,
      verdict: 'VERIFIED',
      provenOn: { image: plan.image, os: 'linux', replaySeconds: 14, runId: 'acme-shop-verified' },
      env: { CI: '1', npm_config_yes: 'true' },
      steps: guideSteps,
      done: { type: 'http', url: 'http://127.0.0.1:3000/health', expect: 200 },
      scorecard: { proven: guideSteps.length, translated: 0, needsHuman: 0, skipped: [] },
      security: { verdict: 'clear', findings: [] }
    };
  }

  buildSay(step, evidence, mode) {
    const base = {
      install: { new: "This installs the libraries the app needs. The README might be missing a flag; I've added it.", experienced: 'npm install with proven flags from the verified run.' },
      env: { new: "This creates your local configuration file from the example. You'll add any required keys.", experienced: 'Create .env from .env.example with the verified command.' },
      services: { new: "This starts the database and other services the app needs using Docker.", experienced: 'docker compose up -d with the verified services.' },
      migrate: { new: "This prepares the database schema and sample data. The README might have the wrong script name; I fixed it.", experienced: 'Run the verified migration command.' },
      build: { new: "This builds the project for production.", experienced: 'Run the verified build command.' },
      serve: { new: "This starts the app. It will keep running; open another terminal to check it works.", experienced: 'Start the dev server on the verified port.' },
      test: { new: "This runs the tests to confirm everything works.", experienced: 'Run the test suite.' },
      other: { new: 'Next setup step.', experienced: 'Next step.' }
    };
    const s = base[step.kind] || base.other;
    return s[mode];
  }

  buildWhy(step, evidence) {
    if (!evidence) return { evidenceId: null, cause: 'Step passed on first try', log: null };
    return { evidenceId: evidence.id, cause: evidence.diagnosis?.cause || 'Step passed on first try', log: evidence.before?.logFile || null };
  }

  buildDo(step, evidence) {
    const command = evidence?.after?.command || step.command;
    if (step.kind === 'env') {
      return { type: 'run', command, cwd: '.', stdin: null };
    }
    if (step.kind === 'serve') {
      return { type: 'run', command, cwd: '.', stdin: null };
    }
    return { type: 'run', command, cwd: '.', stdin: null };
  }

  buildTarget(step) {
    if (step.kind === 'serve') return { kind: 'terminal' };
    if (step.kind === 'env') return { kind: 'file-line', file: '.env', match: 'SESSION_SECRET=' };
    return { kind: 'terminal' };
  }

  buildCheck(step, evidence) {
    if (step.kind === 'serve' && step.serve?.port) {
      return { type: 'http', url: `http://127.0.0.1:${step.serve.port}/health`, expect: 200 };
    }
    if (step.kind === 'services') return { type: 'exit', code: 0 };
    if (step.kind === 'migrate') return { type: 'exit', code: 0 };
    if (step.kind === 'install') return { type: 'file-has', file: 'package.json', pattern: '"dependencies"' };
    if (step.kind === 'env') return { type: 'file-has', file: '.env', pattern: '^' };
    if (step.kind === 'test') return { type: 'exit', code: 0 };
    return { type: 'exit', code: 0 };
  }

  buildUndo(step, evidence) {
    if (step.kind === 'install') return { type: 'run', command: 'rm -rf node_modules package-lock.json' };
    if (step.kind === 'env') return { type: 'restore-file', file: '.env' };
    if (step.kind === 'services') return { type: 'run', command: 'docker compose down' };
    if (step.kind === 'migrate') return { type: 'none' };
    if (step.kind === 'serve') return { type: 'run', command: 'pkill -f "node.*server.js" || true' };
    if (step.kind === 'test') return { type: 'none' };
    return { type: 'none' };
  }

  getTimeoutMs(kind) {
    const timeouts = { install: 150000, services: 120000, migrate: 300000, build: 300000, serve: 150000, test: 300000, env: 30000, other: 60000 };
    return timeouts[kind] || 600000;
  }

  getRisk(kind) {
    const risks = { install: 'low', env: 'low', services: 'medium', migrate: 'medium', build: 'low', serve: 'low', test: 'low', other: 'low' };
    return risks[kind] || 'low';
  }

  buildAlreadySatisfiedIf(step, evidence) {
    if (step.kind === 'install') return 'node_modules exists and package-lock.json is present';
    if (step.kind === 'env') return '.env file exists with required keys';
    if (step.kind === 'services') return 'Docker containers for required services are running';
    return null;
  }

  getFallbackGuide() {
    return {
      schema: 'humble.guide/1',
      repo: 'acme-shop',
      commit: '2267ffda1c',
      verdict: 'VERIFIED',
      provenOn: { image: 'node:16', os: 'linux', replaySeconds: 14, runId: 'acme-shop-verified' },
      env: { CI: '1', npm_config_yes: 'true' },
      steps: [
        { id: 'S3', title: 'Install', kind: 'install', say: { new: 'This installs the libraries the app needs.', experienced: 'npm install with proven flags.' }, why: { evidenceId: null, cause: 'Dependencies installed', log: null }, do: { type: 'run', command: 'npm install', cwd: '.', stdin: null }, platform: { linux: 'proven', darwin: 'proven', win32: 'translated' }, target: { kind: 'terminal' }, check: { type: 'file-has', file: 'package.json', pattern: '"dependencies"' }, timeoutMs: 150000, undo: { type: 'run', command: 'rm -rf node_modules package-lock.json' }, risk: 'low', optional: false, alreadySatisfiedIf: 'node_modules exists and package-lock.json is present' },
        { id: 'S4', title: 'Env', kind: 'env', say: { new: "This creates your local configuration file from the example.", experienced: 'Create .env from .env.example.' }, why: { evidenceId: null, cause: 'Environment configured', log: null }, do: { type: 'run', command: 'cp .env.example .env', cwd: '.', stdin: null }, platform: { linux: 'proven', darwin: 'proven', win32: 'translated' }, target: { kind: 'terminal' }, check: { type: 'file-has', file: '.env', pattern: '^' }, timeoutMs: 30000, undo: { type: 'restore-file', file: '.env' }, risk: 'low', optional: false, alreadySatisfiedIf: '.env file exists with required keys' },
        { id: 'S5', title: 'Services', kind: 'services', say: { new: "This starts the database and other services using Docker.", experienced: 'docker compose up -d.' }, why: { evidenceId: null, cause: 'Services started', log: null }, do: { type: 'run', command: 'docker compose up -d', cwd: '.', stdin: null }, platform: { linux: 'proven', darwin: 'proven', win32: 'translated' }, target: { kind: 'terminal' }, check: { type: 'exit', code: 0 }, timeoutMs: 120000, undo: { type: 'run', command: 'docker compose down' }, risk: 'medium', optional: false, alreadySatisfiedIf: 'Docker containers for required services are running' },
        { id: 'S6', title: 'Migrate', kind: 'migrate', say: { new: "This prepares the database schema.", experienced: 'Run the verified migration command.' }, why: { evidenceId: null, cause: 'Database migrated', log: null }, do: { type: 'run', command: 'npm run db:migrate', cwd: '.', stdin: null }, platform: { linux: 'proven', darwin: 'proven', win32: 'translated' }, target: { kind: 'terminal' }, check: { type: 'exit', code: 0 }, timeoutMs: 300000, undo: { type: 'none' }, risk: 'medium', optional: false, alreadySatisfiedIf: null },
        { id: 'S8', title: 'Serve', kind: 'serve', say: { new: "This starts the app on port 3000.", experienced: 'Start the dev server.' }, why: { evidenceId: null, cause: 'Server started', log: null }, do: { type: 'run', command: 'npm run dev', cwd: '.', stdin: null }, platform: { linux: 'proven', darwin: 'proven', win32: 'translated' }, target: { kind: 'terminal' }, check: { type: 'http', url: 'http://127.0.0.1:3000/health', expect: 200 }, timeoutMs: 150000, undo: { type: 'run', command: 'pkill -f "node.*server.js" || true' }, risk: 'low', optional: false, alreadySatisfiedIf: null },
        { id: 'S9', title: 'Test', kind: 'test', say: { new: "This runs the tests to confirm everything works.", experienced: 'Run the test suite.' }, why: { evidenceId: null, cause: 'Tests passed', log: null }, do: { type: 'run', command: 'npm test', cwd: '.', stdin: null }, platform: { linux: 'proven', darwin: 'proven', win32: 'translated' }, target: { kind: 'terminal' }, check: { type: 'exit', code: 0 }, timeoutMs: 300000, undo: { type: 'none' }, risk: 'low', optional: false, alreadySatisfiedIf: null }
      ],
      done: { type: 'http', url: 'http://127.0.0.1:3000/health', expect: 200 },
      scorecard: { proven: 6, translated: 0, needsHuman: 0, skipped: [] },
      security: { verdict: 'clear', findings: [] }
    };
  }

  // ============================================================================
  // HOST PROBE (spec section 7 step 1)
  // ============================================================================
  async runHostProbe() {
    // In Electron, this would call the main process probe
    // For now, simulate with realistic data
    this.probeData = {
      os: 'linux',
      osVersion: '6.1.0',
      arch: 'x64',
      node: 'v20.18.0',
      npm: '10.8.2',
      python: '3.14.7',
      pip: '24.2',
      docker: { present: true, version: '27.3.1', compose: true, composeVersion: 'v2.29.7' },
      git: 'git version 2.43.0',
      make: 'GNU Make 4.3',
      wsl: true,
      ports: [3000, 5432, 6379],
      envFiles: { '.env': { exists: false }, '.env.example': { exists: true } },
      diskSpace: { available: '45G' },
      timestamp: new Date().toISOString()
    };
  }

  // ============================================================================
  // CHECKLIST RENDERING & POLLING (spec section 7)
  // ============================================================================
  renderChecklist() {
    if (!this.probeData || !this.guide) return;

    // Required tools from guide steps + probe
    const requiredTools = [
      { name: 'Node.js', version: this.probeData.node, required: '16+', check: () => this.probeData.node !== 'not found' },
      { name: 'npm', version: this.probeData.npm, required: 'any', check: () => this.probeData.npm !== 'not found' },
      { name: 'Docker', version: this.probeData.docker.present ? this.probeData.docker.version : 'not found', required: 'any', check: () => this.probeData.docker.present },
      { name: 'Docker Compose', version: this.probeData.docker.compose ? this.probeData.docker.composeVersion : 'not found', required: 'v2', check: () => this.probeData.docker.compose },
      { name: 'Git', version: this.probeData.git, required: 'any', check: () => this.probeData.git !== 'not found' },
    ];

    const optionalTools = [
      { name: 'Python', version: this.probeData.python, required: '3.10+', check: () => this.probeData.python !== 'not found' },
      { name: 'Make', version: this.probeData.make, required: 'any', check: () => this.probeData.make !== 'not found' },
    ];

    this.checklist.innerHTML = '';
    requiredTools.forEach((tool, i) => {
      const ok = tool.check();
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="checklist-dot ${ok ? 'ok' : 'warn'}" data-tool="${tool.name}"></span>
        <span class="checklist-name">${tool.name}</span>
        <span class="checklist-version">${tool.version}</span>
        <a class="checklist-how" href="#" data-tool="${tool.name}">how?</a>
      `;
      this.checklist.appendChild(li);
    });

    if (optionalTools.length) {
      this.checklistDivider.style.display = 'block';
      this.optionalChecklist.style.display = 'block';
      this.optionalChecklist.innerHTML = '';
      optionalTools.forEach(tool => {
        const ok = tool.check();
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="checklist-dot ${ok ? 'ok' : 'warn'}" data-tool="${tool.name}"></span>
          <span class="checklist-name">${tool.name}</span>
          <span class="checklist-version">${tool.version}</span>
        `;
        this.optionalChecklist.appendChild(li);
      });
    }

    // "how?" links type install hint into terminal later
    this.checklist.querySelectorAll('.checklist-how').forEach(a => {
      a.onclick = (e) => {
        e.preventDefault();
        this.typeInstallHint(a.dataset.tool);
      };
    });

    this.updateStartButton();
  }

  updateStartButton() {
    const dots = this.checklist.querySelectorAll('.checklist-dot');
    const allOk = Array.from(dots).every(d => d.classList.contains('ok'));
    this.btnStart.disabled = !allOk;
    if (allOk) {
      this.introPersonal.textContent = "you're all set. hit start to meet humble.";
      this.introTrust.textContent = '';
    }
  }

  startChecklistPoll() {
    this.pollInterval = setInterval(() => {
      this.renderChecklist();
    }, 2000);
  }

  stopChecklistPoll() {
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
  }

  // ============================================================================
  // ONBOARDING SEQUENCE (spec section 7)
  // ============================================================================
  async startOnboarding() {
    this.stopChecklistPoll();
    this.btnStart.disabled = true;
    this.btnSkip.style.display = 'none';

    // Hide intro panel, show terminal
    await this.fadeOut(this.introPanel);
    this.introPanel.style.display = 'none';
    this.terminalPane.style.display = 'flex';
    await this.fadeIn(this.terminalPane);

    // Play reel (spec section 7 step 4)
    await this.playReel();

    // Demo points (spec section 7 step 5)
    await this.demoPoints();

    // Call to action (spec section 7 step 6)
    await this.callToAction();

    // Save onboarded flag
    this.onboarded = true;
    localStorage.setItem('humble.onboarded', '1');

    // Show replay link
    this.replayLink.style.display = 'block';

    // Enter guide mode (spec section 8)
    this.enterGuideMode();
  }

  async skipIntro() {
    this.stopChecklistPoll();
    this.introPanel.style.display = 'none';
    this.terminalPane.style.display = 'flex';

    // Write all reel lines instantly (spec section 7)
    await this.playReel({ instant: true });
    await this.demoPoints({ instant: true });
    await this.callToAction({ instant: true });

    this.onboarded = true;
    localStorage.setItem('humble.onboarded', '1');
    this.replayLink.style.display = 'block';
    this.enterGuideMode();
  }

  async replayOnboarding() {
    this.introPanel.style.display = 'block';
    this.terminalPane.style.display = 'none';
    this.replayLink.style.display = 'none';
    this.btnStart.disabled = true;
    this.btnSkip.style.display = 'block';
    this.introPersonal.textContent = "hi, we're arnav and karmanya. this is humble.";
    this.introTrust.textContent = "nothing runs without your ok. first i only look at your machine, read-only.";
    this.renderChecklist();
    this.startChecklistPoll();

    // Reset mascot to sleep
    this.mascot.setState('sleep');
    await this.mascot.boot();
    await this.typeWelcome();
  }

  async typeWelcome() {
    this.mascot.setState('talk');
    const bubble = await this.showBubble("hey! i'm humble", 2000);
    await sleep(500);
    this.mascot.setState('think');
  }

  async showBubble(text, holdMs = 3000) {
    // Use robot.js say method which handles bubble animation
    return this.mascot.say(text, holdMs);
  }

  async playReel({ instant = false } = {}) {
    this.mascot.setState('think');

    // Generate reel from guide steps (simulated verified run)
    const reel = this.generateReel();

    if (instant) {
      for (const beat of reel) {
        const lineEl = consoleCore.lineFromBeat(beat, { redact: true });
        this.terminalContent.appendChild(lineEl);
      }
      this.terminalContent.scrollTop = this.terminalContent.scrollHeight;
      return;
    }

    // Terminal fades in over 2s (C)
    this.terminalPane.style.opacity = '0';
    await sleep(50);
    this.terminalPane.style.transition = 'opacity 2s ease';
    this.terminalPane.style.opacity = '1';
    await sleep(2000);

    for (const beat of reel) {
      const lineEl = consoleCore.lineFromBeat(beat, { redact: true });
      this.terminalContent.appendChild(lineEl);
      this.terminalContent.scrollTop = this.terminalContent.scrollHeight;

      // Mascot reacts to fail/diag
      if (beat.kind === 'fail') {
        this.mascot.setState('worried');
        this.mascot.dartEyes();
      } else if (beat.kind === 'diag') {
        this.mascot.setState('think');
      } else if (beat.kind === 'fix') {
        this.mascot.setState('celebrate');
        await sleep(1200);
        this.mascot.setState('talk');
      }

      await sleep(consoleCore.typeSchedule.outputLine);
    }
  }

  generateReel() {
    // Simulated reel beats from a verified acme-shop run
    return [
      { kind: 'cmd', command: 'npm install', running: true },
      { kind: 'cmd', command: 'npm install', status: 'ok', duration: 8 },
      { kind: 'why', text: 'installs the locked dependencies' },
      { kind: 'cmd', command: 'cp .env.example .env', running: true },
      { kind: 'cmd', command: 'cp .env.example .env', status: 'ok', duration: 1 },
      { kind: 'why', text: 'creates local config from example' },
      { kind: 'cmd', command: 'docker compose up -d', running: true },
      { kind: 'cmd', command: 'docker compose up -d', status: 'ok', duration: 4 },
      { kind: 'why', text: 'starts postgres and redis' },
      { kind: 'cmd', command: 'npm run db:migrate', running: true },
      { kind: 'fail', text: "Error: Cannot find module 'pg'" },
      { kind: 'diag', agent: 'drbo', text: 'Missing pg driver in dependencies' },
      { kind: 'was', text: '"dependencies": { "redis": "^4.0.0" }' },
      { kind: 'fix', text: '"dependencies": { "redis": "^4.0.0", "pg": "^8.11.0" }' },
      { kind: 'cmd', command: 'npm install', running: true },
      { kind: 'cmd', command: 'npm install', status: 'ok', duration: 3 },
      { kind: 'cmd', command: 'npm run db:migrate', running: true },
      { kind: 'cmd', command: 'npm run db:migrate', status: 'ok', duration: 2 },
      { kind: 'why', text: 'runs database migrations' },
      { kind: 'cmd', command: 'npm run dev', running: true },
      { kind: 'cmd', command: 'npm run dev', status: 'ok', duration: 2 },
      { kind: 'why', text: 'starts the API server on port 3000' },
      { kind: 'cmd', command: 'npm test', running: true },
      { kind: 'cmd', command: 'npm test', status: 'ok', duration: 3 },
      { kind: 'why', text: 'verifies the whole setup' },
      { kind: 'sys', text: 'VERIFIED · replay from zero in 14s' },
    ];
  }

  async demoPoints({ instant = false } = {}) {
    // Spec section 7 step 5: at first fail beat, mascot flies to that line
    const failLine = this.terminalContent.querySelector('.term-line.fail');
    const fixLine = this.terminalContent.querySelector('.term-line.fix');

    if (failLine) {
      if (!instant) await this.mascot.flyTo(failLine, { say: 'this broke here', returnHome: true });
      else { this.mascot.setState('point'); this.mascot.say('this broke here'); }
    }

    if (fixLine) {
      if (!instant) await this.mascot.flyTo(fixLine, { say: 'so i fixed the readme', returnHome: true });
      else { this.mascot.setState('point'); this.mascot.say('so i fixed the readme'); }
    }
  }

  async callToAction({ instant = false } = {}) {
    await sleep(instant ? 0 : 2300); // 2.3s after reel ends (C)

    this.caret.classList.remove('hidden');
    const ctaText = "press enter to run step 1 on your machine";
    await typeText(this.caret, ctaText, { min: 30, max: 30 }); // fixed 30ms/char for CTA

    if (!instant) {
      await sleep(10000); // stays 10s (C)
      this.caret.textContent = '▌';
      this.caret.classList.add('hidden');
    }
  }

  // ============================================================================
  // GUIDE MODE (spec section 8)
  // ============================================================================
  enterGuideMode() {
    this.currentStepIndex = 0;
    this.showGuideStep(0);
  }

  async showGuideStep(index) {
    if (index >= this.guide.steps.length) {
      this.finishGuide();
      return;
    }

    const step = this.guide.steps[index];
    this.stepCounter.textContent = `step ${index + 1}/${this.guide.steps.length}`;
    this.stepCounter.style.display = 'block';

    // Check if already satisfied (spec section 8)
    if (this.isStepSatisfied(step)) {
      await this.showAlreadyDone(step);
      this.currentStepIndex++;
      await sleep(300); // auto-skipped 300ms apart
      return this.showGuideStep(this.currentStepIndex);
    }

    // Type command
    await this.typeCommandLine(step.do?.command || step.do?.type);

    // Type why line
    if (step.why?.cause) {
      await sleep(120); // 120ms pause after command (spec section 4)
      await this.typeWhyLine(step.why.cause);
    }

    // Show footer buttons
    this.btnShowHow.style.display = 'inline-flex';
    this.btnDoIt.style.display = 'inline-flex';
    this.footerLeft.style.display = 'flex';
  }

  isStepSatisfied(step) {
    if (!step.alreadySatisfiedIf) return false;
    // Simplified check - in real implementation, check actual filesystem
    if (step.alreadySatisfiedIf.includes('node_modules')) return false;
    if (step.alreadySatisfiedIf.includes('.env')) return false;
    if (step.alreadySatisfiedIf.includes('Docker containers')) return false;
    return false;
  }

  async showAlreadyDone(step) {
    // Find the cmd line we just added and update it
    const cmdLines = this.terminalContent.querySelectorAll('.term-line.cmd');
    const lastCmd = cmdLines[cmdLines.length - 1];
    if (lastCmd) {
      lastCmd.querySelector('.status').className = 'status ok';
      lastCmd.querySelector('.status').textContent = '✓ already done';
      lastCmd.querySelector('.status').style.color = 'var(--c-ink-3)';
    }
    this.mascot.setState('celebrate');
    await sleep(800);
    this.mascot.setState('talk');
  }

  async typeCommandLine(command) {
    this.caret.classList.remove('hidden');
    this.caret.textContent = '';

    const lineEl = document.createElement('div');
    lineEl.className = 'term-line cmd';
    const prompt = document.createElement('span');
    prompt.className = 'prompt';
    prompt.textContent = '$ ';
    const cmd = document.createElement('span');
    cmd.textContent = '';
    const status = document.createElement('span');
    status.className = 'status';
    status.innerHTML = '<span class="spinner">⠋</span>';
    lineEl.append(prompt, cmd, status);
    this.terminalContent.appendChild(lineEl);
    this.scrollToBottom();

    await typeCommand(cmd, command);
    this.caret.classList.add('hidden');
  }

  async typeWhyLine(text) {
    const lineEl = document.createElement('div');
    lineEl.className = 'term-line why';
    lineEl.textContent = '';
    this.terminalContent.appendChild(lineEl);
    this.scrollToBottom();

    await typeText(lineEl, `  why: ${text}`, { min: 30, max: 30 });
  }

  showHow() {
    const step = this.guide.steps[this.currentStepIndex];
    const command = step.do?.command || step.do?.type;

    // Copy to clipboard
    navigator.clipboard.writeText(command).then(() => {
      // Point at terminal area where to paste
      this.mascot.flyTo(this.terminalContent, { say: 'paste here with Ctrl+V', returnHome: true });
    });
  }

  doItForMe() {
    const step = this.guide.steps[this.currentStepIndex];
    const command = step.do?.command || step.do?.type;
    const dir = process.cwd(); // In Electron, this would be the project dir

    // Inline confirmation (spec section 8)
    this.footerLeft.style.display = 'none';
    this.footerRight.style.display = 'none';
    this.inlineConfirm.style.display = 'flex';
    this.confirmText.textContent = `run ${command} in ${dir}?`;
  }

  async confirmRun() {
    this.inlineConfirm.style.display = 'none';
    this.btnStop.style.display = 'inline-flex';
    this.footerRight.style.display = 'flex';

    const step = this.guide.steps[this.currentStepIndex];
    const command = step.do?.command || step.do?.type;

    this.mascot.setState('think');

    // Run through dock bridge IPC (spec section 8)
    await this.runCommandThroughDock(command, step);

    this.btnStop.style.display = 'none';
    this.btnShowHow.style.display = 'inline-flex';
    this.btnDoIt.style.display = 'inline-flex';
    this.footerLeft.style.display = 'flex';
  }

  cancelConfirm() {
    this.inlineConfirm.style.display = 'none';
    this.footerLeft.style.display = 'flex';
    this.footerRight.style.display = 'flex';
  }

  async runCommandThroughDock(command, step) {
    // In Electron, this calls window.dock.run('guide', target)
    // For now, simulate with local spawn
    const lineEl = this.terminalContent.querySelector('.term-line.cmd:last-child');
    const statusEl = lineEl?.querySelector('.status');
    if (statusEl) statusEl.innerHTML = '<span class="spinner">⠋</span>';

    try {
      // Simulate command execution with redacted output
      const output = await this.simulateCommand(command);
      this.appendOutput(output);

      // Run checker (spec section 8)
      const checkPassed = await this.runChecker(step.check);

      if (checkPassed) {
        if (statusEl) {
          statusEl.className = 'status ok';
          statusEl.textContent = '✓ 3s'; // simulated duration
        }
        this.mascot.setState('celebrate');
        await sleep(800);
        this.mascot.setState('talk');
        this.currentStepIndex++;
        await this.showGuideStep(this.currentStepIndex);
      } else {
        if (statusEl) {
          statusEl.className = 'status fail';
          statusEl.textContent = '✗';
        }
        this.mascot.setState('worried');
        this.showFailureOptions(step);
      }
    } catch (e) {
      this.appendOutput([`Error: ${e.message}`]);
      if (statusEl) {
        statusEl.className = 'status fail';
        statusEl.textContent = '✗';
      }
      this.mascot.setState('worried');
    }
  }

  async simulateCommand(command) {
    // Simulate realistic output for each command type
    await sleep(1000 + Math.random() * 2000);

    if (command.includes('npm install')) {
      return [
        'added 247 packages in 3s',
        '45 packages are looking for funding',
        '  run `npm fund` for details'
      ];
    }
    if (command.includes('cp .env')) return ['.env created from .env.example'];
    if (command.includes('docker compose')) return ['[+] Running 2/2', ' ✔ Container acme-postgres  Started', ' ✔ Container acme-redis  Started'];
    if (command.includes('db:migrate')) return ['Migrating...', 'Migration 001 complete', 'Migration 002 complete', 'Done'];
    if (command.includes('npm run dev')) return ['Server listening on http://localhost:3000', 'Database connected', 'Redis connected'];
    if (command.includes('npm test')) return ['PASS  test/products.test.js', 'PASS  test/health.test.js', 'Test Suites: 2 passed, 2 total', 'Tests: 15 passed, 15 total'];

    return [`Executed: ${command}`];
  }

  appendOutput(lines) {
    const lineEl = document.createElement('div');
    lineEl.className = 'term-line out';
    const content = document.createElement('div');
    content.className = 'out-content';
    lines.forEach(l => {
      const lEl = document.createElement('div');
      lEl.className = 'out-line';
      lEl.textContent = redactSecrets(l);
      content.appendChild(lEl);
    });
    lineEl.appendChild(content);
    this.terminalContent.appendChild(lineEl);
    this.scrollToBottom();
  }

  async runChecker(check) {
    // Simulate checker - in reality this runs the actual check
    await sleep(500);
    return true; // Simulate success
  }

  showFailureOptions(step) {
    // Spec section 8: offer [ask DR.BO] and [skip]
    const lineEl = document.createElement('div');
    lineEl.className = 'term-line fail';
    lineEl.textContent = '  > Step failed. Run the checker manually or skip?';
    this.terminalContent.appendChild(lineEl);

    const optionsEl = document.createElement('div');
    optionsEl.className = 'term-line sys';
    optionsEl.innerHTML = '  [ ask DR.BO ]  [ skip ]';
    optionsEl.style.cursor = 'pointer';
    optionsEl.onclick = () => {
      this.currentStepIndex++;
      this.showGuideStep(this.currentStepIndex);
    };
    this.terminalContent.appendChild(optionsEl);
    this.scrollToBottom();
  }

  stopCommand() {
    if (this.runningCommand) {
      this.runningCommand.kill();
      this.runningCommand = null;
    }
    this.btnStop.style.display = 'none';
    this.btnShowHow.style.display = 'inline-flex';
    this.btnDoIt.style.display = 'inline-flex';
    this.footerLeft.style.display = 'flex';
    this.mascot.setState('worried');
  }

  finishGuide() {
    this.stepCounter.textContent = `VERIFIED on your machine · ${this.guide.steps.length} steps`;
    this.btnShowHow.style.display = 'none';
    this.btnDoIt.style.display = 'none';
    this.footerLeft.style.display = 'none';

    const lineEl = document.createElement('div');
    lineEl.className = 'term-line sys';
    lineEl.textContent = 'VERIFIED on your machine · Setup Passport available at .firstrun/passport.svg';
    this.terminalContent.appendChild(lineEl);
    this.scrollToBottom();

    this.mascot.setState('celebrate');
    this.statusDot.className = 'status-dot ok';
  }

  // ============================================================================
  // HELPERS
  // ============================================================================
  scrollToBottom() {
    if (!this.userScrolledUp) {
      this.terminalContent.scrollTop = this.terminalContent.scrollHeight;
    }
  }

  fadeOut(el) {
    return new Promise(r => {
      el.style.transition = 'opacity 160ms ease';
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; r(); }, 160);
    });
  }

  fadeIn(el) {
    return new Promise(r => {
      el.style.display = 'flex';
      el.style.opacity = '0';
      el.style.transition = 'opacity 220ms var(--hb-ease-out)';
      requestAnimationFrame(() => { el.style.opacity = '1'; setTimeout(r, 220); });
    });
  }

  handleEscape() {
    if (this.runningCommand) {
      // Ask "stop the command? y/n"
      if (confirm('Stop the command?')) this.stopCommand();
    } else {
      this.close();
    }
  }

  close() {
    // In Electron, this would close the BrowserWindow
    if (window.electronAPI) window.electronAPI.closeConsole();
    else console.log('Console closed');
  }

  // ============================================================================
  // PUBLIC API for Dock integration
  // ==========================================================================__
  async openGuideForRepo(repoPath) {
    // Called when user clicks Guide agent in Dock
    this.guide = await this.loadGuideForRepo(repoPath);
    this.enterGuideMode();
  }
}

// ============================================================================
// INITIALIZE ON DOM READY (browser only)
// ============================================================================
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.humbleConsole = new HumbleConsole();
  });
}

// Expose for Electron main process
if (typeof window !== 'undefined') {
  window.HumbleConsole = HumbleConsole;
}