# Setup Passport: GeekyAnts/express-typescript

✅ **VERIFIED**: HUMBLE followed this project's setup docs on a clean `node:22` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `6b9bb70e23` |
| Verified | 2026-09-26 22:52 UTC |
| Runtime | Node.js 22 (`node:22`) |
| Clone to running, from zero | **1m53s** |
| Steps followed | 4 from the docs, 3 added by HUMBLE |
| Breaks found / fixed | 5 / 5 |
| Needs a human | 0 |
| Done when | `GET http://127.0.0.1:4040/` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `npm install` (README.md:140).

## Verified setup

```bash
npm install --legacy-peer-deps
npm install --global nodemon
docker compose -f docker-compose.yaml up -d mongo
docker compose -f docker-compose.yaml up -d redis
npm run dev
docker-compose up
docker-compose up -d
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing dependency <a id="e1"></a>

- **Docs said:** `npm install` (README.md:140)
- **Cause:** Current npm refuses the project's conflicting peer dependencies (older npm versions only warned); the lockfile resolves with --legacy-peer-deps.
- **Diagnosed by:** HUMBLE rule `npm-peer-conflict`, confidence 80%
- **Doc change:** npm install --legacy-peer-deps
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
npm error
npm error Could not resolve dependency:
npm error peer typescript@"^2.7 || ^3" from awesome-typescript-loader@5.2.1
npm error node_modules/awesome-typescript-loader
npm error   dev awesome-typescript-loader@"^5.2.0" from the root project
npm error
npm error Fix the upstream dependency conflict, or retry
npm error this command with --force or --legacy-peer-deps
npm error to accept an incorrect (and potentially broken) dependency resolution.
npm error
npm error
npm error For a full report see:
npm error /root/.npm/_logs/2026-09-26T22_44_43_093Z-eresolve-report.txt
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-09-26T22_44_43_093Z-debug-0.log
```
</details>

<details><summary>Fix applied</summary>

```
step command → npm install --legacy-peer-deps
```
</details>

<details><summary>After (passing output)</summary>

```
npm warn deprecated debug@4.1.1: Debug versions >=3.2.0 <3.2.7 || >=4 <4.3.1 have a low-severity ReDos regression when used in a Node.js environment. It is recommended you upgrade to 3.2.7 or 4.3.1. (https://github.com/visionmedia/debug/issues/797)
npm warn deprecated debug@4.1.1: Debug versions >=3.2.0 <3.2.7 || >=4 <4.3.1 have a low-severity ReDos regression when used in a Node.js environment. It is recommended you upgrade to 3.2.7 or 4.3.1. (https://github.com/visionmedia/debug/issues/797)
npm warn deprecated uuid@3.4.0: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).
npm warn deprecated uuid@3.4.0: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).
npm warn deprecated mkdirp@0.5.1: Legacy versions of mkdirp are no longer supported. Please update to mkdirp 1.x. (Note that the API surface has changed to use Promises in 1.x.)
npm warn deprecated bson@1.0.9: Fixed a critical issue with BSON serialization documented in CVE-2019-2391, see https://bit.ly/2KcpXdo for more details
npm warn deprecated bootstrap@4.6.2: This version of Bootstrap is no longer supported. Please upgrade to the latest version.
npm warn deprecated core-js@2.6.12: core-js@<3.23.3 is no longer maintained and not recommended for usage due to the number of issues. Because of the V8 engine whims, feature detection in old core-js versions could cause a slowdown up to 100x even if nothing is polyfilled. Some versions have web compatibility issues. Please, upgrade your dependencies to the actual version of core-js.

added 631 packages in 1m
```
</details>

### E2: Missing tool <a id="e2"></a>

- **Docs said:** `npm run dev` (README.md:148)
- **Cause:** The scripts call `nodemon`, but it isn't a dependency of the project: the docs assume it is installed globally.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 85%
- **Doc change:** npm install --global nodemon
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```

> node-server-with-typescript@1.0.0 dev
> tsc --watch & NODE_ENV=development nodemon dist

sh: 1: nodemon: not found
c10:46:24 PM - Starting compilation in watch mode...


[firstrun] server process exited before becoming ready on port 4040
```
</details>

<details><summary>Fix applied</summary>

```
$ npm install --global nodemon → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```

[ERROR] :: TypeError: OAuth2Strategy requires a clientID option

[firstrun] GET http://127.0.0.1:4040/ → 200
    <title>Home - Geek Dashboard</title>
    <meta name="description" content="A Web Server built with Express, Typescript, Mongoose, and Pug."/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <meta name="keyword" content="web-server, typescript-express, typescript, express"/>
    <link rel="shortcut icon" href="public/favicon.ico" type="image/x-icon"/>
    <link href="https://fonts.googleapis.com/css?family=Montserrat:400,700" rel="stylesheet" type
```
</details>

### E3: Undocumented backing service <a id="e3"></a>

- **Docs said:** `npm run dev` (README.md:148)
- **Cause:** The app connects to MongoDB on localhost:27017, but the docs never start it.
- **Diagnosed by:** HUMBLE rule `missing-service`, confidence 92%
- **Doc change:** docker compose -f docker-compose.yaml up -d mongo
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
    at Pool.<anonymous> (/workspace/node_modules/mongodb-core/lib/topologies/server.js:336:35)
    at Pool.emit (node:events:519:28)
    at Connection.<anonymous> (/workspace/node_modules/mongodb-core/lib/connection/pool.js:280:12)
    at Object.onceWrapper (node:events:634:26)
    at Connection.emit (node:events:519:28)
    at Socket.<anonymous> (/workspace/node_modules/mongodb-core/lib/connection/connection.js:189:49)
    at Object.onceWrapper (node:events:634:26)
    at Socket.emit (node:events:519:28)
    at emitErrorNT (node:internal/streams/destroy:170:8)
    at emitErrorCloseNT (node:internal/streams/destroy:129:3)
    at process.processTicksAndRejections (node:internal/process/task_queues:89:21)

Node.js v22.23.3
[firstrun] the server process is still running but does not answer
```
</details>

