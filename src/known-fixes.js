// Fixes HUMBLE has proven for a project (knownFailures in its verified plan), and fuzzy
// matching of on-screen error text against them. No dependencies: Lens and the tests share it.
import fs from 'node:fs';
import path from 'node:path';

const PLAN_PATHS = [['.github', 'firstrun', 'plan.json'], ['.firstrun', 'out', 'pr', '.github', 'firstrun', 'plan.json']];

/** Verified plans in the project (and, for HUMBLE's own repo, its example runs). */
export function loadKnownFixes(project) {
  const roots = [project];
  const examples = path.join(project, 'examples');
  if (fs.existsSync(examples)) for (const d of fs.readdirSync(examples)) roots.push(path.join(examples, d));
  const fixes = [];
  for (const root of roots) {
    for (const parts of PLAN_PATHS) {
      const f = path.join(root, ...parts);
      if (!fs.existsSync(f)) continue;
      try {
        const plan = JSON.parse(fs.readFileSync(f, 'utf8'));
        for (const k of plan.knownFailures || []) {
          if (k.signature) fixes.push({ ...k, repo: plan.repo || path.basename(root), verifiedAt: plan.verifiedAt || null });
        }
      } catch {}
      break;
    }
  }
  return fixes;
}

const words = (s) => (String(s).toLowerCase().match(/[a-z0-9_]{2,}/g) || []);

/** OCR garbles punctuation, so match on words: most of the signature's words must be in what was circled. */
export function matchKnownFix(text, fixes) {
  const have = new Set(words(text));
  let best = null;
  for (const k of fixes) {
    const need = [...new Set(words(k.signature))];
    if (need.length < 2) continue;
    const score = need.filter((w) => have.has(w)).length / need.length;
    if (score >= 0.7 && (!best || score > best.score)) best = { ...k, score };
  }
  return best;
}
