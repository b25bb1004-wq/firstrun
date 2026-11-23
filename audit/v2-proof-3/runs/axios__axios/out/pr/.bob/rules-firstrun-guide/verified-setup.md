# Verified setup for axios/axios

Verified by HUMBLE on 2026-09-26 at commit `961241f6c1+dirty` on a clean `node:24` machine. Clone to running took 17s.

Prerequisites: Node.js 24.

## Steps

1. `npm ci`
   - Kind: install
   - Expect: exits with code 0.
2. `npm rebuild husky`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
