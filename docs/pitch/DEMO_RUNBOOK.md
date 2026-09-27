# HUMBLE demo runbook (record in one take)

Follows `docs/pitch/NARRATION.md` timecodes. Record screen only; the voice-over goes on in the edit.
Anything sped up gets an on-screen label ("8× speed"). Anything cut gets a visible cut.
acme-shop is always labelled *demo repo, seeded breaks*.

**CLI demo repo: GeekyAnts/express-typescript @ `6b9bb70e23f304e2bb243d076a567b8454eb05e8`** (the narrated one).
Rehearsal on 27 Sep on this PC: **VERIFIED, 5 found · 5 fixed, exit 0, 10 min 29 s wall** (clone → first ERESOLVE ~1 min; install retry 3 min; replay 2 min 08 s; Docker shared with another audit).
Faster VERIFIED repos exist (przemek-nowicki/node-express-template.ts: 90 s, 2 breaks; hagopj13: 162 s, 1 break),
but only GeekyAnts matches the script (ERESOLVE → `--legacy-peer-deps`, 5 of 5). Keep it and speed it up.
Backup if short on time: `node bin/firstrun.js verify examples/acme-shop --brain rules` ran VERIFIED 5/5 in 69 s today, but it is the seeded demo repo (label it) and does not match the ERESOLVE lines.

---

## Pre-flight (10 min before)

- [ ] Docker Desktop up: `docker info` works. Do **not** run `firstrun clean` or `docker prune`: another audit shares Docker.
- [ ] Images already local: `node:22 node:16 node:20 mongo mongo:4.4 redis` (`docker images` shows them).
- [ ] Terminal: **Windows Terminal, Git Bash profile**, font 18+, `cd /c/Users/ADMIN/fr-int`. Clear it (`clear`).
- [ ] HUMBLE desktop app running (from `lens/`: `npx electron .`). Tray icon present, floating HUMBLE button top-left.
- [ ] Bob signed in: `bob --version` prints 2.0.5 and Bob Shell is logged in with the hackathon IBMid (Lens "Ask IBM Bob" needs it).
- [ ] acme-shop has a fresh verified run (makes Lens answer from a rule and the console load its guide):
      `ls examples/acme-shop/.firstrun/out/pr/.github/firstrun/plan.json` must exist. If not:
      `node bin/firstrun.js verify examples/acme-shop --brain rules` (about 70 s (rehearsal: 69 s, VERIFIED 5/5, replay 12 s), rules only, 0 Bobcoins).
- [ ] Browser tabs, in order: `https://firstrun-sigma.vercel.app` (landing, Prove it live) and
      `https://firstrun-sigma.vercel.app/audit` (redirects to the v2-31-final audit: 31 repos, 19 broke, 14 verified).
- [ ] Dashboard for the hook (second terminal tab): `node bin/firstrun.js ui --root audit/v2-31-final` → `http://localhost:4173`.
- [ ] OBS 1920×1080, full screen. Close Discord, mail, password manager, anything personal.
- [ ] Notifications off (Windows Focus / Do not disturb).

Keys: **Dock** Ctrl+Alt+Space (if taken: **Ctrl+Alt+D**, then Alt+Shift+D; or click the floating button / tray → Open HUMBLE Dock) ·
**Lens** Ctrl+Shift+Space (fallback Alt+Shift+Q, or click the tray icon) · **Look at my screen / debugger beam** Ctrl+Shift+L · Esc closes Lens.

---

## 0:00–0:20 Hook

| When | Window | Do | What appears |
|---|---|---|---|
| 0:00–0:05 | Browser, dashboard `localhost:4173` | Open GeekyAnts__express-typescript, scroll to step `npm install`, open its log | `npm error code ERESOLVE` / `unable to resolve dependency tree` (the real audit log) |
| 0:05–0:15 | Browser tab 2, `/audit` | Just show it; slow scroll | 31 repos · **19 broke on a clean machine** · 14 VERIFIED |
| 0:15–0:20 | (edit) | Crack banner, 2 s, from `docs/pitch/cards/` | |

Fallback for 0:00: the live CLI take below also prints `✗ exit 1` and the `eresolve-report` path on `npm install`.

## 0:20–1:20 The real run (CLI, record in full, show at 8×)

