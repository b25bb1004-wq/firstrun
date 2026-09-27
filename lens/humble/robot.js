/**
 * HUMBLE Robot Companion Component (Lens & Electron Integration)
 * Spec: docs/design/HUMBLE_CONSOLE_SPEC.md (Sections 5 & 6)
 * Lamplighter Mascot: Warm amber glowing belly lantern, telescoping eyestalk peek,
 * 60fps physics-based flight (Clicky bezier math 1:1), CRT boot sequence, and idle life.
 */

export const HUMBLE_STATES = [
  'sleep',
  'think',
  'walk',
  'point',
  'talk',
  'celebrate',
  'worried'
];

export const AGENT_COLORS = {
  harvey: '#4589ff',   // Scout: cyan-blue
  unity: '#8a3ffc',    // Planner: purple
  mach: '#0072c3',     // Runner: cobalt
  drbo: '#fa4d56',     // Doctor: coral-red
  larp: '#1192e8',     // Verifier: bright blue
  echo: '#009d9a',     // Scribe: teal
  vigil: '#da1e28',    // Security Pre-flight: crimson
  default: '#0f62fe'   // Core IBM Blue
};

export const HUMBLE_SIZES = ['24', '56', '96', '256', 'xs', 'sm', 'md', 'lg', 'xl'];

/**
 * Spec Section 6 Pure Flight Math Helpers
 */
export const flightMath = {
  duration(dist) {
    return Math.min(1.4, Math.max(0.6, dist / 800));
  },
  easedProgress(u) {
    return 3 * u * u - 2 * u * u * u;
  },
  scalePeak(u) {
    return 1 + Math.sin(u * Math.PI) * 0.3;
  },
  glowRadius(scale) {
    return 8 + (scale - 1) * 20;
  },
  bezierPoint(P0, P1, P2, t) {
    const omt = 1 - t;
    return {
      x: omt * omt * P0.x + 2 * omt * t * P1.x + t * t * P2.x,
      y: omt * omt * P0.y + 2 * omt * t * P1.y + t * t * P2.y
    };
  },
  controlPoint(startX, startY, targetX, targetY, dist) {
    const midLift = Math.min(dist * 0.2, 80);
    return {
      x: (startX + targetX) / 2,
      y: ((startY + targetY) / 2) - midLift
    };
  }
};

export class HumbleRobot {
  /**
   * @param {HTMLElement} container - DOM container element
   * @param {Object} [opts]
   * @param {'24'|'56'|'96'|'256'|'xs'|'sm'|'md'|'lg'|'xl'} [opts.size='96']
   * @param {string} [opts.initialState='sleep']
   * @param {string} [opts.spritePath='./robot.svg']
   * @param {boolean} [opts.autoIdle=true]
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.size = String(opts.size || '96');
    this.state = opts.initialState || 'sleep';
    this.spritePath = opts.spritePath || './robot.svg';
    this.agent = null;
    this.x = 0;
    this.y = 0;
    this.homeX = 0;
    this.homeY = 0;
    this.isFlying = false;
    this.isReturning = false;
    this._bubbleTimer = null;
    this._idleTimer = null;
    this._blinkTimer = null;
    this._lastMouseMove = { x: 0, y: 0 };
    this._returnStartMouse = { x: 0, y: 0 };

    this.init();

    if (opts.autoIdle !== false) {
      this.startIdleLife();
    }
  }

  init() {
    this.el = document.createElement('div');
    this.el.className = `humble-robot-wrapper humble-robot-${this.size}`;
    this.el.setAttribute('role', 'img');
    this.el.setAttribute('aria-label', `HUMBLE Robot (${this.state})`);
    this.render();
    this.container.appendChild(this.el);

    // Track mouse for section 6 cancel-on-return rule (>100px movement)
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', (e) => {
        this._lastMouseMove = { x: e.clientX, y: e.clientY };
        if (this.isReturning) {
          const moved = Math.hypot(
            e.clientX - this._returnStartMouse.x,
            e.clientY - this._returnStartMouse.y
          );
          if (moved > 100) {
            this.cancelFlightAndSnapHome();
          }
        }
      }, { passive: true });
    }
  }

  /**
   * Spec Section 5: CRT Boot Sequence (first open only)
   * CRT flicker: opacity 0 -> 0.8 -> 0.2 -> 1 over 420ms (steps)
   * 1px scanline sweeps top to bottom in 300ms
   * Eyes open last with one blink
   * @returns {Promise<void>}
   */
  async boot() {
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.setState('talk');
      return;
    }

