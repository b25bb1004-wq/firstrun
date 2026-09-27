# Verified setup for addyosmani/git2txt

Verified by HUMBLE on 2026-09-27 at commit `e8db771b97` on a clean `node:22` machine. Clone to running took 12s.

Prerequisites: Node.js 22.

## Steps

1. `npm install -g git2txt`
   - Kind: install
   - Expect: exits with code 0.
2. `npm install`
   - Kind: install
   - Expect: exits with code 0.
3. `node ./index.js --help`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
