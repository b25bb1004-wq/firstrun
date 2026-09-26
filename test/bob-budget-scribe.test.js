import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeBudget } from '../src/pipeline.js';
import { rewriteDoc } from '../src/scribe/readme.js';

test('a Bob call never gets more than the run has left (huggingface_hub: 1.45 spent on a 1-Bobcoin run)', () => {
  const b = makeBudget(1, 1.5);
  assert.equal(b.cap(), 1, 'first call: capped by the run total, not the 1.5 per-call limit');
  b.spend(0.78);
  assert.ok(Math.abs(b.cap() - 0.22) < 1e-9, 'second call: only what is left');
  b.spend(0.22);
  assert.equal(b.cap(), 0);
});

test('Scribe skips steps IBM Bob planned from prose (line 0) instead of crashing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-scribe-'));
  fs.writeFileSync(path.join(root, 'CONTRIBUTING.md'), '# Contributing\n\nWe recommend uv. Install the dev extras and run the tests.\n');
  const src = { file: 'CONTRIBUTING.md', line: 0, where: '§4', section: 'extracted by IBM Bob' };
  const plan = { steps: [{ id: 'S1', command: 'uv pip install -e ".[dev]"', origin: 'readme', status: 'passed', source: src }], runtime: { name: 'python', version: '3.10' } };
  assert.doesNotThrow(() => rewriteDoc({ root, docFile: 'CONTRIBUTING.md', plan, evidence: [], passport: {} }));
});

test('env vars read only by maintainer tooling are not flagged as undocumented (huggingface_hub GITHUB_TOKEN)', async () => {
  const { scout } = await import('../src/scout/index.js');
  const { buildPlan } = await import('../src/plan.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-maint-'));
  fs.writeFileSync(path.join(root, 'README.md'), '# x\n\n## Install\n\n```bash\npip install -e .\n```\n');
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "x"\n');
  fs.mkdirSync(path.join(root, 'utils', 'release_notes'), { recursive: true });
  fs.writeFileSync(path.join(root, 'utils', 'release_notes', 'fetch_prs.py'), 'import os\nTOKEN = os.environ["GITHUB_TOKEN"]\n');
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'app.py'), 'import os\nKEY = os.environ["APP_SECRET"]\n');
  const what = buildPlan(await scout(root)).conflicts.map((c) => c.what);
  assert.ok(!what.includes('env var GITHUB_TOKEN'), 'release tooling ignored');
  assert.ok(what.includes('env var APP_SECRET'), 'the app itself still flagged');
});
