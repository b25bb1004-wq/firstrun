# Setup Passport: sahat/hackathon-starter

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `node:22` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `410fccec23` |
| Verified | 2026-09-27 07:56 UTC |
| Runtime | Node.js 22 (`node:22`) |
| Clone to running, from zero | **5m34s** |
| Steps followed | 7 from the docs, 3 added by HUMBLE |
| Breaks found / fixed | 8 / 4 |
| Needs a human | 2 |
| Done when | `GET http://127.0.0.1:8080/auth/facebook/callback` answers |
| IBM Bob | 4 diagnosises, 1.87 Bobcoins |

**Before HUMBLE**, a newcomer following the docs got stuck at `npm start` (README.md:143).

## Verified setup

```bash
npm install
docker run -d --name mongo -p 27017:27017 mongo:7
npm start
npm test
pkill -f 'node app.js' || true
npx playwright install-deps chromium
npm run test:e2e:replay
npx playwright test test/e2e/nyt.e2e.test.js --config=test/playwright.config.js --project=chromium-replay
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

> hackathon-starter@10.0.0 scss
> sass --no-source-map --silence-deprecation=import --quiet-deps --load-path=./ --update ./public/css:./public/css

Run this app using "npm start" to include sass/scss/css builds.

App is running on http://localhost:8080 in development mode.
Press CTRL-C to stop.

[firstrun] GET http://127.0.0.1:8080/auth/facebook/callback → 302
```
</details>

### E2: Missing or out-of-order step <a id="e2"></a>

- **Docs said:** `npm run test:e2e:replay` (README.md:1559)
- **Cause:** test/playwright.config.js line 92 sets `reuseExistingServer: !process.env.CI`; the node:22 Docker image sets CI=true in its environment, so reuseExistingServer becomes false — Playwright then refuses to start because the app from step S4 (npm start) is already bound to port 8080.
- **Diagnosed by:** IBM Bob (0.195612 Bobcoins), confidence 95%
- **Doc change:** If you have the app already running (e.g. from `npm start`), stop it before running `npm run test:e2e:replay` when the CI environment variable is set; or ensure CI is unset so Playwright can reuse the existing server automatically.
- **Suggested code change for the maintainer (not applied):** `test/playwright.config.js`
- **Result:** fixed and verified

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

<details><summary>Fix applied</summary>

```
$ pkill -f 'node app.js' || true → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```
[WebServer]     at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
[WebServer]     at async exports.postTwilio (/workspace/controllers/api.js:550:25) {
[WebServer]   status: 400,
[WebServer]   code: 21614,
[WebServer]   moreInfo: 'https://www.twilio.com/docs/errors/21614',
[WebServer]   details: undefined
[WebServer] }
·····························
  14 skipped
  49 passed (1.4m)
```
</details>

### E3: Missing tool <a id="e3"></a>

- **Docs said:** `npm run test:e2e:replay` (README.md:1559)
- **Cause:** Playwright's Chromium is downloaded, but this Linux machine lacks the system libraries it needs to start, so every browser test fails at launch. The docs skip `npx playwright install-deps`.
- **Diagnosed by:** HUMBLE rule `browser-system-libs`, confidence 88%
- **Doc change:** npx playwright install-deps chromium
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
    [chromium-replay] › test/e2e/foursquare.e2e.test.js:17:3 › Foursquare Places API Integration › should render Trending Venues table with data 
    [chromium-replay] › test/e2e/giphy.e2e.test.js:17:3 › GIPHY API › should show results on a fresh page load 
    [chromium-replay] › test/e2e/llm-classifier.e2e.test.js:6:3 › LLM Classifier Integration › should launch app, navigate to LLM Classifier page, and handle API response 
    [chromium-replay] › test/e2e/nyt.e2e.test.js:17:3 › New York Times API Integration › should render basic page content 
    [chromium-replay] › test/e2e/twilio.e2e.test.js:17:3 › Twilio API Integration › should launch app, navigate to Twilio API page, and render basic page elements 
    [chromium-replay] › test/e2e-nokey/github-api.e2e.test.js:60:3 › GitHub API Integration › should launch app, navigate to GitHub API page, and handle API response 
    [chromium-replay] › test/e2e-nokey/lastfm.e2e.test.js:17:3 › Last.fm API Integration › should launch app, navigate to Last.fm API page, and handle API response 
    [chromium-replay] › test/e2e-nokey/pubchem.e2e.test.js:19:3 › PubChem API Integration › should launch app, navigate to PubChem API page, and handle API response 
    [chromium-replay] › test/e2e-nokey/scraping.e2e.test.js:4:3 › Web Scraping Integration › should display scraped Hacker News links with proper page structure 
    [chromium-replay] › test/e2e-nokey/theme.e2e.test.js:24:3 › Dark mode toggle › stamps data-bs-theme on <html> on first paint and exposes a toggle button 
    [chromium-replay] › test/e2e-nokey/upload.e2e.test.js:19:3 › File Upload API Integration › should upload a small file successfully 
    [chromium-replay] › test/e2e-nokey/wikipedia.e2e.test.js:17:3 › Wikipedia Example › should display Content Example: Node.js elements 
  14 skipped
  36 did not run
```
</details>