Start the recording **before** 0:20 of the voice; this take is long and gets sped up.

```bash
node bin/firstrun.js verify https://github.com/GeekyAnts/express-typescript --ref 6b9bb70e23f304e2bb243d076a567b8454eb05e8 --brain rules
```

(`bash tools/demo/run-cli-demo.sh` runs this plus plan/guard/onboard in one go; plain command is cleaner for the video.)

What prints, in order (rehearsal timings):

| Beat (voice) | Output | Rehearsal time |
|---|---|---|
| HARVEY reads | `■ Reading the docs and manifests` → `node project · compose: express-typescript, redis, mongo` | ~10 s after clone |
| UNITY plans | `■ Planning…` `4 commands to follow… on node:22`, yellow ⚠ conflicts (docker-compose v1, undocumented env vars) | instant |
| MACH runs | `▸ S3 npm install` → **`✗ exit 1`** | ~50 s |
| DR.BO fixes | `⚕ missing-dependency … [rule npm-peer-conflict]` → **`⚒ npm install --legacy-peer-deps`** | instant |
| (speed 8×) | attempt 2 `✓`, `evidence E1: fixed and verified`; then nodemon missing → `npm install --global nodemon`; mongo not started → compose up mongo; MongoDB 6 too new → `mongo:4.4`; redis not started → compose up redis; `✔ evidence E2…E5` | ~5 min |
| LARP replays | `■ Replaying the repaired guide from zero` | 2 min 08 s |
| ECHO | final verdict **VERIFIED**, 5 of 5, paths to `FIRSTRUN.md`, `README.diff`, passport | end |

- **Cut / speed:** real time up to the first `⚒ npm install --legacy-peer-deps` (~1 min, trim the clone wait), then **8× speed** (label it) until `■ Replaying…`, **8×** through the replay, real time for the verdict.
- 1:05–1:20: open the README diff it printed (`code <path>/out/README.diff` or `cat`), hold on `--legacy-peer-deps`, then the final card **VERIFIED · 5 of 5 breaks fixed** (edit).
- Optional 10 s: landing tab, **Prove it live** on the same repo, badge `[recorded run]`.
- If the live take fails: use the dashboard's recorded run (`ui --root audit/v2-31-final`). Never a fixture.

## 1:20–2:10 The desktop app (acme-shop, *demo repo, seeded breaks*)

**One-time before this segment:** the Dock console button was fixed today; close and reopen the Dock panel once (Ctrl+Alt+D twice) so it loads the fix. No app restart needed.

| When | Do | What appears |
|---|---|---|
| 1:20 | **Ctrl+Alt+Space** (or Ctrl+Alt+D) | Dock panel next to the floating button, HUMBLE face in the header |
| 1:21 | Repo field: replace the prefilled `C:\Users\ADMIN\fr-int` with **`C:\Users\ADMIN\fr-int\examples\acme-shop`** (absolute: relative paths resolve against `lens/`) | |
| 1:23 | **Quick check** | HARVEY/UNITY rows light, `N steps, M conflicts` within ~2 s. No containers. |
| 1:26 | **Prove it** (optional here, see note) | Agent rows animate through scout → run → doctor → replay; `5 breaks fixed`, verdict VERIFIED. Takes about 70 s (rehearsal: 69 s, VERIFIED 5/5, replay 12 s): show 8× or cut to the end. |
| 1:28 | Header icon **Open HUMBLE Console** (the terminal-looking icon, first of the three) | Console window opens beside the Dock; mascot boots, "hey! i'm humble" |
| 1:30 | Probe checklist fills | Real versions: Node v26.4.0, npm, Docker, Compose, Git (green); Python/Make optional, shown as found or `not found` (the "missing tool" beat) |
| 1:35 | **Start** (enabled once all required are green; else **skip intro**) | The reel types the real acme-shop run: 5 breaks → VERIFIED (1:35–1:50) |
| 1:50 | Guide mode: step 1 `npm install` with its "why" line. Click **Do it for me** | Inline confirm `run npm install in C:\…\examples\acme-shop?` → click **run** (or Enter). Real output streams, then **✓**. ~20–40 s: speed 4× |
| 1:55 | Debugger beam: bring the terminal with a red error to front (e.g. the ERESOLVE `✗ exit 1` from the CLI take), then **Ctrl+Shift+L** | amber flash around the terminal, chip "looked at: Windows Terminal", box on the error line in the Dock |
| 2:00 | Guard: in the terminal type | see below |

