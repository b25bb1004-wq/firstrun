# Verified setup for shadcn-ui/taxonomy

Verified by HUMBLE on 2026-09-26 at commit `298a8857c7+dirty` on a clean `node:22` machine. Clone to running took 227s.

Prerequisites: Node.js 22.

## Steps

1. `corepack use pnpm@8`
   - Kind: install (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
2. `pnpm install`
   - Kind: install
   - Expect: exits with code 0.
3. `cp .env.example .env.local`
   - Kind: env
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-1.sh: line 5: pnpm: command not found` | `pnpm` is not installed; the docs assume it is. | pnpm (via `corepack enable`) |
| `Error: ERR_PNPM_BROKEN_LOCKFILE` | pnpm-lock.yaml line 1 declares lockfileVersion '6.0' (written by pnpm v8), but package.json has no 'packageManager' field, so Corepack downloads pnpm 12.6.0 which only supports lockfile formats ≥9 and rejects the existing lockfile. | Before running `pnpm install`, pin the pnpm version that matches the lockfile by adding `"packageManager": "pnpm@8.15.9"` to package.json (or run `corepack use pnpm@8` once after `corepack enable`). The committed pnpm-lock.yaml uses lockfileVersion 6.0, which is only compatible with pnpm v8; newer pnpm versions (v9+) use lockfile format v9 and refuse to read it. |
