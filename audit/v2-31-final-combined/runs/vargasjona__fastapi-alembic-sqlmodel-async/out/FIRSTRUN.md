# Setup Passport: vargasjona/fastapi-alembic-sqlmodel-async

❌ **FAILED**: HUMBLE followed this project's setup docs on a clean `python:3.11` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `96f10870e7` |
| Verified | 2026-09-27 07:39 UTC |
| Runtime | Python 3.11 (`python:3.11`) |
| Clone to running, from zero | **n/a** |
| Steps followed | 7 from the docs, 1 added by HUMBLE |
| Breaks found / fixed | 6 / 0 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:15432/` answers |
| IBM Bob | 3 diagnosises, 1.28 Bobcoins |

**Before HUMBLE**, a newcomer following the docs got stuck at `source "$(poetry env info --path)/bin/activate"` (README.md:98).

## Verified setup

```bash
sudo apt-get install build-essential
sudo apt-get -y install make
poetry install
make init-db
make add-dev-migration
make run-test
make pytest
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `source "$(poetry env info --path)/bin/activate"` (README.md:98)
- **Cause:** `poetry` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** poetry
- **Result:** worked: cleared this error, then the step failed on a later problem ([E2](#e2))

<details><summary>Before (failing output)</summary>

```
/firstrun/step-3.sh: line 5: poetry: command not found
/firstrun/step-3.sh: line 5: /bin/activate: No such file or directory
```
</details>

<details><summary>Fix applied</summary>

```
  Downloading more_itertools-11.1.0-py3-none-any.whl (72 kB)
                                              0.0/72.2 kB ? eta -:--:--     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸ 71.7/72.2 kB 4.0 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 72.2/72.2 kB 1.0 MB/s eta 0:00:00
Collecting backports.tarfile
  Downloading backports.tarfile-1.2.0-py3-none-any.whl (30 kB)
Collecting cffi>=2.0.0
  Downloading cffi-2.1.1-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.whl (218 kB)
                                              0.0/218.7 kB ? eta -:--:--     ━━━━━━━                                  41.0/218.7 kB 1.4 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━                    112.6/218.7 kB 1.6 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         174.1/218.7 kB 1.7 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  215.0/218.7 kB 1.7 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  215.0/218.7 kB 1.7 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 218.7/218.7 kB 1.2 MB/s eta 0:00:00
Collecting exceptiongroup>=1.0.2
  Downloading exceptiongroup-1.3.1-py3-none-any.whl (16 kB)
Collecting pycparser
  Downloading pycparser-3.0-py3-none-any.whl (48 kB)
                                              0.0/48.2 kB ? eta -:--:--     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       41.0/48.2 kB 122.5 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 48.2/48.2 kB 635.9 kB/s eta 0:00:00
Installing collected packages: trove-classifiers, distlib, zipp, urllib3, typing_extensions, tomlkit, tomli, shellingham, rapidfuzz, pyproject-hooks, pycparser, poetry-core, platformdirs, pkginfo, pbs-installer, msgpack, more-itertools, jeepney, installer, idna, h11, filelock, fastjsonschema, crashtest, charset_normalizer, certifi, backports.zstd, backports.tarfile, requests, python-discovery, jaraco.functools, jaraco.context, jaraco.classes, importlib_metadata, httpcore, findpython, exceptiongroup, dulwich, cleo, cffi, build, virtualenv, requests-toolbelt, cryptography, cachecontrol, anyio, SecretStorage, httpx, keyring, poetry
Successfully installed SecretStorage-3.5.0 anyio-4.15.1 backports.tarfile-1.2.0 backports.zstd-1.7.0 build-1.6.1 cachecontrol-0.14.4 certifi-2026.7.22 cffi-2.1.1 charset_normalizer-3.5.1 cleo-2.1.0 crashtest-0.4.1 cryptography-50.0.1 distlib-0.4.3 dulwich-1.2.15 exceptiongroup-1.3.1 fastjsonschema-2.22.2 filelock-4.0.4 findpython-0.8.0 h11-0.16.0 httpcore-1.0.9 httpx-0.28.1 idna-3.20 importlib_metadata-9.0.1 installer-1.0.1 jaraco.classes-3.4.0 jaraco.context-6.1.2 jaraco.functools-4.6.0 jeepney-0.9.0 keyring-25.7.0 more-itertools-11.1.0 msgpack-1.2.2 pbs-installer-2026.9.24 pkginfo-1.13 platformdirs-4.12.0 poetry-2.5.1 poetry-core-2.5.0 pycparser-3.0 pyproject-hooks-1.3.3 python-discovery-1.6.1 rapidfuzz-3.14.5 requests-2.34.2 requests-toolbelt-1.0.0 shellingham-1.5.4 tomli-2.4.1 tomlkit-0.15.1 trove-classifiers-2026.9.21.13 typing_extensions-4.16.0 urllib3-2.8.0 virtualenv-21.13.0 zipp-4.1.0
```
</details>

<details><summary>After (passing output)</summary>

```

Poetry could not find a pyproject.toml file in /workspace or its parents
/firstrun/step-5.sh: line 5: /bin/activate: No such file or directory
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

Poetry could not find a pyproject.toml file in /workspace or its parents
/firstrun/step-5.sh: line 5: /bin/activate: No such file or directory
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

Poetry could not find a pyproject.toml file in /workspace or its parents
```
</details>

### E3: Missing or out-of-order step <a id="e3"></a>

- **Docs said:** `source "$(poetry env info --path)/bin/activate"` (README.md:98)
- **Cause:** The `pyproject.toml` lives in `backend/app/` (confirmed by glob), but the sandbox working directory is the repo root; Poetry cannot locate it, so both `poetry install` and `source "$(poetry env info --path)/bin/activate"` fail — the `cd backend/app/` at README.md:96–97 is a required directory change, not merely an IDE tip.
- **Diagnosed by:** IBM Bob (0.097076 Bobcoins), confidence 97%
- **Doc change:** All Poetry commands (`poetry install`, `poetry shell`, `poetry env info`) must be run from `backend/app/` where `pyproject.toml` lives. Update the README to show `cd backend/app/` as a required step before any `poetry` command, not just as a VSCode IDE tip.
- **Result:** fix did not work

<details><summary>Before (failing output)</summary>

```

Poetry could not find a pyproject.toml file in /workspace or its parents
```
</details>

<details><summary>Fix applied</summary>

```
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
(exit 1)
fix not applied: `cd backend/app && poetry install` exited 1
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

### E4: Wrong runtime version <a id="e4"></a>

- **Docs said:** `source "$(poetry env info --path)/bin/activate"` (README.md:98)
- **Cause:** The docs allow Python 3.10, but the lockfile pins cp311-cp311 wheels, which only install on Python 3.11. A newcomer on 3.10 cannot install the dependencies.
- **Diagnosed by:** HUMBLE rule `wheel-python-mismatch`, confidence 88%
- **Doc change:** Python 3.11 (the lockfile's wheels are built for CPython 3.11)
- **Result:** worked: cleared this error, then the step failed on a later problem ([E5](#e5))

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

Poetry could not find a pyproject.toml file in /workspace or its parents
/firstrun/step-4.sh: line 5: /bin/activate: No such file or directory
```
</details>

### E5: Missing or out-of-order step <a id="e5"></a>

- **Docs said:** `source "$(poetry env info --path)/bin/activate"` (README.md:98)
- **Cause:** The `pyproject.toml` lives in `backend/app/` (confirmed by glob), but the sandbox working directory is the repo root when S8 runs; Poetry cannot locate the project, so `poetry env info --path` prints nothing and the activate script path is invalid — the `cd backend/app/` at README.md:96 must be part of the same shell command, not a separate prior step.
- **Diagnosed by:** IBM Bob (0.05517 Bobcoins), confidence 92%
- **Doc change:** Replace the two-line snippet at README.md lines 96-99 with a single combined command: `cd backend/app && source "$(poetry env info --path)/bin/activate"` so that Poetry can locate pyproject.toml and the environment activation works from any starting directory.
- **Result:** worked: cleared this error, then the step failed on a later problem ([E6](#e6))

<details><summary>Before (failing output)</summary>

```

Poetry could not find a pyproject.toml file in /workspace or its parents
/firstrun/step-4.sh: line 5: /bin/activate: No such file or directory
```
</details>

<details><summary>Fix applied</summary>

```
step command → cd backend/app && source "$(poetry env info --path)/bin/activate"
```
</details>

<details><summary>After (passing output)</summary>

```
/firstrun/step-5.sh: line 5: /bin/activate: No such file or directory
```
</details>

### E6: Missing tool <a id="e6"></a>

- **Docs said:** `source "$(poetry env info --path)/bin/activate"` (README.md:98)
- **Cause:** `poetry env info --path` returns an empty string (producing `/bin/activate`) because Poetry never created a virtualenv — on a Python 3.11 root-user Docker image, Poetry defaults to skipping virtualenv creation; the `poetry install` exec step must be preceded by `poetry config virtualenvs.in-project true` to force venv creation, as nothing in `backend/app/pyproject.toml` or the README configures th
- **Diagnosed by:** IBM Bob (0.223354 Bobcoins), confidence 72%
- **Doc change:** Before activating the virtual environment, run `cd backend/app && poetry config virtualenvs.in-project true && poetry install` to ensure Poetry creates the `.venv` directory inside the project folder so that `poetry env info --path` returns a valid path.
- **Result:** fix did not work

<details><summary>Before (failing output)</summary>

```
/firstrun/step-5.sh: line 5: /bin/activate: No such file or directory
```
</details>

<details><summary>Fix applied</summary>

```
$ cd backend/app && poetry config virtualenvs.in-project true && poetry install
/firstrun/step-6.sh: line 5: cd: backend/app: No such file or directory
(exit 1)
fix not applied: `cd backend/app && poetry config virtualenvs.in-project true && poetry install` exited 1
```
</details>

<details><summary>After (passing output)</summary>

```
/firstrun/step-6.sh: line 5: cd: backend/app: No such file or directory
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
