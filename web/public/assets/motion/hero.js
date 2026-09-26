// Hero Motion Graphic (Zeus)
// Story: Setup steps execute -> Step 2 fails -> Doctor repairs -> Machine discarded -> Replays from zero to VERIFIED.
// Retinted with Agent Identity System (Karmanya/Edith 16:40):
// Scout #4f8cff ● circle · Planner #1b2bb8 ■ square · Runner #ff8a3d ▲ triangle
// Doctor #ff5c7a + plus · Verifier #2fbf85 ◯ ring · Scribe #f5c542 ◆ diamond.

export function init(container, { reduced = false } = {}) {
  if (!container) return;

  const steps = [
    { num: '01', agent: 'Scout', shape: '●', color: 'var(--c-scout, #4f8cff)', cmd: 'git clone https://github.com/GeekyAnts/express-typescript.git' },
    { num: '02', agent: 'Doctor', shape: '+', color: 'var(--c-doctor, #ff5c7a)', failCmd: 'npm install', fixCmd: 'npm install --legacy-peer-deps' },
    { num: '03', agent: 'Verifier', shape: '◯', color: 'var(--c-verifier, #2fbf85)', cmd: 'npm run dev' }
  ];

  container.innerHTML = `
    <div class="h-seq" style="padding: 18px 0 10px; display: flex; flex-direction: column; gap: 12px; font-family: var(--mono); font-size: 14px;">
      <div class="h-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 10px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <canvas class="h-live-orb" width="20" height="20" style="width: 20px; height: 20px; border-radius: 50%; display: block;"></canvas>
          <span class="h-status-text">First run: following README as written</span>
        </div>
        <span class="h-env-badge" style="padding: 2px 8px; border: 1px solid var(--line); border-radius: var(--r); font-size: 12px;">Clean Sandbox #1</span>
      </div>

      <div class="h-steps" style="display: flex; flex-direction: column; gap: 8px;">
        ${steps.map((s, i) => `
          <div class="h-step h-step-${i}" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); transition: border-color 0.2s var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1));">
            <span class="h-step-badge" style="font-size: 11px; padding: 2px 6px; border-radius: 2px; border: 1px solid var(--line); color: ${s.color}; display: flex; align-items: center; gap: 4px;">
              <span>${s.shape}</span>
              <span>${s.num}</span>
            </span>
            <span class="h-step-icon" style="display: inline-block; width: 8px; height: 8px; border-radius: 1px; background: var(--line); transition: background-color 0.2s var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1));"></span>
            <code class="h-step-cmd" style="flex: 1; color: var(--ink); background: none; border: none; padding: 0;">${s.cmd || s.failCmd}</code>
            <span class="h-step-msg" style="font-size: 12px; color: var(--muted); transition: color 0.2s var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1));">queued</span>
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
  const liveCanvas = container.querySelector('.h-live-orb');
  let heroOrb = null;
  if (typeof window !== 'undefined' && window.ThinkingOrb && liveCanvas) {
    heroOrb = window.ThinkingOrb.create(liveCanvas, { state: 'searching', size: 20 });
  }
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
    const stepColor = steps[index].color;

    if (customCmd) cmd.textContent = customCmd;

    if (state === 'running') {
      el.style.borderColor = stepColor;
      icon.style.background = stepColor;
      msg.textContent = message || 'running...';
      msg.style.color = stepColor;
    } else if (state === 'pass') {
      el.style.borderColor = stepColor;
      icon.style.background = stepColor;
      msg.textContent = message || 'pass';
      msg.style.color = stepColor;
    } else if (state === 'fail') {
      el.style.borderColor = 'var(--c-doctor, #ff5c7a)';
      icon.style.background = 'var(--c-doctor, #ff5c7a)';
      msg.textContent = message || 'exit 1 (peer conflict)';
      msg.style.color = 'var(--c-doctor, #ff5c7a)';
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
    envBadge.textContent = 'Clean Sandbox #2 · Verifier ◯';
    envBadge.style.borderColor = 'var(--c-verifier, #2fbf85)';
    envBadge.style.color = 'var(--c-verifier, #2fbf85)';
    setStep(0, 'pass', 'done', steps[0].cmd);
    setStep(1, 'pass', 'passed', steps[1].fixCmd);
    setStep(2, 'pass', 'GET / 200', steps[2].cmd);
    diag.textContent = 'GeekyAnts/express-typescript · 1 break fixed · 0 human intervention';
    verdict.textContent = 'VERIFIED';
    verdict.style.color = 'var(--c-verifier, #2fbf85)';
    return;
  }

  // Orchestrated narrative cycle
  let activeTimer = null;
  function runCycle() {
    // 0. Reset to Run 1
    if (heroOrb) heroOrb.setState('searching');
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
        setStep(0, 'pass', 'done');
        setStep(1, 'running', 'resolving tree...');

        // Step 2 fails
        activeTimer = setTimeout(() => {
          if (heroOrb) heroOrb.setState('solving');
          setStep(1, 'fail', 'exit 1 (ERESOLVE)');
          diag.textContent = "Doctor +: npm refuses the project's conflicting peer dependencies. Fix: --legacy-peer-deps";
          verdict.textContent = 'FAILED';
          verdict.style.color = 'var(--c-doctor, #ff5c7a)';

          // Discard machine
          activeTimer = setTimeout(() => {
            statusText.textContent = 'Doctor repair applied. Discarding machine...';
            envBadge.textContent = 'Resetting environment';
            diag.textContent = 'Throwing sandbox away. Re-verifying from zero...';

            activeTimer = setTimeout(() => {
              // Replay from zero in Sandbox #2
              if (heroOrb) heroOrb.setState('listening');
              statusText.textContent = 'Replay: verifying full guide from zero';
              envBadge.textContent = 'Clean Sandbox #2 · Verifier ◯';
              envBadge.style.borderColor = 'var(--c-verifier, #2fbf85)';
              envBadge.style.color = 'var(--c-verifier, #2fbf85)';
              verdict.textContent = 'RUNNING';
              verdict.style.color = 'var(--muted)';
              diag.textContent = 'Replaying all commands in clean sandbox...';

              setStep(0, 'queued', 'queued');
              setStep(1, 'queued', 'queued', steps[1].fixCmd);
              setStep(2, 'queued', 'queued');

              activeTimer = setTimeout(() => {
                setStep(0, 'pass', 'done');
                activeTimer = setTimeout(() => {
                  setStep(1, 'pass', 'passed');
                  activeTimer = setTimeout(() => {
                    if (heroOrb) heroOrb.setState('composing');
                    setStep(2, 'pass', 'GET / 200');
                    diag.textContent = 'All steps passed on clean machine. README proven from zero.';
                    // Replay completes: VERIFIED in calm Verifier accent green
                    verdict.textContent = 'VERIFIED';
                    verdict.style.color = 'var(--c-verifier, #2fbf85)';

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
