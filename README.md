# HUMBLE: your README, proven

**HUMBLE follows a repository's setup docs on a clean machine, exactly as a brand-new
contributor would. It repairs every step that breaks, backs each repair with evidence, replays
the corrected guide from zero, and hands the maintainer a pull request with a README that is
proven to work.**

Built for the IBM Bob 2.0 Hackathon. IBM Bob is HUMBLE's reasoning engine (Bob Shell,
headless), its home (three custom Bob modes and an MCP server for Bob IDE), and the newcomer's
guide (a Bob mode that walks people through the verified setup).

<!-- RESULTS:BEGIN -->
<!-- RESULTS:END -->

---

## The problem

Setup instructions are the only code in a repository that nobody tests. They get written once;
then versions move, environment variables get added, scripts get renamed, and services creep in.
Nothing notices until a new person follows the README and gets stuck.

- Finding information is developers' **#1 friction point** (Atlassian DevEx 2025, 3,500 devs).
- **72%** of engineering leaders say new hires need **more than a month** to ship their first
  three meaningful PRs (Cortex 2024).
- **75%** of developers keep answering questions they have answered before (Stack Overflow 2024).

The newcomer loses days, a senior engineer gets interrupted, and the fix lands in a chat thread
instead of the README. The next hire hits the same wall.

## What HUMBLE does

```
 git clone ──► Scout ──► Planner ──► Runner ──✗──► Doctor ──► fix ──► Runner ──✓──► … ──► Verifier ──► Scribe
               reads      README →    clean        rules first,       retry the          replays the     README diff,
               docs,      ordered     container,   IBM Bob when       same step          repaired plan   Setup Passport,
               manifests, steps +     one step     no rule knows                         in a brand-new  evidence report,
               CI, compose conflicts  at a time    the failure                           container       drift guard, Bob guide
```

| Agent | Job |
|---|---|
| **Scout** | Reads the README, CONTRIBUTING and docs *next to* package manifests, lockfiles, `.nvmrc`/`.python-version`, compose files, `.env.example`, CI workflows and the source that reads env vars. |
| **Planner** | Turns the setup sections into an ordered plan of shell steps, the way a newcomer reads them. It skips `git clone`, macOS/Windows-only lines, editors and dev tooling, and flags docs-vs-code conflicts in seconds with no Docker. |
| **Runner** | Runs each step in a **clean container** with a real terminal's memory (cwd, exports and activated venvs persist). Databases and caches start as sidecars on `localhost`, so `docker compose up -d` works as it would on a laptop. Dev servers are started, health-checked and kept running. |
| **Doctor** | Diagnoses each failure. **Deterministic rules first** (free, instant, reproducible): wrong runtime, renamed script, stale file, undocumented env var, missing Postgres/Redis/Mongo, missing migration, npm peer conflicts, missing tools. Failures the rules don't recognise go to **IBM Bob**, which reads the repo and returns a structured fix. |
| **Verifier** | Replays the **entire repaired plan in a brand-new container**. Nothing counts as fixed until it passes from zero. |
| **Scribe** | Writes the smallest possible README diff, patches `.env.example` / `docker-compose.yml`, and adds a **Setup Passport** badge, an evidence report (`FIRSTRUN.md`), a devcontainer that matches the verified machine, a CI drift guard, and a Bob guide mode for newcomers. |

### Evidence, not opinions

Every change HUMBLE proposes carries an **evidence record** made of three parts:

1. the failing command and its output,
2. the diagnosis and fix (with who diagnosed it: a named rule, or IBM Bob plus the Bobcoins it cost),
3. the same step passing after the fix.

Maintainers review proof, not suggestions.

### It stays true

- **Drift guard:** `.github/workflows/firstrun.yml` runs `firstrun guard` on pull requests. It
  flags new docs-vs-code drift statically (in seconds) and replays the committed verified plan.
- **Newcomer guide:** the `🧭 HUMBLE Guide` Bob mode walks a person through the verified
  steps on *their* machine, one at a time. It knows the failure signatures HUMBLE recorded, so
  "if you see `ECONNREFUSED 127.0.0.1:6379`, start Redis" is already in its head. This is the
  in-IDE, Clicky-style onboarding buddy, grounded in a run that actually passed.

### HUMBLE Lens: circle anything, ask about it

