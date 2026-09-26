import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../src/doctor/rules.js';
import { attributeEvidence } from '../src/scribe/attribution.js';

// Real tail of HUMBLE's own README run (26 Sep): `node bin/firstrun.js verify examples/acme-shop` inside the sandbox.
const LOG = `■ Following the docs on a clean machine
  · pulling node:16…

✗ docker run -d --name firstrun-010a2265 --label firstrun=acme-shop-7ec107eb --entrypoint sleep -e CI=true -w /workspace node:16 infinity failed (97):`;
const rule = RULES.find((r) => r.id === 'needs-docker-daemon');

test('a step that needs a Docker engine inside the sandbox is a HUMBLE limit, not a docs break', () => {
  const d = rule.test({ log: LOG, step: { command: 'node bin/firstrun.js verify examples/acme-shop' } });
  assert.equal(d.class, 'sandbox-limit');
  assert.equal(d.fix, null);
  assert.equal(attributeEvidence({ status: 'needs-human', diagnosis: { ...d, by: 'rules' } }), 'humble');
});

test('ordinary failures are not mistaken for it', () => {
  assert.equal(rule.test({ log: 'npm ERR! missing script: start', step: { command: 'npm start' } }), null);
});
