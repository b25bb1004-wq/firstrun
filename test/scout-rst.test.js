import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scout } from '../src/scout/index.js';
import { buildPlan, parseRST, isRSTShellBlock, rstSectionPath, rstBlockCommands } from '../src/plan.js';

function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-scout-'));
  for (const [f, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), body);
  }
  return root;
}

test('scout: finds CONTRIBUTING.rst and DEVELOPMENT.rst at root', async () => {
  const facts = await scout(repo({ 'README.md': '# x', 'CONTRIBUTING.rst': 'x', 'DEVELOPMENT.rst': 'x', 'CHANGES.rst': 'x' }));
  assert.ok(facts.docsRst.includes('CONTRIBUTING.rst'), 'CONTRIBUTING.rst should be in docsRst');
  assert.ok(facts.docsRst.includes('DEVELOPMENT.rst'), 'DEVELOPMENT.rst should be in docsRst');
  assert.equal(facts.docsRst.includes('CHANGES.rst'), false, 'CHANGES.rst should not be in docsRst');
});

test('scout: finds docs/**/contributing.(md|rst), docs/**/development.(md|rst) case-insensitive', async () => {
  const facts = await scout(repo({
    'README.md': '# x',
    'docs/contributing.rst': 'x',
    'docs/development.md': 'x',
    'docs/guide/installation.rst': 'x',  // should NOT be included (installation is for users)
    'docs/guide/CONTRIBUTING.md': 'x',
    'docs/guide/DEVELOPMENT.rst': 'x',
    'docs/api.rst': 'x',
  }));
  assert.ok(facts.docsRst.includes('docs/contributing.rst'), 'docs/contributing.rst should be in docsRst');
  assert.ok(facts.docsRst.includes('docs/development.md'), 'docs/development.md should be in docsRst');
  assert.equal(facts.docsRst.includes('docs/guide/installation.rst'), false, 'docs/guide/installation.rst should NOT be in docsRst (installation is for users)');
  assert.ok(facts.docsRst.includes('docs/guide/CONTRIBUTING.md'), 'docs/guide/CONTRIBUTING.md should be in docsRst');
  assert.ok(facts.docsRst.includes('docs/guide/DEVELOPMENT.rst'), 'docs/guide/DEVELOPMENT.rst should be in docsRst');
  assert.equal(facts.docsRst.includes('docs/api.rst'), false, 'docs/api.rst should not be in docsRst');
});

test('scout: limits extra docsRst to 5 files', async () => {
  const facts = await scout(repo({
    'README.md': '# x',
    'CONTRIBUTING.rst': 'x',
    'DEVELOPMENT.rst': 'x',
    'docs/contributing.rst': 'x',
    'docs/development.rst': 'x',
    'docs/installation.rst': 'x',
    'docs/guide/contributing.rst': 'x',
    'docs/guide/development.rst': 'x',
    'docs/guide/installation.rst': 'x',
  }));
  assert.equal(facts.docsRst.length, 5, 'docsRst should be limited to 5');
});

test('plan: parseRST extracts code-block:: bash commands with line numbers', () => {
  const rstText = `Install
=======

Create a virtualenv::

    $ python3 -m venv .venv
    $ . .venv/bin/activate

Install dependencies:

.. code-block:: bash

    $ pip install -e .
    $ pip install pytest

Run tests:

.. code-block:: sh

    $ pytest`;

  const rst = parseRST(rstText);
  
  assert.ok(rst.blocks.length >= 2, 'Should find at least 2 code blocks');
  
  const installBlock = rst.blocks.find(b => b.lines.some(l => l.text.includes('pip install -e')));
  assert.ok(installBlock, 'Should find install block');
  assert.equal(installBlock.lang, 'bash', 'Language should be bash');
  
  const cmds = rstBlockCommands(installBlock);
  assert.ok(cmds.some(c => c.text.includes('pip install -e .')), 'Should extract pip install -e .');
  assert.ok(cmds.some(c => c.text.includes('pip install pytest')), 'Should extract pip install pytest');
  
  // Check line numbers (0-indexed lines in the source)
  const pipInstallCmd = cmds.find(c => c.text.includes('pip install -e .'));
  assert.ok(pipInstallCmd.line >= 10 && pipInstallCmd.line <= 15, 'Line number should be in range');
});

