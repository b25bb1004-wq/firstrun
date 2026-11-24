# Setup Passport: fastapi/full-stack-fastapi-template

❌ **FAILED**: FirstRun followed this project's setup docs on a clean `python:3.12` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `cb740b656d` |
| Verified | 2026-09-25 21:17 UTC |
| Runtime | Python 3.12 (`python:3.12`) |
| Clone to running, from zero | **n/a** |
| Steps followed | 9 from the docs, 0 added by FirstRun |
| Breaks found / fixed | 2 / 1 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:8000/docs` answers |

**Before FirstRun**, a newcomer following the docs got stuck at `uv sync` (development.md:16).

## Verified setup

```bash
docker compose up -d db mailpit
uv sync
bun install
bun run dev
bun run build
uv run prek install -f
git commit
uv run prek run --all-files
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `uv sync` (development.md:16)
- **Cause:** `uv` is not installed; the docs assume it is.
- **Diagnosed by:** FirstRun rule `missing-tool`, confidence 80%
- **Doc change:** uv
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
/firstrun/step-1.sh: line 4: uv: command not found
```
</details>

<details><summary>Fix applied</summary>

```
$ pip install uv
Collecting uv
  Downloading uv-0.12.19-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (11 kB)
Downloading uv-0.12.19-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (20.5 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/20.5 MB ? eta -:--:--   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/20.5 MB ? eta -:--:--   ╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/20.5 MB ? eta -:--:--   ╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/20.5 MB ? eta -:--:--   ━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/20.5 MB 1.3 MB/s eta 0:00:16   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/20.5 MB 1.5 MB/s eta 0:00:13   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/20.5 MB 1.5 MB/s eta 0:00:13   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/20.5 MB 1.5 MB/s eta 0:00:13   ━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/20.5 MB 1.1 MB/s eta 0:00:17   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/20.5 MB 1.3 MB/s eta 0:00:15   ━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.4/20.5 MB 1.3 MB/s eta 0:00:15   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/20.5 MB 1.4 MB/s eta 0:00:13   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.4/20.5 MB 1.6 MB/s eta 0:00:11   ━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.2/20.5 MB 1.8 MB/s eta 0:00:10   ━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.7/20.5 MB 1.9 MB/s eta 0:00:09   ━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.5/20.5 MB 2.0 MB/s eta 0:00:08   ━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.3/20.5 MB 2.2 MB/s eta 0:00:07   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.8/20.5 MB 2.2 MB/s eta 0:00:07   ━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━ 7.3/20.5 MB 2.3 MB/s eta 0:00:06   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 7.9/20.5 MB 2.2 MB/s eta 0:00:06   ━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━ 8.7/20.5 MB 2.3 MB/s eta 0:00:06   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 9.2/20.5 MB 2.3 MB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━ 10.0/20.5 MB 2.4 MB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━ 10.5/20.5 MB 2.4 MB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 11.3/20.5 MB 2.5 MB/s eta 0:00:04   ━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━ 12.6/20.5 MB 2.7 MB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━ 13.6/20.5 MB 2.8 MB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━ 14.7/20.5 MB 2.9 MB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━ 15.2/20.5 MB 2.9 MB/s eta 0:00:02   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━ 16.3/20.5 MB 2.9 MB/s eta 0:00:02   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━ 17.3/20.5 MB 3.0 MB/s eta 0:00:02   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━ 17.6/20.5 MB 3.0 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━ 19.1/20.5 MB 3.1 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸ 20.4/20.5 MB 3.2 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 20.5/20.5 MB 3.2 MB/s eta 0:00:00
Installing collected packages: uv
Successfully installed uv-0.12.19
```
</details>

<details><summary>After (passing output)</summary>

```
 + ty==0.0.74
 + typer==0.27.1
 + typing-extensions==4.15.0
 + typing-inspection==0.4.2
 + urllib3==2.7.0
 + uvicorn==0.49.0
 + uvloop==0.22.1
 + watchfiles==1.2.0
 + websockets==16.0
 + zizmor==1.29.0
```
</details>

### E2: Unrecognised failure <a id="e2"></a>

- **Docs said:** `uv run bash scripts/prestart.sh` (development.md:17)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
bash: scripts/prestart.sh: No such file or directory
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Node.js stack | repo has both Node.js and Python | using Python image (first install step is python) | README.md |
| Python version | not stated | 3.14 (.python-version) | README.md |
| npm script "build" | bun run build | not in package.json scripts | development.md:50 |
| env var PLAYWRIGHT_BASE_URL | not documented | read in frontend/playwright.config.ts:4 | README |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **FirstRun Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by FirstRun. Verified plan: `.github/firstrun/plan.json`.
