# FirstRun report: northwind/ledger-api

Verdict: **VERIFIED** at `8bc11e9` in `python:3.11-slim-bookworm`.

Clone to running from zero: 1m27s.

## Repairs

- E1 (S2) runtime-version: pyproject.toml requires Python >=3.11 but the README asks for 3.9+. (verified, diagnosed by rules)
- E2 (S3) missing-dependency: psycopg2 builds from source and needs pg_config from the libpq headers. (verified, diagnosed by rules)
