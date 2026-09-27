# Setup Passport: nerdeveloper/hackathon-starter-kit

🟡 **PARTIAL**: HUMBLE followed this project's setup docs on a clean `node:10` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `d129ad7465` |
| Verified | 2026-09-27 09:43 UTC |
| Runtime | Node.js 10 (`node:10`) |
| Clone to running, from zero | **51s** |
| Steps followed | 4 from the docs, 1 added by HUMBLE |
| Breaks found / fixed | 1 / 1 |
| Needs a human | 2 |
| Done when | `GET http://127.0.0.1:3000/status` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `cp .env.variable.env variable.env` (README.md:108).

## Verified setup

```bash
cp env.variable.env variable.env
npm install
npm i -g ngrok
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Stale file reference <a id="e1"></a>

- **Docs said:** `cp .env.variable.env variable.env` (README.md:108)
- **Cause:** .env.variable.env does not exist; the repo ships env.variable.env.
- **Diagnosed by:** HUMBLE rule `missing-copy-source`, confidence 92%
- **Doc change:** cp env.variable.env variable.env
- **Result:** fixed and verified

<details><summary>Before (failing output)</summary>

```
cp: cannot stat '.env.variable.env': No such file or directory
```
</details>

<details><summary>Fix applied</summary>

```
step command → cp env.variable.env variable.env
```
</details>

<details><summary>After (passing output)</summary>

```

```
</details>

### E2: Unrecognised failure <a id="e2"></a>

- **Docs said:** `npm start` (README.md:119)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
[]     at Module.load (internal/modules/cjs/loader.js:653:32)
[]     at tryModuleLoad (internal/modules/cjs/loader.js:593:12)
[]     at Function.Module._load (internal/modules/cjs/loader.js:585:3)
[]     at Module.require (internal/modules/cjs/loader.js:692:17)
[]     at require (internal/modules/cjs/helpers.js:25:18)
[]     at Object.<anonymous> (/workspace/dist/controllers/authController.js:18:1)
[]     at Module._compile (internal/modules/cjs/loader.js:778:30)
[]     at Object.Module._extensions..js (internal/modules/cjs/loader.js:789:10)
[]     at Module.load (internal/modules/cjs/loader.js:653:32)
[]     at tryModuleLoad (internal/modules/cjs/loader.js:593:12)
[]     at Function.Module._load (internal/modules/cjs/loader.js:585:3)
[] [nodemon] app crashed - waiting for file changes before starting...

[firstrun] the server crashed during startup and is not listening on port 3000
```
</details>

### E3: Unrecognised failure <a id="e3"></a>

- **Docs said:** `npm test` (package.json:0)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```

      at Strategy.OAuth2Strategy (node_modules/passport-oauth2/lib/strategy.js:86:34)
      at new Strategy (node_modules/passport-google-oauth20/lib/strategy.js:52:18)
      at Object.<anonymous> (src/handlers/passport.ts:34:5)
      at Object.<anonymous> (src/controllers/authController.ts:5:1)
      at Object.<anonymous> (src/routes/index.ts:7:1)

Test Suites: 4 failed, 4 total
Tests:       0 total
Snapshots:   0 total
Time:        4.765s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
npm ERR! Test failed.  See above for more details.
```
</details>

## Docs vs. code

Found by reading the docs next to the manifests, compose file, CI and source:

| What | Docs say | Code says | Where |
|---|---|---|---|
| file .env.variable.env | cp .env.variable.env variable.env | does not exist in the repo | README.md:108 |
| env var SESSION_NAME | not documented | read in src/app.ts:47 | README |
| env var SENDGRID_USERNAME | not documented | read in src/handlers/mail.ts:8 | README |
| env var SENDGRID_PASSWORD | not documented | read in src/handlers/mail.ts:9 | README |
| env var GOOGLE_CLIENT_ID | not documented | read in src/handlers/passport.ts:36 | README |
| env var GOOGLE_CLIENT_SECRET | not documented | read in src/handlers/passport.ts:37 | README |
| env var GITHUB_CLIENT_ID | not documented | read in src/handlers/passport.ts:65 | README |
| env var GITHUB_CLIENT_SECRET | not documented | read in src/handlers/passport.ts:66 | README |
| env var TWITTER_CONSUMER_KEY | not documented | read in src/handlers/passport.ts:96 | README |
| env var TWITTER_CONSUMER_SECRET | not documented | read in src/handlers/passport.ts:97 | README |
| env var FACEBOOK_CLIENT_ID | not documented | read in src/handlers/passport.ts:126 | README |
| env var FACEBOOK_CLIENT_SECRET | not documented | read in src/handlers/passport.ts:127 | README |
| env var LINKEDIN_CLIENT_ID | not documented | read in src/handlers/passport.ts:156 | README |
| env var LINKEDIN_CLIENT_SECRET | not documented | read in src/handlers/passport.ts:157 | README |
| env var DROPBOX_CLIENT_ID | not documented | read in src/handlers/passport.ts:190 | README |
| env var DROPBOX_CLIENT_SECRET | not documented | read in src/handlers/passport.ts:191 | README |
| env var DISCORD_CLIENT_ID | not documented | read in src/handlers/passport.ts:220 | README |
| env var DISCORD_CLIENT_SECRET | not documented | read in src/handlers/passport.ts:221 | README |
| env var SLACK_CLIENT_ID | not documented | read in src/handlers/passport.ts:251 | README |
| env var SLACK_CLIENT_SECRET | not documented | read in src/handlers/passport.ts:252 | README |

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
