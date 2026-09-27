# Setup Passport: mongodb-developer/mern-stack-example

❌ **FAILED**: HUMBLE followed this project's setup docs on a clean `buildpack-deps:bookworm` machine, repaired what broke, then replayed the corrected guide from zero.

| | |
|---|---|
| Commit | `6a5e9397b1` |
| Verified | 2026-09-27 09:45 UTC |
| Runtime | other 22 (`buildpack-deps:bookworm`) |
| Clone to running, from zero | **n/a** |
| Steps followed | 6 from the docs, 0 added by HUMBLE |
| Breaks found / fixed | 1 / 0 |
| Needs a human | 1 |
| Done when | `GET http://127.0.0.1:5173/` answers |

**Before HUMBLE**, a newcomer following the docs got stuck at `cd mern/server && node seed.js` (README.md:84).

## Verified setup

```bash
cp mern/server/config.env.example mern/server/config.env
cd mern/server
npm install
cd mern/client
npm run dev
```

## Evidence

Every change to the docs is backed by a command that failed before the fix and passed after it.

### E1: Missing tool <a id="e1"></a>

- **Docs said:** `cd mern/server && node seed.js` (README.md:84)
- **Cause:** `node` is not installed; the docs assume it is.
- **Diagnosed by:** HUMBLE rule `missing-tool`, confidence 80%
- **Doc change:** node
- **Result:** fix did not work

<details><summary>Before (failing output)</summary>

```
/firstrun/step-2.sh: line 5: node: command not found
```
</details>

<details><summary>Fix applied</summary>

```
Get:490 http://deb.debian.org/debian bookworm/main amd64 node-stack-utils all 2.0.6+~2.0.1-1 [9260 B]
Get:491 http://deb.debian.org/debian bookworm/main amd64 node-yaml all 2.1.3-2 [118 kB]
Get:492 http://deb.debian.org/debian bookworm/main amd64 node-tap-parser all 11.0.2+~cs2.1.4-1 [62.7 kB]
Get:493 http://deb.debian.org/debian bookworm/main amd64 node-tap-mocha-reporter all 5.0.3+~2.0.2-2 [38.7 kB]
Get:494 http://deb.debian.org/debian bookworm/main amd64 node-widest-line all 3.1.0-2 [4092 B]
Get:495 http://deb.debian.org/debian bookworm/main amd64 node-ws all 8.11.0+~cs13.7.3-1 [51.1 kB]
Get:496 http://deb.debian.org/debian bookworm/main amd64 node-tap all 16.3.2+ds1+~cs50.8.16-1+deb12u1 [101 kB]
Get:497 http://deb.debian.org/debian bookworm/main amd64 node-text-table all 0.2.0-4 [4736 B]
Get:498 http://deb.debian.org/debian bookworm/main amd64 nodejs-doc all 18.20.4+dfsg-1~deb12u2 [3581 kB]
Get:499 http://deb.debian.org/debian bookworm/main amd64 npm all 9.2.0~ds1-1 [669 kB]

[firstrun] step timed out after 600s
(exit 124)
fix not applied: `apt-get update && apt-get install -y nodejs npm` exited 124
```
</details>

<details><summary>After (passing output)</summary>

```
Get:492 http://deb.debian.org/debian bookworm/main amd64 node-tap-parser all 11.0.2+~cs2.1.4-1 [62.7 kB]
Get:493 http://deb.debian.org/debian bookworm/main amd64 node-tap-mocha-reporter all 5.0.3+~2.0.2-2 [38.7 kB]
Get:494 http://deb.debian.org/debian bookworm/main amd64 node-widest-line all 3.1.0-2 [4092 B]
Get:495 http://deb.debian.org/debian bookworm/main amd64 node-ws all 8.11.0+~cs13.7.3-1 [51.1 kB]
Get:496 http://deb.debian.org/debian bookworm/main amd64 node-tap all 16.3.2+ds1+~cs50.8.16-1+deb12u1 [101 kB]
Get:497 http://deb.debian.org/debian bookworm/main amd64 node-text-table all 0.2.0-4 [4736 B]
Get:498 http://deb.debian.org/debian bookworm/main amd64 nodejs-doc all 18.20.4+dfsg-1~deb12u2 [3581 kB]
Get:499 http://deb.debian.org/debian bookworm/main amd64 npm all 9.2.0~ds1-1 [669 kB]

[firstrun] step timed out after 600s
```
</details>

### E2: Unrecognised failure <a id="e2"></a>

- **Docs said:** `apt-get update && apt-get install -y nodejs npm` (README.md:84)
- **Cause:** No rule recognises this failure (run with --brain auto to ask IBM Bob).
- **Diagnosed by:** HUMBLE rule `undefined`, confidence 0%
- **Result:** needs a maintainer

<details><summary>Before (failing output)</summary>

```
Get:488 http://deb.debian.org/debian bookworm/main amd64 node-promzard all 0.3.0-2 [6788 B]
Get:489 http://deb.debian.org/debian bookworm/main amd64 node-shell-quote all 1.7.4+~1.7.1-1+deb12u1 [14.7 kB]
Get:490 http://deb.debian.org/debian bookworm/main amd64 node-stack-utils all 2.0.6+~2.0.1-1 [9260 B]
Get:491 http://deb.debian.org/debian bookworm/main amd64 node-yaml all 2.1.3-2 [118 kB]
Get:492 http://deb.debian.org/debian bookworm/main amd64 node-tap-parser all 11.0.2+~cs2.1.4-1 [62.7 kB]
Get:493 http://deb.debian.org/debian bookworm/main amd64 node-tap-mocha-reporter all 5.0.3+~2.0.2-2 [38.7 kB]
Get:494 http://deb.debian.org/debian bookworm/main amd64 node-widest-line all 3.1.0-2 [4092 B]
Get:495 http://deb.debian.org/debian bookworm/main amd64 node-ws all 8.11.0+~cs13.7.3-1 [51.1 kB]
Get:496 http://deb.debian.org/debian bookworm/main amd64 node-tap all 16.3.2+ds1+~cs50.8.16-1+deb12u1 [101 kB]
Get:497 http://deb.debian.org/debian bookworm/main amd64 node-text-table all 0.2.0-4 [4736 B]
Get:498 http://deb.debian.org/debian bookworm/main amd64 nodejs-doc all 18.20.4+dfsg-1~deb12u2 [3581 kB]
Get:499 http://deb.debian.org/debian bookworm/main amd64 npm all 9.2.0~ds1-1 [669 kB]

[firstrun] step timed out after 600s
```
</details>

## Keeping it true

The workflow in `.github/workflows/firstrun.yml` re-checks setup on every pull request that touches the README, manifests, env files or compose files, and comments when a change would break a newcomer's first run.

Newcomers using IBM Bob can switch to the **HUMBLE Guide** mode (`.bob/custom_modes.yaml`), which walks them through this verified setup one step at a time and recognises the known failure signatures above.

---
Generated by HUMBLE. Verified plan: `.github/firstrun/plan.json`.
