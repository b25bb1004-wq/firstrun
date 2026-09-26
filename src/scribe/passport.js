import { fmtDuration } from '../util.js';

export function buildPassport({ plan, evidence, replay, bobcoins, stopped, packageCache = true }) {
  const fromReadme = plan.steps.filter((s) => s.origin === 'readme' && !s.skip).length;
  const breaksFound = evidence.length;
  const breaksFixed = evidence.filter((e) => e.status === 'verified').length;
  const needsHuman = plan.steps.filter((s) => s.status === 'needs-human').length;
  let verdict = 'FAILED';
  if (replay?.status === 'passed' && needsHuman === 0) verdict = 'VERIFIED';
  else if (replay?.status === 'passed' || (!stopped && breaksFixed > 0)) verdict = 'PARTIAL';
  return {
    repo: plan.repo,
    commit: plan.commit,
    verifiedAt: new Date().toISOString(),
    verdict,
    image: plan.image,
    runtime: `${plan.runtime.name === 'node' ? 'Node.js' : plan.runtime.name === 'python' ? 'Python' : plan.runtime.name} ${plan.runtime.version}`,
    stepsTotal: plan.steps.filter((s) => !s.skip).length,
    stepsFromReadme: fromReadme,
    breaksFound,
    breaksFixed,
    needsHuman,
    replaySeconds: replay ? Math.round(replay.durationMs / 1000) : 0,
    packageCache: Boolean(replay && packageCache),
    bobcoins: Math.round((bobcoins || 0) * 100) / 100,
    diagnosedByBob: evidence.filter((e) => e.diagnosis?.by === 'bob').length,
    verify: plan.verify,
  };
}

const COLORS = { VERIFIED: '#1f9d55', PARTIAL: '#d97706', FAILED: '#dc2626' };

/** A shields.io-style badge, self-contained so it renders on GitHub. */
export function passportBadge(p) {
  const left = 'HUMBLE';
  const right = p.verdict === 'VERIFIED' ? `verified · ${fmtDuration(p.replaySeconds * 1000)}` : p.verdict === 'PARTIAL' ? `partly verified · ${p.breaksFixed}/${p.breaksFound} fixed` : 'setup broken';
  const w = (s) => Math.round(s.length * 6.6 + 16);
  const lw = w(left) + 14, rw = w(right);
  const total = lw + rw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${left}: ${right}">
  <title>${left}: ${right}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#16181d"/>
    <rect x="${lw}" width="${rw}" height="20" fill="${COLORS[p.verdict]}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10.5l2.2 2.2L13.5 8"/></g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${14 + (lw - 14) / 2}" y="14">${left}</text>
    <text x="${lw + rw / 2}" y="14">${right}</text>
  </g>
</svg>
`;
}
