/**
 * Thread Guide - The "Prove it live" hero panel
 * A blue thread stitches steps together: pink crack = break, blue stitch = fix, taut replay = verified.
 * Driven ONLY by real recorded reels from /data/reels/*.json
 * Reduced-motion path: thread appears already stitched.
 * Keyboard reachable, no layout shift, lazy-mounted.
 */

const NS = 'http://www.w3.org/2000/svg';

// Brand colors from BRAND.md
const THREAD_COLOR = '#1f3bff';      // --brand-electric: the fix (blue thread)
const CRACK_COLOR = '#f0287a';       // --brand-crack: the break (pink crack)
const OK_COLOR = '#3dd68c';          // --c-ok: verified knot
const REPLAY_THREAD = '#9fb2ff';     // lighter thread for replay
const PULSE_COLOR = '#cfd8ff';       // pulse glow

// Pacing from reel-engine.js (tuned for reading)
const PACE = { cmd: 520, fail: 650, diag: 1700, fix: 1100, pass: 420, phase: 1100, verdict: 400 };
const REPLAY_PACE = { cmd: 260, pass: 240 };

const sleep = (ms, reduced = false) => reduced ? Promise.resolve() : new Promise(r => setTimeout(r, ms));

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

function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

// Load reel from /data/reels/
async function loadReel(name = 'acme-shop') {
  const res = await fetch('/data/reels/' + name + '.json');
  if (!res.ok) throw new Error('reel not loaded (' + res.status + ')');
  return res.json();
}

// Convert reel lines to script (from reel-engine.js)
function toScript(reel) {
  const out = [];
  let phase = 'run', started = null;
  for (const l of reel.lines) {
    if (l.agent === 'planner') continue;
    if (l.agent === 'verifier' && phase !== 'replay') { phase = 'replay'; out.push({ type: 'phase', phase }); }
    const t = Number(l.seconds) || 0;
    if (l.kind === 'cmd') { out.push({ type: 'cmd', text: l.text, phase }); started = t; }
    else if (l.kind === 'fail') out.push({ type: 'fail', secs: started == null ? null : t - started });
    else if (l.kind === 'diag') out.push({ type: 'diag', text: l.text });
    else if (l.kind === 'fix') { out.push({ type: 'fix', text: l.text }); started = t; }
    else if (l.kind === 'pass') { out.push({ type: 'pass', secs: started == null ? null : t - started, phase }); }
    else if (l.kind === 'verified' && l.agent === 'scribe') out.push({ type: 'verdict', text: l.text.replace(/^Verdict:\s*/, '') });
  }
  return out;
}

// Create SVG element
function svgEl(tag, attrs = {}, cls = '') {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (cls) e.setAttribute('class', cls);
  return e;
}

// Draw a path/line with stroke-dasharray animation
function drawStroke(el, length, ms, reduced = false) {
  if (reduced) { el.style.strokeDashoffset = '0'; return Promise.resolve(); }
  el.style.strokeDasharray = length;
  el.style.strokeDashoffset = length;
  el.style.setProperty('--d', ms + 'ms');
  el.classList.add('draw');
  return sleep(ms);
}

// Main ThreadGuide class
export class ThreadGuide {
  constructor(container, options = {}) {
    this.container = container;
    this.reelName = options.reel || 'acme-shop';
    this.speed = options.speed || 1;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mounted = false;
    this.playing = false;
    this.token = { stop: false };
    this.X = 11; // thread x position in gutter
    
    // DOM refs
    this.content = null;
    this.term = null;
    this.status = null;
    this.dock = null;
    this.svg = null;
    this.lastY = null;
    this.broken = null;
    this.replaying = false;
    this.script = null;
  }