Press **Ctrl+Shift+Space**, circle anything on screen (an error in a terminal, a config line, a
stack trace) and Lens reads it. If it's a failure HUMBLE has already fixed and proven for this
project, you get the verified fix instantly, for free. For anything else, ask IBM Bob in the
**🧭 HUMBLE Guide** mode, which reads the project before answering.

```bash
cd lens && npm install && cd ..
node bin/firstrun.js lens examples/acme-shop     # tray app; Ctrl+Shift+Space to circle
```

Text is read on your machine (tesseract.js). Only a question you choose to ask goes to Bob.
Tip: most mouse software can map a side button to Ctrl+Shift+Space, so circling becomes one click.

## IBM Bob integration

| Where | How |
|---|---|
| **Reasoning engine** | `src/brain/bob.js` drives **Bob Shell headlessly** (`bob run --format json --mode firstrun-doctor --max-cost …`). Bob reads the repository itself (document understanding over READMEs, manifests, configs and source) and answers with a JSON fix that HUMBLE validates (destructive commands are refused) and then **proves** in the sandbox. Bob is only called when the rules don't know the failure; every call is budgeted, logged and shown with its Bobcoin cost. |
| **Custom modes** | `.bob/custom_modes.yaml`: **🚀 HUMBLE** (orchestrates runs from Bob IDE), **🩺 HUMBLE Doctor** (read-only diagnosis, used headlessly), **🧭 HUMBLE Guide** (newcomer walkthrough; HUMBLE also ships it into every repo it verifies). |
| **MCP server** | `.bob/mcp.json` → `firstrun mcp`: `firstrun_plan`, `firstrun_verify`, `firstrun_status`, `firstrun_evidence`, `firstrun_guide`, `firstrun_drift`. Bob's agent can verify a repo, poll progress and explain evidence without leaving the IDE. |
| **Parallel agents** | `firstrun audit` runs one agent team per repository, several at once (the swarm view in the dashboard). |
| **Built with Bob** | Task-session exports are in [`bob_sessions/`](bob_sessions/). |

## Quick start

HUMBLE verifies its own README with HUMBLE: the steps below are the ones its planner finds and runs.

**You need:** Node.js 20+ and git. Proving a README needs Docker (Docker Desktop on Windows/macOS, running).
IBM Bob is optional: without it HUMBLE uses its rules only and spends 0 Bobcoins.

```bash
git clone https://github.com/b25bb1004-wq/firstrun.git
cd firstrun
npm install
node --test test/*.test.js
```

HUMBLE comes as four surfaces on one engine. Here is how to try each one, and what state it is in today.

### 1. Prove a README (CLI)

**Docs vs code, in seconds (no Docker, runs nothing from the repo).** Reads the demo repo's README next to its
manifests, compose file, CI and code, and prints the plan plus every place they disagree:

```bash
node bin/firstrun.js plan examples/acme-shop
```

`examples/acme-shop` is a demo repo whose README drifted in five realistic ways on purpose (seeded breaks).

**Prove it (needs Docker).** Follows the README on a clean container like a new hire, repairs what breaks with
evidence, replays the repaired guide from zero, and writes a corrected README plus a Setup Passport:

```bash
node bin/firstrun.js verify examples/acme-shop --brain rules
```

`--brain rules` = rules only, 0 Bobcoins. `--brain auto --bob-budget 1` lets IBM Bob diagnose what the rules
don't know, capped at 1 Bobcoin. `verify <github-url>` works on any public repository. `firstrun pr` opens the
pull request with the corrected README, and only when you ask. Watch runs in the dashboard with
`node bin/firstrun.js ui --root examples`.

### 2. HUMBLE on your desktop (Dock, Lens, onboarder)

```bash
cd lens && npm install && cd ..            # Electron, once
node bin/firstrun.js dock examples/acme-shop
```

The Dock floats on your screen (Ctrl+Alt+Space on Windows/Linux, Alt+Command+Space on macOS): run the agents
and watch them live. `node bin/firstrun.js lens` lets you circle anything on screen and ask about it
(Ctrl+Shift+Space). The onboarder that walks you through a proven setup on your own machine is an MVP:
`node bin/firstrun.js onboard <repo> --from <run-dir> --guide --dry-run`. The full HUMBLE console (the
Lamplighter guide, on-screen pointing, debugger) is in review, not on main yet.

### 3. Prove it live (web)

