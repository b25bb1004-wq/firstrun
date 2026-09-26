import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { auditExitCode } from '../src/audit.js';

describe('auditExitCode', () => {
  it('returns 0 for all VERIFIED', () => {
    const results = [
      { verdict: 'VERIFIED', status: 'done' },
      { verdict: 'VERIFIED', status: 'done' },
    ];
    assert.equal(auditExitCode(results), 0);
  });

  it('returns 0 for VERIFIED and PARTIAL', () => {
    const results = [
      { verdict: 'VERIFIED', status: 'done' },
      { verdict: 'PARTIAL', status: 'done' },
    ];
    assert.equal(auditExitCode(results), 0);
  });

  it('returns 0 for INCONCLUSIVE', () => {
    const results = [
      { verdict: 'INCONCLUSIVE', status: 'done' },
    ];
    assert.equal(auditExitCode(results), 0);
  });

  it('returns 0 for CI-ONLY', () => {
    const results = [
      { verdict: 'CI-ONLY', status: 'done' },
    ];
    assert.equal(auditExitCode(results), 0);
  });

  it('returns 0 for NO-SETUP-DOCS', () => {
    const results = [
      { verdict: 'NO-SETUP-DOCS', status: 'done' },
    ];
    assert.equal(auditExitCode(results), 0);
  });

  it('returns 1 when one repo is FAILED', () => {
    const results = [
      { verdict: 'VERIFIED', status: 'done' },
      { verdict: 'FAILED', status: 'done' },
    ];
    assert.equal(auditExitCode(results), 1);
  });

  it('returns 1 when one repo is ERROR', () => {
    const results = [
      { verdict: 'VERIFIED', status: 'done' },
      { verdict: 'ERROR', status: 'done' },
    ];
    assert.equal(auditExitCode(results), 1);
  });

  it('returns 1 when all repos are FAILED', () => {
    const results = [
      { verdict: 'FAILED', status: 'done' },
      { verdict: 'FAILED', status: 'done' },
    ];
    assert.equal(auditExitCode(results), 1);
  });

  it('returns 0 for empty list', () => {
    const results = [];
    assert.equal(auditExitCode(results), 0);
  });

  it('returns 0 for mixed non-failure verdicts', () => {
    const results = [
      { verdict: 'VERIFIED', status: 'done' },
      { verdict: 'PARTIAL', status: 'done' },
      { verdict: 'INCONCLUSIVE', status: 'done' },
      { verdict: 'CI-ONLY', status: 'done' },
      { verdict: 'NO-SETUP-DOCS', status: 'done' },
    ];
    assert.equal(auditExitCode(results), 0);
  });

  it('returns 1 for FAILED among non-failures', () => {
    const results = [
      { verdict: 'VERIFIED', status: 'done' },
      { verdict: 'PARTIAL', status: 'done' },
      { verdict: 'FAILED', status: 'done' },
      { verdict: 'CI-ONLY', status: 'done' },
    ];
    assert.equal(auditExitCode(results), 1);
  });
});