# Ledger API

Double-entry ledger service with a FastAPI front end.

> Setup verified by FirstRun at `8bc11e9` in `python:3.11-slim-bookworm`: clone to running in 1m27s.

## Prerequisites

- Python 3.11+ (pyproject.toml requires >=3.11)
- libpq headers (Debian/Ubuntu: `sudo apt-get install libpq-dev`; macOS: `brew install libpq`)

## Getting started

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -e .
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn ledger.main:app --port 8000
pytest -q
```

## License

MIT
