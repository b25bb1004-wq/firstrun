/**
 * Time-lost estimate (tunable heuristic — not measured data).
 * All numbers are minutes per break category; edit freely.
 */
export const MINUTES_PER_BREAK = {
  // diagnosis.by === 'bob' takes precedence over class
  'bob-needed':       { label: 'Needed IBM Bob to diagnose', minutes: 40 },
  'missing-dep':      { label: 'Missing package / tool not installed', minutes: 10 },  // class: missing-dependency | missing-tool | rule: deps-not-installed
  'version-pin':      { label: 'Runtime version mismatch', minutes: 20 },             // class: runtime-version
  'missing-env':      { label: 'Undocumented environment variable', minutes: 25 },    // class: missing-env
  'other':            { label: 'Other setup break (our own assumption)', minutes: 15 },// any other class
};

const CLASS_TO_KEY = {
  'missing-dependency': 'missing-dep',
  'missing-tool':       'missing-dep',
  'deps-not-installed': 'missing-dep',  // rule id used as class fallback
  'runtime-version':    'version-pin',
  'missing-env':        'missing-env',
};

/** Map one evidence record to its { key, label, minutes } category. */
export function categoryOf(ev) {
  if (ev.diagnosis?.by === 'bob') return { key: 'bob-needed', ...MINUTES_PER_BREAK['bob-needed'] };
  const key = CLASS_TO_KEY[ev.diagnosis?.ruleId] || CLASS_TO_KEY[ev.diagnosis?.class] || 'other'; // rule id first: deps-not-installed reports class 'wrong-order'
  return { key, ...MINUTES_PER_BREAK[key] };
}

/**
 * Estimate developer time lost to setup breaks.
 * @param {{ evidence: object[], replay: object|null, passport: object, runMs: number }} args
 */
export function estimateTimeLost({ evidence, replay, passport, runMs }) {
  const perBreak = evidence.map((ev) => {
    const { key, label, minutes } = categoryOf(ev);
    return { id: ev.id, category: { key, label }, minutes, fixed: ev.status === 'verified' };
  });
  const beforeMinutes = perBreak.reduce((s, b) => s + b.minutes, 0);
  const fullyFixed = replay?.status === 'passed' && passport.needsHuman === 0;
  const afterMinutes = fullyFixed ? 0 : perBreak.filter((b) => !b.fixed).reduce((s, b) => s + b.minutes, 0);
  return {
    estimate: true,
    table: Object.entries(MINUTES_PER_BREAK).map(([key, v]) => ({ key, ...v })),
    perBreak,
    beforeMinutes,
    afterMinutes,
    real: {
      breaks: evidence.length,
      runSeconds: Math.round((runMs || 0) / 1000),
      replaySeconds: passport.replaySeconds || 0,
    },
  };
}
