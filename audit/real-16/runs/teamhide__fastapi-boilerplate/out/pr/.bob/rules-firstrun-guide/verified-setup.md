# Verified setup for teamhide/fastapi-boilerplate

Verified by FirstRun on 2026-09-24 at commit `df4e6d4f81` on a clean `python:3.11` machine. Clone to running took 0s.

Prerequisites: Python 3.11.

## Steps

1. `source "$(poetry env info --path)/bin/activate"`
   - Kind: env
   - Expect: exits with code 0.
2. `alembic upgrade head`
   - Kind: migrate
   - Expect: exits with code 0.
3. `python3 main.py --env local --debug`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/. Leave it running in its own terminal.
4. `make test`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
