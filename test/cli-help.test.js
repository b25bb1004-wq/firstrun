import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// `audit --help` once started a real 16-repo audit; `verify --help` started a container. Help must never run anything.
// A run would print its banner ("HUMBLE swarm" / "HUMBLE ·") before any Docker work; help prints only the help text.
for (const cmd of ['audit', 'verify', 'plan', 'run', 'doctor', 'scout', 'replay', 'scribe', 'dock', 'ui', 'guide']) {
  for (const flag of ['--help', '-h']) {
    test(`${cmd} ${flag} prints help and starts nothing`, () => {
      const r = spawnSync(process.execPath, ['bin/firstrun.js', cmd, flag], { encoding: 'utf8', timeout: 20_000 });
      assert.equal(r.status, 0, r.stderr);
      assert.doesNotMatch(r.stdout, /HUMBLE swarm|^HUMBLE ·|cloning /m, 'no run banner');
      assert.match(r.stdout, /^HUMBLE: your README, proven./, 'prints the help text');
    });
  }
}
