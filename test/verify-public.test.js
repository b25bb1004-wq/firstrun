import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repoVisibility } from '../api/verify.js';

const reply = (status, body) => async () => ({ status, ok: status < 300, json: async () => body });

test('public repo passes', async () => {
  assert.equal(await repoVisibility('koajs', 'koa', reply(200, { private: false })), 'public');
});

test('private or missing repo is refused before a workflow run (anonymous 404)', async () => {
  assert.equal(await repoVisibility('b25bb1004-wq', 'firstrun', reply(404, {})), 'not-public');
});

test('rate limit or network error does not block: the workflow decides', async () => {
  assert.equal(await repoVisibility('a', 'b', reply(403, {})), 'unknown');
  assert.equal(await repoVisibility('a', 'b', async () => { throw new Error('offline'); }), 'unknown');
});

test('the check never sends our token', async () => {
  let headers;
  await repoVisibility('a', 'b', async (_u, o) => { headers = o.headers; return { status: 200, ok: true, json: async () => ({}) }; });
  assert.equal(headers.Authorization, undefined);
});
