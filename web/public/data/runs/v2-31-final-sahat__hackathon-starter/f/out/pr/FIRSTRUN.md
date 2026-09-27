# Setup Passport: sahat/hackathon-starter

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `node:22` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `410fccec23` |
| Verified | 2026-09-27 00:30 UTC |
| Runtime | Node.js 22 (`node:22`) |
| Clone to running, from zero | **1m28s** |
| Steps followed | 7 from the docs, 1 added by HUMBLE |
| Breaks found / fixed | 1 / 1 |
| Needs a human | 4 |
| Done when | `GET http://127.0.0.1:8080/auth/facebook/callback` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `npm start` (README.md:143).

## Verified setup

```bash
npm install
docker run -d --name mongo -p 27017:27017 mongo:7
npm start
npm test
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Undocumented backing service <a id="e1"></a>

- **Docs said:** `npm start` (README.md:143)
- **Cause:** The app connects to MongoDB on localhost:27017, but the docs never start it.
- **Diagnosed by:** HUMBLE rule `missing-service`, confidence 92%
- **Doc change:** docker run -d --name mongo -p 27017:27017 mongo:7
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
    errorLabelSet: Set(3) { 'SystemOverloadedError', 'RetryableError', 'ResetPool' },
    beforeHandshake: false,
    [cause]: Error: connect ECONNREFUSED 127.0.0.1:27017
        at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1638:16) {
      errno: -111,
      code: 'ECONNREFUSED',
      syscall: 'connect',
      address: '127.0.0.1',
      port: 27017
    }
  }
}
MongoDB connection error. Please make sure MongoDB is running.
[firstrun] the server process has exited
```
</details>

<details><summary>Fix applied</summary>

```
started mongo:7 as "mongo" on localhost:27017
$ docker run -d --name mongo -p 27017:27017 mongo:7 → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```

> hackathon-starter@10.0.0 start
> npm run scss && node app.js


> hackathon-starter@10.0.0 scss
> sass --no-source-map --silence-deprecation=import --quiet-deps --load-path=./ --update ./public/css:./public/css


[firstrun] GET http://127.0.0.1:8080/auth/facebook/callback → 302
```
</details>

### E2: Unrecognised failure <a id="e2"></a>

- **Docs said:** `npm run test:e2e:replay` (README.md:1559)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                                |  40% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                        |  50% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                |  60% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                        |  70% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                |  80% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■        |  90% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■| 100% of 114.3 MiB
Chrome Headless Shell 153.0.8010.12 (playwright chromium-headless-shell v1243) downloaded to /root/.cache/ms-playwright/chromium_headless_shell-1243

> hackathon-starter@10.0.0 test:e2e:replay
> playwright test --config=test/playwright.config.js --project=chromium-replay


Error: http://127.0.0.1:8080 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.
```
</details>

### E3: Unrecognised failure <a id="e3"></a>

- **Docs said:** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium` (README.md:1566)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```

Error: http://127.0.0.1:8080 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.
```
</details>

### E4: Unrecognised failure <a id="e4"></a>

- **Docs said:** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium-replay` (README.md:1569)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```

Error: http://127.0.0.1:8080 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.
```
</details>

### E5: Unrecognised failure <a id="e5"></a>

- **Docs said:** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium-record` (README.md:1572)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```

Error: http://127.0.0.1:8080 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| Node.js version | not stated | 24 (package.json engines (">=24.18.0")) | README.md |
| env var RATE_LIMIT_GLOBAL | not documented | read in app.js:42 | .env.example |
| env var RATE_LIMIT_STRICT | not documented | read in app.js:43 | .env.example |
| env var RATE_LIMIT_LOGIN | not documented | read in app.js:44 | .env.example |
| mongodb service | setup never starts it | dependency "mongodb" | package.json |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
