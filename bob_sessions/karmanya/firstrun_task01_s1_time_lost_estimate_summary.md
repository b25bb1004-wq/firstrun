# firstrun · task01 · S1 time-lost estimate (part 1)

- **Tool:** IBM Bob Shell 2.0.5, headless (`bob run`, agent mode, `--max-cost 3`) on Karmanya's PC
- **Task id:** `3f5a6518b23911fa69bdf48130b56748`
- **Cost:** 2.35 Bobcoins · 32 tool calls · 3 min 11 s
- **Driven by:** Edith (Karmanya's Claude Code), per Karmanya's instruction to build with Bob
- **Screenshot:** a Bob IDE consumption-summary PNG is added only if this task appears in Bob IDE's task list

## What Bob built
`src/flags.js` (feature flags), `src/time-lost.js` (tunable minutes-per-break table + estimate), the `--flags` CLI option, the FIRSTRUN.md row/section, and `test/time-lost.test.js` (12 tests).

## What review changed afterwards (Edith)
1. The estimate was added to the passport **after** `publish()` had written FIRSTRUN.md and passport.json, so it never appeared in real output; moved into `publish()`.
2. `deps-not-installed` reports class `wrong-order`, so "missing package" breaks were counted as "other"; the rule id is now checked first. Regression test added.
Verified on a real Docker run (acme-shop demo repo, `--flags timeLost`): FIRSTRUN.md shows `~90 min before → ~0 min after` with the table.

## Prompt given to Bob
Task S1 (part 1 of 2) in this repo (FirstRun, Node.js ESM, no build step). Add an optional TIME-LOST ESTIMATE behind a feature flag. Match the surrounding code style (short, dense, same comment density). Do NOT commit.

HARD CONSTRAINTS
- Feature flag `timeLost`, OFF by default. With the flag off, every output (run.json, passport, FIRSTRUN.md) must be byte-for-byte what it is today.
- Do not change src/doctor/rules.js, the evidence record format (before/diagnosis/fix/after/status), or anything in examples/ or ui/.
- Old runs without `timeLost` must still load and replay unchanged.

1. New file src/flags.js: `export function flagOn(name, opts = {})`. True when `opts.flags` (array or comma string) or env `FIRSTRUN_FLAGS` (comma list) contains `name`. Tiny, no dependencies.

2. New file src/time-lost.js:
   - `export const MINUTES_PER_BREAK`: a lookup table in ONE place, commented as a tunable heuristic, not measured data. Values:
     missing package 10 (evidence diagnosis class 'missing-dependency', 'missing-tool', or rule id 'deps-not-installed'),
     version pin 20 (class 'runtime-version'),
     undocumented env var 25 (class 'missing-env'),
     Bob-needed 40 (diagnosis.by === 'bob'),
     other 15 (any other class; comment that it is our own assumption).
     Bob-needed takes precedence over the class.
   - `export function categoryOf(evidence)` → { key, label, minutes }.
   - `export function estimateTimeLost({ evidence, replay, passport })` returns:
     { estimate: true, table: MINUTES_PER_BREAK (as rows), perBreak: [{ id, category, minutes, fixed }],
       beforeMinutes: sum over ALL breaks,
       afterMinutes: 0 ONLY if replay?.status === 'passed' AND passport.needsHuman === 0; otherwise the sum over breaks whose evidence status is not 'verified',
       real: { breaks: evidence.length, runSeconds, replaySeconds: passport.replaySeconds } }
     where runSeconds comes from an argument `runMs` (see 3).

3. src/pipeline.js: after the passport is built (look for `publish(` and `result.passport`), when `flagOn('timeLost', opts)`, compute `estimateTimeLost(...)` with runMs = Date.now() - startedAt, store it as `rec.state.timeLost` and add `passport.timeLost = { beforeMinutes, afterMinutes, estimate: true }`. Only when the flag is on.

4. src/scribe/report.js (renderReport): when `p.timeLost` exists, add ONE row to the summary table: `| Time lost (estimate) | ~X min before → ~Y min after |` and, after the table, a short section "## Time-lost estimate" that says it is an estimate from a tunable table, shows the table (category → minutes) and the real numbers (breaks, run wall-clock, replay wall-clock). When `p.timeLost` is absent, output is unchanged.

5. bin/firstrun.js: add a `--flags <list>` option to `verify` that passes `flags` through to verifyRepo's opts (keep FIRSTRUN_FLAGS working too).

6. Tests in a NEW file test/time-lost.test.js (node:test + node:assert/strict, like the other tests):
   - 0 breaks → before 0, after 0.
   - multiple breaks of different categories, replay passed, needsHuman 0 → before = sum, after 0; Bob-diagnosed break counts 40 even if its class is 'missing-env'.
   - PARTIAL: replay passed but one break needs-human (status not 'verified') → after = that break's minutes.
   - flagOn: env FIRSTRUN_FLAGS and opts.flags both work; off by default.
   - renderReport snapshot-style check: with p.timeLost present the "Time lost (estimate)" row and section appear; without it, the output does not contain "Time lost".

Run `node --test test/*.test.js` and make sure ALL tests pass (there are 44 on main). Report the files you changed.
