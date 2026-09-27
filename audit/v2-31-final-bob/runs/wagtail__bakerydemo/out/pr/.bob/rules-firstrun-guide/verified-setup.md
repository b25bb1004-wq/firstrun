# Verified setup for wagtail/bakerydemo

Verified by HUMBLE on 2026-09-27 at commit `c8f8255593+dirty` on a clean `python:3.12` machine. Clone to running took 267s.

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
6. `python manage.py migrate`
   - Kind: migrate (the README used to say `./manage.py migrate`)
   - Expect: exits with code 0.
7. `python manage.py load_initial_data`
   - Kind: other (the README used to say `./manage.py load_initial_data`)
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `ERROR: No matching distribution found for Django<6.1,>=6.0` | The README's Python 3.10 is too old: the project needs Python 3.12 (.python-version). | Python 3.12 (see .python-version) |
| `` | manage.py (line 1) has a shebang but the file lacks the executable permission bit in the clone, so ./manage.py fails with exit code 126 (Permission denied); readme.md:168 documents ./manage.py migrate without any chmod prerequisite. | Replace `./manage.py migrate` (and all subsequent `./manage.py` calls in the venv setup section) with `python manage.py migrate` so the command works even when the executable bit is not set on the cloned file. |
| `` | `manage.py` exists at the repo root with a valid shebang (`#!/usr/bin/env python`, line 1) but is not marked executable in the repository, so `./manage.py` fails with exit code 126 on Linux. | Replace `./manage.py load_initial_data` with `python manage.py load_initial_data` (and likewise `./manage.py runserver` → `python manage.py runserver`) so the command works regardless of whether the executable bit is set. |
