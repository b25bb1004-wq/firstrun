import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import { rewriteDoc } from './readme.js';
import { buildPassport, passportBadge } from './passport.js';
import { renderReport } from './report.js';
import { devcontainer, workflow, bobGuide } from './extras.js';
import { serviceKind } from '../doctor/services.js';
import { ensureDir, writeJson, run, readText, errorSignature, redactTokens, redactDeep } from '../util.js';
import { estimateTimeLost } from '../time-lost.js';

/** Unified diff between two texts, via git (always available where FirstRun runs). */
export async function unifiedDiff(a, b, label) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'firstrun-diff-'));
  const fa = path.join(tmp, 'a'), fb = path.join(tmp, 'b');
  fs.writeFileSync(fa, a ?? '');
  fs.writeFileSync(fb, b ?? '');
  const r = await run('git', ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', 'diff', '--no-index', '--no-color', '-U3', fa, fb]);
  fs.rmSync(tmp, { recursive: true, force: true });
  return r.out.split('\n').filter((l) => !l.startsWith('warning: ')).join('\n')
    .replace(/^diff --git .*$/m, `diff --git a/${label} b/${label}`)
    .replace(/^--- .*$/m, a == null ? '--- /dev/null' : `--- a/${label}`)
    .replace(/^\+\+\+ .*$/m, `+++ b/${label}`)
    .replace(/^index .*\n/m, '')
    .replace(/^new file mode .*\n/m, '');
}

/**
 * Write everything a maintainer needs: the corrected docs, patched config, the
 * Setup Passport, the evidence report, a devcontainer, the drift guard and the
 * Bob guide mode. `out/pr/` mirrors the repo, ready to commit as one PR.
 */
