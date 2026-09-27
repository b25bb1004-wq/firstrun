#!/usr/bin/env node
/**
 * Build a PR comment from a HUMBLE run directory.
 * Updates the same comment on re-runs (hidden marker line), does not spam.
 */

import fs from 'node:fs';
import path from 'node:path';

function readRunDir(runDir) {
  const runJson = path.join(runDir, 'run.json');
  const passportJson = path.join(runDir, 'out', 'passport.json');
  const diffPath = path.join(runDir, 'out', 'README.diff');
  const firstrunMd = path.join(runDir, 'out', 'FIRSTRUN.md');

  if (!fs.existsSync(runJson)) {
    throw new Error(`run.json not found in ${runDir}`);
  }

  const run = JSON.parse(fs.readFileSync(runJson, 'utf8'));
  const passport = fs.existsSync(passportJson) ? JSON.parse(fs.readFileSync(passportJson, 'utf8')) : null;
  const diff = fs.existsSync(diffPath) ? fs.readFileSync(diffPath, 'utf8') : '';
  const report = fs.existsSync(firstrunMd) ? fs.readFileSync(firstrunMd, 'utf8') : '';

  return { run, passport, diff, report };
}

function verdictBadge(verdict) {
  const badges = {
    'VERIFIED': '![VERIFIED](https://img.shields.io/badge/VERIFIED-brightgreen)',
    'PARTIAL': '![PARTIAL](https://img.shields.io/badge/PARTIAL-yellow)',
    'FAILED': '![FAILED](https://img.shields.io/badge/FAILED-red)',
    'INCONCLUSIVE': '![INCONCLUSIVE](https://img.shields.io/badge/INCONCLUSIVE-lightgrey)',
    'ERROR': '![ERROR](https://img.shields.io/badge/ERROR-red)',
  };
  return badges[verdict] || badges['ERROR'];
}

function buildStepsTable(run) {
  if (!run.plan?.steps?.length) return '';

  const steps = run.plan.steps.filter(s => !s.skip);
  const statuses = run.steps || {};

  const rows = steps.map(s => {
    const status = statuses[s.id]?.status || 'pending';
    const statusIcon = {
      'passed': '✅',
      'repaired': '🔧',
      'failed': '❌',
      'needs-human': '⚠️',
      'blocked': '🚫',
      'skipped': '⏭️',
      'pending': '⏳',
    }[status] || '❓';
    const attempts = statuses[s.id]?.attempts || 0;
    const attemptStr = attempts > 1 ? ` (${attempts} tries)` : '';
    return `| ${statusIcon} | ${s.id} | ${s.command} | ${status}${attemptStr} | ${s.kind} |`;
  }).join('\n');

  return `## Steps\n\n| | Step | Command | Status | Kind |\n|---|---|---|---|---|\n${rows}\n`;
}

function buildDiagnosis(run, runDir) {
  if (!run.evidence?.length) return '';

  const evidenceDir = path.join(path.dirname(path.join(runDir, 'run.json')), 'evidence');
  if (!fs.existsSync(evidenceDir)) return '';

  const lines = ['## Diagnosis'];
  for (const eid of run.evidence) {
    const evidencePath = path.join(evidenceDir, `${eid}.json`);
    if (!fs.existsSync(evidencePath)) continue;
    const ev = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    const statusIcon = {
      'verified': '✅',
      'failed': '❌',
      'needs-human': '⚠️',
      'progressed': '➡️',
    }[ev.status] || '❓';
    lines.push(`- ${statusIcon} **${eid} (${ev.stepId})** ${ev.diagnosis.cause}`);
    if (ev.fix?.doc?.text) {
      lines.push(`  - Fix: ${ev.fix.doc.text}`);
    }
  }
  return lines.join('\n') + '\n';
}

function buildDiffBlock(diff) {
  if (!diff.trim()) return '';
  return `## README diff\n\n\`\`\`diff\n${diff}\n\`\`\`\n`;
}

function buildComment(runDir, prNumber, repo, actor, headSha, baseSha) {
  const { run, passport, diff, report } = readRunDir(runDir);
  const verdict = passport?.verdict || (run.phase === 'error' ? 'ERROR' : 'INCONCLUSIVE');
  const replaySeconds = passport?.replaySeconds || 0;

  const marker = `<!-- humble-ci:${prNumber}:${headSha} -->`;
  
  const lines = [
    `### HUMBLE README CI ${verdictBadge(verdict)}`,
    '',
    `**Verdict:** ${verdict}  |  **Replay:** ${replaySeconds}s  |  **Breaks found:** ${passport?.breaksFound || 0}  |  **Breaks fixed:** ${passport?.breaksFixed || 0}`,
    '',
    buildStepsTable(run),
    buildDiagnosis(run, runDir),
    buildDiffBlock(diff),
    `*Triggered by @${actor} · ${headSha.slice(0, 7)} into ${baseSha.slice(0, 7)}*`,
    marker,
  ];

  return lines.join('\n');
}

// Main
const [, , runDir, prNumber, repo, actor, headSha, baseSha] = process.argv;

if (!runDir || !prNumber) {
  console.error('Usage: node comment.js <run-dir> <pr-number> <repo> <actor> <head-sha> <base-sha>');
  process.exit(1);
}

try {
  const comment = buildComment(runDir, prNumber, repo, actor, headSha, baseSha);
  // Output as JSON to avoid issues with special characters
  console.log(JSON.stringify({ body: comment }));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}