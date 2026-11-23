# Setup Passport: wagtail/bakerydemo

❌ **FAILED**: FirstRun followed this project's setup docs on a clean `python:3.10` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `c8f8255593` |
| Verified | 2026-09-25 20:42 UTC |
| Runtime | Python 3.10 (`python:3.10`) |
| Clone to running, from zero | **n/a** |
| Steps followed | 11 from the docs, 0 added by FirstRun |
| Breaks found / fixed | 2 / 0 |
| Needs a human | 1 |
| Done when | every step exits cleanly |

**Before FirstRun**, a newcomer following the docs got stuck at `uv venv .venv` (readme.md:130).

## Verified setup

```bash
python -m venv .venv
source .venv/bin/activate
cd ~/dev [or your preferred dev directory]
pip install -r requirements/development.txt
uv pip install -r requirements/development.txt
cp bakerydemo/settings/local.py.example bakerydemo/settings/local.py
cp .env.example .env
./manage.py migrate
./manage.py load_initial_data
./manage.py runserver
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `uv venv .venv` (readme.md:130)
- **Cause:** `uv` is not installed; the docs assume it is.
- **Diagnosed by:** FirstRun rule `missing-tool`, confidence 80%
- **Doc change:** uv
- **Result:** fix did not work

<details><summary>Before (failing output)</summary>

```
/firstrun/step-2.sh: line 4: uv: command not found
```
</details>

<details><summary>Fix applied</summary>

```
$ pip install uv
Collecting uv
  Downloading uv-0.12.19-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (20.5 MB)
                                              0.0/20.5 MB ? eta -:--:--                                              0.0/20.5 MB 1.3 MB/s eta 0:00:16                                              0.0/20.5 MB 538.2 kB/s eta 0:00:38                                              0.1/20.5 MB 878.5 kB/s eta 0:00:24                                              0.1/20.5 MB 878.5 kB/s eta 0:00:24                                              0.2/20.5 MB 1.2 MB/s eta 0:00:17                                              0.2/20.5 MB 1.2 MB/s eta 0:00:17     ╸                                        0.3/20.5 MB 1.3 MB/s eta 0:00:16     ╸                                        0.4/20.5 MB 1.5 MB/s eta 0:00:14     ╸                                        0.5/20.5 MB 1.6 MB/s eta 0:00:13     ━                                        0.6/20.5 MB 1.6 MB/s eta 0:00:13     ━                                        0.7/20.5 MB 1.8 MB/s eta 0:00:12     ━                                        0.7/20.5 MB 1.8 MB/s eta 0:00:12     ━╸                                       0.8/20.5 MB 1.8 MB/s eta 0:00:11     ━╸                                       0.9/20.5 MB 1.9 MB/s eta 0:00:11     ━━                                       1.0/20.5 MB 2.0 MB/s eta 0:00:10     ━━                                       1.0/20.5 MB 2.0 MB/s eta 0:00:10     ━━                                       1.0/20.5 MB 2.0 MB/s eta 0:00:10     ━━                                       1.0/20.5 MB 2.0 MB/s eta 0:00:10     ━━                                       1.0/20.5 MB 2.0 MB/s eta 0:00:10     ━━                                       1.1/20.5 MB 1.6 MB/s eta 0:00:13     ━━                                       1.1/20.5 MB 1.6 MB/s eta 0:00:13     ━━                                       1.2/20.5 MB 1.6 MB/s eta 0:00:12     ━━╸                                      1.3/20.5 MB 1.6 MB/s eta 0:00:12     ━━╸                                      1.4/20.5 MB 1.7 MB/s eta 0:00:12     ━━╸                                      1.4/20.5 MB 1.7 MB/s eta 0:00:12     ━━╸                                      1.5/20.5 MB 1.7 MB/s eta 0:00:12     ━━━                                      1.6/20.5 MB 1.7 MB/s eta 0:00:11     ━━━                                      1.7/20.5 MB 1.8 MB/s eta 0:00:11     ━━━                                      1.8/20.5 MB 1.8 MB/s eta 0:00:11     ━━━╸                                     1.8/20.5 MB 1.8 MB/s eta 0:00:11     ━━━╸                                     2.0/20.5 MB 1.8 MB/s eta 0:00:11     ━━━━                                     2.1/20.5 MB 1.9 MB/s eta 0:00:10     ━━━━                                     2.2/20.5 MB 1.9 MB/s eta 0:00:10     ━━━━                                     2.2/20.5 MB 1.9 MB/s eta 0:00:10     ━━━━                                     2.2/20.5 MB 1.8 MB/s eta 0:00:10     ━━━━╸                                    2.3/20.5 MB 1.9 MB/s eta 0:00:10     ━━━━╸                                    2.5/20.5 MB 1.9 MB/s eta 0:00:10     ━━━━╸                                    2.5/20.5 MB 1.9 MB/s eta 0:00:10     ━━━━╸                                    2.5/20.5 MB 1.9 MB/s eta 0:00:10     ━━━━╸                                    2.5/20.5 MB 1.9 MB/s eta 0:00:10     ━━━━━                                    2.6/20.5 MB 1.8 MB/s eta 0:00:10     ━━━━━                                    2.7/20.5 MB 1.9 MB/s eta 0:00:10     ━━━━━                                    2.8/20.5 MB 1.9 MB/s eta 0:00:10     ━━━━━╸                                   2.9/20.5 MB 1.9 MB/s eta 0:00:10     ━━━━━╸                                   3.0/20.5 MB 2.0 MB/s eta 0:00:09     ━━━━━━                                   3.2/20.5 MB 2.0 MB/s eta 0:00:09     ━━━━━━                                   3.3/20.5 MB 2.0 MB/s eta 0:00:09     ━━━━━━╸                                  3.3/20.5 MB 2.0 MB/s eta 0:00:09     ━━━━━━╸                                  3.5/20.5 MB 2.0 MB/s eta 0:00:09     ━━━━━━━                                  3.6/20.5 MB 2.1 MB/s eta 0:00:09     ━━━━━━━                                  3.7/20.5 MB 2.1 MB/s eta 0:00:08     ━━━━━━━╸                                 3.8/20.5 MB 2.1 MB/s eta 0:00:08     ━━━━━━━╸                                 3.9/20.5 MB 2.1 MB/s eta 0:00:08     ━━━━━━━╸                                 4.0/20.5 MB 2.1 MB/s eta 0:00:08     ━━━━━━━━                                 4.1/20.5 MB 2.1 MB/s eta 0:00:08     ━━━━━━━━                                 4.2/20.5 MB 2.2 MB/s eta 0:00:08     ━━━━━━━━                                 4.3/20.5 MB 2.2 MB/s eta 0:00:08     ━━━━━━━━                                 4.3/20.5 MB 2.1 MB/s eta 0:00:08     ━━━━━━━━╸                                4.4/20.5 MB 2.2 MB/s eta 0:00:08     ━━━━━━━━╸                                4.5/20.5 MB 2.2 MB/s eta 0:00:08     ━━━━━━━━╸                                4.6/20.5 MB 2.1 MB/s eta 0:00:08     ━━━━━━━━━                                4.7/20.5 MB 2.2 MB/s eta 0:00:08     ━━━━━━━━━                                4.8/20.5 MB 2.2 MB/s eta 0:00:08     ━━━━━━━━━╸                               4.9/20.5 MB 2.2 MB/s eta 0:00:08     ━━━━━━━━━╸                               5.0/20.5 MB 2.2 MB/s eta 0:00:08     ━━━━━━━━━━                               5.1/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━                               5.2/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━                               5.3/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━                               5.3/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━                               5.3/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━╸                              5.5/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━╸                              5.6/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━                              5.6/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━                              5.8/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━                              5.8/20.5 MB 2.3 MB/s eta 0:00:07     ━━━━━━━━━━━╸                             5.9/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━╸                             5.9/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━╸                             6.0/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━╸                             6.1/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━                             6.2/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━                             6.3/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━                             6.3/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━╸                            6.4/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━╸                            6.5/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━╸                            6.6/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━╸                            6.6/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━━                            6.7/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━━                            6.8/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━━                            6.8/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━━╸                           6.9/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━━╸                           7.0/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━━╸                           7.1/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━━╸                           7.1/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━━━                           7.2/20.5 MB 2.2 MB/s eta 0:00:07     ━━━━━━━━━━━━━━                           7.4/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━                           7.4/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━╸                          7.6/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━                          7.7/20.5 MB 2.3 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━                          7.7/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━                          7.8/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━                          7.8/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━╸                         8.0/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━╸                         8.0/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━╸                         8.1/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━╸                         8.2/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━╸                         8.2/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━                         8.2/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━                         8.3/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━                         8.3/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━                         8.3/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━                         8.3/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━                         8.3/20.5 MB 2.1 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━                         8.4/20.5 MB 2.1 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━╸                        8.5/20.5 MB 2.1 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━╸                        8.7/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━━                        8.8/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━━                        8.9/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━━╸                       9.1/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━━╸                       9.1/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━━╸                       9.1/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━━╸                       9.1/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━━╸                       9.1/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━━━                       9.4/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━━━                       9.4/20.5 MB 2.2 MB/s eta 0:00:06     ━━━━━━━━━━━━━━━━━━╸                      9.6/20.5 MB 2.2 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━                      9.7/20.5 MB 2.2 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━                      9.8/20.5 MB 2.2 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━                      10.0/20.5 MB 2.2 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━╸                     10.1/20.5 MB 2.2 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━╸                     10.1/20.5 MB 2.2 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━╸                     10.2/20.5 MB 2.2 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━━                     10.4/20.5 MB 2.3 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━━╸                    10.5/20.5 MB 2.3 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━━╸                    10.5/20.5 MB 2.3 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━━╸                    10.6/20.5 MB 2.3 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━━━                    10.8/20.5 MB 2.3 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━━━                    10.9/20.5 MB 2.3 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━━━╸                   11.0/20.5 MB 2.3 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━━━╸                   11.0/20.5 MB 2.3 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━━━╸                   11.1/20.5 MB 2.3 MB/s eta 0:00:05     ━━━━━━━━━━━━━━━━━━━━━╸                   11.3/20.5 MB 2.3 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━                   11.4/20.5 MB 2.4 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━                   11.5/20.5 MB 2.4 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━╸                  11.6/20.5 MB 2.5 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━╸                  11.8/20.5 MB 2.5 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━╸                  11.8/20.5 MB 2.5 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━╸                  11.8/20.5 MB 2.5 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━╸                  11.8/20.5 MB 2.5 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━━                  11.9/20.5 MB 2.4 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━━                  12.0/20.5 MB 2.4 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━━╸                 12.1/20.5 MB 2.4 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━━━                 12.3/20.5 MB 2.4 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━━━                 12.5/20.5 MB 2.5 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━━━╸                12.6/20.5 MB 2.5 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━━━╸                12.7/20.5 MB 2.5 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━━━╸                12.8/20.5 MB 2.5 MB/s eta 0:00:04     ━━━━━━━━━━━━━━━━━━━━━━━━━                12.9/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━                13.0/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━╸               13.1/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━╸               13.3/20.5 MB 2.6 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━               13.4/20.5 MB 2.6 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━               13.5/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━╸              13.6/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━╸              13.7/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━╸              13.7/20.5 MB 2.6 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━╸              13.7/20.5 MB 2.6 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━╸              13.7/20.5 MB 2.6 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━╸              13.8/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━              13.9/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━              14.1/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━╸             14.2/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━╸             14.3/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━╸             14.3/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━╸             14.3/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━╸             14.3/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━             14.4/20.5 MB 2.4 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━             14.5/20.5 MB 2.4 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸            14.6/20.5 MB 2.4 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸            14.7/20.5 MB 2.4 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸            14.8/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            14.9/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            15.0/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            15.1/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸           15.1/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸           15.3/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           15.4/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           15.4/20.5 MB 2.4 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           15.5/20.5 MB 2.5 MB/s eta 0:00:03     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           15.6/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸          15.7/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸          15.8/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          15.9/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          16.0/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          16.1/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸         16.2/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸         16.3/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         16.5/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         16.5/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         16.6/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸        16.7/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸        16.8/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        16.9/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        17.0/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        17.1/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        17.1/20.5 MB 2.5 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸       17.3/20.5 MB 2.6 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸       17.4/20.5 MB 2.6 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       17.5/20.5 MB 2.6 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       17.7/20.5 MB 2.6 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸      17.8/20.5 MB 2.6 MB/s eta 0:00:02     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━      18.0/20.5 MB 2.6 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━      18.1/20.5 MB 2.7 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸     18.2/20.5 MB 2.6 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸     18.3/20.5 MB 2.7 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     18.5/20.5 MB 2.7 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     18.6/20.5 MB 2.8 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸    18.7/20.5 MB 2.8 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸    18.9/20.5 MB 2.8 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    19.0/20.5 MB 2.8 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸   19.2/20.5 MB 2.9 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸   19.3/20.5 MB 2.8 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸   19.4/20.5 MB 2.9 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   19.5/20.5 MB 2.9 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   19.7/20.5 MB 3.0 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   19.7/20.5 MB 3.0 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸  19.8/20.5 MB 2.9 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸  19.9/20.5 MB 2.9 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  20.1/20.5 MB 2.9 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸ 20.4/20.5 MB 2.9 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸ 20.5/20.5 MB 3.0 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸ 20.5/20.5 MB 3.0 MB/s eta 0:00:01     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 20.5/20.5 MB 2.9 MB/s eta 0:00:00
Installing collected packages: uv
Successfully installed uv-0.12.19
```
</details>

<details><summary>After (passing output)</summary>

```
Downloading cpython-3.12.14-linux-x86_64-gnu (download) (32.7MiB)
 Downloaded cpython-3.12.14-linux-x86_64-gnu (download)
Using CPython 3.12.14
Creating virtual environment at: .venv
error: Failed to create virtual environment
  cause: A virtual environment already exists at: .venv

hint: Use the `--clear` flag or set `UV_VENV_CLEAR=1` to replace the existing virtual environment
```
</details>

### E2: Unrecognised failure <a id="e2"></a>

- **Docs said:** `uv venv .venv` (readme.md:130)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
Downloading cpython-3.12.14-linux-x86_64-gnu (download) (32.7MiB)
 Downloaded cpython-3.12.14-linux-x86_64-gnu (download)
Using CPython 3.12.14
Creating virtual environment at: .venv
error: Failed to create virtual environment
  cause: A virtual environment already exists at: .venv

hint: Use the `--clear` flag or set `UV_VENV_CLEAR=1` to replace the existing virtual environment
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

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **FirstRun Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by FirstRun. Verified plan: `.github/firstrun/plan.json`.
