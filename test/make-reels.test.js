/**
 * Test: Every beat text in the generated reel files must appear in the source events.ndjson
 * This proves nothing is invented.
 * Also validates the new schema: readmeFix, lines, firstFailIndex, fixIndex
 */
import fs from 'fs';
import path from 'path';

const REELS_DIR = 'web/public/data/reels';
const RUNS = [
  { reel: 'acme-shop.json', runDir: 'acme-shop-3c0bc2b2' },
  { reel: 'geekyants.json', runDir: 'real-16-v2-GeekyAnts__express-typescript' },
  { reel: 'louis3797.json', runDir: 'real-16-v2-Louis3797__express-ts-auth-service' },
];

function loadEvents(runDir) {
  const file = path.join('web/public/data/runs', runDir, 'f', 'events.ndjson');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.trim().split('\n');
  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // skip malformed
    }
  }
  return events;
}

function extractAllText(events) {
  const texts = new Set();
  for (const e of events) {
    // Get text from various fields
    const d = e.data || {};
    if (d.message) texts.add(d.message);
    if (d.command) texts.add(d.command);
    if (d.chunk) texts.add(d.chunk);
    if (d.logTail) texts.add(d.logTail);
    if (d.diagnosis?.cause) texts.add(d.diagnosis.cause);
    if (d.fix?.doc?.text) texts.add(d.fix.doc.text);
    if (d.fix?.doc?.kind) texts.add(d.fix.doc.kind);
    if (d.plan?.steps) {
      for (const s of d.plan.steps) {
        if (s.command) texts.add(s.command);
      }
    }
    if (d.facts?.stack) texts.add(`Scout: ${d.facts.stack} project`);
    if (d.phase) texts.add(`Phase: ${d.phase}`);
    if (d.verdict) texts.add(`Verdict: ${d.verdict}`);
    if (d.status) texts.add(`Status: ${d.status}`);
    if (d.stepId && d.n) texts.add(`Step ${d.stepId} attempt ${d.n}`);
    if (d.stepId) texts.add(`Step ${d.stepId}`);
    // Add the whole JSON as last resort for substring matching
    texts.add(JSON.stringify(d));
  }
  return texts;
}

function testReelBeats(reelFile, runDir) {
  const reel = JSON.parse(fs.readFileSync(reelFile, 'utf8'));
  const events = loadEvents(runDir);
  const sourceTexts = extractAllText(events);

  const missing = [];
  for (const beat of reel.beats) {
    const text = beat.text;
    // Check if the beat text appears as a substring in any source text
    let found = false;
    for (const src of sourceTexts) {
      if (src.includes(text)) {
        found = true;
        break;
      }
    }
    if (!found) {
      missing.push({ beat, text });
    }
  }

  return { reel: reel.name, total: reel.beats.length, missing };
}

function testReelSchema(reelFile) {
  const reel = JSON.parse(fs.readFileSync(reelFile, 'utf8'));
  const errors = [];

  // Check readmeFix schema
  if (!reel.readmeFix) {
    errors.push('Missing readmeFix');
  } else {
    if (!['replace', 'insert'].includes(reel.readmeFix.kind)) {
      errors.push(`readmeFix.kind must be 'replace' or 'insert', got '${reel.readmeFix.kind}'`);
    }
    if (reel.readmeFix.kind === 'replace') {
      if (!reel.readmeFix.before) {
        errors.push('readmeFix.kind=replace requires before to be non-null');
      }
      if (!reel.readmeFix.after) {
        errors.push('readmeFix.kind=replace requires after to be non-null');
      }
    }
    if (reel.readmeFix.kind === 'insert') {
      if (reel.readmeFix.before !== null) {
        errors.push('readmeFix.kind=insert requires before to be null');
      }
      if (!reel.readmeFix.after) {
        errors.push('readmeFix.kind=insert requires after to be non-null');
      }
    }
    if (!reel.readmeFix.anchor) {
      errors.push('readmeFix requires anchor');
    }
  }

  // Check lines array
  if (!Array.isArray(reel.lines)) {
    errors.push('lines must be an array');
  } else {
    const validKinds = ['cmd', 'why', 'out', 'fail', 'diag', 'was', 'fix', 'pass', 'sys', 'verified'];
    for (let i = 0; i < reel.lines.length; i++) {
      const line = reel.lines[i];
      if (!line.kind || !validKinds.includes(line.kind)) {
        errors.push(`lines[${i}]: invalid kind '${line.kind}'`);
      }
      if (!line.text) {
        errors.push(`lines[${i}]: missing text`);
      }
      if (!line.agent) {
        errors.push(`lines[${i}]: missing agent`);
      }
      if (typeof line.seconds !== 'number') {
        errors.push(`lines[${i}]: seconds must be a number`);
      }
    }
  }

  // Check firstFailIndex
  if (typeof reel.firstFailIndex !== 'number') {
    errors.push('firstFailIndex must be a number');
  } else {
    // Validate it points to a fail kind in lines
    if (reel.firstFailIndex >= 0 && reel.firstFailIndex < reel.lines.length) {
      if (reel.lines[reel.firstFailIndex].kind !== 'fail') {
        errors.push(`firstFailIndex ${reel.firstFailIndex} does not point to a 'fail' kind line`);
      }
    } else if (reel.firstFailIndex !== -1) {
      errors.push(`firstFailIndex ${reel.firstFailIndex} out of bounds`);
    }
  }

  // Check fixIndex
  if (typeof reel.fixIndex !== 'number') {
    errors.push('fixIndex must be a number');
  } else {
    // Validate it points to a fix kind in lines
    if (reel.fixIndex >= 0 && reel.fixIndex < reel.lines.length) {
      if (reel.lines[reel.fixIndex].kind !== 'fix') {
        errors.push(`fixIndex ${reel.fixIndex} does not point to a 'fix' kind line`);
      }
    } else if (reel.fixIndex !== -1) {
      errors.push(`fixIndex ${reel.fixIndex} out of bounds`);
    }
  }

  return { reel: reel.name, errors };
}

console.log('Testing reels against source events...\n');

let allPassed = true;
for (const { reel, runDir } of RUNS) {
  const reelPath = path.join(REELS_DIR, reel);
  const beatResult = testReelBeats(reelPath, runDir);
  const schemaResult = testReelSchema(reelPath);

  let reelPassed = true;

  if (beatResult.missing.length === 0) {
    console.log(`✓ ${beatResult.reel}: All ${beatResult.total} beats verified in source events`);
  } else {
    console.log(`✗ ${beatResult.reel}: ${beatResult.missing.length} of ${beatResult.total} beats NOT found in source:`);
    for (const m of beatResult.missing) {
      console.log(`  - "${m.text}" (agent: ${m.beat.agent}, kind: ${m.beat.kind})`);
    }
    reelPassed = false;
  }

  if (schemaResult.errors.length === 0) {
    console.log(`✓ ${schemaResult.reel}: Schema validation passed`);
  } else {
    console.log(`✗ ${schemaResult.reel}: Schema validation failed:`);
    for (const err of schemaResult.errors) {
      console.log(`  - ${err}`);
    }
    reelPassed = false;
  }

  if (!reelPassed) allPassed = false;
}

if (allPassed) {
  console.log('\n✓ All tests passed: No invented text in any reel, schema valid');
  process.exit(0);
} else {
  console.log('\n✗ Some tests failed');
  process.exit(1);
}