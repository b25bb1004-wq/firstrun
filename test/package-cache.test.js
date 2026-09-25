import test from 'node:test';
import assert from 'node:assert/strict';
import { Sandbox, removeCacheVolume, cleanupAll } from '../src/sandbox.js';
import { buildPassport } from '../src/scribe/passport.js';
import { renderReport } from '../src/scribe/report.js';
import { run } from '../src/util.js';

test('buildPassport and renderReport include package cache note when replay reuses downloads', () => {
  const plan = {
    repo: 'acme/shop',
    commit: 'abc1234',
    image: 'node:20-slim',
    runtime: { name: 'node', version: '20' },
    steps: [
      { id: 'S1', command: 'npm install', origin: 'readme', status: 'passed' },
    ],
    verify: { kind: 'http', target: 'http://127.0.0.1:3000' },
    conflicts: [],
  };
  const passport = buildPassport({
    plan,
    evidence: [],
    replay: { status: 'passed', durationMs: 12000 },
    bobcoins: 0,
    stopped: null,
    packageCache: true,
  });

  assert.equal(passport.packageCache, true);
  assert.equal(passport.replaySeconds, 12);

  const report = renderReport({
    passport,
    plan,
    evidence: [],
    firstFailure: null,
    conflicts: [],
  });

  assert.match(report, /Replay reused this run's package downloads from cold start \(npm, yarn, pip, uv cache\)\./);
});

test('renderReport omits package cache note when packageCache is explicitly false and no replay', () => {
  const plan = {
    repo: 'acme/shop',
    commit: 'abc1234',
    image: 'node:20-slim',
    runtime: { name: 'node', version: '20' },
    steps: [
      { id: 'S1', command: 'npm install', origin: 'readme', status: 'needs-human' },
    ],
    verify: { kind: 'http', target: 'http://127.0.0.1:3000' },
    conflicts: [],
  };
  const passport = buildPassport({
    plan,
    evidence: [],
    replay: null,
    bobcoins: 0,
    stopped: 'S1',
    packageCache: false,
  });

  assert.equal(passport.packageCache, false);

  const report = renderReport({
    passport,
    plan,
    evidence: [],
    firstFailure: null,
    conflicts: [],
  });

  assert.doesNotMatch(report, /Replay reused this run's package downloads/);
});

test('Sandbox per-run package cache mounts and shares cached downloads across containers', async (t) => {
  const dockerOk = (await run('docker', ['info'])).code === 0;
  if (!dockerOk) {
    t.skip('Docker is not running');
    return;
  }

  const volName = `firstrun-cache-test-${Date.now()}`;
  const box1 = new Sandbox({
    image: 'node:20-slim',
    repoDir: process.cwd(),
    label: 'test-cache',
    cacheVolume: volName,
  });

  try {
    await box1.start();
    // Simulate npm storing files in /root/.npm
    await box1.sh('echo "cached-artifact-data" > /root/.npm/cached-pkg.txt');
    await box1.stop();

    // Replay box starts with the same cacheVolume
    const box2 = new Sandbox({
      image: 'node:20-slim',
      repoDir: process.cwd(),
      label: 'test-cache-replay',
      cacheVolume: volName,
    });

    await box2.start();
    const result = await box2.sh('cat /root/.npm/cached-pkg.txt');
    assert.equal(result.out.trim(), 'cached-artifact-data', 'replay sandbox should see packages cached by the cold start');
    await box2.stop();
  } finally {
    await removeCacheVolume(volName);
  }

  // Volume should be removed
  const inspect = await run('docker', ['volume', 'inspect', volName]);
  assert.notEqual(inspect.code, 0, 'volume should be deleted after removeCacheVolume');
});
