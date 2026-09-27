/**
 * HUMBLE Web Console - The "Prove it live" hero terminal
 * Spec: docs/design/HUMBLE_CONSOLE_SPEC.md sections 1, 3-7, 9, 11, 13-15, 17 (web variants)
 * Lazy-mounted when hero enters viewport, total added JS <= 25 KB gzip
 */

import { flight, typeSchedule, lineFromBeat, reelPlayer, onboardingTimeline } from './core.js';
import { HumbleRobot, HUMBLE_STATES, AGENT_COLORS, flightMath } from './robot.js';
import { EmoBot } from './emo-bot.js';

// ============================================================================
// CSS Token Definitions (mirroring HUMBLE_CONSOLE_SPEC.md Section 2)
// ============================================================================
const CONSOLE_TOKENS = {
  '--c-bg': '#16120e',
  '--c-surface': '#1c1712',
  '--c-term': '#120e0a',
  '--c-line': '#342c24',
  '--c-ink': '#efe7da',
  '--c-ink-2': '#b8ab98',
  '--c-ink-3': '#7a6e5f',
  '--c-core': '#ff9a3c',
  '--c-hi': '#ffc47a',
  '--c-deep': '#e0701c',
  '--c-ok': '#3dd68c',
  '--c-fail': '#ff5c7a',
  '--c-warn': '#ffb224',
  '--c-bob': '#5E9EFF',
  '--hb-ease-out': 'cubic-bezier(0.23,1,0.32,1)',
  '--hb-ease-bounce': 'cubic-bezier(0.34,1.56,0.64,1)'
};

// ============================================================================
// Utility Functions
// ============================================================================
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => {
    if (c === '&') return '&';
    if (c === '<') return '<';
    if (c === '>') return '>';
    if (c === '"') return '"';
    if (c === "'") return '&apos;';
    return c;
  });
}

function applyTokens(root = document.documentElement) {
  Object.entries(CONSOLE_TOKENS).forEach(([k, v]) => root.style.setProperty(k, v));
}

function isReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function safeLocalStorage(key, value, isSet = true) {
  try {
    if (isSet) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

function getLocalStorage(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

// LINE_KINDS from core.js (duplicated here to avoid circular import issues)
const LINE_KINDS = {
  cmd: { prefix: '$ ', color: '--c-ink' },
  why: { prefix: '  why: ', color: '--c-ink-2' },
  out: { prefix: '  ', color: '--c-ink-2' },
  fail: { prefix: '  > ', color: '--c-fail' },
  diag: { prefix: '  ', color: '--c-ink', tagColor: '--c-ink' },
  was: { prefix: '  - ', color: '--c-fail', opacity: 0.7, strikethrough: true },
  fix: { prefix: '  + ', color: '--c-ok' },
  pass: { prefix: '', color: '--c-ok', rightAlign: true },
  sys: { prefix: '', color: '--c-ink-3', italic: true }
};

// ============================================================================
// Web Console Class
// ============================================================================
export class HumbleWebConsole {
  constructor(container, options = {}) {
    this.container = container;
    this.reel = options.reel || null;
    this.demoMachine = options.demoMachine || null;
    this.onComplete = options.onComplete || (() => {});
    
    // State
    this.mounted = false;
    this.playing = false;
    this.skipped = false;
    this.onboarded = getLocalStorage('humble.onboarded') === '1';
    this.currentReelIndex = 0;
    this.lines = [];
    this.finalLine = null;
    
    // Elements (created in mount)
    this.panel = null;
    this.header = null;
    this.terminal = null;
    this.footer = null;
    this.mascotContainer = null;
    this.skipIntroBtn = null;
    this.watchAgainLink = null;
    
    // Timing
    this.typingTimers = [];
    this.reelPlayer = null;
  }

  // -------------------------------------------------------------------------
  // Mount / Unmount
  // -------------------------------------------------------------------------
  async mount() {
    if (this.mounted) return;
    
    // Apply console tokens
    applyTokens(this.container);
    
    // Build HTML structure
    this.buildDOM();
    
    // Initialize robot (inline SVG)
    this.renderMascotInline('sleep');
    
    // Set up event listeners
    this.bindEvents();
    
    // Reserve height (no layout shift)
    this.reserveHeight();
    
    // Lazy-mount: wait for viewport entry if not already visible
    if (!this.isInViewport()) {
      await this.waitForViewport();
    }
    
    this.mounted = true;
    
    // Start onboarding or replay
    if (!this.onboarded) {
      await this.runOnboarding();
    } else {
      await this.replayOnboarding();
    }
  }

  buildDOM() {
    // Panel structure matching spec Section 1
    this.container.innerHTML = `
      <div class="humble-panel" role="dialog" aria-label="HUMBLE Console" aria-modal="true">
        <header class="humble-header">
          <div class="humble-header-left">
            <div class="humble-mascot-container" id="humble-mascot-container"></div>
            <div class="humble-title-block">
              <h1 class="humble-title">HUMBLE</h1>
              <span class="humble-subtitle">onboarding acme-shop</span>
            </div>
          </div>
          <div class="humble-header-right">
            <span class="humble-status-dot" aria-hidden="true"></span>
            <button class="humble-close" aria-label="Close console" type="button">x</button>
          </div>
        </header>
        <div class="humble-divider"></div>
        <main class="humble-terminal" role="log" aria-live="polite" aria-label="Terminal output"></main>
        <div class="humble-divider"></div>
        <footer class="humble-footer">
          <div class="humble-footer-main">
            <button class="humble-btn humble-btn-primary" data-action="show-how" type="button">Show me how</button>
            <button class="humble-btn humble-btn-secondary" data-action="do-it" type="button">Do it for me</button>
            <span class="humble-step-counter">step <span class="current-step">1</span>/<span class="total-steps">6</span></span>
          </div>
        </footer>
      </div>
      <a class="humble-watch-again" href="#" data-action="watch-again">watch onboarding again</a>
      <button class="humble-skip-intro" data-action="skip-intro" type="button">skip intro</button>
    `;
    
    // Cache elements
    this.panel = $('.humble-panel', this.container);
    this.header = $('.humble-header', this.container);
    this.terminal = $('.humble-terminal', this.container);
    this.footer = $('.humble-footer', this.container);
    this.mascotContainer = $('#humble-mascot-container', this.container);
    this.skipIntroBtn = $('.humble-skip-intro', this.container);
    this.watchAgainLink = $('.humble-watch-again', this.container);
    
    // Apply initial panel styles
    this.panel.style.cssText = `
      width: 100%;
      max-width: 560px;
      border-radius: 12px;
      border: 1px solid var(--c-line);
      box-shadow: 0 18px 48px rgba(0,0,0,.45);
      background: var(--c-surface);
      overflow: hidden;
      animation: panelOpen 220ms var(--hb-ease-out) forwards;
      transform-origin: center;
      transform: scale(0.96) translateY(8px);
      opacity: 0;
    `;
    
    // Add keyframe for panel open
    if (!document.getElementById('humble-console-keyframes')) {
      const style = document.createElement('style');
      style.id = 'humble-console-keyframes';
      style.textContent = `
        @keyframes panelOpen {
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes panelClose {
          to { transform: scale(0.96) translateY(8px); opacity: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        @keyframes passPop {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  renderMascotInline(state) {
    // The EMO bot (3D body, LED face) replaces the flat badge; it falls back to its own flat face.
    const box = this.container.querySelector('#humble-mascot-container');
    if (box) {
      if (!this.emo) this.emo = new EmoBot(box, { size: 56, interactive: false });
      this.emo.setState(state);
      return;
    }
    const borderColors = {
      sleep: 'rgba(255, 255, 255, 0.18)',
      think: 'var(--c-core, #ff9a3c)',
      talk: 'var(--c-core, #ff9a3c)',
      point: 'var(--c-hi, #ffc47a)',
      celebrate: 'var(--c-ok, #3dd68c)',
      worried: 'var(--brand-crack, #f0287a)'
    };
    const glowColors = {
      sleep: 'none',
      think: 'drop-shadow(0 0 6px rgba(255,154,60,0.45))',
      talk: 'drop-shadow(0 0 5px rgba(255,154,60,0.35))',
      point: 'drop-shadow(0 0 8px rgba(255,196,122,0.6))',
      celebrate: 'drop-shadow(0 0 8px rgba(61,214,140,0.6))',
      worried: 'drop-shadow(0 0 8px rgba(240,40,122,0.6))'
    };

    const stroke = borderColors[state] || borderColors.sleep;
    const filter = glowColors[state] || 'none';
    const markOpacity = state === 'sleep' ? '0.75' : '1';

    const svg = `
      <svg viewBox="0 0 56 56" width="56" height="56" aria-label="HUMBLE mascot: ${state}" style="filter: ${filter}; transition: filter 240ms ease;">
        <circle cx="28" cy="28" r="25" fill="#0d1030" stroke="${stroke}" stroke-width="1.75"/>
        <g opacity="${markOpacity}">
          <svg x="13" y="16.75" width="30" height="22.5" viewBox="0 0 716.94 537.7">
            <polygon fill="#fffefe" points="0 358.46 179.23 358.46 179.23 537.7 268.85 537.7 268.85 268.85 0 268.85 0 358.46"/>
            <polygon fill="#fffefe" points="537.7 179.23 537.7 0 268.85 0 268.85 268.85 358.47 268.85 358.47 89.61 448.09 89.61 448.09 268.85 716.94 268.85 716.94 179.23 537.7 179.23"/>
          </svg>
        </g>
      </svg>
    `.trim();

    if (this.mascotContainer) {
      this.mascotContainer.innerHTML = svg;
    }
  }

  bindEvents() {
    // Close button
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      
      const action = btn.dataset.action;
      switch (action) {
        case 'skip-intro':
          this.skipIntro();
          break;
        case 'watch-again':
          this.replayOnboarding();
          break;
        case 'show-how':
        case 'do-it':
          // Placeholder for guide mode (Electron only)
          break;
      }
    });
    
    // Keyboard: Esc to close
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleEscape();
      }
      if (e.key === 'Enter' && !this.playing && this.onboarded) {
        this.replayOnboarding();
      }
    });
    
    // CTA: Press Enter to replay (after onboarding)
    this.terminal.addEventListener('click', () => {
      if (!this.playing && this.onboarded) {
        this.replayOnboarding();
      }
    });
  }

  handleEscape() {
    // Spec: Esc never kills a running command; it asks "stop the command? y/n"
    // For web console, we just close if not playing
    if (!this.playing) {
      this.close();
    }
  }

  reserveHeight() {
    // Reserve height to prevent layout shift
    const height = this.panel.offsetHeight || 400;
    this.container.style.minHeight = height + 'px';
  }

  isInViewport() {
    const rect = this.container.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  }

  waitForViewport() {
    return new Promise(resolve => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            observer.disconnect();
            resolve();
          }
        });
      }, { rootMargin: '100px' });
      observer.observe(this.container);
    });
  }

  // -------------------------------------------------------------------------
  // Onboarding Sequence (Section 7)
  // -------------------------------------------------------------------------
  async runOnboarding() {
    this.playing = true;
    this.skipped = false;
    
    const timeline = onboardingTimeline();
    
    // Step 1: Intro panel (no terminal yet) - show checklist from demo machine
    this.showIntroPanel();
    await this.sleep(timeline[0].delay);
    if (this.skipped) return this.finishOnboarding();
    
    // Step 2: Boot - iris shutter + lantern warm-up
    this.renderMascotInline('think');
    await this.sleep(timeline[1].delay);
    if (this.skipped) return this.finishOnboarding();
    
    // Step 3: Welcome bubble
    this.renderMascotInline('talk');
    await this.showWelcomeBubble();
    await this.sleep(timeline[3].delay + timeline[4].delay + timeline[5].delay);
    if (this.skipped) return this.finishOnboarding();
    
    // Step 4: Terminal fades in
    await this.fadeInTerminal();
    await this.sleep(timeline[6].delay);
    if (this.skipped) return this.finishOnboarding();
    
    // Step 5: Play reel
    await this.playReel();
    if (this.skipped) return this.finishOnboarding();
    
    // Step 6: Demo points - fly to first fail and fix
    await this.demoPoints();
    if (this.skipped) return this.finishOnboarding();
    
    // Step 7: CTA
    await this.showCTA();
    
    this.finishOnboarding();
  }

  showIntroPanel() {
    // Replace terminal with intro checklist
    this.terminal.innerHTML = '';
    this.terminal.style.minHeight = '240px';
    
    const probe = this.demoMachine?.probe || {};
    const requiredTools = [
      { name: 'Node.js', check: probe.node?.version, required: true },
      { name: 'npm', check: probe.node?.packageManager === 'npm', required: true },
      { name: 'Docker', check: probe.compose?.file, required: true },
      { name: 'Git', check: true, required: true }
    ];
    
    const optionalTools = [
      { name: 'Yarn', check: false, required: false },
      { name: 'Python', check: !!probe.python, required: false }
    ];
    
    let html = `
      <div class="humble-intro">
        <p class="humble-personal">hi, we're arnav and karmanya. this is humble.</p>
        <p class="humble-trust">nothing runs without your ok. first i only look at your machine, read-only.</p>
        <div class="humble-checklist-label">CHECKING YOUR MACHINE</div>
        <div class="humble-checklist">
    `;
    
    // Required tools
    requiredTools.forEach((tool, i) => {
      const found = tool.check;
      html += `
        <div class="humble-checklist-row" data-tool="${tool.name}" style="opacity: 0; transform: translateY(10px); transition: opacity 300ms ease, transform 300ms ease;">
          <span class="humble-checklist-dot ${found ? 'ok' : 'warn'}"></span>
          <span class="humble-checklist-name">${tool.name}</span>
          <span class="humble-checklist-version">${found ? tool.check : 'not found'}</span>
        </div>
      `;
    });
    
    // Divider + optional
    html += `<div class="humble-checklist-divider"></div>`;
    
    optionalTools.forEach(tool => {
      const found = tool.check;
      html += `
        <div class="humble-checklist-row optional" data-tool="${tool.name}" style="opacity: 0; transform: translateY(10px); transition: opacity 300ms ease, transform 300ms ease;">
          <span class="humble-checklist-dot ${found ? 'ok' : 'warn'}"></span>
          <span class="humble-checklist-name">${tool.name} <span class="optional-badge">optional</span></span>
          <span class="humble-checklist-version">${found ? 'found' : 'not found'}</span>
        </div>
      `;
    });
    
    html += `
        </div>
        <div class="humble-intro-footer">
          <button class="humble-btn humble-btn-primary humble-start-btn" type="button" disabled>Start</button>
        </div>
      </div>
    `;
    
    this.terminal.innerHTML = html;
    
    // Animate checklist rows
    const rows = $$('.humble-checklist-row', this.terminal);
    rows.forEach((row, i) => {
      setTimeout(() => {
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
        
        // Re-poll simulation - flip to ok after delay for demo
        if (!row.querySelector('.humble-checklist-dot').classList.contains('ok')) {
          setTimeout(() => {
            const dot = row.querySelector('.humble-checklist-dot');
            dot.classList.remove('warn');
            dot.classList.add('ok');
            dot.style.transform = 'scale(1.3)';
            setTimeout(() => dot.style.transform = 'scale(1)', 200);
            this.renderMascotInline('talk');
            // this.robot.dartEyes?.(i * 28);
          }, 1000 + i * 500);
        }
      }, i * 150);
    });
    
    // Enable start button when all required are ok
    const checkAllOk = () => {
      const allRequiredOk = [...$$('.humble-checklist-row:not(.optional) .humble-checklist-dot', this.terminal)]
        .every(dot => dot.classList.contains('ok'));
      const startBtn = $('.humble-start-btn', this.terminal);
      if (startBtn) startBtn.disabled = !allRequiredOk;
      if (allRequiredOk) {
        startBtn.textContent = 'Start';
        // Auto-start after brief delay
        setTimeout(() => {
          if (!this.skipped) startBtn.click();
        }, 500);
      }
    };
    
    // Initial check
    checkAllOk();
    
    // Start button handler
    this.terminal.addEventListener('click', (e) => {
      if (e.target.matches('.humble-start-btn:not(:disabled)')) {
        this.terminal.innerHTML = ''; // Clear intro
        this.terminal.style.minHeight = '240px';
      }
    });
  }

  async showWelcomeBubble() {
    const text = "hey! i'm humble";
    this.renderMascotInline('talk');
    
    // Create bubble element
    const bubble = document.createElement('div');
    bubble.className = 'humble-bubble';
    bubble.style.cssText = `
      position: absolute;
      bottom: 70px;
      left: 50%;
      transform: translateX(-50%) scale(0.5);
      background: var(--c-core);
      color: #1a0e04;
      font: 500 11px/1.4 system-ui;
      padding: 4px 8px;
      border-radius: 6px;
      box-shadow: 0 0 6px rgba(255,154,60,.5);
      white-space: nowrap;
      opacity: 0;
      transition: transform 400ms var(--hb-ease-bounce), opacity 200ms ease;
      z-index: 10;
    `;
    this.mascotContainer.style.position = 'relative';
    this.mascotContainer.appendChild(bubble);
    
    // Fade in
    await this.sleep(100);
    bubble.style.opacity = '1';
    bubble.style.transform = 'translateX(-50%) scale(1)';
    
    // Type text
    const schedule = typeSchedule(text, 'bubble', { reducedMotion: isReducedMotion() });
    for (let i = 0; i < text.length; i++) {
      if (this.skipped) break;
      bubble.textContent = text.slice(0, i + 1);
      await this.sleep(schedule.delays[i]);
    }
    
    // Hold
    await this.sleep(2000);
    if (this.skipped) return;
    
    // Fade out
    bubble.style.opacity = '0';
    await this.sleep(500);
    bubble.remove();
  }

  async fadeInTerminal() {
    if (isReducedMotion()) {
      this.terminal.style.transition = 'none';
      this.terminal.style.opacity = '1';
      return;
    }
    this.terminal.style.opacity = '0';
    this.terminal.style.transition = 'opacity 2s ease';
    await this.sleep(50);
    this.terminal.style.opacity = '1';
    await this.sleep(2000);
  }

  async playReel() {
    if (!this.reel) return;
    
    this.reelPlayer = reelPlayer(this.reel, {
      targetDuration: 25000,
      onAction: (action) => this.handleReelAction(action)
    });
    
    await this.reelPlayer.play();
  }

  async handleReelAction(action) {
    if (this.skipped) return;
    
    switch (action.type) {
      case 'type':
        await this.typeLine(action.line);
        break;
      case 'shake':
        await this.shakeLine(action.line);
        break;
      case 'point':
        await this.pointAtLine(action.line, action.bubbleText);
        break;
      case 'celebrate':
        await this.celebrateLine(action.line);
        break;
      case 'end':
        this.finalLine = action.line;
        break;
    }
  }

  async typeLine(line) {
    const el = this.createLineElement(line);
    this.terminal.appendChild(el);
    this.lines.push({ element: el, line });
    
    // Scroll to bottom unless user scrolled up
    this.autoScroll();
    
    // Type text character by character
    const text = line.text;
    const isCmd = line.kind === 'cmd';
    const schedule = typeSchedule(text, isCmd ? 'cmd' : 'welcome', { 
      reducedMotion: isReducedMotion() 
    });
    
    const textSpan = el.querySelector('.humble-line-text');
    const prefixSpan = el.querySelector('.humble-line-prefix');
    const statusSpan = el.querySelector('.humble-line-status');
    
    // Show prefix immediately
    if (prefixSpan) prefixSpan.style.opacity = '1';
    
    // Type characters
    for (let i = 0; i < text.length; i++) {
      if (this.skipped) break;
      textSpan.textContent = text.slice(0, i + 1);
      await this.sleep(schedule.delays[i]);
    }
    
    // Pause after cmd before why line
    if (schedule.pauseAfter > 0) {
      await this.sleep(schedule.pauseAfter);
    }
    
    // Show status (pass/fail) if present
    if (statusSpan) {
      statusSpan.style.opacity = '1';
      if (line.status === 'pass') {
        statusSpan.style.animation = 'passPop 260ms var(--hb-ease-bounce) forwards';
      } else if (line.status === 'fail') {
        statusSpan.style.animation = 'shake 180ms steps(3)';
      }
    }
  }

  async shakeLine(line) {
    const el = this.createLineElement(line);
    this.terminal.appendChild(el);
    this.lines.push({ element: el, line });
    
    // Add shake animation
    el.style.animation = 'shake 180ms steps(3)';
    await this.sleep(180);
    el.style.animation = '';
    
    this.autoScroll();
  }

  async pointAtLine(line, bubbleText) {
    // First type the line
    await this.typeLine(line);
    
    // Then fly mascot to it and show bubble
    const lineEl = this.lines[this.lines.length - 1]?.element;
    if (!lineEl) return;
    
    // Find mascot position and target position
    const mascotRect = this.mascotContainer.getBoundingClientRect();
    const lineRect = lineEl.getBoundingClientRect();
    const panelRect = this.panel.getBoundingClientRect();
    
    const startX = mascotRect.left - panelRect.left + mascotRect.width / 2;
    const startY = mascotRect.top - panelRect.top + mascotRect.height / 2;
    const targetX = lineRect.left - panelRect.left - 20;
    const targetY = lineRect.top - panelRect.top + lineRect.height / 2;
    
    // Fly to line
    this.renderMascotInline('point');
    await this.animateFlight(startX, startY, targetX, targetY);
    
    // Show bubble
    await this.showBubble(bubbleText, targetX, targetY);
    
    // Fly back
    await this.animateFlight(targetX, targetY, startX, startY);
    this.renderMascotInline('talk');
  }

  async animateFlight(startX, startY, targetX, targetY) {
    if (isReducedMotion()) return;
    
    const { duration, at } = flight({ x: startX, y: startY }, { x: targetX, y: targetY });
    const startTime = performance.now();
    const durMs = duration * 1000;
    
    return new Promise(resolve => {
      const step = (now) => {
        const elapsed = now - startTime;
        const u = Math.min(1, Math.max(0, elapsed / durMs));
        const pos = at(u);
        
        this.mascotContainer.style.transform = 'translate(' + pos.x + 'px, ' + pos.y + 'px) rotate(' + pos.rotation + 'deg) scale(' + pos.scale + ')';
        this.mascotContainer.style.filter = 'drop-shadow(0 0 ' + pos.glow + 'px var(--c-core))';
        
        if (u < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  async showBubble(text, x, y) {
    const bubble = document.createElement('div');
    bubble.className = 'humble-bubble';
    bubble.style.cssText = `
      position: absolute;
      left: ${x + 10}px;
      top: ${y + 18}px;
      transform: translateX(-50%) scale(0.5);
      background: var(--c-core);
      color: #1a0e04;
      font: 500 11px/1.4 system-ui;
      padding: 4px 8px;
      border-radius: 6px;
      box-shadow: 0 0 6px rgba(255,154,60,.5);
      white-space: nowrap;
      opacity: 0;
      transition: transform 400ms var(--hb-ease-bounce), opacity 200ms ease;
      z-index: 10;
      pointer-events: none;
    `;
    this.panel.appendChild(bubble);
    
    // Spring entry
    await this.sleep(50);
    bubble.style.opacity = '1';
    bubble.style.transform = 'translateX(-50%) scale(1)';
    
    // Type text
    const schedule = typeSchedule(text, 'bubble', { reducedMotion: isReducedMotion() });
    for (let i = 0; i < text.length; i++) {
      if (this.skipped) break;
      bubble.textContent = text.slice(0, i + 1);
      await this.sleep(schedule.delays[i]);
    }
    
    // Hold 3s
    await this.sleep(3000);
    if (this.skipped) return;
    
    // Fade out
    bubble.style.opacity = '0';
    await this.sleep(500);
    bubble.remove();
  }

  async celebrateLine(line) {
    const el = this.createLineElement(line);
    this.terminal.appendChild(el);
    this.lines.push({ element: el, line });
    
    this.renderMascotInline('celebrate');
    await this.sleep(1200);
    this.renderMascotInline('talk');
    
    this.autoScroll();
  }

  createLineElement(line) {
    const el = document.createElement('div');
    el.className = 'humble-line humble-line-' + line.kind;
    el.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 4px;
      font: 12.5px/1.55 ui-monospace, "JetBrains Mono", "Cascadia Code", Menlo, monospace;
      color: var(--c-ink);
      padding: 2px 8px;
    `;
    
    // Apply kind-specific styles
    const kind = LINE_KINDS[line.kind] || LINE_KINDS.cmd;
    const color = 'var(' + kind.color + ')';
    
    let html = '';
    if (line.prefix) {
      html += '<span class="humble-line-prefix" style="color: ' + color + '; white-space: pre;">' + escapeHtml(line.prefix) + '</span>';
    }
    html += '<span class="humble-line-text" style="color: ' + color + ';"></span>';
    
    if (line.rightAlign) {
      el.style.justifyContent = 'flex-end';
    }
    
    if (line.status === 'pass') {
      html += '<span class="humble-line-status" style="color: var(--c-ok); opacity: 0; margin-left: auto;">check</span>';
    } else if (line.status === 'fail') {
      html += '<span class="humble-line-status" style="color: var(--c-fail); opacity: 0; margin-left: auto;">close</span>';
    }
    
    if (line.strikethrough) {
      html = html.replace('<span class="humble-line-text"', '<span class="humble-line-text" style="text-decoration: line-through; opacity: 0.7;"');
    }
    if (line.italic) {
      html = html.replace('<span class="humble-line-text"', '<span class="humble-line-text" style="font-style: italic;"');
    }
    
    el.innerHTML = html;
    return el;
  }

  async demoPoints() {
    // Find first fail line and fix line in the rendered lines
    const failIdx = this.lines.findIndex(l => l.line.kind === 'fail' || l.line.status === 'fail');
    const fixIdx = this.lines.findIndex(l => l.line.kind === 'fix');
    
    if (failIdx >= 0) {
      const failLine = this.lines[failIdx].element;
      await this.pointAtLine(this.lines[failIdx].line, 'this broke here');
    }
    
    if (fixIdx >= 0) {
      const fixLine = this.lines[fixIdx].element;
      await this.pointAtLine(this.lines[fixIdx].line, 'so i fixed the readme');
    }
  }

  async showCTA() {
    await this.sleep(2300);
    if (this.skipped) return;
    
    const ctaText = "press enter to replay it";
    const el = document.createElement('div');
    el.className = 'humble-line humble-line-cta humble-caret-line';
    el.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 4px;
      font: 12.5px/1.55 ui-monospace, "JetBrains Mono", "Cascadia Code", Menlo, monospace;
      color: var(--c-ink);
      padding: 2px 8px;
    `;
    
    const schedule = typeSchedule(ctaText, 'welcome', { reducedMotion: isReducedMotion() });
    
    el.innerHTML = '<span class="humble-line-prefix" style="color: var(--c-core);">$ </span><span class="humble-line-text" style="color: var(--c-ink);"></span><span class="humble-caret" style="color: var(--c-core);">|</span>';
    
    this.terminal.appendChild(el);
    this.autoScroll();
    
    const textSpan = el.querySelector('.humble-line-text');
    for (let i = 0; i < ctaText.length; i++) {
      if (this.skipped) break;
      textSpan.textContent = ctaText.slice(0, i + 1);
      await this.sleep(schedule.delays[i]);
    }
    
    // Caret blink
    const caret = el.querySelector('.humble-caret');
    let blink = true;
    const blinkInterval = setInterval(() => {
      if (caret) caret.style.opacity = blink ? '1' : '0';
      blink = !blink;
    }, 1060);
    
    // Hold 10s then fade
    await this.sleep(10000);
    if (this.skipped) return;
    
    clearInterval(blinkInterval);
    el.style.transition = 'opacity 0.5s ease';
    el.style.opacity = '0';
    await this.sleep(500);
    // Keep caret blinking on last line
    if (caret) {
      caret.style.opacity = '1';
      setInterval(() => caret.style.opacity = caret.style.opacity === '1' ? '0' : '1', 1060);
    }
  }

  finishOnboarding() {
    this.playing = false;
    safeLocalStorage('humble.onboarded', '1');
    this.onboarded = true;
    this.onComplete();
  }

  async replayOnboarding() {
    if (this.playing) return;
    this.playing = true;
    this.skipped = false;
    
    // Clear terminal
    this.terminal.innerHTML = '';
    this.lines = [];
    
    // Skip intro - jump to terminal fade in
    await this.fadeInTerminal();
    
    // Play reel with skip (instant)
    this.reelPlayer = reelPlayer(this.reel, {
      targetDuration: 0, // instant
      onAction: (action) => this.handleReelActionInstant(action)
    });
    
    this.reelPlayer.skip(); // Jump to end instantly
    
    // Show final line
    if (this.finalLine) {
      await this.typeLine(this.finalLine);
    }
    
    // Show CTA
    await this.showCTA();
    
    this.playing = false;
  }

  async handleReelActionInstant(action) {
    switch (action.type) {
      case 'type':
      case 'shake':
      case 'celebrate':
      case 'end':
        // Instant - just create element
        const el = this.createLineElement(action.line);
        this.terminal.appendChild(el);
        this.lines.push({ element: el, line: action.line });
        break;
      case 'point':
        // Skip flight in reduced motion / replay
        break;
    }
  }

  skipIntro() {
    this.skipped = true;
    // Clear all typing timers
    this.typingTimers.forEach(t => clearTimeout(t));
    this.typingTimers = [];
  }

  autoScroll() {
    // Only auto-scroll if user is near bottom
    const { scrollTop, scrollHeight, clientHeight } = this.terminal;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 50;
    if (atBottom) {
      this.terminal.scrollTop = this.terminal.scrollHeight;
    }
  }

  sleep(ms) {
    if (isReducedMotion()) return Promise.resolve();
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      this.typingTimers.push(timer);
    });
  }

  close() {
    this.panel.style.animation = 'panelClose 160ms var(--hb-ease-out) forwards';
    setTimeout(() => {
      this.container.innerHTML = '';
      this.mounted = false;
    }, 160);
  }
}

// ============================================================================
// Auto-mount when hero enters viewport
// ============================================================================
export async function mountHumbleConsole(container, options = {}) {
  const console = new HumbleWebConsole(container, options);
  await console.mount();
  return console;
}

// Export for testing
export { CONSOLE_TOKENS, isReducedMotion, safeLocalStorage, getLocalStorage };