<details><summary>Fix applied</summary>

```
$ npx playwright install-deps chromium → exit 0
```
</details>

<details><summary>After (passing output)</summary>

```
[WebServer]     at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
[WebServer]     at async exports.postTwilio (/workspace/controllers/api.js:550:25) {
[WebServer]   status: 400,
[WebServer]   code: 21614,
[WebServer]   moreInfo: 'https://www.twilio.com/docs/errors/21614',
[WebServer]   details: undefined
[WebServer] }
·····························
  14 skipped
  49 passed (1.4m)
```
</details>

### E4: Stale file reference <a id="e4"></a>

- **Docs said:** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium` (README.md:1566)
- **Cause:** README.md lines 1566–1572 show `test/e2e.../testfile.e2e.test.js` as the literal command, but `e2e...` is a placeholder that doesn't match any real path — the actual test directories are `test/e2e/` and `test/e2e-nokey/`, so Playwright finds no tests.
- **Diagnosed by:** IBM Bob (0.13505 Bobcoins), confidence 97%
- **Doc change:** Replace `test/e2e.../testfile.e2e.test.js` with a real example path such as `test/e2e/nyt.e2e.test.js` (or `test/e2e-nokey/scraping.e2e.test.js` for a no-key example) so readers understand the directory structure and the command works when copied verbatim.
- **Result:** worked: cleared this error, then the step failed on a later problem

<details><summary>Before (failing output)</summary>

```
[WebServer] WARNING: The BASE_URL environment variable and the App have a port mismatch. If you plan to view the app in your browser using the localhost address, you may need to adjust one of the ports to make them match. BASE_URL: http://localhost:8080
[WebServer] 

Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.
```
</details>

<details><summary>Fix applied</summary>

```
patched README.md
step command → npx playwright test test/e2e/nyt.e2e.test.js --config=test/playwright.config.js --project=chromium
```
</details>

<details><summary>After (passing output)</summary>

```
      22 |     const bestSellersTable = sharedPage.locator('table.table');
        at /workspace/test/e2e/nyt.e2e.test.js:19:30

    Error Context: tmp/playwright-artifacts/e2e-nyt.e2e-New-York-Times-a1fad-d-render-basic-page-content-chromium-retry2/error-context.md

    Error Context: tmp/playwright-artifacts/e2e-nyt.e2e-New-York-Times-a1fad-d-render-basic-page-content-chromium-retry2/error-context.md

  1 failed
    [chromium] › test/e2e/nyt.e2e.test.js:17:3 › New York Times API Integration › should render basic page content 
  1 did not run
```
</details>

### E5: Needs a real credential <a id="e5"></a>

- **Docs said:** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium` (README.md:1566)
- **Cause:** This step needs a real third-party credential; HUMBLE will not invent one.
- **Diagnosed by:** HUMBLE rule `secret-required`, confidence 70%
- **Needs your key:** `API key`. Set it with `firstrun secrets set undefined`, then prove it again. The value stays in your local key store.
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
    > 19 |     await expect(sharedPage).toHaveTitle(/New York Times API/);
         |                              ^
      20 |     await expect(sharedPage.locator('h2')).toContainText('New York Times API');
      21 |     // Locate the main table and verify header columns
      22 |     const bestSellersTable = sharedPage.locator('table.table');
        at /workspace/test/e2e/nyt.e2e.test.js:19:30

    Error Context: tmp/playwright-artifacts/e2e-nyt.e2e-New-York-Times-a1fad-d-render-basic-page-content-chromium-retry2/error-context.md

    Error Context: tmp/playwright-artifacts/e2e-nyt.e2e-New-York-Times-a1fad-d-render-basic-page-content-chromium-retry2/error-context.md

  1 failed
    [chromium] › test/e2e/nyt.e2e.test.js:17:3 › New York Times API Integration › should render basic page content 
  1 did not run
