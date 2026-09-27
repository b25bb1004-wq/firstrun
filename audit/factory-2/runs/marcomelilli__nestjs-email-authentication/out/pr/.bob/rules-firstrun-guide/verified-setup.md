# Verified setup for marcomelilli/nestjs-email-authentication

Verified by HUMBLE on 2026-09-27 at commit `d8fbaadc1e` on a clean `node:22` machine. Clone to running took 24s.

Prerequisites: Node.js 22, Docker (for backing services).

## Steps

1. `npm install --legacy-peer-deps`
   - Kind: install (the README used to say `npm install`)
   - Expect: exits with code 0.
2. `docker compose up -d mongo`
   - Kind: services (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
3. `npm run start`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/ (HTTP 200). Leave it running in its own terminal.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `npm error ERESOLVE could not resolve` | Current npm refuses the project's conflicting peer dependencies (older npm versions only warned); the lockfile resolves with --legacy-peer-deps. | npm install --legacy-peer-deps |
| `[Nest] 238  - 09/27/2026, 12:21:23 PM   ERROR [MongooseModule] Unable to connect to the database. Retrying (4)...` | The app connects to MongoDB on localhost:27017, but the docs never start it. | docker compose up -d mongo |
