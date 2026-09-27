/**
 * HUMBLE Debugger Sub-panel & Security Guard UI Component
 * Spec: docs/design/HUMBLE_CONSOLE_SPEC.md (Sections 13 & 14)
 * Collapsible debug panels, host vs proven diffs, doctor rule alignment,
 * security guard shield with pulse, and verdict chips.
 */

/**
 * Spec Section 14: Render verdict chip for a command
 * @param {'ok'|'warn'|'block'} verdict
 * @param {string} [reason]
 * @returns {HTMLElement}
 */
export function createVerdictChip(verdict, reason = '') {
  const chip = document.createElement('span');
  chip.className = `hb-verdict-chip chip-${verdict}`;
  chip.setAttribute('data-verdict', verdict);

  if (verdict === 'warn') {
    chip.textContent = reason ? `warn: ${reason}` : 'warn';
  } else if (verdict === 'block') {
    chip.textContent = reason ? `blocked: ${reason}` : 'blocked';
  } else {
    chip.textContent = 'ok';
  }

  return chip;
}

/**
 * Spec Section 14: Security Guard Shield & Audit Log Badge
 * @param {Object} stats
 * @param {number} stats.commandsRun
 * @param {number} stats.blocked
 * @param {number} stats.warned
 * @param {number} stats.secretsShown
 * @returns {HTMLElement}
 */
export function createGuardBadge(stats = { commandsRun: 0, blocked: 0, warned: 0, secretsShown: 0 }) {
  const badge = document.createElement('div');
  badge.className = 'hb-guard-badge';
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-label', 'Security Guard Status');

  const shieldClass = stats.blocked > 0 ? 'shield-blocked' : (stats.warned > 0 ? 'shield-warn' : '');

  badge.innerHTML = `
    <svg class="hb-guard-shield ${shieldClass}" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
    <span class="hb-guard-stats">
      ${stats.commandsRun} run · ${stats.blocked} blocked · ${stats.warned} warned · ${stats.secretsShown} secrets shown
    </span>
  `;

  return badge;
}

/**
 * Spec Section 13: Create Debugger Sub-panel inside the terminal
 * @param {Object} ctx
 * @param {number} ctx.step - Failing step index
 * @param {string} ctx.command - Failing command string
 * @param {string} ctx.log - Failing stdout/stderr log tail
 * @param {Array<string>} [ctx.hostVsProof] - Diff lines against proven run
 * @param {string} [ctx.ruleId] - Matched doctor rule ID
 * @param {string} [ctx.matchedLine] - Exact output line matched
 * @param {Object} [ctx.fix] - Proposed fix
 * @param {string} ctx.fix.command - Repair command
 * @param {string} ctx.fix.why - Explanation
 * @param {Object} [options]
 * @param {import('./robot.js').HumbleRobot} [options.mascot] - Mascot instance to aim lantern BEAM
 * @param {Function} [options.onRunFix] - Callback when user runs the fix
 * @returns {HTMLElement}
 */
