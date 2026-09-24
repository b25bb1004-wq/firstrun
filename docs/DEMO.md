# Demo script (3–4 minutes)

The story: *setup docs are untested code. FirstRun tests them the way a newcomer lives them,
fixes them with proof, and keeps them true, with IBM Bob as the reasoning engine and the
newcomer's guide.*

Before recording:

```bash
node bin/firstrun.js clean
docker pull node:16 && docker pull node:20 && docker pull postgres:16-alpine && docker pull redis:7-alpine   # warm cache
rm -rf examples/acme-shop/.firstrun
node bin/firstrun.js ui --root examples --root audit        # dashboard on http://localhost:4173
```

## 0:00 · The pain (25 s)

Show `examples/acme-shop/README.md`. It looks fine. Say: *"Every repo has one of these. Nobody
tests it. Let's be the new hire."* Optional: split screen of a person following it and
failing at `npm install`.

## 0:25 · Seconds, no Docker: `firstrun plan` (20 s)

```bash
node bin/firstrun.js plan examples/acme-shop
```

Five docs-vs-code conflicts appear instantly: Node 16 vs `.nvmrc` 20, `.env.sample` doesn't
exist, `migrate` script renamed, `SESSION_SECRET` undocumented, Redis never started.
Say: *"That's reading. Now let's prove it."*

## 0:45 · The live run (75 s)

```bash
node bin/firstrun.js verify examples/acme-shop
```

Switch to the dashboard's run view. The agent strip lights up
Scout → Planner → Runner. Each README step becomes a card:

- `npm install` **fails** on Node 16 (EBADENGINE) → Doctor: *runtime-version* → the clean
  machine is rebuilt on Node 20 → **passes**. Evidence E1.
- `cp .env.sample .env` → *missing-file* → `.env.example` → passes. E2.
- `npm run migrate` → *missing-script* → `db:migrate`, which then reveals `SESSION_SECRET` →
  *missing-env* → added to `.env.example` → passes. E3, E4 (chained evidence).
- `npm run dev` crashes on `ECONNREFUSED :6379` → *missing-service* → Redis sidecar +
  `docker-compose.yml` patched → `/health` answers 200. E5.

Open one evidence record: **failing log → fix → passing log**. Say: *"No change without proof."*

## 2:00 · Replay from zero + Setup Passport (30 s)

The Verifier throws the machine away and replays the corrected guide in a brand-new container:
green in ~15 s. The **Setup Passport** stamps: VERIFIED · 5 breaks found · 5 fixed · 0 need a
human · clone → running in 14 s. Show the README diff: six small line edits, nothing else touched.

## 2:30 · IBM Bob (40 s)

- In **Bob IDE**, switch to the **🚀 FirstRun** mode and ask: *"Verify examples/notes-api-py and
  explain what a newcomer would have hit."* Bob calls `firstrun_plan` / `firstrun_verify` /
  `firstrun_status` over MCP and narrates the evidence.
- Show a failure no rule knows, diagnosed **by IBM Bob** (Bob Shell headless,
  `firstrun-doctor` mode): the evidence card is labelled "diagnosed by IBM Bob · 0.4 Bobcoins".
- Switch to **🧭 FirstRun Guide** in the fixed repo: Bob walks a newcomer through the verified
  steps and recognises a known failure signature. This is the Clicky-style onboarding buddy,
  grounded in a run that actually passed.

## 3:10 · The swarm + the number (30 s)

Dashboard → audit view: 16 real, popular open-source repos audited in parallel, tiles filling
in. Headline: **"N of 16 READMEs broke on a clean machine · K repaired automatically with
evidence."** (Numbers from `audit/real-16/audit.json`.)

## 3:40 · Close (15 s)

*"FirstRun makes the README the most tested file in the repo: verified, repaired with evidence,
and guarded on every PR. It saves new hires their first week and seniors their afternoons."*

---

### If something goes wrong live

- Pre-record the `verify` run: `node fixtures/replay.js --speed 4` replays a real recorded run
  into the dashboard with realistic timing.
- Everything the run produced is in `examples/acme-shop/.firstrun/out/`.
