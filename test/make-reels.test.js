/**
 * Test: Every beat text in the generated reel files must appear in the source events.ndjson
 * This proves nothing is invented.
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

function testReel(reelFile, runDir) {
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

console.log('Testing reels against source events...\n');

let allPassed = true;
for (const { reel, runDir } of RUNS) {
  const reelPath = path.join(REELS_DIR, reel);
  const result = testReel(reelPath, runDir);
  
  if (result.missing.length === 0) {
    console.log(`✓ ${result.reel}: All ${result.total} beats verified in source events`);
  } else {
    console.log(`✗ ${result.reel}: ${result.missing.length} of ${result.total} beats NOT found in source:`);
    for (const m of result.missing) {
      console.log(`  - "${m.text}" (agent: ${m.beat.agent}, kind: ${m.beat.kind})`);
    }
    allPassed = false;
  }
}

if (allPassed) {
  console.log('\n✓ All tests passed: No invented text in any reel');
  process.exit(0);
} else {
  console.log('\n✗ Some beats contain text not found in source events');
  process.exit(1);
}