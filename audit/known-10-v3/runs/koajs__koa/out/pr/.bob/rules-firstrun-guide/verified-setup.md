# Verified setup for koajs/koa

Verified by FirstRun on 2026-09-25 at commit `824c1cf8de` on a clean `node:18` machine. Clone to running took 8s.

Prerequisites: Node.js 18.

## Steps

1. `npm install`
   - Kind: install (added by FirstRun: the README missed it)
   - Expect: exits with code 0.
2. `npm test`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `npm ERR! Test failed.  See above for more details.` | The README's Node.js 7 is too old: the project needs Node.js 18 (the error ("node: bad option: --test"): `--test` requires Node.js 18+). | Node.js 18 or newer (`--test` runner requires Node.js 18+) |
| `# Error: Cannot find module 'on-finished'` | Dependencies were never installed before "npm test"; the docs skip `npm install`. | npm install |
