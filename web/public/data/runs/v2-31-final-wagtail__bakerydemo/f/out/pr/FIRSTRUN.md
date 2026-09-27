# Setup Passport: wagtail/bakerydemo

🔵 **INCONCLUSIVE**: HUMBLE followed this project's setup docs on a clean `python:3.12` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `c8f8255593` |
| Verified | 2026-09-27 00:47 UTC |
| Runtime | Python 3.12 (`python:3.12`) |
| Clone to running, from zero | **n/a** |
| Steps followed | 8 from the docs, 0 added by HUMBLE |
| Breaks found / fixed | 1 / 1 |
| Needs a human | 1 |
| Done when | every step exits cleanly |

**Before HUMBLE**, a newcomer following the docs got stuck at `pip install -r requirements/development.txt` (readme.md:154).

## Verified setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/development.txt
cp bakerydemo/settings/local.py.example bakerydemo/settings/local.py
cp .env.example .env
./manage.py load_initial_data
./manage.py runserver
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Wrong runtime version <a id="e1"></a>

- **Docs said:** `pip install -r requirements/development.txt` (readme.md:154)
- **Cause:** The README's Python 3.10 is too old: the project needs Python 3.12 (.python-version).
- **Diagnosed by:** HUMBLE rule `python-version`, confidence 90%
- **Doc change:** Python 3.12 (see .python-version)
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
ERROR: Ignored the following versions that require a different python version: 6.0 Requires-Python >=3.12; 6.0.1 Requires-Python >=3.12; 6.0.2 Requires-Python >=3.12; 6.0.3 Requires-Python >=3.12; 6.0.4 Requires-Python >=3.12; 6.0.5 Requires-Python >=3.12; 6.0.6 Requires-Python >=3.12; 6.0.7 Requires-Python >=3.12; 6.0.8 Requires-Python >=3.12; 6.0a1 Requires-Python >=3.12; 6.0b1 Requires-Python >=3.12; 6.0rc1 Requires-Python >=3.12; 6.1 Requires-Python >=3.12; 6.1.1 Requires-Python >=3.12; 6.1a1 Requires-Python >=3.12; 6.1b1 Requires-Python >=3.12; 6.1rc1 Requires-Python >=3.12
ERROR: Could not find a version that satisfies the requirement Django<6.1,>=6.0 (from versions: 1.1.3, 1.1.4, 1.2, 1.2.1, 1.2.2, 1.2.3, 1.2.4, 1.2.5, 1.2.6, 1.2.7, 1.3, 1.3.1, 1.3.2, 1.3.3, 1.3.4, 1.3.5, 1.3.6, 1.3.7, 1.4, 1.4.1, 1.4.2, 1.4.3, 1.4.4, 1.4.5, 1.4.6, 1.4.7, 1.4.8, 1.4.9, 1.4.10, 1.4.11, 1.4.12, 1.4.13, 1.4.14, 1.4.15, 1.4.16, 1.4.17, 1.4.18, 1.4.19, 1.4.20, 1.4.21, 1.4.22, 1.5, 1.5.1, 1.5.2, 1.5.3, 1.5.4, 1.5.5, 1.5.6, 1.5.7, 1.5.8, 1.5.9, 1.5.10, 1.5.11, 1.5.12, 1.6, 1.6.1, 1.6.2, 1.6.3, 1.6.4, 1.6.5, 1.6.6, 1.6.7, 1.6.8, 1.6.9, 1.6.10, 1.6.11, 1.7, 1.7.1, 1.7.2, 1.7.3, 1.7.4, 1.7.5, 1.7.6, 1.7.7, 1.7.8, 1.7.9, 1.7.10, 1.7.11, 1.8a1, 1.8b1, 1.8b2, 1.8rc1, 1.8, 1.8.1, 1.8.2, 1.8.3, 1.8.4, 1.8.5, 1.8.6, 1.8.7, 1.8.8, 1.8.9, 1.8.10, 1.8.11, 1.8.12, 1.8.13, 1.8.14, 1.8.15, 1.8.16, 1.8.17, 1.8.18, 1.8.19, 1.9a1, 1.9b1, 1.9rc1, 1.9rc2, 1.9, 1.9.1, 1.9.2, 1.9.3, 1.9.4, 1.9.5, 1.9.6, 1.9.7, 1.9.8, 1.9.9, 1.9.10, 1.9.11, 1.9.12, 1.9.13, 1.10a1, 1.10b1, 1.10rc1, 1.10, 1.10.1, 1.10.2, 1.10.3, 1.10.4, 1.10.5, 1.10.6, 1.10.7, 1.10.8, 1.11a1, 1.11b1, 1.11rc1, 1.11, 1.11.1, 1.11.2, 1.11.3, 1.11.4, 1.11.5, 1.11.6, 1.11.7, 1.11.8, 1.11.9, 1.11.10, 1.11.11, 1.11.12, 1.11.13, 1.11.14, 1.11.15, 1.11.16, 1.11.17, 1.11.18, 1.11.20, 1.11.21, 1.11.22, 1.11.23, 1.11.24, 1.11.25, 1.11.26, 1.11.27, 1.11.28, 1.11.29, 2.0a1, 2.0b1, 2.0rc1, 2.0, 2.0.1, 2.0.2, 2.0.3, 2.0.4, 2.0.5, 2.0.6, 2.0.7, 2.0.8, 2.0.9, 2.0.10, 2.0.12, 2.0.13, 2.1a1, 2.1b1, 2.1rc1, 2.1, 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.1.5, 2.1.7, 2.1.8, 2.1.9, 2.1.10, 2.1.11, 2.1.12, 2.1.13, 2.1.14, 2.1.15, 2.2a1, 2.2b1, 2.2rc1, 2.2, 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5, 2.2.6, 2.2.7, 2.2.8, 2.2.9, 2.2.10, 2.2.11, 2.2.12, 2.2.13, 2.2.14, 2.2.15, 2.2.16, 2.2.17, 2.2.18, 2.2.19, 2.2.20, 2.2.21, 2.2.22, 2.2.23, 2.2.24, 2.2.25, 2.2.26, 2.2.27, 2.2.28, 3.0a1, 3.0b1, 3.0rc1, 3.0, 3.0.1, 3.0.2, 3.0.3, 3.0.4, 3.0.5, 3.0.6, 3.0.7, 3.0.8, 3.0.9, 3.0.10, 3.0.11, 3.0.12, 3.0.13, 3.0.14, 3.1a1, 3.1b1, 3.1rc1, 3.1, 3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.5, 3.1.6, 3.1.7, 3.1.8, 3.1.9, 3.1.10, 3.1.11, 3.1.12, 3.1.13, 3.1.14, 3.2a1, 3.2b1, 3.2rc1, 3.2, 3.2.1, 3.2.2, 3.2.3, 3.2.4, 3.2.5, 3.2.6, 3.2.7, 3.2.8, 3.2.9, 3.2.10, 3.2.11, 3.2.12, 3.2.13, 3.2.14, 3.2.15, 3.2.16, 3.2.17, 3.2.18, 3.2.19, 3.2.20, 3.2.21, 3.2.22, 3.2.23, 3.2.24, 3.2.25, 4.0a1, 4.0b1, 4.0rc1, 4.0, 4.0.1, 4.0.2, 4.0.3, 4.0.4, 4.0.5, 4.0.6, 4.0.7, 4.0.8, 4.0.9, 4.0.10, 4.1a1, 4.1b1, 4.1rc1, 4.1, 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5, 4.1.6, 4.1.7, 4.1.8, 4.1.9, 4.1.10, 4.1.11, 4.1.12, 4.1.13, 4.2a1, 4.2b1, 4.2rc1, 4.2, 4.2.1, 4.2.2, 4.2.3, 4.2.4, 4.2.5, 4.2.6, 4.2.7, 4.2.8, 4.2.9, 4.2.10, 4.2.11, 4.2.12, 4.2.13, 4.2.14, 4.2.15, 4.2.16, 4.2.17, 4.2.18, 4.2.19, 4.2.20, 4.2.21, 4.2.22, 4.2.23, 4.2.24, 4.2.25, 4.2.26, 4.2.27, 4.2.28, 4.2.29, 4.2.30, 5.0a1, 5.0b1, 5.0rc1, 5.0, 5.0.1, 5.0.2, 5.0.3, 5.0.4, 5.0.5, 5.0.6, 5.0.7, 5.0.8, 5.0.9, 5.0.10, 5.0.11, 5.0.12, 5.0.13, 5.0.14, 5.1a1, 5.1b1, 5.1rc1, 5.1, 5.1.1, 5.1.2, 5.1.3, 5.1.4, 5.1.5, 5.1.6, 5.1.7, 5.1.8, 5.1.9, 5.1.10, 5.1.11, 5.1.12, 5.1.13, 5.1.14, 5.1.15, 5.2a1, 5.2b1, 5.2rc1, 5.2, 5.2.1, 5.2.2, 5.2.3, 5.2.4, 5.2.5, 5.2.6, 5.2.7, 5.2.8, 5.2.9, 5.2.10, 5.2.11, 5.2.12, 5.2.13, 5.2.14, 5.2.15, 5.2.16, 5.2.17)
ERROR: No matching distribution found for Django<6.1,>=6.0
```
</details>

<details><summary>Fix applied</summary>

```
rebased onto python:3.12
```
</details>

<details><summary>After (passing output)</summary>

```
Downloading pillow_heif-1.8.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl (5.7 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/5.7 MB ? eta -:--:--   ━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/5.7 MB 12.1 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━ 5.0/5.7 MB 13.2 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.7/5.7 MB 10.3 MB/s eta 0:00:00
Downloading soupsieve-2.10-py3-none-any.whl (38 kB)
Downloading typing_extensions-4.16.0-py3-none-any.whl (45 kB)
Downloading typing_inspection-0.4.4-py3-none-any.whl (14 kB)
Downloading urllib3-2.8.0-py3-none-any.whl (135 kB)
Downloading django_stubs_ext-6.1.1-py3-none-any.whl (10 kB)
Downloading et_xmlfile-2.0.0-py3-none-any.whl (18 kB)
Installing collected packages: parsy, filetype, djhtml, urllib3, typing-extensions, toml, telepath, swapper, sqlparse, soupsieve, ruff, python-dotenv, Pillow, pathspec, idna, et-xmlfile, draftjs_exporter, defusedxml, click, charset_normalizer, certifi, attrs, asgiref, anyascii, annotated-types, Willow, typing-inspection, requests, pydantic-core, pillow-heif, openpyxl, Django, curlylint, beautifulsoup4, pydantic, laces, djangorestframework, django-treebeard, django-taggit, django-stubs-ext, django-permissionedforms, django-modelcluster, django-filter, django-extensions, django-debug-toolbar, django-csp, dj-database-url, django-tasks, django-ninja, modelsearch, wagtail, wagtail-font-awesome-svg
Successfully installed Django-6.0.8 Pillow-12.3.0 Willow-1.12.0 annotated-types-0.8.0 anyascii-0.3.3 asgiref-3.12.1 attrs-26.1.0 beautifulsoup4-4.15.0 certifi-2026.7.22 charset_normalizer-3.5.1 click-8.5.0 curlylint-0.13.1 defusedxml-0.7.1 dj-database-url-3.1.2 django-csp-3.8 django-debug-toolbar-4.4.6 django-extensions-4.1 django-filter-26.1 django-modelcluster-6.5 django-ninja-1.7.1 django-permissionedforms-0.1 django-stubs-ext-6.1.1 django-taggit-6.1.0 django-tasks-0.12.0 django-treebeard-5.3.1 djangorestframework-3.18.1 djhtml-3.0.10 draftjs_exporter-7.1.0 et-xmlfile-2.0.0 filetype-1.2.0 idna-3.20 laces-0.1.2 modelsearch-1.3.2 openpyxl-3.1.5 parsy-1.1.0 pathspec-0.12.1 pillow-heif-1.8.0 pydantic-2.13.5 pydantic-core-2.46.5 python-dotenv-1.2.3 requests-2.34.2 ruff-0.15.15 soupsieve-2.10 sqlparse-0.6.0 swapper-1.5.0 telepath-0.3.1 toml-0.10.2 typing-extensions-4.16.0 typing-inspection-0.4.4 urllib3-2.8.0 wagtail-8.0 wagtail-font-awesome-svg-1.2.1
```
</details>

### E2: Unrecognised failure <a id="e2"></a>

- **Docs said:** `./manage.py migrate` (readme.md:168)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
env: ‘python\r’: No such file or directory
env: use -[v]S to pass options in shebang lines
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Python version | Python 3.10+ | 3.12 (.python-version) | readme.md:118 |
| env var DATABASE_URL | not documented | read in bakerydemo/settings/base.py:127 | .env.example |
| env var DJANGO_SECRET_KEY | not documented | read in bakerydemo/settings/production.py:12 | .env.example |
| env var PRIMARY_HOST | not documented | read in bakerydemo/settings/production.py:35 | .env.example |
| env var AWS_S3_CUSTOM_DOMAIN | not documented | read in bakerydemo/settings/production.py:156 | .env.example |
| env var AWS_S3_REGION_NAME | not documented | read in bakerydemo/settings/production.py:158 | .env.example |
| env var FRONTEND_CACHE_CLOUDFLARE_ZONEID | not documented | read in bakerydemo/settings/production.py:202 | .env.example |
| env var FRONTEND_CACHE_CLOUDFLARE_EMAIL | not documented | read in bakerydemo/settings/production.py:214 | .env.example |
| env var FRONTEND_CACHE_CLOUDFLARE_TOKEN | not documented | read in bakerydemo/settings/production.py:215 | .env.example |
| env var FRONTEND_CACHE_CLOUDFLARE_BEARER_TOKEN | not documented | read in bakerydemo/settings/production.py:224 | .env.example |
| env var BASIC_AUTH_WHITELISTED_HTTP_HOSTS | not documented | read in bakerydemo/settings/production.py:245 | .env.example |
| Package manager | `pip install -r requirements/development.txt` (pip) | CI installs with `uv pip install -r requirements/development.txt` (uv) | readme.md:154 |

## Notes

- The repo has both Node.js and Python; HUMBLE used the Python image because the first install step is python. The Node.js part was not set up separately.

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
