# Verified setup for GeekyAnts/express-typescript

Verified by FirstRun on 2026-09-25 at commit `6b9bb70e23` on a clean `node:22` machine. Clone to running took 69s.

Prerequisites: Node.js 22, Docker (for backing services).

## Steps

1. `npm install --legacy-peer-deps`
   - Kind: install (the README used to say `npm install`)
   - Expect: exits with code 0.
2. `npm install --global nodemon`
   - Kind: install (added by FirstRun: the README missed it)
   - Expect: exits with code 0.
3. `docker compose up -d mongo`
   - Kind: services (added by FirstRun: the README missed it)
   - Expect: exits with code 0.
4. `docker-compose up`
   - Kind: services
   - Expect: exits with code 0.
5. `docker-compose up -d`
   - Kind: services
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `npm error ERESOLVE unable to resolve dependency tree` | Current npm refuses the project's conflicting peer dependencies (older npm versions only warned); the lockfile resolves with --legacy-peer-deps. | npm install --legacy-peer-deps |
