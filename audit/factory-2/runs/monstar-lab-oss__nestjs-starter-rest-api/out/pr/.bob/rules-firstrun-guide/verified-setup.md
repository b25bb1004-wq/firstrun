# Verified setup for monstar-lab-oss/nestjs-starter-rest-api

Verified by HUMBLE on 2026-09-27 at commit `6da20f9302` on a clean `node:22` machine. Clone to running took 79s.

Prerequisites: Node.js 22, Docker (for backing services).

## Steps

1. `npm install`
   - Kind: install
   - Expect: exits with code 0.
2. `docker compose up -d pgsqldb`
   - Kind: services (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
