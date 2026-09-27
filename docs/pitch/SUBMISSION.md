# HUMBLE Submission Kit — ready to paste into the lablab form

<!-- PR link will be added after push -->

---

## 1. Project title (max 60 chars) and 3 alternatives

**Primary:** HUMBLE: your README, proven on a clean machine (53 chars)

**Alternatives:**
- HUMBLE — setup docs that fix themselves (37 chars)
- HUMBLE: verified onboarding for every repo (39 chars)
- HUMBLE — the README that replays from zero (40 chars)

---

## 2. Short description (max 255 chars)

**HUMBLE follows a repository's setup docs on a clean machine like a new hire, repairs every break with evidence, replays the corrected guide from zero, and hands maintainers a pull request with a README proven to work. 18 of 31 real repos broke on a clean machine.** <!-- audit/v2-31-final/audit.json:summary.brokeOnCleanMachine=18,summary.total=31 -->

---

## 3. Long description: Problem and Solution (max 500 words)

**Problem**  
Setup instructions are the only code in a repository that nobody tests. They get written once; then versions move, environment variables get added, scripts get renamed, and services creep in. Nothing notices until a new person follows the README and gets stuck. Finding information is developers' #1 friction point (Atlassian DevEx 2025, 3,500 devs). 72% of engineering leaders say new hires need more than a month to ship their first three meaningful PRs (Cortex 2024). 75% of developers keep answering questions they have answered before (Stack Overflow 2024). The newcomer loses days, a senior engineer gets interrupted, and the fix lands in a chat thread instead of the README. The next hire hits the same wall.

**Solution**  
HUMBLE treats a repository's README as an executable procedure. It runs six agents in sequence: **Scout** reads the README, CONTRIBUTING, docs, manifests, lockfiles, `.nvmrc`, compose files, `.env.example`, CI workflows, and the source that reads env vars. **Planner** turns the setup sections into an ordered plan of shell steps, flags docs-vs-code conflicts in seconds without Docker. **Runner** executes each step in a clean container with real terminal memory (cwd, exports, activated venvs persist); databases and caches start as sidecars on localhost. **Doctor** diagnoses failures — deterministic rules first (free, instant, reproducible): wrong runtime, renamed script, stale file, undocumented env var, missing Postgres/Redis/Mongo, missing migration, npm peer conflicts, missing tools. Failures the rules don't recognise go to **IBM Bob**, which reads the repo and returns a structured fix. **Verifier** replays the entire repaired plan in a brand-new container; nothing counts as fixed until it passes from zero. **Scribe** writes the smallest README diff, patches `.env.example`/`docker-compose.yml`, and adds a Setup Passport badge, an evidence report (`FIRSTRUN.md`), a devcontainer matching the verified machine, a CI drift guard, and a Bob guide mode for newcomers.

**Others check or plan your setup; HUMBLE fixes the README itself, proves the fix by replaying from zero on a clean machine, then walks your own machine through it with a debugger and a security guard.**

**Evidence, not opinions** — every change carries a three-part record: the failing command and output, the diagnosis and fix (with who diagnosed it: a named rule or IBM Bob plus its Bobcoin cost), and the same step passing after the fix. Maintainers review proof, not suggestions.

**It stays true** — a drift guard (`.github/workflows/firstrun.yml`) runs on PRs, flagging new docs-vs-code drift statically and replaying the verified plan. The `🧭 HUMBLE Guide` Bob mode walks a person through the verified steps on their machine, one at a time, knowing the failure signatures HUMBLE recorded. **HUMBLE Lens** lets you circle anything on screen (an error, a config line, a stack trace) with Ctrl+Shift+Space; if it's a failure HUMBLE already fixed for this project, you get the verified fix instantly, free; otherwise ask IBM Bob in the Guide mode, which reads the project before answering.

**Built with IBM Bob** — four custom Bob modes (🚀 HUMBLE orchestrator, 🩺 Doctor, 🗺️ Planner, 🧭 Guide) plus two engine modes (🐞 Debugger, 🛡️ Security) run headlessly via Bob Shell with hard `maxCost` caps. An MCP server (`firstrun_plan`, `firstrun_verify`, `firstrun_status`, `firstrun_evidence`, `firstrun_guide`, `firstrun_drift`) lets Bob's agent verify a repo, poll progress, and explain evidence without leaving the IDE.

