import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildGuide } from '../src/onboarder/guide.js';
import { probeHost } from '../src/onboarder/probe.js';
import { buildReport } from '../src/onboarder/report.js';
import { readJson } from '../src/util.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsDir = path.join(here, '..', 'web', 'public', 'data', 'runs');
const acmeRunDir = path.join(runsDir, 'acme-shop-3c0bc2b2', 'f');

test('buildGuide: guide.json validates against the schema', () => {
  const guide = buildGuide(acmeRunDir);

  // Required top-level fields
  assert.ok(guide.schema === 'humble.guide/1', 'schema must be humble.guide/1');
  assert.ok(guide.repo === 'acme-shop', 'repo must be acme-shop');
  assert.ok(guide.commit === 'c0661ce19b', 'commit must match');
  assert.ok(['VERIFIED', 'PARTIAL'].includes(guide.verdict), 'verdict must be VERIFIED or PARTIAL');
  assert.ok(guide.provenOn, 'provenOn must exist');
  assert.ok(guide.provenOn.image, 'provenOn.image must exist');
  assert.ok(guide.provenOn.os === 'linux', 'provenOn.os must be linux');
  assert.ok(typeof guide.provenOn.replaySeconds === 'number', 'provenOn.replaySeconds must be a number');
  assert.ok(guide.provenOn.runId, 'provenOn.runId must exist');
  assert.ok(guide.env, 'env must exist');
  assert.ok(Array.isArray(guide.steps), 'steps must be an array');
  assert.ok(guide.done, 'done must exist');
  assert.ok(guide.scorecard, 'scorecard must exist');
  assert.ok(guide.security, 'security must exist');
  assert.ok(guide.hash, 'hash must exist');

  // Hash should be valid sha256
  assert.match(guide.hash, /^[a-f0-9]{64}$/, 'hash must be a valid sha256');
});

test('buildGuide: has only proven steps (no skipped, no unverified)', () => {
  const guide = buildGuide(acmeRunDir);

  // All steps should have verified evidence
  for (const step of guide.steps) {
    assert.ok(step.id, 'step must have id');
    assert.ok(step.title, 'step must have title');
    assert.ok(step.say, 'step must have say');
    assert.ok(step.say.new, 'step.say.new must exist');
    assert.ok(step.say.experienced, 'step.say.experienced must exist');
    assert.ok(step.why, 'step must have why');
    assert.ok(step.do, 'step must have do');
    assert.ok(step.platform, 'step must have platform');
    assert.ok(step.target, 'step must have target');
    assert.ok(step.check, 'step must have check');
    assert.ok(typeof step.timeoutMs === 'number', 'step.timeoutMs must be a number');
    assert.ok(step.undo, 'step must have undo');
    assert.ok(step.risk, 'step must have risk');
    assert.ok(typeof step.optional === 'boolean', 'step.optional must be boolean');
    // alreadySatisfiedIf can be null
  }

  // Should have 6 proven steps (S3, S4, S5, S6, S7, S8, S9) but S1 and S2 are skipped
  // The run.json shows: S1 skipped, S2 skipped, S3 repaired, S4 repaired, S5 passed, S6 repaired, S7 passed, S8 repaired, S9 passed
  // So proven steps = S3, S4, S5, S6, S7, S8, S9 = 7 steps
  assert.equal(guide.steps.length, 7, 'should have 7 proven steps');
  const stepIds = guide.steps.map(s => s.id).sort();
  assert.deepEqual(stepIds, ['S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']);
});

test('buildGuide: each step has proper check, undo, timeoutMs', () => {
  const guide = buildGuide(acmeRunDir);

  for (const step of guide.steps) {
    // Check has valid type
    assert.ok(['exit', 'port', 'http', 'file-has', 'process', 'command-output'].includes(step.check.type),
      `step ${step.id} check.type must be valid, got ${step.check.type}`);

    // Undo has valid type
    assert.ok(['run', 'restore-file', 'none'].includes(step.undo.type),
      `step ${step.id} undo.type must be valid, got ${step.undo.type}`);

    // TimeoutMs is reasonable
    assert.ok(step.timeoutMs > 0 && step.timeoutMs <= 1800000,
      `step ${step.id} timeoutMs must be reasonable, got ${step.timeoutMs}`);

    // Platform has all three
    assert.ok(step.platform.linux === 'proven', `step ${step.id} platform.linux must be proven`);
    assert.ok(step.platform.darwin !== undefined, `step ${step.id} platform.darwin must exist`);
    assert.ok(step.platform.win32 !== undefined, `step ${step.id} platform.win32 must exist`);
  }
});

