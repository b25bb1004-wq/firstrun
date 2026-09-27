# Verified setup for jpadilla/django-project-template

Verified by HUMBLE on 2026-09-27 at commit `7d442e2bfb` on a clean `python:3.12` machine. Clone to running took 2s.

Prerequisites: Python 3.12.

## Steps

1. `mv example.env .env`
   - Kind: env
   - Expect: exits with code 0.
2. `pipenv install --dev`
   - Kind: install
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
