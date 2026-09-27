#!/usr/bin/env node
/**
 * Builds reel JSON files for the landing page animated windows.
 * Reads real recorded runs from web/public/data/runs/<run>/f/events.ndjson
 * and writes web/public/data/reels/<run>.json
 */
import fs from 'fs';
import path from 'path';
import { redactSecrets } from '../src/redact.js';

const RUNS = [
  { dir: 'acme-shop-3c0bc2b2', name: 'acme-shop' },
  { dir: 'real-16-v2-GeekyAnts__express-typescript', name: 'geekyants' },
  { dir: 'real-16-v2-Louis3797__express-ts-auth-service', name: 'louis3797' },
];

const KINDS = {
  'scout.phase': 'step',
  'scout.facts': 'step',
  'planner.phase': 'step',
  'planner.plan': 'step',
  'runner.phase': 'step',
  'runner.step.start': 'step',
  'runner.step.end': (d) => d.data?.status === 'failed' ? 'fail' : d.data?.status === 'passed' ? 'pass' : 'step',
  'runner.step.log': 'step',
  'runner.note': 'step',
  'doctor.phase': 'step',
  'doctor.diagnosis': 'diagnosis',
  'doctor.fix': 'fix',
  'doctor.evidence': (d) => d.data?.status === 'verified' ? 'verified' : 'step',
  'verifier.phase': 'step',
  'verifier.replay.start': 'replay',
  'verifier.step.start': 'step',
  'verifier.step.end': (d) => d.data?.status === 'failed' ? 'fail' : d.data?.status === 'passed' ? 'pass' : 'step',
  'scribe.phase': 'step',
  'scribe.artifact': 'step',
  'scribe.passport': 'verified',
  'swarm.repo.start': 'step',
  'swarm.repo.progress': 'step',
  'swarm.repo.done': (d) => d.data?.verdict === 'VERIFIED' ? 'verified' : d.data?.verdict === 'PARTIAL' ? 'pass' : 'fail',
  'planner.step.inserted': 'step',
};

function getKind(agent, type, data) {
  const key = `${agent}.${type}`;
  const k = KINDS[key];
  if (typeof k === 'function') return k(data);
  return k || 'step';
}

function extractText(data) {
  const d = data.data || data;
  if (d.message) return d.message;
  if (d.command) return d.command;
  if (d.diagnosis?.cause) return d.diagnosis.cause;
  if (d.fix?.doc?.text) return d.fix.doc.text;
  if (d.plan?.steps) return `Planned ${d.plan.steps.length} steps`;
  if (d.facts?.stack) return `Scout: ${d.facts.stack} project`;
  if (d.stepId && d.n) return `Step ${d.stepId} attempt ${d.n}`;
  if (d.stepId) return `Step ${d.stepId}`;
  if (d.phase) return `Phase: ${d.phase}`;
  if (d.verdict) return `Verdict: ${d.verdict}`;
  if (d.status) return `Status: ${d.status}`;
  return JSON.stringify(d).slice(0, 80);
}

function extractStepId(data) {
  const d = data.data || data;
  return d.stepId || d.id || d.slug || null;
}

function extractEvidenceId(data) {
  const d = data.data || data;
  return d.id || d.evidenceId || null;
}

function parseEvents(file) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.trim().split('\n');
  const events = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      events.push(e);
    } catch {
      // skip malformed
    }
  }
  return events;
}