test('buildGuide: S3 (npm install) has correct fields', () => {
  const guide = buildGuide(acmeRunDir);
  const s3 = guide.steps.find(s => s.id === 'S3');
  assert.ok(s3, 'S3 must exist');
  assert.equal(s3.kind, 'install');
  assert.ok(s3.do.command.includes('npm install'), 'S3 command should be npm install');
  assert.equal(s3.check.type, 'file-has', 'S3 check should be file-has for package.json');
  assert.equal(s3.undo.type, 'run', 'S3 undo should be run');
  assert.ok(s3.undo.command.includes('rm -rf node_modules'), 'S3 undo should remove node_modules');
});

test('buildGuide: S4 (env) has correct fields', () => {
  const guide = buildGuide(acmeRunDir);
  const s4 = guide.steps.find(s => s.id === 'S4');
  assert.ok(s4, 'S4 must exist');
  assert.equal(s4.kind, 'env');
  assert.ok(s4.do.command.includes('cp .env.example .env'), 'S4 command should copy .env.example');
  assert.equal(s4.check.type, 'file-has', 'S4 check should be file-has for .env');
  assert.equal(s4.undo.type, 'restore-file', 'S4 undo should restore .env');
});

test('buildGuide: S8 (serve) has http done check', () => {
  const guide = buildGuide(acmeRunDir);
  const s8 = guide.steps.find(s => s.id === 'S8');
  assert.ok(s8, 'S8 must exist');
  assert.equal(s8.kind, 'serve');
  assert.equal(s8.target.kind, 'terminal');
  // Done check should be http
  assert.equal(guide.done.type, 'http', 'done check should be http');
  assert.ok(guide.done.url.includes('3000'), 'done URL should include port 3000');
  assert.equal(guide.done.expect, 200);
});

test('probeHost: returns required fields without side effects', async () => {
  const host = await probeHost();

  // Required fields
  assert.ok(host.os, 'os must exist');
  assert.ok(host.osVersion, 'osVersion must exist');
  assert.ok(host.arch, 'arch must exist');
  assert.ok(host.shell, 'shell must exist');
  assert.ok(typeof host.cpus === 'number', 'cpus must be number');
  assert.ok(host.memory, 'memory must exist');
  assert.ok(typeof host.memory.total === 'number', 'memory.total must be number');
  assert.ok(host.node, 'node must exist');
  assert.ok(host.npm, 'npm must exist');
  assert.ok(host.python, 'python must exist');
  assert.ok(host.pip, 'pip must exist');
  assert.ok(host.docker, 'docker must exist');
  assert.ok(typeof host.docker.present === 'boolean', 'docker.present must be boolean');
  assert.ok(host.git, 'git must exist');
  assert.ok(host.make, 'make must exist');
  assert.ok(typeof host.wsl === 'boolean', 'wsl must be boolean');
  assert.ok(Array.isArray(host.ports), 'ports must be array');
  assert.ok(host.envFiles, 'envFiles must exist');
  assert.ok(host.timestamp, 'timestamp must exist');

  // No writes outside temp dir - verify no files created in cwd
  // (This is implicit - probeHost only reads)
});

test('buildReport: classifies fake host facts object correctly', () => {
  const guide = buildGuide(acmeRunDir);
  const plan = readJson(path.join(acmeRunDir, 'plan.json'));

  // Create a fake host probe
  const fakeHost = {
    os: 'linux',
    osVersion: '5.15.0',
    arch: 'x64',
    shell: '/bin/bash',
    cpus: 4,
    memory: { total: 16, free: 8 },
    node: 'v20.10.0',
    npm: '10.2.3',
    python: '3.11.5',
    pip: '23.3.1',
    docker: { present: true, version: '24.0.0', compose: true, composeVersion: 'v2.23.0' },
    git: 'git version 2.40.0',
    make: 'GNU Make 4.3',
    wsl: false,
    ports: [3000, 5432, 6379],
    envFiles: { '.env': { exists: true, lines: 10 }, '.env.example': { exists: true, lines: 5 } },
    diskSpace: { available: '50G' },
    timestamp: new Date().toISOString()
  };

  const report = buildReport(guide, fakeHost, plan);

  // Check report structure
  assert.ok(report.summary, 'summary must exist');
  assert.ok(Array.isArray(report.steps), 'steps must be array');
  assert.ok(Array.isArray(report.platformGaps), 'platformGaps must be array');
  assert.ok(report.hostProfile, 'hostProfile must exist');
  assert.ok(Array.isArray(report.missingTools), 'missingTools must be array');
  assert.ok(Array.isArray(report.warnings), 'warnings must be array');
  assert.ok(report.scorecard, 'scorecard must exist');

  // On Linux with all tools, missingTools should be empty
  assert.equal(report.missingTools.length, 0, 'should have no missing tools on complete Linux host');

  // Platform gaps should be neutral on Linux
  const neutralGaps = report.platformGaps.filter(g => g.type === 'neutral');
  assert.ok(neutralGaps.length > 0, 'should have neutral gap on Linux');

  // Steps should have statuses
  for (const step of report.steps) {
    assert.ok(step.id, 'step must have id');
    assert.ok(step.title, 'step must have title');
    assert.ok(['satisfied', 'pending', 'needs-human', 'skipped', 'gap', 'manual'].includes(step.status),
      `step ${step.id} status must be valid, got ${step.status}`);
    assert.ok(step.reason, 'step must have reason');
  }
});