```
</details>

### E6: Stale file reference <a id="e6"></a>

- **Docs said:** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium-replay` (README.md:1569)
- **Cause:** README.md line 1569 uses the placeholder path `test/e2e.../testfile.e2e.test.js` — the `...` makes it an invalid pattern that matches no real files, so Playwright exits with 'No tests found'; the correct form shown elsewhere in the docs (e.g. README.md:1566 / S8) is a concrete path like `test/e2e/nyt.e2e.test.js`.
- **Diagnosed by:** IBM Bob (0.13223000000000001 Bobcoins), confidence 97%
- **Doc change:** Replace `test/e2e.../testfile.e2e.test.js` with a real file path such as `test/e2e/nyt.e2e.test.js` in all three single-file example commands (README.md lines 1566, 1569, 1572); the `...` placeholder is not a valid glob and causes Playwright to report 'No tests found'.
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
[WebServer] WARNING: The BASE_URL environment variable and the App have a port mismatch. If you plan to view the app in your browser using the localhost address, you may need to adjust one of the ports to make them match. BASE_URL: http://localhost:8080
[WebServer] 

Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.
```
</details>

<details><summary>Fix applied</summary>

```
patched README.md
step command → npx playwright test test/e2e/nyt.e2e.test.js --config=test/playwright.config.js --project=chromium-replay
```
</details>

<details><summary>After (passing output)</summary>

```
[WebServer] WARNING: The BASE_URL environment variable and the App have a port mismatch. If you plan to view the app in your browser using the localhost address, you may need to adjust one of the ports to make them match. BASE_URL: http://localhost:8080
[WebServer] 

Running 2 tests using 1 worker
(node:4703) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
··
  2 passed (9.1s)
```
</details>

### E7: Stale file reference <a id="e7"></a>

- **Docs said:** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium-record` (README.md:1572)
- **Cause:** README.md line 1572 uses a literal placeholder path 'test/e2e.../testfile.e2e.test.js' instead of a real example file (e.g. 'test/e2e/nyt.e2e.test.js'), so Playwright finds no files matching that pattern and exits with 'No tests found'.
- **Diagnosed by:** IBM Bob (0.134498 Bobcoins), confidence 97%
- **Doc change:** Replace 'test/e2e.../testfile.e2e.test.js' with a real example path such as 'test/e2e/nyt.e2e.test.js' in all three single-file example commands (README.md lines 1566, 1569, 1572).
- **Result:** worked: cleared this error, then the step failed on a later problem

<details><summary>Before (failing output)</summary>

```
[WebServer] WARNING: The BASE_URL environment variable and the App have a port mismatch. If you plan to view the app in your browser using the localhost address, you may need to adjust one of the ports to make them match. BASE_URL: http://localhost:8080
[WebServer] 

Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.
```
</details>

<details><summary>Fix applied</summary>

```
patched README.md
step command → npx playwright test test/e2e/nyt.e2e.test.js --config=test/playwright.config.js --project=chromium-record
```
</details>

<details><summary>After (passing output)</summary>

```
      22 |     const bestSellersTable = sharedPage.locator('table.table');
        at /workspace/test/e2e/nyt.e2e.test.js:19:30

    Error Context: tmp/playwright-artifacts/e2e-nyt.e2e-New-York-Times-a1fad-d-render-basic-page-content-chromium-record-retry2/error-context.md

    Error Context: tmp/playwright-artifacts/e2e-nyt.e2e-New-York-Times-a1fad-d-render-basic-page-content-chromium-record-retry2/error-context.md

  1 failed
    [chromium-record] › test/e2e/nyt.e2e.test.js:17:3 › New York Times API Integration › should render basic page content 
  1 did not run
```
</details>

### E8: Needs a real credential <a id="e8"></a>

- **Docs said:** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium-record` (README.md:1572)
- **Cause:** This step needs a real third-party credential; HUMBLE will not invent one.
- **Diagnosed by:** HUMBLE rule `secret-required`, confidence 70%
- **Needs your key:** `API key`. Set it with `firstrun secrets set undefined`, then prove it again. The value stays in your local key store.
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
    > 19 |     await expect(sharedPage).toHaveTitle(/New York Times API/);
         |                              ^
      20 |     await expect(sharedPage.locator('h2')).toContainText('New York Times API');
      21 |     // Locate the main table and verify header columns
      22 |     const bestSellersTable = sharedPage.locator('table.table');
        at /workspace/test/e2e/nyt.e2e.test.js:19:30

    Error Context: tmp/playwright-artifacts/e2e-nyt.e2e-New-York-Times-a1fad-d-render-basic-page-content-chromium-record-retry2/error-context.md

    Error Context: tmp/playwright-artifacts/e2e-nyt.e2e-New-York-Times-a1fad-d-render-basic-page-content-chromium-record-retry2/error-context.md

  1 failed
    [chromium-record] › test/e2e/nyt.e2e.test.js:17:3 › New York Times API Integration › should render basic page content 
  1 did not run
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
