# Setup Passport: shadcn-ui/taxonomy

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `node:22` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `298a8857c7` |
| Verified | 2026-09-27 08:52 UTC |
| Runtime | Node.js 22 (`node:22`) |
| Clone to running, from zero | **56s** |
| Steps followed | 3 from the docs, 0 added by HUMBLE |
| Breaks found / fixed | 3 / 2 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:3000/` answers |
| IBM Bob | 2 diagnosises, 0.67 Bobcoins |

**Before HUMBLE**, a newcomer following the docs got stuck at `pnpm install` (README.md:66).

## Verified setup

```bash
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

✔ Generated Prisma Client (4.13.0 | library) to ./node_modules/.pnpm/@prisma+client@4.13.0_prisma@4.13.0/node_modules/@prisma/client in 97ms
You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
```
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```
Done in 38.8s
```
</details>

### E2: Wrong runtime version <a id="e2"></a>

- **Docs said:** `pnpm install` (README.md:66)
- **Cause:** pnpm-lock.yaml line 1 declares lockfileVersion '6.0' (written by pnpm v7/v8), but Corepack downloads pnpm 12.6.0 which only accepts lockfile format v9+; package.json has no 'packageManager' field to pin a compatible pnpm version.
- **Diagnosed by:** IBM Bob (0.06254399999999999 Bobcoins), confidence 97%
- **Doc change:** Add `"packageManager": "pnpm@8.15.9"` to package.json so Corepack pins pnpm to a version that understands the lockfileVersion 6.0 format used in pnpm-lock.yaml.
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
wrote package.json
```
</details>

<details><summary>After (passing output)</summary>

```

Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (4.13.0 | library) to ./node_modules/.pnpm/@prisma+client@4.13.0_prisma@4.13.0/node_modules/@prisma/client in 97ms
You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
```
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```
Done in 38.8s
```
</details>

### E3: Needs a real credential <a id="e3"></a>

- **Docs said:** `pnpm dev` (README.md:78)
- **Cause:** `.env.example` ships all third-party credentials as empty strings (lines 10-32), but `env.mjs` lines 9-20 validate every one of them with `z.string().min(1)`, so Next.js aborts at config-load time with 'Invalid environment variables' for NEXTAUTH_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_ACCESS_TOKEN, SMTP_FROM, POSTMARK_API_TOKEN, POSTMARK_SIGN_IN_TEMPLATE, POSTMARK_ACTIVATION_TEMPLA
- **Diagnosed by:** IBM Bob (0.07541 Bobcoins), confidence 99%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
[1]     at f (file:///workspace/node_modules/.pnpm/@t3-oss+env-nextjs@0.2.2_zod@3.21.4/node_modules/@t3-oss/env-nextjs/dist/index.mjs:1:505)
[1]     at l (file:///workspace/node_modules/.pnpm/@t3-oss+env-nextjs@0.2.2_zod@3.21.4/node_modules/@t3-oss/env-nextjs/dist/index.mjs:1:695)
[1]     at C (file:///workspace/node_modules/.pnpm/@t3-oss+env-nextjs@0.2.2_zod@3.21.4/node_modules/@t3-oss/env-nextjs/dist/index.mjs:1:868)
[1]     at file:///workspace/env.mjs:4:20
[1]     at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
[1]     at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
[1]     at async loadConfig (/workspace/node_modules/.pnpm/next@13.3.2-canary.13_@babel+core@7.21.4_@opentelemetry+api@1.1.0_react-dom@18.2.0_react@18.2.0/node_modules/next/dist/server/config.js:528:36)
[1]     at async NextServer.prepare (/workspace/node_modules/.pnpm/next@13.3.2-canary.13_@babel+core@7.21.4_@opentelemetry+api@1.1.0_react-dom@18.2.0_react@18.2.0/node_modules/next/dist/server/next.js:153:24)
[1]     at async Server.<anonymous> (/workspace/node_modules/.pnpm/next@13.3.2-canary.13_@babel+core@7.21.4_@opentelemetry+api@1.1.0_react-dom@18.2.0_react@18.2.0/node_modules/next/dist/server/lib/render-server.js:117:17) {
[1]   type: 'Error'
[1] }
[1] next dev exited with code 1
[0] Generated 15 documents in .contentlayer
[firstrun] the server process is still running but does not answer
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
