// Hero Motion Graphic (Zeus)
// Story: Setup steps execute -> Step 2 fails -> Doctor repairs -> Machine discarded -> Replays from zero to VERIFIED.
// Strictly adheres to ANTI_VIBECODE.md (no gradients, sharp 2px corners, real rule wording, no stale status).

export function init(container, { reduced = false } = {}) {
  if (!container) return;

  const steps = [
    { num: '01', cmd: 'git clone https://github.com/GeekyAnts/express-typescript.git' },
    { num: '02', failCmd: 'npm install', fixCmd: 'npm install --legacy-peer-deps' },
    { num: '03', cmd: 'npm run dev' }
  ];

  container.innerHTML = `
    <div class="h-seq" style="padding: 18px 0 10px; display: flex; flex-direction: column; gap: 12px; font-family: var(--mono); font-size: 14px;">
      <div class="h-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 10px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">
        <span class="h-status-text">First run: following README as written</span>
        <span class="h-env-badge" style="padding: 2px 6px; border: 1px solid var(--line); border-radius: var(--r);">Clean Sandbox #1</span>
      </div>

      <div class="h-steps" style="display: flex; flex-direction: column; gap: 8px;">
        ${steps.map((s, i) => `
          <div class="h-step h-step-${i}" style="display: flex; align-items: center; gap: 14px; padding: 10px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); transition: border-color 0.2s ease;">
            <span class="h-step-num" style="color: var(--muted); font-size: 12px;">${s.num}</span>
            <span class="h-step-icon" style="display: inline-block; width: 8px; height: 8px; border-radius: 1px; background: var(--line);"></span>
            <code class="h-step-cmd" style="flex: 1; color: var(--ink); background: none; border: none; padding: 0;">${s.cmd || s.failCmd}</code>
            <span class="h-step-msg" style="font-size: 12px; color: var(--muted);">queued</span>
          </div>
        `).join('')}
      </div>

      <div class="h-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--line); padding-top: 10px; font-size: 13px;">
        <div class="h-diag" style="color: var(--muted); font-size: 13px;">Observing command execution...</div>
        <div class="h-verdict" style="font-weight: 500; color: var(--muted); font-size: 13px;">RUNNING</div>
      </div>

      <div class="h-caption" style="font-size: 12px; color: var(--muted); padding-top: 4px; display: flex; justify-content: space-between; align-items: center;">
        <span>Illustration of a real run pattern · see <a href="/proof" class="link" style="color: var(--ink); text-decoration: underline;">/proof</a> for a recording</span>
        <span class="h-time-indicator" style="font-size: 11px;">53s replay from zero</span>
      </div>
    </div>
  `;

  const statusText = container.querySelector('.h-status-text');
  const envBadge = container.querySelector('.h-env-badge');
  const diag = container.querySelector('.h-diag');
  const verdict = container.querySelector('.h-verdict');
  const stepEls = [
    container.querySelector('.h-step-0'),
    container.querySelector('.h-step-1'),
    container.querySelector('.h-step-2')
  ];

  function setStep(index, state, message, customCmd = null) {
    const el = stepEls[index];
    if (!el) return;
    const icon = el.querySelector('.h-step-icon');
    const msg = el.querySelector('.h-step-msg');
    const cmd = el.querySelector('.h-step-cmd');

    if (customCmd) cmd.textContent = customCmd;

    if (state === 'running') {
      el.style.borderColor = 'var(--muted)';
      icon.style.background = 'var(--muted)';
      msg.textContent = message || 'running...';
      msg.style.color = 'var(--muted)';
    } else if (state === 'pass') {
      el.style.borderColor = 'var(--accent)';
      icon.style.background = 'var(--accent)';
      msg.textContent = message || 'pass';
      msg.style.color = 'var(--accent)';
    } else if (state === 'fail') {
      el.style.borderColor = 'var(--del)';
      icon.style.background = 'var(--del)';
      msg.textContent = message || 'exit 1 (peer conflict)';
      msg.style.color = 'var(--del)';
    } else if (state === 'queued') {
      el.style.borderColor = 'var(--line)';
      icon.style.background = 'var(--line)';
      msg.textContent = message || 'queued';
      msg.style.color = 'var(--muted)';
    }
  }

  // Reduced motion: directly show the final verified zero-break state statically
  if (reduced) {
    statusText.textContent = 'Proven from zero: all setup steps passed';
    envBadge.textContent = 'Clean Sandbox #2';
    envBadge.style.borderColor = 'var(--accent)';
    envBadge.style.color = 'var(--accent)';
    setStep(0, 'pass', '0.2s', steps[0].cmd);
    setStep(1, 'pass', '1.4s', steps[1].fixCmd);
    setStep(2, 'pass', '200 OK (0.8s)', steps[2].cmd);
    diag.textContent = 'GeekyAnts/express-typescript · 1 break fixed · 0 human intervention';
    verdict.textContent = 'VERIFIED';
    verdict.style.color = 'var(--accent)';
    return;
  }

  // Orchestrated narrative cycle
  let activeTimer = null;
  function runCycle() {
    // 0. Reset to Run 1
    statusText.textContent = 'First run: following README as written';
    envBadge.textContent = 'Clean Sandbox #1';
    envBadge.style.borderColor = 'var(--line)';
    envBadge.style.color = 'var(--muted)';
    diag.textContent = 'Following setup steps on clean machine...';
    verdict.textContent = 'RUNNING';
    verdict.style.color = 'var(--muted)';
    setStep(0, 'queued', 'queued', steps[0].cmd);
    setStep(1, 'queued', 'queued', steps[1].failCmd);
    setStep(2, 'queued', 'queued', steps[2].cmd);

    // Timeline sequence
    activeTimer = setTimeout(() => {
      // Step 1 runs & passes
      setStep(0, 'running', 'cloning...');
      activeTimer = setTimeout(() => {
        setStep(0, 'pass', '0.2s');
        setStep(1, 'running', 'resolving tree...');

        // Step 2 fails
        activeTimer = setTimeout(() => {
          setStep(1, 'fail', 'exit 1 (ERESOLVE)');
          diag.textContent = "npm refuses the project's conflicting peer dependencies. Fix: --legacy-peer-deps";
          verdict.textContent = 'FAILED';
          verdict.style.color = 'var(--del)';

          // Discard machine
          activeTimer = setTimeout(() => {
            statusText.textContent = 'Repair applied. Discarding machine...';
            envBadge.textContent = 'Resetting environment';
            diag.textContent = 'Throwing sandbox away. Re-verifying from zero...';

            activeTimer = setTimeout(() => {
              // Replay from zero in Sandbox #2
              statusText.textContent = 'Replay: verifying full guide from zero';
              envBadge.textContent = 'Clean Sandbox #2';
              envBadge.style.borderColor = 'var(--accent)';
              envBadge.style.color = 'var(--accent)';
              // Fix 1: Reset right-hand status immediately to RUNNING, not stale FAILED
              verdict.textContent = 'RUNNING';
              verdict.style.color = 'var(--muted)';
              diag.textContent = 'Replaying all commands in clean sandbox...';

              setStep(0, 'queued', 'queued');
              setStep(1, 'queued', 'queued', steps[1].fixCmd);
              setStep(2, 'queued', 'queued');

              activeTimer = setTimeout(() => {
                setStep(0, 'pass', '0.2s');
                activeTimer = setTimeout(() => {
                  setStep(1, 'pass', '1.4s');
                  activeTimer = setTimeout(() => {
                    setStep(2, 'pass', '200 OK (0.8s)');
                    diag.textContent = 'All steps passed on clean machine. README proven from zero.';
                    // Replay completes: VERIFIED in calm accent green
                    verdict.textContent = 'VERIFIED';
                    verdict.style.color = 'var(--accent)';

                    // Hold on final frame for 7s before gentle seamless cycle
                    activeTimer = setTimeout(runCycle, 7000);
                  }, 600);
                }, 600);
              }, 500);
            }, 1200);
          }, 1800);
        }, 1200);
      }, 700);
    }, 400);
  }

  runCycle();
}
