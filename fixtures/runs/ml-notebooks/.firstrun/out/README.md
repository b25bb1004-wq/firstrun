# ML notebooks

Teaching notebooks for the applied ML course (CPU only).

> Setup verified by FirstRun at `3eba93b` in `python:3.11-slim-bookworm`: clone to running in 1m27s.

## Prerequisites

- Python 3.11

## Getting started

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python -m nbconvert --execute --to notebook notebooks/01-quickstart.ipynb
```

## License

MIT
