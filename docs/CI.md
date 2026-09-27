# HUMBLE README CI — GitHub Action

HUMBLE README CI runs the HUMBLE engine on every pull request to prove your setup docs actually work. It follows your README's instructions in a clean container, repairs what breaks with evidence, replays the fixed guide from zero, and fails the PR if the setup still breaks.

## What it does

1. **Verifies** — Runs `firstrun verify` on the PR's code in a clean Docker container (Node 22 runner)
2. **Reports** — Posts a PR comment with a verdict badge, step table, diagnosis, and README diff
3. **Fails** — Exits non-zero when the verdict is in `fail-on` (default: `FAILED`)
4. **Fixes (optional)** — In `fix` mode, opens a PR with the corrected README when the replay passes

## Quick start

Copy `examples/workflows/humble-readme-ci.yml` to `.github/workflows/humble-readme-ci.yml` in your repo:

```yaml
# .github/workflows/humble-readme-ci.yml
name: HUMBLE README CI

on:
  pull_request:
    paths:
      - 'README*'
      - 'docs/**'
      - 'package.json'
      - 'requirements*.txt'
      - 'pyproject.toml'
      - 'Dockerfile*'
      - '.nvmrc'
      - '.tool-versions'
  push:
    branches: [main]
    paths:
      - 'README*'
      - 'docs/**'
      - 'package.json'
      - 'requirements*.txt'
      - 'pyproject.toml'
      - 'Dockerfile*'
      - '.nvmrc'
      - '.tool-versions'

jobs:
  humble-verify:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: b25bb1004-wq/firstrun@main
        with:
          mode: verify
          fail-on: 'FAILED'
          time-limit: '20'

  humble-fix:
    needs: humble-verify
    if: failure() && github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
      - uses: b25bb1004-wq/firstrun@main
        with:
          mode: fix
          fail-on: 'FAILED'
          time-limit: '25'
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `repo-path` | Path to the repository to verify | `.` |
| `mode` | `verify` or `fix` | `verify` |
| `fail-on` | Comma-separated verdicts that fail the job | `FAILED` |
| `bob-key` | IBM Bob API key (optional, secret) | — |
| `time-limit` | Maximum minutes for the run | `20` |

## Outputs

| Output | Description |
|--------|-------------|
| `verdict` | VERIFIED, PARTIAL, FAILED, INCONCLUSIVE, or ERROR |
| `run-dir` | Path to the run directory (uploaded as artifact) |
| `breaks-found` | Number of setup breaks found |
| `breaks-fixed` | Number of breaks fixed with evidence |
| `replay-seconds` | Clone-to-running time of repaired guide from zero |

## PR Comment

On pull requests, the action posts a comment like:

### HUMBLE README CI ![VERIFIED](https://img.shields.io/badge/VERIFIED-brightgreen)

**Verdict:** VERIFIED  |  **Replay:** 192s  |  **Breaks found:** 5  |  **Breaks fixed:** 5

## Steps

| | Step | Command | Status | Kind |
|---|---|---|---|---|
| ✅ | S1 | git clone ... | skipped | other |
| 🔧 | S2 | npm install | repaired (2 tries) | install |
| 🔧 | S3 | cp .env.example .env | repaired (2 tries) | env |
| ✅ | S4 | docker compose up -d postgres redis | passed | services |
| 🔧 | S5 | npm run db:migrate | repaired (2 tries) | migrate |
| ✅ | R1 | echo "SESSION_SECRET=..." >> .env | passed | env |
| 🔧 | S6 | npm run seed | repaired (2 tries) | other |
| ✅ | S7 | npm run build | passed | build |
| 🔧 | S8 | npm run dev | repaired (2 tries) | serve |
| ✅ | S9 | npm test | passed | test |

## Diagnosis

- ✅ **E1 (S2)** runtime-version: package.json requires Node >=20.11.0 but the README says Node 16.
  - Fix: Node.js 20.11.1 (see .nvmrc); engine-strict makes older versions fail at npm install
- ✅ **E2 (S3)** missing-file: .env.sample does not exist; the repository ships .env.example instead.
  - Fix: Use .env.example instead of .env.sample
- ✅ **E3 (S5)** missing-script: package.json has no "migrate" script; the migration script is "db:migrate".
  - Fix: Use npm run db:migrate
- ✅ **E4 (S6)** missing-env: src/config/env.ts requires SESSION_SECRET of at least 32 characters.
  - Fix: Generate SESSION_SECRET with openssl rand -hex 32
- ✅ **E5 (S8)** missing-service: The session store connects to Redis on 127.0.0.1:6379.
  - Fix: Start Redis alongside Postgres

## README diff

```diff
--- a/README.md
+++ b/README.md
@@ -2,19 +2,22 @@

 A small storefront API and admin UI built with Express, Postgres and Vite.

