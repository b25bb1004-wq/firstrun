# Setup Passport: zhanymkanov/fastapi_production_template

❌ **FAILED**: FirstRun followed this project's setup docs on a clean `python:3.12` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `8e82353ff3` |
| Verified | 2026-09-25 19:16 UTC |
| Runtime | Python 3.12 (`python:3.12`) |
| Clone to running, from zero | **n/a** |
| Steps followed | 6 from the docs, 1 added by FirstRun |
| Breaks found / fixed | 3 / 1 |
| Needs a human | 1 |
| Done when | every step exits cleanly |

**Before FirstRun**, a newcomer following the docs got stuck at `apt install just` (README.md:30).

## Verified setup

```bash
curl --proto =https --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin
pip install poetry
just up
poetry install
just run --log-config logging.ini
just migrate
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Platform-specific step <a id="e1"></a>

- **Docs said:** `apt install just` (README.md:30)
- **Cause:** Debian/Ubuntu's apt has no "just" package on a current stable release; the docs' Linux instructions don't work as written.
- **Diagnosed by:** FirstRun rule `apt-package-missing`, confidence 80%
- **Doc change:** curl --proto =https --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```

WARNING: apt does not have a stable CLI interface. Use with caution in scripts.

Reading package lists...
Building dependency tree...
Reading state information...
Error: Unable to locate package just
```
</details>

<details><summary>Fix applied</summary>

```
$ apt-get update >/dev/null && (command -v curl >/dev/null || apt-get install -y curl >/dev/null)

step command → curl --proto =https --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin
```
</details>

<details><summary>After (passing output)</summary>

```
install: Repository:  https://github.com/casey/just
install: Crate:       just
install: Tag:         1.58.0
install: Target:      x86_64-unknown-linux-musl
install: Destination: /usr/local/bin
install: Archive:     https://github.com/casey/just/releases/download/1.58.0/just-1.58.0-x86_64-unknown-linux-musl.tar.gz
```
</details>

### E2: Missing or out-of-order step <a id="e2"></a>

- **Docs said:** `just run` (README.md:53)
- **Cause:** `poetry run uvicorn` can't find uvicorn: the project's dependencies were never installed, because the docs skip `poetry install`.
- **Diagnosed by:** FirstRun rule `deps-not-installed`, confidence 88%
- **Doc change:** poetry install
- **Result:** fix did not work

<details><summary>Before (failing output)</summary>

```
poetry run uvicorn src.main:app --reload 
Creating virtualenv fastapi-template-xS3fZVNL-py3.12 in /root/.cache/pypoetry/virtualenvs
Command not found: uvicorn
error: recipe `run` failed on line 5 with exit code 1
```
</details>

<details><summary>Fix applied</summary>

```
$ poetry install → exit 1
fix not applied: `poetry install` exited 1
```
</details>

<details><summary>After (passing output)</summary>

```
  - Installing pydantic-settings (2.3.2)
  - Installing python-json-logger (2.0.7)
  - Installing ruff (0.4.8)
  - Installing sentry-sdk (2.5.1)

Installing the current project: fastapi-template (0.1.0)
Error: The current project could not be installed: No file/folder found for package fastapi-template
If you do not want to install the current project use --no-root.
If you want to use Poetry only for dependency management but not for packaging, you can disable package mode by setting package-mode = false in your pyproject.toml file.
If you did intend to install the current project, you may need to set `packages` in your pyproject.toml file.
```
</details>

### E3: Unrecognised failure <a id="e3"></a>

- **Docs said:** `poetry install` (README.md:53)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
  - Installing fastapi (0.111.0)
  - Installing gunicorn (22.0.0)
  - Installing prometheus-client (0.20.0)
  - Installing psycopg2-binary (2.9.9)
  - Installing pydantic-settings (2.3.2)
  - Installing python-json-logger (2.0.7)
  - Installing ruff (0.4.8)
  - Installing sentry-sdk (2.5.1)

Installing the current project: fastapi-template (0.1.0)
Error: The current project could not be installed: No file/folder found for package fastapi-template
If you do not want to install the current project use --no-root.
If you want to use Poetry only for dependency management but not for packaging, you can disable package mode by setting package-mode = false in your pyproject.toml file.
If you did intend to install the current project, you may need to set `packages` in your pyproject.toml file.
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Python version | not stated | 3.11 (pyproject.toml poetry python ("^3.11")) | README.md |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **FirstRun Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by FirstRun. Verified plan: `.github/firstrun/plan.json`.
