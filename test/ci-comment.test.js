import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RUN_DIR = path.join(ROOT, 'fixtures', 'runs', 'acme-shop', '.firstrun');
const COMMENT_SCRIPT = path.join(ROOT, 'src', 'ci', 'comment.js');

describe('ci-comment', () => {
  let commentOutput = null;

  before(() => {
    // Run the comment script with the real acme-shop run folder
    const prNumber = '42';
    const repo = 'acme-labs/acme-shop';
    const actor = 'test-user';
    const headSha = 'abc1234567890abcdef1234567890abcdef12';
    const baseSha = 'main00000000000000000000000000000000';

    const result = spawnSync('node', [
      COMMENT_SCRIPT,
      RUN_DIR,
      prNumber,
      repo,
      actor,
      headSha,
      baseSha
    ], { encoding: 'utf8', cwd: ROOT });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      console.error('stderr:', result.stderr);
      throw new Error(`comment.js exited with code ${result.status}`);
    }

    const parsed = JSON.parse(result.stdout.trim());
    commentOutput = parsed.body;
  });

  it('renders a comment with verdict badge', () => {
    assert.ok(commentOutput.includes('VERIFIED'));
    assert.ok(commentOutput.includes('img.shields.io/badge/VERIFIED-brightgreen'));
  });

  it('contains only facts from the run folder', () => {
    // Should have the verdict from passport.json (markdown bold)
    assert.ok(commentOutput.includes('**Verdict:** VERIFIED'));
    assert.ok(commentOutput.includes('**Replay:** 192s'));
    assert.ok(commentOutput.includes('**Breaks found:** 5'));
    assert.ok(commentOutput.includes('**Breaks fixed:** 5'));
  });

  it('has the hidden marker line with PR number and head SHA', () => {
    assert.ok(commentOutput.includes('<!-- humble-ci:42:abc1234567890abcdef1234567890abcdef12 -->'));
  });

  it('includes steps table with statuses from run.json', () => {
    assert.ok(commentOutput.includes('S2'));
    assert.ok(commentOutput.includes('npm install'));
    assert.ok(commentOutput.includes('repaired'));
    assert.ok(commentOutput.includes('S4'));
    assert.ok(commentOutput.includes('docker compose up -d postgres redis'));
    assert.ok(commentOutput.includes('passed'));
  });

  it('includes diagnosis from evidence files', () => {
    assert.ok(commentOutput.includes('Diagnosis'));
    // The diagnosis contains the cause text, not the class name
    assert.ok(commentOutput.includes('Node >=20.11.0'));
    assert.ok(commentOutput.includes('.env.sample does not exist'));
    assert.ok(commentOutput.includes('no "migrate" script'));
    assert.ok(commentOutput.includes('SESSION_SECRET'));
    assert.ok(commentOutput.includes('Redis on 127.0.0.1:6379'));
  });

  it('includes README diff as suggestion block', () => {
    assert.ok(commentOutput.includes('README diff'));
    assert.ok(commentOutput.includes('```diff'));
    assert.ok(commentOutput.includes('cp .env.example .env'));
    assert.ok(commentOutput.includes('docker compose up -d postgres redis'));
    assert.ok(commentOutput.includes('npm run db:migrate'));
    assert.ok(commentOutput.includes('SESSION_SECRET'));
  });

  it('redacts secrets with fake token built at runtime', () => {
    // The comment should not contain any real credential patterns
    const badPatterns = [
      /sk-ant-[A-Za-z0-9]/,
      /AKIA[0-9A-Z]{8}/,
      /ghp_[A-Za-z0-9]{10}/,
      /nvapi-/,
      /xox[bp]-/,
      /BOB_API_KEY/,
    ];
    for (const pattern of badPatterns) {
      assert.ok(!pattern.test(commentOutput), `Found credential pattern: ${pattern}`);
    }
  });

  it('includes replay seconds from passport', () => {
    assert.ok(commentOutput.includes('**Replay:** 192s'));
  });

  it('includes trigger info with actor and SHAs', () => {
    assert.ok(commentOutput.includes('Triggered by @test-user'));
    assert.ok(commentOutput.includes('abc1234'));
    assert.ok(commentOutput.includes('main000'));
  });
});