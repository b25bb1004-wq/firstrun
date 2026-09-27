# Setup Passport: vargasjona/fastapi-alembic-sqlmodel-async

❌ **FAILED**: HUMBLE followed this project's setup docs on a clean `python:3.11` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `96f10870e7` |
| Verified | 2026-09-27 00:11 UTC |
| Runtime | Python 3.11 (`python:3.11`) |
| Clone to running, from zero | **n/a** |
| Steps followed | 12 from the docs, 1 added by HUMBLE |
| Breaks found / fixed | 3 / 1 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:15432/` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `poetry --version` (README.md:90).

## Verified setup

```bash
sudo apt-get install build-essential
sudo apt-get -y install make
make --version
python --version
poetry --version
cd backend/app/
poetry install
make init-db
make add-dev-migration
make run-test
make pytest
make mypy
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `poetry --version` (README.md:90)
- **Cause:** `poetry` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** poetry
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
/firstrun/step-5.sh: line 5: poetry: command not found
```
</details>

<details><summary>Fix applied</summary>

```
  Downloading more_itertools-11.1.0-py3-none-any.whl (72 kB)
                                              0.0/72.2 kB ? eta -:--:--     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸ 71.7/72.2 kB 25.3 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 72.2/72.2 kB 1.3 MB/s eta 0:00:00
Collecting backports.tarfile
  Downloading backports.tarfile-1.2.0-py3-none-any.whl (30 kB)
Collecting cffi>=2.0.0
  Downloading cffi-2.1.1-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.whl (218 kB)
                                              0.0/218.7 kB ? eta -:--:--     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         174.1/218.7 kB 6.2 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  215.0/218.7 kB 5.9 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 218.7/218.7 kB 2.2 MB/s eta 0:00:00
Collecting exceptiongroup>=1.0.2
  Downloading exceptiongroup-1.3.1-py3-none-any.whl (16 kB)
Collecting pycparser
  Downloading pycparser-3.0-py3-none-any.whl (48 kB)
                                              0.0/48.2 kB ? eta -:--:--     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       41.0/48.2 kB 38.8 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 48.2/48.2 kB 647.1 kB/s eta 0:00:00
Installing collected packages: trove-classifiers, distlib, zipp, urllib3, typing_extensions, tomlkit, tomli, shellingham, rapidfuzz, pyproject-hooks, pycparser, poetry-core, platformdirs, pkginfo, pbs-installer, msgpack, more-itertools, jeepney, installer, idna, h11, filelock, fastjsonschema, crashtest, charset_normalizer, certifi, backports.zstd, backports.tarfile, requests, python-discovery, jaraco.functools, jaraco.context, jaraco.classes, importlib_metadata, httpcore, findpython, exceptiongroup, dulwich, cleo, cffi, build, virtualenv, requests-toolbelt, cryptography, cachecontrol, anyio, SecretStorage, httpx, keyring, poetry
Successfully installed SecretStorage-3.5.0 anyio-4.15.1 backports.tarfile-1.2.0 backports.zstd-1.7.0 build-1.6.1 cachecontrol-0.14.4 certifi-2026.7.22 cffi-2.1.1 charset_normalizer-3.5.1 cleo-2.1.0 crashtest-0.4.1 cryptography-50.0.1 distlib-0.4.3 dulwich-1.2.15 exceptiongroup-1.3.1 fastjsonschema-2.22.2 filelock-4.0.4 findpython-0.8.0 h11-0.16.0 httpcore-1.0.9 httpx-0.28.1 idna-3.20 importlib_metadata-9.0.1 installer-1.0.1 jaraco.classes-3.4.0 jaraco.context-6.1.2 jaraco.functools-4.6.0 jeepney-0.9.0 keyring-25.7.0 more-itertools-11.1.0 msgpack-1.2.2 pbs-installer-2026.9.24 pkginfo-1.13 platformdirs-4.12.0 poetry-2.5.1 poetry-core-2.5.0 pycparser-3.0 pyproject-hooks-1.3.3 python-discovery-1.6.1 rapidfuzz-3.14.5 requests-2.34.2 requests-toolbelt-1.0.0 shellingham-1.5.4 tomli-2.4.1 tomlkit-0.15.1 trove-classifiers-2026.9.21.13 typing_extensions-4.16.0 urllib3-2.8.0 virtualenv-21.13.0 zipp-4.1.0
```
</details>

<details><summary>After (passing output)</summary>

```
Poetry (version 2.5.1)
```
</details>

### E2: Missing or out-of-order step <a id="e2"></a>

- **Docs said:** `source "$(poetry env info --path)/bin/activate"` (README.md:98)
- **Cause:** `source "$(poetry env info --path)/bin/activate"` activates the project's Poetry environment, but none exists yet: the docs never run `poetry install`, so the path is empty.
- **Diagnosed by:** HUMBLE rule `venv-not-created`, confidence 88%
- **Doc change:** poetry install
- **Result:** fix did not work

<details><summary>Before (failing output)</summary>

```
/firstrun/step-9.sh: line 5: /bin/activate: No such file or directory
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
      774│             # something cached that we can use here. The only case in which
      775│             # archive is None is if the original archive is not valid for the
      776│             # current environment.
    → 777│             raise RuntimeError(
      778│                 f"Package {link.url} cannot be installed in the current environment"
      779│                 f" {self._env.marker_env}"
      780│             )
      781│ 

