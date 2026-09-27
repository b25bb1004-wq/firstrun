# Setup Passport: marcomelilli/nestjs-email-authentication

✅ **VERIFIED**: HUMBLE followed this project's setup docs on a clean `node:22` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `d8fbaadc1e` |
| Verified | 2026-09-27 12:23 UTC |
| Runtime | Node.js 22 (`node:22`) |
| Clone to running, from zero | **24s** |
| Steps followed | 2 from the docs, 1 added by HUMBLE |
| Breaks found / fixed | 2 / 2 |
| Needs a human | 0 |
| Done when | `GET http://127.0.0.1:3000/` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `npm install` (README.md:11).

## Verified setup

```bash
npm install --legacy-peer-deps
docker compose up -d mongo
npm run start
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing dependency <a id="e1"></a>

- **Docs said:** `npm install` (README.md:11)
- **Cause:** Current npm refuses the project's conflicting peer dependencies (older npm versions only warned); the lockfile resolves with --legacy-peer-deps.
- **Diagnosed by:** HUMBLE rule `npm-peer-conflict`, confidence 80%
- **Doc change:** npm install --legacy-peer-deps
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
npm error Conflicting peer dependency: @types/jest@27.5.2
npm error node_modules/@types/jest
npm error   peerOptional @types/jest@"^27.0.0" from ts-jest@28.0.3
npm error   node_modules/ts-jest
npm error     dev ts-jest@"^28.0.3" from the root project
npm error
npm error Fix the upstream dependency conflict, or retry
npm error this command with --force or --legacy-peer-deps
npm error to accept an incorrect (and potentially broken) dependency resolution.
npm error
npm error
npm error For a full report see:
npm error /root/.npm/_logs/2026-09-27T12_18_52_605Z-eresolve-report.txt
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-09-27T12_18_52_605Z-debug-0.log
```
</details>

<details><summary>Fix applied</summary>

```
step command → npm install --legacy-peer-deps
```
</details>

<details><summary>After (passing output)</summary>

```
npm warn deprecated superagent@3.8.3: Please upgrade to v7.0.2+ of superagent.  We have fixed numerous issues with streams, form-data, attach(), filesystem errors not bubbling up (ENOENT on attach()), and all tests are now passing.  See the releases tab for more information at <https://github.com/visionmedia/superagent/releases>.
npm warn deprecated source-map-url@0.4.0: See https://github.com/lydell/source-map-url#deprecated
npm warn deprecated source-map-resolve@0.5.3: See https://github.com/lydell/source-map-resolve#deprecated
npm warn deprecated resolve-url@0.2.1: https://github.com/lydell/resolve-url#deprecated
npm warn deprecated querystring@0.2.0: The querystring API is considered Legacy. new code should use the URLSearchParams API instead.
npm warn deprecated multer@1.4.4: Multer 1.x is affected by CVE-2022-24434. This is fixed in v1.4.4-lts.1 which drops support for versions of Node.js before 6. Please upgrade to at least Node.js 6 and version 1.4.4-lts.1 of Multer. If you need support for older versions of Node.js, we are open to accepting patches that would fix the CVE on the main 1.x release line, whilst maintaining compatibility with Node.js 0.10.
npm warn deprecated formidable@1.2.2: Please upgrade to latest, formidable@v2 or formidable@v3! Check these notes: https://bit.ly/2ZEqIau
npm warn deprecated chokidar@2.1.8: Chokidar 2 does not receive security updates since 2019. Upgrade to chokidar 3 with 15x fewer dependencies

added 1109 packages in 15s
```
</details>

### E2: Undocumented backing service <a id="e2"></a>

- **Docs said:** `npm run start` (README.md:12)
- **Cause:** The app connects to MongoDB on localhost:27017, but the docs never start it.
- **Diagnosed by:** HUMBLE rule `missing-service`, confidence 92%
- **Doc change:** docker compose up -d mongo
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```

> project@1.0.0 start
> ts-node -r tsconfig-paths/register src/main.ts

[Nest] 238  - 09/27/2026, 12:19:14 PM     LOG [NestFactory] Starting Nest application...
[Nest] 238  - 09/27/2026, 12:19:14 PM     LOG [InstanceLoader] MongooseModule dependencies initialized +22ms
[Nest] 238  - 09/27/2026, 12:19:14 PM     LOG [InstanceLoader] HttpModule dependencies initialized +0ms
[Nest] 238  - 09/27/2026, 12:19:14 PM     LOG [InstanceLoader] AppModule dependencies initialized +0ms
[Nest] 238  - 09/27/2026, 12:19:44 PM   ERROR [MongooseModule] Unable to connect to the database. Retrying (1)...
[Nest] 238  - 09/27/2026, 12:20:17 PM   ERROR [MongooseModule] Unable to connect to the database. Retrying (2)...
[Nest] 238  - 09/27/2026, 12:20:50 PM   ERROR [MongooseModule] Unable to connect to the database. Retrying (3)...
[Nest] 238  - 09/27/2026, 12:21:23 PM   ERROR [MongooseModule] Unable to connect to the database. Retrying (4)...

[firstrun] server did not become ready on port 3000 within 150s
```
</details>

<details><summary>Fix applied</summary>

```
started mongo as "mongo" on localhost:27017
$ docker compose up -d mongo → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```
[Nest] 2980  - 09/27/2026, 12:23:32 PM     LOG [RouterExplorer] Mapped {/auth/email/login, POST} route +0ms
[Nest] 2980  - 09/27/2026, 12:23:32 PM     LOG [RouterExplorer] Mapped {/auth/email/register, POST} route +0ms
[Nest] 2980  - 09/27/2026, 12:23:32 PM     LOG [RouterExplorer] Mapped {/auth/email/verify/:token, GET} route +0ms
[Nest] 2980  - 09/27/2026, 12:23:32 PM     LOG [RouterExplorer] Mapped {/auth/email/resend-verification/:email, GET} route +0ms
[Nest] 2980  - 09/27/2026, 12:23:32 PM     LOG [RouterExplorer] Mapped {/auth/email/forgot-password/:email, GET} route +0ms
[Nest] 2980  - 09/27/2026, 12:23:32 PM     LOG [RouterExplorer] Mapped {/auth/email/reset-password, POST} route +0ms
[Nest] 2980  - 09/27/2026, 12:23:32 PM     LOG [NestApplication] Nest application successfully started +1ms

[firstrun] GET http://127.0.0.1:3000/ → 200
Hello World!
```
</details>

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
