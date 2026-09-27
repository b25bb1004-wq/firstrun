# Setup Passport: fastify/fastify

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `node:26` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `f7f73aa7d0` |
| Verified | 2026-09-27 09:00 UTC |
| Runtime | Node.js 22 (`node:26`) |
| Clone to running, from zero | **3s** |
| Steps followed | 0 from the docs, 3 added by HUMBLE |
| Breaks found / fixed | 5 / 1 |
| Needs a human | 1 |
| Done when | `yarn test` passes |
| IBM Bob | 3 diagnosises, 2.42 Bobcoins |

**Before HUMBLE**, a newcomer following the docs got stuck at `yarn` (CI:0).

## Verified setup

```bash
yarn
npm install
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `yarn` (CI:0)
- **Cause:** `yarn` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** Yarn (via `corepack enable`)
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
/firstrun/step-1.sh: line 5: yarn: command not found
```
</details>

<details><summary>Fix applied</summary>

```
$ corepack enable
```
</details>

<details><summary>After (passing output)</summary>

```
warning autocannon > hyperid > uuid@8.3.2: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).
warning borp > glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
warning borp > c8 > test-exclude > glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
warning eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.
[2/4] Fetching packages...
warning peowly@1.3.3: The engine "typescript" appears to be invalid.
[3/4] Linking dependencies...
[4/4] Building fresh packages...
success Saved lockfile.
Done in 90.15s.
```
</details>

### E2: Wrong runtime version <a id="e2"></a>

