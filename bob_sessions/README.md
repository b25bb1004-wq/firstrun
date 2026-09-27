# IBM Bob task sessions (required for judging)

IBM's rule (Bob 2.0 hackathon guide): **every team member** uploads a screenshot of the **task session consumption summary** (PNG) for **every** Bob IDE task related to the project, into this folder, in the public repo. Exporting the task history as `.md` next to it is optional but welcome. Without them the judges can't see that Bob is a core component, and Bob being core is the eligibility condition.

## Index of sessions

| Person | Task | Screenshot (PNG) | Exported MD | What Bob did | Bobcoins |
|--------|------|------------------|-------------|--------------|----------|
| Arnav | SMTP Mailpit rule (env-placeholder-value) | firstrun_task01_smtp_mailpit_rule_summary.png | firstrun_task01_smtp_mailpit_rule_summary.md | Added mail-variable expansion and Mailpit service action to `env-placeholder-value` doctor rule; added `SECURE→false` to `devValue()`; added test | unknown |
| Arnav | Planner known-10 fixes (Issue #60) | firstrun_task02_planner_known10_fixes_summary.png | firstrun_task02_planner_known10_fixes_summary.md | Fixed planner self-install, scaffolder blocks, Vagrant, live scripts, Node CLI probe; wrote test/planner-known10.test.js | unknown |
| Arnav | Planner runtime generators (Issue #60 part 2) | firstrun_task03_planner_runtime_generators_summary.png | firstrun_task03_planner_runtime_generators_summary.md | Fixed SCAFFOLDER_RE for `npm install -g` generators, minimum-version runtime selection (DEFAULT_NODE), Doctor rule for Node too old for `--test`, dual-stack runtime image selection, pip self-install from pyproject.toml/setup.cfg; wrote test/planner-known10b.test.js | unknown |
| Arnav | FirstRun Dock shell (issue #90) | firstrun_task04_dock_shell_summary.png | firstrun_task04_dock_shell_summary.md | Built `src/dock-state.js`, `test/dock-state.test.js`, `lens/dock-bridge.js`, `lens/dock-preload.cjs`, `lens/dock/button.html`, `lens/dock/index.html`, updated `lens/main.js` and `src/cli.js` | unknown |
| Karmanya | Time-lost estimate (feature flag) | firstrun_task01_maitraysuthar_npm_test_diagnosis_summary.png | firstrun_task01_s1_time_lost_estimate_summary.md | Built `src/flags.js`, `src/time-lost.js`, `--flags` CLI option, FIRSTRUN.md row/section, `test/time-lost.test.js` (12 tests) | 2.35 |
| Karmanya | Prisma missing-env-var rule | — | firstrun_task03_prisma_env_not_found_summary.md | Added Prisma `Environment variable not found: DATABASE_URL.` pattern to `ENV_PATTERNS` in `src/doctor/rules.js`; added test | 0.49 |
| Karmanya | ts-skip-lib-check rule (GeekyAnts) | firstrun_task04_ts_skip_lib_check_summary.md | firstrun_task04_ts_skip_lib_check_summary.md | Added `tsconfig-skip-lib-check` patch op in `src/patches.js`; added `ts-skip-lib-check` doctor rule in `src/doctor/rules.js`; added tests | 1.38 |
| Karmanya | Bob Doctor guard (no source edits + JSON retry) | — | firstrun_task05_bob_doctor_guard_summary.md | Added `isSetupFile()` filter in `validateBobFix`; added JSON retry in `diagnose`; added "Fix the setup, not the application" instruction to `firstrun-doctor` mode; added tests | 1.15 |
| Karmanya | unbounded-range-no-lockfile rule | — | firstrun_task06_unbounded_range_rule_summary.md | Added `unbounded-range-no-lockfile` doctor rule; wrote `test/unbounded-range.test.js` | 1.41 |
| Karmanya | Review fixes for unbounded-range | — | firstrun_task07_unbounded_range_review_summary.md | Fixed cause text (floor major vs installed), bounded-range detection, package detection via import tracing (1-hop); updated tests | 0.77 |
| Karmanya | Stop leftover dev servers | — | firstrun_task08_stop_leftover_servers_summary.md | Fixed `serve()` to kill process group on failure; added `stopServers()` to Sandbox; called before repairs in `src/pipeline.js`; wrote `test/stop-servers.test.js` | 1.52 |

## Where Bob is in the code

| Location | Description |
|----------|-------------|
| `.bob/custom_modes.yaml` | 5 custom modes for Bob IDE: `firstrun` (🚀 HUMBLE), `firstrun-doctor` (🩺 HUMBLE Doctor), `firstrun-planner` (🗺️ HUMBLE Planner), `firstrun-guide` (🧭 HUMBLE Guide), `firstrun-debugger` (🐞 HUMBLE Debugger), `firstrun-security` (🛡️ HUMBLE Security) |
| `.bob/mcp.json` | MCP server config pointing to `node bin/firstrun.js mcp` |
| `src/brain/bob.js` | Headless Bob Shell driver: `askBob()`, `bobStatus()`, `modeInstalled()`, `extractJson()` |
| `src/brain/modes.js` | Mode definitions (also generates `.bob/custom_modes.yaml` via `modesYaml()` and `installGlobalModes()`) |
| `src/brain/planner.js` | `needsBobPlanner()`, `bobPlan()` — Bob extracts setup commands from prose/PDFs/wiki |
| `src/brain/review.js` | `bobReviewPlan()` — Bob reviews doubtful plan steps before execution (skips usage examples, alt paths, etc.) |
| `src/doctor/index.js` | `validateBobFix()` filters Bob's fixes (drops application source edits, keeps setup files); `diagnose()` retries Bob on JSON parse failure |
| `src/brain/modes.js` (firstrun-doctor) | Instruction: "Fix the setup, not the application: change only the README/docs, env templates (.env.example), compose files, runtime version files, tsconfig.json or package.json. Never rewrite application source" |
| `bob/skill/HUMBLE.md` | Portable Bob skill file exposing 6 MCP tools: `firstrun_plan`, `firstrun_verify`, `firstrun_status`, `firstrun_evidence`, `firstrun_guide`, `firstrun_drift` |
| `bin/firstrun.js` | CLI commands `bob install` (installs global modes), `bob status`; `--bob-budget` flag on `verify` |
| `src/mcp.js` | MCP tool implementations for the HUMBLE skill |
| `test/bob-skill.test.js` | Tests validating the skill file against actual codebase |

## Missing for lablab rules

**Arnav has no session screenshot PNG for task01** — the file `bob_sessions/arnav/firstrun_task01_smtp_mailpit_rule_summary.png` exists but is 0 bytes (empty). The corresponding MD file has full content. Need to re-export the consumption summary screenshot from Bob IDE for this task.

**Karmanya's task01 (maitraysuthar npm test diagnosis)** has only a PNG screenshot, no exported MD — the file `bob_sessions/karmanya/firstrun_task01_maitraysuthar_npm_test_diagnosis_summary.md` is missing (only PNG exists).

**Arnav has only 4 sessions recorded** — the README lists 4 expected tasks (SMTP Mailpit, known-10 fixes, runtime generators, Dock shell). The 4th task (Dock shell) was done by Hermes as a builder, not Arnav in Bob IDE. Need Arnav to run and export the Guide mode task or another Bob task.

**Bobcoins values**: Most Arnav sessions show "unknown" — the MD files don't record the cost. Need to add Bobcoin consumption from the Bob IDE task summary screenshots.

## Credential scan

Scanned all `.md` files in `bob_sessions/` for credential-shaped strings (`sk-ant-`, `AKIA`, `ghp_`, `nvapi-`, `xoxb-`, `xoxp-`, `API_KEY=`) and IBMid tokens. **No credentials found** in any text file.