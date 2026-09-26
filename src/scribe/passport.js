import { fmtDuration } from '../util.js';
import { computeAttribution, attributeEvidence } from './attribution.js';

export function buildPassport({ plan, evidence, replay, bobcoins, stopped, packageCache = true }) {
  const fromReadme = plan.steps.filter((s) => s.origin === 'readme' && !s.skip).length;
  
  // Compute attribution
  const { repoBreaks, suiteIssues, needsPerson, humbleUnknowns } = computeAttribution(evidence);
  
  // breaksFound = repoBreaks for compatibility (only repo breaks count as "breaks")
  const breaksFound = repoBreaks;
  
  // breaksFixed counts only verified repo breaks
  const breaksFixed = evidence.filter((e) => 
    e.status === 'verified' && attributeEvidence(e) === 'repo'
  ).length;
  
  const needsHuman = plan.steps.filter((s) => s.status === 'needs-human').length;
  
  // Verdict (Friday's review): the v1 rules stay, so a repo whose breaks HUMBLE found AND fixed is still VERIFIED
  // (koa 2/2, GeekyAnts 4/4). The one addition: when what is left unresolved is only HUMBLE's own limits
  // (unknown failures), the repo is INCONCLUSIVE, never FAILED on our account.
  const replayPassed = replay?.status === 'passed';
  const unresolved = evidence.filter((e) => e.status !== 'verified' && e.status !== 'progressed');
  let verdict = 'FAILED';
  // VERIFIED: the replay passed and nothing is left unresolved (fixed breaks are fine).
  if (replayPassed && needsHuman === 0 && unresolved.length === 0) verdict = 'VERIFIED';
  // The setup did not replay, and everything still open is HUMBLE's own limit: we can't judge this repo.
  else if (!replayPassed && unresolved.length && unresolved.every((e) => attributeEvidence(e) === 'humble')) verdict = 'INCONCLUSIVE';
  else if (replayPassed || (!stopped && breaksFixed > 0)) verdict = 'PARTIAL';
  
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
    // New fields
    repoBreaks,
    suiteIssues,
    needsPerson,
    humbleUnknowns,
    replaySeconds: replay ? Math.round(replay.durationMs / 1000) : 0,
    packageCache: Boolean(replay && packageCache),
    bobcoins: Math.round((bobcoins || 0) * 100) / 100,
    diagnosedByBob: evidence.filter((e) => e.diagnosis?.by === 'bob').length,
    verify: plan.verify,
  };
}

const COLORS = { 
  VERIFIED: '#1f9d55', 
  PARTIAL: '#d97706', 
  FAILED: '#dc2626',
  INCONCLUSIVE: '#6366f1',
  'NO-SETUP-DOCS': '#9ca3af'
};

/** A shields.io-style badge, self-contained so it renders on GitHub. */
export function passportBadge(p) {
  const left = 'HUMBLE';
  let right;
  switch (p.verdict) {
    case 'VERIFIED':
      right = `verified · ${fmtDuration(p.replaySeconds * 1000)}`;
      break;
    case 'PARTIAL':
      right = `partly verified · ${p.breaksFixed}/${p.breaksFound} fixed`;
      break;
    case 'INCONCLUSIVE':
      right = `inconclusive · ${p.humbleUnknowns} humble unknown${p.humbleUnknowns !== 1 ? 's' : ''}`;
      break;
    case 'NO-SETUP-DOCS':
      right = 'no setup docs';
      break;
    default:
      right = 'setup broken';
  }
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