Cannot install torch.
```
</details>

### E3: Wrong runtime version <a id="e3"></a>

- **Docs said:** `poetry install` (README.md:98)
- **Cause:** The docs allow Python 3.10, but the lockfile pins cp311-cp311 wheels, which only install on Python 3.11. A newcomer on 3.10 cannot install the dependencies.
- **Diagnosed by:** HUMBLE rule `wheel-python-mismatch`, confidence 88%
- **Doc change:** Python 3.11 (the lockfile's wheels are built for CPython 3.11)
- **Result:** worked: cleared this error, then the step failed on a later problem

<details><summary>Before (failing output)</summary>

```
  Package https://download.pytorch.org/whl/cpu/torch-2.0.0%2Bcpu-cp311-cp311-linux_x86_64.whl cannot be installed in the current environment {'implementation_name': 'cpython', 'implementation_version': '3.10.21', 'os_name': 'posix', 'platform_machine': 'x86_64', 'platform_release': '6.18.33.2-microsoft-standard-WSL2', 'platform_system': 'Linux', 'platform_version': '#1 SMP PREEMPT_DYNAMIC Thu Jun 18 21:54:43 UTC 2026', 'python_full_version': '3.10.21', 'platform_python_implementation': 'CPython', 'python_version': '3.10', 'sys_platform': 'linux', 'version_info': (3, 10, 21, 'final', 0), 'interpreter_name': 'cp', 'interpreter_version': '310', 'sysconfig_platform': 'linux-x86_64', 'free_threading': False}

  at /usr/local/lib/python3.10/site-packages/poetry/installation/executor.py:777 in _download_link
      773│             # Since we previously downloaded an archive, we now should have
      774│             # something cached that we can use here. The only case in which
      775│             # archive is None is if the original archive is not valid for the
      776│             # current environment.
    → 777│             raise RuntimeError(
      778│                 f"Package {link.url} cannot be installed in the current environment"
      779│                 f" {self._env.marker_env}"
      780│             )
      781│ 

Cannot install torch.
```
</details>

<details><summary>Fix applied</summary>

```
rebased onto python:3.11
```
</details>

<details><summary>After (passing output)</summary>

```
/firstrun/step-8.sh: line 5: /bin/activate: No such file or directory
```
</details>

### E4: Unrecognised failure <a id="e4"></a>

- **Docs said:** `source "$(poetry env info --path)/bin/activate"` (README.md:98)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
/firstrun/step-8.sh: line 5: /bin/activate: No such file or directory
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| postgres service | setup never starts it | dependency "asyncpg" | Python requirements |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
