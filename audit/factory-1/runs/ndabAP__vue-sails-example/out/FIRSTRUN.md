# Setup Passport: ndabAP/vue-sails-example

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `node:16` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `2b2dd1dc3b` |
| Verified | 2026-09-27 10:08 UTC |
| Runtime | Node.js 16 (`node:16`) |
| Clone to running, from zero | **19s** |
| Steps followed | 5 from the docs, 0 added by HUMBLE |
| Breaks found / fixed | 4 / 0 |
| Needs a human | 2 |
| Done when | every step exits cleanly |

**Before HUMBLE**, a newcomer following the docs got stuck at `curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -` (README.md:31).

## Verified setup

```bash
sudo apt-get install -y nodejs
sudo npm install sails -g
cd ../backend && npm install
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Unrecognised failure <a id="e1"></a>

- **Docs said:** `curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -` (README.md:31)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
Hit:1 http://deb.debian.org/debian bookworm InRelease
Hit:2 http://deb.debian.org/debian bookworm-updates InRelease
Hit:3 http://deb.debian.org/debian-security bookworm-security InRelease
Reading package lists...

## Installing packages required for setup: lsb-release...

+ apt-get install -y lsb-release > /dev/null 2>&1

## Confirming "bookworm" is supported...

+ curl -sLf -o /dev/null 'https://deb.nodesource.com/node_10.x/dists/bookworm/Release'

## Your distribution, identified as "bookworm", is not currently supported, please contact NodeSource at https://github.com/nodesource/distributions/issues if you think this is incorrect or would like your distribution to be considered for support
```
</details>

### E2: Wrong runtime version <a id="e2"></a>

