# Setup Passport: NayamAmarshe/please

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `python:3.12` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `10e94b3e7e` |
| Verified | 2026-09-27 00:15 UTC |
| Runtime | Python 3.12 (`python:3.12`) |
| Clone to running, from zero | **1m24s** |
| Steps followed | 7 from the docs, 0 added by HUMBLE |
| Breaks found / fixed | 1 / 1 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:3000/` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `. "$(dirname $(poetry run which python))/activate"` (README.MD:191).

## Verified setup

```bash
pip install please-cli
curl -sSL https://install.python-poetry.org | python3 -
. "$(dirname $(poetry run which python))/activate"
poetry install
source "$(poetry env info --path)/bin/activate"
poetry build
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `. "$(dirname $(poetry run which python))/activate"` (README.MD:191)
- **Cause:** `poetry` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** poetry
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
/firstrun/step-3.sh: line 5: poetry: command not found
dirname: missing operand
Try 'dirname --help' for more information.
/firstrun/step-3.sh: line 5: /activate: No such file or directory
```
</details>

<details><summary>Fix applied</summary>

```
Using cached secretstorage-3.5.0-py3-none-any.whl (15 kB)
Using cached urllib3-2.8.0-py3-none-any.whl (135 kB)
Using cached jaraco.classes-3.4.0-py3-none-any.whl (6.8 kB)
Using cached jaraco_context-6.1.2-py3-none-any.whl (7.9 kB)
Using cached jaraco_functools-4.6.0-py3-none-any.whl (11 kB)
Using cached cryptography-50.0.1-cp311-abi3-manylinux_2_34_x86_64.whl (4.7 MB)
Using cached anyio-4.15.1-py3-none-any.whl (132 kB)
Using cached more_itertools-11.1.0-py3-none-any.whl (72 kB)
Using cached cffi-2.1.1-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.whl (221 kB)
Using cached h11-0.16.0-py3-none-any.whl (37 kB)
Using cached typing_extensions-4.16.0-py3-none-any.whl (45 kB)
Using cached pycparser-3.0-py3-none-any.whl (48 kB)
Installing collected packages: trove-classifiers, distlib, urllib3, typing_extensions, tomlkit, shellingham, rapidfuzz, pyproject-hooks, pycparser, poetry-core, platformdirs, pkginfo, pbs-installer, packaging, msgpack, more-itertools, jeepney, jaraco.context, installer, idna, h11, filelock, fastjsonschema, crashtest, charset_normalizer, certifi, backports.zstd, requests, python-discovery, jaraco.functools, jaraco.classes, httpcore, findpython, dulwich, cleo, cffi, build, anyio, virtualenv, requests-toolbelt, httpx, cryptography, cachecontrol, SecretStorage, keyring, poetry
Successfully installed SecretStorage-3.5.0 anyio-4.15.1 backports.zstd-1.7.0 build-1.6.1 cachecontrol-0.14.4 certifi-2026.7.22 cffi-2.1.1 charset_normalizer-3.5.1 cleo-2.1.0 crashtest-0.4.1 cryptography-50.0.1 distlib-0.4.3 dulwich-1.2.15 fastjsonschema-2.22.2 filelock-4.0.4 findpython-0.8.0 h11-0.16.0 httpcore-1.0.9 httpx-0.28.1 idna-3.20 installer-1.0.1 jaraco.classes-3.4.0 jaraco.context-6.1.2 jaraco.functools-4.6.0 jeepney-0.9.0 keyring-25.7.0 more-itertools-11.1.0 msgpack-1.2.2 packaging-26.3 pbs-installer-2026.9.24 pkginfo-1.13 platformdirs-4.12.0 poetry-2.5.1 poetry-core-2.5.0 pycparser-3.0 pyproject-hooks-1.3.3 python-discovery-1.6.1 rapidfuzz-3.14.6 requests-2.34.2 requests-toolbelt-1.0.0 shellingham-1.5.4 tomlkit-0.15.1 trove-classifiers-2026.9.21.13 typing_extensions-4.16.0 urllib3-2.8.0 virtualenv-21.13.0
```
</details>

<details><summary>After (passing output)</summary>

```
The "poetry.dev-dependencies" section is deprecated and will be removed in a future version. Use "poetry.group.dev.dependencies" instead.
Creating virtualenv please-cli-xS3fZVNL-py3.12 in /root/.cache/pypoetry/virtualenvs
```
</details>

### E2: interactive <a id="e2"></a>

- **Docs said:** `python please/please.py` (README.MD:205)
- **Cause:** `python please/please.py` stops to ask a question ("Hello! What can I call you?") and waits for a person to type an answer. Everything before it is proven; this step needs you at the keyboard, and the docs don't say so.
- **Diagnosed by:** HUMBLE rule `interactive-prompt`, confidence 85%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
Hello! What can I call you?: Aborted!

[firstrun] server process exited before becoming ready on port 3000
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Python version | not stated | 3.8 (pyproject.toml poetry python ("^3.8")) | README.MD |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