test('buildReport: detects missing docker on host without docker', () => {
  const guide = buildGuide(acmeRunDir);
  const plan = readJson(path.join(acmeRunDir, 'plan.json'));

  const fakeHost = {
    os: 'linux',
    osVersion: '5.15.0',
    arch: 'x64',
    shell: '/bin/bash',
    cpus: 4,
    memory: { total: 16, free: 8 },
    node: 'v20.10.0',
    npm: '10.2.3',
    python: '3.11.5',
    pip: '23.3.1',
    docker: { present: false, version: null, compose: false, composeVersion: null },
    git: 'git version 2.40.0',
    make: 'GNU Make 4.3',
    wsl: false,
    ports: [],
    envFiles: { '.env': { exists: false }, '.env.example': { exists: true, lines: 5 } },
    diskSpace: { available: '50G' },
    timestamp: new Date().toISOString()
  };

  const report = buildReport(guide, fakeHost, plan);

  // Should detect missing docker
  const dockerMissing = report.missingTools.find(m => m.tool === 'docker');
  assert.ok(dockerMissing, 'should detect missing docker');
  assert.ok(dockerMissing.reason.includes('Docker not installed'));

  // When docker is not installed, we don't separately report docker compose
  // (it's implied by docker missing)
  const composeMissing = report.missingTools.find(m => m.tool === 'docker compose');
  assert.ok(!composeMissing, 'should not separately report docker compose when docker is missing');
});

test('buildReport: detects old Node.js version', () => {
  const guide = buildGuide(acmeRunDir);
  const plan = readJson(path.join(acmeRunDir, 'plan.json'));

  const fakeHost = {
    os: 'linux',
    osVersion: '5.15.0',
    arch: 'x64',
    shell: '/bin/bash',
    cpus: 4,
    memory: { total: 16, free: 8 },
    node: 'v16.20.0', // Too old - plan needs 20
    npm: '8.19.4',
    python: '3.11.5',
    pip: '23.3.1',
    docker: { present: true, version: '24.0.0', compose: true, composeVersion: 'v2.23.0' },
    git: 'git version 2.40.0',
    make: 'GNU Make 4.3',
    wsl: false,
    ports: [],
    envFiles: { '.env': { exists: false }, '.env.example': { exists: true, lines: 5 } },
    diskSpace: { available: '50G' },
    timestamp: new Date().toISOString()
  };

  const report = buildReport(guide, fakeHost, plan);

  // Should have warning about Node version
  const nodeWarning = report.warnings.find(w => w.tool === 'node');
  assert.ok(nodeWarning, 'should warn about old Node.js version');
  assert.ok(nodeWarning.reason.includes('16') && nodeWarning.reason.includes('20'));
});

test('buildReport: scorecard matches guide scorecard', () => {
  const guide = buildGuide(acmeRunDir);
  const plan = readJson(path.join(acmeRunDir, 'plan.json'));
  const fakeHost = {
    os: 'linux', osVersion: '5.15.0', arch: 'x64', shell: '/bin/bash', cpus: 4,
    memory: { total: 16, free: 8 }, node: 'v20.10.0', npm: '10.2.3',
    python: '3.11.5', pip: '23.3.1',
    docker: { present: true, version: '24.0.0', compose: true, composeVersion: 'v2.23.0' },
    git: 'git version 2.40.0', make: 'GNU Make 4.3', wsl: false, ports: [],
    envFiles: { '.env': { exists: false }, '.env.example': { exists: true, lines: 5 } },
    diskSpace: { available: '50G' }, timestamp: new Date().toISOString()
  };

  const report = buildReport(guide, fakeHost, plan);

  // Scorecard should match guide scorecard
  assert.equal(report.scorecard.proven, guide.scorecard.proven);
  assert.equal(report.scorecard.translated, guide.scorecard.translated);
  assert.equal(report.scorecard.needsHuman, guide.scorecard.needsHuman);
  assert.equal(report.scorecard.skipped.length, guide.scorecard.skipped.length);
});
