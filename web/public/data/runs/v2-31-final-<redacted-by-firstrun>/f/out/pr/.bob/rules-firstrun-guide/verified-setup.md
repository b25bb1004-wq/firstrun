# Verified setup for wagtail/bakerydemo

Verified by HUMBLE on 2026-09-27 at commit `c8f8255593` on a clean `python:3.12` machine. Clone to running took 0s.

Prerequisites: Python 3.12.

## Steps

1. `python -m venv .venv`
   - Kind: install
   - Expect: exits with code 0.
2. `source .venv/bin/activate`
   - Kind: install
   - Expect: exits with code 0.
3. `pip install -r requirements/development.txt`
   - Kind: install
   - Expect: exits with code 0.
4. `cp bakerydemo/settings/local.py.example bakerydemo/settings/local.py`
   - Kind: other
   - Expect: exits with code 0.
5. `cp .env.example .env`
   - Kind: env
   - Expect: exits with code 0.
6. `./manage.py load_initial_data`
   - Kind: other
   - Expect: exits with code 0.
7. `./manage.py runserver`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `ERROR: No matching distribution found for Django<6.1,>=6.0` | The README's Python 3.10 is too old: the project needs Python 3.12 (.python-version). | Python 3.12 (see .python-version) |
