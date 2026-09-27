# Verified setup for przemek-nowicki/node-express-template.ts

Verified by HUMBLE on 2026-09-27 at commit `d731e5cef4` on a clean `node:16` machine. Clone to running took 30s.

Prerequisites: Node.js 16, Docker (for backing services).

## Steps

1. `docker-compose up`
   - Kind: services
   - Expect: exits with code 0.
2. `npm install --no-save jest@27`
   - Kind: install (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
3. `export NODE_ENV=development`
   - Kind: env (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
4. `npm test`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `sh: 1: jest: not found` | The test script runs `jest`, but jest is not in package.json, so installing the project never installs it. It only works on machines that already have it. | npm install --save-dev jest@27 |
| `Test Suites: 5 failed, 1 passed, 6 total` | The app only accepts NODE_ENV = production \| integration \| development, but this step runs with another value (Jest sets NODE_ENV=test, and the config rejects that); the docs never say to set it. | export NODE_ENV=development |
