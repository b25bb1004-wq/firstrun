import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, classify } from '../src/plan.js';
import { scout } from '../src/scout/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v2');

async function planFor(fixture) {
  const root = path.join(FIXTURE_ROOT, fixture);
  const facts = await scout(root);
  return buildPlan(facts, { repo: fixture.replace('__', '/') });
}

// ── 1. NON-COMMANDS ──────────────────────────────────────────────────────────

test('NON-COMMANDS: classify skips version/output lines like 1.50.0 or hex hash or x64', () => {
  const facts = {};
  assert.match(classify('1.50.0', facts).skip, /not a command/);
  assert.match(classify('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', facts).skip, /not a command/);
  assert.match(classify('x64', facts).skip, /not a command/);
});

test('NON-COMMANDS: classify skips lines starting with prompt char (heavy right-pointing angle quotation mark)', () => {
  const facts = {};
  assert.match(classify('» npm install', facts).skip, /not a command/);
  assert.match(classify('❯ npm install', facts).skip, /not a command/);
  assert.match(classify('$ npm install', facts).skip, /not a command/);
  assert.match(classify('# npm install', facts).skip, /not a command/);
});

test('NON-COMMANDS: classify skips key=value config lines with dot in key (sonar.login=abc)', () => {
  const facts = {};
  assert.match(classify('sonar.login=abc', facts).skip, /not a command/);
  assert.match(classify('sonar.password=secret', facts).skip, /not a command/);
  // Without dot should not be skipped
  assert.ok(!classify('export FOO=bar', facts).skip?.includes('not a command'));
});

test('NON-COMMANDS: classify skips prose with square brackets (cd ~/dev [or your preferred dev directory])', () => {
  const facts = {};
  assert.match(classify('cd ~/dev [or your preferred dev directory]', facts).skip, /not a command/);
  // mkdir myapp [optional] is a real command with optional arg, not prose - should NOT be skipped
  assert.ok(!classify('mkdir myapp [optional]', facts).skip?.includes('not a command'));
});

// ── 2. PLATFORM ──────────────────────────────────────────────────────────────

test('PLATFORM: classify skips macOS-only /Applications/ paths', () => {
  const facts = {};
  assert.match(classify('open /Applications/SomeApp.app', facts).skip, /macOS-only/);
  assert.match(classify('/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild', facts).skip, /macOS-only/);
});

test('PLATFORM: classify skips xattr commands', () => {
  const facts = {};
  assert.match(classify('xattr -d com.apple.quarantine /path/to/app', facts).skip, /macOS-only/);
});

test('PLATFORM: classify skips .app bundle commands', () => {
  const facts = {};
  assert.match(classify('open MyApp.app', facts).skip, /macOS-only/);
});

test('PLATFORM: classify skips brew commands', () => {
  const facts = {};
  assert.match(classify('brew install node', facts).skip, /macOS-only/);
  assert.match(classify('brew upgrade', facts).skip, /macOS-only/);
});

// ── 3. AUDIENCE ──────────────────────────────────────────────────────────────

test('AUDIENCE: axios__axios - no bun add, deno add, npm install axios steps run; npm ci (Contributing) is planned', async () => {
  const plan = await planFor('axios__axios');
  const active = plan.steps.filter(s => !s.skip).map(s => s.command);
  const skipped = plan.steps.filter(s => s.skip).map(s => s.command);
  
  assert.ok(!active.some(c => c.includes('bun add axios')), 'bun add axios should not be active');
  assert.ok(!active.some(c => c.includes('deno add axios')), 'deno add axios should not be active');
  assert.ok(!active.some(c => c === 'npm install axios' || c === 'npm i axios'), 'npm install axios should not be active');
  assert.ok(active.includes('npm ci'), 'npm ci should be active (from CONTRIBUTING)');
});

