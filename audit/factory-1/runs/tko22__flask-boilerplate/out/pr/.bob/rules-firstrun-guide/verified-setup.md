# Verified setup for tko22/flask-boilerplate

Verified by HUMBLE on 2026-09-27 at commit `8be8976481` on a clean `python:3.6` machine. Clone to running took 3s.

Prerequisites: Python 3.6.

## Steps

1. `pip3 install virtualenv`
   - Kind: install
   - Expect: exits with code 0.
2. `virtualenv venv`
   - Kind: install
   - Expect: exits with code 0.
3. `source venv/bin/activate`
   - Kind: install
   - Expect: exits with code 0.
4. `make recreate_db`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