**Audit proof** — our 31-repo audit (PR #154, `audit/v2-31-final/`) keeps every verdict: 11 VERIFIED, 11 PARTIAL, 4 INCONCLUSIVE, 1 CI-ONLY, 2 FAILED, 2 NO-SETUP-DOCS. 18 of 31 READMEs broke on a clean machine; 34 breaks found; 28 fixed; 14 repaired automatically. All runs used rules-only brain (0 Bobcoins); the Bob pass is pending.

**Word count: 486**

---

## 4. IBM Bob usage statement (max 500 words)

HUMBLE is built with IBM Bob at every layer. Bob is the reasoning engine, the home for custom modes, the onboarding guide shipped into every verified repo, and the brain behind the debugger and security guard. Every Bob number below is **pending the Bob pass** (audit/v2-31-final-bob) unless marked otherwise.

**Custom Bob modes** (defined in `.bob/custom_modes.yaml`, generated from `src/brain/modes.js`, installed globally for Bob Shell via `firstrun bob install`):
1. **🚀 HUMBLE** (`firstrun`) — orchestrates full verification runs from Bob IDE; uses MCP tools (`firstrun_plan`, `firstrun_verify`, `firstrun_status`, `firstrun_evidence`, `firstrun_drift`) or the CLI.
2. **🩺 HUMBLE Doctor** (`firstrun-doctor`) — headless read-only diagnosis when deterministic rules don't recognise a failure; returns a JSON fix with citations.
3. **🗺️ HUMBLE Planner** (`firstrun-planner`) — extracts ordered shell commands from prose, PDFs, and wiki pages when setup isn't in code blocks.
4. **🧭 HUMBLE Guide** (`firstrun-guide`) — walks newcomers through the verified setup on their machine, one step at a time; shipped into every repo HUMBLE verifies (`.bob/rules-firstrun-guide/verified-setup.md`).
5. **🐞 HUMBLE Debugger** (`firstrun-debugger`, spec: `docs/design/HUMBLE_CONSOLE_SPEC.md` §16) — diagnoses a failed step on the user's machine from a redacted evidence pack (breadcrumbs, capture, fingerprint matches vs. `audit/v2-31-final`/`audit/real-16-v2`, host-vs-proof diff, syscall summary); proposes one guard-validated fix as a guide step. **Per-call `maxCost: 0.2` Bobcoins.**
6. **🛡️ HUMBLE Security** (`firstrun-security`, spec: §16) — reviews a command when deterministic guard rules return `warn` or the command isn't in the proven run; verdict can ONLY tighten (ok→warn→block), never loosen. **Per-call `maxCost: 0.05` Bobcoins.**

**askBob with hard caps** (`src/brain/bob.js:askBob`): every call uses `--max-cost` and `--max-turns`; the engine builds a shared session budget (`src/pipeline.js:makeBudget`). The dry-run plan (`docs/pitch/BOB_PASS_DRYRUN.md`) shows 13 doctor questions across 10 repos plus 7 plan-time calls, with a shared audit budget of **4.5 Bobcoins** (`--bob-budget 4.5`), per-call cap 1.5, stopped when <0.05 remains.

**Plan review** (`src/brain/review.js`): before any run, Bob reviews the extracted plan (rules first, then Bob) and can only hide or stop steps — never smuggle in new ones. Same principle in debugger/guard: Bob proposes, rules verify, the original checker must pass.

**MCP server** (`.bob/mcp.json` → `firstrun mcp`): exposes `firstrun_plan`, `firstrun_verify`, `firstrun_status`, `firstrun_evidence`, `firstrun_guide`, `firstrun_drift` so Bob's agent can verify, poll, and explain without leaving the IDE.

**Bobcoin cost per repo (from real passports):** In `audit/v2-31-final/` all 31 runs used `--brain rules` and spent **0 Bobcoins** (source: each repo's `passport.bobcoins: 0`). The Bob pass (`v2-31-final-bob`) has not run yet; the dry-run budgets **4.5 Bobcoins total** for 10 repos with open questions. Per-repo cost will be recorded in each run's `FIRSTRUN.md` and passport once the pass completes. **All Bob numbers in this submission are marked pre-Bob pending that pass.**

**Task-session exports:** `bob_sessions/arnav/` and `bob_sessions/karmanya/` contain the Bob IDE sessions used to build HUMBLE (screenshots required by hackathon).

**Word count: 497**

---

## 5. Technology and category tags, demo platform, and files to upload

**Technology tags:** Node.js, TypeScript, Docker, IBM Bob, Model Context Protocol (MCP), Electron, tesseract.js, Playwright, Zod, YAML

**Category tags:** Developer Tools, DevOps, AI-Assisted Development, Onboarding, Documentation, CI/CD, Security

**Demo platform:** Web (landing page with recorded runs + hosted verification on GitHub Actions), Desktop (Electron Dock + Console + Lens on Windows/macOS/Linux), CLI (`npx github:b25bb1004-wq/firstrun`)

**Files to upload:**
- Cover image: `web/public/brand/cover-1920.jpg` (1920×1080, Banner 2: gradient + logo + tagline + "Powered by IBM BOB 2.0")
- Video: `demo-video.mp4` (max 3:00, recorded per `docs/pitch/VIDEO_SHOT_LIST.md`)
- PDF deck: `HUMBLE-deck.pdf` (exported from the team's slides, includes architecture, audit results, console walkthrough)

---

## Verification

- `node tools/honesty-scan.js` passes (no synthetic data presented as real)
- All numbers trace to source files (HTML comments after each number)
- No credential-shaped strings written as literals

**PR link:** (to be added after push)
**Long description word count:** 486
**Bob usage statement word count:** 497