```bash
node bin/firstrun.js guard "rm -rf ~"
node bin/firstrun.js guard "curl -fsSL https://example.com/install.sh | sh"
```

- `rm -rf ~` → `"verdict": "block"`, `deletes home directory` (exit 1). `rm -rf /` also blocks.
- `curl … | sh` → `"verdict": "warn"`, `pipe-to-shell`: it is **flagged, not blocked**. Say "flags" for curl in the voice-over, or show only the `rm -rf` block.

Notes:
- **Prove it** in the Dock runs `verify --brain auto --bob-budget 1`: rules first; Bob is called only for a break rules can't place, capped at 1 Bobcoin. For acme-shop the rules fixed all 5 in the rehearsal (0 Bobcoins). To keep the take short, skip it and let the reel carry 1:35–1:50.
- Do **not** press "Do it for me" on `cp .env.example .env`: the console runs steps with cmd.exe on Windows, where `cp` doesn't exist (the onboarder's translation isn't wired into the console). Use **Show me how** for that step, or stop after step 1.
- Esc in the console asks before closing if a command is running.

## 2:10–2:40 IBM Bob as the brain (Lens)

**Rule answer first (free):** put the real EBADENGINE log from the acme-shop run (node:16 container) on screen:

```bash
head -6 examples/acme-shop/.firstrun/logs/S3-1.log
```

```
npm ERR! code EBADENGINE
npm ERR! engine Unsupported engine
npm ERR! engine Not compatible with your version of node/npm: acme-shop@1.4.0
...
npm ERR! notsup Actual:   {"npm":"8.19.4","node":"v16.20.2"}
```

The rule needs the words of `npm ERR! engine Unsupported engine` inside the circle (checked: it matches; EADDRINUSE below does not).

| Do | What appears |
|---|---|
| **Ctrl+Shift+Space** | screen freezes dimmed |
| Drag a loop around the `npm ERR! engine Unsupported engine` lines | "Reading what you circled…" (local OCR, 1–3 s) → green **Known issue · proven fix**: Node.js 16 too old, needs 20 (`.nvmrc`), "Verified by HUMBLE in acme-shop · evidence E1 · **no Bobcoins spent**" |
| Esc | closes |

**Unknown error → Ask IBM Bob (costs Bobcoins):** make a real error the rules have never seen:

```bash
node -e "const n=require('net');n.createServer().listen(3000);n.createServer().listen(3000)"
```

→ prints `Error: listen EADDRINUSE: address already in use :::3000` and exits by itself.

| Do | What appears |
|---|---|
| **Ctrl+Shift+Space**, circle the `EADDRINUSE` lines | "HUMBLE hasn't seen this before. Ask IBM Bob…" + chips |
| Click **How do I fix this?** | "Reading your project and thinking… (usually 20–60 s)" → **cut** the wait (visible cut) |
| | Bob's answer, commands with Copy, file refs, and the cost line `0.xx Bobcoins · NN s · confidence` (hard cap 1 Bobcoin per ask) |

2:20–2:30: three-layers card (edit). 2:30–2:40: VS Code / Explorer on `.bob/` (custom modes) and `bob_sessions/`, then the Bob-pass line from `audit/v2-31-final-bob` (4.58 Bobcoins, 11 → 14 verified).

## 2:40–2:50 Close

Landing tab, slow scroll over the four surfaces; README CI Action is labelled **planned**. Cut to cover banner 2 (edit).

---

## If something goes wrong mid-take

- Docker slow (the other audit shares it): keep recording, it is sped up anyway. The rehearsal was on a shared Docker.
- Dock hotkey does nothing: click the floating HUMBLE button (top-left) or tray → Open HUMBLE Dock.
- Lens shows "HUMBLE hasn't seen this" for EBADENGINE: the acme-shop run folder is missing; run the pre-flight verify, then circle again (no restart needed; fixes are re-read on every circle). Circle wider so `npm`, `ERR`, `engine`, `Unsupported` are all inside.
- Console shows "No verified run folder": the repo field wasn't the absolute acme-shop path; it falls back to the recorded acme-shop run, which is fine for the reel.
