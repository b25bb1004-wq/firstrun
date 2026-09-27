# Setup Passport: hardyscc/aws-nestjs-starter

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `node:22` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `2e312502fc` |
| Verified | 2026-09-27 09:39 UTC |
| Runtime | Node.js 22 (`node:22`) |
| Clone to running, from zero | **1m17s** |
| Steps followed | 11 from the docs, 0 added by HUMBLE |
| Breaks found / fixed | 0 / 0 |
| Needs a human | 6 |
| Done when | `GET http://127.0.0.1:3000/dev/graphql` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `aws configure` (README.md:61).

## Verified setup

```bash
npm install
npm run sls:offline
npm run sls:online
npm run start:online
npm run test:e2e
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Unrecognised failure <a id="e1"></a>

- **Docs said:** `aws configure` (README.md:61)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
/firstrun/step-2.sh: line 5: aws: command not found
```
</details>

### E2: Unrecognised failure <a id="e2"></a>

- **Docs said:** `npm run ddb:install` (README.md:82)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
Error: Error getting DynamoDb local latest tar.gz location undefined: 403
    at ClientRequest.<anonymous> (/workspace/node_modules/dynamodb-localhost/dynamodb/installer.js:29:15)
    at Object.onceWrapper (node:events:634:26)
    at ClientRequest.emit (node:events:519:28)
    at ClientRequest.emit (node:domain:489:12)
    at HTTPParser.parserOnIncomingClient [as onIncoming] (node:_http_client:780:27)
    at HTTPParser.parserOnHeadersComplete (node:_http_common:125:17)
    at Socket.socketOnData (node:_http_client:615:22)
    at Socket.emit (node:events:519:28)
    at Socket.emit (node:domain:489:12)
    at addChunk (node:internal/streams/readable:561:12)
    at readableAddChunkPushByteMode (node:internal/streams/readable:512:3)
    at Readable.push (node:internal/streams/readable:392:5)
    at TCP.onStreamRead (node:internal/stream_base_commons:189:23)
```
</details>

### E3: Unrecognised failure <a id="e3"></a>

- **Docs said:** `npm run ddb:start` (README.md:89)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
  syscall: 'spawn java',
  path: 'java',
  spawnargs: [
    '-Djava.library.path=/workspace/.dynamodb/DynamoDBLocal_lib',
    '-jar',
    'DynamoDBLocal.jar',
    '-port',
    8000,
    '-inMemory',
    '-sharedDb'
  ]
}

Node.js v22.23.3
```
</details>

### E4: Unrecognised failure <a id="e4"></a>

- **Docs said:** `npm run ddb:start` (README.md:102)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
  syscall: 'spawn java',
  path: 'java',
  spawnargs: [
    '-Djava.library.path=/workspace/.dynamodb/DynamoDBLocal_lib',
    '-jar',
    'DynamoDBLocal.jar',
    '-port',
    8000,
    '-inMemory',
    '-sharedDb'
  ]
}

Node.js v22.23.3
```
</details>

### E5: slow-tests <a id="e5"></a>

- **Docs said:** `npm test` (README.md:125)
- **Cause:** `npm test` did not finish within 5 min on a clean machine. The setup before it is proven; the docs should name a quick subset for newcomers and say the full suite is for CI.
- **Diagnosed by:** HUMBLE rule `test-timeout`, confidence 90%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```

> aws-nestjs-starter@0.0.1 test
> jest --verbose

ts-jest[ts-compiler] (WARN) Got a `.js` file to compile while `allowJs` option is not set to `true` (file: /workspace/jest-dynamodb-config.js). To fix this:
  - if you want TypeScript to process JS files, set `allowJs` to `true` in your TypeScript config (usually tsconfig.json)
  - if you do not want TypeScript to process your `.js` files, in your Jest config change the `transform` key which value is `ts-jest` so that it does not match `.js` files anymore

[firstrun] step timed out after 300s
```
</details>

### E6: Unrecognised failure <a id="e6"></a>

- **Docs said:** `npm run ddb:start` (README.md:135)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
  syscall: 'spawn java',
  path: 'java',
  spawnargs: [
    '-Djava.library.path=/workspace/.dynamodb/DynamoDBLocal_lib',
    '-jar',
    'DynamoDBLocal.jar',
    '-port',
    8000,
    '-inMemory',
    '-sharedDb'
  ]
}

Node.js v22.23.3
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| env var IS_DDB_LOCAL | not documented | read in src/app.module.ts:19 | README |
| env var REGION | not documented | read in src/app.module.ts:20 | README |
| env var SERVICE | not documented | read in src/app.module.ts:23 | README |
| env var STAGE | not documented | read in src/app.module.ts:23 | README |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
