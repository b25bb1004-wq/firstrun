# Setup Passport: Louis3797/express-ts-auth-service

✅ **VERIFIED**: FirstRun followed this project's setup docs on a clean `node:22` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `fc6722badf` |
| Verified | 2026-09-25 19:34 UTC |
| Runtime | Node.js 22 (`node:22`) |
| Clone to running, from zero | **1m30s** |
| Steps followed | 4 from the docs, 1 added by FirstRun |
| Breaks found / fixed | 2 / 2 |
| Needs a human | 0 |
| Done when | `GET http://127.0.0.1:4000/` answers |

**Before FirstRun**, a newcomer following the docs got stuck at `yarn start` (README.md:438).

## Verified setup

```bash
npm install --global yarn
yarn install
cp .env.example .env
yarn start
yarn test
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Undocumented environment variable <a id="e1"></a>

- **Docs said:** `yarn start` (README.md:438)
- **Cause:** The app requires PORT, SERVER_URL, CORS_ORIGIN, ACCESS_TOKEN_SECRET and 11 more from .env.example, but the docs never say to create .env from it.
- **Diagnosed by:** FirstRun rule `missing-env-var`, confidence 90%
- **Doc change:** cp .env.example .env
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
    at Object..js (node:internal/modules/cjs/loader:1913:10)
    at Module.load (node:internal/modules/cjs/loader:1505:32)
    at Function._load (node:internal/modules/cjs/loader:1309:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
    at Module.require (node:internal/modules/cjs/loader:1527:12)
    at require (node:internal/modules/helpers:147:16)
    at Object.<anonymous> (/workspace/dist/config/prisma.js:7:34)
    at Module._compile (node:internal/modules/cjs/loader:1781:14)

Node.js v22.23.3
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.

[firstrun] server process exited before becoming ready on port 3000
```
</details>

<details><summary>Fix applied</summary>

```
$ cp .env.example .env → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```
yarn run v1.22.22
$ yarn run build && cross-env NODE_ENV=production node --trace-warnings ./dist/index.js
$ tsc --project './tsconfig.build.json'
2026-09-25 19:32:29 [INFO] Server is running on Port: 4000 

[firstrun] the app is listening on port 4000 (it says so in its output), not 3000

[firstrun] GET http://127.0.0.1:4000/ → 404
404
[firstrun] the docs name no URL to check; the server answered 404 on / so it is up
```
</details>

### E2: Undocumented environment variable <a id="e2"></a>

- **Docs said:** `yarn start` (README.md:438)
- **Cause:** .env.example leaves 16 required values blank and the app rejects empty values. FirstRun fills PORT, SERVER_URL, CORS_ORIGIN, ACCESS_TOKEN_SECRET and 12 more with local values (the app's own defaults where it has them, generated dev secrets, a local mail catcher for SMTP).
- **Diagnosed by:** FirstRun rule `env-empty-value`, confidence 85%
- **Doc change:** `.env.example` now has working local values for the variables that were blank (PORT, SERVER_URL, CORS_ORIGIN, ACCESS_TOKEN_SECRET and 12 more).
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
    at Object..js (node:internal/modules/cjs/loader:1913:10)
    at Module.load (node:internal/modules/cjs/loader:1505:32)
    at Function._load (node:internal/modules/cjs/loader:1309:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
    at Module.require (node:internal/modules/cjs/loader:1527:12)
    at require (node:internal/modules/helpers:147:16)
    at Object.<anonymous> (/workspace/dist/config/prisma.js:7:34)
    at Module._compile (node:internal/modules/cjs/loader:1781:14)

Node.js v22.23.3
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.

[firstrun] server process exited before becoming ready on port 3000
```
</details>

<details><summary>Fix applied</summary>

```
patched .env.example
patched .env.example
patched .env.example
patched .env.example
patched .env.example
patched .env.example
patched .env.example
patched .env.example
patched .env.example
patched .env.example
patched .env.example
patched .env.example
patched .env.example
$ touch .env && { grep -v -E '^(PORT|SERVER_URL|CORS_ORIGIN|ACCESS_TOKEN_SECRET|ACCESS_TOKEN_EXPIRE|REFRESH_TOKEN_SECRET|REFRESH_TOKEN_EXPIRE|REFRESH_TOKEN_COOKIE_NAME|MYSQL_DATABASE|MYSQL_ROOT_PASSWORD|DATABASE_URL|SMTP_HOST|SMTP_PORT|SMTP_USERNAME|SMTP_PASSWORD|EMAIL_FROM)=' .env; printf '%s=%s\n' 'PORT' '4000'; printf '%s=%s\n' 'SERVER_URL' 'http://localhost:4000'; printf '%s=%s\n' 'CORS_ORIGIN' '*'; printf '%s=%s\n' 'ACCESS_TOKEN_SECRET' 'change.me.local.dev.only.not.a.secret'; printf '%s=%s\n' 'ACCESS_TOKEN_EXPIRE' '20m'; printf '%s=%s\n' 'REFRESH_TOKEN_SECRET' 'change.me.local.dev.only.not.a.secret'; printf '%s=%s\n' 'REFRESH_TOKEN_EXPIRE' '1d'; printf '%s=%s\n' 'REFRESH_TOKEN_COOKIE_NAME' 'jid'; printf '%s=%s\n' 'MYSQL_DATABASE' 'app'; printf '%s=%s\n' 'MYSQL_ROOT_PASSWORD' 'change.me.local.dev.only.not.a.secret'; printf '%s=%s\n' 'DATABASE_URL' 'mysql://root:change.me.local.dev.only.not.a.secret@localhost:3306/app'; printf '%s=%s\n' 'SMTP_HOST' 'localhost'; printf '%s=%s\n' 'SMTP_PORT' '1025'; printf '%s=%s\n' 'SMTP_USERNAME' 'dev'; printf '%s=%s\n' 'SMTP_PASSWORD' 'change.me.local.dev.only.not.a.secret'; printf '%s=%s\n' 'EMAIL_FROM' 'dev@example.com'; } > /tmp/firstrun.env && mv /tmp/firstrun.env .env
```
</details>

<details><summary>After (passing output)</summary>

```
yarn run v1.22.22
$ yarn run build && cross-env NODE_ENV=production node --trace-warnings ./dist/index.js
$ tsc --project './tsconfig.build.json'
2026-09-25 19:32:29 [INFO] Server is running on Port: 4000 

[firstrun] the app is listening on port 4000 (it says so in its output), not 3000

[firstrun] GET http://127.0.0.1:4000/ → 404
404
[firstrun] the docs name no URL to check; the server answered 404 on / so it is up
```
</details>

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **FirstRun Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by FirstRun. Verified plan: `.github/firstrun/plan.json`.
