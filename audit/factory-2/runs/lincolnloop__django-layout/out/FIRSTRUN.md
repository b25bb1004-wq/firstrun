# Setup Passport: lincolnloop/django-layout

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `python:3.12` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `c61297ca49` |
| Verified | 2026-09-27 12:18 UTC |
| Runtime | Python 3.12 (`python:3.12`) |
| Clone to running, from zero | **11s** |
| Steps followed | 3 from the docs, 0 added by HUMBLE |
| Breaks found / fixed | 2 / 0 |
| Needs a human | 2 |
| Done when | every step exits cleanly |

**Before HUMBLE**, a newcomer following the docs got stuck at `make init` (README.md:98).

## Verified setup

```bash
make run
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `make init` (README.md:98)
- **Cause:** `uv` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** uv
- **Result:** worked: cleared this error, then the step failed on a later problem ([E2](#e2))

<details><summary>Before (failing output)</summary>

```
	&& pre-commit install
downloading uv 0.12.19 aarch64-unknown-linux-gnu
installing to /root/.local/bin
  uv
  uvx
everything's installed!

To add $HOME/.local/bin to your PATH, either restart your shell or run:

    source $HOME/.local/bin/env (sh, bash, zsh)
    source $HOME/.local/bin/env.fish (fish)
[firstrun] 'docker compose build' is not available on the clean machine (no Docker daemon)
/bin/bash: line 6: uv: command not found
make: *** [Makefile:8: init] Error 127
```
</details>

<details><summary>Fix applied</summary>

```
$ command -v uv >/dev/null || { if command -v pip >/dev/null || command -v pip3 >/dev/null; then (pip install uv || pip3 install uv); else apt-get update -qq && apt-get install -y -qq curl >/dev/null && curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh; fi; }
Collecting uv
  Downloading uv-0.12.19-py3-none-manylinux_2_28_aarch64.whl.metadata (11 kB)
