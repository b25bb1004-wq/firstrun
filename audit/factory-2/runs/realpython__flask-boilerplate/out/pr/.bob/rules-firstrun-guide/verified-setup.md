# Verified setup for realpython/flask-boilerplate

Verified by HUMBLE on 2026-09-27 at commit `488e33624b` on a clean `python:3.12` machine. Clone to running took 266s.

Prerequisites: Python 3.12.

## Steps

1. `pip install -r requirements.txt`
   - Kind: install
   - Expect: exits with code 0.
2. `pip install uv setuptools wheel && uv pip install --system --no-build-isolation --exclude-newer 2018-01-05 -r _updated/config/development/requirements.txt`
   - Kind: install (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
