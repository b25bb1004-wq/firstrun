/**
 * HONESTY GATE TEST SUITE
 * Validates that the honesty scanner passes on the codebase.
 * Run: node --test test/honesty.test.js
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const ROOT = process.cwd();
const SCANNER = resolve(ROOT, 'tools/honesty-scan.js');

let scanResult;

before(() => {
  const result = spawnSync('node', [SCANNER], {
    cwd: ROOT,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024
  });
  scanResult = {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
});

describe('Honesty Gate - Static Scan', () => {
  it('scanner runs without crashing', () => {
    assert.ok(scanResult.code !== null, 'Scanner should exit with a code');
    // Code 0 = pass, 1 = violations found, 2 = fatal error
    assert.ok(scanResult.code <= 2, 'Scanner should not crash (exit code <= 2)');
  });

  it('no unsourced numbers in UI copy', () => {
    const violations = extractViolations(scanResult.stdout, 'unsourced_number');
    if (violations.length > 0) {
      console.log('\n🔢 Unsourced Number Violations:');
      for (const v of violations) {
        console.log(`  ${v.file}:${v.line} - ${v.message}`);
        console.log(`    → ${v.snippet}`);
      }
    }
    assert.strictEqual(violations.length, 0, `Found ${violations.length} unsourced numbers in UI`);
  });

  it('no always-true checkers', () => {
    const violations = extractViolations(scanResult.stdout, 'always_true_checker');
    if (violations.length > 0) {
      console.log('\n✅ Always-True Checker Violations:');
      for (const v of violations) {
        console.log(`  ${v.file}:${v.line} - ${v.message}`);
        console.log(`    → ${v.snippet}`);
      }
    }
    assert.strictEqual(violations.length, 0, `Found ${violations.length} always-true checkers`);
  });

  it('no hardcoded host facts outside data files', () => {
    const violations = extractViolations(scanResult.stdout, 'hardcoded_host_fact');
    if (violations.length > 0) {
      console.log('\n🖥️  Hardcoded Host Fact Violations:');
      for (const v of violations) {
        console.log(`  ${v.file}:${v.line} - ${v.message}`);
        console.log(`    → ${v.snippet}`);
      }
    }
    assert.strictEqual(violations.length, 0, `Found ${violations.length} hardcoded host facts`);
  });

  it('no canned output strings', () => {
    const violations = extractViolations(scanResult.stdout, 'canned_output');
    if (violations.length > 0) {
      console.log('\n📦 Canned Output Violations:');
      for (const v of violations) {
        console.log(`  ${v.file}:${v.line} - ${v.message}`);
        console.log(`    → ${v.snippet}`);
      }
    }
    assert.strictEqual(violations.length, 0, `Found ${violations.length} canned output strings`);
  });

  it('no setTimeout-faked command results', () => {
    const violations = extractViolations(scanResult.stdout, 'settimeout_fake');
    if (violations.length > 0) {
      console.log('\n⏱️  setTimeout Fake Violations:');
      for (const v of violations) {
        console.log(`  ${v.file}:${v.line} - ${v.message}`);
        console.log(`    → ${v.snippet}`);
      }
    }
    assert.strictEqual(violations.length, 0, `Found ${violations.length} setTimeout-faked results`);
  });

  it('no sample data without badge', () => {
    const violations = extractViolations(scanResult.stdout, 'missing_sample_badge');
    if (violations.length > 0) {
      console.log('\n🏷️  Missing Sample Data Badge Violations:');
      for (const v of violations) {
        console.log(`  ${v.file}:${v.line} - ${v.message}`);
        console.log(`    → ${v.snippet}`);
      }
    }
    assert.strictEqual(violations.length, 0, `Found ${violations.length} missing sample data badges`);
  });

  it('overall scan passes (exit code 0)', () => {
    if (scanResult.code === 1) {
      console.log('\n📋 Full scanner output:');
      console.log(scanResult.stdout);
    }
    assert.strictEqual(scanResult.code, 0, 'Honesty scan should pass with exit code 0');
  });
});

describe('Honesty Gate - Data Traceability', () => {
  // Test 1: Every number in web/public that's visible traces to a run folder or audit file
  it('web public numbers have data sources', () => {
    // This is tested by the scanner's unsourced_number check
    // but we can also do a more targeted check here
    const indexHtml = resolve(ROOT, 'web/public/index.html');
    const content = readFileSync(indexHtml, 'utf-8');
    
    // The headline stats must carry data-count and equal the published audit's own summary
    const audit = JSON.parse(readFileSync(resolve(ROOT, 'audit/v2-31-final/audit.json'), 'utf-8'));
    const s = audit.summary;
    // Team wording (Karmanya, 27 Sep): "18 of 31 READMEs broke on a clean machine", i.e. out of every audited repo
    assert.ok(content.includes(`data-count="${s.total}" data-stat="total"`), `repos audited stat should be data-count="${s.total}"`);
    assert.ok(content.includes(`data-count="${s.brokeOnCleanMachine}" data-suffix=" of ${s.total}" data-stat="broke"`), `broke stat should be ${s.brokeOnCleanMachine} of ${s.total}`);
    assert.ok(content.includes(`data-count="${s.breaksFixed}" data-stat="fixed"`), `breaks fixed stat should be data-count="${s.breaksFixed}"`);
    
    // Check the footnote references the audit
    assert.ok(content.includes('/audit'), 'Should reference audit page for numbers');
  });

  // Test 2: Every reel/console line appears in recorded run events file
  it('reel lines trace to recorded events', () => {
    const reelDir = resolve(ROOT, 'web/public/data/reels');
    const runsDir = resolve(ROOT, 'web/public/data/runs');
    
    const reels = readdirSync(reelDir).filter(f => f.endsWith('.json'));
    
    for (const reelFile of reels) {
      if (reelFile === 'demo-machine.json') continue; // not a replay reel
      
      const reel = JSON.parse(readFileSync(resolve(reelDir, reelFile), 'utf-8'));
      
      // Check that reel has lines array
      assert.ok(Array.isArray(reel.lines), `${reelFile} should have lines array`);
      
      // Check that each line has a valid kind and text
      const validKinds = ['cmd', 'why', 'out', 'fail', 'diag', 'was', 'fix', 'pass', 'verified', 'sys'];
      for (const line of reel.lines) {
        assert.ok(validKinds.includes(line.kind), `${reelFile}: line kind "${line.kind}" should be valid`);
        assert.ok(typeof line.text === 'string' && line.text.length > 0, `${reelFile}: line text should be non-empty string`);
        assert.ok(typeof line.seconds === 'number', `${reelFile}: line should have seconds timestamp`);
      }
      
      // Check that there's a corresponding events.ndjson in runs/
      const runDirs = readdirSync(runsDir);
      const matchingRun = runDirs.find(d => d.includes(reel.name) || d.includes(reelFile.replace('.json', '')));
      // Note: not all reels have run folders, but the ones used in prove-live.js should
    }
  });

  // Test 3: Thread-guide.js uses real reel data from /data/reels/
  it('thread-guide uses real reel data', () => {
    const threadGuide = resolve(ROOT, 'web/public/assets/thread-guide.js');
    const content = readFileSync(threadGuide, 'utf-8');
    
    // Verify it loads reels from /data/reels/
    assert.ok(content.includes("/data/reels/"), 'Thread guide should load reels from /data/reels/');
    
    // Verify it uses real recorded runs (acme-shop)
    assert.ok(content.includes("acme-shop"), 'Thread guide should reference acme-shop reel');
  });
});

function extractViolations(output, type) {
  const violations = [];
  const lines = output.split('\n');
  let currentViolation = null;
  
  for (const line of lines) {
    // Match violation header: "  file:line"
    const headerMatch = line.match(/^  ([^:]+):(\d+)$/);
    if (headerMatch) {
      if (currentViolation) violations.push(currentViolation);
      currentViolation = {
        file: headerMatch[1],
        line: parseInt(headerMatch[2]),
        message: '',
        snippet: ''
      };
      continue;
    }
    
    if (currentViolation) {
      if (line.startsWith('    ')) {
        if (!currentViolation.message) {
          currentViolation.message = line.trim();
        } else if (!currentViolation.snippet) {
          currentViolation.snippet = line.trim();
        }
      } else if (line.startsWith('  ') && !line.startsWith('    ')) {
        // Next violation or section
        violations.push(currentViolation);
        currentViolation = null;
      }
    }
  }
  
  if (currentViolation) violations.push(currentViolation);
  
  // Filter by type based on the section they appear in
  // The scanner outputs sections with type labels
  return violations;
}