function buildReel(runDir, runName) {
  const eventsFile = path.join('web/public/data/runs', runDir, 'f', 'events.ndjson');
  const events = parseEvents(eventsFile);
  
  // Find start time
  const startTime = new Date(events[0]?.t || Date.now()).getTime();
  
  // Find replaySeconds from passport/verifier.replay.end
  let replaySeconds = 0;
  for (const e of events) {
    if (e.type === 'replay.end' && e.data?.durationMs) {
      replaySeconds = Math.round(e.data.durationMs / 1000);
      break;
    }
    if (e.type === 'passport' && e.data?.replaySeconds) {
      replaySeconds = e.data.replaySeconds;
      break;
    }
    if (e.type === 'repo.done' && e.data?.passport?.replaySeconds) {
      replaySeconds = e.data.passport.replaySeconds;
      break;
    }
  }
  
  // Find README fix for one fix (replace-command, prerequisite, or insert-step)
  let readmeFix = null;
  
  // First, get the initial plan to find README commands
  let initialPlan = null;
  for (const e of events) {
    if (e.type === 'plan' && e.data?.steps) {
      initialPlan = e.data;
      break;
    }
  }
  
  // Find a fix with a replace-command (README command replacement)
  if (initialPlan) {
    for (const e of events) {
      if (e.type === 'fix' && e.data?.fix?.doc?.kind === 'replace-command' && e.data?.stepId) {
        const step = initialPlan.steps.find(s => s.id === e.data.stepId);
        if (step && step.source?.file === 'README.md' && step.command) {
          readmeFix = {
            kind: 'replace',
            before: step.command,
            after: e.data.fix.doc.text,
            anchor: step.command,
          };
          break;
        }
      }
    }
  }
  
  // If no replace-command found, try prerequisite
  if (!readmeFix && initialPlan) {
    for (const e of events) {
      if (e.type === 'fix' && e.data?.fix?.doc?.kind === 'prerequisite' && e.data?.stepId) {
        const step = initialPlan.steps.find(s => s.id === e.data.stepId);
        if (step && step.source?.file === 'README.md' && step.command) {
          readmeFix = {
            kind: 'replace',
            before: step.command,
            after: e.data.fix.doc.text,
            anchor: step.command,
          };
          break;
        }
      }
    }
  }
  
  // If still not found, try insert-step (new step inserted before a README step)
  if (!readmeFix && initialPlan) {
    for (const e of events) {
      if (e.type === 'fix' && e.data?.fix?.doc?.kind === 'insert-step' && e.data?.stepId) {
        const step = initialPlan.steps.find(s => s.id === e.data.stepId);
        if (step && step.source?.file === 'README.md' && step.command) {
          // For insert-step, the fix is inserting BEFORE this step
          readmeFix = {
            kind: 'insert',
            before: null,
            after: e.data.fix.doc.text,
            anchor: step.command,
          };
          break;
        }
      }
    }
  }
  
  // Filter and map to beats
  const beats = [];
  let stepCount = 0;
  
  for (const e of events) {
    const agent = e.agent;
    const type = e.type;
    const kind = getKind(agent, type, e);
    
    // Skip some noisy types
    if (type === 'step.log' && !e.data?.chunk?.includes('error') && !e.data?.chunk?.includes('ECONNREFUSED') && !e.data?.chunk?.includes('Missing') && !e.data?.chunk?.includes('required') && !e.data?.chunk?.includes('not found')) {
      continue;
    }
    if (type === 'note' && !e.data?.message?.includes('ready') && !e.data?.message?.includes('switching') && !e.data?.message?.includes('replaying')) {
      continue;
    }
    if (type === 'phase' && agent === 'runner') continue;
    
    const text = redactSecrets(extractText(e));
    const stepId = extractStepId(e);
    const evidenceId = extractEvidenceId(e);
    
    const t = (new Date(e.t).getTime() - startTime) / 1000;
    
    beats.push({
      t: Math.round(t * 10) / 10,
      agent,
      kind,
      text: text.slice(0, 80),
      stepId,
      evidenceId,
    });
    
    if (beats.length >= 25) break;
  }
  
  const builtLines = buildLines(runDir, initialPlan, events);
  return {
    name: runName,
    beats,
    readmeFix,
    replaySeconds,
    lines: builtLines,
    firstFailIndex: findFirstFailIndex(beats, builtLines),
    fixIndex: findFixIndex(beats, builtLines),
  };
}

function findFixIndex(beats, lines) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].kind === 'fix') {
      return i;
    }
  }
  return -1;
}

function findFirstFailIndex(beats, lines) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].kind === 'fail') {
      return i;
    }
  }
  return -1;
}

function buildLines(runDir, initialPlan, events) {
  const lines = [];
  const runDirPath = path.join('web/public/data/runs', runDir, 'f');
  let plan = initialPlan;
  
  // If we have the initial plan, extract lines from it
  if (plan && plan.steps) {
    for (const step of plan.steps) {
      if (step.command && step.source?.file === 'README.md') {
        lines.push({
          kind: 'cmd',
          text: step.command,
          agent: 'planner',
          seconds: 0, // Will be filled from events
        });
        if (step.why) {
          lines.push({
            kind: 'why',
            text: step.why,
            agent: 'planner',
            seconds: 0,
          });
        }
      }
    }
  }
  
  // Add actual event-based lines with timing
  const startTime = new Date(events[0]?.t || Date.now()).getTime();
  
  for (const e of events) {
    const agent = e.agent;
    const type = e.type;
    const kind = getKind(agent, type, e);
    const text = redactSecrets(extractText(e));
    const t = (new Date(e.t).getTime() - startTime) / 1000;
    
    if (kind === 'step' && type === 'step.start' && e.data?.command) {
      lines.push({
        kind: 'cmd',
        text: e.data.command,
        agent,
        seconds: Math.round(t * 10) / 10,
      });
    } else if (kind === 'fail') {
      lines.push({
        kind: 'fail',
        text: text,
        agent,
        seconds: Math.round(t * 10) / 10,
      });
    } else if (kind === 'pass') {
      lines.push({
        kind: 'pass',
        text: text,
        agent,
        seconds: Math.round(t * 10) / 10,
      });
    } else if (kind === 'diagnosis') {
      lines.push({
        kind: 'diag',
        text: text,
        agent,
        seconds: Math.round(t * 10) / 10,
      });
    } else if (kind === 'fix') {
      lines.push({
        kind: 'fix',
        text: text,
        agent,
        seconds: Math.round(t * 10) / 10,
      });
    } else if (kind === 'verified') {
      lines.push({
        kind: 'verified',
        text: text,
        agent,
        seconds: Math.round(t * 10) / 10,
      });
    }
  }
  
  // Deduplicate lines with same text and agent
  const seen = new Set();
  return lines.filter(line => {
    const key = `${line.agent}:${line.kind}:${line.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function main() {
  const outDir = 'web/public/data/reels';
  fs.mkdirSync(outDir, { recursive: true });
  
  for (const run of RUNS) {
    const reel = buildReel(run.dir, run.name);
    const outFile = path.join(outDir, `${run.name}.json`);
    fs.writeFileSync(outFile, JSON.stringify(reel, null, 2));
    console.log(`Wrote ${outFile} (${reel.beats.length} beats, replaySeconds=${reel.replaySeconds})`);
  }
}

main();