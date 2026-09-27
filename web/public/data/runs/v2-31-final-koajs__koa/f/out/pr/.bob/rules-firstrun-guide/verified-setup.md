# Verified setup for koajs/koa

Verified by HUMBLE on 2026-09-27 at commit `824c1cf8de` on a clean `node:22` machine. Clone to running took 14s.

Prerequisites: Node.js 22.

## Steps

1. `npm ci`
   - Kind: install
   - Expect: exits with code 0.
2. `npm test`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
