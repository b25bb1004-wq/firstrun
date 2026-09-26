# Setup Passport: shadcn-ui/taxonomy

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `node:22` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `298a8857c7+dirty` |
| Verified | 2026-09-26 12:01 UTC |
| Runtime | Node.js 22 (`node:22`) |
| Clone to running, from zero | **3m47s** |
| Steps followed | 3 from the docs, 1 added by HUMBLE |
| Breaks found / fixed | 3 / 2 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:3000/` answers |
| IBM Bob | 2 diagnosises, 0.57 Bobcoins |

**Before HUMBLE**, a newcomer following the docs got stuck at `pnpm install` (README.md:66).

## Verified setup

```bash
corepack use pnpm@8
pnpm install
cp .env.example .env.local
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `pnpm install` (README.md:66)
- **Cause:** `pnpm` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** pnpm (via `corepack enable`)
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
/firstrun/step-1.sh: line 5: pnpm: command not found
```
</details>

<details><summary>Fix applied</summary>

```
$ corepack enable
```
</details>

<details><summary>After (passing output)</summary>

```

Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (4.13.0 | library) to ./node_modules/.pnpm/@prisma+client@4.13.0_prisma@4.13.0/node_modules/@prisma/client in 69ms
You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
```
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```
Done in 1.5s
```
</details>

### E2: Wrong runtime version <a id="e2"></a>

- **Docs said:** `pnpm install` (README.md:66)
- **Cause:** pnpm-lock.yaml line 1 declares lockfileVersion '6.0' (written by pnpm v8), but package.json has no 'packageManager' field, so Corepack downloads pnpm 12.6.0 which only supports lockfile formats ≥9 and rejects the existing lockfile.
- **Diagnosed by:** IBM Bob (0.06314 Bobcoins), confidence 97%
- **Doc change:** Before running `pnpm install`, pin the pnpm version that matches the lockfile by adding `"packageManager": "pnpm@8.15.9"` to package.json (or run `corepack use pnpm@8` once after `corepack enable`). The committed pnpm-lock.yaml uses lockfileVersion 6.0, which is only compatible with pnpm v8; newer pnpm versions (v9+) use lockfile format v9 and refuse to read it.
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
! Corepack is about to download https://registry.npmjs.org/pnpm/-/pnpm-12.6.0.tgz
Downloading the pnpm 12.6.0 binary for linux-x64...
Error: ERR_PNPM_BROKEN_LOCKFILE

  × The lockfile at "/workspace/pnpm-lock.yaml" is broken: The lockfileVersion
  │ of 6.0 is incompatible with the supported formats (1:18)
```
</details>

<details><summary>Fix applied</summary>

```
patched package.json
$ corepack enable

$ corepack use pnpm@8 → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```

Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (4.13.0 | library) to ./node_modules/.pnpm/@prisma+client@4.13.0_prisma@4.13.0/node_modules/@prisma/client in 69ms
You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
```
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```
Done in 1.5s
```
</details>

### E3: Needs a real credential <a id="e3"></a>

- **Docs said:** `pnpm dev` (README.md:78)
- **Cause:** env.mjs lines 9–20 validates NEXTAUTH_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_ACCESS_TOKEN, SMTP_FROM, POSTMARK_API_TOKEN, POSTMARK_SIGN_IN_TEMPLATE, POSTMARK_ACTIVATION_TEMPLATE, STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRO_MONTHLY_PLAN_ID with z.string().min(1); after copying .env.example those values are all empty strings, so @t3-oss/env-nextjs throws at startup and Next
- **Diagnosed by:** IBM Bob (0.199702 Bobcoins), confidence 95%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```

> taxonomy@0.2.0 dev /workspace
> concurrently "contentlayer dev" "next dev"

[1] ready - started server on 0.0.0.0:3000, url: http://localhost:3000
[1] info  - Loaded env from /workspace/.env.local

[firstrun] GET http://127.0.0.1:3000/ → no response
curl: (7) Failed to connect to 127.0.0.1 port 3000 after 0 ms: Couldn't connect to server
000
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Node.js version | not stated | 16 (.nvmrc) | README.md |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