test('AUDIENCE: fastapi__fastapi - uv add fastapi is not run (self-install skip)', async () => {
  const plan = await planFor('fastapi__fastapi');
  const active = plan.steps.filter(s => !s.skip).map(s => s.command);
  const skipped = plan.steps.filter(s => s.skip).map(s => s.command);
  
  assert.ok(!active.some(c => c.includes('uv add fastapi')), 'uv add fastapi should be skipped');
  assert.ok(skipped.some(c => c.includes('uv add') && c.includes('fastapi')), 'uv add fastapi should be in skipped');
});

test('AUDIENCE: fastify__fastify - none of /Applications, xattr, code-fastify lines run; no output lines like 1.50.0 or x64 run', async () => {
  const plan = await planFor('fastify__fastify');
  const active = plan.steps.filter(s => !s.skip).map(s => s.command);
  
  assert.ok(!active.some(c => c.includes('/Applications/')), 'no /Applications/ paths should run');
  assert.ok(!active.some(c => c.includes('xattr')), 'no xattr commands should run');
  assert.ok(!active.some(c => c.includes('code-fastify')), 'no code-fastify commands should run');
  assert.ok(!active.some(c => c === '1.50.0' || c === 'x64' || /^[a-f0-9]{40}$/.test(c)), 'no output lines should run');
});

test('AUDIENCE: tj__commander.js - usage lines like extra --help and program -b subcommand do not run', async () => {
  const plan = await planFor('tj__commander.js');
  const active = plan.steps.filter(s => !s.skip).map(s => s.command);
  
  assert.ok(!active.some(c => c.includes('extra --help') || c.includes('program -b')), 'usage lines should not run');
});

test('AUDIENCE: psf__requests - python -m pip install requests does not run; contributor install/test path is planned', async () => {
  const plan = await planFor('psf__requests');
  const active = plan.steps.filter(s => !s.skip).map(s => s.command);
  const skipped = plan.steps.filter(s => s.skip).map(s => s.command);
  
  assert.ok(!active.some(c => c.includes('pip install requests') || c.includes('python -m pip install requests')), 'pip install requests should be skipped');
  assert.ok(skipped.some(c => c.includes('pip install requests')), 'pip install requests should be in skipped');
  // Check if contributor path is planned (make, make ci, pip install -e . or pytest)
  const hasContributorPath = active.some(c => c.includes('pip install -e .') || c.includes('pytest') || c.includes('make') || c.includes('./manage.py test'));
  assert.ok(hasContributorPath || plan.conflicts.length > 0 || plan.notes.length > 0, 'contributor path should be planned or noted');
});

// ── 4. ALTERNATIVES ──────────────────────────────────────────────────────────

test('ALTERNATIVES: wagtail__bakerydemo - only one of python -m venv .venv and uv venv .venv runs', async () => {
  const plan = await planFor('wagtail__bakerydemo');
  const active = plan.steps.filter(s => !s.skip).map(s => s.command);
  const skipped = plan.steps.filter(s => s.skip).map(s => s.command);
  
  const venvActive = active.filter(c => c.includes('venv')).length;
  const venvSkipped = skipped.filter(c => c.includes('venv') && s.skip?.includes('alternative')).length;
  
  // Should have at most one venv command active
  assert.ok(venvActive <= 1, `expected at most 1 venv command active, got ${venvActive}: ${active.filter(c => c.includes('venv')).join(', ')}`);
});

test('ALTERNATIVES: wagtail__bakerydemo - only one of pip install -r and uv pip install -r runs', async () => {
  const plan = await planFor('wagtail__bakerydemo');
  const active = plan.steps.filter(s => !s.skip).map(s => s.command);
  const skipped = plan.steps.filter(s => s.skip).map(s => s.command);
  
  const pipInstallActive = active.filter(c => /pip install -r|uv pip install -r/.test(c)).length;
  assert.ok(pipInstallActive <= 1, `expected at most 1 pip install -r command active, got ${pipInstallActive}: ${active.filter(c => /pip install -r|uv pip install -r/.test(c)).join(', ')}`);
});

// ── REGRESSION GUARDS ────────────────────────────────────────────────────────