    this.el.classList.add('humble-robot-booting');

    // Add sweep scanline
    const scanline = document.createElement('div');
    scanline.className = 'humble-robot-scanline';
    this.el.appendChild(scanline);

    // 420ms boot sequence
    await new Promise(r => setTimeout(r, 300));
    scanline.remove();

    await new Promise(r => setTimeout(r, 120));
    this.el.classList.remove('humble-robot-booting');

    // Eyes open last with one blink, transition to talk/think
    this.blink();
    this.setState('talk');
  }

  /**
   * Spec Section 5: Idle Life
   * Random blinks every 3-6s
   */
  startIdleLife() {
    const scheduleNextBlink = () => {
      const delay = 3000 + Math.random() * 3000; // 3-6s
      this._blinkTimer = setTimeout(() => {
        if (!this.isFlying && this.state !== 'sleep') {
          this.blink();
        }
        scheduleNextBlink();
      }, delay);
    };
    scheduleNextBlink();
  }

  stopIdleLife() {
    clearTimeout(this._blinkTimer);
    clearTimeout(this._idleTimer);
  }

  /**
   * Blink animation on the eye lenses
   */
  blink() {
    const eyes = this.el.querySelectorAll('circle[cx="83"], circle[cx="117"], path[d*="77 Q83"]');
    eyes.forEach(eye => {
      eye.classList.remove('hb-eye-blink');
      void eye.offsetWidth; // trigger reflow
      eye.classList.add('hb-eye-blink');
      setTimeout(() => eye.classList.remove('hb-eye-blink'), 200);
    });
  }

  /**
   * Spec Section 5: Eyes dart toward new terminal line (150ms)
   * @param {number} [offsetY=0]
   */
  dartEyes(offsetY = 0) {
    const pupils = this.el.querySelectorAll('circle[cx="87"], circle[cx="121"], circle[cx="86"], circle[cx="120"], circle[cx="85"], circle[cx="119"]');
    const dy = Math.max(-3, Math.min(3, offsetY * 0.05));
    pupils.forEach(p => {
      p.style.transition = 'transform 150ms ease';
      p.style.transform = `translateY(${dy}px)`;
      setTimeout(() => {
        p.style.transform = 'translateY(0)';
      }, 350);
    });
  }

  /**
   * Signature move: Telescoping Eyestalk Peek
   */
  peek() {
    this.setState('think');
    const head = this.el.querySelector('.bot-head-think, .hb-head, .bot-sleep-float');
    if (head && head.animate) {
      head.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(-14px) scaleY(1.08)' },
        { transform: 'translateY(0)' }
      ], { duration: 600, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    }
  }

  /**
   * Switch the robot's active state
   * @param {string} state - 'sleep' | 'think' | 'walk' | 'point' | 'talk' | 'celebrate' | 'worried'
   * @param {Object} [meta]
   * @param {string} [meta.agent] - Active agent name
   * @param {string} [meta.say] - Short speech text to bubble
   */
  setState(state, meta = {}) {
    if (!HUMBLE_STATES.includes(state)) {
      console.warn(`[HUMBLE Robot] Unknown state "${state}", defaulting to "think"`);
      state = 'think';
    }
    this.state = state;
    this.el.setAttribute('aria-label', `HUMBLE Robot (${this.state})`);
    if (meta.agent) this.agent = meta.agent;
    this.render();

    if (this.agent) {
      this.setAgent(this.agent);
    }

    if (meta.say) {
      this.say(meta.say);
    }
  }

  /**
   * Set active agent cartridge color
   * @param {string} agentName - 'harvey' | 'unity' | 'mach' | 'drbo' | 'larp' | 'echo' | 'vigil'
   */
  setAgent(agentName) {
    this.agent = agentName.toLowerCase();
    const color = AGENT_COLORS[this.agent] || AGENT_COLORS.default;
    this.setAntennaColor(color);
  }

  /**
   * Set antenna / cartridge glow color
   * @param {string} colorOrAgent
   */
  setAntennaColor(colorOrAgent) {
    const color = AGENT_COLORS[colorOrAgent.toLowerCase()] || colorOrAgent;
    const bulb = this.el.querySelector('.hb-antenna-ball, .antenna-ball-think');
    if (bulb) {
      bulb.style.fill = color;
      bulb.style.filter = `drop-shadow(0 0 6px ${color})`;
    }
  }

  /**
   * Spec Section 6: Display speech bubble on arrival
   * Bubble: bg --c-core, text #1a0e04, 11px medium, padding 4px 8px, radius 6, shadow 0 0 6px rgba(255,154,60,.5)
   * On first character scale .5 -> 1 with spring (--hb-ease-bounce 400ms)
   * Hold 3s, fade 0.5s
   * @param {string} text
   * @param {number} [holdMs=3000]
   * @returns {Promise<void>}
   */
  say(text, holdMs = 3000) {
    return new Promise(resolve => {
      let bubble = this.el.querySelector('.humble-bubble');
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'humble-bubble';
        this.el.appendChild(bubble);
      }

      bubble.textContent = '';
      bubble.classList.add('visible');

      // Spring entry on first character
      bubble.style.transform = 'translateX(-50%) scale(0.5)';
      bubble.style.transition = 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease';
      void bubble.offsetWidth;
      bubble.style.transform = 'translateX(-50%) scale(1)';

      // Type text at random 30-60ms/char (Clicky math)
      let idx = 0;
      const typeChar = () => {
        if (idx < text.length) {
          bubble.textContent += text[idx];
          idx++;
          const delay = 30 + Math.random() * 30;
          setTimeout(typeChar, delay);
        } else {
          // Hold 3s, then fade 0.5s
          clearTimeout(this._bubbleTimer);
          this._bubbleTimer = setTimeout(() => {
            bubble.style.opacity = '0';
            setTimeout(() => {
              bubble.classList.remove('visible');
              bubble.style.opacity = '';
              bubble.style.transform = '';
              resolve();
            }, 500);
          }, holdMs);
        }
      };

      typeChar();
    });
  }

  /**
   * Set mascot size variant
   * @param {'24'|'56'|'96'|'256'|'xs'|'sm'|'md'|'lg'|'xl'} size
   */
  setSize(size) {
    HUMBLE_SIZES.forEach(s => this.el.classList.remove(`humble-robot-${s}`));
    this.size = String(size);
    this.el.classList.add(`humble-robot-${this.size}`);
  }

  /**
   * Spec Section 6: Clicky's Flight Math 1:1
   * - duration = clamp(distance / 800, 0.6s, 1.4s)
   * - quadratic bezier: P0 = start, P2 = target, P1 = midpoint moved UP by min(distance * 0.2, 80px)
   * - eased progress t = 3u^2 - 2u^3 (u = linear progress)
   * - rotation = atan2(B'(t)) + 90°, with B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1); settle at -35° on arrival
   * - scale = 1 + sin(u * PI) * 0.3 (1.3x mid-flight)
   * - glow radius in flight = 8 + (scale - 1) * 20 px
   * - driven by requestAnimationFrame, never CSS transitions
   *
   * @param {HTMLElement|{x:number,y:number}} target - Target element or coordinates
   * @param {Object} [options]
   * @param {string} [options.say] - Text to type upon arrival
   * @param {boolean} [options.returnHome=false]
   * @param {Function} [options.onArrive]
   * @returns {Promise<void>}
   */
  async flyTo(target, options = {}) {
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    let targetX, targetY;
    if (target instanceof HTMLElement) {
      const rect = target.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();
      targetX = rect.left - containerRect.left + rect.width / 2;
      targetY = rect.top - containerRect.top + rect.height / 2;
    } else {
      targetX = target.x;
      targetY = target.y;
    }

    const startX = this.x;
    const startY = this.y;

    if (reduced) {
      this.x = targetX;
      this.y = targetY;
      this.el.style.transform = `translate(${targetX}px, ${targetY}px)`;
      this.setState('point');
      if (options.say) await this.say(options.say);
      if (typeof options.onArrive === 'function') options.onArrive();
      return;
    }

    return new Promise(resolve => {
      this.isFlying = true;
      this.el.classList.add('humble-robot-flying');

      const dist = Math.hypot(targetX - startX, targetY - startY);
      const duration = flightMath.duration(dist) * 1000;

      // Quadratic bezier points
      const P0 = { x: startX, y: startY };
      const P2 = { x: targetX, y: targetY };
      const P1 = flightMath.controlPoint(startX, startY, targetX, targetY, dist);

      this.setState('point');

      const startTime = performance.now();

      const step = (now) => {
        const elapsed = now - startTime;
        const u = Math.min(1, Math.max(0, elapsed / duration));

        // Eased progress t = 3u^2 - 2u^3
        const t = flightMath.easedProgress(u);

        // Position on quadratic bezier: B(t)
        const { x: curX, y: curY } = flightMath.bezierPoint(P0, P1, P2, t);

        // Derivative B'(t) = 2(1-t)(P1 - P0) + 2t(P2 - P1)
        const omt = 1 - t;
        const dX = 2 * omt * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
        const dY = 2 * omt * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);

        let rotation = (Math.atan2(dY, dX) * 180 / Math.PI) + 90;
        if (u >= 0.95) {
          // Settle at -35° on arrival
          const settleProgress = (u - 0.95) / 0.05;
          rotation = rotation * (1 - settleProgress) + (-35) * settleProgress;
        }

        // Scale = 1 + sin(u * PI) * 0.3 (1.3x mid-flight)
        const scale = flightMath.scalePeak(u);

        // Glow radius in flight = 8 + (scale - 1) * 20 px
        const glowRadius = flightMath.glowRadius(scale);

        this.el.style.transform = `translate(${curX}px, ${curY}px) rotate(${rotation.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
        this.el.style.filter = `drop-shadow(0 0 ${glowRadius.toFixed(1)}px var(--robot-core, #ff9a3c))`;

        if (u < 1) {
          requestAnimationFrame(step);
        } else {
          // Arrived!
          this.x = targetX;
          this.y = targetY;
          this.isFlying = false;
          this.el.classList.remove('humble-robot-flying');
          this.el.style.transform = `translate(${targetX}px, ${targetY}px) rotate(-35deg) scale(1)`;

          // Glow settles from 22 to 6 ("materializing")
          this.materializeGlow().then(async () => {
            if (typeof options.onArrive === 'function') {
              options.onArrive();
            }

            if (options.say) {
              await this.say(options.say, 3000);
            }

            if (options.returnHome) {
              await this.returnHome();
            }

            resolve();
          });
        }
      };

      requestAnimationFrame(step);
    });
  }

  /**
   * Glow materialization: starts 22px and settles to 6px over 300ms
   */
  async materializeGlow() {
    const el = this.el;
    const start = performance.now();
    return new Promise(resolve => {
      const settle = (now) => {
        const p = Math.min(1, (now - start) / 300);
        const radius = 22 - (16 * p); // 22 -> 6
        el.style.filter = `drop-shadow(0 0 ${radius.toFixed(1)}px var(--robot-core, #ff9a3c))`;
        if (p < 1) {
          requestAnimationFrame(settle);
        } else {
          el.style.filter = 'drop-shadow(0 0 8px var(--robot-core, #ff9a3c))';
          resolve();
        }
      };
      requestAnimationFrame(settle);
    });
  }

  /**
   * Fly back to home coordinates (P0)
   * Mouse moves > 100px during return flight -> cancel and snap home
   */
  async returnHome() {
    this.isReturning = true;
    this._returnStartMouse = { ...this._lastMouseMove };
    await this.flyTo(this.homeX, this.homeY);
    this.isReturning = false;
    this.el.style.transform = `translate(${this.homeX}px, ${this.homeY}px)`;
    this.setState('sleep');
  }

  /**
   * Snap home immediately if return flight is cancelled by mouse move > 100px
   */
  cancelFlightAndSnapHome() {
    this.isFlying = false;
    this.isReturning = false;
    this.x = this.homeX;
    this.y = this.homeY;
    this.el.classList.remove('humble-robot-flying');
    this.el.style.transform = `translate(${this.homeX}px, ${this.homeY}px)`;
    this.setState('sleep');
  }

  render() {
    // Generate a simple procedural SVG for the robot since we don't have robot.svg yet
    // This creates a basic Lamplighter mascot with the key visual elements
    const svg = this.generateRobotSVG();

    this.el.innerHTML = svg;

    if (this.agent) {
      this.setAgent(this.agent);
    }
  }

  generateRobotSVG() {
    const size = parseInt(this.size) || 56;
    const scale = size / 56;

    // State-specific SVG content
    const stateSVGs = {
      sleep: `
        <g class="bot-sleep-float" transform="translate(0, ${2 * Math.sin(Date.now() / 800)})">
          <!-- Body -->
          <ellipse cx="28" cy="38" rx="20" ry="16" fill="#1c1712" stroke="#ff9a3c" stroke-width="1.5"/>
          <!-- Belly lantern (dim) -->
          <ellipse cx="28" cy="40" rx="10" ry="8" fill="#ff9a3c" opacity="0.3" filter="drop-shadow(0 0 4px #ff9a3c)"/>
          <!-- Sleeping eyes (closed) -->
          <path d="M18 34 Q22 30 26 34" stroke="#7a6e5f" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M30 34 Q34 30 38 34" stroke="#7a6e5f" stroke-width="2" fill="none" stroke-linecap="round"/>
          <!-- Antenna -->
          <line x1="28" y1="20" x2="28" y2="8" stroke="#342c24" stroke-width="2" stroke-linecap="round"/>
          <circle class="antenna-ball-sleep" cx="28" cy="6" r="4" fill="#7a6e5f"/>
          <!-- Z's -->
          <text x="48" y="20" font-size="10" fill="#7a6e5f" font-family="monospace">z</text>
          <text x="50" y="14" font-size="8" fill="#7a6e5f" font-family="monospace">z</text>
        </g>
      `,
      think: `
        <g class="bot-head-think">
          <!-- Body -->
          <ellipse cx="28" cy="38" rx="20" ry="16" fill="#1c1712" stroke="#ff9a3c" stroke-width="1.5"/>
          <!-- Belly lantern (pulsing) -->
          <ellipse cx="28" cy="40" rx="10" ry="8" fill="#ff9a3c" opacity="0.8" filter="drop-shadow(0 0 12px #ff9a3c)"/>
          <!-- Visor lenses scanning -->
          <g class="visor-lenses">
            <ellipse cx="20" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#ff9a3c" stroke-width="1.5"/>
            <ellipse cx="36" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#ff9a3c" stroke-width="1.5"/>
            <circle class="pupil" cx="22" cy="34" r="2" fill="#ff9a3c"/>
            <circle class="pupil" cx="38" cy="34" r="2" fill="#ff9a3c"/>
          </g>
          <!-- Antenna -->
          <line x1="28" y1="20" x2="28" y2="8" stroke="#342c24" stroke-width="2" stroke-linecap="round"/>
          <circle class="hb-antenna-ball" cx="28" cy="6" r="4" fill="#ff9a3c" filter="drop-shadow(0 0 6px #ff9a3c)"/>
        </g>
      `,
      talk: `
        <g class="hb-head">
          <!-- Body -->
          <ellipse cx="28" cy="38" rx="20" ry="16" fill="#1c1712" stroke="#ff9a3c" stroke-width="1.5"/>
          <!-- Belly lantern (warm) -->
          <ellipse cx="28" cy="40" rx="10" ry="8" fill="#ff9a3c" opacity="0.9" filter="drop-shadow(0 0 10px #ff9a3c)"/>
          <!-- Happy eyes -->
          <ellipse cx="20" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#ff9a3c" stroke-width="1.5"/>
          <ellipse cx="36" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#ff9a3c" stroke-width="1.5"/>
          <circle class="pupil" cx="21" cy="34" r="2.5" fill="#ff9a3c"/>
          <circle class="pupil" cx="37" cy="34" r="2.5" fill="#ff9a3c"/>
          <!-- Small smile -->
          <path d="M20 42 Q28 46 36 42" stroke="#ff9a3c" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <!-- Antenna -->
          <line x1="28" y1="20" x2="28" y2="8" stroke="#342c24" stroke-width="2" stroke-linecap="round"/>
          <circle class="hb-antenna-ball" cx="28" cy="6" r="4" fill="#ff9a3c" filter="drop-shadow(0 0 6px #ff9a3c)"/>
        </g>
      `,
      point: `
        <g class="hb-head">
          <!-- Body leaning forward -->
          <ellipse cx="28" cy="38" rx="20" ry="16" fill="#1c1712" stroke="#ff9a3c" stroke-width="1.5" transform="rotate(-5 28 38)"/>
          <!-- Belly lantern (BEAM) -->
          <ellipse cx="28" cy="40" rx="10" ry="8" fill="#ff9a3c" opacity="1" filter="drop-shadow(0 0 16px #ff9a3c)"/>
          <!-- Focused eyes -->
          <ellipse cx="20" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#ff9a3c" stroke-width="1.5"/>
          <ellipse cx="36" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#ff9a3c" stroke-width="1.5"/>
          <circle class="pupil" cx="23" cy="33" r="2" fill="#ff9a3c"/>
          <circle class="pupil" cx="39" cy="33" r="2" fill="#ff9a3c"/>
          <!-- Antenna -->
          <line x1="28" y1="20" x2="28" y2="8" stroke="#342c24" stroke-width="2" stroke-linecap="round"/>
          <circle class="hb-antenna-ball" cx="28" cy="6" r="4" fill="#ff9a3c" filter="drop-shadow(0 0 12px #ff9a3c)"/>
          <!-- Lantern beam (added dynamically via CSS) -->
        </g>
      `,
      celebrate: `
        <g class="hb-head">
          <!-- Body -->
          <ellipse cx="28" cy="38" rx="20" ry="16" fill="#1c1712" stroke="#3dd68c" stroke-width="2"/>
          <!-- Belly lantern (bright green celebration) -->
          <ellipse cx="28" cy="40" rx="10" ry="8" fill="#3dd68c" opacity="1" filter="drop-shadow(0 0 20px #3dd68c)"/>
          <!-- Sparkle eyes -->
          <ellipse cx="20" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#3dd68c" stroke-width="2"/>
          <ellipse cx="36" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#3dd68c" stroke-width="2"/>
          <polygon class="sparkle" points="20,30 21,33 24,33 22,35 23,38 20,36 17,38 18,35 16,33 19,33" fill="#ffc47a"/>
          <polygon class="sparkle" points="36,30 37,33 40,33 38,35 39,38 36,36 33,38 34,35 32,33 35,33" fill="#ffc47a"/>
          <!-- Big smile -->
          <path d="M16 42 Q28 50 40 42" stroke="#3dd68c" stroke-width="2" fill="none" stroke-linecap="round"/>
          <!-- Antenna -->
          <line x1="28" y1="20" x2="28" y2="8" stroke="#342c24" stroke-width="2" stroke-linecap="round"/>
          <circle class="hb-antenna-ball" cx="28" cy="6" r="4" fill="#3dd68c" filter="drop-shadow(0 0 8px #3dd68c)"/>
          <!-- Celebration particles -->
          <circle class="particle" cx="10" cy="20" r="2" fill="#ffc47a" opacity="0.8"/>
          <circle class="particle" cx="48" cy="15" r="1.5" fill="#3dd68c" opacity="0.8"/>
          <circle class="particle" cx="5" cy="40" r="2" fill="#ff9a3c" opacity="0.6"/>
        </g>
      `,
      worried: `
        <g class="hb-head">
          <!-- Body -->
          <ellipse cx="28" cy="38" rx="20" ry="16" fill="#1c1712" stroke="#ff5c7a" stroke-width="1.5"/>
          <!-- Belly lantern (flickering) -->
          <ellipse cx="28" cy="40" rx="10" ry="8" fill="#ff5c7a" opacity="0.6" filter="drop-shadow(0 0 8px #ff5c7a)"/>
          <!-- Worried eyes -->
          <ellipse cx="20" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#ff5c7a" stroke-width="1.5"/>
          <ellipse cx="36" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#ff5c7a" stroke-width="1.5"/>
          <path class="worried-brow" d="M16 30 Q20 26 24 30" stroke="#ff5c7a" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path class="worried-brow" d="M32 30 Q36 26 40 30" stroke="#ff5c7a" stroke-width="2" fill="none" stroke-linecap="round"/>
          <circle class="pupil" cx="19" cy="35" r="2" fill="#ff5c7a"/>
          <circle class="pupil" cx="35" cy="35" r="2" fill="#ff5c7a"/>
          <!-- Frown -->
          <path d="M20 42 Q28 38 36 42" stroke="#ff5c7a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <!-- Antenna -->
          <line x1="28" y1="20" x2="28" y2="8" stroke="#342c24" stroke-width="2" stroke-linecap="round"/>
          <circle class="hb-antenna-ball" cx="28" cy="6" r="4" fill="#ff5c7a" filter="drop-shadow(0 0 6px #ff5c7a)"/>
        </g>
      `,
      walk: `
        <g class="hb-head">
          <!-- Body walking -->
          <ellipse cx="28" cy="38" rx="20" ry="16" fill="#1c1712" stroke="#ff9a3c" stroke-width="1.5"/>
          <ellipse cx="28" cy="40" rx="10" ry="8" fill="#ff9a3c" opacity="0.8" filter="drop-shadow(0 0 10px #ff9a3c)"/>
          <ellipse cx="20" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#ff9a3c" stroke-width="1.5"/>
          <ellipse cx="36" cy="34" rx="6" ry="4" fill="#120e0a" stroke="#ff9a3c" stroke-width="1.5"/>
          <circle class="pupil" cx="21" cy="34" r="2.5" fill="#ff9a3c"/>
          <circle class="pupil" cx="37" cy="34" r="2.5" fill="#ff9a3c"/>
          <line x1="28" y1="20" x2="28" y2="8" stroke="#342c24" stroke-width="2" stroke-linecap="round"/>
          <circle class="hb-antenna-ball" cx="28" cy="6" r="4" fill="#ff9a3c" filter="drop-shadow(0 0 6px #ff9a3c)"/>
        </g>
      `
    };

    const stateContent = stateSVGs[this.state] || stateSVGs.think;

    return `
      <svg class="humble-robot humble-robot-${this.state} humble-robot-${this.size}" viewBox="0 0 56 56" width="${size}" height="${size}">
        <defs>
          <style>
            .humble-robot-sleep .bot-sleep-float { animation: float 3s ease-in-out infinite; }
            .humble-robot-think .visor-lenses { animation: scan 2s ease-in-out infinite; }
            .humble-robot-think .pupil { animation: pupil-move 3s ease-in-out infinite; }
            .humble-robot-celebrate .sparkle { animation: sparkle 1s ease-out infinite; }
            .humble-robot-celebrate .particle { animation: particle-float 2s ease-out infinite; }
            .humble-robot-worried .hb-antenna-ball { animation: flicker 0.1s ease-in-out infinite; }
            .hb-eye-blink { transform: scaleY(0.1); transform-origin: center; }
            @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
            @keyframes scan { 0%, 100% { transform: translateX(-2px); } 50% { transform: translateX(2px); } }
            @keyframes pupil-move { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(2px); } 75% { transform: translateX(-2px); } }
            @keyframes sparkle { 0% { transform: scale(1) rotate(0deg); opacity: 1; } 100% { transform: scale(0) rotate(180deg); opacity: 0; } }
            @keyframes particle-float { 0% { transform: translateY(0) scale(1); opacity: 0.8; } 100% { transform: translateY(-20px) scale(0); opacity: 0; } }
            @keyframes flicker { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
            .humble-robot-booting { opacity: 0; animation: crt-boot 420ms steps(5) forwards; }
            @keyframes crt-boot {
              0% { opacity: 0; filter: brightness(0); }
              20% { opacity: 0.8; filter: brightness(2); }
              40% { opacity: 0.2; filter: brightness(0.5); }
              60% { opacity: 0.9; filter: brightness(1.5); }
              80% { opacity: 1; filter: brightness(1); }
              100% { opacity: 1; filter: brightness(1); }
            }
            .humble-robot-scanline { position: absolute; top: 0; left: 0; right: 0; height: 1px; background: #ff9a3c; animation: scanline 300ms linear forwards; }
            @keyframes scanline { 0% { top: 0; opacity: 1; } 100% { top: 100%; opacity: 0; } }
            .humble-robot-flying { will-change: transform, filter; }
          </style>
        </defs>
        ${stateContent}
      </svg>
    `;
  }
}