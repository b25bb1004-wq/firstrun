# Verified setup for acme-shop

Verified by FirstRun on 2026-09-24 at commit `c0661ce19b` on a clean `node:20` machine. Clone to running took 14s.

Prerequisites: Node.js 20, Docker (for backing services).

## Steps

1. `npm install`
   - Kind: install
   - Expect: exits with code 0.
2. `cp .env.example .env`
   - Kind: env (the README used to say `cp .env.sample .env`)
   - Expect: exits with code 0.
3. `docker compose up -d`
   - Kind: services
   - Expect: exits with code 0.
4. `npm run db:migrate`
   - Kind: migrate (the README used to say `npm run migrate`)
   - Expect: exits with code 0.
5. `npm run db:seed`
   - Kind: migrate
   - Expect: exits with code 0.
6. `npm run dev`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/health (HTTP 200). Leave it running in its own terminal.
7. `npm test`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `npm ERR! engine Unsupported engine` | The README's Node.js 16 is too old: the project needs Node.js 20 (.nvmrc). | Node.js 20 (see .nvmrc) |
| `cp: cannot stat '.env.sample': No such file or directory` | .env.sample does not exist; the repo ships .env.example. | cp .env.example .env |
| `npm error Missing script: "migrate"` | The script "migrate" no longer exists; package.json has "db:migrate" (node scripts/migrate.js). | npm run db:migrate |
| `Error: Missing required environment variable SESSION_SECRET` | The app requires SESSION_SECRET at startup, but the docs never mention it and .env.example is missing it. | .env.example now includes SESSION_SECRET (required at startup). |
| `socketError: Error: connect ECONNREFUSED 127.0.0.1:6379` | The app connects to Redis on localhost:6379, but the docs never start it and docker-compose.yml doesn't define it. | docker-compose.yml now also starts Redis; `docker compose up -d` brings up everything the app needs. |
