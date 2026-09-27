/**
 * Zeller delta debugging (ddmin) for environment bisect.
 * Given a list of differences between host and proven sandbox, and a test
 * function that applies a subset to the proven sandbox and returns pass/fail,
 * finds the minimal failing subset.
 *
 * Pure implementation with injectable runner for testing.
 * Based on Andreas Zeller's ddmin algorithm.
 */

export async function ddmin(differences, testFn, { maxRuns = 20 } = {}) {
  if (differences.length === 0) {
    return { minimal: [], runs: 0 };
  }

  let runs = 0;

  // Helper to run test on a subset
  const testSubset = async (subset) => {
    runs++;
    if (runs > maxRuns) {
      throw new Error(`ddmin exceeded maxRuns (${maxRuns})`);
    }
    return await testFn(subset);
  };

  // Simplified iterative ddmin
  let minimal = differences;

  // First, verify the full set fails
  const fullPasses = await testSubset(minimal);
  if (fullPasses) {
    return { minimal: [], runs };
  }

  // Iteratively try to reduce
  let changed = true;
  while (changed && minimal.length > 1 && runs < maxRuns) {
    changed = false;

    // Try removing each element one at a time
    for (let i = 0; i < minimal.length; i++) {
      const without = minimal.filter((_, idx) => idx !== i);
      if (without.length === 0) continue;

      const passes = await testSubset(without);
      if (!passes) {
        // Still fails without this element, so it's not necessary
        minimal = without;
        changed = true;
        break;
      }
    }

    if (!changed) {
      // No single element could be removed - try pairs
      for (let i = 0; i < minimal.length - 1; i++) {
        for (let j = i + 1; j < minimal.length; j++) {
          const without = minimal.filter((_, idx) => idx !== i && idx !== j);
          if (without.length === 0) continue;

          const passes = await testSubset(without);
          if (!passes) {
            // Still fails without both, neither is necessary
            minimal = without;
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }

    if (!changed) {
      // Can't reduce further - minimal is the smallest failing set
      break;
    }
  }

  return {
    minimal,
    runs
  };
}

/**
 * Convenience wrapper for the HUMBLE debugger:
 * takes host-vs-proof differences and a sandbox runner, returns the minimal
 * failing subset.
 */
export async function envBisect(differences, sandboxRunner) {
  // sandboxRunner: async function(subset) => { pass: boolean }
  // subset is an array of difference objects from the host-vs-proof diff
  // Returns { minimal: difference[], runs: number }
  return ddmin(differences, async (subset) => {
    const result = await sandboxRunner(subset);
    return result.pass;
  });
}