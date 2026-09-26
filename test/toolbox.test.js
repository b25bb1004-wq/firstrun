import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TOOLBOX, pinInstaller } from '../src/doctor/toolbox.js';
import { RULES } from '../src/doctor/rules.js';

// Real installer commands Bob proposed for axios (audit/known-5 R2, R3): both URLs failed.
const bobDeno = [
  'curl -fsSL https://deno.land/install.sh | sh && export DENO_INSTALL="$HOME/.deno" && export PATH="$DENO_INSTALL/bin:$PATH"',
  'curl -fsSL https://deno.land/x/install/install.sh | sh && export DENO_INSTALL="$HOME/.deno" && export PATH="$DENO_INSTALL/bin:$PATH"',
];

test('Bob-invented installers for a known tool are replaced by the toolbox command', () => {
  for (const c of bobDeno) assert.equal(pinInstaller(c), TOOLBOX.deno);
  assert.equal(pinInstaller('curl -fsSL https://bun.sh/install | bash'), TOOLBOX.bun);
});

test('ordinary commands are left alone', () => {
  for (const c of ['npm ci', 'curl -fsSL http://127.0.0.1:3000/health', 'pip install -e ".[dev]"', 'curl -sSL https://example.com/setup.sh | sh']) {
    assert.equal(pinInstaller(c), c);
  }
});

test('every toolbox entry is idempotent and works on node and python images', () => {
  for (const [tool, cmd] of Object.entries(TOOLBOX)) {
    if (tool === 'pnpm' || tool === 'yarn') continue;
    assert.match(cmd, new RegExp(`^command -v ${tool === 'just' ? 'just' : tool} >/dev/null \|\|`), tool);
    assert.match(cmd, /npm install -g|pip install/, tool);
  }
});

test('missing-tool rule uses the toolbox for bun, deno, uv, just', () => {
  const rule = RULES.find((r) => r.id === 'missing-tool');
  for (const tool of ['bun', 'deno', 'uv', 'just']) {
    const d = rule.test({ log: `bash: line 1: ${tool}: command not found`, facts: {}, step: { command: `${tool} --version` } });
    assert.equal(d.fix.actions[0].command, TOOLBOX[tool], tool);
  }
});
