# Verified setup for fastapi/fastapi

Verified by HUMBLE on 2026-09-27 at commit `192b12197e` on a clean `python:3.12` machine. Clone to running took 446s.

Prerequisites: Python 3.12.

## Steps

1. `uv sync --no-dev --group tests --extra all`
   - Kind: install
   - Expect: exits with code 0.
2. `mkdir coverage`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-1.sh: line 5: uv: command not found` | `uv` is not installed; the docs assume it is. | uv |
