// HUMBLE run model: folds the Event stream (docs/ARCHITECTURE.md) into a view model.
// Isomorphic (browser + Node), no DOM access. Used by the dashboard and by fixtures/replay.js.

export const AGENTS = ['scout', 'planner', 'runner', 'doctor', 'verifier', 'scribe'];
export const PHASES = ['scout', 'plan', 'coldstart', 'repair', 'replay', 'publish', 'done'];
const LOG_CAP = 24000;

export function createModel(base = {}) {
  return {
    id: base.id || '', repo: base.repo || '', commit: base.commit || '',
    startedAt: base.startedAt || null, finishedAt: base.finishedAt || null,
    phase: base.phase || 'scout',
    plan: null, facts: null, stepOrder: [], steps: {},
    evidence: {}, evidenceOrder: [],
    replay: null, passport: null, bobcoins: 0, bobCalls: [],
    artifacts: {}, activeAgent: null, agentLast: {}, lastT: null,
    verdict: null, error: null, events: 0, phasesSeen: [],
  };
}

function ensureStep(m, id) {
  if (!m.steps[id]) {
    m.steps[id] = { id, def: null, status: 'pending', attempts: 0, n: 0, trail: [], log: '',
      startedT: null, replay: null, replayLog: '' };
    if (!m.stepOrder.includes(id)) m.stepOrder.push(id);
  }
  return m.steps[id];
}

function mergePlan(m, plan) {
  m.plan = plan;
  if (plan.repo && !m.repo) m.repo = plan.repo;
  if (plan.commit && !m.commit) m.commit = plan.commit;
  const order = [];
  for (const def of plan.steps || []) {
    const s = ensureStep(m, def.id);
    s.def = def;
    if (def.skip && s.status === 'pending') s.status = 'skipped';
    order.push(def.id);
  }
  // keep any step we saw events for but that isn't (yet) in the plan
  for (const id of m.stepOrder) if (!order.includes(id)) order.push(id);
  m.stepOrder = order;
}

const inReplay = (m, ev) => ev.agent === 'verifier' || (m.replay && m.replay.status === 'running');

