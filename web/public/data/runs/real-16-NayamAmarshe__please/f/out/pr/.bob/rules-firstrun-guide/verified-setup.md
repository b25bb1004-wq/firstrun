# Verified setup for NayamAmarshe/please

Verified by FirstRun on 2026-09-24 at commit `10e94b3e7e` on a clean `python:3.12` machine. Clone to running took 0s.

Prerequisites: Python 3.12.

## Steps

1. `pip install please-cli`
   - Kind: install
   - Expect: exits with code 0.
2. `echo 'please' >> ~/.bashrc`
   - Kind: other
   - Expect: exits with code 0.
3. `echo 'please' >> ~/.zshrc`
   - Kind: other
   - Expect: exits with code 0.
4. `set fish_greeting please`
   - Kind: other
   - Expect: exits with code 0.
5. `echo 'please daily' >> ~/.bashrc`
   - Kind: other
   - Expect: exits with code 0.
6. `echo 'please daily' >> ~/.zshrc`
   - Kind: other
   - Expect: exits with code 0.
7. `set fish_greeting please daily`
   - Kind: other
   - Expect: exits with code 0.
8. `echo 'please' >> ~/.bashrc`
   - Kind: other
   - Expect: exits with code 0.
9. `echo 'please' >> ~/.zshrc`
   - Kind: other
   - Expect: exits with code 0.
10. `set fish_greeting please`
   - Kind: other
   - Expect: exits with code 0.
11. `curl -sSL https://install.python-poetry.org | python3 -`
   - Kind: other
   - Expect: exits with code 0.
12. `. "$(dirname $(poetry run which python))/activate"`
   - Kind: other
   - Expect: exits with code 0.
13. `poetry install`
   - Kind: install
   - Expect: exits with code 0.
14. `source "$(poetry env info --path)/bin/activate"`
   - Kind: env
   - Expect: exits with code 0.
15. `python please/please.py`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/. Leave it running in its own terminal.
16. `poetry build`
   - Kind: other
   - Expect: exits with code 0.
17. `pip uninstall please-cli`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
