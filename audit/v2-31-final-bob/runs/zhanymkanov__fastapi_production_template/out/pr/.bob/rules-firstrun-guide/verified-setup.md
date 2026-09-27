# Verified setup for zhanymkanov/fastapi_production_template

Verified by HUMBLE on 2026-09-27 at commit `8e82353ff3` on a clean `python:3.12` machine. Clone to running took 140s.

Prerequisites: Python 3.12.

## Steps

1. `apt install just`
   - Kind: prereq
   - Expect: exits with code 0.
2. `pip install poetry`
   - Kind: install
   - Expect: exits with code 0.
3. `just up`
   - Kind: other
   - Expect: exits with code 0.
4. `cp .env.example .env`
   - Kind: env
   - Expect: exits with code 0.
5. `poetry install --no-root`
   - Kind: install (the README used to say `poetry install`)
   - Expect: exits with code 0.
6. `just run --log-config logging.ini`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:8000/ (HTTP 404). Leave it running in its own terminal.
7. `just migrate`
   - Kind: migrate
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `Error: The current project could not be installed: No file/folder found for package fastapi-template` | The dependencies installed, but current Poetry also installs the project itself, and this repo is an app, not a package. Older Poetry skipped that silently. | poetry install --no-root |
