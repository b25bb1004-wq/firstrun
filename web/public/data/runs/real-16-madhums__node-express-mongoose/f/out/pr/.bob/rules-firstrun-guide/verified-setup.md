# Verified setup for madhums/node-express-mongoose

Verified by FirstRun on 2026-09-24 at commit `86e569617f` on a clean `node:22` machine. Clone to running took 0s.

Prerequisites: Node.js 22, Docker (for backing services).

## Steps

1. `npm i`
   - Kind: install
   - Expect: exits with code 0.
2. `cp .env.example .env`
   - Kind: env
   - Expect: exits with code 0.
3. `docker-compose up -d`
   - Kind: services
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