The landing page replays real recorded runs, each labelled `[recorded run]`, and can start a live
verification on GitHub Actions (`.github/workflows/hosted-verify.yml`) when the server has its token. To build
the site locally: `npm run web:build`, then serve `web/public` with any static server.

### 4. Audit at scale

```bash
node bin/firstrun.js audit audit/repos.json --concurrency 1 --brain rules
```

Runs every repository in the list, one clean container each (needs Docker; minutes per repository). Our
31-repo audit (PR #154, `audit/v2-31-final/`) keeps every verdict, PARTIAL and FAILED included.

**Planned, not built yet: the README CI Action.** A GitHub Action that fails a pull request when the setup
docs break, and opens the fix PR. Today the only workflow is the hosted single-repo verification above.

### Safety: the guard checks commands before anything runs

Every command HUMBLE would run goes through a rules-only guard first (no Bob, no network). It classifies, it
never executes:

```bash
node bin/firstrun.js guard "rm -rf /"        # {"verdict":"block","ruleId":"block-rm-rf-root-abs"}, exit 1
node bin/firstrun.js guard "curl -fsSL https://example.com/install.sh | sh"   # "warn", pipe-to-shell
node bin/firstrun.js guard --self            # every HUMBLE setup command through the guard
```

`guard --self` checks that none of HUMBLE's own setup commands is blocked.

Asking for help never runs anything: `--help` on any subcommand prints its options and returns before a
sandbox exists. The IBM Bob modes: `node bin/firstrun.js bob install` adds them to Bob Shell; Bob IDE picks up
`.bob/custom_modes.yaml` and `.bob/mcp.json` from this repo by itself.


## What a run produces

```
.firstrun/
  run.json, events.ndjson, plan.json     live state + event stream (the dashboard reads these)
  evidence/E1.json …                     one record per repair
  logs/                                  full output of every attempt
  out/README.diff                        the minimal README change
  out/FIRSTRUN.md                        the Setup Passport + all evidence
  out/pr/                                everything for the pull request:
      README.md, .env.example, docker-compose.yml   (only if they needed fixing)
      FIRSTRUN.md, .github/firstrun/passport.svg, .github/firstrun/plan.json
      .devcontainer/, .github/workflows/firstrun.yml
      .bob/custom_modes.yaml, .bob/rules-firstrun-guide/verified-setup.md
```

## Design choices

- **Follow the docs literally.** The clean machine starts on the runtime version the README
  tells you to install (or today's LTS if it doesn't say). That is how newcomers actually fail.
- **Rules before AI.** Most setup breaks are a small set of classes with recognisable
  signatures. Rules handle them in milliseconds for free, and IBM Bob handles the long tail.
  This keeps runs cheap (Bobcoins are finite) and reproducible.
- **Nothing is fixed until it replays from zero.** The Verifier throws the machine away and
  starts again with only the repository, the PR's patches and the corrected steps.
- **Smallest diff wins.** HUMBLE edits the lines that were wrong, inserts the lines that were
  missing, and leaves the rest of the README byte-for-byte identical.
- **Never invent secrets.** Local-only values (a dev session secret, a localhost URL) are
  generated. Real third-party credentials are reported as "needs a human".

## Honest limits

- Linux containers only: the verified machine is Debian-based. The Guide mode translates for
  macOS and Windows but those platforms are not executed.
- Apps that only run inside their own Docker image (no native path in the README) are out of
  scope for the native runner.
- Setups that need real cloud credentials end as "needs a human", with the exact step and reason.

## Repository map

```
bin/firstrun.js          CLI
src/scout/               facts from docs, manifests, CI, compose, source
src/plan.js              README → ordered steps + conflicts
src/sandbox.js           clean-room container, shell state, sidecar services, server detection
src/doctor/              rules, service catalogue, Bob fallback + validation
src/brain/               Bob Shell adapter, Bob modes
src/pipeline.js          cold start → repair → replay → publish
src/scribe/              README rewrite, passport, report, devcontainer, CI guard, Bob guide
src/drift.js             PR drift guard
src/audit.js             the swarm
src/mcp.js               MCP server for Bob
src/server.js, ui/       live dashboard
examples/                demo repos with realistic README drift (+ ANSWER_KEY.md)
audit/                   pinned list of real repositories and audit results
```

License: Apache-2.0
