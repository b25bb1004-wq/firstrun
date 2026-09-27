# Setup Passport: apryor6/flask_api_example

❌ **FAILED**: HUMBLE followed this project's setup docs on a clean `python:3.7` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `744239535f` |
| Verified | 2026-09-27 12:17 UTC |
| Runtime | Python 3.7 (`python:3.7`) |
| Clone to running, from zero | **n/a** |
| Steps followed | 4 from the docs, 1 added by HUMBLE |
| Breaks found / fixed | 2 / 0 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:3000/` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `pip install -r requirements.txt` (README.md:22).

## Verified setup

```bash
pip install -r requirements.txt
python wsgi.py
pip install pytest
pytest
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Wrong runtime version <a id="e1"></a>

- **Docs said:** `pip install -r requirements.txt` (README.md:22)
- **Cause:** `numpy==1.17.0` is pinned, and PyPI only has builds of it up to Python 3.7; on Python 3.12 it tries to compile from source and fails. The docs don't say which Python to use. Pinning the rest of the install to Python 3.7's own era too, so the build toolchain (setuptools/Cython) matches instead of today's.
- **Diagnosed by:** HUMBLE rule `python-era-runtime`, confidence 85%
- **Doc change:** Python 3.7 (the pinned numpy==1.17.0 has no build for newer Python)
- **Result:** worked: cleared this error, then the step failed on a later problem ([E2](#e2))

<details><summary>Before (failing output)</summary>

```
        File "/tmp/pip-install-q_793lzl/numpy_7185433a973f423e92662582c8f75d8f/numpy/distutils/ccompiler.py", line 111, in <module>
          replace_method(CCompiler, 'find_executables', CCompiler_find_executables)
                         ^^^^^^^^^
      NameError: name 'CCompiler' is not defined. Did you mean: 'ccompiler'?
      [end of output]
  
  note: This error originates from a subprocess, and is likely not a problem with pip.
error: metadata-generation-failed

× Encountered error while generating package metadata.
╰─> See above for output.

note: This is an issue with the package mentioned above, not pip.
hint: See above for details.
```
</details>

<details><summary>Fix applied</summary>

```
rebased onto python:3.7
step command → pip install "cython<3.0" "setuptools<58" wheel && pip install --no-build-isolation -r requirements.txt
```
</details>

<details><summary>After (passing output)</summary>

```
      [end of output]
  
  note: This error originates from a subprocess, and is likely not a problem with pip.
error: metadata-generation-failed

× Encountered error while generating package metadata.
╰─> See above for output.

note: This is an issue with the package mentioned above, not pip.
hint: See above for details.
```
</details>

### E2: Missing or out-of-order step <a id="e2"></a>

- **Docs said:** `pip install -r requirements.txt` (README.md:22)
- **Cause:** Python dependencies were never installed before "pip install "cython<3.0" "setuptools<58" wheel && pip install --no-build-isolation -r requirements.txt"; the docs skip `pip install -r requirements.txt`.
- **Diagnosed by:** HUMBLE rule `deps-not-installed`, confidence 85%
- **Doc change:** pip install -r requirements.txt
- **Result:** fix did not work

<details><summary>Before (failing output)</summary>

```
          return get_provider(package_or_requirement).get_resource_filename(
        File "/usr/local/lib/python3.7/site-packages/pkg_resources/__init__.py", line 346, in get_provider
          __import__(moduleOrReq)
      ModuleNotFoundError: No module named 'numpy'
      [end of output]
  
  note: This error originates from a subprocess, and is likely not a problem with pip.
error: metadata-generation-failed

× Encountered error while generating package metadata.
╰─> See above for output.

note: This is an issue with the package mentioned above, not pip.
hint: See above for details.
```
</details>

<details><summary>Fix applied</summary>

```
$ pip install -r requirements.txt → exit 1
fix not applied: `pip install -r requirements.txt` exited 1
```
</details>

<details><summary>After (passing output)</summary>

```
      [end of output]
  
  note: This error originates from a subprocess, and is likely not a problem with pip.
error: metadata-generation-failed

× Encountered error while generating package metadata.
╰─> See above for output.

note: This is an issue with the package mentioned above, not pip.
hint: See above for details.
```
</details>

### E3: Unrecognised failure <a id="e3"></a>

- **Docs said:** `pip install -r requirements.txt` (README.md:22)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
          return get_provider(package_or_requirement).get_resource_filename(
        File "/usr/local/lib/python3.7/site-packages/pkg_resources/__init__.py", line 346, in get_provider
          __import__(moduleOrReq)
      ModuleNotFoundError: No module named 'numpy'
      [end of output]
  
  note: This error originates from a subprocess, and is likely not a problem with pip.
error: metadata-generation-failed

× Encountered error while generating package metadata.
╰─> See above for output.

note: This is an issue with the package mentioned above, not pip.
hint: See above for details.
```
</details>

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