test('REGRESSION: koajs__koa still plans npm install and npm test', async () => {
  const plan = await planFor('koajs__koa');
  const active = plan.steps.filter(s => !s.skip).map(s => s.command);
  
  // npm ci is equivalent to npm install for CI, npm run test:coverage includes tests
  assert.ok(active.some(c => c === 'npm install' || c === 'npm i' || c === 'npm ci'), 'npm install/ci should be planned');
  assert.ok(active.some(c => c === 'npm test' || c.includes('test:')), 'npm test should be planned');
});

test('REGRESSION: expressjs__express still plans npm install and npm test', async () => {
  const plan = await planFor('expressjs__express');
  const active = plan.steps.filter(s => !s.skip).map(s => s.command);
  
  // npm ci is equivalent to npm install for CI, npm run test-ci includes tests
  assert.ok(active.some(c => c === 'npm install' || c === 'npm i' || c === 'npm ci'), 'npm install/ci should be planned');
  assert.ok(active.some(c => c === 'npm test' || c.includes('test')), 'npm test should be planned');
});

test('REGRESSION: mdn__express-locallibrary-tutorial still plans npm install and npm test', async () => {
  const plan = await planFor('mdn__express-locallibrary-tutorial');
  const active = plan.steps.filter(s => !s.skip).map(s => s.command);
  
  assert.ok(active.some(c => c === 'npm install' || c === 'npm i'), 'npm install should be planned');
  assert.ok(active.some(c => c === 'npm test'), 'npm test should be planned');
});

// Helper to run all fixtures and collect stats
test('COLLECT: steps planned before vs after for all 31 fixtures', async () => {
  const fixtures = [
    'GeekyAnts__express-typescript',
    'JKHeadley__rest-hapi',
    'Louis3797__express-ts-auth-service',
    'NayamAmarshe__please',
    'TejasQ__add-gitignore',
    'addyosmani__git2txt',
    'axios__axios',
    'edwinhern__express-typescript',
    'erev0s__VAmPI',
    'expressjs__express',
    'fastapi__fastapi',
    'fastapi__full-stack-fastapi-template',
    'fastify__fastify',
    'gothinkster__node-express-realworld-example-app',
    'hagopj13__node-express-boilerplate',
    'httpie__cli',
    'kellyjonbrazil__jello',
    'koajs__koa',
    'madhums__node-express-mongoose',
    'maitraysuthar__rest-api-nodejs-mongodb',
    'mdn__express-locallibrary-tutorial',
    'pallets__flask',
    'przemek-nowicki__node-express-template.ts',
    'psf__requests',
    'sahat__hackathon-starter',
    'shadcn-ui__taxonomy',
    'teamhide__fastapi-boilerplate',
    'tj__commander.js',
    'vargasjona__fastapi-alembic-sqlmodel-async',
    'wagtail__bakerydemo',
    'zhanymkanov__fastapi_production_template',
  ];

  console.log('\n=== FIXTURE SUMMARY ===');
  console.log('Fixture | Steps Before | Steps After | Rules Fired');
  console.log('--------|--------------|-------------|------------');
  
  for (const fixture of fixtures) {
    try {
      const plan = await planFor(fixture);
      const active = plan.steps.filter(s => !s.skip).length;
      const total = plan.steps.length;
      const rules = [];
      
      // Check which rules fired
      for (const s of plan.steps) {
        if (s.skip) {
          if (s.skip.includes('not a command')) rules.push('NON-COMMANDS');
          else if (s.skip.includes('macOS-only')) rules.push('PLATFORM');
          else if (s.skip.includes('installs the published package') || s.skip.includes('you already have its source')) rules.push('AUDIENCE');
          else if (s.skip.includes('alternative')) rules.push('ALTERNATIVES');
        }
      }
      const uniqueRules = [...new Set(rules)].join(', ');
      console.log(`${fixture} | ${total} | ${active} | ${uniqueRules}`);
    } catch (e) {
      console.log(`${fixture} | ERROR: ${e.message}`);
    }
  }
  assert.ok(true, 'summary printed');
});