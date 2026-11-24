# Verified setup for wagtail/bakerydemo

Verified by FirstRun on 2026-09-25 at commit `c8f8255593` on a clean `python:3.10` machine. Clone to running took 0s.

Prerequisites: Python 3.10.

## Steps

1. `python -m venv .venv`
   - Kind: install
   - Expect: exits with code 0.
2. `source .venv/bin/activate`
   - Kind: install
   - Expect: exits with code 0.
3. `cd ~/dev [or your preferred dev directory]`
   - Kind: other
   - Expect: exits with code 0.
4. `pip install -r requirements/development.txt`
   - Kind: install
   - Expect: exits with code 0.
5. `uv pip install -r requirements/development.txt`
   - Kind: install
   - Expect: exits with code 0.
6. `cp bakerydemo/settings/local.py.example bakerydemo/settings/local.py`
   - Kind: other
   - Expect: exits with code 0.
7. `cp .env.example .env`
   - Kind: env
   - Expect: exits with code 0.
8. `./manage.py migrate`
   - Kind: migrate
   - Expect: exits with code 0.
9. `./manage.py load_initial_data`
   - Kind: other
   - Expect: exits with code 0.
10. `./manage.py runserver`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
