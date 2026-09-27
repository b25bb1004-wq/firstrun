/**
 * HUMBLE Robot Companion Component (Lens & Electron Integration)
 * Warm amber glowing CRT mascot inspired by 1960s cartoon squash-and-stretch motion.
 * Controls robot states, antenna colors, speech bubbles, and arced stage flight.
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

export class HumbleRobot {
  /**
   * @param {HTMLElement} container - DOM container element
   * @param {Object} [opts]
   * @param {'24'|'56'|'96'|'256'|'xs'|'sm'|'md'|'lg'|'xl'} [opts.size='96']
   * @param {string} [opts.initialState='sleep']
   * @param {string} [opts.spritePath='./robot.svg']
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.size = String(opts.size || '96');
    this.state = opts.initialState || 'sleep';
    this.spritePath = opts.spritePath || './robot.svg';
    this.agent = null;
    this.x = 0;
    this.y = 0;
    this._bubbleTimer = null;
    this.init();
  }

  init() {
    this.el = document.createElement('div');
    this.el.className = `humble-robot-wrapper humble-robot-${this.size}`;
    this.el.setAttribute('role', 'img');
    this.el.setAttribute('aria-label', `HUMBLE Robot (${this.state})`);
    this.render();
    this.container.appendChild(this.el);
  }

  /**
   * Switch the robot's active state
   * @param {string} state - 'sleep' | 'think' | 'walk' | 'point' | 'talk' | 'celebrate' | 'worried'
   * @param {Object} [meta]
   * @param {string} [meta.agent] - Active agent name to tint antenna
   * @param {string} [meta.say] - Short dialogue text to display
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
   * Set agent antenna color
   * @param {string} agentName - 'harvey' | 'unity' | 'mach' | 'drbo' | 'larp' | 'echo' | 'vigil'
   */
  setAgent(agentName) {
    this.agent = agentName.toLowerCase();
    const color = AGENT_COLORS[this.agent] || AGENT_COLORS.default;
    this.setAntennaColor(color);
  }

  /**
   * Set antenna color explicitly
   * @param {string} colorOrAgent
   */
  setAntennaColor(colorOrAgent) {
    const color = AGENT_COLORS[colorOrAgent.toLowerCase()] || colorOrAgent;
    const bulb = this.el.querySelector('.hb-antenna-ball, .antenna-ball-think, circle[cx="93"][cy="2"]');
    if (bulb) {
      bulb.style.fill = color;
      bulb.style.filter = `drop-shadow(0 0 6px ${color})`;
    }
  }

  /**
   * Display speech dialogue bubble above mascot
   * @param {string} text
   * @param {number} [duration=3500]
   */
  say(text, duration = 3500) {
    let bubble = this.el.querySelector('.humble-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'humble-bubble';
      this.el.appendChild(bubble);
    }
    bubble.textContent = text;
    bubble.classList.add('visible');

    clearTimeout(this._bubbleTimer);
    this._bubbleTimer = setTimeout(() => {
      bubble.classList.remove('visible');
    }, duration);
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
   * Fly robot across the screen to target coordinates in an arced trajectory
   * with 1960s cartoon anticipation, stretch, and landing squash.
   * @param {number} targetX
   * @param {number} targetY
   * @param {Object} [options]
   * @param {number} [options.duration]
   * @param {Function} [options.onArrive]
   * @returns {Promise<void>}
   */
  async flyTo(targetX, targetY, options = {}) {
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startX = this.x;
    const startY = this.y;
    const dist = Math.hypot(targetX - startX, targetY - startY);
    const duration = options.duration || Math.min(900, Math.max(380, Math.round(dist * 0.75)));

    this.el.classList.add('humble-robot-flying');

    if (reduced) {
      this.x = targetX;
      this.y = targetY;
      this.el.style.transform = `translate(${targetX}px, ${targetY}px)`;
      this.el.classList.remove('humble-robot-flying');
      this.setState('point');
      if (typeof options.onArrive === 'function') options.onArrive();
      return;
    }

    // 1. Anticipation squash
    this.setState('think');
    if (this.el.animate) {
      await this.el.animate([
        { transform: `translate(${startX}px, ${startY}px) scale(1, 1)` },
        { transform: `translate(${startX}px, ${startY + 6}px) scale(1.1, 0.88)` }
      ], { duration: 120, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }).finished;
    }

    // 2. Arced trajectory keyframes (quadratic bezier)
    this.setState('walk');
    const midX = (startX + targetX) / 2;
    const midY = Math.min(startY, targetY) - Math.min(140, Math.max(50, dist * 0.35));

    const keyframes = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const px = Math.round(u * u * startX + 2 * u * t * midX + t * t * targetX);
      const py = Math.round(u * u * startY + 2 * u * t * midY + t * t * targetY);
      keyframes.push({ transform: `translate(${px}px, ${py}px)` });
    }

    if (this.el.animate) {
      await this.el.animate(keyframes, {
        duration,
        easing: 'cubic-bezier(0.45, 0, 0.2, 1)',
        fill: 'forwards'
      }).finished;
    }

    this.x = targetX;
    this.y = targetY;
    this.el.style.transform = `translate(${targetX}px, ${targetY}px)`;
    this.el.classList.remove('humble-robot-flying');

    // 3. Landing squash & settle
    if (this.el.animate) {
      await this.el.animate([
        { transform: `translate(${targetX}px, ${targetY}px) scale(1.1, 0.9)` },
        { transform: `translate(${targetX}px, ${targetY}px) scale(1, 1)` }
      ], { duration: 220, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' }).finished;
    }

    // 4. Point to the arrived position
    this.setState('point');
    if (typeof options.onArrive === 'function') {
      options.onArrive();
    }
  }

  render() {
    this.el.innerHTML = `
      <svg class="humble-robot humble-robot-${this.state} humble-robot-${this.size}" viewBox="0 0 200 250">
        <use href="${this.spritePath}#hb-robot-${this.state}" />
      </svg>
    `;

    if (this.agent) {
      this.setAgent(this.agent);
    }
  }
}
