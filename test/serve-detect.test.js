import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/plan.js';

const classifyFacts = {};

test('just run should be detected as serve', () => {
  const result = classify('just run', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('just dev should be detected as serve', () => {
  const result = classify('just dev', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('just start should be detected as serve', () => {
  const result = classify('just start', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('just serve should be detected as serve', () => {
  const result = classify('just serve', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('bun run dev should be detected as serve', () => {
  const result = classify('bun run dev', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('bun run start should be detected as serve', () => {
  const result = classify('bun run start', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('bun run serve should be detected as serve', () => {
  const result = classify('bun run serve', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('cd frontend && bun run dev should be detected as serve', () => {
  const result = classify('cd frontend && bun run dev', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('cd frontend && just run should be detected as serve', () => {
  const result = classify('cd frontend && just run', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('cd frontend && just dev should be detected as serve', () => {
  const result = classify('cd frontend && just dev', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('cd frontend && just start should be detected as serve', () => {
  const result = classify('cd frontend && just start', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('cd frontend && just serve should be detected as serve', () => {
  const result = classify('cd frontend && just serve', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('DEBUG=* cd frontend && bun run dev should be detected as serve', () => {
  const result = classify('DEBUG=* cd frontend && bun run dev', classifyFacts);
  assert.equal(result.kind, 'serve');
});

test('cd backend && pytest should NOT be serve', () => {
  const result = classify('cd backend && pytest', classifyFacts);
  assert.equal(result.kind, 'test');
});

test('just test should NOT be serve', () => {
  const result = classify('just test', classifyFacts);
  assert.equal(result.kind, 'test');
});

test('bun run build should NOT be serve', () => {
  const result = classify('bun run build', classifyFacts);
  assert.equal(result.kind, 'build');
});