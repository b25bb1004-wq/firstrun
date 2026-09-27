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
    this.X = 24; // thread x in the gutter; the rider (EMO bot) is centred on it
    this.rider = null; this.bot = null; this.riderPos = null;
    
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

  // -- The rider (Arnav's pick C): the EMO bot rides the gutter and the thread is left behind it --------------
  // Reduced motion: no rider; the thread is drawn complete and the bot stays docked beside the headline.
  async mountRider() {
    if (this.reduced) return;
    if (!this.rider) {
      this.rider = document.createElement('div');
      this.rider.className = 'thread-rider';
      this.rider.setAttribute('aria-hidden', 'true');
      const seat = document.createElement('div');
      seat.className = 'thread-rider-bot';
      this.rider.append(seat);
      try {
        const { EmoBot } = await import('/humble-console/emo-bot.js');
        this.bot = new EmoBot(seat, { size: 44, interactive: false });
      } catch (e) { console.warn('[thread] rider bot not loaded', e); }
      let y = 8, v = 0, target = 8, raf = 0, last = 0, done = null;
      const apply = () => {
        const st = Math.min(0.12, Math.abs(v) / 2800); // stretch a little along the motion, settle round
        this.rider.style.transform = 'translate3d(0, ' + y.toFixed(1) + 'px, 0) scale(' + (1 - st * 0.5).toFixed(3) + ', ' + (1 + st).toFixed(3) + ')';
      };
      const tick = (now) => {
        const dt = Math.min(0.032, (now - last) / 1000 || 0.016); last = now;
        v += (190 * (target - y) - 21 * v) * dt; y += v * dt; apply();
        if (Math.abs(target - y) < 0.3 && Math.abs(v) < 4) { y = target; v = 0; apply(); raf = 0; if (done) done(); done = null; return; }
        raf = requestAnimationFrame(tick);
      };
      this.riderPos = {
        to: (t) => { target = t; if (done) { done(); done = null; } if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } return new Promise((r) => { done = r; }); },
        jump: (t) => { y = target = t; v = 0; apply(); },
      };
    }
    this.content.append(this.rider); // content was cleared for this run
    this.riderPos.jump(8);
    this.mood('idle');
  }

  // Glide the rider beside a node; the script waits at most ~300 ms (the spring keeps settling on its own).
  glide(node, dy = 0) {
    if (!this.riderPos || !node) return Promise.resolve();
    const y = this.cy(node) - 22 + dy;
    return Promise.race([this.riderPos.to(y), sleep(300 / this.speed)]);
  }

  mood(state, look) {
    if (!this.bot) return;
    this.bot.setState(state);
    if (look) this.bot.look(look[0], look[1]);
  }

  riderMove(keyframes, ms) {
    if (!this.rider || this.reduced || !this.rider.firstChild.animate) return Promise.resolve();
    return this.rider.firstChild.animate(keyframes, { duration: ms / this.speed, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }).finished.catch(() => {});
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
    this.svg.setAttribute('width', '48');
    this.svg.style.position = 'absolute';
    this.svg.style.left = '4px';
    this.svg.style.top = '0';
    this.svg.style.width = '48px';
    this.svg.style.overflow = 'visible';
    this.svg.style.pointerEvents = 'none';
    this.content.append(this.svg);
    await this.mountRider();
    
    this.setDockState('var(--c-core, #ff9a3c)');
    this.status.textContent = 'following the README';
    
    try {
      const reel = await loadReel(this.reelName);
      this.script = toScript(reel);
      
      for (const ev of this.script) {
        document.dispatchEvent(new CustomEvent('humble:beat', { detail: { type: ev.type } }));
        if (this.token.stop) break;
        
        const replay = ev.phase === 'replay';
        const pace = replay ? REPLAY_PACE : PACE;
        
        if (ev.type === 'cmd') {
          // Add the row BEFORE measuring it: a detached row has offsetTop 0, which drew every node at the top.
          const row = this.createRow(ev);
          this.content.append(row);
          this.currentRow = row;
          this.follow(row);
          this.fit();
          const y = this.cy(row);
          
          // The rider glides to the new row while the thread segment draws behind it; its eyes glance at the line.
          this.mood(replay ? 'idle' : 'think', [0.9, 0.1]);
          const glided = this.glide(row);
          if (this.lastY != null) {
            const gap = this.broken ? 8 : 4;
            await this.segment(this.lastY + gap, y - 4);
          }
          await glided;
          
          row._node = this.node(y);
          this.svg.append(row._node);
          this.lastY = y;
          this.broken = null;
          await sleep(pace.cmd / this.speed, this.reduced);
          
        } else if (ev.type === 'fail') {
          this.fit();
          this.setDockState(CRACK_COLOR);
          this.status.textContent = 'a step broke';

          const row = this.currentRow;
          if (row) {
            row.classList.add('is-fail');
            row.querySelector('.thread-text').style.color = CRACK_COLOR;
            row.querySelector('.thread-res').textContent = 'failed \u00b7 ' + this.secsText(ev.secs);
            row.querySelector('.thread-res').style.color = CRACK_COLOR;
            
            if (row._node) row._node.classList.add('fail');
            const y = this.cy(row);
            this.mood('worried', [0.8, 0]);
            const shiver = [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }];
            const [crack] = await Promise.all([this.drawCrack(y), this.riderMove(shiver, 320)]);
            this.broken = { y, crack };
          }
          await sleep(pace.fail / this.speed, this.reduced);
          
        } else if (ev.type === 'diag') {
          this.fit();
          const row = this.content.lastElementChild;
          const note = this.createNote(row, 'diag', ev.text);
          note.classList.add('unfold');
          this.follow(note);
          this.mood('think', [1, 0.2]);
          await this.glide(note); // it moves down to read the diagnosis, uncovering the crack above it
          this.setDockState('#5e9eff');
          this.status.textContent = 'DR.BO is reading the log';
          await sleep(pace.diag / this.speed, this.reduced);
          
        } else if (ev.type === 'fix') {
          this.fit();
          const row = this.content.lastElementChild;
          const note = this.createNote(row, 'fix', ev.text);
          note.classList.add('unfold');
          this.follow(note);
          this.mood('point', [-0.6, -0.4]); // it looks back up at the crack it is stitching
          await this.glide(note);
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
          const row = this.currentRow;
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
          this.follow(banner);
          this.mood('think', [0, -0.5]);
          await this.glide(banner);
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
          this.follow(stamp);
          await this.glide(stamp, 34); // it lands just below the verdict so the knot it tied stays visible
          this.mood('celebrate', [0, -0.6]);
          this.riderMove([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-10px) scale(.94, 1.08)', offset: .45 }, { transform: 'translateY(0) scale(1.1, .88)', offset: .8 }, { transform: 'translateY(0) scale(1)' }], 560);
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

  /** Keep the newest line in view: scroll the log (not the page) so the node sits a little above the middle. */
  follow(node) {
    if (!this.term || !node) return;
    const top = node.offsetTop - this.term.clientHeight * 0.45;
    this.term.scrollTo({ top: Math.max(0, top), behavior: this.reduced ? 'auto' : 'smooth' });
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