  // Build the DOM structure
  buildDOM() {
    this.container.innerHTML = '\n' +
      '      <div class="thread-panel" role="region" aria-label="HUMBLE console - recorded run">\n' +
      '        <header class="thread-header">\n' +
      '          <div class="thread-dock" id="thread-dock" aria-hidden="true"></div>\n' +
      '          <div class="thread-title-block">\n' +
      '            <div class="thread-title">HUMBLE</div>\n' +
      '            <div class="thread-subtitle">onboarding ' + this.reelName + '</div>\n' +
      '          </div>\n' +
      '          <span class="thread-status" id="thread-status" aria-live="polite">starting</span>\n' +
      '        </header>\n' +
      '        <div class="thread-term" id="thread-term" role="log" aria-live="polite" tabindex="0">\n' +
      '          <div class="thread-content" id="thread-content"></div>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <div class="thread-controls">\n' +
      '        <button type="button" id="thread-again" class="thread-btn">Play again</button>\n' +
      '        <span class="thread-speed" aria-live="polite"></span>\n' +
      '      </div>\n' +
      '      <p class="thread-src mono">Recorded ' + this.reelName + ' run: every command, failure, diagnosis, fix and duration comes from /data/reels/' + this.reelName + '.json. Only the pacing is tuned for reading.</p>\n' +
      '    ';

    this.content = $('#thread-content', this.container);
    this.term = $('#thread-term', this.container);
    this.status = $('#thread-status', this.container);
    this.dock = $('#thread-dock', this.container);
    
    // Add HUMBLE mark to dock (static - Zeus's 3D mascot will mount here later)
    this.dock.innerHTML = this.getHumbleMark();
    
    // Bind events
    $('#thread-again', this.container).addEventListener('click', () => this.run());
    
    // Keyboard: Enter to replay, Escape to stop
    this.term.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.playing) this.run();
      if (e.key === 'Escape') this.stop();
    });
  }

  // HUMBLE mark SVG - clean mount point for Zeus's 3D mascot
  getHumbleMark() {
    return '\n' +
      '      <svg viewBox="0 0 716.94 537.7" width="28" height="22" aria-hidden="true" style="display:block;">\n' +
      '        <polygon fill="#fffefe" points="0 358.46 179.23 358.46 179.23 537.7 268.85 537.7 268.85 268.85 0 268.85 0 358.46"/>\n' +
      '        <polygon fill="#fffefe" points="537.7 179.23 537.7 0 268.85 0 268.85 268.85 358.47 268.85 358.47 89.61 448.09 89.61 448.09 268.85 716.94 268.85 716.94 179.23 537.7 179.23"/>\n' +
      '      </svg>\n' +
      '    ';
  }

  // Set dock ring color based on state
  setDockState(color, glow = false) {
    this.dock.style.setProperty('--ring', color);
    this.dock.classList.toggle('glow', glow);
    if (!this.reduced && this.dock.animate) {
      this.dock.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], 
        { duration: 260, easing: 'ease-out' });
    }
  }

  // Calculate Y center of a DOM node
  cy(node) {
    return node.offsetTop + node.offsetHeight / 2;
  }

  // Fit SVG height to content
  fit() {
    if (this.svg) {
      const h = this.content.scrollHeight;
      this.svg.setAttribute('height', h);
      this.svg.style.height = h + 'px';
    }
  }

  // Create a row element from script event
  createRow(ev) {
    const row = document.createElement('div');
    row.className = 'thread-row' + (ev.phase === 'replay' ? ' replay' : '');
    row.dataset.type = ev.type;
    
    const prefix = ev.type === 'cmd' ? '$ ' : '';
    const promptColor = '#9c9082';
    const textColor = ev.phase === 'replay' ? '#cfc5b6' : '#efe7da';
    
    row.innerHTML = '\n' +
      '      <span class="thread-prompt" style="color:' + promptColor + ';">' + escapeHtml(prefix) + '</span>\n' +
      '      <span class="thread-text" style="color:' + textColor + ';">' + escapeHtml(ev.text || '') + '</span>\n' +
      '      <span class="thread-res" style="color:#9c9082;"></span>\n' +
      '    ';
    return row;
  }

  // Add a note element (diagnosis or fix)
  createNote(row, type, text) {
    const note = document.createElement('div');
    note.className = 'thread-note' + (type === 'fix' ? ' thread-note-fix' : '');
    const label = type === 'fix' ? 'fix' : 'DR.BO';
    const labelColor = type === 'fix' ? THREAD_COLOR : '#5e9eff';
    note.innerHTML = '\n' +
      '      <b style="font:600 11px var(--mono);letter-spacing:.06em;margin-right:8px;color:' + labelColor + ';">' + escapeHtml(label) + '</b>\n' +
      '      <span>' + escapeHtml(text) + '</span>\n' +
      '    ';
    row.after(note);
    return note;
  }

  // Phase banner
  createPhaseBanner() {
    const banner = document.createElement('div');
    banner.className = 'thread-phase-banner';
    banner.textContent = 'Machine thrown away \u00b7 replaying the fixed guide from zero';
    this.content.append(banner);
    return banner;
  }

  // Verdict stamp
  createVerdict(text) {
    const stamp = document.createElement('div');
    stamp.className = 'thread-verdict';
    stamp.textContent = text;
    this.content.append(stamp);
    return stamp;
  }

  // Draw thread segment
  async segment(y0, y1) {
    const cls = this.replaying ? 'seg replay' : 'seg';
    const s = svgEl('line', { x1: this.X, y1: y0, x2: this.X, y2: y1 }, cls);
    this.svg.append(s);
    await drawStroke(s, Math.abs(y1 - y0), Math.min(420, 120 + Math.abs(y1 - y0) * 2) / this.speed, this.reduced);
  }

  // Create node (step marker)
  node(y) {
    return svgEl('circle', { cx: this.X, cy: y, r: 3.4 }, 'node');
  }

  // Draw crack (pink break)
  async drawCrack(y) {
    const c = svgEl('polyline', { 
      points: (this.X - 7) + ',' + (y + 5) + ' ' + (this.X - 3) + ',' + (y + 1) + ' ' + this.X + ',' + (y + 7) + ' ' + (this.X + 3) + ',' + (y + 1) + ' ' + (this.X + 7) + ',' + (y + 6) 
    }, 'crack');
    this.svg.append(c);
    await drawStroke(c, 34, 240 / this.speed, this.reduced);
    return c;
  }

  // Draw stitches (blue fix)
  async drawStitches(y) {
    for (const dx of [-5, 0, 5]) {
      const s = svgEl('line', { x1: this.X + dx - 2, y1: y - 4, x2: this.X + dx + 2, y2: y + 9 }, 'stitch');
      this.svg.append(s);
      await drawStroke(s, 14, 110 / this.speed, this.reduced);
    }
  }

  // Draw pulse (replay light running down thread)
  async drawPulse(top, bottom) {
    if (this.reduced) return;
    const p = svgEl('circle', { cx: this.X, cy: top, r: 3 }, 'pulse');
    this.svg.append(p);
    await p.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(' + (bottom - top) + 'px)' }],
      { duration: 900 / this.speed, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }
    ).finished;
    p.remove();
  }

  // Draw knot (verified)
  async drawKnot(y) {
    const k = svgEl('circle', { cx: this.X, cy: y, r: 5.5 }, 'knot');
    this.svg.append(k);
    await drawStroke(k, 35, 320 / this.speed, this.reduced);
    svgEl('circle', { cx: this.X, cy: y, r: 2.4 }, 'node pass');
  }

  // Main run loop
  async run() {
    if (this.playing) return;
    this.token.stop = true;
    this.token = { stop: false };
    this.playing = true;
    this.replaying = false;
    this.lastY = null;
    this.broken = null;
    
    // Clear content
    this.content.textContent = '';
    
    // Create SVG thread layer
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'thread');
    this.svg.setAttribute('width', '22');
    this.svg.style.position = 'absolute';
    this.svg.style.left = '12px';
    this.svg.style.top = '0';
    this.svg.style.width = '22px';
    this.svg.style.overflow = 'visible';
    this.svg.style.pointerEvents = 'none';
    this.content.append(this.svg);
    
    this.setDockState('var(--c-core, #ff9a3c)');
    this.status.textContent = 'following the README';
    
    try {
      const reel = await loadReel(this.reelName);
      this.script = toScript(reel);
      
      for (const ev of this.script) {
        if (this.token.stop) break;
        
        const replay = ev.phase === 'replay';
        const pace = replay ? REPLAY_PACE : PACE;
        
        if (ev.type === 'cmd') {
          this.fit();
          const row = this.createRow(ev);
          const y = this.cy(row);
          
          // Draw thread from last position
          if (this.lastY != null) {
            const gap = this.broken ? 8 : 4;
            await this.segment(this.lastY + gap, y - 4);
          }
          
          row._node = this.node(y);
          this.svg.append(row._node);
          this.lastY = y;
          this.broken = null;
          
          this.content.append(row);
          await sleep(pace.cmd / this.speed, this.reduced);
          
        } else if (ev.type === 'fail') {
          this.fit();
          this.setDockState(CRACK_COLOR);
          this.status.textContent = 'a step broke';
          
          const row = this.content.lastElementChild;
          if (row) {
            row.classList.add('is-fail');
            row.querySelector('.thread-text').style.color = CRACK_COLOR;
            row.querySelector('.thread-res').textContent = 'failed \u00b7 ' + this.secsText(ev.secs);
            row.querySelector('.thread-res').style.color = CRACK_COLOR;
            
            if (row._node) row._node.classList.add('fail');
            const y = this.cy(row);
            const crack = await this.drawCrack(y);
            this.broken = { y, crack };
          }
          await sleep(pace.fail / this.speed, this.reduced);
          
        } else if (ev.type === 'diag') {
          this.fit();
          const row = this.content.lastElementChild;
          const note = this.createNote(row, 'diag', ev.text);
          note.classList.add('unfold');
          this.setDockState('#5e9eff');
          this.status.textContent = 'DR.BO is reading the log';
          await sleep(pace.diag / this.speed, this.reduced);
          
        } else if (ev.type === 'fix') {
          this.fit();
          const row = this.content.lastElementChild;
          const note = this.createNote(row, 'fix', ev.text);
          note.classList.add('unfold');
          this.setDockState(THREAD_COLOR);
          this.status.textContent = 'stitching the fix into the README';
          
          if (this.broken) {
            const y = this.broken.y;
            await this.drawStitches(y);
            if (row._node) row._node.classList.remove('fail');
            const bottom = note.offsetTop + note.offsetHeight;
            await this.segment(y + 8, bottom);
            this.lastY = bottom;
            this.broken = null;
          }
          await sleep(pace.fix / this.speed, this.reduced);
          
        } else if (ev.type === 'pass') {
          const row = this.content.lastElementChild;
          if (row) {
            row.classList.remove('is-fail');
            row.classList.add('is-pass');
            row.querySelector('.thread-text').style.color = replay ? '#cfc5b6' : '#efe7da';
            row.querySelector('.thread-res').textContent = (replay ? 'replayed' : 'passed') + ' \u00b7 ' + this.secsText(ev.secs);
            row.querySelector('.thread-res').style.color = OK_COLOR;
            if (row._node) row._node.classList.add('pass');
            if (!replay) {
              this.setDockState(OK_COLOR);
              this.status.textContent = 'step passed';
            }
          }
          await sleep((replay ? pace.pass : PACE.pass) / this.speed, this.reduced);
          
        } else if (ev.type === 'phase') {
          this.fit();
          this.setDockState('#9c9082');
          this.status.textContent = 'replaying from zero';
          
          const banner = this.createPhaseBanner();
          const top = 10;
          const bottom = this.cy(banner);
          
          await this.drawPulse(top, bottom);
          this.replaying = true;
          this.lastY = bottom;
          await sleep(pace.phase / this.speed, this.reduced);
          
        } else if (ev.type === 'verdict') {
          this.fit();
          this.setDockState(OK_COLOR, true);
          this.status.textContent = 'verified';
          
          const stamp = this.createVerdict(ev.text);
          const y = this.cy(stamp);
          await this.segment(this.lastY + 4, y - 6);
          await this.drawKnot(y);
          await sleep(pace.verdict / this.speed, this.reduced);
        }
      }
    } catch (e) {
      this.status.textContent = 'could not load the recorded run';
      console.error(e);
    }
    
    this.playing = false;
  }

  secsText(s) {
    if (s == null) return '';
    return s < 60 ? s.toFixed(1) + ' s' : Math.floor(s / 60) + ' m ' + Math.round(s % 60) + ' s';
  }

  stop() {
    this.token.stop = true;
  }

  // Mount: build DOM and start
  async mount() {
    if (this.mounted) return;
    this.buildDOM();
    this.mounted = true;
    await this.run();
  }

  // Lazy mount when in viewport
  static async lazyMount(selector, options = {}) {
    const container = $(selector);
    if (!container) return null;
    
    const guide = new ThreadGuide(container, options);
    
    // Check if already in viewport
    const rect = container.getBoundingClientRect();
    const inView = rect.top < window.innerHeight + 300 && rect.bottom > -300;
    
    if (inView) {
      await guide.mount();
    } else {
      // Wait for viewport entry
      await new Promise(resolve => {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              observer.disconnect();
              guide.mount().then(resolve);
            }
          });
        }, { rootMargin: '200px' });
        observer.observe(container);
      });
    }
    
    return guide;
  }
}

// Auto-mount on DOM ready (for thread-guide hero)
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    ThreadGuide.lazyMount('#thread-guide-mount', { reel: 'acme-shop' });
  });
}
