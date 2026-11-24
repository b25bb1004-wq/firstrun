# Verified setup for vargasjona/fastapi-alembic-sqlmodel-async

Verified by HUMBLE on 2026-09-27 at commit `96f10870e7` on a clean `python:3.11` machine. Clone to running took 0s.

Prerequisites: Python 3.11.

## Steps

1. `sudo apt-get install build-essential`
   - Kind: prereq
   - Expect: exits with code 0.
2. `sudo apt-get -y install make`
   - Kind: prereq
   - Expect: exits with code 0.
3. `make --version`
   - Kind: other
   - Expect: exits with code 0.
4. `python --version`
   - Kind: other
   - Expect: exits with code 0.
5. `poetry --version`
   - Kind: other
   - Expect: exits with code 0.
6. `cd backend/app/`
   - Kind: other
   - Expect: exits with code 0.
7. `poetry install`
   - Kind: install (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
8. `make init-db`
   - Kind: other
   - Expect: exits with code 0.
9. `make add-dev-migration`
   - Kind: migrate
   - Expect: exits with code 0.
10. `make run-test`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:15432/. Leave it running in its own terminal.
11. `make pytest`
   - Kind: other
   - Expect: exits with code 0.
12. `make mypy`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-5.sh: line 5: poetry: command not found` | `poetry` is not installed; the docs assume it is. | poetry |
