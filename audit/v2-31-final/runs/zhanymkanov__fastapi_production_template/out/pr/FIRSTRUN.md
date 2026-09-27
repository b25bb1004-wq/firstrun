# Setup Passport: zhanymkanov/fastapi_production_template

❌ **FAILED**: HUMBLE followed this project's setup docs on a clean `python:3.12` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `8e82353ff3` |
| Verified | 2026-09-26 23:57 UTC |
| Runtime | Python 3.12 (`python:3.12`) |
| Clone to running, from zero | **n/a** |
| Steps followed | 6 from the docs, 2 added by HUMBLE |
| Breaks found / fixed | 2 / 2 |
| Needs a human | 0 |
| Done when | every step exits cleanly |

**Before HUMBLE**, a newcomer following the docs got stuck at `just run` (README.md:53).

## Verified setup

```bash
apt install just
pip install poetry
just up
poetry install --no-root
cp .env.example .env
just run
just run --log-config logging.ini
just migrate
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing or out-of-order step <a id="e1"></a>

- **Docs said:** `just run` (README.md:53)
- **Cause:** `poetry run uvicorn` can't find uvicorn: the project's dependencies were never installed, because the docs skip `poetry install`.
- **Diagnosed by:** HUMBLE rule `deps-not-installed`, confidence 88%
- **Doc change:** poetry install
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
poetry run uvicorn src.main:app --reload 
Creating virtualenv fastapi-template-xS3fZVNL-py3.12 in /root/.cache/pypoetry/virtualenvs
Command not found: uvicorn
error: Recipe `run` failed on line 5 with exit code 1
```
</details>

<details><summary>Fix applied</summary>

```
$ poetry install → exit 1; poetry-no-root: The dependencies installed, but current Poetry also installs the project itself, and this repo is an app, not a package. Older Poetry skipped that silently.; retrying as `poetry install --no-root`
$ poetry install --no-root → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```
poetry run uvicorn src.main:app --reload 
INFO:     Will watch for changes in these directories: ['/workspace']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [1523] using WatchFiles
INFO:     Started server process [1528]
INFO:     Waiting for application startup.
INFO:     Application startup complete.

[firstrun] still running and listening on port 8000: treating this step as the app server
```
</details>

### E2: Undocumented environment variable <a id="e2"></a>

- **Docs said:** `just run` (README.md:53)
- **Cause:** The app requires DATABASE_URL, DATABASE_ASYNC_URL from .env.example, but the docs never say to create .env from it.
- **Diagnosed by:** HUMBLE rule `missing-env-var`, confidence 90%
- **Doc change:** cp .env.example .env
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
               ^^^^^^^^
  File "/root/.cache/pypoetry/virtualenvs/fastapi-template-xS3fZVNL-py3.12/lib/python3.12/site-packages/pydantic_settings/main.py", line 140, in __init__
    super().__init__(
  File "/root/.cache/pypoetry/virtualenvs/fastapi-template-xS3fZVNL-py3.12/lib/python3.12/site-packages/pydantic/main.py", line 176, in __init__
    self.__pydantic_validator__.validate_python(data, self_instance=self)
pydantic_core._pydantic_core.ValidationError: 2 validation errors for Config
DATABASE_URL
  Field required [type=missing, input_value={}, input_type=dict]
    For further information visit https://errors.pydantic.dev/2.7/v/missing
DATABASE_ASYNC_URL
  Field required [type=missing, input_value={}, input_type=dict]
    For further information visit https://errors.pydantic.dev/2.7/v/missing

[firstrun] step timed out after 720s
```
</details>

<details><summary>Fix applied</summary>

```
$ cp .env.example .env → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```
poetry run uvicorn src.main:app --reload 
INFO:     Will watch for changes in these directories: ['/workspace']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [1523] using WatchFiles
INFO:     Started server process [1528]
INFO:     Waiting for application startup.
INFO:     Application startup complete.

[firstrun] still running and listening on port 8000: treating this step as the app server
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Python version | not stated | 3.11 (pyproject.toml poetry python ("^3.11")) | README.md |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
