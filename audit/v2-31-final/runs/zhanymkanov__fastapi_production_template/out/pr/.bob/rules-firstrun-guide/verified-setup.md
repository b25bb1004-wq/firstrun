# Verified setup for zhanymkanov/fastapi_production_template

Verified by HUMBLE on 2026-09-26 at commit `8e82353ff3` on a clean `python:3.12` machine. Clone to running took 0s.

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
4. `poetry install --no-root`
   - Kind: install (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
5. `cp .env.example .env`
   - Kind: env (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
6. `just run`
   - Kind: other
   - Expect: exits with code 0.
7. `just run --log-config logging.ini`
   - Kind: other
   - Expect: exits with code 0.
8. `just migrate`
   - Kind: migrate
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `Command not found: uvicorn` | `poetry run uvicorn` can't find uvicorn: the project's dependencies were never installed, because the docs skip `poetry install`. | poetry install |
| `pydantic_core._pydantic_core.ValidationError: 2 validation errors for Config` | The app requires DATABASE_URL, DATABASE_ASYNC_URL from .env.example, but the docs never say to create .env from it. | cp .env.example .env |
