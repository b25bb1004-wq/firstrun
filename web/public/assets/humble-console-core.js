const SAFE_EVENT_TYPES = new Set([
  'plan', 'note', 'step.start', 'step.end', 'diagnosis', 'evidence', 'fix',
  'replay.start', 'replay.end', 'passport',
]);

const TOKEN_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9_]{10,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{10,}\b/g,
  /\b(?:sk-ant-|sk-proj-|sk-)[A-Za-z0-9_-]{10,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9_-]{10,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bbob_prod_[A-Za-z0-9_-]{8,}\b/g,
  /\bnvapi-[A-Za-z0-9_-]{10,}\b/g,
];

// Public recordings are already token-redacted at build time. Redact again at
// the display boundary because setup commands can contain sensitive assignments.
function safeDisplay(value) {
  if (typeof value !== 'string') return '';
  let result = value;
  for (const pattern of TOKEN_PATTERNS) result = result.replace(pattern, '<redacted>');
  return result.replace(
    /(^|[ \t])((?:export\s+)?[A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)\s*=\s*)(['"]?)([^'"\s;]+)\3/gi,
    (match, prefix, assignment, quote, secret) => {
      if (/^(?:your[-_]|sample|example|placeholder|dummy|changeme|change[-.]me|testpassword|[a-z]+(?:[-_][a-z]+)*)$/i.test(secret)) return match;
      return `${prefix}${assignment}${quote}<redacted>${quote}`;
    },
  );
}

export function parseRecordedEvents(ndjson) {
  return String(ndjson || '').split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      const event = JSON.parse(line);
      return event && typeof event === 'object' && typeof event.type === 'string'
        ? [{ ...event, sourceIndex: index }]
        : [];
    } catch {
      return [];
    }
  });
}

function duration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  return `${seconds}s`;
}

function frame(event, kind, text, step = '') {
  return {
    sourceIndex: event.sourceIndex,
    time: event.t || null,
    kind,
    step: step || event.data?.stepId || '',
    text,
  };
}

export function buildTimeline(events) {
  const frames = [];
  for (const event of events) {
    if (!SAFE_EVENT_TYPES.has(event.type)) continue;
    const data = event.data || {};
    switch (event.type) {
      case 'plan': {
        const count = Array.isArray(data.steps) ? data.steps.filter((s) => !s.skip).length : 0;
        const docs = Array.isArray(data.docsUsed) ? safeDisplay(data.docsUsed.filter(Boolean).join(', ')) : '';
        frames.push(frame(event, 'sys', `Scout read ${docs || 'the setup docs'} · ${count} runnable steps`));
        break;
      }
      case 'note':
        if (typeof data.message === 'string' && /^clean machine ready: /.test(data.message)) {
          frames.push(frame(event, 'sys', data.message));
        }
        break;
      case 'step.start':
        if (typeof data.command === 'string') frames.push(frame(event, 'cmd', safeDisplay(data.command)));
        break;
      case 'step.end': {
        const status = data.exitCode === 0 ? 'pass' : 'fail';
        const result = status === 'pass' ? `passed · ${duration(data.durationMs)}` : `failed · exit ${Number(data.exitCode || 1)}`;
        frames.push(frame(event, status, result));
        break;
      }
      case 'diagnosis': {
        const diagnosis = data.diagnosis || {};
        const label = [diagnosis.class, diagnosis.ruleId].filter((part) => typeof part === 'string' && part).join(' · ');
        frames.push(frame(event, 'diag', `${event.agent === 'bob' ? 'Bob' : 'DR.BO'} · ${label || 'diagnosis recorded'}`));
        break;
      }
      case 'evidence': {
        const diagnosis = data.diagnosis || {};
        const label = [diagnosis.class || data.class, diagnosis.ruleId || data.ruleId].filter((part) => typeof part === 'string' && part).join(' · ');
        if (label) frames.push(frame(event, 'diag', `${event.agent === 'bob' ? 'Bob' : 'DR.BO'} · ${label}`, data.id || ''));
        break;
      }
      case 'fix': {
        const fix = data.fix || {};
        const action = Array.isArray(fix.actions) ? fix.actions[0] : null;
        const command = typeof action?.command === 'string' ? action.command : '';
        const safeCommand = command
          ? ` · ${safeDisplay(command)}`
          : '';
        frames.push(frame(event, 'fix', `fix recorded${safeCommand}`));
        break;
      }
      case 'replay.start':
        frames.push(frame(event, 'sys', 'Verifier discarded the machine · replay from zero'));
        break;
      case 'replay.end':
        frames.push(frame(event, data.status === 'passed' ? 'pass' : 'fail', `replay ${data.status || 'ended'} · ${duration(data.durationMs)}`));
        break;
      case 'passport': {
        const p = data.passport || data;
        if (typeof p.verdict === 'string') {
          frames.push(frame(event, p.verdict === 'VERIFIED' ? 'pass' : 'sys', `${p.verdict} · ${Number(p.breaksFixed || 0)} of ${Number(p.breaksFound || 0)} breaks fixed · replay ${Number(p.replaySeconds || 0)}s`));
        }
        break;
      }
    }
  }
  return frames;
}

function recordedProbe(run) {
  const plan = run?.plan || {};
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const observed = steps.find((step) => step.probe && typeof step.probe === 'object')?.probe;
  let body = null;
  if (typeof observed?.body === 'string') {
    try { body = JSON.parse(observed.body); } catch { body = null; }
  }
  return { plan, observed, body };
}

export function buildWatchPanel(run) {
  const { plan, observed, body } = recordedProbe(run);
  const rows = [];
  const runtime = plan.runtime;
  if (runtime?.name && runtime?.version) {
    rows.push({ label: runtime.name === 'node' ? 'Node.js' : runtime.name, value: `${runtime.version} · ${plan.image || 'recorded image'}` });
  }
  if (observed && Number.isFinite(Number(observed.status))) {
    rows.push({ label: plan.verify?.target || 'Health check', value: `HTTP ${Number(observed.status)}` });
  }
  for (const key of ['db', 'redis']) {
    if (typeof body?.[key] === 'string') rows.push({ label: key.toUpperCase(), value: body[key] });
  }
  const passport = run?.passport || {};
  if (typeof passport.verdict === 'string') {
    rows.push({ label: 'Verdict', value: passport.verdict });
    rows.push({ label: 'Replay', value: `${Number(passport.replaySeconds || 0)}s from zero` });
  }
  return rows;
}

export function recordedElapsed(frames, index) {
  const first = frames.find((item) => item.time)?.time;
  const current = frames[Math.max(0, Math.min(index, frames.length - 1))]?.time;
  if (!first || !current) return 0;
  const elapsed = Date.parse(current) - Date.parse(first);
  return Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed / 1000)) : 0;
}

export function typeText(element, text, { min = 30, max = 60, reducedMotion = false } = {}) {
  if (!element) return Promise.resolve();
  const value = String(text ?? '');
  if (reducedMotion || document.hidden || !value) {
    element.textContent = value;
    return Promise.resolve();
  }
  element.textContent = '';
  let index = 0;
  return new Promise((resolve) => {
    const tick = () => {
      element.textContent += value[index++];
      if (index >= value.length) return resolve();
      const wait = min + Math.random() * Math.max(0, max - min);
      window.setTimeout(tick, wait);
    };
    tick();
  });
}
