import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGithubRepo } from '../src/remote.js';
import { matchKnownFix } from '../lens/engine.js';

test('parseGithubRepo accepts the ways people paste a repo', () => {
  assert.deepEqual(parseGithubRepo('expressjs/express'), { owner: 'expressjs', name: 'express', ref: null });
  assert.deepEqual(parseGithubRepo('https://github.com/expressjs/express.git'), { owner: 'expressjs', name: 'express', ref: null });
  assert.deepEqual(parseGithubRepo('github.com/a-b/c.d/tree/v1.2'), { owner: 'a-b', name: 'c.d', ref: 'v1.2' });
  assert.equal(parseGithubRepo('https://gitlab.com/a/b'), null);
  assert.equal(parseGithubRepo('a/..'), null);
  assert.equal(parseGithubRepo('not a repo'), null);
});

const fixes = [
  { signature: 'socketError: Error: connect ECONNREFUSED 127.0.0.1:6379', cause: 'Redis is not running.', fix: 'docker compose up -d', evidence: 'E5' },
  { signature: 'npm error Missing script: "migrate"', cause: 'Script renamed.', fix: 'npm run db:migrate', evidence: 'E3' },
];

test('matchKnownFix tolerates OCR noise in a circled error', () => {
  const ocr = '[ioredis] Unhandled error event: socketError: Error: connect ECONNREFUSED 127.0.0.1:\nat TCPConnectlrap.afterConnect';
  assert.equal(matchKnownFix(ocr, fixes)?.evidence, 'E5');
});

test('matchKnownFix does not guess on unrelated text', () => {
  assert.equal(matchKnownFix('TypeError: cannot read properties of undefined (reading map)', fixes), null);
  assert.equal(matchKnownFix('', fixes), null);
});
