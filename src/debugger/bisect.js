/**
 * README and lockfile history bisect between the last VERIFIED commit and HEAD.
 * Uses the sandbox to find the first bad commit that broke setup.
 * Reuses the drift module where possible.
 * Pure core with an injectable runner.
 */

import { staticDrift, replayVerifiedPlan } from '../drift.js';

/**
 * Find the last VERIFIED commit by checking .github/firstrun/plan.json history.
 * Returns the commit SHA or null if none found.
 */
export async function findLastVerifiedCommit(repoDir) {
  const { run } = await import('../util.js');
  // Look for commits that touched .github/firstrun/plan.json
  const r = await run('git', ['-C', repoDir, 'log', '--oneline', '--', '.github/firstrun/plan.json'], { timeoutMs: 30_000 });
  if (r.code !== 0 || !r.out.trim()) return null;
  const lines = r.out.trim().split('\n');
  return lines[0].split(' ')[0]; // First line is the most recent commit
}

/**
 * Get the list of commits between base and HEAD that touch README or lockfiles.
 * Returns array of { sha, message, files } from oldest to newest.
 */
export async function getRelevantCommits(repoDir, base) {
  const { run } = await import('../util.js');
  const r = await run('git', ['-C', repoDir, 'log', '--oneline', '--reverse', '--', 'README*', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock', 'requirements.txt', 'poetry.lock', 'Pipfile.lock', 'Cargo.lock', 'go.sum', 'composer.lock'], { timeoutMs: 30_000 });
  if (r.code !== 0 || !r.out.trim()) return [];

  const commits = [];
  for (const line of r.out.trim().split('\n')) {
    const [sha, ...msgParts] = line.split(' ');
    const message = msgParts.join(' ');
    // Get files changed in this commit
    const filesR = await run('git', ['-C', repoDir, 'diff', '--name-only', `${sha}^..${sha}`], { timeoutMs: 10_000 });
    const files = filesR.code === 0 ? filesR.out.trim().split('\n').filter(Boolean) : [];
    commits.push({ sha, message, files });
  }
  return commits;
}

/**
 * Core bisect algorithm: binary search through commits.
 * runner: async function(commitSha) => { pass: boolean }
 * Returns { firstBadCommit: { sha, message } | null, runs: number }
 */
export async function bisectCommits(commits, runner, { maxRuns = 10 } = {}) {
  if (commits.length === 0) {
    return { firstBadCommit: null, runs: 0 };
  }

  let runs = 0;
  let left = 0;
  let right = commits.length - 1;
  let firstBad = null;

  // First verify HEAD fails
  const headResult = await runner(commits[right].sha);
  runs++;
  if (headResult.pass) {
    // HEAD passes, no bad commit in range
    return { firstBadCommit: null, runs };
  }

  // Verify base passes (or at least the first commit in range passes)
  const baseResult = await runner(commits[left].sha);
  runs++;
  if (!baseResult.pass) {
    // Even the first commit fails - the bad commit is before our range
    firstBad = commits[left];
  }

  // Binary search
  while (left <= right && runs < maxRuns) {
    const mid = Math.floor((left + right) / 2);
    if (mid === left && mid === right) break;

    const result = await runner(commits[mid].sha);
    runs++;

    if (result.pass) {
      // This commit passes, bad commit is after
      left = mid + 1;
    } else {
      // This commit fails, bad commit is at or before
      firstBad = commits[mid];
      right = mid - 1;
    }
  }

  return { firstBadCommit: firstBad, runs };
}

/**
 * High-level bisect for README/lockfile history.
 * Uses drift.replayVerifiedPlan as the test function when a verified plan exists.
 * Otherwise uses a custom test function.
 */
export async function readmeBisect(repoDir, opts = {}) {
  const { runner, maxRuns = 10 } = opts;

  // Find the last verified commit
  const lastVerified = await findLastVerifiedCommit(repoDir);
  if (!lastVerified) {
    return { firstBadCommit: null, runs: 0, error: 'No verified commit found (.github/firstrun/plan.json not in history)' };
  }

  // Get relevant commits between last verified and HEAD
  const commits = await getRelevantCommits(repoDir, lastVerified);
  if (commits.length === 0) {
    return { firstBadCommit: null, runs: 0, error: 'No README/lockfile changes since last verified commit' };
  }

  // Default runner: replay the verified plan at each commit
  const testRunner = runner || (async (sha) => {
    const { run } = await import('../util.js');
    const tmp = await run('git', ['-C', repoDir, 'worktree', 'add', '--detach', '--quiet', `/tmp/firstrun-bisect-${sha}`, sha]);
    if (tmp.code !== 0) {
      return { pass: false, error: `Cannot checkout ${sha}: ${tmp.out}` };
    }
    try {
      const result = await replayVerifiedPlan(`/tmp/firstrun-bisect-${sha}`);
      return { pass: result.status === 'passed' };
    } finally {
      await run('git', ['-C', repoDir, 'worktree', 'remove', '--force', `/tmp/firstrun-bisect-${sha}`]);
    }
  });

  return bisectCommits(commits, testRunner, { maxRuns });
}

/**
 * Lightweight bisect using only static drift (no Docker).
 * Returns the first commit that introduced drift.
 */
export async function staticBisect(repoDir, opts = {}) {
  const { maxRuns = 10 } = opts;

  const lastVerified = await findLastVerifiedCommit(repoDir);
  if (!lastVerified) {
    return { firstBadCommit: null, runs: 0, error: 'No verified commit found' };
  }

  const commits = await getRelevantCommits(repoDir, lastVerified);
  if (commits.length === 0) {
    return { firstBadCommit: null, runs: 0, error: 'No relevant commits' };
  }

  let left = 0;
  let right = commits.length - 1;
  let firstBad = null;
  let runs = 0;

  while (left <= right && runs < maxRuns) {
    const mid = Math.floor((left + right) / 2);
    const sha = commits[mid].sha;

    const drift = await staticDrift(repoDir, sha);
    runs++;

    if (drift.introduced.length > 0) {
      firstBad = commits[mid];
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return { firstBadCommit: firstBad, runs };
}