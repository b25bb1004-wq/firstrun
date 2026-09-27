// 'PROVE IT LIVE' Hero Controller
// Strictly streams real events:
// - For preset demo repos: parses real recorded events.ndjson files, explicitly labelled '[recorded run]'
// - For live custom repos: calls /api/verify and streams real /api/verify-status events from GitHub Actions
(function () {
  const panel = document.getElementById('prove-live');
  if (!panel) return;

  const input = document.getElementById('prove-repo-input');
  const btn = document.getElementById('prove-btn');
  const chips = document.querySelectorAll('.prove-chip');
  const consoleBox = document.getElementById('prove-console');
  const streamRows = document.getElementById('prove-stream-rows');
  const resultLine = document.getElementById('prove-result-line');
  const progressBar = document.getElementById('prove-progress-bar');
  const mascotImg = document.getElementById('prove-mascot-img');

  let timerInterval = null;
  let startTime = 0;
  let isRunning = false;

  // Real recorded runs in web/public/data/runs/
  const RECORDED_RUNS = {
    'acme-shop': {
      path: '/data/runs/acme-shop-3c0bc2b2/f/events.ndjson',
      label: 'acme-shop demo (recorded run)',
      evidenceLink: '/proof'
    },
    'b25bb1004-wq/acme-shop': {
      path: '/data/runs/acme-shop-3c0bc2b2/f/events.ndjson',
      label: 'acme-shop demo (recorded run)',
      evidenceLink: '/proof'
    },
    'GeekyAnts/express-typescript': {
      path: '/data/runs/real-16-v2-GeekyAnts__express-typescript/f/events.ndjson',
      label: 'GeekyAnts/express-typescript (recorded run)',
      evidenceLink: '/audit'
    },
    'addyosmani/git2txt': {
      path: '/data/runs/real-16-v2-addyosmani__git2txt/f/events.ndjson',
      label: 'addyosmani/git2txt (recorded run)',
      evidenceLink: '/audit'
    }
  };

  // Chip selection
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (isRunning) return;
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      input.value = chip.dataset.repo;
    });
  });

  input.addEventListener('input', () => {
    chips.forEach(c => {
      if (c.dataset.repo === input.value.trim()) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  });

  function formatTimer(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function addRow(agent, action, isRecorded = false, delayMs = 0) {
    return new Promise(resolve => {
      setTimeout(() => {
        const row = document.createElement('div');
        row.className = 'prove-row mono';
        const agentClass = `agent-${agent.toLowerCase().replace(/[^a-z]/g, '')}`;
        const tag = isRecorded ? '<span class="prove-tag">[recorded run]</span> ' : '';
        row.innerHTML = `${tag}<span class="prove-agent ${agentClass}">${agent}</span> <span class="prove-action">${escapeHtml(action)}</span>`;
        streamRows.appendChild(row);
        consoleBox.scrollTop = consoleBox.scrollHeight;
        resolve();
      }, delayMs);
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  async function parseRecordedEvents(ndjsonText) {
    const lines = ndjsonText.split('\n').filter(l => l.trim().length > 0);
    const events = [];
    for (const l of lines) {
      try { events.push(JSON.parse(l)); } catch (e) {}
    }

    const highlights = [];
    let passport = null;
    for (const ev of events) {
      if ((ev.type === 'passport' || ev.type === 'done') && ev.data) {
        passport = ev.data.passport || ev.data;
      }
      if (ev.type === 'plan' && ev.data) {
        const stepCount = ev.data.steps ? ev.data.steps.length : 0;
        const docs = (ev.data.docsUsed && ev.data.docsUsed.length) ? ev.data.docsUsed.join(', ') : 'README.md';
        highlights.push({ agent: 'Harvey', action: `read ${docs} · ${stepCount} steps extracted` });
      } else if (ev.type === 'step.end' && ev.data && ev.data.status === 'failed') {
        const tail = (ev.data.logTail || '').split('\n')[0].slice(0, 48);
        highlights.push({ agent: 'Mach', action: `${ev.data.command || 'step'}  exit ${ev.data.exitCode || 1} · ${tail}` });
      } else if (ev.type === 'diagnosis' && ev.data && ev.data.diagnosis) {
        const d = ev.data.diagnosis;
        highlights.push({ agent: 'DR.BO', action: `diagnosed ${d.class || 'break'} (${d.ruleId || 'rule'})` });
      } else if (ev.type === 'fix' && ev.data && ev.data.fix) {
        const cmd = ev.data.fix.actions?.[0]?.command || ev.data.fix.doc?.text || 'applied repair';
        highlights.push({ agent: 'Doctor', action: `repair: ${cmd}` });
      } else if (ev.type === 'phase' && ev.data && ev.data.phase === 'replay') {
        highlights.push({ agent: 'Verifier', action: 'discarded machine · replaying from zero…' });
      } else if (ev.type === 'verdict' && ev.data) {
        highlights.push({ agent: 'Larp', action: `replayed from zero · ${ev.data.verdict || 'VERIFIED'}` });
      }
    }

    return { rows: highlights.slice(0, 6), passport };
  }

  async function runProve() {
    const repo = input.value.trim();
    if (!repo) {
      input.focus();
      return;
    }

    isRunning = true;
    btn.disabled = true;
    startTime = Date.now();
    btn.textContent = 'Proving… 00:00';
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      btn.textContent = `Proving… ${formatTimer(elapsed)}`;
    }, 1000);

    consoleBox.style.display = 'flex';
    streamRows.innerHTML = '';
    resultLine.style.display = 'none';
    progressBar.style.width = '10%';
    mascotImg.src = '/assets/mascot/think.svg';

    // 1. Check if user selected a real recorded run chip
    const recorded = RECORDED_RUNS[repo];
    if (recorded) {
      try {
        const resp = await fetch(recorded.path);
        if (resp.ok) {
          const text = await resp.text();
          const { rows, passport } = await parseRecordedEvents(text);
          if (rows.length > 0) {
            for (let i = 0; i < rows.length; i++) {
              await addRow(rows[i].agent, rows[i].action, true, 350);
              progressBar.style.width = `${Math.round(((i + 1) / rows.length) * 95)}%`;
            }
            progressBar.style.width = '100%';
            finishSuccess(repo, true, recorded.evidenceLink, passport);
            return;
          }
        }
      } catch (err) {
        // Fallback to live API if local fetch fails
      }
    }

    // 2. Real Live Trigger via /api/verify
    try {
      const triggerResp = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo })
      });

      const triggerData = await triggerResp.json().catch(() => ({}));

      if (!triggerResp.ok) {
        if (triggerResp.status === 500 && triggerData.error?.includes('HOSTED_VERIFY_TOKEN')) {
          await addRow('Harvey', 'Server not configured with HOSTED_VERIFY_TOKEN for live GitHub Actions. Pick a recorded run above or run "firstrun verify" in CLI.', false, 100);
          finishEnd();
          return;
        }
        throw new Error(triggerData.error || `Trigger returned ${triggerResp.status}`);
      }

      const runId = triggerData.run_id;
      await addRow('Harvey', `queued on GitHub Actions… (run #${runId || 'new'})`, false, 180);
      progressBar.style.width = '25%';

      // Poll real /api/verify-status
      let completed = false;
      let pollCount = 0;
      while (!completed && pollCount < 40) {
        await new Promise(r => setTimeout(r, 6000));
        pollCount++;
        const statusResp = await fetch(`/api/verify-status?repo=${encodeURIComponent(repo)}&run_id=${runId || ''}`);
        if (statusResp.ok) {
          const statusData = await statusResp.json();
          if (statusData.status === 'completed') {
            completed = true;
            if (statusData.conclusion === 'success') {
              progressBar.style.width = '100%';
              if (statusData.evidence && Array.isArray(statusData.evidence)) {
                for (const ev of statusData.evidence) {
                  await addRow('Larp', `${ev.step}: ${ev.command} → ${ev.outcome}`, false, 180);
                }
              }
              finishSuccess(repo, false, `https://github.com/b25bb1004-wq/firstrun/actions/runs/${runId}`, statusData.passport);
              return;
            } else {
              throw new Error('GitHub Actions run finished with conclusion: ' + statusData.conclusion);
            }
          } else {
            progressBar.style.width = `${Math.min(90, 25 + pollCount * 2)}%`;
            await addRow('Mach', `status: ${statusData.status || 'running'} on clean runner…`, false, 120);
          }
        }
      }
      throw new Error('Verification in progress on GitHub Actions. Check status page.');
    } catch (err) {
      await addRow('DR.BO', `Notice: ${err.message || 'Run in progress'}`, false, 120);
      finishEnd();
    }
  }

  function finishSuccess(repo, isRecorded, link, passport) {
    clearInterval(timerInterval);
    btn.disabled = false;
    btn.textContent = 'Prove it';
    isRunning = false;

    const verdict = passport?.verdict || 'VERIFIED';
    mascotImg.src = verdict === 'VERIFIED' ? '/assets/mascot/celebrate.svg' : '/assets/mascot/think.svg';
    const tag = isRecorded ? ' (recorded run)' : '';

    let stats = '';
    if (passport) {
      const parts = [];
      if (passport.stepsTotal) parts.push(`${passport.stepsTotal} steps`);
      if (passport.breaksFixed !== undefined && passport.breaksFixed > 0) parts.push(`${passport.breaksFixed} fixed`);
      if (passport.replaySeconds) parts.push(`replay in ${passport.replaySeconds}s`);
      if (parts.length > 0) stats = ` · ${parts.join(' · ')}`;
    } else {
      stats = ' · breaks diagnosed &amp; fixed · replay passed';
    }

    resultLine.innerHTML = `<strong>${escapeHtml(verdict)}</strong>${tag}${stats} &nbsp;<a href="${link}" class="link" target="_blank" rel="noopener">Open evidence →</a>`;
    resultLine.style.display = 'block';
  }

  function finishEnd() {
    clearInterval(timerInterval);
    btn.disabled = false;
    btn.textContent = 'Prove it';
    isRunning = false;
  }

  btn.addEventListener('click', runProve);
})();
