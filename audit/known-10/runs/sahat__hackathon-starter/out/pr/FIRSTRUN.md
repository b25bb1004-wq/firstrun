# Setup Passport: sahat/hackathon-starter

🟡 **PARTIAL**: FirstRun followed this project's setup docs on a clean `node:22` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `410fccec23` |
| Verified | 2026-09-25 20:12 UTC |
| Runtime | Node.js 22 (`node:22`) |
| Clone to running, from zero | **1m11s** |
| Steps followed | 8 from the docs, 0 added by FirstRun |
| Breaks found / fixed | 6 / 0 |
| Needs a human | 6 |
| Done when | `GET http://127.0.0.1:8080/auth/facebook/callback` answers |

**Before FirstRun**, a newcomer following the docs got stuck at `npm start` (README.md:143).

## Verified setup

```bash
npm install
npm test
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Unrecognised failure <a id="e1"></a>

- **Docs said:** `npm start` (README.md:143)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
> npm run scss && node app.js


> hackathon-starter@10.0.0 scss
> sass --no-source-map --silence-deprecation=import --quiet-deps --load-path=./ --update ./public/css:./public/css

Run this app using "npm start" to include sass/scss/css builds.

App is running on http://localhost:8080 in development mode.
Press CTRL-C to stop.

[firstrun] GET http://127.0.0.1:8080/auth/facebook/callback → no response
curl: (7) Failed to connect to 127.0.0.1 port 8080 after 0 ms: Couldn't connect to server
000
```
</details>

### E2: Unrecognised failure <a id="e2"></a>

- **Docs said:** `npm run test:e2e:live` (README.md:1558)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
    [chromium] › test/e2e/here-maps.e2e.test.js:39:3 › HERE Maps API Integration › should initialize and render HERE Maps successfully 
    [chromium] › test/e2e/llm-classifier.e2e.test.js:6:3 › LLM Classifier Integration › should launch app, navigate to LLM Classifier page, and handle API response 
    [chromium] › test/e2e/lob.e2e.test.js:26:3 › Lob API Integration › should validate ZIP code API response format 
    [chromium] › test/e2e/nyt.e2e.test.js:17:3 › New York Times API Integration › should render basic page content 
    [chromium] › test/e2e/rag.e2e.test.js:136:3 › RAG File Upload Integration › should validate question submission functionality 
    [chromium] › test/e2e/twilio.e2e.test.js:17:3 › Twilio API Integration › should launch app, navigate to Twilio API page, and render basic page elements 
    [chromium] › test/e2e-nokey/github-api.e2e.test.js:60:3 › GitHub API Integration › should launch app, navigate to GitHub API page, and handle API response 
    [chromium] › test/e2e-nokey/lastfm.e2e.test.js:17:3 › Last.fm API Integration › should launch app, navigate to Last.fm API page, and handle API response 
    [chromium] › test/e2e-nokey/pubchem.e2e.test.js:19:3 › PubChem API Integration › should launch app, navigate to PubChem API page, and handle API response 
    [chromium] › test/e2e-nokey/scraping.e2e.test.js:4:3 › Web Scraping Integration › should display scraped Hacker News links with proper page structure 
    [chromium] › test/e2e-nokey/theme.e2e.test.js:24:3 › Dark mode toggle › stamps data-bs-theme on <html> on first paint and exposes a toggle button 
    [chromium] › test/e2e-nokey/upload.e2e.test.js:19:3 › File Upload API Integration › should upload a small file successfully 
    [chromium] › test/e2e-nokey/wikipedia.e2e.test.js:17:3 › Wikipedia Example › should display Content Example: Node.js elements 
  46 did not run
```
</details>

### E3: Unrecognised failure <a id="e3"></a>

- **Docs said:** `npm run test:e2e:replay` (README.md:1559)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

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

### E4: Unrecognised failure <a id="e4"></a>

- **Docs said:** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium` (README.md:1566)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
[WebServer] WARNING: The BASE_URL environment variable and the App have a port mismatch. If you plan to view the app in your browser using the localhost address, you may need to adjust one of the ports to make them match. BASE_URL: http://localhost:8080
[WebServer] 

Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.
```
</details>

### E5: Unrecognised failure <a id="e5"></a>

- **Docs said:** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium-replay` (README.md:1569)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
[WebServer] WARNING: The BASE_URL environment variable and the App have a port mismatch. If you plan to view the app in your browser using the localhost address, you may need to adjust one of the ports to make them match. BASE_URL: http://localhost:8080
[WebServer] 

Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.
```
</details>

### E6: Unrecognised failure <a id="e6"></a>

- **Docs said:** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium-record` (README.md:1572)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** FirstRun rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
[WebServer] WARNING: The BASE_URL environment variable and the App have a port mismatch. If you plan to view the app in your browser using the localhost address, you may need to adjust one of the ports to make them match. BASE_URL: http://localhost:8080
[WebServer] 

Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.
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

Newcomers using IBM Bob can switch to the **FirstRun Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by FirstRun. Verified plan: `.github/firstrun/plan.json`.
