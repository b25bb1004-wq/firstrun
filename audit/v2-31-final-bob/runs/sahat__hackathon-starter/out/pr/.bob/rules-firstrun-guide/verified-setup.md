# Verified setup for sahat/hackathon-starter

Verified by HUMBLE on 2026-09-27 at commit `410fccec23` on a clean `node:22` machine. Clone to running took 334s.

Prerequisites: Node.js 22, Docker (for backing services).

## Steps

1. `npm install`
   - Kind: install
   - Expect: exits with code 0.
2. `docker run -d --name mongo -p 27017:27017 mongo:7`
   - Kind: services (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
3. `npm start`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:8080/auth/facebook/callback (HTTP 302). Leave it running in its own terminal.
4. `npm test`
   - Kind: test
   - Expect: exits with code 0.
5. `pkill -f 'node app.js' || true`
   - Kind: other (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
6. `npx playwright install-deps chromium`
   - Kind: prereq (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
7. `npm run test:e2e:replay`
   - Kind: test
   - Expect: exits with code 0.
8. `npx playwright test test/e2e/nyt.e2e.test.js --config=test/playwright.config.js --project=chromium-replay`
   - Kind: test (the README used to say `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium-replay`)
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `[cause]: Error: connect ECONNREFUSED 127.0.0.1:27017` | The app connects to MongoDB on localhost:27017, but the docs never start it. | docker run -d --name mongo -p 27017:27017 mongo:7 |
| `Error: http://127.0.0.1:8080 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.` | test/playwright.config.js line 92 sets `reuseExistingServer: !process.env.CI`; the node:22 Docker image sets CI=true in its environment, so reuseExistingServer becomes false — Playwright then refuses to start because the app from step S4 (npm start) is already bound to port 8080. | If you have the app already running (e.g. from `npm start`), stop it before running `npm run test:e2e:replay` when the CI environment variable is set; or ensure CI is unset so Playwright can reuse the existing server automatically. |
| `- [pid=1762] exception while trying to kill process: Error: kill ESRCH` | Playwright's Chromium is downloaded, but this Linux machine lacks the system libraries it needs to start, so every browser test fails at launch. The docs skip `npx playwright install-deps`. | npx playwright install-deps chromium |
| `Error: No tests found.` | README.md line 1569 uses the placeholder path `test/e2e.../testfile.e2e.test.js` — the `...` makes it an invalid pattern that matches no real files, so Playwright exits with 'No tests found'; the correct form shown elsewhere in the docs (e.g. README.md:1566 / S8) is a concrete path like `test/e2e/nyt.e2e.test.js`. | Replace `test/e2e.../testfile.e2e.test.js` with a real file path such as `test/e2e/nyt.e2e.test.js` in all three single-file example commands (README.md lines 1566, 1569, 1572); the `...` placeholder is not a valid glob and causes Playwright to report 'No tests found'. |