export async function publish({ root, outDir, facts, plan, evidence, patched, replay, firstFailure, rec, bobcoins, stopped, packageCache = true, timeLost = null }) {
  const out = ensureDir(path.join(outDir, 'out'));
  const prDir = path.join(out, 'pr');
  fs.rmSync(prDir, { recursive: true, force: true });
  const passport = buildPassport({ plan, evidence, replay, bobcoins, stopped, packageCache });
  if (timeLost) {
    const tl = estimateTimeLost({ evidence, replay, passport, runMs: timeLost.runMs });
    passport.timeLost = { beforeMinutes: tl.beforeMinutes, afterMinutes: tl.afterMinutes, estimate: true, real: tl.real };
    if (rec) rec.state.timeLost = tl;
  }
  const files = {}; // repo-relative path → { original, content }

  // Corrected docs
  const docFiles = [...new Set(plan.steps.map((s) => s.source?.file).filter((f) => f && /\.(md|markdown)$/i.test(f)))];
  for (const d of docFiles) {
    const r = rewriteDoc({ root, docFile: d, plan, evidence, passport: d === facts.docs[0] ? passport : null });
    if (r && r.content !== r.original) files[d] = { original: r.original, content: redactTokens(r.content) };
  }
  for (const p of patched) files[p.path] = { original: p.original, content: redactTokens(p.content) };

  // Services the verified setup needs (for the devcontainer)
  const services = [];
  const composeText = files[facts.compose?.file]?.content ?? (facts.compose ? readText(path.join(root, facts.compose.file)) : null);
  if (composeText) {
    try {
      for (const [name, s] of Object.entries(YAML.parse(composeText)?.services || {})) {
        if (s?.image && serviceKind(s.image, name)) services.push({ name, image: s.image, env: Array.isArray(s.environment) ? Object.fromEntries(s.environment.map((e) => String(e).split(/=(.*)/s).slice(0, 2))) : s.environment || {} });
      }
    } catch {}
  }
  for (const e of evidence) for (const a of e.fix?.actions || []) {
    if (a.type === 'service' && !services.some((s) => s.name === a.name)) services.push({ name: a.name, image: a.image, env: a.env || {} });
  }

  const extra = {
    'FIRSTRUN.md': renderReport({ passport, plan, evidence, firstFailure, conflicts: plan.conflicts }),
    '.github/firstrun/passport.svg': passportBadge(passport),
    '.github/firstrun/passport.json': JSON.stringify(passport, null, 2) + '\n',
    '.github/firstrun/plan.json': JSON.stringify(verifiedPlan(plan, passport, evidence), null, 2) + '\n',
    '.github/workflows/firstrun.yml': workflow(),
    ...bobGuide({ plan, evidence, passport }),
  };
  if (!facts.files.some((f) => f.startsWith('.devcontainer/'))) Object.assign(extra, devcontainer({ plan, services, name: plan.repo.split('/').pop() }).files);
  for (const [p, content] of Object.entries(extra)) files[p] = { original: readText(path.join(root, p)), content: redactTokens(content) };
  const gi = withGitignore(readText(path.join(root, '.gitignore')));
  if (gi) files['.gitignore'] = { original: readText(path.join(root, '.gitignore')), content: gi };

  // Write the PR tree + diffs
  let allDiff = '';
  for (const [p, f] of Object.entries(files)) {
    const dest = path.join(prDir, p);
    ensureDir(path.dirname(dest));
    const cleanContent = redactTokens(f.content);
    fs.writeFileSync(dest, cleanContent);
    const d = await unifiedDiff(f.original, cleanContent, p);
    allDiff += d;
    if (p === facts.docs[0]) {
      fs.writeFileSync(path.join(out, 'README.diff'), d);
      fs.writeFileSync(path.join(out, 'README.md'), cleanContent);
      rec.artifact('README.diff', 'out/README.diff');
    }
  }
  fs.writeFileSync(path.join(out, 'changes.diff'), allDiff);
  fs.writeFileSync(path.join(out, 'FIRSTRUN.md'), redactTokens(files['FIRSTRUN.md'].content));
  fs.writeFileSync(path.join(out, 'passport.svg'), files['.github/firstrun/passport.svg'].content);
  writeJson(path.join(out, 'passport.json'), redactDeep(passport, { tokensOnly: true }));
  writeJson(path.join(out, 'files.json'), Object.keys(files));
  for (const [name, rel] of [['changes.diff', 'out/changes.diff'], ['FIRSTRUN.md', 'out/FIRSTRUN.md'], ['passport.svg', 'out/passport.svg'], ['pr', 'out/pr']]) rec.artifact(name, rel);
  rec.emitEvent('scribe', 'passport', passport);
  return { passport, files: Object.keys(files) };
}

/** The plan as committed to the repo: what the drift guard replays in CI. */
function verifiedPlan(plan, passport, evidence = []) {
  return {
    firstrun: 1,
    verifiedAt: passport.verifiedAt,
    commit: plan.commit,
    image: plan.image,
    runtime: plan.runtime,
    verify: plan.verify,
    steps: plan.steps.filter((s) => !s.skip && s.status !== 'needs-human').map((s) => ({
      id: s.id, command: s.command, kind: s.kind, ...(s.serve ? { serve: s.serve } : {}), ...(s.origin === 'repair' ? { origin: 'repair' } : {}),
      ...(s.prereqs?.length ? { prereqs: s.prereqs } : {}),
    })),
    // What newcomers may still hit on their own machines, and the verified fix for each.
    knownFailures: evidence.filter((e) => e.status === 'verified').map((e) => ({
      signature: errorSignature(e.before.logTail),
      cause: e.diagnosis.cause,
      fix: e.fix?.doc?.text || '',
      evidence: e.id,
    })).filter((k) => k.signature),
  };
}

function withGitignore(text) {
  if (text && /^\/?\.firstrun\/?\s*$/m.test(text)) return null;
  return `${text ? `${text.replace(/\s*$/, '')}\n\n` : ''}# FirstRun local run output (the verified plan lives in .github/firstrun/)\n.firstrun/\n`;
}
