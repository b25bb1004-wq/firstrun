# Verified setup for fastapi/full-stack-fastapi-template

Verified by FirstRun on 2026-09-25 at commit `cb740b656d` on a clean `python:3.12` machine. Clone to running took 0s.

Prerequisites: Python 3.12, Docker (for backing services).

## Steps

1. `docker compose up -d db mailpit`
   - Kind: services
   - Expect: exits with code 0.
2. `uv sync`
   - Kind: install
   - Expect: exits with code 0.
3. `bun install`
   - Kind: install
   - Expect: exits with code 0.
4. `bun run dev`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:8000/docs. Leave it running in its own terminal.
5. `bun run build`
   - Kind: build
   - Expect: exits with code 0.
6. `uv run prek install -f`
   - Kind: other
   - Expect: exits with code 0.
7. `git commit`
   - Kind: other
   - Expect: exits with code 0.
8. `uv run prek run --all-files`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-1.sh: line 4: uv: command not found` | `uv` is not installed; the docs assume it is. | uv |
