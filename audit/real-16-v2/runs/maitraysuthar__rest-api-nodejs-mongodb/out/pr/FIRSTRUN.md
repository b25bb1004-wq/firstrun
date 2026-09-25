# Setup Passport: maitraysuthar/rest-api-nodejs-mongodb

🟡 **PARTIAL**: FirstRun followed this project's setup docs on a clean `node:16` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `6a1ba2da70` |
| Verified | 2026-09-25 19:25 UTC |
| Runtime | Node.js 16 (`node:16`) |
| Clone to running, from zero | **19s** |
| Steps followed | 4 from the docs, 0 added by FirstRun |
| Breaks found / fixed | 3 / 2 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:3000/` answers |

**Before FirstRun**, a newcomer following the docs got stuck at `npm install` (README.md:64).

## Verified setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Wrong runtime version <a id="e1"></a>

- **Docs said:** `npm install` (README.md:64)
- **Cause:** bcrypt ^3.0.6 does not build on Node.js 22: bcrypt ^3.0.6 in package.json supports Node.js 12–16 only (bcrypt's compatibility table); Node.js 18+ needs bcrypt >= 6. Node.js 16 is end-of-life, so upgrading bcrypt is the lasting fix.
- **Diagnosed by:** FirstRun rule `node-native-build`, confidence 85%
- **Doc change:** Node.js 16 (see bcrypt's compatibility table: bcrypt ^3.0.6 supports Node.js 12–16; upgrading to bcrypt >= 6 lets you use a current Node.js)
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
npm error gyp ERR! not ok 
npm error node-pre-gyp ERR! build error 
npm error node-pre-gyp ERR! stack Error: Failed to execute '/usr/local/bin/node /usr/local/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js build --fallback-to-build --module=/workspace/node_modules/bcrypt/lib/binding/bcrypt_lib.node --module_name=bcrypt_lib --module_path=/workspace/node_modules/bcrypt/lib/binding --napi_version=10 --node_abi_napi=napi --napi_build_version=0 --node_napi_label=node-v127' (1)
npm error node-pre-gyp ERR! stack     at ChildProcess.<anonymous> (/workspace/node_modules/node-pre-gyp/lib/util/compile.js:83:29)
npm error node-pre-gyp ERR! stack     at ChildProcess.emit (node:events:519:28)
npm error node-pre-gyp ERR! stack     at maybeClose (node:internal/child_process:1101:16)
npm error node-pre-gyp ERR! stack     at ChildProcess._handle.onexit (node:internal/child_process:304:5)
npm error node-pre-gyp ERR! System Linux 6.18.33.2-microsoft-standard-WSL2
npm error node-pre-gyp ERR! command "/usr/local/bin/node" "/workspace/node_modules/.bin/node-pre-gyp" "install" "--fallback-to-build"
npm error node-pre-gyp ERR! cwd /workspace/node_modules/bcrypt
npm error node-pre-gyp ERR! node -v v22.23.3
npm error node-pre-gyp ERR! node-pre-gyp -v v0.12.0
npm error node-pre-gyp ERR! not ok
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-09-25T19_23_57_903Z-debug-0.log
```
</details>

<details><summary>Fix applied</summary>

```
rebased onto node:16
```
</details>

<details><summary>After (passing output)</summary>

```
npm WARN deprecated is-accessor-descriptor@1.0.0: Please upgrade to v1.0.1
npm WARN deprecated is-data-descriptor@1.0.0: Please upgrade to v1.0.1
npm WARN deprecated is-accessor-descriptor@1.0.0: Please upgrade to v1.0.1
npm WARN deprecated is-data-descriptor@1.0.0: Please upgrade to v1.0.1
npm WARN deprecated debug@4.1.1: Debug versions >=3.2.0 <3.2.7 || >=4 <4.3.1 have a low-severity ReDos regression when used in a Node.js environment. It is recommended you upgrade to 3.2.7 or 4.3.1. (https://github.com/visionmedia/debug/issues/797)
npm WARN deprecated debug@4.1.1: Debug versions >=3.2.0 <3.2.7 || >=4 <4.3.1 have a low-severity ReDos regression when used in a Node.js environment. It is recommended you upgrade to 3.2.7 or 4.3.1. (https://github.com/visionmedia/debug/issues/797)
npm WARN deprecated bson@1.1.1: Fixed a critical issue with BSON serialization documented in CVE-2019-2391, see https://bit.ly/2KcpXdo for more details
npm WARN deprecated eslint@6.5.1: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 669 packages in 17s
```
</details>