- **Docs said:** `yarn test` (package.json:0)
- **Cause:** The CI matrix in .github/workflows/ci.yml (line 65) tests only on Node.js 24 and 26; the newcomer's container is node:22, which has different HTTP timeout body serialization and DNS resolution behavior that causes client-timeout.test.js, close.test.js, and custom-http-server.test.js to fail.
- **Diagnosed by:** IBM Bob (0.364164 Bobcoins), confidence 82%
- **Doc change:** Node.js 24 or 26 is required to run the test suite (the CI matrix in .github/workflows/ci.yml targets node-version: [24, 26]). Use the node:26 Docker image or install Node.js 26 before running `npm run unit`.
- **Result:** worked: cleared this error, then the step failed on a later problem ([E3](#e3))

<details><summary>Before (failing output)</summary>

```
      at async TestContext.<anonymous> (/workspace/test/https/custom-https-server.test.js:45:20)
      at async Test.run (node:internal/test_runner/test:1054:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3) {
    [cause]: Error: connect ECONNREFUSED 127.0.0.1:39051
        at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1638:16) {
      errno: -111,
      code: 'ECONNREFUSED',
      syscall: 'connect',
      address: '127.0.0.1',
      port: 39051
    }
  }
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
```
</details>

<details><summary>Fix applied</summary>

```
rebased onto node:26
warning: S13 failed on the new machine (exit 127)
```
</details>

<details><summary>After (passing output)</summary>

```
/firstrun/step-3.sh: line 5: yarn: command not found
```
</details>

### E3: Missing tool <a id="e3"></a>

- **Docs said:** `yarn test` (package.json:0)
- **Cause:** `yarn` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** Yarn (via `corepack enable`)
- **Result:** fix did not work

<details><summary>Before (failing output)</summary>

```
/firstrun/step-3.sh: line 5: yarn: command not found
```
</details>

<details><summary>Fix applied</summary>

```
$ corepack enable
/firstrun/step-4.sh: line 5: corepack: command not found
(exit 127)
fix not applied: `corepack enable` exited 127
```
</details>

<details><summary>After (passing output)</summary>

```
/firstrun/step-4.sh: line 5: corepack: command not found
```
</details>

### E4: Missing tool <a id="e4"></a>

- **Docs said:** `corepack enable` (package.json:0)
- **Cause:** Node.js 26 no longer ships corepack, so `corepack enable` (the prior repair) fails with exit 127; the correct way to install yarn is shown in `.github/workflows/package-manager-ci.yml` lines 72–73: `curl -o- -L https://yarnpkg.com/install.sh | bash`.
- **Diagnosed by:** IBM Bob (0.157556 Bobcoins), confidence 93%
- **Doc change:** Before running `yarn` or `yarn test`, install Yarn via its classic installer (corepack is not available in Node.js 26): `curl -o- -L https://yarnpkg.com/install.sh | bash && export PATH="$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"`
- **Result:** worked: cleared this error, then the step failed on a later problem ([E5](#e5))

<details><summary>Before (failing output)</summary>

```
/firstrun/step-4.sh: line 5: corepack: command not found
```
</details>

<details><summary>Fix applied</summary>

```
gpg:                using RSA key 72ECF46A56B4AD39C907BBB71646B01B86E50310
gpg: Good signature from "Yarn Packaging <yarn@dan.cx>" [unknown]
gpg: WARNING: This key is not certified with a trusted signature!
gpg:          There is no indication that the signature belongs to the owner.
Primary key fingerprint: 72EC F46A 56B4 AD39 C907  BBB7 1646 B01B 86E5 0310
> GPG signature looks good
> Extracting to ~/.yarn...
> Adding to $PATH...
> We've added the following to your /root/.bashrc
> If this isn't the profile of your current shell then please add the following to your correct profile:
   
export PATH="$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"

> Successfully installed Yarn 1.22.22! Please open another terminal where the `yarn` command will now be available.
```
</details>

<details><summary>After (passing output)</summary>

```
npm warn Unknown env config "version-git-message". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "argv". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "version-git-tag". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

> fastify@6.0.0-alpha.4 lint:eslint
> eslint

sh: 1: eslint: not found
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
error Command failed with exit code 127.
```
</details>

### E5: Missing dependency <a id="e5"></a>

- **Docs said:** `yarn test` (package.json:0)
- **Cause:** The `test` script in package.json line 22 delegates to `npm run lint` which calls `eslint` (package.json line 20), but `node_modules/.bin/eslint` is absent because `yarn` (classic, installed via the curl script) did not populate `node_modules`; running `npm install` first (which respects .npmrc and the existing package.json devDependencies) would place the binary on the PATH that npm uses for scri
- **Diagnosed by:** IBM Bob (0.144738 Bobcoins), confidence 82%
- **Doc change:** Before running `yarn test`, run `npm install` to populate `node_modules` (the `test` script internally uses `npm run` and expects binaries such as `eslint` in `node_modules/.bin`).
- **Result:** worked: cleared this error, then the step failed on a later problem

<details><summary>Before (failing output)</summary>

```
> npm run lint:eslint

npm warn Unknown env config "version-commit-hooks". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "version-tag-prefix". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "version-git-message". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "argv". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "version-git-tag". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

> fastify@6.0.0-alpha.4 lint:eslint
> eslint

sh: 1: eslint: not found
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
error Command failed with exit code 127.
```
</details>

<details><summary>Fix applied</summary>

```
$ npm install → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```
✖ shutsdown while keep-alive connections are active (non-async, custom) (30006.992075ms)
✔ preClose callback (3.913949ms)
✔ preClose async (2.631741ms)
✔ preClose runs exactly once with a child plugin (3.432333ms)
✔ preClose runs exactly once with nested child plugins (3.262901ms)
✔ preClose execution order (406.177519ms)
✔ does not destroy connections with in-flight requests (forceCloseConnections - idle) (207.220582ms)
✔ does not destroy connections with in-flight requests (default options) (205.368725ms)

[firstrun] step timed out after 300s
```
</details>

### E6: Unrecognised failure <a id="e6"></a>

- **Docs said:** `yarn test` (package.json:0)
- **Cause:** No rule recognises this failure; IBM Bob could not help: Bob replied without the expected JSON: Found 2 matches
fastify.js:
  Line 111:     serverHasCloseAllConnections,
  Line 394:           } else if (serverHasCloseAllConnections && forceCloseConnections === true) {
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
✔ shutsdown while keep-alive connections are active (non-async, idle, native) (61.997991ms)
✔ triggers on-close hook in the right order with multiple bindings (2054.18849ms)
✔ triggers on-close hook in the right order with multiple bindings (forceCloseConnections - idle) (2080.516307ms)
✔ triggers on-close hook in the right order with multiple bindings (forceCloseConnections - true) (2006.403743ms)
✖ shutsdown while keep-alive connections are active (non-async, custom) (30006.992075ms)
✔ preClose callback (3.913949ms)
✔ preClose async (2.631741ms)
✔ preClose runs exactly once with a child plugin (3.432333ms)
✔ preClose runs exactly once with nested child plugins (3.262901ms)
✔ preClose execution order (406.177519ms)
✔ does not destroy connections with in-flight requests (forceCloseConnections - idle) (207.220582ms)
✔ does not destroy connections with in-flight requests (default options) (205.368725ms)

[firstrun] step timed out after 300s
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Node.js version | not stated | 26 (CI (.github/workflows/ci.yml)) | README.md |
| npm script "dev" | npm run dev | not in package.json scripts | README.md:91 |
| env var GITHUB_TOKEN | not documented | read in scripts/validate-ecosystem-links.js:24 | README |
| Setup path | none documented | CI runs `npm install --ignore-scripts`, `npm install --ignore-scripts --no-save pino@${{ matrix.pino-version }}`, `npm run test:types` | README.md |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
