// FirstRun Lens engine: read what was circled (OCR), match it against fixes FirstRun has
// already proven for this project (free, instant), and ask IBM Bob about anything else.
import fs from 'node:fs';
import path from 'node:path';
import { createWorker } from 'tesseract.js';
import { askBob } from '../src/brain/bob.js';

let worker = null;
export async function warmOcr(cachePath) {
  if (!worker) worker = createWorker('eng', 1, { cachePath });
  return worker;
}

export async function ocr(png, cachePath) {
  const w = await warmOcr(cachePath);
  const { data } = await w.recognize(png);
  return (data.text || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------- known fixes
const PLAN_PATHS = [['.github', 'firstrun', 'plan.json'], ['.firstrun', 'out', 'pr', '.github', 'firstrun', 'plan.json']];

/** Verified plans in the project (and, for FirstRun's own repo, its example runs). */
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

// ---------------------------------------------------------------- IBM Bob
export async function askBobAbout({ project, text, question, imageFile }) {
  const request = [
    '# FirstRun Lens: a newcomer circled something on their screen',
    '',
    'They are setting up or working in the repository in this workspace. Below is the text read (by OCR, so it may contain small errors) from the area they circled.',
    imageFile ? `The screenshot of the circled area is at \`${imageFile}\` if you can read images.` : '',
    '',
    '```text',
    text.slice(0, 6000) || '(no text could be read)',
    '```',
    '',
    `Their question: ${question || 'What is this, and what should I do about it?'}`,
    '',
    'Answer for someone new to this project. Look at the repository (README, manifests, config, source, and `.github/firstrun/plan.json` if it exists) before answering, and ground the answer in what you find. Do not change any files.',
    '',
    'Reply with only this JSON object:',
    '```json',
    '{ "answer": "plain-language answer, at most 120 words", "commands": ["shell commands to run, if any"], "files": ["path:line references you relied on"], "confidence": "high | medium | low" }',
    '```',
  ].filter((l) => l !== null).join('\n');
  return askBob({ mode: 'firstrun-guide', request, workspace: project, maxCost: 1, maxTurns: 10, name: 'lens' });
}
