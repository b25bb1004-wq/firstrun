# Verified setup for marcomelilli/nestjs-email-authentication

Verified by HUMBLE on 2026-09-27 at commit `d8fbaadc1e` on a clean `node:22` machine. Clone to running took 25s.

Prerequisites: Node.js 22.

## Steps

1. `npm install --legacy-peer-deps`
   - Kind: install (the README used to say `npm install`)
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `npm error ERESOLVE could not resolve` | Current npm refuses the project's conflicting peer dependencies (older npm versions only warned); the lockfile resolves with --legacy-peer-deps. | npm install --legacy-peer-deps |
