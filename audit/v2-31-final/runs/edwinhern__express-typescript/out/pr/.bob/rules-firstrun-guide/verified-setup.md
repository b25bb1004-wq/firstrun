# Verified setup for edwinhern/express-typescript

Verified by HUMBLE on 2026-09-27 at commit `983fa04136` on a clean `node:22` machine. Clone to running took 3s.

Prerequisites: Node.js 22.

## Steps

1. `pnpm install`
   - Kind: install (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
2. `pnpm test`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-1.sh: line 5: pnpm: command not found` | `pnpm` is not installed; the docs assume it is. | pnpm (via `corepack enable`) |
| `sh: 1: vitest: not found` | Dependencies were never installed before "pnpm test"; the docs skip `pnpm install`. | pnpm install |
