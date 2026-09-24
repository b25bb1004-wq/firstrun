# Demo repos: answer key

These are the expected breaks in `examples/acme-shop` and `examples/notes-api-py`.
Every error line below was copied from real Docker runs on 2026-09-25 (Docker
Desktop, Windows 11 host). The repos themselves never mention FirstRun or the
planted drift. Keep this file outside the example dirs.

Test harness used: the repo was copied into `/app` inside the container. For
acme-shop, postgres and redis ran with `--network container:<app>`, so
`localhost:5432` and `localhost:6379` work as they would with the README's
`docker compose up -d` on a laptop.

---

## acme-shop (Node 20 / Express / Postgres / Redis)

Truth: `.nvmrc` = 20, `engines.node` = `>=20`, `.npmrc` `engine-strict=true`,
express `^5.1.0` (itself needs node >= 18), scripts `dev` `start` `db:migrate`
`db:seed` `test`. The compose file has **postgres only**. `.env.example` has
`DATABASE_URL` and `PORT` only.

| # | README line (README.md) | What happens | Correct fix | Diagnosis class |
|---|---|---|---|---|
| 1 | `- Node.js 16+` (Prerequisites, L28) → `npm install` (L38) | node:16 → `npm ERR! code EBADENGINE`. node:18 → `npm error code EBADENGINE` too | Use Node 20 (`.nvmrc`); rebase to `node:20-bookworm` | `runtime-version` |
| 2 | `cp .env.sample .env` (L44) | `cp: cannot stat '.env.sample': No such file or directory` (exit 1) | `cp .env.example .env` | `missing-file` |
| 3 | `docker compose up -d` (L50); Redis never mentioned | Compose starts postgres only. Later `npm start`/`npm run dev` fails: `Failed to start acme-shop: ReconnectStrategyError: connect ECONNREFUSED 127.0.0.1:6379` | Add a Redis service (`redis:7-alpine`, port 6379) and a `REDIS_URL=redis://localhost:6379` line in `.env.example` | `missing-service` |
| 4 | `npm run migrate` (L56) | `npm error Missing script: "migrate"` (exit 1) | `npm run db:migrate` | `missing-script` |
| 5 | SESSION_SECRET never mentioned | First surfaces at **`npm run db:migrate`**, not at server start, because `src/db.js` loads `src/config.js`: `Error: Missing required environment variable SESSION_SECRET` (exit 1) | Add `SESSION_SECRET=<random>` to `.env` and `.env.example` | `missing-env` (arguably `needs-secret`; any random value works, so `missing-env` fits) |
| 6 | `npm run dev` (L63) then open `/health` (L66) | With no Redis: same ECONNREFUSED error as #3. **`node --watch` does not exit**; it prints `Failed running 'src/server.js'` and waits for file changes. Nothing listens on 3000: `curl: (7) Failed to connect to localhost port 3000 after 0 ms: Couldn't connect to server` | Fixed by #3 | `missing-service` (follow-on) |
| 7 | `npm test` (L74) | With no Redis: exit 1, `not ok 1 - GET /health reports db and redis up` / `error: 'connect ECONNREFUSED 127.0.0.1:6379'`, `# pass 0` `# fail 4` | Fixed by #3 | `missing-service` (follow-on) |

`npm run db:seed` works as written once #4 and #5 are fixed.

### Exact error blocks

**#1, node:16-bookworm-slim (npm 8.19.4):**
```
npm ERR! code EBADENGINE
npm ERR! engine Unsupported engine
npm ERR! engine Not compatible with your version of node/npm: acme-shop@1.4.0
npm ERR! notsup Not compatible with your version of node/npm: acme-shop@1.4.0
npm ERR! notsup Required: {"node":">=20"}
npm ERR! notsup Actual:   {"npm":"8.19.4","node":"v16.20.2"}
```
**#1, node:18-bookworm-slim (npm 10.8.2):**
```
npm error code EBADENGINE
npm error engine Unsupported engine
npm error engine Not compatible with your version of node/npm: acme-shop@1.4.0
npm error notsup Not compatible with your version of node/npm: acme-shop@1.4.0
npm error notsup Required: {"node":">=20"}
npm error notsup Actual:   {"npm":"10.8.2","node":"v18.20.8"}
```
**Runtime check on Node 18.** If a fix gets around engine-strict (for example `npm install --engine-strict=false`), the server still fails when it boots on Node 18:
```
TypeError: process.loadEnvFile is not a function
    at Object.<anonymous> (/app/src/config.js:5:11)
```
So `--engine-strict=false` is a trap. The real fix is to rebase to Node 20.

