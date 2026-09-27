# Install HUMBLE

HUMBLE follows a repository's setup docs on a clean machine, repairs what breaks with evidence, and publishes a verified guide.

## One-liner (CLI)

```bash
# Verify a repo's setup docs (needs Docker)
npx github:b25bb1004-wq/firstrun verify https://github.com/owner/repo

# Or from a local clone
npx github:b25bb1004-wq/firstrun verify .
```

This runs the full pipeline: Scout → Plan → Runner → Doctor → Verifier → Scribe.
You get a corrected README diff, a Setup Passport badge, and the evidence report (`FIRSTRUN.md`).

## Desktop App (FirstRun Lens)

**Windows (NSIS installer)** / **macOS (DMG)**

```bash
# From the HUMBLE repo
cd lens && npm install && npm run dist
```

This builds:
- `lens/dist/HUMBLE Setup <version>.exe` (Windows, unsigned NSIS)
- `lens/dist/HUMBLE-<version>.dmg` (macOS, unsigned)

Launch HUMBLE, press **Ctrl+Shift+Space**, circle anything on screen, and ask about it. Known HUMBLE fixes come first; IBM Bob handles the rest.

> **Note:** Icons use `web/public/brand/humble-mark.svg` if present; otherwise a TODO placeholder is used.

## Maintainer Flow (Publish a Verified Guide)

1. **Verify** the repo on a clean machine:
   ```bash
   firstrun verify . --brain rules --bob-budget 4
   ```

2. **Publish the guide** from the verified run:
   ```bash
   firstrun publish-guide --from .firstrun/run-<id> --out .
   ```
   This writes `.humble/guide.json` (+ `.humble/passport.json`) with:
   - Schema version (`humble.guide/1`)
   - Run ID, commit SHA, and date
   - Only proven steps (no skipped, no unverified)

3. **Commit `.humble/`** to the repo. Newcomers can now run:
   ```bash
   npx humble onboard
   # or
   humble onboard
   ```

4. **Add the Setup Passport badge** to your README:
   ```markdown
   ![HUMBLE](.github/firstrun/passport.svg)
   ```
   The badge links to `.github/firstrun/passport.json`.

5. **CI Integration** (optional): add a workflow that runs `firstrun verify` on every PR to catch docs drift.

## For Newcomers (Zero Setup)

If a repo has `.humble/guide.json`:

```bash
# In the repo root
npx humble onboard
```

The guide runs step-by-step on your machine, checking what's already satisfied and only prompting for what's needed.

## Requirements

- **Node.js >= 20**
- **Docker Desktop** (for `verify` / audit)
- **Windows**: WSL or Git Bash recommended (steps verified on Linux)

## Bob IDE Integration

Install HUMBLE's custom modes for Bob Shell:
```bash
firstrun bob install
```
Then switch to **🚀 HUMBLE** mode in Bob IDE and say:
> `HUMBLE, prove the setup docs for https://github.com/owner/repo`