import { buildTimeline, buildWatchPanel, parseRecordedEvents, recordedElapsed, typeText } from './humble-console-core.js';

const RECORDINGS = {
  'acme-shop': 'acme-shop-3c0bc2b2',
  'b25bb1004-wq/acme-shop': 'acme-shop-3c0bc2b2',
  'GeekyAnts/express-typescript': 'real-16-v2-GeekyAnts__express-typescript',
  'addyosmani/git2txt': 'real-16-v2-addyosmani__git2txt',
};
const DEFAULT_RECORDING = 'b25bb1004-wq/acme-shop';
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const STATIC_MARKUP = `
  <div class="hc-launch-row">
    <div class="hc-launch-copy">
      <span class="hc-eyebrow">RECORDED WALKTHROUGH</span>
      <p>See HUMBLE follow a setup guide, fix what breaks, and replay it from zero.</p>
      <small>Saved run · no commands run in your browser</small>
    </div>
    <button class="hc-open" type="button">Open the console <span aria-hidden="true">↗</span></button>
  </div>
  <p class="hc-error" data-hc-error role="alert" hidden></p>
  <dialog class="hc-dialog" aria-labelledby="hc-title">
    <section class="hc-shell">
      <header class="hc-header">
        <span class="hc-lantern" aria-hidden="true"><i></i></span>
        <div class="hc-heading"><span class="hc-eyebrow">HUMBLE · RECORDED RUN</span><h2 id="hc-title">Setup, proven.</h2></div>
        <button class="hc-close" type="button" aria-label="Close console">×</button>
      </header>
      <div class="hc-intro">
        <p class="hc-intro-title" data-hc-welcome></p>
        <p class="hc-trust">This is a saved run from a demo machine. Nothing runs on your computer.</p>
        <div class="hc-machine-label">DEMO MACHINE · RECORDED SNAPSHOT</div>
        <div class="hc-watch hc-watch-intro" data-hc-watch-intro></div>
        <button class="hc-start" type="button">Start the replay <span aria-hidden="true">→</span></button>
      </div>
      <div class="hc-reel" hidden>
        <div class="hc-run-meta"><span data-hc-run-name></span><span data-hc-run-verdict></span></div>
        <div class="hc-reel-grid">
          <div class="hc-terminal">
            <div class="hc-terminal-head"><span>RECORDED TERMINAL</span><span data-hc-clock>00:00</span></div>
            <div class="hc-lines" role="log" aria-live="polite" aria-relevant="additions text" tabindex="0"></div>
            <div class="hc-terminal-caret" aria-hidden="true">▌</div>
          </div>
          <aside class="hc-watch-panel" aria-label="Recorded run watch panel">
            <div class="hc-machine-label">WATCH · SOURCE FACTS</div>
            <div class="hc-watch" data-hc-watch></div>
            <div class="hc-active-step"><span class="hc-machine-label">CURRENT STEP</span><strong data-hc-step>Waiting for replay</strong></div>
          </aside>
        </div>
        <div class="hc-timeline-wrap">
          <div class="hc-time-labels"><span data-hc-time>00:00</span><span data-hc-total>00:00</span></div>
          <input class="hc-timeline" type="range" min="0" max="0" value="0" aria-label="Scrub the recorded run">
          <div class="hc-controls">
            <button type="button" data-hc-action="back" aria-label="Step backward">‹</button>
            <button type="button" data-hc-action="play" aria-label="Play or pause replay">Play</button>
            <button type="button" data-hc-action="next" aria-label="Step forward">›</button>
            <span class="hc-key-hint">F10 step · F5 continue</span>
          </div>
        </div>
        <div class="hc-finish" hidden>
          <span data-hc-result></span>
          <button type="button" data-hc-action="replay">Press Enter to replay it</button>
        </div>
        <button class="hc-skip" type="button">Skip intro</button>
      </div>
    </section>
  </dialog>`;

