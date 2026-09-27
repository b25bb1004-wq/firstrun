# Setup Passport: fastapi/full-stack-fastapi-template

🔵 **INCONCLUSIVE**: HUMBLE followed this project's setup docs on a clean `python:3.12` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `cb740b656d` |
| Verified | 2026-09-27 00:40 UTC |
| Runtime | Python 3.12 (`python:3.12`) |
| Clone to running, from zero | **n/a** |
| Steps followed | 9 from the docs, 0 added by HUMBLE |
| Breaks found / fixed | 3 / 3 |
| Needs a human | 2 |
| Done when | `GET http://127.0.0.1:8000/docs` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `uv sync` (development.md:16).

## Verified setup

```bash
docker compose up -d db mailpit
uv sync
cd backend && uv run bash scripts/prestart.sh
bun install
uv run prek install -f
git commit
uv run prek run --all-files
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `uv sync` (development.md:16)
- **Cause:** `uv` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** uv
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
/firstrun/step-1.sh: line 5: uv: command not found
```
</details>

<details><summary>Fix applied</summary>

```
$ command -v uv >/dev/null || { if command -v pip >/dev/null || command -v pip3 >/dev/null; then (pip install uv || pip3 install uv); else apt-get update -qq && apt-get install -y -qq curl >/dev/null && curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh; fi; }
Collecting uv
  Downloading uv-0.12.19-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (11 kB)
Downloading uv-0.12.19-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (20.5 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/20.5 MB ? eta -:--:--   ╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/20.5 MB ? eta -:--:--   ━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.4/20.5 MB 9.2 MB/s eta 0:00:02   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.5/20.5 MB 9.6 MB/s eta 0:00:02   ━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━ 7.1/20.5 MB 10.7 MB/s eta 0:00:02   ━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━ 9.7/20.5 MB 11.3 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━ 12.1/20.5 MB 11.6 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━ 13.9/20.5 MB 11.1 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━ 16.0/20.5 MB 10.9 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━ 18.4/20.5 MB 11.0 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺ 20.2/20.5 MB 10.9 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 20.5/20.5 MB 10.3 MB/s eta 0:00:00
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

### E2: Missing or out-of-order step <a id="e2"></a>

- **Docs said:** `uv run bash scripts/prestart.sh` (development.md:17)
- **Cause:** `uv run bash scripts/prestart.sh` must run inside `backend/` (the file is `backend/scripts/prestart.sh`), but the docs never say to change into that folder.
- **Diagnosed by:** HUMBLE rule `wrong-directory`, confidence 85%
- **Doc change:** cd backend && uv run bash scripts/prestart.sh
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
bash: scripts/prestart.sh: No such file or directory
```
</details>

<details><summary>Fix applied</summary>

```
step command → cd backend && uv run bash scripts/prestart.sh
```
</details>

<details><summary>After (passing output)</summary>

```
INFO  [alembic.runtime.migration] Running upgrade 1a31ce608336 -> fe56fa70289e, Add created_at to User and Item
+ python app/initial_data.py
/workspace/backend/app/core/config.py:75: UserWarning: The value of SECRET_KEY is "changethis", for security, please change it, at least for deployments.
  warnings.warn(message, stacklevel=1)
/workspace/backend/app/core/config.py:75: UserWarning: The value of DATABASE_URL password is "changethis", for security, please change it, at least for deployments.
  warnings.warn(message, stacklevel=1)
/workspace/backend/app/core/config.py:75: UserWarning: The value of FIRST_SUPERUSER_PASSWORD is "changethis", for security, please change it, at least for deployments.
  warnings.warn(message, stacklevel=1)
INFO:__main__:Creating initial data
INFO:__main__:Initial data created
```
</details>

### E3: Missing tool <a id="e3"></a>

- **Docs said:** `bun install` (development.md:29)
- **Cause:** `bun` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** bun
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
/firstrun/step-6.sh: line 5: bun: command not found
```
</details>

<details><summary>Fix applied</summary>

```
$ command -v bun >/dev/null || { if command -v npm >/dev/null; then npm install -g bun; else apt-get update -qq && apt-get install -y -qq unzip curl >/dev/null && curl -fsSL https://bun.sh/install | bash && ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun; fi; }
#=#=#                                                                          ##O#-#                                                                         ##O=#  #                                                                       #=#=-#  #                                                                      -#O#- #   #                                                                    -=#=#   #   #                                                                                                                                             0.1%                                                                           0.3%                                                                           0.7%                                                                           1.3%#                                                                          2.7%###                                                                        4.7%####                                                                       6.7%######                                                                     8.9%########                                                                  11.2%#########                                                                 13.4%###########                                                               15.3%############                                                              17.7%##############                                                            20.7%################                                                          23.2%###################                                                       26.6%#####################                                                     30.1%#######################                                                   33.3%##########################                                                36.6%############################                                              38.9%#############################                                             41.5%###############################                                           43.6%##################################                                        47.6%####################################                                      50.7%######################################                                    54.0%#########################################                                 57.7%###########################################                               61.1%#############################################                             62.9%##############################################                            64.7%################################################                          67.3%##################################################                        69.7%####################################################                      72.6%######################################################                    76.0%########################################################                  78.6%##########################################################                81.9%#############################################################             85.6%#################################################################         90.3%###################################################################       94.1%######################################################################    97.9%######################################################################## 100.0%
bun was installed successfully to ~/.bun/bin/bun 

Added "~/.bun/bin" to $PATH in "~/.bashrc" 

To get started, run: 

  source /root/.bashrc 
  bun --help 
```
</details>

<details><summary>After (passing output)</summary>

```
[0.04ms] ".env"
bun install v1.4.2 (744846f84)

399 packages installed [31.97s]
```
</details>

### E4: Unrecognised failure <a id="e4"></a>

- **Docs said:** `bun run dev` (development.md:30)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
$ bun run --filter frontend dev
frontend dev: [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vite.dev/rolldown
frontend dev: 
frontend dev:   VITE v8.2.0  ready in 1850 ms
frontend dev: 
frontend dev:   ➜  Local:   http://localhost:5173/
frontend dev:   ➜  Network: use --host to expose

[firstrun] server did not become ready on port 8000 within 150s
```
</details>

### E5: Unrecognised failure <a id="e5"></a>

- **Docs said:** `bun run build` (development.md:50)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
error: Script not found "build"
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Python version | not stated | 3.14 (.python-version) | README.md |
| npm script "build" | bun run build | not in package.json scripts | development.md:50 |
| env var PLAYWRIGHT_BASE_URL | not documented | read in frontend/playwright.config.ts:4 | README |

## Notes

- The repo has both Node.js and Python; HUMBLE used the Python image because the first install step is python. The Node.js part was not set up separately.

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
