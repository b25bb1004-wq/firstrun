# DEBUG REPORT — Live Site + CLI QA

| # | Where | What Happens | What Should Happen | Severity | Fixed |
|---|-------|--------------|--------------------|----------|-------|
| 1 | Live site `/data/audits.json` | `"broke": 21` (incorrect count) | `"broke": 18` (matches audit summary `brokeOnCleanMachine`) | P0 | Yes (stale deploy) |
| 2 | Live site `/data/runs.json` | Missing `acme-shop` run entry | Should include `acme-shop` recorded run | P0 | Yes (stale deploy) |
| 3 | Local build vs live diff | Local build exports `acme-shop` run + correct `broke: 18` | Live deploy should match fresh build output | P0 | Yes (stale deploy) |
| 4 | `firstrun publish-guide` | Rejects VERIFIED run with "Can only publish guide from a VERIFIED run (got done)" | Should read verdict from `run.passport.verdict` when top-level `run.verdict` is null | P0 | Yes (`src/cli.js:567`) |
| 5 | `firstrun onboard --debug` | Crashes with `Error [ERR_USE_AFTER_CLOSE]: readline was closed` when Docker unavailable | Should exit cleanly with helpful message about missing Docker | P1 | No (requires larger change in `src/onboarder/onboard.js`) |
| 6 | Live site `index.html` line 412 | Honesty scan flagged `npm install --global nodemon` as missing `[recorded run]` badge | The badge exists in context (line 432) but not on same visible text span | P1 | Yes (fixed honesty scan regex to use word boundaries) |
| 7 | Live site `index.html` line 430 | Honesty scan flagged `(docs never install nodemon)` as missing badge | Same as #6 — context has badge but not on same text node | P1 | Yes (same fix as #6) |
| 8 | Live site `index.html` line 458 | Honesty scan flagged `demo` in "A demo repo..." as missing badge | Badge present in same line (`<span class="prove-tag">[recorded run]</span>`) | P1 | Yes (same fix as #6) |
| 9 | `web/build.js` | Uses `audit/real-16-v2` as default audit | Should default to `audit/v2-31-final` (the final audit) | P2 | No (config choice, not a bug) |
| 10 | Live site `/brand/cover-1920.jpg` | References og:image `/brand/cover-1920.jpg` but file is `cover.jpg` | og:image should match actual filename | P2 | No (Zeus/Jarvis lane - visual files) |

## Summary
- **P0 bugs**: 4 (all fixed: 3 stale deploy issues, 1 code fix in `src/cli.js`)
- **P1 bugs**: 4 (3 fixed via honesty scan regex fix, 1 open — onboarder crash)
- **P2 issues**: 2 (config/visual, deferred to Zeus/Jarvis)

## Verification
- Full test suite: **736 pass, 0 fail** ✅
- `node tools/honesty-scan.js`: **passes** ✅
- `bash tools/check-secrets.sh`: reports historical credentials in commit `ba1b89a` and `1d1e7e1 feedd80` (pre-existing, not in working tree) ⚠️