- **Docs said:** `cd frontend && npm install` (README.md:44)
- **Cause:** A native dependency does not build on Node.js 22; the project needs an older Node.js (native modules fail to build on Node.js 22 and the repo pins no version).
- **Diagnosed by:** HUMBLE rule `node-native-build`, confidence 60%
- **Doc change:** Node.js 20 (see the native-build errors: dependencies do not compile on newer versions)
- **Result:** worked: cleared this error, then the step failed on a later problem ([E3](#e3))

<details><summary>Before (failing output)</summary>

```
npm error gyp ERR! stack     at F (/workspace/frontend/node_modules/which/which.js:68:16)
npm error gyp ERR! stack     at E (/workspace/frontend/node_modules/which/which.js:80:29)
npm error gyp ERR! stack     at /workspace/frontend/node_modules/which/which.js:89:16
npm error gyp ERR! stack     at /workspace/frontend/node_modules/isexe/index.js:42:5
npm error gyp ERR! stack     at /workspace/frontend/node_modules/isexe/mode.js:8:5
npm error gyp ERR! stack     at FSReqCallback.oncomplete (node:fs:196:21)
npm error gyp ERR! System Linux 6.18.33.2-microsoft-standard-WSL2
npm error gyp ERR! command "/usr/local/bin/node" "/workspace/frontend/node_modules/node-gyp/bin/node-gyp.js" "rebuild" "--verbose" "--libsass_ext=" "--libsass_cflags=" "--libsass_ldflags=" "--libsass_library="
npm error gyp ERR! cwd /workspace/frontend/node_modules/node-sass
npm error gyp ERR! node -v v22.23.3
npm error gyp ERR! node-gyp -v v3.8.0
npm error gyp ERR! not ok 
npm error Build failed with error code: 1
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-09-27T09_41_32_638Z-debug-0.log
```
</details>

<details><summary>Fix applied</summary>

```
rebased onto node:20
warning: S1 failed on the new machine (exit 1)
```
</details>

<details><summary>After (passing output)</summary>

```
npm error gyp ERR! stack     at /workspace/frontend/node_modules/isexe/mode.js:8:5
npm error gyp ERR! stack     at FSReqCallback.oncomplete (node:fs:197:21)
npm error gyp ERR! System Linux 6.18.33.2-microsoft-standard-WSL2
npm error gyp ERR! command "/usr/local/bin/node" "/workspace/frontend/node_modules/node-gyp/bin/node-gyp.js" "rebuild" "--verbose" "--libsass_ext=" "--libsass_cflags=" "--libsass_ldflags=" "--libsass_library="
npm error gyp ERR! cwd /workspace/frontend/node_modules/node-sass
npm error gyp ERR! node -v v20.20.2
npm error gyp ERR! node-gyp -v v3.8.0
npm error gyp ERR! not ok 
npm error Build failed with error code: 1
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-09-27T09_50_46_779Z-debug-0.log
```
</details>

### E3: Wrong runtime version <a id="e3"></a>

- **Docs said:** `cd frontend && npm install` (README.md:44)
- **Cause:** A native dependency does not build on Node.js 20; the project needs an older Node.js (native modules fail to build on Node.js 20 and the repo pins no version).
- **Diagnosed by:** HUMBLE rule `node-native-build`, confidence 60%
- **Doc change:** Node.js 18 (see the native-build errors: dependencies do not compile on newer versions)
- **Result:** worked: cleared this error, then the step failed on a later problem ([E4](#e4))

<details><summary>Before (failing output)</summary>

```
npm error gyp ERR! stack     at F (/workspace/frontend/node_modules/which/which.js:68:16)
npm error gyp ERR! stack     at E (/workspace/frontend/node_modules/which/which.js:80:29)
npm error gyp ERR! stack     at /workspace/frontend/node_modules/which/which.js:89:16
npm error gyp ERR! stack     at /workspace/frontend/node_modules/isexe/index.js:42:5
npm error gyp ERR! stack     at /workspace/frontend/node_modules/isexe/mode.js:8:5
npm error gyp ERR! stack     at FSReqCallback.oncomplete (node:fs:197:21)
npm error gyp ERR! System Linux 6.18.33.2-microsoft-standard-WSL2
npm error gyp ERR! command "/usr/local/bin/node" "/workspace/frontend/node_modules/node-gyp/bin/node-gyp.js" "rebuild" "--verbose" "--libsass_ext=" "--libsass_cflags=" "--libsass_ldflags=" "--libsass_library="
npm error gyp ERR! cwd /workspace/frontend/node_modules/node-sass
npm error gyp ERR! node -v v20.20.2
npm error gyp ERR! node-gyp -v v3.8.0
npm error gyp ERR! not ok 
npm error Build failed with error code: 1
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-09-27T09_50_46_779Z-debug-0.log
```
</details>

<details><summary>Fix applied</summary>

```
rebased onto node:18
warning: S1 failed on the new machine (exit 1)
```
</details>

<details><summary>After (passing output)</summary>

```
npm error gyp ERR! stack     at /workspace/frontend/node_modules/isexe/mode.js:8:5
npm error gyp ERR! stack     at FSReqCallback.oncomplete (node:fs:202:21)
npm error gyp ERR! System Linux 6.18.33.2-microsoft-standard-WSL2
npm error gyp ERR! command "/usr/local/bin/node" "/workspace/frontend/node_modules/node-gyp/bin/node-gyp.js" "rebuild" "--verbose" "--libsass_ext=" "--libsass_cflags=" "--libsass_ldflags=" "--libsass_library="
npm error gyp ERR! cwd /workspace/frontend/node_modules/node-sass
npm error gyp ERR! node -v v18.20.8
npm error gyp ERR! node-gyp -v v3.8.0
npm error gyp ERR! not ok 
npm error Build failed with error code: 1
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-09-27T09_59_03_469Z-debug-0.log
```
</details>

### E4: Wrong runtime version <a id="e4"></a>

- **Docs said:** `cd frontend && npm install` (README.md:44)
- **Cause:** A native dependency does not build on Node.js 18; the project needs an older Node.js (native modules fail to build on Node.js 18 and the repo pins no version).
- **Diagnosed by:** HUMBLE rule `node-native-build`, confidence 60%
- **Doc change:** Node.js 16 (see the native-build errors: dependencies do not compile on newer versions)
- **Result:** worked: cleared this error, then the step failed on a later problem ([E5](#e5))

<details><summary>Before (failing output)</summary>

```
npm error gyp ERR! stack     at F (/workspace/frontend/node_modules/which/which.js:68:16)
npm error gyp ERR! stack     at E (/workspace/frontend/node_modules/which/which.js:80:29)
npm error gyp ERR! stack     at /workspace/frontend/node_modules/which/which.js:89:16
npm error gyp ERR! stack     at /workspace/frontend/node_modules/isexe/index.js:42:5
npm error gyp ERR! stack     at /workspace/frontend/node_modules/isexe/mode.js:8:5
npm error gyp ERR! stack     at FSReqCallback.oncomplete (node:fs:202:21)
npm error gyp ERR! System Linux 6.18.33.2-microsoft-standard-WSL2
npm error gyp ERR! command "/usr/local/bin/node" "/workspace/frontend/node_modules/node-gyp/bin/node-gyp.js" "rebuild" "--verbose" "--libsass_ext=" "--libsass_cflags=" "--libsass_ldflags=" "--libsass_library="
npm error gyp ERR! cwd /workspace/frontend/node_modules/node-sass
npm error gyp ERR! node -v v18.20.8
npm error gyp ERR! node-gyp -v v3.8.0
npm error gyp ERR! not ok 
npm error Build failed with error code: 1
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-09-27T09_59_03_469Z-debug-0.log
```
</details>

<details><summary>Fix applied</summary>

```
rebased onto node:16
warning: S1 failed on the new machine (exit 1)
warning: S2 failed on the new machine (exit 100)
```
</details>

<details><summary>After (passing output)</summary>

```
npm ERR! gyp ERR! System Linux 6.18.33.2-microsoft-standard-WSL2
npm ERR! gyp ERR! command "/usr/local/bin/node" "/workspace/frontend/node_modules/node-gyp/bin/node-gyp.js" "rebuild" "--verbose" "--libsass_ext=" "--libsass_cflags=" "--libsass_ldflags=" "--libsass_library="
npm ERR! gyp ERR! cwd /workspace/frontend/node_modules/node-sass
npm ERR! gyp ERR! node -v v16.20.2
npm ERR! gyp ERR! node-gyp -v v3.8.0
npm ERR! gyp ERR! not ok 
npm ERR! Build failed with error code: 1

npm ERR! A complete log of this run can be found in:
npm ERR!     /root/.npm/_logs/2026-09-27T10_03_17_683Z-debug-0.log
```
</details>

### E5: Wrong runtime version <a id="e5"></a>

- **Docs said:** `cd frontend && npm install` (README.md:44)
- **Cause:** A native dependency does not build on Node.js 16; the project needs an older Node.js (native modules fail to build on Node.js 16 and the repo pins no version).
- **Diagnosed by:** HUMBLE rule `node-native-build`, confidence 60%
- **Doc change:** Node.js 14 (see the native-build errors: dependencies do not compile on newer versions)
- **Result:** fix did not work

<details><summary>Before (failing output)</summary>

```
npm ERR! gyp ERR! stack Error: `make` failed with exit code: 2
npm ERR! gyp ERR! stack     at ChildProcess.onExit (/workspace/frontend/node_modules/node-gyp/lib/build.js:262:23)
npm ERR! gyp ERR! stack     at ChildProcess.emit (node:events:513:28)
npm ERR! gyp ERR! stack     at Process.ChildProcess._handle.onexit (node:internal/child_process:293:12)
npm ERR! gyp ERR! System Linux 6.18.33.2-microsoft-standard-WSL2
npm ERR! gyp ERR! command "/usr/local/bin/node" "/workspace/frontend/node_modules/node-gyp/bin/node-gyp.js" "rebuild" "--verbose" "--libsass_ext=" "--libsass_cflags=" "--libsass_ldflags=" "--libsass_library="
npm ERR! gyp ERR! cwd /workspace/frontend/node_modules/node-sass
npm ERR! gyp ERR! node -v v16.20.2
npm ERR! gyp ERR! node-gyp -v v3.8.0
npm ERR! gyp ERR! not ok 
npm ERR! Build failed with error code: 1

npm ERR! A complete log of this run can be found in:
npm ERR!     /root/.npm/_logs/2026-09-27T10_03_17_683Z-debug-0.log
```
</details>

<details><summary>Fix applied</summary>

```
rebase limit reached
```
</details>

<details><summary>After (passing output)</summary>

```
npm ERR! gyp ERR! System Linux 6.18.33.2-microsoft-standard-WSL2
npm ERR! gyp ERR! command "/usr/local/bin/node" "/workspace/frontend/node_modules/node-gyp/bin/node-gyp.js" "rebuild" "--verbose" "--libsass_ext=" "--libsass_cflags=" "--libsass_ldflags=" "--libsass_library="
npm ERR! gyp ERR! cwd /workspace/frontend/node_modules/node-sass
npm ERR! gyp ERR! node -v v16.20.2
npm ERR! gyp ERR! node-gyp -v v3.8.0
npm ERR! gyp ERR! not ok 
npm ERR! Build failed with error code: 1

npm ERR! A complete log of this run can be found in:
npm ERR!     /root/.npm/_logs/2026-09-27T10_07_06_286Z-debug-0.log
```
</details>

### E6: Unrecognised failure <a id="e6"></a>

- **Docs said:** `cd frontend && npm install` (README.md:44)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
npm ERR! gyp ERR! stack Error: `make` failed with exit code: 2
npm ERR! gyp ERR! stack     at ChildProcess.onExit (/workspace/frontend/node_modules/node-gyp/lib/build.js:262:23)
npm ERR! gyp ERR! stack     at ChildProcess.emit (node:events:513:28)
npm ERR! gyp ERR! stack     at Process.ChildProcess._handle.onexit (node:internal/child_process:293:12)
npm ERR! gyp ERR! System Linux 6.18.33.2-microsoft-standard-WSL2
npm ERR! gyp ERR! command "/usr/local/bin/node" "/workspace/frontend/node_modules/node-gyp/bin/node-gyp.js" "rebuild" "--verbose" "--libsass_ext=" "--libsass_cflags=" "--libsass_ldflags=" "--libsass_library="
npm ERR! gyp ERR! cwd /workspace/frontend/node_modules/node-sass
npm ERR! gyp ERR! node -v v16.20.2
npm ERR! gyp ERR! node-gyp -v v3.8.0
npm ERR! gyp ERR! not ok 
npm ERR! Build failed with error code: 1

npm ERR! A complete log of this run can be found in:
npm ERR!     /root/.npm/_logs/2026-09-27T10_07_06_286Z-debug-0.log
```
</details>

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
