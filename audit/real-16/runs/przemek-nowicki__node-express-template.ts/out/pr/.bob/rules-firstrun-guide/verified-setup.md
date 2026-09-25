# Verified setup for przemek-nowicki/node-express-template.ts

Verified by FirstRun on 2026-09-24 at commit `d731e5cef4` on a clean `node:16` machine. Clone to running took 60s.

Prerequisites: Node.js 16, Docker (for backing services).

## Steps

1. `docker-compose up`
   - Kind: services
   - Expect: exits with code 0.
2. `npm install`
   - Kind: install (added by FirstRun: the README missed it)
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
