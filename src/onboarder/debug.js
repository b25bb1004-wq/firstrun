import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { redactSecrets, REDACTED } from '../redact.js';
import { RULES, cmpVersion } from '../doctor/rules.js';
import { askBob as realAskBob } from '../brain/bob.js';

/**
 * AI-Assisted Debugger
 * 
 * Capture: redacted, last 200 lines, env var names only
 * Breadcrumbs: last 10 events
 * Fingerprint: normalize paths, versions, hashes, ports; hash; match against audit/v2-31-final and audit/real-16-v2
 * diffAgainstProof: hostSnapshot vs runDir/stepId
 * diagnose: doctor rules first, then Bob debugger mode with evidence pack (maxCost 0.2)
 * report: redacted Markdown with attribution (rules/BOB/verified) and Bobcoin spend
 */

const MAX_CAPTURE_LINES = 200;
const MAX_BREADCRUMBS = 10;
const MAX_BOB_COST_DEBUG = 0.2;

/**
 * Redact a capture for safe transmission to Bob
 * Keeps only env var NAMES, not values
 */
function captureFailure({ exitCode, output, command, cwd, duration, hostSnapshot, stepId, envVarNames = [] }) {
  const lines = output.split('\n');
  const lastLines = lines.slice(-MAX_CAPTURE_LINES);
  
  // Redact output
  const redactedOutput = redactSecrets(lastLines.join('\n'));
  
  // Build host snapshot with only env var NAMES
  const safeHostSnapshot = { ...hostSnapshot };
  if (safeHostSnapshot.envFiles) {
    const envNames = {};
    for (const [file, info] of Object.entries(safeHostSnapshot.envFiles)) {
      if (info && typeof info === 'object' && info.exists) {
        // Handle both object and array formats for keys
        let keysArray = [];
        if (info.keys && typeof info.keys === 'object') {
          if (Array.isArray(info.keys)) {
            keysArray = info.keys;
          } else {
            keysArray = Object.keys(info.keys);
          }
        }
        envNames[file] = { exists: true, keys: keysArray };
      } else {
        envNames[file] = { exists: false };
      }
    }
    safeHostSnapshot.envFiles = envNames;
  }
  
  // Keep only env var names from the guide
  safeHostSnapshot.requiredEnvVars = envVarNames;
  delete safeHostSnapshot.envValues;
  
  return {
    exitCode,
    output: redactedOutput,
    command,
    cwd,
    duration,
    hostSnapshot: safeHostSnapshot,
    stepId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Build breadcrumbs from event log
 */
function buildBreadcrumbs(events, max = MAX_BREADCRUMBS) {
  return events.slice(-max).map((e, i) => ({
    id: `B${i + 1}`,
    type: e.type,
    stepId: e.stepId,
    command: e.command,
    timestamp: e.timestamp,
    status: e.status
  }));
}

/**
 * Normalize a failure for fingerprinting
 * Strips paths, versions, hashes, ports
 */
function normalizeForFingerprint(text) {
  if (!text) return '';
  
  return text
    // Normalize paths
    .replace(/\/[a-zA-Z0-9_\-.\/]+/g, '/PATH')
    .replace(/[A-Za-z]:\\[a-zA-Z0-9_\-.\/]+/g, 'C:\\PATH')
    .replace(/~\/[a-zA-Z0-9_\-.\/]+/g, '~/PATH')
    // Normalize versions (semver)
    .replace(/\b\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?\b/g, 'VERSION')
    .replace(/\bv\d+\.\d+\.\d+\b/g, 'VERSION')
    // Normalize hashes (git commit, etc)
    .replace(/\b[a-f0-9]{7,40}\b/g, 'HASH')
    // Normalize ports
    .replace(/(?:port|:)\s*\d{4,5}/gi, 'PORT:XXXX')
    .replace(/:\d{4,5}(?=\s|$)/g, ':XXXX')
    // Normalize IPs
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP')
    // Normalize hostnames
    .replace(/\b([a-z0-9-]+\.)+[a-z]{2,}\b/g, 'HOSTNAME')
    // Normalize temp paths
    .replace(/\/tmp\/[a-zA-Z0-9_\-.\/]+/g, '/tmp/PATH')
    .replace(/\/var\/folders\/[a-zA-Z0-9_\-.\/]+/g, '/var/folders/PATH')
    // Normalize PIDs
    .replace(/\bpid\s+\d+\b/gi, 'pid XXXX')
    .replace(/\bprocess\s+\d+\b/gi, 'process XXXX')
    // Normalize line numbers in stack traces
    .replace(/:\d+:\d+/g, ':XX:XX')
    .replace(/\(\d+,\d+\)/g, '(XX,XX)')
    // Normalize durations
    .replace(/\d+\.?\d*\s*(ms|s|min|h)\b/g, 'DURATION')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate fingerprint hash from normalized failure
 */
function fingerprint(capture) {
  const normalized = normalizeForFingerprint(
    `${capture.command}\n${capture.output}\n${capture.exitCode}`
  );
  const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return {
    hash,
    normalized,
    matches: []
  };
}

/**
 * Load real audit failures from audit directories
 */
function loadAuditFailures(auditDirs = ['audit/real-16-v2', 'audit/v2-31-final']) {
  const failures = [];
  
  for (const auditDir of auditDirs) {
    const fullPath = path.resolve(auditDir);
    if (!fs.existsSync(fullPath)) continue;
    
    // Try audit.json first
    const auditFile = path.join(fullPath, 'audit.json');
    if (fs.existsSync(auditFile)) {
      try {
        const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
        if (audit.repos) {
          for (const repo of audit.repos) {
            if (repo.runDir && repo.firstFailure) {
              const runDir = path.join(fullPath, repo.runDir);
              if (fs.existsSync(runDir)) {
                const runFile = path.join(runDir, 'run.json');
                if (fs.existsSync(runFile)) {
                  const run = JSON.parse(fs.readFileSync(runFile, 'utf8'));
                  // Find the failed step
                  if (run.steps) {
                    for (const [stepId, step] of Object.entries(run.steps)) {
                      if (step.status === 'failed' && step.logFile) {
                        const logFile = path.join(runDir, step.logFile);
                        if (fs.existsSync(logFile)) {
                          const log = fs.readFileSync(logFile, 'utf8');
                          const fp = fingerprint({
                            command: step.command,
                            output: log,
                            exitCode: step.exitCode || 1
                          });
                          failures.push({
                            repo: repo.slug,
                            stepId,
                            rule: step.ruleId,
                            fingerprint: fp.hash,
                            cause: step.diagnosis?.cause,
                            fix: step.fix
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    // Also check events.ndjson for failures
    const eventsFile = path.join(fullPath, 'events.ndjson');
    if (fs.existsSync(eventsFile)) {
      try {
        const lines = fs.readFileSync(eventsFile, 'utf8').trim().split('\n');
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type === 'step-failed' || event.type === 'failure') {
              const fp = fingerprint({
                command: event.command,
                output: event.output || '',
                exitCode: event.exitCode || 1
              });
              failures.push({
                repo: event.repo,
                stepId: event.stepId,
                rule: event.ruleId,
                fingerprint: fp.hash,
                cause: event.cause,
                fix: event.fix
              });
            }
          } catch {}
        }
      } catch {}
    }
  }
  
  return failures;
}

/**
 * Match fingerprint against known audit failures
 * Returns matches with "seen in N of M real repos, fixed by rule X"
 */
function matchFingerprint(fpHash, auditFailures) {
  const matches = auditFailures.filter(f => f.fingerprint === fpHash);
  
  if (matches.length === 0) {
    return { matched: false, message: 'new failure', matches: [] };
  }
  
  // Group by rule
  const byRule = {};
  for (const m of matches) {
    if (!byRule[m.rule]) byRule[m.rule] = [];
    byRule[m.rule].push(m.repo);
  }
  
  const matchDetails = Object.entries(byRule).map(([rule, repos]) => ({
    rule,
    repos,
    count: repos.length,
    message: `seen in ${repos.length} of ${auditFailures.length} real repos · fixed by rule ${rule}`
  }));
  
  return {
    matched: true,
    message: matchDetails.map(d => d.message).join('; '),
    matches: matchDetails
  };
}

/**
 * Diff host snapshot against the proven run for a step
 */
function diffAgainstProof(hostSnapshot, runDir, stepId) {
  const diffs = [];
  
  // Load the proven run
  const runFile = path.join(runDir, 'run.json');
  if (!fs.existsSync(runFile)) {
    return { diffs: [], error: 'run.json not found' };
  }
  
  const run = JSON.parse(fs.readFileSync(runFile, 'utf8'));
  const step = run.steps?.[stepId];
  if (!step) {
    return { diffs: [], error: `step ${stepId} not found in run` };
  }
  
  // Load the evidence for this step (contains the sandbox env/snapshot)
  const evidenceDir = path.join(runDir, 'evidence');
  if (!fs.existsSync(evidenceDir)) {
    return { diffs: [], error: 'evidence dir not found' };
  }
  
  const evidenceFiles = fs.readdirSync(evidenceDir).filter(f => f.startsWith(stepId) && f.endsWith('.json'));
  let provenSnapshot = null;
  
  for (const f of evidenceFiles) {
    const ev = JSON.parse(fs.readFileSync(path.join(evidenceDir, f), 'utf8'));
    if (ev.after && ev.after.snapshot) {
      provenSnapshot = ev.after.snapshot;
      break;
    }
  }
  
  if (!provenSnapshot) {
    return { diffs: [], error: 'no proven snapshot in evidence' };
  }
  
  // Compare key fields
  const compareFields = [
    { key: 'node', label: 'Node.js', host: hostSnapshot.node, proven: provenSnapshot.node },
    { key: 'npm', label: 'npm', host: hostSnapshot.npm, proven: provenSnapshot.npm },
    { key: 'python', label: 'Python', host: hostSnapshot.python, proven: provenSnapshot.python },
    { key: 'docker', label: 'Docker', host: hostSnapshot.docker?.version, proven: provenSnapshot.docker?.version },
    { key: 'os', label: 'OS', host: `${hostSnapshot.os} ${hostSnapshot.osVersion}`, proven: provenSnapshot.os },
    { key: 'arch', label: 'Arch', host: hostSnapshot.arch, proven: provenSnapshot.arch },
  ];
  
  for (const f of compareFields) {
    if (f.host && f.proven && f.host !== f.proven) {
      diffs.push({
        type: 'version-mismatch',
        field: f.label,
        host: f.host,
        proven: f.proven,
        message: `${f.label}: ${f.host} here · ${f.proven} in the proven run`
      });
    }
  }
  
  // Compare ports
  const hostPorts = new Set(hostSnapshot.ports || []);
  const provenPorts = new Set(provenSnapshot.ports || []);
  for (const port of hostPorts) {
    if (!provenPorts.has(port)) {
      diffs.push({
        type: 'port-in-use',
        field: `port ${port}`,
        host: 'in use',
        proven: 'free',
        message: `port ${port} already in use on host`
      });
    }
  }
  
  // Compare env var names
  const hostEnvNames = new Set();
  if (hostSnapshot.envFiles) {
    for (const info of Object.values(hostSnapshot.envFiles)) {
      if (info && info.keys) {
        for (const k of info.keys) hostEnvNames.add(k);
      }
    }
  }
  const provenEnvNames = new Set();
  if (provenSnapshot.envFiles) {
    for (const info of Object.values(provenSnapshot.envFiles)) {
      if (info && info.keys) {
        for (const k of info.keys) provenEnvNames.add(k);
      }
    }
  }
  
  for (const name of provenEnvNames) {
    if (!hostEnvNames.has(name)) {
      diffs.push({
        type: 'env-missing',
        field: name,
        host: 'not set',
        proven: 'set',
        message: `env var ${name} not set (proven run had it)`
      });
    }
  }
  
  return { diffs };
}

/**
 * Run doctor rules on a capture
 */
async function runDoctorRules(capture, ctx = {}) {
  const context = {
    log: capture.output,
    facts: ctx.facts || {},
    plan: ctx.plan || {},
    sandboxEnv: ctx.sandboxEnv || {},
    sandbox: ctx.sandbox || {},
    tried: ctx.tried || [],
    step: ctx.step || {}
  };
  
  const results = [];
  for (const rule of RULES) {
    try {
      const result = await rule.test(context);
      if (result) {
        results.push({
          ruleId: rule.id,
          class: result.class,
          confidence: result.confidence,
          cause: result.cause,
          fix: result.fix,
          ask: result.ask
        });
      }
    } catch (e) {
      // Rule failed, continue
    }
  }
  
  // Sort by confidence desc
  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

/**
 * Diagnose a failure: doctor rules first, then Bob
 */
async function diagnose(capture, ctx = {}, { askBob = realAskBob, maxCost = MAX_BOB_COST_DEBUG } = {}) {
  const evidence = [];
  let evidenceId = 0;
  
  function addEvidence(source, data) {
    evidenceId++;
    const id = `E${evidenceId}`;
    evidence.push({ id, source, data });
    return id;
  }
  
  // 1. Add capture as evidence
  const captureId = addEvidence('capture', {
    exitCode: capture.exitCode,
    command: capture.command,
    cwd: capture.cwd,
    duration: capture.duration,
    outputLines: capture.output.split('\n').length
  });
  
  // 2. Add host snapshot
  const hostSnapId = addEvidence('host-snapshot', capture.hostSnapshot);
  
  // 3. Add breadcrumbs
  const breadcrumbsId = addEvidence('breadcrumbs', ctx.breadcrumbs || []);
  
  // 4. Run fingerprint
  const fp = fingerprint(capture);
  const fpId = addEvidence('fingerprint', { hash: fp.hash, normalized: fp.normalized });
  
  // 5. Match against audit failures
  const auditFailures = loadAuditFailures();
  const match = matchFingerprint(fp.hash, auditFailures);
  const matchId = addEvidence('fingerprint-match', match);
  
  // 6. Diff against proof
  const diff = diffAgainstProof(capture.hostSnapshot, ctx.runDir, capture.stepId);
  const diffId = addEvidence('host-vs-proof-diff', diff);
  
  // 7. Run doctor rules
  const doctorResults = await runDoctorRules(capture, ctx);
  const doctorIds = doctorResults.map((r, i) => addEvidence('doctor-rule', {
    ruleId: r.ruleId,
    class: r.class,
    confidence: r.confidence,
    cause: r.cause,
    hasFix: !!r.fix
  }));
  
  // If doctor rules found a high-confidence match, use it
  const topRule = doctorResults[0];
  if (topRule && topRule.confidence >= 0.85 && topRule.fix) {
    return {
      cause: topRule.cause,
      evidence: [captureId, hostSnapId, breadcrumbsId, fpId, matchId, diffId, doctorIds[0]],
      fix: {
        command: topRule.fix.actions?.[0]?.command || topRule.fix.doc?.text || '',
        why: topRule.cause,
        checker: { type: 'exit', code: 0 },
        undo: topRule.fix.actions?.[0]?.type === 'replace-step' ? { type: 'none' } : { type: 'run', command: 'echo "manual undo needed"' }
      },
      confidence: topRule.confidence,
      attributedTo: 'rules',
      evidencePack: evidence,
      bobCost: 0
    };
  }
  
  // 8. Ask Bob (debugger mode) with evidence pack
  if (askBob && maxCost > 0) {
    const bobRequest = buildBobDebugRequest(capture, ctx, evidence, match, diff, doctorResults);
    const res = await askBob({
      mode: 'firstrun-debugger',
      request: bobRequest,
      workspace: ctx.repoDir || process.cwd(),
      maxCost,
      maxTurns: 8,
      name: 'debug'
    });
    
    if (res.ok && res.json && res.json.evidence && Array.isArray(res.json.evidence) && res.json.evidence.length > 0) {
      // Validate that all cited evidence IDs exist
      const validIds = new Set(evidence.map(e => e.id));
      const allValid = res.json.evidence.every(id => validIds.has(id));
      
      if (allValid && res.json.fix && res.json.fix.command) {
        return {
          cause: res.json.cause,
          evidence: res.json.evidence,
          fix: res.json.fix,
          confidence: res.json.confidence || 0.7,
          attributedTo: 'BOB',
          evidencePack: evidence,
          bobCost: res.bobcoins || 0
        };
      }
    }
    
    // Bob answer discarded - no evidence IDs or invalid
    return {
      cause: doctorResults[0]?.cause || 'Unknown failure',
      evidence: doctorIds.length > 0 ? [doctorIds[0]] : [captureId],
      fix: doctorResults[0]?.fix ? {
        command: doctorResults[0].fix.actions?.[0]?.command || doctorResults[0].fix.doc?.text || '',
        why: doctorResults[0].cause,
        checker: { type: 'exit', code: 0 },
        undo: { type: 'none' }
      } : null,
      confidence: doctorResults[0]?.confidence || 0.3,
      attributedTo: 'rules',
      evidencePack: evidence,
      bobCost: res.bobcoins || 0,
      bobError: 'Bob answer discarded: missing or invalid evidence citations'
    };
  }
  
  // Fallback to top doctor rule or generic
  if (topRule) {
    return {
      cause: topRule.cause,
      evidence: [captureId, hostSnapId, breadcrumbsId, fpId, matchId, diffId, doctorIds[0]],
      fix: topRule.fix ? {
        command: topRule.fix.actions?.[0]?.command || topRule.fix.doc?.text || '',
        why: topRule.cause,
        checker: { type: 'exit', code: 0 },
        undo: topRule.fix.actions?.[0]?.type === 'replace-step' ? { type: 'none' } : { type: 'run', command: 'echo "manual undo needed"' }
      } : null,
      confidence: topRule.confidence,
      attributedTo: 'rules',
      evidencePack: evidence,
      bobCost: 0
    };
  }
  
  return {
    cause: 'Unknown failure - no rule matched and no Bob available',
    evidence: [captureId, hostSnapId, breadcrumbsId, fpId, matchId, diffId],
    fix: null,
    confidence: 0.1,
    attributedTo: 'rules',
    evidencePack: evidence,
    bobCost: 0
  };
}

/**
 * Build the request for Bob debugger mode
 */
function buildBobDebugRequest(capture, ctx, evidence, match, diff, doctorResults) {
  const evidenceText = evidence.map(e => `[${e.id}] ${e.source}: ${JSON.stringify(e.data).slice(0, 500)}`).join('\n');
  const doctorText = doctorResults.map((r, i) => `Rule ${r.ruleId} (confidence ${r.confidence}): ${r.cause}`).join('\n') || 'No rules matched';
  
  return `# HUMBLE Debug Request

A setup step failed on the user's machine. Find the root cause and propose ONE fix as a guide step.

## Failed Step
- Step ID: ${capture.stepId}
- Command: \`${capture.command}\`
- Exit code: ${capture.exitCode}
- Duration: ${capture.duration}ms
- CWD: ${capture.cwd}

## Evidence Pack (cite these IDs in your answer)
${evidenceText}

## Fingerprint Match
${match.matched ? match.message : match.message}

## Host vs Proven Run Diff
${diff.diffs.map(d => `- ${d.message}`).join('\n') || 'No differences found'}

## Doctor Rules Results
${doctorText}

## Your Task
Reply with ONLY one JSON object in a \`\`\`json block:
\`\`\`json
{
  "cause": "root cause in one sentence",
  "evidence": ["E1", "E3"],
  "fix": {
    "command": "exact command to run",
    "why": "why this fixes it",
    "checker": { "type": "exit", "code": 0 },
    "undo": { "type": "run", "command": "undo command or none" }
  },
  "confidence": 0.9
}
\`\`\`

Constraints:
- The fix command MUST NOT reference paths outside the repository
- The fix MUST be a valid guide step (command, why, checker, undo)
- Cite evidence IDs for EVERY claim
- An answer without evidence IDs will be discarded
- maxCost: ${MAX_BOB_COST_DEBUG} Bobcoins`;
}

/**
 * Generate a redacted Markdown report
 */
function report(diagnosis, capture, ctx = {}) {
  const lines = [];
  lines.push(`# Debug Report for Step ${capture.stepId}`);
  lines.push('');
  lines.push(`**Command:** \`${capture.command}\``);
  lines.push(`**Exit Code:** ${capture.exitCode}`);
  lines.push(`**Duration:** ${capture.duration}ms`);
  lines.push(`**CWD:** ${capture.cwd}`);
  lines.push('');
  
  lines.push('## What Happened');
  lines.push('');
  lines.push(capture.output.split('\n').slice(-20).map(l => `> ${l}`).join('\n'));
  lines.push('');
  
  lines.push('## Different from the Proven Run');
  lines.push('');
  const diff = diffAgainstProof(capture.hostSnapshot, ctx.runDir, capture.stepId);
  if (diff.diffs.length > 0) {
    for (const d of diff.diffs) {
      lines.push(`- ${d.message}  \`[${d.type}]\``);
    }
  } else {
    lines.push('No significant differences found.');
  }
  lines.push('');
  
  lines.push('## Likely Cause');
  lines.push('');
  lines.push(`${diagnosis.cause}  *(${diagnosis.attributedTo})*`);
  if (diagnosis.bobCost > 0) {
    lines.push(`Bob spend: ${diagnosis.bobCost.toFixed(4)} Bobcoins`);
  }
  lines.push('');
  
  if (diagnosis.evidence && diagnosis.evidence.length > 0) {
    lines.push('## Evidence');
    lines.push('');
    for (const id of diagnosis.evidence) {
      const ev = diagnosis.evidencePack?.find(e => e.id === id);
      if (ev) {
        lines.push(`- **${id}** (${ev.source}): ${JSON.stringify(ev.data).slice(0, 200)}`);
      }
    }
    lines.push('');
  }
  
  if (diagnosis.fix) {
    lines.push('## Fix');
    lines.push('');
    lines.push(`**Command:** \`${diagnosis.fix.command}\``);
    lines.push(`**Why:** ${diagnosis.fix.why}`);
    lines.push(`**Checker:** \`${JSON.stringify(diagnosis.fix.checker)}\``);
    lines.push(`**Undo:** \`${JSON.stringify(diagnosis.fix.undo)}\``);
    lines.push('');
    lines.push(`*Attribution: ${diagnosis.attributedTo}*`);
    if (diagnosis.attributedTo === 'BOB') {
      lines.push(`*Bob spend: ${diagnosis.bobCost.toFixed(4)} Bobcoins*`);
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push(`*Report generated at ${new Date().toISOString()} by HUMBLE Debugger*`);
  
  return redactSecrets(lines.join('\n'));
}

export { captureFailure as capture, buildBreadcrumbs, fingerprint, matchFingerprint, diffAgainstProof, runDoctorRules, diagnose, report as debugReport };