export function applyEvent(m, ev) {
  m.events++;
  m.lastT = ev.t;
  if (!m.startedAt) m.startedAt = ev.t;
  if (ev.run && !m.id) m.id = ev.run;
  if (ev.agent) {
    m.activeAgent = ev.agent;
    m.agentLast[ev.agent] = { t: ev.t, type: ev.type, data: ev.data };
  }
  const d = ev.data || {};
  switch (ev.type) {
    case 'phase':
      m.phase = d.phase;
      if (!m.phasesSeen.includes(d.phase)) m.phasesSeen.push(d.phase);
      break;
    case 'facts':
      m.facts = d;
      break;
    case 'plan':
      mergePlan(m, d);
      break;
    case 'step.start': {
      const s = ensureStep(m, d.stepId);
      if (inReplay(m, ev)) {
        s.replay = { status: 'running', n: d.n, command: d.command, startedT: ev.t };
        s.replayLog = '';
      } else {
        s.status = 'running';
        s.n = d.n;
        s.attempts = Math.max(s.attempts, d.n || 1);
        s.log = '';
        if (!s.startedT) s.startedT = ev.t;
        s.trail.push({ kind: 'attempt', n: d.n, command: d.command, status: 'running', startedT: ev.t });
      }
      break;
    }
    case 'step.log': {
      const s = ensureStep(m, d.stepId);
      if (inReplay(m, ev)) s.replayLog = (s.replayLog + (d.chunk || '')).slice(-LOG_CAP);
      else s.log = (s.log + (d.chunk || '')).slice(-LOG_CAP);
      break;
    }
    case 'step.end': {
      const s = ensureStep(m, d.stepId);
      const st = d.status || (d.exitCode === 0 ? 'passed' : 'failed');
      if (inReplay(m, ev)) {
        s.replay = { ...(s.replay || {}), status: st === 'failed' ? 'failed' : 'passed',
          durationMs: d.durationMs, logFile: d.logFile, logTail: d.logTail };
        break;
      }
      let a = [...s.trail].reverse().find(x => x.kind === 'attempt' && x.n === d.n);
      if (!a) { a = { kind: 'attempt', n: d.n, command: d.command }; s.trail.push(a); }
      Object.assign(a, { command: d.command ?? a.command, exitCode: d.exitCode, durationMs: d.durationMs,
        logTail: d.logTail, logFile: d.logFile, status: st, endedT: ev.t });
      s.attempts = Math.max(s.attempts, d.n || 1);
      const failedBefore = s.trail.some(x => x.kind === 'attempt' && x !== a && x.status === 'failed');
      s.status = st === 'passed' && failedBefore ? 'repaired' : st;
      if (st === 'skipped') s.status = 'skipped';
      break;
    }
    case 'diagnosis': {
      const s = ensureStep(m, d.stepId);
      s.trail.push({ kind: 'diagnosis', ...d.diagnosis, t: ev.t });
      break;
    }
    case 'fix': {
      const s = ensureStep(m, d.stepId);
      s.trail.push({ kind: 'fix', fix: d.fix, t: ev.t });
      const rebase = (d.fix?.actions || []).find(a => a.type === 'rebase');
      if (rebase && m.plan) m.plan = { ...m.plan, image: rebase.image };
      break;
    }
    case 'evidence': {
      m.evidence[d.id] = d;
      if (!m.evidenceOrder.includes(d.id)) m.evidenceOrder.push(d.id);
      const s = ensureStep(m, d.stepId);
      const dg = [...s.trail].reverse().find(x => x.kind === 'diagnosis' && !x.evidenceId);
      if (dg) dg.evidenceId = d.id;
      s.trail.push({ kind: 'evidence', id: d.id, status: d.status, t: ev.t });
      if (d.status === 'needs-human') s.status = 'needs-human';
      break;
    }
    case 'replay.start':
      m.replay = { status: 'running', startedT: ev.t };
      break;
    case 'replay.end':
      m.replay = { ...(m.replay || {}), status: d.status, durationMs: d.durationMs, failedStep: d.failedStep, endedT: ev.t };
      break;
    case 'artifact':
      m.artifacts[d.name] = d.path;
      break;
    case 'passport':
      m.passport = d;
      m.verdict = d.verdict;
      break;
    case 'bob':
      m.bobcoins = round2(m.bobcoins + (d.bobcoins || 0));
      m.bobCalls.push(d);
      break;
    case 'done':
      if (d.verdict) m.verdict = d.verdict;
      m.phase = 'done';
      m.finishedAt = ev.t;
      m.activeAgent = null;
      break;
    case 'error':
      m.error = d.message;
      m.phase = 'error';
      m.activeAgent = null;
      break;
  }
  return m;
}

const round2 = x => Math.round(x * 100) / 100;

// Seed a model from a RunState (run.json) when no events are available.
export function modelFromRunState(rs) {
  const m = createModel(rs);
  if (rs.plan) mergePlan(m, rs.plan);
  for (const [id, st] of Object.entries(rs.steps || {})) {
    const s = ensureStep(m, id);
    s.status = st.status; s.attempts = st.attempts;
  }
  m.replay = rs.replay || null;
  m.passport = rs.passport || null;
  m.verdict = rs.passport?.verdict || null;
  m.bobcoins = rs.bobcoins || 0;
  return m;
}

// Contract RunState from a model (used by fixture tooling to write run.json).
export function toRunState(m) {
  const steps = {};
  for (const id of m.stepOrder) {
    const s = m.steps[id];
    steps[id] = { status: s.status, attempts: s.attempts };
  }
  const rs = {
    id: m.id, repo: m.repo, commit: m.commit, startedAt: m.startedAt,
    phase: m.phase, plan: m.plan || undefined, steps, evidence: [...m.evidenceOrder],
    bobcoins: m.bobcoins,
  };
  if (m.finishedAt) rs.finishedAt = m.finishedAt;
  if (m.replay && m.replay.status !== 'running') {
    rs.replay = { status: m.replay.status, durationMs: m.replay.durationMs };
    if (m.replay.failedStep) rs.replay.failedStep = m.replay.failedStep;
  }
  if (m.passport) rs.passport = m.passport;
  return rs;
}
