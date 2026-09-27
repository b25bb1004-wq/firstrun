/**
 * HUMBLE Robot Companion Component (Lens & Electron Integration)
 * Controls robot states, antenna colors, speech bubbles, and stage flight.
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

export class HumbleRobot {
  /**
   * @param {HTMLElement} container
   * @param {Object} opts
   * @param {'sm'|'md'|'lg'|'xl'} [opts.size='lg']
   * @param {string} [opts.initialState='sleep']
   * @param {string} [opts.spritePath='./robot.svg']
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.size = opts.size || 'lg';
    this.state = opts.initialState || 'sleep';
    this.spritePath = opts.spritePath || './robot.svg';
    this.agent = null;
    this.init();
  }

  init() {
    this.el = document.createElement('div');
    this.el.className = `humble-robot-wrapper humble-robot-${this.size}`;
    this.render();
    this.container.appendChild(this.el);
  }

  /**
   * Switch the robot's active state
   * @param {string} state - 'sleep' | 'think' | 'walk' | 'point' | 'talk' | 'celebrate' | 'worried'
   * @param {Object} [meta]
   * @param {string} [meta.agent] - Active agent name to tint antenna (harvey, drbo, etc.)
   * @param {string} [meta.say] - Short dialogue text to display
   */
  setState(state, meta = {}) {
    if (!HUMBLE_STATES.includes(state)) {
      console.warn(`[HUMBLE Robot] Unknown state "${state}", defaulting to "think"`);
      state = 'think';
    }
    this.state = state;
    if (meta.agent) this.agent = meta.agent;
    this.render();

    if (meta.say) {
      this.showBubble(meta.say);
    }
  }

  /**
   * Set antenna color explicitly (e.g., active agent indicator)
   * @param {string} colorOrAgent
   */
  setAntennaColor(colorOrAgent) {
    const color = AGENT_COLORS[colorOrAgent.toLowerCase()] || colorOrAgent;
    const bulb = this.el.querySelector('.hb-accent-blue, .hb-antenna-inactive, .hb-antenna-glow');
    if (bulb) {
      bulb.style.fill = color;
    }
  }

  /**
   * Fly robot across the screen to target coordinates (for Guide mode)
   * @param {number} x
   * @param {number} y
   * @param {Object} [options]
   * @param {number} [options.duration=600]
   * @param {Function} [options.onArrive]
   */
  flyTo(x, y, options = {}) {
    const duration = options.duration || 600;
    this.el.classList.add('humble-robot-flying');
    this.setState('walk');

    this.el.style.transition = `left ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1), top ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;

    setTimeout(() => {
      this.el.classList.remove('humble-robot-flying');
      this.setState('point');
      if (typeof options.onArrive === 'function') {
        options.onArrive();
      }
    }, duration);
  }

  showBubble(text) {
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
    }, 4000);
  }

  render() {
    this.el.innerHTML = `
      <svg class="humble-robot humble-robot-${this.state} humble-robot-${this.size}" viewBox="0 0 80 80">
        <use href="${this.spritePath}#hb-robot-${this.state}" />
      </svg>
    `;

    if (this.agent && this.state === 'think') {
      this.setAntennaColor(this.agent);
    }
  }
}
