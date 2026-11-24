# Setup Passport: fastapi/fastapi

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `python:3.12` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `192b12197e` |
| Verified | 2026-09-27 12:56 UTC |
| Runtime | Python 3.12 (`python:3.12`) |
| Clone to running, from zero | **3s** |
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
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/20.5 MB ? eta -:--:--   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/20.5 MB ? eta -:--:--   ╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/20.5 MB ? eta -:--:--   ╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/20.5 MB ? eta -:--:--   ━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/20.5 MB 836.3 kB/s eta 0:00:24   ━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/20.5 MB 844.2 kB/s eta 0:00:24   ━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/20.5 MB 844.2 kB/s eta 0:00:24   ━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/20.5 MB 844.2 kB/s eta 0:00:24   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/20.5 MB 710.0 kB/s eta 0:00:28   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/20.5 MB 710.0 kB/s eta 0:00:28   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/20.5 MB 710.0 kB/s eta 0:00:28   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/20.5 MB 607.2 kB/s eta 0:00:32   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/20.5 MB 607.2 kB/s eta 0:00:32   ━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/20.5 MB 616.9 kB/s eta 0:00:31   ━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/20.5 MB 616.9 kB/s eta 0:00:31   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/20.5 MB 694.1 kB/s eta 0:00:27   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/20.5 MB 694.1 kB/s eta 0:00:27   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/20.5 MB 694.1 kB/s eta 0:00:27   ━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.4/20.5 MB 664.8 kB/s eta 0:00:28   ━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.4/20.5 MB 664.8 kB/s eta 0:00:28   ━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.6/20.5 MB 648.2 kB/s eta 0:00:28   ━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.6/20.5 MB 648.2 kB/s eta 0:00:28   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/20.5 MB 649.0 kB/s eta 0:00:28   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/20.5 MB 649.0 kB/s eta 0:00:28   ━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.1/20.5 MB 663.3 kB/s eta 0:00:27   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.4/20.5 MB 669.7 kB/s eta 0:00:26   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.4/20.5 MB 669.7 kB/s eta 0:00:26   ━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.7/20.5 MB 671.4 kB/s eta 0:00:26   ━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.7/20.5 MB 671.4 kB/s eta 0:00:26   ━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.9/20.5 MB 683.0 kB/s eta 0:00:25   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.5/20.5 MB 735.3 kB/s eta 0:00:22   ━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.5/20.5 MB 735.3 kB/s eta 0:00:22   ━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.7/20.5 MB 743.8 kB/s eta 0:00:22   ━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.0/20.5 MB 758.0 kB/s eta 0:00:21   ━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.2/20.5 MB 775.8 kB/s eta 0:00:20   ━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.5/20.5 MB 794.7 kB/s eta 0:00:19   ━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.5/20.5 MB 794.7 kB/s eta 0:00:19   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.8/20.5 MB 787.7 kB/s eta 0:00:19   ━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.0/20.5 MB 788.0 kB/s eta 0:00:19   ━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.0/20.5 MB 788.0 kB/s eta 0:00:19   ━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.3/20.5 MB 794.2 kB/s eta 0:00:18   ━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.6/20.5 MB 807.9 kB/s eta 0:00:18   ━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.6/20.5 MB 807.9 kB/s eta 0:00:18   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.8/20.5 MB 790.0 kB/s eta 0:00:18   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.8/20.5 MB 790.0 kB/s eta 0:00:18   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.8/20.5 MB 790.0 kB/s eta 0:00:18   ━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━ 7.1/20.5 MB 778.7 kB/s eta 0:00:18   ━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━ 7.3/20.5 MB 779.1 kB/s eta 0:00:17   ━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━ 7.6/20.5 MB 796.0 kB/s eta 0:00:17   ━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━ 7.6/20.5 MB 796.0 kB/s eta 0:00:17   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 7.9/20.5 MB 790.3 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 7.9/20.5 MB 790.3 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━ 8.1/20.5 MB 786.3 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━ 8.4/20.5 MB 785.2 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━ 8.4/20.5 MB 785.2 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━ 8.7/20.5 MB 791.7 kB/s eta 0:00:15   ━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━ 8.9/20.5 MB 799.4 kB/s eta 0:00:15   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 9.2/20.5 MB 804.0 kB/s eta 0:00:15   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 9.2/20.5 MB 804.0 kB/s eta 0:00:15   ━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━ 9.2/20.5 MB 804.0 kB/s eta 0:00:15   ━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━ 9.4/20.5 MB 789.7 kB/s eta 0:00:14   ━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━ 9.4/20.5 MB 789.7 kB/s eta 0:00:14   ━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━ 9.7/20.5 MB 788.7 kB/s eta 0:00:14   ━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━ 9.7/20.5 MB 788.7 kB/s eta 0:00:14   ━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━ 10.0/20.5 MB 781.3 kB/s eta 0:00:14   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 10.2/20.5 MB 781.2 kB/s eta 0:00:14   ━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━ 10.5/20.5 MB 788.9 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━ 10.5/20.5 MB 788.9 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━ 10.7/20.5 MB 783.9 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━ 10.7/20.5 MB 783.9 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━ 10.7/20.5 MB 783.9 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━ 11.0/20.5 MB 775.6 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 11.3/20.5 MB 775.7 kB/s eta 0:00:12   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 11.3/20.5 MB 775.7 kB/s eta 0:00:12   ━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━ 11.5/20.5 MB 780.3 kB/s eta 0:00:12   ━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━ 12.1/20.5 MB 800.4 kB/s eta 0:00:11   ━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━ 12.6/20.5 MB 823.6 kB/s eta 0:00:10   ━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━ 12.8/20.5 MB 828.4 kB/s eta 0:00:10   ━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━ 13.1/20.5 MB 833.5 kB/s eta 0:00:09   ━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━ 13.4/20.5 MB 843.4 kB/s eta 0:00:09   ━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━ 13.6/20.5 MB 850.4 kB/s eta 0:00:09   ━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━ 14.2/20.5 MB 870.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━ 14.7/20.5 MB 889.7 kB/s eta 0:00:07   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━ 14.7/20.5 MB 889.7 kB/s eta 0:00:07   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━ 14.9/20.5 MB 893.4 kB/s eta 0:00:07   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━ 15.5/20.5 MB 904.6 kB/s eta 0:00:06   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━ 15.7/20.5 MB 916.5 kB/s eta 0:00:06   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━ 16.0/20.5 MB 922.1 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━ 16.5/20.5 MB 936.8 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 17.0/20.5 MB 954.8 kB/s eta 0:00:04   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━ 17.3/20.5 MB 958.2 kB/s eta 0:00:04   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━ 17.6/20.5 MB 961.7 kB/s eta 0:00:04   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━ 17.8/20.5 MB 968.3 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━ 17.8/20.5 MB 968.3 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━ 18.1/20.5 MB 958.7 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━ 18.4/20.5 MB 962.4 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━ 18.9/20.5 MB 978.2 kB/s eta 0:00:02   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━ 19.1/20.5 MB 984.2 kB/s eta 0:00:02   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━ 19.4/20.5 MB 989.7 kB/s eta 0:00:02   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━ 19.7/20.5 MB 994.2 kB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺ 20.2/20.5 MB 1.0 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸ 20.4/20.5 MB 1.0 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸ 20.4/20.5 MB 1.0 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸ 20.4/20.5 MB 1.0 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 20.5/20.5 MB 985.3 kB/s eta 0:00:00
Installing collected packages: uv
Successfully installed uv-0.12.19
```
</details>

<details><summary>After (passing output)</summary>

```
Downloading ast-serialize (1.2MiB)
Downloading anthropic (1.2MiB)
Downloading ty (12.4MiB)
Downloading sqlalchemy (3.2MiB)
Downloading prek (6.1MiB)
Downloading openai (1.6MiB)
      Built fastapi @ file:///workspace
 Downloaded google-genai

[firstrun] server did not become ready on port 8000 within 150s
```
</details>

### E2: Unrecognised failure <a id="e2"></a>

- **Docs said:** `uv run fastapi dev` (README.md:203)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
Downloading playwright (45.5MiB)
Downloading beartype (1.3MiB)
Downloading pydantic-ai-slim (1.4MiB)
Downloading zensical (12.6MiB)
Downloading ast-serialize (1.2MiB)
Downloading anthropic (1.2MiB)
Downloading ty (12.4MiB)
Downloading sqlalchemy (3.2MiB)
Downloading prek (6.1MiB)
Downloading openai (1.6MiB)
      Built fastapi @ file:///workspace
 Downloaded google-genai

[firstrun] server did not become ready on port 8000 within 150s
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
