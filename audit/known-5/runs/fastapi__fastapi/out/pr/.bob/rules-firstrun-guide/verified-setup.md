# Verified setup for fastapi/fastapi

Verified by HUMBLE on 2026-09-26 at commit `192b12197e` on a clean `python:3.12` machine. Clone to running took 0s.

Prerequisites: Python 3.12.

## Steps

1. `uv run fastapi dev`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:8000/docs. Leave it running in its own terminal.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
