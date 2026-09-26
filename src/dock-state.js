// src/dock-state.js — pure, no I/O. Turn events.ndjson events into dock:state.
// Section 3 of docs/DOCK_CONTRACT.md defines which events flip which character.

const AGENTS = ['scout', 'planner', 'runner', 'doctor', 'verifier', 'scribe', 'guide'];

/** Which characters should light up for a given agent (solo run). */
export function charactersFor(agent) {
  if (agent === 'all') return AGENTS;
  const map = { scout: ['scout'], planner: ['scout', 'planner'], runner: ['runner'],
    doctor: ['doctor'], verifier: ['verifier'], scribe: ['scribe'], guide: ['guide'] };
  return map[agent] ?? AGENTS;
}

function blankCharacters() {
  return {
    scout:    { state: 'idle', line: '' },
    planner:  { state: 'idle', line: '' },
    runner:   { state: 'idle', line: '' },
    doctor:   { state: 'idle', line: '' },
    verifier: { state: 'idle', line: '' },
    scribe:   { state: 'idle', line: '' },
    guide:    { state: 'idle', line: '' },
  };
}

/** Initial dock:state for a new run. */
export function initialState(target, agent) {
  return {
    target,
    agent: agent ?? 'all',
    phase: null,
    verdict: null,
    characters: blankCharacters(),
    evidence: [],
    bobcoins: 0,
    runDir: null,
  };
}

/** Pure reducer: given the current state and one event, return next state. */
export function reduce(state, event) {
  const s = { ...state, characters: { ...state.characters } };
  // deep-clone mutated char entries as needed
  function ch(name) { s.characters[name] = { ...s.characters[name] }; return s.characters[name]; }

  const { type, agent, data } = event;

  switch (type) {
    case 'phase': {
      s.phase = data.phase;
      if (data.phase === 'scout')   { ch('scout').state = 'working'; }
      if (data.phase === 'plan')    { ch('planner').state = 'working'; }
      if (data.phase === 'repair')  { ch('doctor').state = 'working'; }
      if (data.phase === 'publish') { ch('scribe').state = 'working'; }
      // phase:replay marks runner done (if not already needs_you)
      if (data.phase === 'replay' && s.characters.runner.state !== 'needs_you') {
        ch('runner').state = 'done'; ch('runner').line = '';
      }
      if (data.phase === 'done') {
        // everyone working → done
        for (const n of AGENTS) if (s.characters[n].state === 'working') { ch(n).state = 'done'; }
      }
      break;
    }
    case 'facts': {
      ch('scout').state = 'done';
      ch('scout').line = [data.stack, data.node && `node ${data.node}`, data.python && `python ${data.python}`].filter(Boolean).join(' · ');
      break;
    }
    case 'plan': {
      const n = (data.steps ?? []).length;
      const c = (data.conflicts ?? []).length;
      const runnable = (data.steps ?? []).filter((x) => !x.skip).length;
      ch('planner').line = `${n} step${n !== 1 ? 's' : ''}${c ? `, ${c} conflict${c !== 1 ? 's' : ''}` : ''}`;
      ch('planner').state = runnable === 0 ? 'needs_you' : 'done';
      break;
    }
    case 'step.start': {
      if (agent === 'runner' || agent === 'swarm') { ch('runner').state = 'working'; ch('runner').line = data.command ?? ''; }
      break;
    }
    case 'step.end': {
      if ((agent === 'runner' || agent === 'swarm') && data.status === 'failed') {
        ch('runner').state = 'needs_you'; ch('runner').line = data.command ?? '';
      }
      break;
    }
    case 'diagnosis': { ch('doctor').state = 'working'; ch('doctor').line = data.diagnosis?.cause ?? ''; break; }
    case 'evidence': {
      const ev = { id: data.id, stepId: data.stepId, status: data.status, cause: '' };
      s.evidence = [...(s.evidence ?? []).filter((e) => e.id !== data.id), ev];
      if (data.status === 'verified' || data.status === 'progressed') {
        ch('doctor').state = 'done'; ch('doctor').line = data.status;
      } else if (data.status === 'needs-human' || data.status === 'failed') {
        ch('doctor').state = 'needs_you'; ch('doctor').line = 'needs a human';
      }
      break;
    }
    case 'bob': { s.bobcoins = (s.bobcoins ?? 0) + (data.bobcoins ?? 0); break; }
    case 'replay.start': { ch('verifier').state = 'working'; break; }
    case 'replay.end': {
      ch('verifier').state = data.status === 'passed' ? 'done' : 'needs_you';
      ch('verifier').line = data.status ?? '';
      break;
    }
    case 'passport': { ch('scribe').state = 'done'; break; }
    case 'done': { s.verdict = data.verdict; break; }
    case 'artifact': { if (data.path) s.runDir = s.runDir ?? data.path.replace(/\/out\/.*$/, ''); break; }
    case 'error': {
      if (agent === 'scout') { ch('scout').state = 'needs_you'; ch('scout').line = data.message ?? ''; }
      break;
    }
    default: break;
  }
  return s;
}
