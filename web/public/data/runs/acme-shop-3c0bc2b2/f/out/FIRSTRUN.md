# Setup Passport: acme-shop

✅ **VERIFIED**: FirstRun followed this project's setup docs on a clean `node:20` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `c0661ce19b` |
| Verified | 2026-09-24 22:19 UTC |
| Runtime | Node.js 20 (`node:20`) |
| Clone to running, from zero | **14s** |
| Steps followed | 7 from the docs, 0 added by FirstRun |
| Breaks found / fixed | 5 / 5 |
| Needs a human | 0 |
| Done when | `GET http://127.0.0.1:3000/health` answers |

**Before FirstRun**, a newcomer following the docs got stuck at `npm install` (README.md:38).

## Verified setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
npm test
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Wrong runtime version <a id="e1"></a>

- **Docs said:** `npm install` (README.md:38)
- **Cause:** The README's Node.js 16 is too old: the project needs Node.js 20 (.nvmrc).
- **Diagnosed by:** FirstRun rule `node-engine`, confidence 95%
- **Doc change:** Node.js 20 (see .nvmrc)
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
npm ERR! code EBADENGINE
npm ERR! engine Unsupported engine
npm ERR! engine Not compatible with your version of node/npm: acme-shop@1.4.0
npm ERR! notsup Not compatible with your version of node/npm: acme-shop@1.4.0
npm ERR! notsup Required: {"node":">=20"}
npm ERR! notsup Actual:   {"npm":"8.19.4","node":"v16.20.2"}

npm ERR! A complete log of this run can be found in:
npm ERR!     /root/.npm/_logs/2026-09-24T22_19_12_666Z-debug-0.log
```
</details>

<details><summary>Fix applied</summary>

```
rebased onto node:20
```
</details>

<details><summary>After (passing output)</summary>

```

added 92 packages in 3s
```
</details>

### E2: Stale file reference <a id="e2"></a>

- **Docs said:** `cp .env.sample .env` (README.md:44)
- **Cause:** .env.sample does not exist; the repo ships .env.example.
- **Diagnosed by:** FirstRun rule `missing-copy-source`, confidence 92%
- **Doc change:** cp .env.example .env
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
cp: cannot stat '.env.sample': No such file or directory
```
</details>

<details><summary>Fix applied</summary>

```
step command → cp .env.example .env
```
</details>

<details><summary>After (passing output)</summary>

```

```
</details>

### E3: Renamed or missing script <a id="e3"></a>

- **Docs said:** `npm run migrate` (README.md:56)
- **Cause:** The script "migrate" no longer exists; package.json has "db:migrate" (node scripts/migrate.js).
- **Diagnosed by:** FirstRun rule `missing-npm-script`, confidence 93%
- **Doc change:** npm run db:migrate
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
npm error Missing script: "migrate"
npm error
npm error To see a list of scripts, run:
npm error   npm run
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-09-24T22_19_23_220Z-debug-0.log
```
</details>

<details><summary>Fix applied</summary>

```
step command → npm run db:migrate
```
</details>

<details><summary>After (passing output)</summary>

```

> acme-shop@1.4.0 db:migrate
> node scripts/migrate.js

applied 001_create_products.sql
applied 002_add_product_stock.sql
migrations up to date
```
</details>

### E4: Undocumented environment variable <a id="e4"></a>

- **Docs said:** `npm run migrate` (README.md:56)
- **Cause:** The app requires SESSION_SECRET at startup, but the docs never mention it and .env.example is missing it.
- **Diagnosed by:** FirstRun rule `missing-env-var`, confidence 90%
- **Doc change:** .env.example now includes SESSION_SECRET (required at startup).
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```

Error: Missing required environment variable SESSION_SECRET
    at required (/workspace/src/config.js:13:11)
    at Object.<anonymous> (/workspace/src/config.js:22:18)
    at Module._compile (node:internal/modules/cjs/loader:1521:14)
    at Module._extensions..js (node:internal/modules/cjs/loader:1623:10)
    at Module.load (node:internal/modules/cjs/loader:1266:32)
    at Module._load (node:internal/modules/cjs/loader:1091:12)
    at Module.require (node:internal/modules/cjs/loader:1289:19)
    at require (node:internal/modules/helpers:182:18)
    at Object.<anonymous> (/workspace/src/db.js:4:16)
    at Module._compile (node:internal/modules/cjs/loader:1521:14)

Node.js v20.20.2
```
</details>

<details><summary>Fix applied</summary>

```
patched .env.example
$ touch .env && printf '\n%s=%s\n' 'SESSION_SECRET' 'dev-df4d5a8114d02c9336a5d775' >> .env
```
</details>

<details><summary>After (passing output)</summary>

```

> acme-shop@1.4.0 db:migrate
> node scripts/migrate.js

applied 001_create_products.sql
applied 002_add_product_stock.sql
migrations up to date
```
</details>

### E5: Undocumented backing service <a id="e5"></a>

- **Docs said:** `npm run dev` (README.md:63)
- **Cause:** The app connects to Redis on localhost:6379, but the docs never start it and docker-compose.yml doesn't define it.
- **Diagnosed by:** FirstRun rule `missing-service`, confidence 92%
- **Doc change:** docker-compose.yml now also starts Redis; `docker compose up -d` brings up everything the app needs.
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
    port: 6379
  },
  socketError: Error: connect ECONNREFUSED 127.0.0.1:6379
      at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1611:16) {
    errno: -111,
    code: 'ECONNREFUSED',
    syscall: 'connect',
    address: '127.0.0.1',
    port: 6379
  }
}
Failed running 'src/server.js'

[firstrun] the server crashed during startup and is not listening on port 3000
```
</details>

<details><summary>Fix applied</summary>

```
patched docker-compose.yml
started redis:7-alpine as "redis" on localhost:6379
```
</details>

<details><summary>After (passing output)</summary>

```

> acme-shop@1.4.0 dev
> node --watch src/server.js

acme-shop listening on http://localhost:3000

[firstrun] GET http://127.0.0.1:3000/health → 200
{"status":"ok","db":"up","redis":"up","uptime":1}
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Node.js version | Node.js 16+ | 20 (.nvmrc) | README.md:28 |
| file .env.sample | cp .env.sample .env | does not exist in the repo | README.md:44 |
| npm script "migrate" | npm run migrate | not in package.json scripts | README.md:56 |
| env var SESSION_SECRET | not documented | read in src/config.js:22 | .env.example |
| redis service | setup never starts it | dependency "redis" | package.json |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **FirstRun Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by FirstRun. Verified plan: `.github/firstrun/plan.json`.
