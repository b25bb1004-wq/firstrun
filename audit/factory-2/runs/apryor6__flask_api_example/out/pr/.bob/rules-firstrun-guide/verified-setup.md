# Verified setup for apryor6/flask_api_example

Verified by HUMBLE on 2026-09-27 at commit `744239535f` on a clean `python:3.7` machine. Clone to running took 0s.

Prerequisites: Python 3.7.

## Steps

1. `pip install -r requirements.txt`
   - Kind: install (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
2. `python wsgi.py`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/. Leave it running in its own terminal.
3. `pip install pytest`
   - Kind: install
   - Expect: exits with code 0.
4. `pytest`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
