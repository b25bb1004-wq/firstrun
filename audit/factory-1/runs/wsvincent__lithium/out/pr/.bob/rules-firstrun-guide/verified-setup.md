# Verified setup for wsvincent/lithium

Verified by HUMBLE on 2026-09-27 at commit `14c0374eaa` on a clean `python:3.13` machine. Clone to running took 363s.

Prerequisites: Python 3.13.

## Steps

1. `uv sync`
   - Kind: install
   - Expect: exits with code 0.
2. `uv run manage.py migrate`
   - Kind: migrate
   - Expect: exits with code 0.
3. `uv run manage.py createsuperuser`
   - Kind: other
   - Expect: exits with code 0.
4. `uv run manage.py runserver`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-1.sh: line 5: uv: command not found` | `uv` is not installed; the docs assume it is. | uv |