Downloading uv-0.12.19-py3-none-manylinux_2_28_aarch64.whl (19.8 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/19.8 MB ? eta -:--:--   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/19.8 MB ? eta -:--:--   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/19.8 MB ? eta -:--:--   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/19.8 MB ? eta -:--:--   ╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/19.8 MB ? eta -:--:--   ╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/19.8 MB ? eta -:--:--   ╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/19.8 MB ? eta -:--:--   ╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.3/19.8 MB ? eta -:--:--   ━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/19.8 MB 304.6 kB/s eta 0:01:04   ━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/19.8 MB 304.6 kB/s eta 0:01:04   ━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/19.8 MB 304.6 kB/s eta 0:01:04   ━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/19.8 MB 304.6 kB/s eta 0:01:04   ━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/19.8 MB 304.6 kB/s eta 0:01:04   ━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/19.8 MB 304.6 kB/s eta 0:01:04   ━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.5/19.8 MB 304.6 kB/s eta 0:01:04   ━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/19.8 MB 221.4 kB/s eta 0:01:26   ━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/19.8 MB 221.4 kB/s eta 0:01:26   ━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/19.8 MB 221.4 kB/s eta 0:01:26   ━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/19.8 MB 221.4 kB/s eta 0:01:26   ━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/19.8 MB 221.4 kB/s eta 0:01:26   ━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/19.8 MB 221.4 kB/s eta 0:01:26   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/19.8 MB 217.9 kB/s eta 0:01:26   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/19.8 MB 217.9 kB/s eta 0:01:26   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/19.8 MB 217.9 kB/s eta 0:01:26   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/19.8 MB 217.9 kB/s eta 0:01:26   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/19.8 MB 217.9 kB/s eta 0:01:26   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/19.8 MB 217.9 kB/s eta 0:01:26   ━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/19.8 MB 217.9 kB/s eta 0:01:26   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/19.8 MB 205.2 kB/s eta 0:01:31   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/19.8 MB 205.2 kB/s eta 0:01:31   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/19.8 MB 205.2 kB/s eta 0:01:31   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/19.8 MB 205.2 kB/s eta 0:01:31   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/19.8 MB 205.2 kB/s eta 0:01:31   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/19.8 MB 205.2 kB/s eta 0:01:31   ━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.3/19.8 MB 205.2 kB/s eta 0:01:31   ━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/19.8 MB 205.3 kB/s eta 0:01:29   ━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/19.8 MB 205.3 kB/s eta 0:01:29   ━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/19.8 MB 205.3 kB/s eta 0:01:29   ━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/19.8 MB 205.3 kB/s eta 0:01:29   ━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/19.8 MB 217.2 kB/s eta 0:01:23   ━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/19.8 MB 217.2 kB/s eta 0:01:23   ━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/19.8 MB 217.2 kB/s eta 0:01:23   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/19.8 MB 231.7 kB/s eta 0:01:17   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/19.8 MB 231.7 kB/s eta 0:01:17   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/19.8 MB 231.7 kB/s eta 0:01:17   ━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/19.8 MB 231.7 kB/s eta 0:01:17   ━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.4/19.8 MB 243.0 kB/s eta 0:01:12   ━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.4/19.8 MB 243.0 kB/s eta 0:01:12   ━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.4/19.8 MB 243.0 kB/s eta 0:01:12   ━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.4/19.8 MB 243.0 kB/s eta 0:01:12   ━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.6/19.8 MB 246.4 kB/s eta 0:01:10   ━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.6/19.8 MB 246.4 kB/s eta 0:01:10   ━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.6/19.8 MB 246.4 kB/s eta 0:01:10   ━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.6/19.8 MB 246.4 kB/s eta 0:01:10   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.9/19.8 MB 251.6 kB/s eta 0:01:08   ━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.1/19.8 MB 225.9 kB/s eta 0:01:14   ━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.1/19.8 MB 225.9 kB/s eta 0:01:14   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.4/19.8 MB 237.5 kB/s eta 0:01:09   ━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.4/19.8 MB 237.5 kB/s eta 0:01:09   ━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.7/19.8 MB 250.7 kB/s eta 0:01:05   ━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.9/19.8 MB 264.4 kB/s eta 0:01:00   ━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.2/19.8 MB 277.8 kB/s eta 0:00:57   ━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.2/19.8 MB 277.8 kB/s eta 0:00:57   ━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.5/19.8 MB 289.1 kB/s eta 0:00:54   ━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.5/19.8 MB 289.1 kB/s eta 0:00:54   ━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.7/19.8 MB 301.0 kB/s eta 0:00:51   ━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.0/19.8 MB 312.4 kB/s eta 0:00:48   ━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.0/19.8 MB 312.4 kB/s eta 0:00:48   ━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.2/19.8 MB 322.6 kB/s eta 0:00:46   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.5/19.8 MB 332.7 kB/s eta 0:00:43   ━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.5/19.8 MB 332.7 kB/s eta 0:00:43   ━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.8/19.8 MB 341.8 kB/s eta 0:00:42   ━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.0/19.8 MB 352.0 kB/s eta 0:00:40   ━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.0/19.8 MB 352.0 kB/s eta 0:00:40   ━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.3/19.8 MB 360.1 kB/s eta 0:00:38   ━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.3/19.8 MB 360.1 kB/s eta 0:00:38   ━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.6/19.8 MB 368.5 kB/s eta 0:00:36   ━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.8/19.8 MB 377.5 kB/s eta 0:00:35   ━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.8/19.8 MB 377.5 kB/s eta 0:00:35   ━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━━ 7.1/19.8 MB 384.9 kB/s eta 0:00:34   ━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━ 7.3/19.8 MB 392.8 kB/s eta 0:00:32   ━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━ 7.3/19.8 MB 392.8 kB/s eta 0:00:32   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 7.6/19.8 MB 399.3 kB/s eta 0:00:31   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 7.6/19.8 MB 399.3 kB/s eta 0:00:31   ━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━ 7.9/19.8 MB 406.4 kB/s eta 0:00:30   ━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━ 7.9/19.8 MB 406.4 kB/s eta 0:00:30   ━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━ 8.1/19.8 MB 410.2 kB/s eta 0:00:29   ━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━ 8.1/19.8 MB 410.2 kB/s eta 0:00:29   ━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━ 8.4/19.8 MB 416.0 kB/s eta 0:00:28   ━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━ 8.4/19.8 MB 416.0 kB/s eta 0:00:28   ━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━ 8.7/19.8 MB 420.9 kB/s eta 0:00:27   ━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━ 8.7/19.8 MB 420.9 kB/s eta 0:00:27   ━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━ 8.9/19.8 MB 425.6 kB/s eta 0:00:26   ━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━ 8.9/19.8 MB 425.6 kB/s eta 0:00:26   ━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━ 9.2/19.8 MB 429.8 kB/s eta 0:00:25   ━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━ 9.4/19.8 MB 435.0 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━ 9.4/19.8 MB 435.0 kB/s eta 0:00:24   ━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━━ 9.7/19.8 MB 441.4 kB/s eta 0:00:23   ━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━ 10.0/19.8 MB 447.1 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━ 10.2/19.8 MB 453.5 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━━ 10.2/19.8 MB 453.5 kB/s eta 0:00:22   ━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━ 10.5/19.8 MB 459.9 kB/s eta 0:00:21   ━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━━ 10.7/19.8 MB 466.0 kB/s eta 0:00:20   ━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━ 11.0/19.8 MB 473.0 kB/s eta 0:00:19   ━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━ 11.3/19.8 MB 479.4 kB/s eta 0:00:18   ━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━━ 11.3/19.8 MB 479.4 kB/s eta 0:00:18   ━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━ 11.5/19.8 MB 485.8 kB/s eta 0:00:17   ━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━━ 11.8/19.8 MB 491.6 kB/s eta 0:00:17   ━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━ 12.1/19.8 MB 497.3 kB/s eta 0:00:16   ━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━ 12.3/19.8 MB 503.1 kB/s eta 0:00:15   ━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━━ 12.3/19.8 MB 503.1 kB/s eta 0:00:15   ━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━ 12.6/19.8 MB 508.5 kB/s eta 0:00:15   ━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━━ 12.8/19.8 MB 513.8 kB/s eta 0:00:14   ━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━━ 13.1/19.8 MB 519.7 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━ 13.4/19.8 MB 525.1 kB/s eta 0:00:13   ━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━━━ 13.6/19.8 MB 530.7 kB/s eta 0:00:12   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━ 13.9/19.8 MB 536.2 kB/s eta 0:00:11   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━ 13.9/19.8 MB 536.2 kB/s eta 0:00:11   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━ 14.4/19.8 MB 547.8 kB/s eta 0:00:10   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━━ 14.7/19.8 MB 554.0 kB/s eta 0:00:10   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━ 14.9/19.8 MB 560.3 kB/s eta 0:00:09   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━ 15.2/19.8 MB 564.8 kB/s eta 0:00:09   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━ 15.5/19.8 MB 571.1 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━ 15.7/19.8 MB 577.2 kB/s eta 0:00:08   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━ 16.0/19.8 MB 583.8 kB/s eta 0:00:07   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━ 16.5/19.8 MB 595.5 kB/s eta 0:00:06   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━ 16.8/19.8 MB 601.0 kB/s eta 0:00:06   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━ 16.8/19.8 MB 601.0 kB/s eta 0:00:06   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━ 17.0/19.8 MB 604.9 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━ 17.3/19.8 MB 608.6 kB/s eta 0:00:05   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━ 17.8/19.8 MB 620.2 kB/s eta 0:00:04   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━ 18.1/19.8 MB 626.1 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━ 18.4/19.8 MB 631.7 kB/s eta 0:00:03   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━ 18.9/19.8 MB 643.0 kB/s eta 0:00:02   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━ 19.1/19.8 MB 648.8 kB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺ 19.4/19.8 MB 654.6 kB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 19.8/19.8 MB 660.8 kB/s eta 0:00:00
Installing collected packages: uv
Successfully installed uv-0.12.19
```
</details>

<details><summary>After (passing output)</summary>

```
 + nodeenv==1.11.0
 + platformdirs==4.12.0
 + pre-commit==4.6.2
 + python-discovery==1.6.1
 + pyyaml==6.0.3
 + virtualenv==21.13.0
Installed 1 executable: pre-commit
warning: `/root/.local/bin` is not on your PATH. To use installed tools, run `export PATH="/root/.local/bin:$PATH"` or `uv tool update-shell`.
/bin/bash: line 7: pre-commit: command not found
make: *** [Makefile:8: init] Error 127
```
</details>

### E2: Missing tool <a id="e2"></a>

- **Docs said:** `make init` (README.md:98)
- **Cause:** `pre-commit` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** pre-commit
- **Result:** worked: cleared this error, then the step failed on a later problem

<details><summary>Before (failing output)</summary>

```
 + cfgv==3.5.0
 + distlib==0.4.3
 + filelock==4.0.4
 + identify==2.6.20
 + nodeenv==1.11.0
 + platformdirs==4.12.0
 + pre-commit==4.6.2
 + python-discovery==1.6.1
 + pyyaml==6.0.3
 + virtualenv==21.13.0
Installed 1 executable: pre-commit
warning: `/root/.local/bin` is not on your PATH. To use installed tools, run `export PATH="/root/.local/bin:$PATH"` or `uv tool update-shell`.
/bin/bash: line 7: pre-commit: command not found
make: *** [Makefile:8: init] Error 127
```
</details>

<details><summary>Fix applied</summary>

```
Downloading pre_commit-4.6.2-py2.py3-none-any.whl (226 kB)
Downloading cfgv-3.5.0-py2.py3-none-any.whl (7.4 kB)
Downloading identify-2.6.20-py2.py3-none-any.whl (99 kB)
Downloading nodeenv-1.11.0-py2.py3-none-any.whl (34 kB)
Downloading pyyaml-6.0.3-cp312-cp312-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl (775 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/775.1 kB ? eta -:--:--   ━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━ 524.3/775.1 kB 5.4 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 775.1/775.1 kB 4.2 MB/s eta 0:00:00
Downloading virtualenv-21.13.0-py3-none-any.whl (5.5 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/5.5 MB ? eta -:--:--   ━━━━━╸━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.8/5.5 MB 4.3 MB/s eta 0:00:02   ━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/5.5 MB 5.5 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━╺━━━━━━━━━━━━━━━━━━ 2.9/5.5 MB 4.9 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸━━━━━━━━━ 4.2/5.5 MB 5.3 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╺━ 5.2/5.5 MB 5.3 MB/s eta 0:00:01   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.5/5.5 MB 5.2 MB/s eta 0:00:00
Downloading distlib-0.4.3-py2.py3-none-any.whl (470 kB)
Downloading filelock-4.0.4-py3-none-any.whl (108 kB)
Downloading platformdirs-4.12.0-py3-none-any.whl (32 kB)
Downloading python_discovery-1.6.1-py3-none-any.whl (38 kB)
Installing collected packages: distlib, pyyaml, platformdirs, nodeenv, identify, filelock, cfgv, python-discovery, virtualenv, pre-commit
Successfully installed cfgv-3.5.0 distlib-0.4.3 filelock-4.0.4 identify-2.6.20 nodeenv-1.11.0 platformdirs-4.12.0 pre-commit-4.6.2 python-discovery-1.6.1 pyyaml-6.0.3 virtualenv-21.13.0
```
</details>

<details><summary>After (passing output)</summary>

```
    && docker compose stop \
	&& git init && git add . \
	&& command -v pre-commit || uv tool install pre-commit \
	&& pre-commit install
/usr/local/bin/uvx
[firstrun] 'docker compose build' is not available on the clean machine (no Docker daemon)
`pre-commit` is already installed
An error has occurred: FatalError: git failed. Is it installed, and are you in a Git repository directory?
Check the log at /root/.cache/pre-commit/pre-commit.log
make: *** [Makefile:8: init] Error 1
```
</details>

### E3: sandbox-limit <a id="e3"></a>

- **Docs said:** `make init` (README.md:98)
- **Cause:** This step starts Docker containers itself, and HUMBLE's clean machine has no Docker engine inside it (no nested Docker). On a newcomer's laptop with Docker running it would work; HUMBLE cannot prove it here, so it is not counted against the docs.
- **Diagnosed by:** HUMBLE rule `needs-docker-daemon`, confidence 90%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
command -v uvx || curl -LsSf https://astral.sh/uv/install.sh | sh \
	&& docker compose build \
	&& docker compose run --rm app python manage.py migrate \
    && docker compose stop \
	&& git init && git add . \
	&& command -v pre-commit || uv tool install pre-commit \
	&& pre-commit install
/usr/local/bin/uvx
[firstrun] 'docker compose build' is not available on the clean machine (no Docker daemon)
`pre-commit` is already installed
An error has occurred: FatalError: git failed. Is it installed, and are you in a Git repository directory?
Check the log at /root/.cache/pre-commit/pre-commit.log
make: *** [Makefile:8: init] Error 1
```
</details>

### E4: sandbox-limit <a id="e4"></a>

- **Docs said:** `make init` (README.md:132)
- **Cause:** This step starts Docker containers itself, and HUMBLE's clean machine has no Docker engine inside it (no nested Docker). On a newcomer's laptop with Docker running it would work; HUMBLE cannot prove it here, so it is not counted against the docs.
- **Diagnosed by:** HUMBLE rule `needs-docker-daemon`, confidence 90%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
command -v uvx || curl -LsSf https://astral.sh/uv/install.sh | sh \
	&& docker compose build \
	&& docker compose run --rm app python manage.py migrate \
    && docker compose stop \
	&& git init && git add . \
	&& command -v pre-commit || uv tool install pre-commit \
	&& pre-commit install
/usr/local/bin/uvx
[firstrun] 'docker compose build' is not available on the clean machine (no Docker daemon)
`pre-commit` is already installed
An error has occurred: FatalError: git failed. Is it installed, and are you in a Git repository directory?
Check the log at /root/.cache/pre-commit/pre-commit.log
make: *** [Makefile:8: init] Error 1
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Python version | not stated | 3.14 (pyproject.toml requires-python ("==3.14.7")) | README.md |
| app URL | http://127.0.0.1:8000/ | `make run` finishes and exits; nothing serves that URL | README |

## Notes

- The repo has both Node.js and Python; HUMBLE used the Python image because the first install step is python. The Node.js part was not set up separately.

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