function formatClock(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function addLine(container, item) {
  const row = document.createElement('div');
  row.className = `hc-line hc-line-${item.kind}`;
  row.dataset.eventIndex = String(item.sourceIndex);
  const text = document.createElement('span');
  text.className = 'hc-line-text';
  text.textContent = item.text;
  row.append(text);
  if (item.step) {
    const step = document.createElement('span');
    step.className = 'hc-line-step';
    step.textContent = item.step;
    row.append(step);
  }
  container.append(row);
  return row;
}

function watchRows(container, rows) {
  container.replaceChildren();
  for (const entry of rows) {
    const row = document.createElement('div');
    row.className = 'hc-watch-row';
    const label = document.createElement('span');
    label.textContent = entry.label;
    const value = document.createElement('strong');
    value.textContent = entry.value;
    if (/^(?:up|passed|verified|http 200)$/i.test(entry.value.trim())) value.dataset.good = 'true';
    row.append(label, value);
    container.append(row);
  }
}

async function loadRecording(repo) {
  const folder = RECORDINGS[repo] || RECORDINGS[DEFAULT_RECORDING];
  const base = `/data/runs/${folder}`;
  const [runResponse, eventsResponse] = await Promise.all([
    fetch(`${base}/run.json`, { cache: 'force-cache' }),
    fetch(`${base}/f/events.ndjson`, { cache: 'force-cache' }),
  ]);
  if (!runResponse.ok || !eventsResponse.ok) throw new Error('The recorded run is not available right now.');
  const [run, eventText] = await Promise.all([runResponse.json(), eventsResponse.text()]);
  const events = parseRecordedEvents(eventText);
  const frames = buildTimeline(events);
  if (!frames.length || !run.passport) throw new Error('This recording has no complete proof to replay.');
  return { repo, run, events, frames, folder };
}

function mountConsole(panel) {
  if (!panel || panel.querySelector('.hc-launch-row')) return;
  panel.insertAdjacentHTML('beforeend', STATIC_MARKUP);

  const dialog = panel.querySelector('.hc-dialog');
  const openButton = panel.querySelector('.hc-open');
  const closeButton = panel.querySelector('.hc-close');
  const intro = panel.querySelector('.hc-intro');
  const reel = panel.querySelector('.hc-reel');
  const lines = panel.querySelector('.hc-lines');
  const slider = panel.querySelector('.hc-timeline');
  const playButton = panel.querySelector('[data-hc-action="play"]');
  const finish = panel.querySelector('.hc-finish');
  const state = { recording: null, cursor: -1, timer: 0, playing: false, rows: [] };
  const setText = (selector, value) => { panel.querySelector(selector).textContent = value; };
  const clearTimer = () => { if (state.timer) window.clearInterval(state.timer); state.timer = 0; state.playing = false; };

  function activeStep(index) {
    const item = state.recording?.frames[index];
    if (!item) return 'Replay complete';
    return item.step ? `${item.step} · ${item.text}` : item.text;
  }

  function paint(index) {
    if (!state.recording) return;
    const last = state.recording.frames.length - 1;
    state.cursor = Math.max(-1, Math.min(index, last));
    state.rows = state.recording.frames.slice(0, state.cursor + 1);
    lines.replaceChildren();
    for (const item of state.rows) addLine(lines, item);
    slider.value = String(Math.max(0, state.cursor));
    const elapsed = recordedElapsed(state.recording.frames, state.cursor);
    panel.querySelector('[data-hc-time]').textContent = formatClock(elapsed);
    panel.querySelector('[data-hc-step]').textContent = activeStep(state.cursor);
    panel.querySelector('[data-hc-clock]').textContent = formatClock(elapsed);
    const done = state.cursor >= last;
    finish.hidden = !done;
    if (done) {
      clearTimer();
      playButton.textContent = 'Replay';
      const p = state.recording.run.passport;
      setText('[data-hc-result]', `${p.verdict} · ${Number(p.breaksFixed || 0)} of ${Number(p.breaksFound || 0)} breaks fixed · ${Number(p.replaySeconds || 0)}s replay`);
      try { localStorage.setItem('humble.onboarded', '1'); } catch { /* Private browsing can disable storage. */ }
    }
    if (state.rows.length) lines.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }

  function play() {
    if (!state.recording) return;
    if (state.playing) { clearTimer(); playButton.textContent = 'Play'; return; }
    if (reducedMotion()) { paint(state.recording.frames.length - 1); return; }
    if (state.cursor >= state.recording.frames.length - 1) paint(-1);
    state.playing = true;
    playButton.textContent = 'Pause';
    const interval = Math.max(90, Math.floor(25000 / state.recording.frames.length));
    state.timer = window.setInterval(() => {
      if (state.cursor >= state.recording.frames.length - 1) return paint(state.cursor);
      paint(state.cursor + 1);
    }, interval);
    paint(state.cursor + 1);
  }

  async function showIntro() {
    openButton.disabled = true;
    panel.querySelector('[data-hc-error]').hidden = true;
    try {
      const selected = panel.querySelector('#prove-repo-input')?.value.trim() || DEFAULT_RECORDING;
      state.recording = await loadRecording(selected);
      const watch = buildWatchPanel(state.recording.run);
      watchRows(panel.querySelector('[data-hc-watch-intro]'), watch);
      watchRows(panel.querySelector('[data-hc-watch]'), watch);
      setText('[data-hc-run-name]', `${state.recording.run.passport.repo} · ${state.recording.run.commit}`);
      const passport = state.recording.run.passport;
      setText('[data-hc-run-verdict]', `${passport.verdict} · recorded ${passport.replaySeconds}s replay`);
      panel.querySelector('[data-hc-total]').textContent = formatClock(recordedElapsed(state.recording.frames, state.recording.frames.length - 1));
      slider.max = String(Math.max(0, state.recording.frames.length - 1));
      slider.value = '0';
      setText('[data-hc-step]', 'Ready to replay');
      const title = panel.querySelector('[data-hc-welcome]');
      await typeText(title, 'hi, we\'re arnav and karmanya. this is humble.', { min: 30, max: 30, reducedMotion: reducedMotion() });
      intro.hidden = false;
      reel.hidden = true;
      dialog.showModal();
      panel.querySelector('.hc-start').focus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load the saved run.';
      const notice = panel.querySelector('[data-hc-error]');
      notice.textContent = message;
      notice.hidden = false;
    } finally {
      openButton.disabled = false;
    }
  }

  function startReplay(skipIntro = false) {
    if (!state.recording) return;
    intro.hidden = true;
    reel.hidden = false;
    finish.hidden = true;
    lines.replaceChildren();
    paint(skipIntro ? state.recording.frames.length - 1 : -1);
    if (!skipIntro) play();
    panel.querySelector('[data-hc-action="play"]').focus();
  }

  openButton.addEventListener('click', showIntro);
  closeButton.addEventListener('click', () => { clearTimer(); dialog.close(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { clearTimer(); dialog.close(); } });
  dialog.addEventListener('close', () => { clearTimer(); openButton.focus(); });
  panel.querySelector('.hc-start').addEventListener('click', () => startReplay(false));
  panel.querySelector('.hc-skip').addEventListener('click', () => startReplay(true));
  playButton.addEventListener('click', play);
  slider.addEventListener('input', () => { clearTimer(); playButton.textContent = 'Play'; paint(Number(slider.value)); });
  panel.querySelector('[data-hc-action="back"]').addEventListener('click', () => { clearTimer(); playButton.textContent = 'Play'; paint(state.cursor - 1); });
  panel.querySelector('[data-hc-action="next"]').addEventListener('click', () => { clearTimer(); playButton.textContent = 'Play'; paint(state.cursor + 1); });
  panel.querySelector('[data-hc-action="replay"]').addEventListener('click', () => startReplay(false));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'F10') { event.preventDefault(); clearTimer(); playButton.textContent = 'Play'; paint(state.cursor + 1); }
    if (event.key === 'F5') { event.preventDefault(); play(); }
    if (event.key === 'Enter' && !finish.hidden && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      startReplay(false);
    }
  });
}

function boot() {
  const panel = document.getElementById('prove-live');
  if (!panel) return;
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        mountConsole(panel);
      }
    }, { rootMargin: '160px' });
    observer.observe(panel);
  } else {
    mountConsole(panel);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
