// Guide-motion lab: plays the recorded acme-shop reel (/data/reels/acme-shop.json) as terminal rows and hands each
// moment to a guide prototype through hooks. Every command, failure, diagnosis, fix and duration shown comes from the
// reel; only the pacing is ours (tuned for reading, labelled on the page).

export async function loadReel(url = '/data/reels/acme-shop.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`reel not loaded (${res.status})`);
  return res.json();
}

// Reel lines -> an ordered script. The planner lines are the README as written; the run starts at the first runner line.
export function toScript(reel) {
  const out = [];
  let phase = 'run', started = null, rowOpen = false;
  for (const l of reel.lines) {
    if (l.agent === 'planner') continue;
    if (l.agent === 'verifier' && phase !== 'replay') { phase = 'replay'; out.push({ type: 'phase', phase }); }
    const t = Number(l.seconds) || 0;
    if (l.kind === 'cmd') { out.push({ type: 'cmd', text: l.text, phase }); started = t; rowOpen = true; }
    else if (l.kind === 'fail') out.push({ type: 'fail', secs: started == null ? null : t - started });
    else if (l.kind === 'diag') out.push({ type: 'diag', text: l.text });
    else if (l.kind === 'fix') { out.push({ type: 'fix', text: l.text }); started = t; } // a re-run of the same row starts here
    else if (l.kind === 'pass') { out.push({ type: 'pass', secs: started == null ? null : t - started, phase }); rowOpen = false; }
    else if (l.kind === 'verified' && l.agent === 'scribe') out.push({ type: 'verdict', text: l.text.replace(/^Verdict:\s*/, '') });
  }
  return out;
}

const PACE = { cmd: 520, fail: 650, diag: 1700, fix: 1100, pass: 420, phase: 1100, verdict: 400 };
const REPLAY_PACE = { cmd: 260, pass: 240 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const secsText = (s) => (s == null ? '' : s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} m ${Math.round(s % 60)} s`);

export function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

/**
 * Plays the script into `content` (the scrolling terminal's inner element).
 * hooks: { onStart, onCmd(row, ev), onFail(row, ev), onDiag(row, note, ev), onFix(row, note, ev), onPass(row, ev),
 *          onPhase(banner, ev), onVerdict(stamp, ev) } - each may return a promise the player waits for.
 */
export async function play(script, { content, scroller, hooks = {}, speed = 1, reduced = false, token = { stop: false } }) {
  content.textContent = '';
  let row = null;
  const call = async (name, ...args) => { if (hooks[name]) await hooks[name](...args); };
  const follow = (node) => {
    if (!scroller || !node) return;
    const top = node.offsetTop - scroller.clientHeight * 0.45;
    scroller.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  };
  const wait = (ms) => (reduced ? Promise.resolve() : sleep(ms / speed));
  await call('onStart');
  for (const ev of script) {
    if (token.stop) return;
    const replay = ev.phase === 'replay';
    if (ev.type === 'cmd') {
      row = el('div', 'row' + (replay ? ' replay' : ''));
      row.append(el('span', 'prompt', '$'), el('span', 'text', ev.text), el('span', 'res'));
      content.append(row); follow(row);
      await call('onCmd', row, ev);
      await wait(replay ? REPLAY_PACE.cmd : PACE.cmd);
    } else if (ev.type === 'fail') {
      row.classList.add('is-fail');
      row.querySelector('.res').textContent = `failed · ${secsText(ev.secs)}`;
      await call('onFail', row, ev);
      await wait(PACE.fail);
    } else if (ev.type === 'diag') {
      const note = el('div', 'note note-doctor');
      note.append(el('b', null, 'DR.BO'), el('span', null, ev.text));
      row.after(note); follow(note);
      await call('onDiag', row, note, ev);
      await wait(PACE.diag);
    } else if (ev.type === 'fix') {
      const note = el('div', 'note note-fix');
      note.append(el('b', null, 'fix'), el('span', null, ev.text));
      (content.lastElementChild || row).after(note); follow(note);
      await call('onFix', row, note, ev);
      await wait(PACE.fix);
    } else if (ev.type === 'pass') {
      row.classList.remove('is-fail'); row.classList.add('is-pass');
      row.querySelector('.res').textContent = `${replay ? 'replayed' : 'passed'} · ${secsText(ev.secs)}`;
      await call('onPass', row, ev);
      await wait(replay ? REPLAY_PACE.pass : PACE.pass);
    } else if (ev.type === 'phase') {
      const banner = el('div', 'phase-banner', 'Machine thrown away · replaying the fixed guide from zero');
      content.append(banner); follow(banner);
      await call('onPhase', banner, ev);
      await wait(PACE.phase);
    } else if (ev.type === 'verdict') {
      const stamp = el('div', 'verdict', ev.text);
      content.append(stamp); follow(stamp);
      await call('onVerdict', stamp, ev);
      await wait(PACE.verdict);
    }
  }
}

// A small critically-damped-ish spring for one number (used for the rail puck). Returns a setter and a promise per move.
export function spring(apply, { stiffness = 190, damping = 21, value = 0 } = {}) {
  let x = value, v = 0, target = value, raf = 0, resolveMove = null, last = 0;
  const tick = (now) => {
    const dt = Math.min(0.032, (now - last) / 1000 || 0.016); last = now;
    const a = stiffness * (target - x) - damping * v;
    v += a * dt; x += v * dt;
    apply(x, v);
    if (Math.abs(target - x) < 0.3 && Math.abs(v) < 4) { x = target; v = 0; apply(x, 0); raf = 0; resolveMove && resolveMove(); resolveMove = null; return; }
    raf = requestAnimationFrame(tick);
  };
  return {
    to(t, { instant = false } = {}) {
      target = t;
      if (resolveMove) { resolveMove(); resolveMove = null; } // a new target settles the previous move's promise
      if (instant) { x = t; v = 0; apply(x, 0); return Promise.resolve(); }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      return new Promise((r) => { resolveMove = r; });
    },
    get value() { return x; },
  };
}
