import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { runManualChecker } from '../src/onboarder/manual-checker.js';
import { readMasked, runEnvWizard, writeEnvFile } from '../src/onboarder/env-wizard.js';

function tempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'humble-env-'));
  fs.writeFileSync(path.join(dir, '.env.example'), 'PORT=3000\nAPI_TOKEN=\nDATABASE_URL=your-database-url\n');
  return dir;
}

test('manual checker checks project-local files and rejects paths outside the repo', async () => {
  const root = tempProject();
  fs.writeFileSync(path.join(root, 'ready.txt'), 'server started\n');
  const passed = await runManualChecker({ type: 'file-has', file: 'ready.txt', pattern: 'server started' }, { cwd: root });
  assert.equal(passed.passed, true);
  const missing = await runManualChecker({ type: 'file-has', file: 'missing.txt' }, { cwd: root });
  assert.equal(missing.passed, false);
  const outside = await runManualChecker({ type: 'file-has', file: '../private.txt' }, { cwd: root });
  assert.equal(outside.passed, false);
});

test('manual checker only contacts a loopback HTTP service', async () => {
  const local = await runManualChecker({ type: 'http', url: 'http://localhost:1/health', expect: 200 });
  assert.equal(local.passed, false);
  const remote = await runManualChecker({ type: 'http', url: 'https://example.com', expect: 200 });
  assert.equal(remote.passed, false);
  const unsupported = await runManualChecker({ type: 'exit', command: 'echo nope' });
  assert.equal(unsupported.passed, false);
});

test('env wizard masks prompts, writes locally with restrictive mode, and never returns values', async () => {
  const root = tempProject();
  const fakeToken = `${String.fromCharCode(103, 104, 112, 95)}${'b'.repeat(36)}`;
  const prompts = [];
  const result = await runEnvWizard({
    projectDir: root,
    ask: async (prompt) => {
      prompts.push(prompt);
      return prompt.startsWith('API_TOKEN') ? fakeToken : 'postgres://local/db';
    },
  });
  const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
  assert.match(env, new RegExp(fakeToken));
  assert.deepEqual(prompts, ['API_TOKEN: ', 'DATABASE_URL: ']);
  assert.equal(JSON.stringify(result).includes(fakeToken), false);
  assert.equal(JSON.stringify(result).includes('postgres://local/db'), false);
  assert.equal(Object.hasOwn(result, 'values'), false);
  if (process.platform !== 'win32') assert.equal((fs.statSync(path.join(root, '.env')).mode & 0o777), 0o600);
});

test('masked input returns the secret but echoes only masking bullets', async () => {
  const input = new PassThrough();
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (value) => { input.isRaw = value; };
  const output = new PassThrough();
  let shown = '';
  output.on('data', (chunk) => { shown += chunk.toString(); });
  const reading = readMasked('TOKEN: ', { input, output });
  const secret = 'private-value-77';
  input.write(secret);
  input.write('\r');
  assert.equal(await reading, secret);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(shown.includes(secret), false);
  assert.match(shown, /TOKEN: •+/);
  assert.equal(input.isRaw, false);
});

test('env wizard preserves existing values already stored in .env', async () => {
  const root = tempProject();
  const existing = 'API_TOKEN=old-local-token\n';
  fs.writeFileSync(path.join(root, '.env'), existing, { mode: 0o600 });
  await writeEnvFile({ projectDir: root, values: { API_TOKEN: 'replacement' } });
  let env = fs.readFileSync(path.join(root, '.env'), 'utf8');
  assert.ok(env.startsWith(existing));
  assert.doesNotMatch(env, /API_TOKEN=replacement/);

});

test('env wizard refuses a symlink output file', async (t) => {
  const second = tempProject();
  const target = path.join(second, 'target.env');
  fs.writeFileSync(target, 'outside=true\n');
  try { fs.symlinkSync(target, path.join(second, '.env')); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('Symlink creation is unavailable in this environment.'); return; }
    throw error;
  }
  await assert.rejects(writeEnvFile({ projectDir: second, values: {} }), /regular file/);
  env = fs.readFileSync(target, 'utf8');
  assert.equal(env, 'outside=true\n');
});
