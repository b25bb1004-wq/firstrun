# Verified setup for zhanymkanov/fastapi_production_template

Verified by FirstRun on 2026-09-24 at commit `8e82353ff3` on a clean `python:3.12` machine. Clone to running took 0s.

Prerequisites: Python 3.12.

## Steps

1. `curl --proto =https --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin`
   - Kind: prereq (the README used to say `apt install just`)
   - Expect: exits with code 0.
2. `pip install poetry`
   - Kind: install
   - Expect: exits with code 0.
3. `just run`
   - Kind: other
   - Expect: exits with code 0.
4. `just run --log-config logging.ini`
   - Kind: other
   - Expect: exits with code 0.
5. `just migrate`
   - Kind: migrate
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `Error: Unable to locate package just` | Debian/Ubuntu's apt has no "just" package on a current stable release; the docs' Linux instructions don't work as written. | curl --proto =https --tlsv1.2 -sSf https://just.systems/install.sh \| bash -s -- --to /usr/local/bin |
