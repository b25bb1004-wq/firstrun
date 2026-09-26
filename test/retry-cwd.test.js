import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreCwd } from '../src/pipeline.js';

/** Minimal fake sandbox that only tracks file writes/reads in memory. */
function fakeSandbox(initial = {}) {
  const files = { ...initial };
  return {
    files,
    readFile(p) { return Promise.resolve(files[p] ?? null); },
    writeFile(p, c) { files[p] = c; return Promise.resolve(); },
  };
}

test('restoreCwd: writes cwd to /firstrun/cwd', async () => {
  const sb = fakeSandbox();
  await restoreCwd(sb, '/workspace/my-app');
  assert.equal(sb.files['/firstrun/cwd'], '/workspace/my-app');
});

test('restoreCwd: does nothing when cwd is null', async () => {
  const sb = fakeSandbox({ '/firstrun/cwd': '/workspace' });
  await restoreCwd(sb, null);
  assert.equal(sb.files['/firstrun/cwd'], '/workspace'); // unchanged
});

test('restoreCwd: does nothing when cwd is empty string', async () => {
  const sb = fakeSandbox({ '/firstrun/cwd': '/workspace' });
  await restoreCwd(sb, '');
  assert.equal(sb.files['/firstrun/cwd'], '/workspace'); // unchanged
});

test('restoreCwd: never touches /firstrun/state.env', async () => {
  const sb = fakeSandbox({ '/firstrun/state.env': 'declare -x FOO="bar"' });
  await restoreCwd(sb, '/workspace/app');
  assert.equal(sb.files['/firstrun/state.env'], 'declare -x FOO="bar"');
  assert.equal(Object.keys(sb.files).filter((k) => k !== '/firstrun/cwd' && k !== '/firstrun/state.env').length, 0);
});
