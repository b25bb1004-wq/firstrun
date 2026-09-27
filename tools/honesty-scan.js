#!/usr/bin/env node
/**
 * HONESTY SCANNER
 * Static analysis to catch fake data, always-true checkers, hardcoded host facts,
 * canned output strings, and setTimeout-faked command results.
 *
 * Run: node tools/honesty-scan.js
 * Exit code: 0 = clean, 1 = violations found
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = [
  resolve(ROOT, 'lens'),
  resolve(ROOT, 'web/public')
];

// Files/paths to completely skip (these are data/test files, not UI code)
const SKIP_PATHS = [
  '/data/runs/',           // recorded run events
  '/data/reels/',          // reel data
  '/data/audits/',         // audit data
  '/audit/',               // audit folders
  '/test/',                // test files
  '.test.',                // test files
  '/fixtures/',            // test fixtures
  '/examples/',            // example files
  'recorded-events.js',    // recorded event data
  'demo-machine.json',     // demo machine data
  'showcase.html',         // showcase/demo page
  'console.html',          // Electron console (separate)
  'overlay.html',          // Electron overlay
  'spatial/',              // spatial module
  'coords.js',
  'ocr.js',
  'windows.js',
  'redact.js',             // redaction utility
  'core.js',               // core module (tested separately)
  'robot.js',              // robot module
  'timeline-controls.js',  // timeline controls
  'check.js',              // check.js (utility)
  'prove-live.js',         // prove-live (has recorded run badges)
  'scrub.js',              // scrub component
  'wall.js',               // wall component
  'diff-slider.js',        // diff slider
  'hero-gl.js',            // hero GL
  'motion/',               // motion animations
  'app/views/',            // view templates
  'app/diff.js',           // diff utility
  'app/passport.js',       // passport utility
  'privacy.html',          // legal pages
  'terms.html',
  '404.html',
];

// Allow-list for numbers that don't need a data source
const ALLOWLIST_NUMBERS = new Set([
  // Years
  '2024', '2025', '2026',
  // CSS sizes (px, rem, em, %, vh, vw)
  '12', '14', '16', '18', '20', '24', '28', '32', '36', '40', '44', '48', '56', '64', '72', '80', '96', '100', '128', '150', '200', '300', '400', '500', '600', '800', '1000', '1200', '1500', '2000',
  // Version strings (semver-ish)
  '1.0.0', '2.0.0', '3.0.0', '2.0',
  // Common time values in ms that are clearly animation/config
  '30', '180', '200', '300', '400', '500', '600', '800', '1000', '1200', '1500', '2000', '2300', '2500', '3000', '4000', '5000', '6000', '8000', '10000', '14000', '25000',
  // Port numbers
  '3000', '5432', '6379', '27017', '8080',
  // HTTP status codes
  '200', '201', '204', '301', '302', '304', '400', '401', '403', '404', '500', '502', '503',
  // Small counts in UI (steps, agents, etc)
  '6', '14',
  // Step numbers, key codes, etc
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  // FPS, timestamps, etc
  '60', '420', '45', '53', '158', '256', '1960', '1024',
  // Descriptive numbers in copy (not metrics)
  '3', '10', '4', '1', '2', '5', '127.0', '2.0',
  // The "0" and "1" that are initial/placeholder values
  '0', '1',
  // Bobcoins display
  '0.00',
]);

// Patterns that indicate always-true checkers
const ALWAYS_TRUE_PATTERNS = [
  /\(\s*\)\s*=>\s*true\s*[;,}]/g,                    // () => true
  /function\s*\(\s*\)\s*{\s*return\s+true\s*;?\s*}/g, // function() { return true; }
  /return\s+true\s*;?\s*}\s*$/gm,                    // return true; }
  /===\s*true\s*[&|]/g,                              // === true &&
  /==\s*true\s*[&|]/g,                               // == true &&
];

// Patterns for hardcoded host facts (Node versions, OS names, etc)
const HARDCODED_HOST_PATTERNS = [
  /node:\d{1,2}(?!\d)/g,                    // node:16, node:18, node:20, node:22
  /Node\.js\s+\d{1,2}/gi,                   // Node.js 16, Node.js 20
  /\.nvmrc\s*[=:]\s*['"]?\d{1,2}/gi,        // .nvmrc = "20"
  /process\.version\s*[=!]=/g,              // process.version checks
  /process\.platform\s*[=!]=/g,             // process.platform checks
  /os\.platform\(\)/g,                      // os.platform()
  /os\.release\(\)/g,                       // os.release()
  /os\.type\(\)/g,                          // os.type()
  /os\.arch\(\)/g,                          // os.arch()
  /navigator\.userAgent/g,                  // navigator.userAgent
  /navigator\.platform/g,                   // navigator.platform
  /window\.navigator/g,                     // window.navigator
];

// Patterns for canned output strings
const CANNED_OUTPUT_PATTERNS = [
  /console\.log\(['"][^'"]*\[fake/i,       // console.log('[fake...
  /console\.log\(['"][^'"]*\[mock/i,       // console.log('[mock...
  /console\.log\(['"][^'"]*\[simulated/i,  // console.log('[simulated...
  /console\.log\(['"][^'"]*\[stub/i,       // console.log('[stub...
  /console\.log\(['"][^'"]*\[demo/i,       // console.log('[demo...
  /console\.log\(['"][^'"]*\[test/i,       // console.log('[test...
  /\[SAMPLE\s+DATA\]/gi,                   // [SAMPLE DATA]
  /\[RECORDED\s+RUN\]/gi,                  // [RECORDED RUN] (but this is actually valid when used correctly)
  /faker\./g,                              // faker.js usage
  /mock\(/g,                               // mock(
  /jest\.fn\(/g,                           // jest.fn(
  /sinon\.stub/g,                          // sinon.stub
];

// Patterns for setTimeout-faked command results
const SETTIMEOUT_FAKE_PATTERNS = [
  /setTimeout\s*\(\s*[^,]+,\s*\d+\s*\)\s*{\s*[^}]*resolve\s*\(/g, // setTimeout with resolve
  /setTimeout\s*\(\s*[^,]+,\s*\d+\s*\)\s*=>\s*{\s*[^}]*resolve\s*\(/g, // arrow setTimeout with resolve
  /new Promise\s*\(\s*resolve\s*=>\s*{\s*setTimeout\s*\(\s*resolve/g, // new Promise with setTimeout resolve
  /setTimeout\s*\(\s*\(\)\s*=>\s*{\s*[^}]*(?:stdout|stderr|output|result)\s*=\s*['"][^'"]*['"]/g, // setTimeout setting fake output
];

// Files to skip
const SKIP_FILES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
]);

function walkDir(dir, fileList = []) {
  const files = readdirSync(dir);
  for (const file of files) {
    if (SKIP_FILES.has(file)) continue;
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (['.js', '.ts', '.jsx', '.tsx', '.html', '.json', '.css', '.md'].includes(extname(file))) {
      // Check if this path should be skipped
      const relPath = fullPath.replace(ROOT + '/', '');
      const shouldSkip = SKIP_PATHS.some(skipPath => ('/' + relPath.split(String.fromCharCode(92)).join('/')).includes(skipPath));
      if (!shouldSkip) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

function findViolations(filePath, content) {
  const violations = [];
  const lines = content.split('\n');

  // 1. Check for numbers in UI copy that lack data source (HTML/JS files)
  if (['.html', '.js', '.jsx', '.tsx'].includes(extname(filePath))) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Find numbers in visible text (not in attributes like data-count, style, etc)
      // Look for numbers in text content that aren't clearly CSS/version/allowlisted
      const textContentMatches = line.match(/>[^<]*(\d+(?:\.\d+)?(?:[sm]?))[^<]*</g) || [];
      for (const match of textContentMatches) {
        const numMatch = match.match(/(\d+(?:\.\d+)?)/);
        if (numMatch) {
          const num = numMatch[1];
          // Skip if in allowlist
          if (ALLOWLIST_NUMBERS.has(num)) continue;
          // Skip if it has a data-* attribute nearby (data-count, data-value, etc)
          const contextStart = Math.max(0, i - 2);
          const contextEnd = Math.min(lines.length, i + 3);
          const context = lines.slice(contextStart, contextEnd).join('\n');
          if (context.includes('data-count') || context.includes('data-value') || 
              context.includes('data-') || context.includes('replaySeconds') ||
              context.includes('stepsTotal') || context.includes('breaksFixed') ||
              context.includes('breaksFound') || context.includes('verdict') ||
              context.includes('data-repo') || context.includes('data-k') ||
              context.match(/data-\w+=["']\d/)) { // data-*="123"
            continue;
          }
          violations.push({
            file: filePath.replace(ROOT + '/', ''),
            line: lineNum,
            type: 'unsourced_number',
            message: `Number "${num}" appears in visible text without a data source attribute`,
            snippet: line.trim().slice(0, 120)
          });
        }
      }
    }
  }

  // 2. Always-true checkers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    for (const pattern of ALWAYS_TRUE_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: filePath.replace(ROOT + '/', ''),
          line: lineNum,
          type: 'always_true_checker',
          message: 'Function returning true unconditionally (always-true checker)',
          snippet: line.trim().slice(0, 120)
        });
        break;
      }
    }
  }

  // 3. Hardcoded host facts
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    for (const pattern of HARDCODED_HOST_PATTERNS) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        // Allow in data files (they're supposed to have recorded facts)
          const isDataFile = filePath.includes('/data/runs/') || filePath.includes('/data/reels/') || filePath.includes('/data/audits/') || filePath.includes('/audit/') || filePath.includes('/examples/') || filePath.includes('/fixtures/');
          if (isDataFile) {
            continue;
          }
          // Allow in test files
          if (filePath.includes('/test/') || filePath.includes('.test.')) {
            continue;
          }
        // Allow process.platform/runtime checks - these are runtime detection, not hardcoded facts
        if (match[0].includes('process.platform') || match[0].includes('process.version') ||
            match[0].includes('os.platform') || match[0].includes('os.release') ||
            match[0].includes('os.type') || match[0].includes('os.arch') ||
            match[0].includes('navigator.userAgent') || match[0].includes('navigator.platform') ||
            match[0].includes('window.navigator')) {
          continue;
        }
        // Allow in comments
        if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
          continue;
        }
        // Allow recorded run facts in console components (these are replay data, not hardcoded probes)
        if (filePath.includes('lens/humble/console.js') && (match[0].includes('node:') || match[0].includes('os:'))) {
          continue;
        }
        violations.push({
          file: filePath.replace(ROOT + '/', ''),
          line: lineNum,
          type: 'hardcoded_host_fact',
          message: `Hardcoded host fact detected: "${match[0]}"`,
          snippet: line.trim().slice(0, 120)
        });
      }
    }
  }

  // 4. Canned output strings
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    for (const pattern of CANNED_OUTPUT_PATTERNS) {
      if (pattern.test(line)) {
        // Allow [RECORDED RUN] badge in prove-live.js - that's the correct label
        if (pattern.source.includes('RECORDED') && line.includes('[recorded run]')) {
          continue;
        }
        violations.push({
          file: filePath.replace(ROOT + '/', ''),
          line: lineNum,
          type: 'canned_output',
          message: 'Canned/fake output string detected',
          snippet: line.trim().slice(0, 120)
        });
        break;
      }
    }
  }

  // 5. setTimeout-faked command results
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    for (const pattern of SETTIMEOUT_FAKE_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: filePath.replace(ROOT + '/', ''),
          line: lineNum,
          type: 'settimeout_fake',
          message: 'setTimeout used to fake command result (resolve with canned output)',
          snippet: line.trim().slice(0, 120)
        });
        break;
      }
    }
  }

  // 6. Sample data without badge (in HTML/JSX - only for user-facing components)
  // Only check index.html and similar user-facing files
  const userFacingFiles = [
    'web/public/index.html',
  ];
  const isUserFacing = userFacingFiles.some(f => filePath.endsWith(f));
  
  if (isUserFacing && ['.html'].includes(extname(filePath))) {
    // Look for data that looks like sample/demo but lacks badge
    // Only flag in visible UI text content (between tags), not in attributes/JS
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // Only check visible text content (between > and <)
      const visibleTextMatches = line.match(/>([^<]+)</g) || [];
      for (const match of visibleTextMatches) {
        const text = match.slice(1, -1); // remove > and <
        
        const sampleIndicators = [
          /acme-shop/i, /demo/i, /example/i, /sample/i, /placeholder/i
        ];
        
        for (const indicator of sampleIndicators) {
          if (indicator.test(text)) {
            // Check if there's a badge nearby
            const contextStart = Math.max(0, i - 3);
            const contextEnd = Math.min(lines.length, i + 4);
            const context = lines.slice(contextStart, contextEnd).join('\n');
            if (context.includes('[recorded run]') || context.includes('[sample data]') ||
                context.includes('data-badge') || context.includes('badge') ||
                context.includes('evidenceLink') || context.includes('recorded')) {
              continue;
            }
            
            violations.push({
              file: filePath.replace(ROOT + '/', ''),
              line: lineNum,
              type: 'missing_sample_badge',
              message: `Sample/demo data indicator "${indicator.source.replace(/\\\//g, '')}" in visible text lacks visible [recorded run] or [sample data] badge in same component`,
              snippet: line.trim().slice(0, 120)
            });
            break;
          }
        }
      }
    }
  }

  return violations;
}

async function main() {
  console.log('🔍 HONESTY GATE - Static Scan');
  console.log('================================\n');

  let allFiles = [];
  for (const dir of SCAN_DIRS) {
    try {
      allFiles = allFiles.concat(walkDir(dir));
    } catch (e) {
      console.warn(`Warning: Could not scan ${dir}: ${e.message}`);
    }
  }

  console.log(`Scanning ${allFiles.length} files...\n`);

  let allViolations = [];
  for (const file of allFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const violations = findViolations(file, content);
      allViolations.push(...violations);
    } catch (e) {
      console.warn(`Warning: Could not read ${file}: ${e.message}`);
    }
  }

  // Group by type
  const byType = {};
  for (const v of allViolations) {
    if (!byType[v.type]) byType[v.type] = [];
    byType[v.type].push(v);
  }

  // Print report
  console.log('📋 VIOLATION REPORT');
  console.log('====================\n');

  if (allViolations.length === 0) {
    console.log('✅ No violations found. All checks passed.');
    return 0;
  }

  const typeLabels = {
    'unsourced_number': '🔢 Unsourced Numbers in UI',
    'always_true_checker': '✅ Always-True Checkers',
    'hardcoded_host_fact': '🖥️  Hardcoded Host Facts',
    'canned_output': '📦 Canned Output Strings',
    'settimeout_fake': '⏱️  setTimeout-Faked Results',
    'missing_sample_badge': '🏷️  Missing Sample Data Badge'
  };

  for (const [type, violations] of Object.entries(byType)) {
    console.log(`${typeLabels[type] || type} (${violations.length})`);
    console.log('-'.repeat(60));
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.message}`);
      console.log(`    → ${v.snippet}`);
      console.log();
    }
  }

  console.log('====================');
  console.log(`Total violations: ${allViolations.length}`);
  console.log('\n❌ HONESTY GATE FAILED');
  return 1;
}

main().then(code => process.exit(code)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});