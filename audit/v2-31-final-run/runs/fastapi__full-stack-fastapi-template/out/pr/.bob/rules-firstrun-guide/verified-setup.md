# Verified setup for fastapi/full-stack-fastapi-template

Verified by HUMBLE on 2026-09-27 at commit `cb740b656d` on a clean `python:3.12` machine. Clone to running took 0s.

Prerequisites: Python 3.12, Docker (for backing services).

## Steps

1. `docker compose up -d db mailpit`
   - Kind: services
   - Expect: exits with code 0.
2. `uv sync`
   - Kind: install
   - Expect: exits with code 0.
3. `cd backend && uv run bash scripts/prestart.sh`
   - Kind: other (the README used to say `uv run bash scripts/prestart.sh`)
   - Expect: exits with code 0.
4. `bun install`
   - Kind: install
   - Expect: exits with code 0.
5. `uv run prek install -f`
   - Kind: other
   - Expect: exits with code 0.
6. `git commit`
   - Kind: other
   - Expect: exits with code 0.
7. `uv run prek run --all-files`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-1.sh: line 5: uv: command not found` | `uv` is not installed; the docs assume it is. | uv |
| `bash: scripts/prestart.sh: No such file or directory` | `uv run bash scripts/prestart.sh` must run inside `backend/` (the file is `backend/scripts/prestart.sh`), but the docs never say to change into that folder. | cd backend && uv run bash scripts/prestart.sh |
| `/firstrun/step-6.sh: line 5: bun: command not found` | `bun` is not installed; the docs assume it is. | bun |
