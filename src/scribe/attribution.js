/**
 * Attribution logic for evidence records.
 * Every evidence record is attributed to exactly one bucket:
 * - repo: a named rule or Bob with a cause pointing at docs/code
 * - suite: failing-tests or slow-tests (setup works, repo's tests fail/slow)
 * - interactive: needs human interaction (class interactive)
 * - humble: unknown, or cause says no rule recognises it, or budget spent
 */

// Classes that map to "repo" (the repo's setup/docs are at fault)
const REPO_CLASSES = new Set([
  'missing-env',
  'missing-service',
  'missing-tool',
  'runtime-version',
  'wrong-order',
  'missing-dependency',
  'missing-script',
  'docs-mismatch',
  'platform-specific',
  'needs-secret',
  'missing-file',
]);

// Classes that map to "suite" (setup works, repo's tests fail/slow)
const SUITE_CLASSES = new Set([
  'failing-tests',
  'slow-tests',
]);

// Classes that map to "interactive" (needs human interaction)
const INTERACTIVE_CLASSES = new Set([
  'interactive',
]);

/**
 * Determine if an evidence record's diagnosis indicates it's a humble failure.
 * @param {Object} evidence - Evidence record with diagnosis field
 * @returns {boolean} true if this is a humble failure
 */
export function isHumbleFailure(evidence) {
  if (!evidence.diagnosis) return true; // no diagnosis = unknown
  const { class: cls, cause, by, ruleId } = evidence.diagnosis;
  
  // Class is explicitly unknown
  if (cls === 'unknown') return true;
  
  // Cause says no rule recognises it
  if (cause && /no rule recognises/i.test(cause)) return true;
  
  // Bob diagnosis with no ruleId (Bob was asked but couldn't help or budget spent)
  if (by === 'bob' && !ruleId) return true;
  
  return false;
}

/**
 * Attribute a single evidence record to its bucket.
 * @param {Object} evidence - Evidence record
 * @returns {'repo' | 'suite' | 'interactive' | 'humble'}
 */
export function attributeEvidence(evidence) {
  if (!evidence.diagnosis) return 'humble';
  
  const { class: cls } = evidence.diagnosis;
  
  if (isHumbleFailure(evidence)) return 'humble';
  if (INTERACTIVE_CLASSES.has(cls)) return 'interactive';
  if (SUITE_CLASSES.has(cls)) return 'suite';
  if (REPO_CLASSES.has(cls)) return 'repo';
  
  // Default: if we have a ruleId but class isn't in our known sets,
  // treat as humble (conservative)
  if (evidence.diagnosis.ruleId) return 'humble';
  
  return 'humble';
}

/**
 * Compute all attribution counts from evidence array.
 * @param {Array} evidence - Array of evidence records
 * @returns {Object} { repoBreaks, suiteIssues, needsPerson, humbleUnknowns }
 */
export function computeAttribution(evidence) {
  let repoBreaks = 0;
  let suiteIssues = 0;
  let needsPerson = 0;
  let humbleUnknowns = 0;
  
  for (const e of evidence) {
    const bucket = attributeEvidence(e);
    switch (bucket) {
      case 'repo': repoBreaks++; break;
      case 'suite': suiteIssues++; break;
      case 'interactive': needsPerson++; break;
      case 'humble': humbleUnknowns++; break;
    }
  }
  
  return { repoBreaks, suiteIssues, needsPerson, humbleUnknowns };
}

/**
 * Determine verdict with INCONCLUSIVE support.
 * INCONCLUSIVE: only humble unknowns exist (no repo/suite/interactive breaks)
 * @param {Object} params
 * @param {boolean} params.replayPassed
 * @param {boolean} params.stopped
 * @param {number} params.repoBreaks
 * @param {number} params.suiteIssues
 * @param {number} params.needsPerson
 * @param {number} params.humbleUnknowns
 * @param {number} params.breaksFixed - verified repo breaks only
 * @returns {'VERIFIED' | 'PARTIAL' | 'FAILED' | 'INCONCLUSIVE' | 'NO-SETUP-DOCS'}
 */
export function computeVerdict({
  replayPassed,
  stopped,
  repoBreaks,
  suiteIssues,
  needsPerson,
  humbleUnknowns,
  breaksFixed,
}) {
  // If there are no runnable steps at all (handled upstream as NO-SETUP-DOCS)
  
  // If replay passed and no issues at all (no repo breaks, no suite issues, no human needed), it's VERIFIED
  if (replayPassed && needsPerson === 0 && suiteIssues === 0 && repoBreaks === 0) return 'VERIFIED';
  
  // If there are actual repo breaks or suite issues or interactive needs
  const hasRealIssues = repoBreaks > 0 || suiteIssues > 0 || needsPerson > 0;
  
  if (!hasRealIssues) {
    // Only humble unknowns exist
    return 'INCONCLUSIVE';
  }
  
  // Replay passed but there are issues (repo breaks, human needed, or suite issues)
  if (replayPassed) return 'PARTIAL';
  
  // Not stopped and we fixed at least one repo break
  if (!stopped && breaksFixed > 0) return 'PARTIAL';
  
  // Otherwise FAILED
  return 'FAILED';
}