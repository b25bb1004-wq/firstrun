import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { asManualGuideStep, sessionEnvironment, translate } from '../src/onboarder/platform.js';
import { buildReport } from '../src/onboarder/report.js';
import { buildGuide } from '../src/onboarder/guide.js';
import { readJson } from '../src/util.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'humble-platform-'));

test('Windows translations are labeled as unproven and retain the Linux command', () => {
  const rows = [
    ['cp .env.example .env', "Copy-Item -LiteralPath '.env.example' -Destination '.env'"],
    ['cp -r assets public', "Copy-Item -LiteralPath 'assets' -Destination 'public' -Recurse"],
    ['export PORT=3000', "$env:PORT = '3000'"],
    ['export MESSAGE="hello world"', "$env:MESSAGE = 'hello world'"],
    ['. venv/bin/activate', "& 'venv\\Scripts\\Activate.ps1'"],
    ['source .venv/bin/activate', "& '.venv\\Scripts\\Activate.ps1'"],
    ['which python', "Get-Command 'python'"],
    ['python3 manage.py migrate', 'py -3 manage.py migrate'],
    ['python3 -m pip install -r requirements.txt', 'py -3 -m pip install -r requirements.txt'],
    ['npm ci', 'npm ci'],
    ['npm test', 'npm test'],
    ['node server.js', 'node server.js'],
    ['git status', 'git status'],
    ['npx vite --host', 'npx vite --host'],
    ['Copy-Item input output', 'Copy-Item input output'],
    ['py -3 --version', 'py -3 --version'],
    ['npm ci && npm test', 'npm ci\nnpm test'],
    ['cp a b && python3 -m app', "Copy-Item -LiteralPath 'a' -Destination 'b'\npy -3 -m app"],
    ['export A=1 && export B=2', "$env:A = '1'\n$env:B = '2'"],
    ['cd app && npm test', 'cd app\nnpm test'],
    ['rm -rf node_modules', "Remove-Item -LiteralPath 'node_modules' -Recurse -Force"],
    ['rm -rf ./node_modules', "Remove-Item -LiteralPath 'node_modules' -Recurse -Force"],
    ['rm -r build', "Remove-Item -LiteralPath 'build' -Recurse -Force"],
  ];
  for (const [command, expected] of rows) {
    const result = translate({ id: 'S1', do: { command } }, 'win32', { repoRoot: root });
    assert.equal(result.status, 'translated', command);
    assert.equal(result.original, command);
    assert.equal(result.proven.command, command);
    assert.equal(result.command, expected, command);
  }
});

test('Windows commands outside the repository and Linux-only commands become manual cards', () => {
  const rows = [
    ['rm -rf ../outside', 'removal'],
    ['rm -rf .', 'removal'],
    ['rm -rf C:\\secrets', 'removal'],
    ['rm -rfv cache', 'flags'],
    ['apt-get install -y libpq-dev', 'Linux package'],
    ['sudo apt-get update', 'Linux package'],
    ['systemctl start postgresql', 'Linux package'],
    ['service redis start', 'Linux package'],
    ['echo ok || true', 'shell expression'],
  ];
  for (const [command, why] of rows) {
    const result = translate({ id: 'S2', title: 'Setup', do: { command }, check: { type: 'file-has', file: 'ready.txt' } }, 'win32', { repoRoot: root });
    const expectedStatus = /^(?:sudo\s+)?(?:apt-get|apt|systemctl|service)\b/i.test(command) ? 'needs-wsl' : 'manual';
    assert.equal(result.status, expectedStatus, command);
    assert.match(result.text, new RegExp(why, 'i'));
    const card = asManualGuideStep({ id: 'S2', title: 'Setup', check: { type: 'file-has', file: 'ready.txt' }, do: { command } }, result);
    assert.equal(card.kind, 'manual');
    assert.equal(card.checker.file, 'ready.txt');
    assert.equal('command' in card, false);
    assert.equal(JSON.stringify(card).includes(command), false);
  }
});

test('macOS adds BSD sed syntax and gives Homebrew alternatives for Linux package steps', () => {
  const rows = [
    ["sed -i 's/old/new/' file.txt", "sed -i '' 's/old/new/' file.txt"],
    ['sed -i -e s/a/b/ config', "sed -i '' -e s/a/b/ config"],
    ['npm ci', 'npm ci'],
    ['python3 -m venv .venv', 'python3 -m venv .venv'],
    ['git status', 'git status'],
    ['node --version', 'node --version'],
  ];
  for (const [command, expected] of rows) {
    const result = translate({ do: { command } }, 'darwin', { repoRoot: root });
    assert.equal(result.status, 'translated');
    assert.equal(result.command, expected);
    assert.equal(result.proven.command, command);
  }
  const manual = translate({ do: { command: 'apt-get install libpq-dev' } }, 'darwin', { repoRoot: root });
  assert.equal(manual.status, 'manual');
  assert.equal(manual.hostOs, 'darwin');
  assert.match(manual.hint, /Homebrew.*libpq/);
});

