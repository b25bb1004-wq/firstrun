# Verified setup for vargasjona/fastapi-alembic-sqlmodel-async

Verified by FirstRun on 2026-09-25 at commit `96f10870e7` on a clean `python:3.10` machine. Clone to running took 0s.

Prerequisites: Python 3.10.

## Steps

1. `sudo apt-get -y install make`
   - Kind: prereq
   - Expect: exits with code 0.
2. `make --version`
   - Kind: other
   - Expect: exits with code 0.
3. `python --version`
   - Kind: other
   - Expect: exits with code 0.
4. `poetry --version`
   - Kind: other
   - Expect: exits with code 0.
5. `cd backend/app/`
   - Kind: other
   - Expect: exits with code 0.
6. `source "$(poetry env info --path)/bin/activate"`
   - Kind: env
   - Expect: exits with code 0.
7. `make init-db`
   - Kind: other
   - Expect: exits with code 0.
8. `make add-dev-migration`
   - Kind: migrate
   - Expect: exits with code 0.
9. `sonar.organization=my_organization`
   - Kind: other
   - Expect: exits with code 0.
10. `sonar.projectKey=fastapi-alembic-sqlmodel-async`
   - Kind: other
   - Expect: exits with code 0.
11. `sonar.host.url=http://host.docker.internal:9000`
   - Kind: other
   - Expect: exits with code 0.
12. `sonar.login=157cc42f5b2702f470af3466610eebf38551fdd7`
   - Kind: other
   - Expect: exits with code 0.
13. `sonar.projectName=fastapi-alembic-sqlmodel-async`
   - Kind: other
   - Expect: exits with code 0.
14. `sonar.projectVersion=1.0`
   - Kind: other
   - Expect: exits with code 0.
15. `sonar.sources=app`
   - Kind: other
   - Expect: exits with code 0.
16. `sonar.sourceEncoding=UTF-8`
   - Kind: other
   - Expect: exits with code 0.
17. `make run-test`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:15432/. Leave it running in its own terminal.
18. `make pytest`
   - Kind: other
   - Expect: exits with code 0.
19. `make mypy`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
