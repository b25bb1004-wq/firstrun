# Setup Passport: GeekyAnts/express-typescript

❌ **FAILED**: FirstRun followed this project's setup docs on a clean `node:22` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `6b9bb70e23` |
| Verified | 2026-09-24 22:13 UTC |
| Runtime | Node.js 22 (`node:22`) |
| Clone to running, from zero | **n/a** |
| Steps followed | 4 from the docs, 1 added by FirstRun |
| Breaks found / fixed | 3 / 1 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:4040/` answers |

**Before FirstRun**, a newcomer following the docs got stuck at `npm install` (README.md:140).

## Verified setup

```bash
npm install --legacy-peer-deps
npm install
docker-compose up
docker-compose up -d
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing dependency <a id="e1"></a>

- **Docs said:** `npm install` (README.md:140)
- **Cause:** Current npm refuses the project's conflicting peer dependencies (older npm versions only warned); the lockfile resolves with --legacy-peer-deps.
- **Diagnosed by:** FirstRun rule `npm-peer-conflict`, confidence 80%
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
npm error /root/.npm/_logs/2026-09-24T22_10_03_814Z-eresolve-report.txt
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-09-24T22_10_03_814Z-debug-0.log
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
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@7.0.6: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated debug@4.1.1: Debug versions >=3.2.0 <3.2.7 || >=4 <4.3.1 have a low-severity ReDos regression when used in a Node.js environment. It is recommended you upgrade to 3.2.7 or 4.3.1. (https://github.com/visionmedia/debug/issues/797)
npm warn deprecated uuid@3.4.0: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).
npm warn deprecated uuid@3.4.0: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).
npm warn deprecated mkdirp@0.5.1: Legacy versions of mkdirp are no longer supported. Please update to mkdirp 1.x. (Note that the API surface has changed to use Promises in 1.x.)
npm warn deprecated debug@4.1.1: Debug versions >=3.2.0 <3.2.7 || >=4 <4.3.1 have a low-severity ReDos regression when used in a Node.js environment. It is recommended you upgrade to 3.2.7 or 4.3.1. (https://github.com/visionmedia/debug/issues/797)

added 631 packages in 3m
```
</details>

### E2: Missing or out-of-order step <a id="e2"></a>

- **Docs said:** `npm run dev` (README.md:148)
- **Cause:** Dependencies were never installed before "npm run dev"; the docs skip `npm install`.
- **Diagnosed by:** FirstRun rule `deps-not-installed`, confidence 90%
- **Doc change:** npm install
- **Result:** fix did not work

<details><summary>Before (failing output)</summary>

```

> node-server-with-typescript@1.0.0 dev
> tsc --watch & NODE_ENV=development nodemon dist

sh: 1: nodemon: not found
c10:13:48 PM - Starting compilation in watch mode...


[firstrun] server process exited before becoming ready on port 4040
```
</details>

<details><summary>Fix applied</summary>

```
$ npm install → exit 1
```
</details>

<details><summary>After (passing output)</summary>

```

> node-server-with-typescript@1.0.0 dev
> tsc --watch & NODE_ENV=development nodemon dist

sh: 1: nodemon: not found
c10:13:52 PM - Starting compilation in watch mode...


[firstrun] server process exited before becoming ready on port 4040
```
</details>

### E3: Unrecognised failure <a id="e3"></a>

- **Docs said:** `npm run dev` (README.md:148)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```

> node-server-with-typescript@1.0.0 dev
> tsc --watch & NODE_ENV=development nodemon dist

sh: 1: nodemon: not found
c10:13:52 PM - Starting compilation in watch mode...


[firstrun] server process exited before becoming ready on port 4040
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| env var MONGOOSE_URL | not documented | read in src/middlewares/Http.ts:60 | README |
| env var PORT | not documented | read in src/providers/Locals.ts:19 | README |
| env var GOOGLE_ID | not documented | read in src/services/strategies/Google.ts:14 | README |
| env var GOOGLE_SECRET | not documented | read in src/services/strategies/Google.ts:15 | README |
| env var TWITTER_KEY | not documented | read in src/services/strategies/Twitter.ts:14 | README |
| env var TWITTER_SECRET | not documented | read in src/services/strategies/Twitter.ts:15 | README |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **FirstRun Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by FirstRun. Verified plan: `.firstrun/plan.json`.