**#2:**
```
cp: cannot stat '.env.sample': No such file or directory
```
**#4 (npm 10):**
```
npm error Missing script: "migrate"
npm error
npm error To see a list of scripts, run:
npm error   npm run
```
**`npm run db:migrate` with no `.env` at all (#2 not fixed):**
```
Error: Missing required environment variable DATABASE_URL
    at required (/app/src/config.js:13:11)
```
**#5:**
```
/app/src/config.js:13
    throw new Error(`Missing required environment variable ${name}`);
    ^

Error: Missing required environment variable SESSION_SECRET
    at required (/app/src/config.js:13:11)
    at Object.<anonymous> (/app/src/config.js:22:18)
```
**#3 / #6, `npm start` or `npm run dev` without Redis.** The client retries 3 times, about 1.2s in total, then gives up:
```
Failed to start acme-shop: ReconnectStrategyError: connect ECONNREFUSED 127.0.0.1:6379
    at RedisSocket._RedisSocket_shouldReconnect (/app/node_modules/@redis/client/dist/lib/client/socket.js:140:16)
  ...
  originalError: Error: connect ECONNREFUSED 127.0.0.1:6379
      ...
    code: 'ECONNREFUSED',
    syscall: 'connect',
    address: '127.0.0.1',
    port: 6379
```
`npm start` exits 1. `npm run dev` adds `Failed running 'src/server.js'` and keeps running, so the Runner must detect this from the log and not wait for the process to exit.

### Verified correct sequence (image `node:20-bookworm`, Node v20.20.2, npm 10.8.2)

```bash
npm install
cp .env.example .env
echo "SESSION_SECRET=$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')" >> .env
echo "REDIS_URL=redis://localhost:6379" >> .env          # optional, this is the default
# services: postgres:16-alpine (POSTGRES_USER/PASSWORD/DB = acme) on 5432, redis:7-alpine on 6379
npm run db:migrate      # applied 001_create_products.sql / applied 002_add_product_stock.sql / migrations up to date
npm run db:seed         # seeded 5 products
npm run dev             # acme-shop listening on http://localhost:3000   (serve; readyPattern "listening on")
curl -sf http://localhost:3000/health   # {"status":"ok","db":"up","redis":"up","uptime":0}
npm test                # # tests 4 / # pass 4 / # fail 0
```
Timing: **4.6 s** inside the container from `npm install` to tests passing, with a cold npm cache (`added 92 packages in 3s`). That includes waiting for postgres to accept connections. Wall clock from `docker run` to finish was **5 s** with images already pulled.

`node:20-bookworm` includes curl. `node:20-bookworm-slim` does **not**.

---

## notes-api-py (Python 3.12 / FastAPI / SQLite)

Truth: `.python-version` = 3.12, `requires-python = ">=3.11"`. The code uses
`typing.Self` and `datetime.UTC`, both new in 3.11. The dev requirements file is
`requirements-dev.txt` at the repo root. The app is started with
`uvicorn notes_api.main:app --port 8000`, and `app.py` does not exist.
`NOTES_API_TOKEN` is required. `.env.example` has only `NOTES_DB_PATH` and
`NOTES_PAGE_SIZE`. The app reads `.env` from the working directory itself.

| # | README line (README.md) | What happens | Correct fix | Diagnosis class |
|---|---|---|---|---|
| 1 | `- Python 3.8+` (Requirements, L27) | On python:3.8, `pip install -r requirements-dev.txt` **succeeds** because the pins support 3.8. The failure comes at import: `ImportError: cannot import name 'Self' from 'typing' (/usr/local/lib/python3.8/typing.py)` (in uvicorn and in pytest collection) | Python 3.12 (`.python-version`); rebase to `python:3.12-slim-bookworm` | `runtime-version` |
| 2 | `pip install -r requirements/dev.txt` (L34) | `ERROR: Could not open requirements file: [Errno 2] No such file or directory: 'requirements/dev.txt'` (exit 1) | `pip install -r requirements-dev.txt` | `missing-file` |
| 3 | NOTES_API_TOKEN never mentioned | `RuntimeError: Missing required environment variable NOTES_API_TOKEN` at import time, for both uvicorn and pytest | Add `NOTES_API_TOKEN=<random>` to `.env` and `.env.example` | `missing-env` |
| 4 | `python app.py` (L49) | 3.12: `python: can't open file '/app/app.py': [Errno 2] No such file or directory` (exit 2). 3.8 prints `python: can't open file 'app.py': ...` | `uvicorn notes_api.main:app --port 8000` | `missing-file` (fix = `replace-step`) |
| 5 | `pytest` (L61) | Without the token: `E   RuntimeError: Missing required environment variable NOTES_API_TOKEN` / `ERROR tests/test_api.py - RuntimeError: Missing required environment variable...` / `Interrupted: 1 error during collection` | Fixed by #3 | `missing-env` (follow-on) |

`cp .env.example .env` works as written.

### Incidental breaks (not planted, but the Runner will hit them)

- `source .venv/bin/activate` (L33): `/bin/sh` in python:3.12-slim is dash, and running it with `sh -c` gives `sh: 1: source: not found` (exit 127). With `bash -c` it works. Venv activation also does not carry over between separate step shells. Suggested fix: run steps in bash, or skip the venv in the sandbox, or replace the step with `. .venv/bin/activate` and chain it.
- `curl http://localhost:8000/health` (L55): python:3.12-slim-bookworm has **no curl**, giving `bash: line 1: curl: command not found` (exit 127). Class `missing-tool`. Fix: `apt-get install -y curl`, or check with `python -c "import urllib.request; ..."`.
- On 3.8, uvicorn prints its own startup banner, then the ImportError. The process exits non-zero.

### Exact error blocks

**#2:**
```
ERROR: Could not open requirements file: [Errno 2] No such file or directory: 'requirements/dev.txt'
```
**#4:**
```
python: can't open file '/app/app.py': [Errno 2] No such file or directory
```
**#3 (uvicorn):**
```
  File "/app/notes_api/main.py", line 14, in <module>
    settings = Settings.from_env()
               ^^^^^^^^^^^^^^^^^^^
  File "/app/notes_api/config.py", line 35, in from_env
    raise RuntimeError("Missing required environment variable NOTES_API_TOKEN")
RuntimeError: Missing required environment variable NOTES_API_TOKEN
```
**#1 (python:3.8):**
```
  File "/app/notes_api/config.py", line 8, in <module>
    from typing import Self
ImportError: cannot import name 'Self' from 'typing' (/usr/local/lib/python3.8/typing.py)
```

### Verified correct sequence (image `python:3.12-slim-bookworm`, Python 3.12.14)

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
echo "NOTES_API_TOKEN=$(python -c 'import secrets;print(secrets.token_hex(16))')" >> .env
uvicorn notes_api.main:app --port 8000     # serve; readyPattern "Application startup complete" / "Uvicorn running on"
python -c "import urllib.request;print(urllib.request.urlopen('http://localhost:8000/health').read().decode())"
#   {"status":"ok","db":"up","version":"0.6.2"}
pytest -q                                   # 5 passed in 0.33s
```
Timing: **23.0 s** inside the container, almost all of it `pip install` with a cold cache. Wall clock was **24 s** including container start.

---

## Diagnosis coverage summary

| Class | acme-shop | notes-api-py |
|---|---|---|
| runtime-version | #1 (EBADENGINE) | #1 (ImportError Self on 3.8) |
| missing-file | #2 (.env.sample) | #2 (requirements/dev.txt), #4 (app.py) |
| missing-service | #3 (Redis) | none |
| missing-script | #4 (migrate) | none |
| missing-env | #5 (SESSION_SECRET) | #3 (NOTES_API_TOKEN) |
| missing-tool | curl only if the slim image is used | curl in the slim image (incidental) |
