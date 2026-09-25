# Verified setup for teamhide/fastapi-boilerplate

Verified by FirstRun on 2026-09-25 at commit `df4e6d4f81` on a clean `python:3.11.7` machine. Clone to running took 261s.

Prerequisites: Python 3.11.7, Docker (for backing services).

## Steps

1. `poetry install --no-root`
   - Kind: install (the README used to say `poetry install`)
   - Expect: exits with code 0.
2. `source "$(poetry env info --path)/bin/activate"`
   - Kind: env
   - Expect: exits with code 0.
3. `docker run -d --name mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=fastapi -e MYSQL_USER=fastapi -e MYSQL_PASSWORD=fastapi mysql:8`
   - Kind: services (added by FirstRun: the README missed it)
   - Expect: exits with code 0.
4. `alembic upgrade head`
   - Kind: migrate
   - Expect: exits with code 0.
5. `python3 main.py --env local --debug`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:8000/ (HTTP 404). Leave it running in its own terminal.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-1.sh: line 4: poetry: command not found` | `poetry` is not installed; the docs assume it is. | poetry |
| `` | Python 3.12 (the docs name no version, so a newcomer installs the current release) is too new: the project needs Python 3.11.7 (pyproject.toml poetry python ("3.11.7")). | Python 3.11.7 (see pyproject.toml poetry python ("3.11.7")) |
| `Error: The current project could not be installed: No file/folder found for package fastapi-boilerplate` | The dependencies installed, but current Poetry also installs the project itself, and this repo is an app, not a package. Older Poetry skipped that silently. | poetry install --no-root |
| `sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (2003, "Can't connect to MySQL server on 'localhost' ([Errno 111] Connection refused)")` | The app connects to MySQL on localhost:3306, but the docs never start it. | docker run -d --name mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=fastapi -e MYSQL_USER=fastapi -e MYSQL_PASSWORD=fastapi mysql:8 |
