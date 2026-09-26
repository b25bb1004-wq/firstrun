import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scout } from '../src/scout/index.js';
import { buildPlan, classify } from '../src/plan.js';

// HUMBLE plans its OWN README (dogfooding). Three bugs it exposed, which hit other repos too.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('node --test is a test step', () => {
  assert.equal(classify('node --test test/*.test.js', {}).kind, 'test');
});

test("running this repo's own CLI (a package.json bin) is a one-shot command, not a server", async () => {
  const facts = await scout(ROOT);
  assert.ok(facts.binPaths.includes('bin/firstrun.js'));
  assert.equal(classify('node bin/firstrun.js plan examples/acme-shop', facts).kind, 'other');
  assert.equal(classify('node server.js', facts).kind, 'serve', 'a plain node file is still a server candidate');
});

test('examples/ sub-projects do not leak their ports and env vars into the repo', async () => {
  const facts = await scout(ROOT);
  // (facts.ports still lists 6379 etc.: HUMBLE's own service catalog names them. Harmless: nothing here serves.)
  assert.ok(!facts.compose || !/examples?\//.test(facts.compose.file || ''), "examples/acme-shop's compose file is not HUMBLE's");
  assert.ok(!facts.envVarsInCode.some((v) => v.name === 'DATABASE_URL'), 'acme-shop\'s DATABASE_URL is not HUMBLE\'s');
  const plan = buildPlan(facts, { repo: 'b25bb1004-wq/firstrun' });
  assert.notEqual(plan.verify.kind, 'http');
  assert.ok(plan.steps.some((s) => !s.skip && s.command === 'node --test test/*.test.js' && s.kind === 'test'));
});