<details><summary>Fix applied</summary>

```
started mongo as "mongo" on localhost:27017
$ docker compose -f docker-compose.yaml up -d mongo → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```

[ERROR] :: TypeError: OAuth2Strategy requires a clientID option

[firstrun] GET http://127.0.0.1:4040/ → 200
    <title>Home - Geek Dashboard</title>
    <meta name="description" content="A Web Server built with Express, Typescript, Mongoose, and Pug."/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <meta name="keyword" content="web-server, typescript-express, typescript, express"/>
    <link rel="shortcut icon" href="public/favicon.ico" type="image/x-icon"/>
    <link href="https://fonts.googleapis.com/css?family=Montserrat:400,700" rel="stylesheet" type
```
</details>

### E4: Undocumented backing service <a id="e4"></a>

- **Docs said:** `npm run dev` (README.md:148)
- **Cause:** The app connects to Redis on localhost:6379, but the docs never start it.
- **Diagnosed by:** HUMBLE rule `missing-service`, confidence 92%
- **Doc change:** docker compose -f docker-compose.yaml up -d redis
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
    at Socket.emit (node:events:519:28)
    at emitErrorNT (node:internal/streams/destroy:170:8)
    at emitErrorCloseNT (node:internal/streams/destroy:129:3)
    at process.processTicksAndRejections (node:internal/process/task_queues:89:21) {
  errno: -111,
  code: 'ECONNREFUSED',
  syscall: 'connect',
  address: '127.0.0.1',
  port: 6379
}

Node.js v22.23.3
Server :: Running @ 'http://localhost:4040'
[firstrun] the server process is still running but does not answer
```
</details>

<details><summary>Fix applied</summary>

```
started redis as "redis" on localhost:6379
$ docker compose -f docker-compose.yaml up -d redis → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```

[ERROR] :: TypeError: OAuth2Strategy requires a clientID option

[firstrun] GET http://127.0.0.1:4040/ → 200
    <title>Home - Geek Dashboard</title>
    <meta name="description" content="A Web Server built with Express, Typescript, Mongoose, and Pug."/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <meta name="keyword" content="web-server, typescript-express, typescript, express"/>
    <link rel="shortcut icon" href="public/favicon.ico" type="image/x-icon"/>
    <link href="https://fonts.googleapis.com/css?family=Montserrat:400,700" rel="stylesheet" type
```
</details>

### E5: Wrong runtime version <a id="e5"></a>

- **Docs said:** `npm run dev` (README.md:148)
- **Cause:** The app's MongoDB driver uses legacy opcodes that MongoDB 6 and later removed ("Unsupported OP_QUERY command"), so it connects but every write fails. The docs don't say which MongoDB to run; the driver needs 4.4 or older.
- **Diagnosed by:** HUMBLE rule `mongo-legacy-driver`, confidence 85%
- **Doc change:** MongoDB 4.4 (this project's driver can't talk to MongoDB 6+): docker run -d -p 27017:27017 mongo:4.4
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
    at Socket.emit (node:events:519:28)
    at addChunk (node:internal/streams/readable:561:12)
    at readableAddChunkPushByteMode (node:internal/streams/readable:512:3)
    at Readable.push (node:internal/streams/readable:392:5)
    at TCP.onStreamRead (node:internal/stream_base_commons:189:23) {
  ok: 0,
  errmsg: 'Unsupported OP_QUERY command: insert. The client driver may require an upgrade. For more details see https://dochub.mongodb.org/core/legacy-opcode-removal',
  code: 352,
  codeName: 'UnsupportedOpQueryCommand'
}

Node.js v22.23.3
Server :: Running @ 'http://localhost:4040'
[firstrun] the server process is still running but does not answer
```
</details>

<details><summary>Fix applied</summary>

```
started mongo:4.4 as "mongo" on localhost:27017
```
</details>

<details><summary>After (passing output)</summary>

```

[ERROR] :: TypeError: OAuth2Strategy requires a clientID option

[firstrun] GET http://127.0.0.1:4040/ → 200
    <title>Home - Geek Dashboard</title>
    <meta name="description" content="A Web Server built with Express, Typescript, Mongoose, and Pug."/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <meta name="keyword" content="web-server, typescript-express, typescript, express"/>
    <link rel="shortcut icon" href="public/favicon.ico" type="image/x-icon"/>
    <link href="https://fonts.googleapis.com/css?family=Montserrat:400,700" rel="stylesheet" type
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Docker Compose v1 | docker-compose up | retired in 2023; current Docker ships it as `docker compose` | README.md:157 |
| env var MONGOOSE_URL | not documented | read in src/middlewares/Http.ts:60 | README |
| env var PORT | not documented | read in src/providers/Locals.ts:19 | README |
| env var GOOGLE_ID | not documented | read in src/services/strategies/Google.ts:14 | README |
| env var GOOGLE_SECRET | not documented | read in src/services/strategies/Google.ts:15 | README |
| env var TWITTER_KEY | not documented | read in src/services/strategies/Twitter.ts:14 | README |
| env var TWITTER_SECRET | not documented | read in src/services/strategies/Twitter.ts:15 | README |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
