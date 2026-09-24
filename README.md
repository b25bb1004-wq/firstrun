# FirstRun: your README, proven

**FirstRun follows a repository's setup docs on a clean machine, exactly as a brand-new
contributor would. It repairs every step that breaks, backs each repair with evidence, replays
the corrected guide from zero, and hands the maintainer a pull request with a README that is
proven to work.**

Built for the IBM Bob 2.0 Hackathon. IBM Bob is FirstRun's reasoning engine (Bob Shell,
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

## What FirstRun does

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

Every change FirstRun proposes carries an **evidence record** made of three parts:

1. the failing command and its output,
2. the diagnosis and fix (with who diagnosed it: a named rule, or IBM Bob plus the Bobcoins it cost),
3. the same step passing after the fix.

Maintainers review proof, not suggestions.

### It stays true

- **Drift guard:** `.github/workflows/firstrun.yml` runs `firstrun guard` on pull requests. It
  flags new docs-vs-code drift statically (in seconds) and replays the committed verified plan.
- **Newcomer guide:** the `🧭 FirstRun Guide` Bob mode walks a person through the verified
  steps on *their* machine, one at a time. It knows the failure signatures FirstRun recorded, so
  "if you see `ECONNREFUSED 127.0.0.1:6379`, start Redis" is already in its head. This is the
  in-IDE, Clicky-style onboarding buddy, grounded in a run that actually passed.

## IBM Bob integration

| Where | How |
|---|---|
| **Reasoning engine** | `src/brain/bob.js` drives **Bob Shell headlessly** (`bob run --format json --mode firstrun-doctor --max-cost …`). Bob reads the repository itself (document understanding over READMEs, manifests, configs and source) and answers with a JSON fix that FirstRun validates (destructive commands are refused) and then **proves** in the sandbox. Bob is only called when the rules don't know the failure; every call is budgeted, logged and shown with its Bobcoin cost. |
| **Custom modes** | `.bob/custom_modes.yaml`: **🚀 FirstRun** (orchestrates runs from Bob IDE), **🩺 FirstRun Doctor** (read-only diagnosis, used headlessly), **🧭 FirstRun Guide** (newcomer walkthrough; FirstRun also ships it into every repo it verifies). |
| **MCP server** | `.bob/mcp.json` → `firstrun mcp`: `firstrun_plan`, `firstrun_verify`, `firstrun_status`, `firstrun_evidence`, `firstrun_guide`, `firstrun_drift`. Bob's agent can verify a repo, poll progress and explain evidence without leaving the IDE. |
| **Parallel agents** | `firstrun audit` runs one agent team per repository, several at once (the swarm view in the dashboard). |
| **Built with Bob** | Task-session exports are in [`bob_sessions/`](bob_sessions/). |

## Quick start

Requirements: Node.js 20+, Docker, git. Optional: [Bob Shell](https://bob.ibm.com/docs/shell) signed in, for Bob diagnoses.

```bash
git clone https://github.com/b25bb1004-wq/firstrun.git
cd firstrun
npm install
node --test test/*.test.js

# 1. Docs vs code in seconds (no Docker)
node bin/firstrun.js plan examples/acme-shop

# 2. Prove it: follow the README on a clean machine, repair, replay, publish
node bin/firstrun.js verify examples/acme-shop

# 3. Watch it live
node bin/firstrun.js ui --root examples

# 4. The swarm: audit many real repositories in parallel
node bin/firstrun.js audit audit/repos.json --concurrency 3

# Use it from IBM Bob
node bin/firstrun.js bob install     # FirstRun modes for Bob Shell
# Bob IDE picks up .bob/custom_modes.yaml and .bob/mcp.json from this repo
```

`firstrun verify <github-url>` works on any public repository. `firstrun pr` opens the pull
request (it never opens one without being asked).

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
      FIRSTRUN.md, .firstrun/passport.svg, .firstrun/plan.json
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
- **Smallest diff wins.** FirstRun edits the lines that were wrong, inserts the lines that were
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
