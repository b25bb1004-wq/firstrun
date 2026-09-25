# Verified setup for wagtail/bakerydemo

Verified by FirstRun on 2026-09-25 at commit `c8f8255593` on a clean `python:3.10` machine. Clone to running took 0s.

Prerequisites: Python 3.10.

## Steps

1. `vagrant ssh`
   - Kind: other
   - Expect: exits with code 0.
2. `./manage.py runserver 0.0.0.0:8000`
   - Kind: other
   - Expect: exits with code 0.
3. `python -m venv .venv`
   - Kind: install
   - Expect: exits with code 0.
4. `uv venv .venv`
   - Kind: install
   - Expect: exits with code 0.
5. `source .venv/bin/activate`
   - Kind: install
   - Expect: exits with code 0.
6. `cd ~/dev [or your preferred dev directory]`
   - Kind: other
   - Expect: exits with code 0.
7. `pip install -r requirements/development.txt`
   - Kind: install
   - Expect: exits with code 0.
8. `uv pip install -r requirements/development.txt`
   - Kind: install
   - Expect: exits with code 0.
9. `cp bakerydemo/settings/local.py.example bakerydemo/settings/local.py`
   - Kind: other
   - Expect: exits with code 0.
10. `cp .env.example .env`
   - Kind: env
   - Expect: exits with code 0.
11. `./manage.py migrate`
   - Kind: migrate
   - Expect: exits with code 0.
12. `./manage.py load_initial_data`
   - Kind: other
   - Expect: exits with code 0.
13. `./manage.py runserver`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
