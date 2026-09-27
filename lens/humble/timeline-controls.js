/**
 * HUMBLE Step Controls & Timeline Scrubber Components
 * Spec: docs/design/HUMBLE_CONSOLE_SPEC.md (Section 15: D1 & D5)
 * D1: DevTools step controls (F5 continue, F10 step, pause-on-failure, gutter breakpoints)
 * D5: rr / Replay.io timeline scrubber with snapshot tooltips and undo-step rewind
 */

/**
 * Spec §15 D1: Create DevTools-style step control bar
 * @param {Object} opts
 * @param {Array<string>} [opts.callstack] - Call stack chain (e.g. ['README.md', 'Setup', 'Step 2'])
 * @param {boolean} [opts.pauseOnFailure=true] - Initial state of pause on failure
 * @param {Function} [opts.onStep] - F10 step over callback
 * @param {Function} [opts.onContinue] - F5 continue callback
 * @param {Function} [opts.onTogglePause] - Toggle callback
 * @returns {HTMLElement}
 */
export function createStepControls(opts = {}) {
  const bar = document.createElement('div');
  bar.className = 'hb-step-controls';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Debugger step controls');

  const callstack = opts.callstack || ['README.md', 'Setup', 'Step 1'];
  const callstackHtml = callstack.map((item, idx) => {
    const isLast = idx === callstack.length - 1;
    const arrow = isLast ? '' : '<span style="color: var(--c-ink-3);">→</span>';
    return `<span class="hb-callstack-item ${isLast ? 'active' : ''}">${escapeHtml(item)}</span> ${arrow}`;
  }).join(' ');

  bar.innerHTML = `
    <div class="hb-step-btn-group">
      <button type="button" class="hb-step-btn" id="hb-btn-continue" title="Run to end (F5)">
        <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>Continue</span>
        <span class="hb-key-badge">F5</span>
      </button>

      <button type="button" class="hb-step-btn" id="hb-btn-step" title="Run this step (F10)">
        <svg viewBox="0 0 24 24"><path d="M19 12l-7-7v4C6 9 3 14 3 20c2-3 5-4.9 9-4.9V19l7-7z"/></svg>
        <span>Step</span>
        <span class="hb-key-badge">F10</span>
      </button>

      <label class="hb-toggle-pill">
        <input type="checkbox" id="hb-pause-on-fail" ${opts.pauseOnFailure !== false ? 'checked' : ''}>
        <span>Pause on failure</span>
      </label>
    </div>

    <div class="hb-callstack">
      ${callstackHtml}
    </div>
  `;

  // Keyboard shortcut listener (F5 & F10)
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F5') {
        e.preventDefault();
        if (typeof opts.onContinue === 'function') opts.onContinue();
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (typeof opts.onStep === 'function') opts.onStep();
      }
    });
  }

  // Button clicks
  const continueBtn = bar.querySelector('#hb-btn-continue');
  if (continueBtn && typeof opts.onContinue === 'function') {
    continueBtn.addEventListener('click', opts.onContinue);
  }

  const stepBtn = bar.querySelector('#hb-btn-step');
  if (stepBtn && typeof opts.onStep === 'function') {
    stepBtn.addEventListener('click', opts.onStep);
  }

  const pauseCheckbox = bar.querySelector('#hb-pause-on-fail');
  if (pauseCheckbox && typeof opts.onTogglePause === 'function') {
    pauseCheckbox.addEventListener('change', (e) => opts.onTogglePause(e.target.checked));
  }

  return bar;
}

/**
 * Spec §15 D5: Create rr/Replay.io-style timeline scrubber
 * @param {Array<Object>} steps - Array of recorded step snapshots
 * @param {Object} [opts]
 * @param {number} [opts.activeIndex=0]
 * @param {Function} [opts.onScrub] - Called when a step pip is scrubbed
 * @param {Function} [opts.onRewind] - Called when rewind action is triggered
 * @returns {HTMLElement}
 */
export function createTimelineScrubber(steps = [], opts = {}) {
  const container = document.createElement('div');
  container.className = 'hb-timeline-scrubber';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Execution timeline scrubber');

  let activeIdx = opts.activeIndex || 0;

  function render() {
    const pipsHtml = steps.map((s, idx) => {
      const isPass = s.status === 'pass' || s.exitCode === 0;
      const isFail = s.status === 'fail' || (s.exitCode !== undefined && s.exitCode !== 0);
      const statusClass = isFail ? 'pip-fail' : (isPass ? 'pip-pass' : '');
      const activeClass = idx === activeIdx ? 'pip-active' : '';

      const dur = s.duration ? `${s.duration}s` : '0.4s';
      const files = s.filesChanged ? `${s.filesChanged} files changed` : 'clean tree';
      const exitText = s.exitCode !== undefined ? `exit ${s.exitCode}` : 'passed';

      return `
        <div class="hb-timeline-pip ${statusClass} ${activeClass}" data-step-idx="${idx}" role="button" tabindex="0" aria-label="Step ${idx + 1}: ${escapeHtml(s.command || '')}">
          <div class="hb-pip-tooltip">
            <div style="font-weight: 600; color: var(--c-core);">$ ${escapeHtml(s.command || `step ${idx + 1}`)}</div>
            <div style="color: var(--c-ink-2);">${exitText} · ${dur} · ${files}</div>
          </div>
        </div>
      `;
    }).join('');

    const activeStep = steps[activeIdx] || {};
    const undoCmd = activeStep.undo || (activeStep.command ? `undo(${activeStep.command})` : null);
    const rewindHtml = undoCmd
      ? `
        <div class="hb-rewind-bar">
          <span style="color: var(--c-ink-2);">Step ${activeIdx + 1} of ${steps.length}: <code style="color: var(--c-core);">$ ${escapeHtml(activeStep.command || '')}</code></span>
          <button type="button" class="hb-rewind-btn" id="hb-rewind-action">↺ rewind using undo steps</button>
        </div>
      `
      : '';

    container.innerHTML = `
      <div class="hb-timeline-header">
        <span>Timeline scrubber (D5)</span>
        <span>${steps.length} steps recorded</span>
      </div>

      <div class="hb-timeline-track">
        <div class="hb-timeline-line"></div>
        ${pipsHtml}
      </div>

      ${rewindHtml}
    `;

    // Pip click events
    container.querySelectorAll('.hb-timeline-pip').forEach(pip => {
      pip.addEventListener('click', () => {
        const idx = parseInt(pip.dataset.stepIdx, 10);
        activeIdx = idx;
        render();
        if (typeof opts.onScrub === 'function') opts.onScrub(idx, steps[idx]);
      });
    });

    // Rewind button
    const rewindBtn = container.querySelector('#hb-rewind-action');
    if (rewindBtn && typeof opts.onRewind === 'function') {
      rewindBtn.addEventListener('click', () => opts.onRewind(activeIdx, steps[activeIdx]));
    }
  }

  render();
  return container;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
