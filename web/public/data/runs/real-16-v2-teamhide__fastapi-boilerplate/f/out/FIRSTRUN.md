# Setup Passport: teamhide/fastapi-boilerplate

🟡 **PARTIAL**: FirstRun followed this project's setup docs on a clean `python:3.11.7` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `df4e6d4f81` |
| Verified | 2026-09-25 19:11 UTC |
| Runtime | Python 3.11.7 (`python:3.11.7`) |
| Clone to running, from zero | **4m21s** |
| Steps followed | 5 from the docs, 1 added by FirstRun |
| Breaks found / fixed | 5 / 4 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:8000/` answers |

**Before FirstRun**, a newcomer following the docs got stuck at `poetry install` (README.md:22).

## Verified setup

```bash
poetry install --no-root
source "$(poetry env info --path)/bin/activate"
docker run -d --name mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=fastapi -e MYSQL_USER=fastapi -e MYSQL_PASSWORD=fastapi mysql:8
alembic upgrade head
python3 main.py --env local --debug
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `poetry install` (README.md:22)
- **Cause:** `poetry` is not installed; the docs assume it is.
- **Diagnosed by:** FirstRun rule `missing-tool`, confidence 80%
- **Doc change:** poetry
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
/firstrun/step-1.sh: line 4: poetry: command not found
```
</details>

<details><summary>Fix applied</summary>

```
Downloading urllib3-2.8.0-py3-none-any.whl (135 kB)
Downloading jaraco.classes-3.4.0-py3-none-any.whl (6.8 kB)
Downloading jaraco_context-6.1.2-py3-none-any.whl (7.9 kB)
Downloading jaraco_functools-4.6.0-py3-none-any.whl (11 kB)
Downloading cryptography-50.0.1-cp311-abi3-manylinux_2_34_x86_64.whl (4.7 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/4.7 MB ? eta -:--:--   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/4.7 MB ? eta -:--:--   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/4.7 MB ? eta -:--:--   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/4.7 MB ? eta -:--:--   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/4.7 MB ? eta -:--:--   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/4.7 MB ? eta -:--:--   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/4.7 MB ? eta -:--:--   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/4.7 MB 452.4 kB/s eta 0:00:10   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/4.7 MB 452.4 kB/s eta 0:00:10   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/4.7 MB 452.4 kB/s eta 0:00:10   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/4.7 MB 452.4 kB/s eta 0:00:10   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/4.7 MB 452.4 kB/s eta 0:00:10   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/4.7 MB 452.4 kB/s eta 0:00:10   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/4.7 MB 293.9 kB/s eta 0:00:14   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/4.7 MB 141.5 kB/s eta 0:00:27   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/4.7 MB 126.1 kB/s eta 0:00:28   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/4.7 MB 126.1 kB/s eta 0:00:28   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/4.7 MB 126.1 kB/s eta 0:00:28   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/4.7 MB 126.1 kB/s eta 0:00:28   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/4.7 MB 126.1 kB/s eta 0:00:28   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/4.7 MB 126.1 kB/s eta 0:00:28   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/4.7 MB 126.1 kB/s eta 0:00:28   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/4.7 MB 126.1 kB/s eta 0:00:28   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/4.7 MB 126.1 kB/s eta 0:00:28   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/4.7 MB 126.1 kB/s eta 0:00:28   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/4.7 MB 126.1 kB/s eta 0:00:28   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/4.7 MB 126.0 kB/s eta 0:00:26   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/4.7 MB 121.0 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 2.1/4.7 MB 114.3 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 2.4/4.7 MB 109.3 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 2.6/4.7 MB 99.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━ 2.9/4.7 MB 100.5 kB/s eta 0:00:19   ━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━ 2.9/4.7 MB 100.5 kB/s eta 0:00:19   ━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━ 2.9/4.7 MB 100.5 kB/s eta 0:00:19   ━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━ 2.9/4.7 MB 100.5 kB/s eta 0:00:19   ━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━ 2.9/4.7 MB 100.5 kB/s eta 0:00:19   ━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━ 2.9/4.7 MB 100.5 kB/s eta 0:00:19   ━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━ 2.9/4.7 MB 100.5 kB/s eta 0:00:19   ━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━ 3.1/4.7 MB 104.1 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━ 3.1/4.7 MB 104.1 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━ 3.1/4.7 MB 104.1 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━ 3.1/4.7 MB 104.1 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━ 3.1/4.7 MB 104.1 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━ 3.1/4.7 MB 104.1 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━ 3.4/4.7 MB 108.9 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━ 3.4/4.7 MB 108.9 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━ 3.4/4.7 MB 108.9 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━ 3.4/4.7 MB 108.9 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━ 3.7/4.7 MB 114.9 kB/s eta 0:00:10   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━ 3.7/4.7 MB 114.9 kB/s eta 0:00:10   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━ 3.7/4.7 MB 114.9 kB/s eta 0:00:10   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━ 3.7/4.7 MB 114.9 kB/s eta 0:00:10   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━ 3.7/4.7 MB 114.9 kB/s eta 0:00:10   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━ 3.7/4.7 MB 114.9 kB/s eta 0:00:10   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 3.9/4.7 MB 108.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━ 4.2/4.7 MB 112.5 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━ 4.2/4.7 MB 112.5 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━ 4.2/4.7 MB 112.5 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━ 4.2/4.7 MB 112.5 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━ 4.2/4.7 MB 112.5 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━ 4.2/4.7 MB 112.5 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━ 4.2/4.7 MB 112.5 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━ 4.2/4.7 MB 112.5 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━ 4.5/4.7 MB 115.7 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━ 4.5/4.7 MB 115.7 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━ 4.5/4.7 MB 115.7 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━ 4.5/4.7 MB 115.7 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━ 4.5/4.7 MB 115.7 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━ 4.5/4.7 MB 115.7 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸ 4.7/4.7 MB 121.9 kB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.7/4.7 MB 122.5 kB/s eta 0:00:00
Downloading anyio-4.15.1-py3-none-any.whl (132 kB)
Downloading more_itertools-11.1.0-py3-none-any.whl (72 kB)
Downloading cffi-2.1.1-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.whl (221 kB)
Downloading h11-0.16.0-py3-none-any.whl (37 kB)
Downloading typing_extensions-4.16.0-py3-none-any.whl (45 kB)
Downloading pycparser-3.0-py3-none-any.whl (48 kB)
Installing collected packages: trove-classifiers, distlib, urllib3, typing_extensions, tomlkit, shellingham, rapidfuzz, pyproject-hooks, pycparser, poetry-core, platformdirs, pkginfo, pbs-installer, packaging, msgpack, more-itertools, jeepney, jaraco.context, installer, idna, h11, filelock, fastjsonschema, crashtest, charset_normalizer, certifi, backports.zstd, requests, python-discovery, jaraco.functools, jaraco.classes, httpcore, findpython, dulwich, cleo, cffi, build, anyio, virtualenv, requests-toolbelt, httpx, cryptography, cachecontrol, SecretStorage, keyring, poetry
Successfully installed SecretStorage-3.5.0 anyio-4.15.1 backports.zstd-1.7.0 build-1.6.1 cachecontrol-0.14.4 certifi-2026.7.22 cffi-2.1.1 charset_normalizer-3.5.1 cleo-2.1.0 crashtest-0.4.1 cryptography-50.0.1 distlib-0.4.3 dulwich-1.2.15 fastjsonschema-2.22.2 filelock-4.0.3 findpython-0.8.0 h11-0.16.0 httpcore-1.0.9 httpx-0.28.1 idna-3.20 installer-1.0.1 jaraco.classes-3.4.0 jaraco.context-6.1.2 jaraco.functools-4.6.0 jeepney-0.9.0 keyring-25.7.0 more-itertools-11.1.0 msgpack-1.2.2 packaging-26.3 pbs-installer-2026.9.24 pkginfo-1.13 platformdirs-4.11.14 poetry-2.5.1 poetry-core-2.5.0 pycparser-3.0 pyproject-hooks-1.3.3 python-discovery-1.6.1 rapidfuzz-3.14.6 requests-2.34.2 requests-toolbelt-1.0.0 shellingham-1.5.4 tomlkit-0.15.1 trove-classifiers-2026.9.21.13 typing_extensions-4.16.0 urllib3-2.8.0 virtualenv-21.12.1
```
</details>

<details><summary>After (passing output)</summary>

```
Installing dependencies from lock file

No dependencies to install or update
```
</details>

### E2: Wrong runtime version <a id="e2"></a>

- **Docs said:** `poetry install` (README.md:22)
- **Cause:** Python 3.12 (the docs name no version, so a newcomer installs the current release) is too new: the project needs Python 3.11.7 (pyproject.toml poetry python ("3.11.7")).
- **Diagnosed by:** FirstRun rule `python-version`, confidence 90%
- **Doc change:** Python 3.11.7 (see pyproject.toml poetry python ("3.11.7"))
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
The currently activated Python version 3.12.14 is not supported by the project (3.11.7).
Trying to find and use a compatible version. 

Poetry was unable to find a compatible version. If you have one, you can explicitly use it via the "env use" command.
```
</details>

<details><summary>Fix applied</summary>

```
rebased onto python:3.11.7
```
</details>

<details><summary>After (passing output)</summary>

```
Installing dependencies from lock file

No dependencies to install or update
```
</details>

### E3: Missing dependency <a id="e3"></a>

- **Docs said:** `poetry install` (README.md:22)
- **Cause:** The dependencies installed, but current Poetry also installs the project itself, and this repo is an app, not a package. Older Poetry skipped that silently.
- **Diagnosed by:** FirstRun rule `poetry-no-root`, confidence 90%
- **Doc change:** poetry install --no-root
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```

        See https://packaging.python.org/en/latest/guides/writing-pyproject-toml/#license for details.
        ********************************************************************************

!!
  self._finalize_license_expression()
Installing /root/.cache/pypoetry/virtualenvs/fastapi-boilerplate-xS3fZVNL-py3.11/lib/python3.11/site-packages/tests/__init__.py over existing file

Installing the current project: fastapi-boilerplate (0.2.0)

Error: The current project could not be installed: No file/folder found for package fastapi-boilerplate
If you do not want to install the current project use --no-root.
If you want to use Poetry only for dependency management but not for packaging, you can disable package mode by setting package-mode = false in your pyproject.toml file.
If you did intend to install the current project, you may need to set `packages` in your pyproject.toml file.
```
</details>

<details><summary>Fix applied</summary>

```
step command → poetry install --no-root
```
</details>

<details><summary>After (passing output)</summary>

```
Installing dependencies from lock file

No dependencies to install or update
```
</details>

### E4: Undocumented backing service <a id="e4"></a>

- **Docs said:** `alembic upgrade head` (README.md:27)
- **Cause:** The app connects to MySQL on localhost:3306, but the docs never start it.
- **Diagnosed by:** FirstRun rule `missing-service`, confidence 92%
- **Doc change:** docker run -d --name mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=fastapi -e MYSQL_USER=fastapi -e MYSQL_PASSWORD=fastapi mysql:8
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
    self.dbapi_connection = connection = pool._invoke_creator(self)
                                         ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/root/.cache/pypoetry/virtualenvs/fastapi-boilerplate-xS3fZVNL-py3.11/lib/python3.11/site-packages/sqlalchemy/engine/create.py", line 645, in connect
    return dialect.connect(*cargs, **cparams)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/root/.cache/pypoetry/virtualenvs/fastapi-boilerplate-xS3fZVNL-py3.11/lib/python3.11/site-packages/sqlalchemy/engine/default.py", line 616, in connect
    return self.loaded_dbapi.connect(*cargs, **cparams)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/root/.cache/pypoetry/virtualenvs/fastapi-boilerplate-xS3fZVNL-py3.11/lib/python3.11/site-packages/pymysql/connections.py", line 358, in __init__
    self.connect()
  File "/root/.cache/pypoetry/virtualenvs/fastapi-boilerplate-xS3fZVNL-py3.11/lib/python3.11/site-packages/pymysql/connections.py", line 711, in connect
    raise exc
sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (2003, "Can't connect to MySQL server on 'localhost' ([Errno 111] Connection refused)")
(Background on this error at: https://sqlalche.me/e/20/e3q8)
```
</details>

<details><summary>Fix applied</summary>

```
started mysql:8 as "mysql" on localhost:3306
$ docker run -d --name mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=fastapi -e MYSQL_USER=fastapi -e MYSQL_PASSWORD=fastapi mysql:8 → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```
INFO  [alembic.runtime.migration] Context impl MySQLImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 59628dea39ff, init
```
</details>

### E5: Unrecognised failure <a id="e5"></a>

- **Docs said:** `make test` (README.md:37)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
ERROR tests/app/user/adapter/output/persistence/test_repository_adapter.py::test_save - sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (1044, "Access denied for user 'fastapi'@'%' to database 'fastapi_test'")
(Background on this error at: https://sqlalche.me/e/20/e3q8)
ERROR tests/app/user/adapter/output/persistence/sqlalchemy/test_user.py::test_get_users - sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (1044, "Access denied for user 'fastapi'@'%' to database 'fastapi_test'")
(Background on this error at: https://sqlalche.me/e/20/e3q8)
ERROR tests/app/user/adapter/output/persistence/sqlalchemy/test_user.py::test_get_user_by_email_or_nickname - sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (1044, "Access denied for user 'fastapi'@'%' to database 'fastapi_test'")
(Background on this error at: https://sqlalche.me/e/20/e3q8)
ERROR tests/app/user/adapter/output/persistence/sqlalchemy/test_user.py::test_get_user_by_id - sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (1044, "Access denied for user 'fastapi'@'%' to database 'fastapi_test'")
(Background on this error at: https://sqlalche.me/e/20/e3q8)
ERROR tests/app/user/adapter/output/persistence/sqlalchemy/test_user.py::test_get_user_by_email_and_password - sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (1044, "Access denied for user 'fastapi'@'%' to database 'fastapi_test'")
(Background on this error at: https://sqlalche.me/e/20/e3q8)
ERROR tests/app/user/adapter/output/persistence/sqlalchemy/test_user.py::test_save - sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (1044, "Access denied for user 'fastapi'@'%' to database 'fastapi_test'")
(Background on this error at: https://sqlalche.me/e/20/e3q8)
=================== 5 failed, 33 passed, 16 errors in 5.46s ====================
make: *** [Makefile:6: test] Error 1
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Python version | not stated | 3.11 (pyproject.toml poetry python ("3.11.7")) | README.md |
| env var ENV | not documented | read in core/config.py:36 | README |
| redis service | setup never starts it | dependency "celery" | Python requirements |
| mysql service | setup never starts it | dependency "pymysql" | Python requirements |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **FirstRun Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by FirstRun. Verified plan: `.github/firstrun/plan.json`.
