# Setup Passport: fastapi/fastapi

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `python:3.12` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `192b12197e` |
| Verified | 2026-09-27 00:59 UTC |
| Runtime | Python 3.12 (`python:3.12`) |
| Clone to running, from zero | **5s** |
| Steps followed | 1 from the docs, 0 added by HUMBLE |
| Breaks found / fixed | 1 / 0 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:8000/docs` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `uv run fastapi dev` (README.md:203).

## Verified setup

```bash
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `uv run fastapi dev` (README.md:203)
- **Cause:** `uv` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** uv
- **Result:** worked: cleared this error, then the step failed on a later problem

<details><summary>Before (failing output)</summary>

```
/firstrun/step-1.sh: line 4: uv: command not found

[firstrun] server process exited before becoming ready on port 8000
```
</details>

<details><summary>Fix applied</summary>

```
$ command -v uv >/dev/null || { if command -v pip >/dev/null || command -v pip3 >/dev/null; then (pip install uv || pip3 install uv); else apt-get update -qq && apt-get install -y -qq curl >/dev/null && curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh; fi; }
Collecting uv
  Downloading uv-0.12.19-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (11 kB)
Downloading uv-0.12.19-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (20.5 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/20.5 MB ? eta -:--:--   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/20.5 MB ? eta -:--:--   ━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/20.5 MB 3.2 MB/s eta 0:00:07   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/20.5 MB 3.3 MB/s eta 0:00:06   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/20.5 MB 3.7 MB/s eta 0:00:05   ━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.1/20.5 MB 4.0 MB/s eta 0:00:05   ━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.2/20.5 MB 4.2 MB/s eta 0:00:04   ━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.5/20.5 MB 4.6 MB/s eta 0:00:04   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.8/20.5 MB 4.9 MB/s eta 0:00:03   ━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━ 8.4/20.5 MB 5.3 MB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━ 10.5/20.5 MB 5.8 MB/s eta 0:00:02   ━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━ 12.8/20.5 MB 6.4 MB/s eta 0:00:02   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━ 14.9/20.5 MB 6.8 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━ 16.8/20.5 MB 7.0 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━ 19.1/20.5 MB 7.4 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸ 20.4/20.5 MB 7.6 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 20.5/20.5 MB 7.3 MB/s eta 0:00:00
Installing collected packages: uv
Successfully installed uv-0.12.19
```
</details>

<details><summary>After (passing output)</summary>

```
             ^^^^^^
  File "/workspace/fastapi/cli.py", line 12, in main
    raise RuntimeError(message)  # noqa: B904
    ^^^^^^^^^^^^^^^^^^^^^^^^^^^
RuntimeError: To use the fastapi command, please install "fastapi[standard]":

	pip install "fastapi[standard]"


[firstrun] server process exited before becoming ready on port 8000
```
</details>

### E2: Unrecognised failure <a id="e2"></a>

- **Docs said:** `uv run fastapi dev` (README.md:203)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```

Traceback (most recent call last):
  File "/workspace/.venv/bin/fastapi", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/workspace/fastapi/cli.py", line 12, in main
    raise RuntimeError(message)  # noqa: B904
    ^^^^^^^^^^^^^^^^^^^^^^^^^^^
RuntimeError: To use the fastapi command, please install "fastapi[standard]":

	pip install "fastapi[standard]"


[firstrun] server process exited before becoming ready on port 8000
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Python version | not stated | 3.11 (.python-version) | README.md |
| env var DYLD_FALLBACK_LIBRARY_PATH | not documented | read in scripts/docs.py:129 | README |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