export function createDebuggerPanel(ctx, options = {}) {
  const panel = document.createElement('div');
  panel.className = 'hb-debugger-panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', `Debug step ${ctx.step}`);

  const diffRows = (ctx.hostVsProof && ctx.hostVsProof.length)
    ? ctx.hostVsProof.map(d => `<div class="hb-dbg-diff-row"><span class="hb-dbg-tag">[DEBUG]</span>${escapeHtml(d)}</div>`).join('')
    : '<div class="hb-dbg-diff-row" style="color: var(--c-ink-2);">No environment discrepancies detected</div>';

  const matchedLineHtml = ctx.matchedLine
    ? `<div class="hb-dbg-beam-target" id="dbg-beam-target"><span>${escapeHtml(ctx.matchedLine)}</span></div>`
    : '';

  const fixBoxHtml = ctx.fix
    ? `
      <div class="hb-dbg-fix-box">
        <div class="hb-dbg-fix-cmd">$ ${escapeHtml(ctx.fix.command)}</div>
        <div class="hb-dbg-fix-why">${escapeHtml(ctx.fix.why)}</div>
        <div class="hb-dbg-fix-actions">
          <button type="button" class="hb-dbg-action-btn" id="hb-dbg-run-fix">Run fix</button>
          <button type="button" class="hb-dbg-action-btn secondary" id="hb-dbg-copy-fix">Copy</button>
        </div>
      </div>
    `
    : '<div style="color: var(--c-ink-2); font-size: 11px;">No automated doctor fix available (requires human review)</div>';

  panel.innerHTML = `
    <div class="hb-dbg-header">
      <span class="hb-dbg-title">DEBUG · STEP ${ctx.step} · ${escapeHtml(ctx.command)}</span>
      <button type="button" class="hb-dbg-copy-btn" id="hb-dbg-copy-report">copy debug report</button>
    </div>

    <!-- Section 1: What happened (open by default) -->
    <details class="hb-dbg-section" open>
      <summary>what happened</summary>
      <div class="hb-dbg-content">
        <pre class="hb-dbg-log">${escapeHtml(ctx.log || 'Command exited with failure')}</pre>
      </div>
    </details>

    <!-- Section 2: Different from the proven run (open by default) -->
    <details class="hb-dbg-section" open>
      <summary>different from the proven run</summary>
      <div class="hb-dbg-content">
        ${diffRows}
      </div>
    </details>

    <!-- Section 3: Likely cause (open by default) -->
    <details class="hb-dbg-section" open>
      <summary>likely cause</summary>
      <div class="hb-dbg-content">
        <div class="hb-dbg-rule">Diagnosed rule: <strong>${escapeHtml(ctx.ruleId || 'generic-failure')}</strong></div>
        ${matchedLineHtml}
      </div>
    </details>

    <!-- Section 4: Proposed Fix -->
    <details class="hb-dbg-section" open>
      <summary>fix</summary>
      <div class="hb-dbg-content">
        ${fixBoxHtml}
      </div>
    </details>
  `;

  // Mascot lantern BEAM alignment onto matched line
  if (options.mascot && ctx.matchedLine) {
    setTimeout(() => {
      const target = panel.querySelector('#dbg-beam-target');
      if (target) {
        options.mascot.setState('point');
      }
    }, 200);
  }

  // Copy debug report button
  const copyReportBtn = panel.querySelector('#hb-dbg-copy-report');
  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const diffText = (ctx.hostVsProof && ctx.hostVsProof.length)
        ? ctx.hostVsProof.map(d => `- ${d}`).join('\n')
        : '- none';

      const markdown = [
        `### HUMBLE Debug Report — Step ${ctx.step}`,
        `- **Command**: \`${ctx.command}\``,
        `- **Log**:`,
        '```',
        ctx.log || 'exit 1',
        '```',
        `- **Differences from Proven Run**:`,
        diffText,
        `- **Diagnosed Rule**: \`${ctx.ruleId || 'none'}\``,
        `- **Proposed Fix**: \`${ctx.fix?.command || 'manual intervention'}\``
      ].join('\n');

      if (navigator.clipboard) {
        navigator.clipboard.writeText(markdown);
        copyReportBtn.textContent = 'copied!';
        setTimeout(() => copyReportBtn.textContent = 'copy debug report', 2000);
      }
    });
  }

  // Copy fix command
  const copyFixBtn = panel.querySelector('#hb-dbg-copy-fix');
  if (copyFixBtn && ctx.fix) {
    copyFixBtn.addEventListener('click', () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(ctx.fix.command);
        copyFixBtn.textContent = 'copied!';
        setTimeout(() => copyFixBtn.textContent = 'Copy', 2000);
      }
    });
  }

  // Run fix action
  const runFixBtn = panel.querySelector('#hb-dbg-run-fix');
  if (runFixBtn && typeof options.onRunFix === 'function') {
    runFixBtn.addEventListener('click', async () => {
      runFixBtn.disabled = true;
      runFixBtn.textContent = 'Applying fix…';
      try {
        const passed = await options.onRunFix(ctx.fix);
        if (passed) {
          panel.classList.add('verified');
          runFixBtn.textContent = '✓ Verified';
          if (options.mascot) {
            options.mascot.setState('celebrate');
          }
        } else {
          runFixBtn.disabled = false;
          runFixBtn.textContent = 'Retry fix';
          if (options.mascot) {
            options.mascot.setState('worried');
          }
        }
      } catch (err) {
        runFixBtn.disabled = false;
        runFixBtn.textContent = 'Failed';
      }
    });
  }

  return panel;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
