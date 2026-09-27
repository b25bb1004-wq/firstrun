# Verified setup for shadcn-ui/taxonomy

Verified by HUMBLE on 2026-09-27 at commit `298a8857c7` on a clean `node:22` machine. Clone to running took 56s.

Prerequisites: Node.js 22.

## Steps

1. `pnpm install`
   - Kind: install
   - Expect: exits with code 0.
2. `cp .env.example .env.local`
   - Kind: env
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-1.sh: line 5: pnpm: command not found` | `pnpm` is not installed; the docs assume it is. | pnpm (via `corepack enable`) |
| `Error: ERR_PNPM_BROKEN_LOCKFILE` | pnpm-lock.yaml line 1 declares lockfileVersion '6.0' (written by pnpm v7/v8), but Corepack downloads pnpm 12.6.0 which only accepts lockfile format v9+; package.json has no 'packageManager' field to pin a compatible pnpm version. | Add `"packageManager": "pnpm@8.15.9"` to package.json so Corepack pins pnpm to a version that understands the lockfileVersion 6.0 format used in pnpm-lock.yaml. |
