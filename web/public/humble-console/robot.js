/**
 * HUMBLE Robot Companion Component (Web Console Integration)
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
   * Spec Section 5: IRIS-SHUTTER Boot Sequence (first open only)
   * 5 blades open over 420ms (steps), while belly lantern warms from 0 to full glow.
   * Lenses focus last with one iris blink (120ms).
   * @returns {Promise<void>}
   */
  async boot() {
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.setState('talk');
      return;
    }

    this.el.classList.add('humble-robot-booting');
    
    // Lantern warm-up 0 to full glow over 420ms
    const lantern = this.el.querySelector('path[fill*="lantern"], circle[filter*="blur"]');
    if (lantern && lantern.animate) {
      lantern.animate([
        { opacity: 0.1, filter: 'brightness(0.2)' },
        { opacity: 0.4, filter: 'brightness(0.6)' },
        { opacity: 1, filter: 'brightness(1)' }
      ], { duration: 420, easing: 'steps(5)' });
    }

    await new Promise(r => setTimeout(r, 420));
    this.el.classList.remove('humble-robot-booting');

    // Lenses focus last with one iris blink (120ms)
    this.blink();
    this.setState('talk');
  }

  /**
   * Spec Section 5: Idle Life
   * Random iris close/open blinks every 3-6s (120ms)
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
   * Quick iris blink (120ms)
   */
  blink() {
    const eyes = this.el.querySelectorAll('circle[cx="83"], circle[cx="117"], path[d*="77 Q83"]');
    eyes.forEach(eye => {
      eye.classList.remove('hb-eye-blink');
      void eye.offsetWidth; // trigger reflow
      eye.classList.add('hb-eye-blink');
      setTimeout(() => eye.classList.remove('hb-eye-blink'), 120);
    });
  }

  /**
   * Spec Section 5: Visor lenses swivel toward new terminal line (150ms)
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
   * Spec Section 5: Signature Peek Move
   * Eyestalk telescopes up and leans toward something new: 280ms out, 200ms back.
   * @returns {Promise<void>}
   */
  async peek() {
    this.setState('think');
    const head = this.el.querySelector('.bot-head-think, .hb-head, .bot-sleep-float, .bot-point-float');
    if (head && head.animate) {
      await head.animate([
        { transform: 'translateY(0) scaleY(1)' },
        { transform: 'translateY(-16px) scaleY(1.12)' },
        { transform: 'translateY(0) scaleY(1)' }
      ], {
        duration: 480, // 280ms out, 200ms back
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }).finished;
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
   * Set active agent cartridge color (§5)
   * The backpack cartridge for the active agent glows when that agent's line prints.
   * @param {string} agentName - 'harvey' | 'unity' | 'mach' | 'drbo' | 'larp' | 'echo' | 'vigil'
   */
  setAgent(agentName) {
    this.agent = agentName.toLowerCase();
    const color = AGENT_COLORS[this.agent] || AGENT_COLORS.default;
    this.setAntennaColor(color);

    // Highlight specific cartridge on backpack
    const cartridges = this.el.querySelectorAll('rect[width="7"][height="12"]');
    const agentMap = { harvey: 0, unity: 1, mach: 2, drbo: 3, larp: 4, echo: 5 };
    const targetIdx = agentMap[this.agent];

    cartridges.forEach((c, idx) => {
      if (idx === targetIdx) {
        c.style.opacity = '1';
        c.style.filter = `drop-shadow(0 0 6px ${color})`;
      } else {
        c.style.opacity = '0.4';
        c.style.filter = 'none';
      }
    });
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
   * @param {number} targetX
   * @param {number} targetY
   * @param {Object} [options]
   * @param {string} [options.say] - Text to type upon arrival
   * @param {boolean} [options.returnHome=false]
   * @param {Function} [options.onArrive]
   * @returns {Promise<void>}
   */
  flyTo(targetX, targetY, options = {}) {
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startX = this.x;
    const startY = this.y;

    if (reduced) {
      this.x = targetX;
      this.y = targetY;
      this.el.style.transform = `translate(${targetX}px, ${targetY}px)`;
      this.setState('point');
      if (options.say) this.say(options.say);
      if (typeof options.onArrive === 'function') options.onArrive();
      return Promise.resolve();
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

  /**
   * Calculate lantern center coordinates in viewport space (§6)
   * The Lamplighter belly lantern sits at ~50% x, ~65% y of the body.
   */
  getLanternPosition() {
    if (!this.el || typeof this.el.getBoundingClientRect !== 'function') {
      return { x: this.x + 48, y: this.y + 60 };
    }
    const rect = this.el.getBoundingClientRect();
    return {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.65
    };
  }

  /**
   * Pointing = the lantern BEAM (§6):
   * A soft cone (linear-gradient, 18% --c-hi to transparent) from the lantern
   * to the target line, fading in over 180ms on arrival and out with the bubble;
   * the target line gets a 2px --c-core left bar while lit.
   *
   * @param {HTMLElement|{x: number, y: number, width?: number, height?: number}} target
   */
  showBeam(target) {
    if (typeof document === 'undefined') return;
    this.setState('point');
    const lantern = this.getLanternPosition();

    let targetBounds = null;
    if (target && typeof target.getBoundingClientRect === 'function') {
      const r = target.getBoundingClientRect();
      targetBounds = { x: r.left, y: r.top, width: r.width, height: r.height };
      target.classList.add('humble-target-lit');
      target.setAttribute('data-humble-lit', 'true');
      this._litElement = target;
    } else if (target && typeof target.x === 'number') {
      targetBounds = {
        x: target.x,
        y: target.y,
        width: target.width || 200,
        height: target.height || 24
      };
    } else {
      targetBounds = { x: lantern.x + 80, y: lantern.y, width: 120, height: 20 };
    }

    if (!this._beamSvg) {
      this._beamSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this._beamSvg.setAttribute('class', 'humble-beam-svg');
      this._beamSvg.setAttribute('aria-hidden', 'true');
      this._beamSvg.innerHTML = `
        <defs>
          <linearGradient id="hb-beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="var(--c-hi, #ffc47a)" stop-opacity="0.28" />
            <stop offset="70%" stop-color="var(--c-core, #ff9a3c)" stop-opacity="0.08" />
            <stop offset="100%" stop-color="var(--c-core, #ff9a3c)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon class="humble-beam-cone" />
      `;
      document.body.appendChild(this._beamSvg);
    }

    const poly = this._beamSvg.querySelector('.humble-beam-cone');
    if (poly) {
      const pTop = `${targetBounds.x},${targetBounds.y}`;
      const pBottom = `${targetBounds.x},${targetBounds.y + targetBounds.height}`;
      poly.setAttribute('points', `${lantern.x},${lantern.y} ${pTop} ${pBottom}`);
    }

    this._beamSvg.classList.add('visible');
    this._beamSvg.style.opacity = '1';
  }

  /**
   * Hide the lantern BEAM and remove lit highlight from target
   */
  hideBeam() {
    if (this._beamSvg) {
      this._beamSvg.classList.remove('visible');
      this._beamSvg.style.opacity = '0';
    }
    if (this._litElement) {
      this._litElement.classList.remove('humble-target-lit');
      this._litElement.removeAttribute('data-humble-lit');
      this._litElement = null;
    }
  }

  /**
   * Point at a target line or element with the full Clicky sequence (§6):
   * 1. Eyestalk peek (280ms out, 200ms back)
   * 2. Fly to target line
   * 3. On arrival, show lantern BEAM (180ms fade in) and light target line (2px left bar)
   * 4. Type speech bubble text
   * 5. Hold 3s, fade out bubble AND fade out beam together
   * 6. Return home if options.returnHome is set
   *
   * @param {HTMLElement|{x: number, y: number, width?: number, height?: number}} target
   * @param {Object} [options]
   * @param {string} [options.say]
   * @param {number} [options.holdMs=3000]
   * @param {boolean} [options.returnHome=false]
   */
  async pointAt(target, options = {}) {
    let targetX = this.x;
    let targetY = this.y;

    if (target && typeof target.getBoundingClientRect === 'function') {
      const r = target.getBoundingClientRect();
      targetX = r.left - 60;
      targetY = r.top - 20;
    } else if (target && typeof target.x === 'number') {
      targetX = target.x - 60;
      targetY = target.y - 20;
    }

    // Peek eyestalk before flight (§5 signature move: 280ms out, 200ms back)
    await this.peek();

    // Fly to target
    await this.flyTo(targetX, targetY, {
      onArrive: () => {
        this.showBeam(target);
      }
    });

    if (options.say) {
      await this.say(options.say, options.holdMs || 3000);
    }

    this.hideBeam();

    if (options.returnHome) {
      await this.returnHome();
    }
  }

  /**
   * Spatial Context: Show 2px --c-core rounded outline with soft glow (§17)
   * @param {{x: number, y: number, width: number, height: number}} bounds
   */
  showSpatialTarget(bounds) {
    if (typeof document === 'undefined') return;
    if (!this._spatialTargetBox) {
      this._spatialTargetBox = document.createElement('div');
      this._spatialTargetBox.className = 'humble-spatial-target-box';
      document.body.appendChild(this._spatialTargetBox);
    }
    this._spatialTargetBox.style.left = `${bounds.x || bounds.left || 0}px`;
    this._spatialTargetBox.style.top = `${bounds.y || bounds.top || 0}px`;
    this._spatialTargetBox.style.width = `${bounds.width || 100}px`;
    this._spatialTargetBox.style.height = `${bounds.height || 40}px`;
    this._spatialTargetBox.classList.add('visible');
  }

  /**
   * Spatial Context: Hide spatial target outline (§17)
   */
  hideSpatialTarget() {
    if (this._spatialTargetBox) {
      this._spatialTargetBox.classList.remove('visible');
    }
  }

  /**
   * Spatial Context: 1s amber capture flash around the captured window (§17)
   * @param {{x?: number, y?: number, width?: number, height?: number}} bounds
   */
  triggerCaptureFlash(bounds = {}) {
    if (typeof document === 'undefined') return;
    const flash = document.createElement('div');
    flash.className = 'humble-spatial-capture-flash';
    flash.style.left = `${bounds.x || bounds.left || 0}px`;
    flash.style.top = `${bounds.y || bounds.top || 0}px`;
    flash.style.width = `${bounds.width || (typeof window !== 'undefined' ? window.innerWidth : 800)}px`;
    flash.style.height = `${bounds.height || (typeof window !== 'undefined' ? window.innerHeight : 600)}px`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1000);
  }

  /**
   * Spatial Context: create 'looked at: Windows Terminal' chip for console header (§17)
   * @param {string} windowTitle
   * @returns {HTMLElement}
   */
  createLookedAtChip(windowTitle) {
    const chip = document.createElement('span');
    chip.className = 'humble-looked-at-chip';
    const textNode = document.createTextNode(`👁 looked at: ${windowTitle || 'window'}`);
    chip.appendChild(textNode);
    return chip;
  }

  render() {
    this.el.innerHTML = `
      <svg class="humble-robot humble-robot-${this.state} humble-robot-${this.size}" viewBox="${this.state === 'celebrate' ? '0 -25 200 275' : '0 0 200 250'}">
        <use href="${this.spritePath}#hb-robot-${this.state}" />
      </svg>
    `;

    if (this.agent) {
      this.setAgent(this.agent);
    }
  }
}