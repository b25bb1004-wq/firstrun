# Quill Notes API

A tiny self-hosted notes API. Store short notes in a local SQLite file and read
them back over HTTP. Good for scripts, home-lab dashboards, and quick prototypes.

## Features

- Create, list, fetch, and delete notes
- SQLite storage, zero external services
- Bearer-token protection for writes
- Interactive API docs at `/docs`

## Endpoints

| Method | Path          | Auth   | Description        |
| ------ | ------------- | ------ | ------------------ |
| GET    | `/health`     | —      | Service status     |
| GET    | `/notes`      | —      | List recent notes  |
| GET    | `/notes/{id}` | —      | Fetch one note     |
| POST   | `/notes`      | Bearer | Create a note      |
| DELETE | `/notes/{id}` | Bearer | Delete a note      |

## Quick start

### Requirements

- Python 3.8+

### Install

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
```

### Configure

```bash
cp .env.example .env
```

By default notes are stored in `notes.db` in the project directory. Set
`NOTES_DB_PATH` in `.env` to put it somewhere else.

### Run

```bash
python app.py
```

The API is now available at http://localhost:8000. Check it with:

```bash
curl http://localhost:8000/health
```

## Running the tests

```bash
pytest
```

## License

MIT