### E2: Undocumented environment variable <a id="e2"></a>

- **Docs said:** `npm run dev` (README.md:117)
- **Cause:** MONGODB_URL=YourConnectionString is a placeholder in .env.example, and the app fails on it; FirstRun sets MONGODB_URL=mongodb://127.0.0.1:27017/rest-api-nodejs-mongodb (the commented example in .env.example).
- **Diagnosed by:** FirstRun rule `env-placeholder-value`, confidence 85%
- **Doc change:** `.env.example` now has a working local value for `MONGODB_URL` instead of a placeholder.
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
[nodemon] 1.19.4
[nodemon] to restart at any time, enter `rs`
[nodemon] watching dir(s): *.*
[nodemon] watching extensions: js,mjs,json
[nodemon] starting `node ./bin/www`
(node:315) Warning: Accessing non-existent property 'count' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
(node:315) Warning: Accessing non-existent property 'findOne' of module exports inside circular dependency
(node:315) Warning: Accessing non-existent property 'remove' of module exports inside circular dependency
(node:315) Warning: Accessing non-existent property 'updateOne' of module exports inside circular dependency
App starting error: Invalid connection string
[nodemon] app crashed - waiting for file changes before starting...

[firstrun] the server crashed during startup and is not listening on port 3000
```
</details>

<details><summary>Fix applied</summary>

```
patched .env.example
$ touch .env && { grep -v '^MONGODB_URL=' .env; printf '%s=%s\n' 'MONGODB_URL' 'mongodb://127.0.0.1:27017/rest-api-nodejs-mongodb'; } > /tmp/firstrun.env && mv /tmp/firstrun.env .env
```
</details>

<details><summary>After (passing output)</summary>

```
(node:543) Warning: Accessing non-existent property 'remove' of module exports inside circular dependency
(node:543) Warning: Accessing non-existent property 'updateOne' of module exports inside circular dependency

[firstrun] GET http://127.0.0.1:3000/ → 200
<body>
  <h1>A boilerplate for REST API Development with Node.js, Express, and MongoDB</h1>
  <p>Author: <a href="mailto:maitraysuthar@gmail.com">@Maitray Suthar</a></p>
</body>

</html>
```
</details>

### E3: Unrecognised failure <a id="e3"></a>

- **Docs said:** `npm test` (README.md:148)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
  constants.js         |      100 |      100 |      100 |      100 |                   |
  mailer.js            |       75 |      100 |        0 |       75 |                18 |
  utility.js           |     12.5 |        0 |        0 |    14.29 |       2,3,4,5,6,8 |
 workspace/middlewares |      100 |      100 |      100 |      100 |                   |
  jwt.js               |      100 |      100 |      100 |      100 |                   |
 workspace/models      |    88.89 |      100 |        0 |    88.89 |                   |
  BookModel.js         |      100 |      100 |      100 |      100 |                   |
  UserModel.js         |       80 |      100 |        0 |       80 |                18 |
 workspace/routes      |    96.55 |      100 |        0 |    96.55 |                   |
  api.js               |      100 |      100 |      100 |      100 |                   |
  auth.js              |      100 |      100 |      100 |      100 |                   |
  book.js              |      100 |      100 |      100 |      100 |                   |
  index.js             |       80 |      100 |        0 |       80 |                 6 |
-----------------------|----------|----------|----------|----------|-------------------|
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| mongodb service | setup never starts it | dependency "mongoose" | package.json |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **FirstRun Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by FirstRun. Verified plan: `.github/firstrun/plan.json`.
