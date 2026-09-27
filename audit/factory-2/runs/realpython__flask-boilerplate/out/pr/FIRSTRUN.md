# Setup Passport: realpython/flask-boilerplate

❌ **FAILED**: HUMBLE followed this project's setup docs on a clean `python:3.12` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `488e33624b` |
| Verified | 2026-09-27 12:34 UTC |
| Runtime | Python 3.12 (`python:3.12`) |
| Clone to running, from zero | **4m26s** |
| Steps followed | 2 from the docs, 1 added by HUMBLE |
| Breaks found / fixed | 1 / 0 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:5000/` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `python app.py` (README.md:110).

## Verified setup

```bash
pip install -r requirements.txt
pip install uv setuptools wheel && uv pip install --system --no-build-isolation --exclude-newer 2018-01-05 -r _updated/config/development/requirements.txt
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing dependency <a id="e1"></a>

- **Docs said:** `python app.py` (README.md:110)
- **Cause:** `wtforms` has released a newer version that no longer has `TextField`; the requirements don't pin it, so a clean install today gets the incompatible release. Installing dependencies as they were on the commit date (2018-01-05) restores the versions the project was written against.
- **Diagnosed by:** HUMBLE rule `python-dependency-drift`, confidence 80%
- **Doc change:** Pin `wtforms` (and other unpinned requirements): a fresh install today pulls a release that removed `TextField`.
- **Result:** fix did not work

<details><summary>Before (failing output)</summary>

```
Traceback (most recent call last):
  File "/workspace/app.py", line 9, in <module>
    from forms import *
  File "/workspace/forms.py", line 2, in <module>
    from wtforms import TextField, PasswordField
ImportError: cannot import name 'TextField' from 'wtforms' (/usr/local/lib/python3.12/site-packages/wtforms/__init__.py). Did you mean: 'TelField'?

[firstrun] server process exited before becoming ready on port 5000
```
</details>

<details><summary>Fix applied</summary>

```
$ pip install uv setuptools wheel && uv pip install --system --no-build-isolation --exclude-newer 2018-01-05 -r _updated/config/development/requirements.txt → exit 1
fix not applied: `pip install uv setuptools wheel && uv pip install --system --no-build-isolation --exclude-newer 2018-01-05 -r _updated/config/development/requirements.txt` exited 1
```
</details>

<details><summary>After (passing output)</summary>

```
             self.run_setup()
           File "/usr/local/lib/python3.12/site-packages/setuptools/build_meta.py", line 520, in run_setup
             super().run_setup(setup_script=setup_script)
           File "/usr/local/lib/python3.12/site-packages/setuptools/build_meta.py", line 317, in run_setup
             exec(code, locals())  # noqa: S102 # exec is intentional here
             ^^^^^^^^^^^^^^^^^^^^
           File "<string>", line 3, in <module>
         ImportError: cannot import name 'Feature' from 'setuptools' (/usr/local/lib/python3.12/site-packages/setuptools/__init__.py)

hint: Build failures usually indicate a problem with the package or the build environment
```
</details>

### E2: Unrecognised failure <a id="e2"></a>

- **Docs said:** `pip install uv setuptools wheel && uv pip install --system --no-build-isolation --exclude-newer 2018-01-05 -r _updated/config/development/requirements.txt` (README.md:110)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
         [stderr]
         Traceback (most recent call last):
           File "<string>", line 14, in <module>
           File "/usr/local/lib/python3.12/site-packages/setuptools/build_meta.py", line 380, in prepare_metadata_for_build_wheel
             self.run_setup()
           File "/usr/local/lib/python3.12/site-packages/setuptools/build_meta.py", line 520, in run_setup
             super().run_setup(setup_script=setup_script)
           File "/usr/local/lib/python3.12/site-packages/setuptools/build_meta.py", line 317, in run_setup
             exec(code, locals())  # noqa: S102 # exec is intentional here
             ^^^^^^^^^^^^^^^^^^^^
           File "<string>", line 3, in <module>
         ImportError: cannot import name 'Feature' from 'setuptools' (/usr/local/lib/python3.12/site-packages/setuptools/__init__.py)

hint: Build failures usually indicate a problem with the package or the build environment
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| env var PYTHONINSPECT | not documented | read in _updated/shell.py:6 | README |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
