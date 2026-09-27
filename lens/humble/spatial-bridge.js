// lens/humble/spatial-bridge.js — wires Edith's spatial state ({ spatial }: target.overlay, target.box, lookedAt)
// into the console and dock UIs per Section 17 of HUMBLE_CONSOLE_SPEC.

/**
 * Handle incoming spatial state from window.dock IPC (pushState { spatial })
 *
 * @param {Object} spatial
 * @param {boolean} spatial.ok
 * @param {string} [spatial.reason]
 * @param {string} [spatial.how]
 * @param {{ app: string, title: string }} [spatial.lookedAt]
 * @param {{ kind: string, id: string, text: string, box: {x:number, y:number, width:number, height:number}, beam?: {x:number, y:number}, overlay?: {x:number, y:number} }} [spatial.target]
 * @param {Array} [spatial.captures]
 * @param {Object} [options]
 * @param {import('./robot.js').HumbleRobot} [options.mascot]
 * @param {HTMLElement} [options.headerEl]
 * @param {HTMLElement} [options.statusEl]
 * @param {number} [options.holdMs=3000]
 * @returns {{ ok: boolean, lookedAt?: Object, target?: Object, reason?: string, chipEl?: HTMLElement }}
 */
export function handleSpatialState(spatial, options = {}) {
  if (!spatial) return { ok: false, reason: 'no spatial state' };

  const mascot = options.mascot || (typeof window !== 'undefined' ? window.mascot : null);
  const holdMs = options.holdMs || 3000;
  let chipEl = null;

  // 1. Looked At Chip: '👁 looked at: Windows Terminal' in header
  if (spatial.lookedAt) {
    const windowName = spatial.lookedAt.app || spatial.lookedAt.title || 'window';
    chipEl = updateLookedAtChip(windowName, options.headerEl);
  }

  // 2. Spatial Target & Lantern BEAM
  if (spatial.ok && spatial.target) {
    const target = spatial.target;

    // Show 2px --c-core rounded outline box around matched on-screen area
    if (target.box && mascot?.showSpatialTarget) {
      mascot.showSpatialTarget(target.box);
    }

    // 1s amber window capture flash around the captured window/box
    if (target.box && mascot?.triggerCaptureFlash) {
      mascot.triggerCaptureFlash(target.box);
    }

    // Aim lantern BEAM at overlay target coordinates (or box / beam)
    const beamCoords = target.overlay || target.beam || (target.box ? {
      x: target.box.x + (target.box.width ? target.box.width / 2 : 0),
      y: target.box.y,
    } : null);

    if (beamCoords && mascot?.showBeam) {
      mascot.showBeam(beamCoords);
    }

    // Optional voice / bubble from Lamplighter
    if (target.text && mascot?.say) {
      const snippet = target.text.length > 40 ? `${target.text.slice(0, 37)}…` : target.text;
      mascot.say(`I see: ${snippet}`, holdMs);
    }

    // Auto-hide beam & spatial target after hold time
    if (holdMs > 0 && mascot) {
      setTimeout(() => {
        mascot.hideBeam?.();
        mascot.hideSpatialTarget?.();
      }, holdMs);
    }

    if (options.statusEl) {
      options.statusEl.textContent = `Screen verified · ${spatial.how || 'OCR'}`;
    }
  } else if (spatial.ok === false) {
    // Window moved, denied, or not found
    if (mascot?.setState) {
      mascot.setState('worried');
    }
    if (spatial.reason && mascot?.say) {
      mascot.say(spatial.reason, holdMs);
    }
    if (options.statusEl) {
      options.statusEl.textContent = `Spatial look failed: ${spatial.reason || 'unknown'}`;
    }
  }

  return {
    ok: Boolean(spatial.ok),
    lookedAt: spatial.lookedAt,
    target: spatial.target,
    reason: spatial.reason,
    chipEl,
  };
}

/**
 * Creates or updates the 'looked at' chip in the header element
 * @param {string} windowName
 * @param {HTMLElement} [headerEl]
 * @returns {HTMLElement}
 */
export function updateLookedAtChip(windowName, headerEl) {
  if (typeof document === 'undefined') return null;

  const targetHeader = headerEl
    || document.querySelector('.dock-title-wrap')
    || document.querySelector('.header-text')
    || document.querySelector('.console-header')
    || document.body;

  let chip = targetHeader.querySelector('.humble-looked-at-chip');
  if (!chip) {
    chip = document.createElement('span');
    chip.className = 'humble-looked-at-chip';
    chip.setAttribute('role', 'status');
    chip.setAttribute('aria-label', `Looked at screen: ${windowName}`);
    targetHeader.appendChild(chip);
  }

  chip.textContent = `👁 looked at: ${windowName}`;
  chip.classList.add('visible');
  return chip;
}

/**
 * Connect the Dock or Console UI to window.dock spatial IPC
 *
 * @param {Object} dockBridge - window.dock object
 * @param {Object} options
 * @param {HTMLElement} [options.buttonEl] - 'Look at screen' button
 * @param {HTMLElement} [options.headerEl] - Header container for looked-at chip
 * @param {HTMLElement} [options.statusEl] - Subtitle / status element
 * @param {import('./robot.js').HumbleRobot} [options.mascot] - Mascot instance
 * @returns {{ look: Function, destroy: Function }}
 */
export function attachSpatialDock(dockBridge, options = {}) {
  const bridge = dockBridge || (typeof window !== 'undefined' ? window.dock : null);

  const doLook = async (want = { role: 'terminal' }) => {
    if (options.buttonEl) {
      options.buttonEl.disabled = true;
      options.buttonEl.classList.add('scanning');
    }

    try {
      if (bridge?.look) {
        const res = await bridge.look(want);
        handleSpatialState(res, options);
        return res;
      }
      // Demo / browser preview fallback (§17: replay recorded spatial moment from demo machine)
      const mockResult = {
        ok: true,
        how: 'rule',
        lookedAt: { app: 'WindowsTerminal', title: 'C:\\Code\\acme-shop' },
        target: {
          kind: 'box',
          id: 'B1',
          text: 'npm ERR! code EBADENGINE',
          box: { x: 200, y: 150, width: 420, height: 32 },
          overlay: { x: 410, y: 166 },
        },
      };
      handleSpatialState(mockResult, options);
      return mockResult;
    } catch (e) {
      handleSpatialState({ ok: false, reason: e.message }, options);
      return { ok: false, reason: e.message };
    } finally {
      if (options.buttonEl) {
        options.buttonEl.disabled = false;
        options.buttonEl.classList.remove('scanning');
      }
    }
  };

  if (options.buttonEl) {
    options.buttonEl.addEventListener('click', () => doLook());
  }

  // Hook into onState if available
  let unhookState = null;
  if (bridge?.onState) {
    unhookState = bridge.onState((state) => {
      if (state?.spatial) {
        handleSpatialState(state.spatial, options);
      }
    });
  }

  return {
    look: doLook,
    destroy: () => {
      if (typeof unhookState === 'function') unhookState();
    },
  };
}

// Global exposure for browser scripts without module loaders
if (typeof window !== 'undefined') {
  window.HumbleSpatial = {
    handleSpatialState,
    updateLookedAtChip,
    attachSpatialDock,
  };
}
