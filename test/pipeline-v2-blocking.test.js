import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HARD_BLOCK_KINDS } from '../src/pipeline.js';

test('HARD_BLOCK_KINDS contains install, prereq, env, services, migrate, build', () => {
  const required = ['install', 'prereq', 'env', 'services', 'migrate', 'build'];
  for (const k of required) {
    assert.ok(HARD_BLOCK_KINDS.has(k), `HARD_BLOCK_KINDS should contain ${k}`);
  }
});

test('HARD_BLOCK_KINDS does NOT contain serve, other, test', () => {
  const forbidden = ['serve', 'other', 'test'];
  for (const k of forbidden) {
    assert.ok(!HARD_BLOCK_KINDS.has(k), `HARD_BLOCK_KINDS should NOT contain ${k}`);
  }
});