test('plan: parseRST extracts literal block after :: with line numbers', () => {
  const rstText = `Test
====

Run tests::

    $ pytest
    $ pytest --cov`;

  const rst = parseRST(rstText);
  
  const testBlock = rst.blocks.find(b => b.lines.some(l => l.text.includes('pytest')));
  assert.ok(testBlock, 'Should find test block');
  assert.equal(testBlock.lang, 'literal', 'Language should be literal for literal block');
  
  const cmds = rstBlockCommands(testBlock);
  assert.ok(cmds.some(c => c.text === 'pytest'), 'Should extract pytest');
  assert.ok(cmds.some(c => c.text === 'pytest --cov'), 'Should extract pytest --cov');
});

test('plan: parseRST extracts headings with correct levels', () => {
  const rstText = `Install
=======

Create a virtualenv::

    $ python3 -m venv .venv

Dependencies
------------

Install Flask::

    $ pip install Flask

Optional
~~~~~~~~

Optional deps::

    $ pip install watchdog`;

  const rst = parseRST(rstText);
  
  assert.equal(rst.headings.length, 3, 'Should find 3 headings');
  assert.equal(rst.headings[0].text, 'Install', 'First heading should be Install');
  assert.equal(rst.headings[0].level, 1, 'First heading should be level 1 (=)');
  assert.equal(rst.headings[1].text, 'Dependencies', 'Second heading should be Dependencies');
  assert.equal(rst.headings[1].level, 2, 'Second heading should be level 2 (-)');
  assert.equal(rst.headings[2].text, 'Optional', 'Third heading should be Optional');
  assert.equal(rst.headings[2].level, 3, 'Third heading should be level 3 (~)');
});

test('plan: parseRST assigns blocks to correct sections', () => {
  const rstText = `Install
=======

Create a virtualenv::

    $ python3 -m venv .venv

Dependencies
------------

Install Flask::

    $ pip install Flask`;

  const rst = parseRST(rstText);
  
  for (const block of rst.blocks) {
    const sectionPath = rstSectionPath(rst.sections, block.start);
    if (block.lines.some(l => l.text.includes('venv'))) {
      assert.deepEqual(sectionPath, ['Install'], 'venv block should be in Install section');
    }
    if (block.lines.some(l => l.text.includes('pip install Flask'))) {
      // The block is within both Install and Dependencies section ranges
      assert.ok(sectionPath.includes('Dependencies'), 'Flask block should be in Dependencies section');
      assert.ok(sectionPath.includes('Install'), 'Flask block should also be in Install section (parent)');
    }
  }
});

test('plan: flask tutorial README.rst extracts pip install -e . and pytest steps', async () => {
  const fixturePath = path.join(process.cwd(), 'test/fixtures/v2/pallets__flask/examples/tutorial/README.rst');
  if (!fs.existsSync(fixturePath)) {
    console.log('Skipping - fixture not found');
    return;
  }
  
  const facts = await scout(fixturePath.replace('examples/tutorial/README.rst', ''));
  const plan = buildPlan(facts, { repo: 'pallets/flask' });
  
  const installSteps = plan.steps.filter(s => s.kind === 'install' && !s.skip);
  const testSteps = plan.steps.filter(s => s.kind === 'test' && !s.skip);
  
  // Should have pip install -e . step
  assert.ok(installSteps.some(s => s.command.includes('pip install -e .')), 
    `Should have pip install -e . step. Got: ${installSteps.map(s => s.command).join(', ')}`);
  
  // Should have pytest step
  assert.ok(testSteps.some(s => s.command.includes('pytest') && !s.command.includes('coverage')), 
    `Should have pytest step. Got: ${testSteps.map(s => s.command).join(', ')}`);
  
  // Check that source file and line numbers are preserved
  const pytestStep = testSteps.find(s => s.command.includes('pytest') && !s.command.includes('coverage'));
  if (pytestStep) {
    assert.ok(pytestStep.source.file.includes('.rst'), 'Source file should be .rst');
    assert.ok(pytestStep.source.line > 0, 'Line number should be positive');
  }
});