test('Linux keeps its original proof status and command unchanged', () => {
  const command = 'cp .env.example .env && npm test';
  const result = translate({ do: { command } }, 'linux', { repoRoot: root });
  assert.equal(result.status, 'proven');
  assert.equal(result.command, command);
});

test('sensitive exported values are hidden from host-specific guide cards', () => {
  const fakeToken = `${String.fromCharCode(103, 104, 112, 95)}${'c'.repeat(36)}`;
  const step = {
    id: 'SECRET1', title: 'Set token', why: { cause: 'The app needs credentials.' },
    do: { command: `export API_TOKEN=${fakeToken}` },
    check: { type: 'file-has', file: '.env', pattern: '^API_TOKEN=' },
  };
  const translated = translate(step, 'win32', { repoRoot: root });
  const card = asManualGuideStep(step, translated);
  assert.equal(translated.status, 'manual');
  assert.equal(JSON.stringify(card).includes(fakeToken), false);
  assert.equal('command' in card, false);
});

test('Windows session environment carries non-secret exports and venv activation to later steps', () => {
  const env = sessionEnvironment({ do: { command: 'export APP_MODE=dev && . .venv/bin/activate' } }, 'win32', { repoRoot: root, baseEnv: { PATH: 'base-path' } });
  assert.equal(env.APP_MODE, 'dev');
  assert.equal(env.VIRTUAL_ENV, path.join(root, '.venv'));
  assert.match(env.PATH, /^.*\.venv[\\/]Scripts[;].*base-path$/);
  const secret = sessionEnvironment({ do: { command: 'export DATABASE_URL=example' } }, 'win32', { repoRoot: root });
  assert.equal(Object.hasOwn(secret, 'DATABASE_URL'), false);
});

test('report exposes proven, translated and manual platform status with original proof beside proposals', () => {
  const runDir = path.resolve('web/public/data/runs/acme-shop-3c0bc2b2/f');
  const guide = buildGuide(runDir);
  guide.steps.push({
    id: 'MANUAL1', title: 'Start system package', kind: 'other', say: { new: 'Start the service.' },
    why: { cause: 'A Linux service command.' }, do: { type: 'run', command: 'systemctl start postgres' },
    check: { type: 'file-has', file: 'ready.txt', pattern: 'ready' },
    platform: { linux: 'proven', darwin: 'translated', win32: 'translated' }, timeoutMs: 1000,
    undo: { type: 'none' }, risk: 'low', optional: false,
  });
  guide.steps.push({
    id: 'ENVSECRET', title: 'Configure environment', kind: 'env', say: { new: 'Add local environment values.' },
    why: { cause: 'The app needs configuration.' }, do: { type: 'secret', key: 'API_TOKEN' },
    check: { type: 'file-has', file: '.env', pattern: '^' },
    platform: { linux: 'proven', darwin: 'translated', win32: 'translated' }, timeoutMs: 1000,
    undo: { type: 'restore-file', file: '.env' }, risk: 'low', optional: false,
  });
  const plan = readJson(path.join(runDir, 'plan.json'));
  const host = {
    os: 'win32', osVersion: 'Windows', arch: 'x64', shell: 'powershell', cpus: 4,
    memory: { total: 8, free: 4 }, node: 'v20.0.0', npm: '10.0.0', python: '3.12.0',
    pip: '24.0', docker: { present: true, version: '27', compose: true, composeVersion: '2' },
    git: 'git version 2', make: 'not found', wsl: false, ports: [], envFiles: {},
    diskSpace: null, timestamp: new Date().toISOString(),
  };
  const report = buildReport(guide, host, plan);
  const translated = report.steps.find((step) => step.id === 'S4');
  const manual = report.steps.find((step) => step.id === 'MANUAL1');
  const envSecret = report.steps.find((step) => step.id === 'ENVSECRET');
  assert.equal(translated.platformStatus, 'translated');
  assert.match(translated.provenCommand, /cp \.env\.example \.env/);
  assert.match(translated.translatedCommand, /Copy-Item/);
  assert.equal(manual.status, 'manual');
  assert.equal(manual.platformStatus, 'needs-wsl');
  assert.equal(manual.manual.kind, 'manual');
  assert.deepEqual(manual.manual.checker, { type: 'file-has', file: 'ready.txt', pattern: 'ready' });
  assert.equal('command' in manual.manual, false);
  const hostManual = report.platformGuide.steps.find((step) => step.id === 'MANUAL1');
  assert.equal(hostManual.kind, 'manual');
  assert.equal(hostManual.platformStatus, 'needs-wsl');
  assert.equal(typeof hostManual.text, 'string');
  assert.ok(hostManual.why);
  assert.deepEqual(hostManual.checker, manual.manual.checker);
  assert.equal('do' in hostManual, false);
  assert.equal(report.platformGaps.find((gap) => gap.stepId === 'MANUAL1').type, 'needs-wsl');
  assert.equal(envSecret.status, 'needs-human');
  assert.equal(envSecret.platformStatus, 'proven');
  assert.equal(report.platformGuide.steps.find((step) => step.id === 'ENVSECRET').do.type, 'secret');
});
