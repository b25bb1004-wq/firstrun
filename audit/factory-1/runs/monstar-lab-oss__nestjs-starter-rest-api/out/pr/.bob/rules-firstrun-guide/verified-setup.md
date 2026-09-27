# Verified setup for monstar-lab-oss/nestjs-starter-rest-api

Verified by HUMBLE on 2026-09-27 at commit `6da20f9302` on a clean `node:22` machine. Clone to running took 55s.

Prerequisites: Node.js 22.

## Steps

1. `npm install`
   - Kind: install
   - Expect: exits with code 0.
2. `npm run test`
   - Kind: test
   - Expect: exits with code 0.
3. `cp .env.template .env`
   - Kind: env (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