+> Setup verified by FirstRun at `9d6540e` in `node:20.11.1-bookworm`: clone to running in 3m12s.
+
 ## Prerequisites

 - Node.js 16
 - Docker (for Postgres)
+- Node.js 20.11.1 (see `.nvmrc`; `.npmrc` sets `engine-strict`, so older versions fail at `npm install`)
+- Docker (for Postgres and Redis)

 ## Getting started

 ```bash
 git clone https://github.com/acme-labs/acme-shop.git && cd acme-shop
 npm install
-cp .env.sample .env
-docker compose up -d postgres
-npm run migrate
+cp .env.example .env
+docker compose up -d postgres redis
+npm run db:migrate
+echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
 npm run seed
 npm run build
 npm run dev
 ```

*Triggered by @user · abc1234 into main000*

<!-- humble-ci:123:abc1234def5678... -->

## Fix mode

When `mode: fix` and the replay passes (`VERIFIED`), the action:
1. Creates a branch `humble/fix-readme-<timestamp>`
2. Applies the corrected README
3. Opens a PR to `main` with the HUMBLE report as the body

This lets maintainers review and merge the proven fix in one click.

## Screenshots (placeholders)

<!-- TODO: Replace with real screenshots after first run -->
| | |
|---|---|
| ![PR comment](docs/screenshots/pr-comment.png) | PR comment with verdict, steps, diagnosis, diff |
| ![Fix PR](docs/screenshots/fix-pr.png) | Fix PR opened by HUMBLE |
| ![Artifact](docs/screenshots/artifact.png) | Run artifact in Actions UI |

## How it works

The action runs entirely inside the GitHub runner's Docker (no local Docker needed). It:
1. Checks out your repo with full history
2. Runs `firstrun verify` which:
   - Scouts your README, package.json, docker-compose.yml, etc.
   - Plans the setup steps
   - Executes them in a clean container (`node:20.11.1-bookworm` by default)
   - When a step fails, the Doctor diagnoses and repairs it (with Bob if needed)
   - Replays the repaired plan from zero in a fresh container
   - Publishes a corrected README, diff, report, and Setup Passport
3. Extracts the verdict from `passport.json`
4. Builds and posts a PR comment from the run folder
5. Fails the job if the verdict is in `fail-on`
6. In fix mode, opens a PR with the corrected README

## Bob API Key (optional)

For failures that need reasoning beyond built-in rules, add a `BOB_API_KEY` secret to your repo and uncomment the `bob-key` input. The action masks the key in logs.

## Artifacts

The full run directory (`.firstrun-ci/`) is uploaded as an artifact named `humble-run` (7-day retention). It contains:
- `run.json` — full run state
- `events.ndjson` — event stream for the dashboard
- `evidence/E1.json...` — each repair with before/after logs
- `out/README.md` — corrected README
- `out/README.diff` — unified diff
- `out/FIRSTRUN.md` — human report
- `out/passport.json` — machine-readable verdict

## Local verification

Run the same check locally before pushing:

```bash
npx github:b25bb1004-wq/firstrun verify . --max-minutes 20
```

Or install the CLI:

```bash
npm i -g @b25bb1004-wq/firstrun
firstrun verify .
```