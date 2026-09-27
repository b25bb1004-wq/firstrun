# HUMBLE demo video: shot list (max 3:00)

Structure from Friday (27 Sep): hook → a real run on a real repo → the console on Windows → Bob as the brain →
four surfaces and the ask. Replaces the older 4:00 `video-script.md`, which quotes the retired real-16 numbers.

**Rules for every shot**
- Only real screens: a real run, a real recording or a real file. No mock-ups, no re-typed terminal output.
- Every number on screen carries its source in small type, and is marked **pre-Bob** until the Bob pass lands.
  Numbers come from `audit/v2-31-final` (PR #154).
- acme-shop is labelled "demo repo, seeded breaks" whenever it appears.
- Anything sped up says so on screen ("4× speed"). Nothing is cut out of a run without a visible cut.
- Sound: one calm voice (Karmanya). Sentences short enough to read as captions.

---

## 1 · Hook: a README that breaks (0:00–0:20)

| | |
|---|---|
| **Screen** | The GeekyAnts/express-typescript README "Getting started", then a terminal with `npm install` failing with `ERESOLVE unable to resolve dependency tree`. |
| **Capture** | The failing log is real: `audit/v2-31-final/runs/GeekyAnts__express-typescript/logs/`. Show it in the dashboard (`node bin/firstrun.js ui --root audit/v2-31-final`), not re-typed. Then cut to banner 1 (the crack) for 2 s. |
| **Voice** | "Every repo has a Getting started section. It's the one part nobody tests. We ran 31 popular READMEs on a clean machine. 18 broke." |
| **On screen** | **18 of 31 READMEs broke on a clean machine** · *source: HUMBLE audit v2-31-final, 27 Sep 2026, pre-Bob* |

## 2 · A real run on a real repo (0:20–1:20)

| | |
|---|---|
| **Screen** | HUMBLE proving GeekyAnts/express-typescript at the pinned audit commit, then the Prove it live panel replaying the same run. |
| **Capture** | `node bin/firstrun.js verify https://github.com/GeekyAnts/express-typescript --ref 6b9bb70e23f304e2bb243d076a567b8454eb05e8 --brain rules`, recorded in full, shown at 4–8× speed and labelled. Needs Docker; about as long as the audit run took. Then 10 s of the landing's Prove it live on the same run, badged `[recorded run]`. |
| **Beats** | (a) Harvey reads the README · (b) Mach runs `npm install` → **ERESOLVE** (pink) · (c) DR.BO: `--legacy-peer-deps` (blue) · (d) Larp replays everything from zero · (e) **VERIFIED**, then the corrected README diff and the Setup Passport. |
| **Voice** | "HUMBLE follows the README on a fresh machine, like a new hire. When a step breaks, its doctor finds the cause and fixes it. Then it throws the machine away and replays everything from zero. Only a clean replay counts." |
| **On screen** | Agent names as they act (HARVEY · UNITY · MACH · DR.BO · LARP · ECHO). Final card: **VERIFIED · 5 of 5 breaks fixed** · *source: audit/v2-31-final/runs/GeekyAnts__express-typescript*. |
| **Fallback** | If the live take fails, use the recorded audit run's own events in the dashboard. Never a fixture or a simulation. |

## 3 · The console on Windows (1:20–2:10)

| | |
|---|---|
| **Screen** | Karmanya's real Windows desktop: the Dock (HUMBLE face), the console with the Lamplighter, onboarding acme-shop. |
| **Capture** | On Karmanya's PC once the #183 follow-ups land: the npm probe fix and a real "already done" check (Edith's re-test). Start OBS on the full screen, then run `node bin/firstrun.js dock examples/acme-shop`. |
| **Beats** | (a) **Probe**: the real versions on this machine, and a missing tool shown as missing · (b) **Reel**: the real acme-shop run, 5 breaks → VERIFIED · (c) **Do it for me** on one step: the confirm prompt, the real run, a ✓ from the real check · (d) **Debugger**: a step fails on this machine; the Lamplighter flies to the real error line on screen (spatial look, Ctrl+Shift+L) and the beam lights it; the diff "your machine vs the proof" · (e) **Guard**: a `curl … \| sh` or `rm -rf /` step is flagged or blocked before it runs. |
| **Voice** | "Once the setup is proven, HUMBLE walks you through it on your own machine. It asks before every command. If something breaks here, it points at the exact line and shows what differs from the proof. And every command passes a security guard first." |
| **On screen** | acme-shop label: *demo repo, seeded breaks*. The capture flash and the "looked at: Windows Terminal" chip stay visible (they show what was read). |
| **Do not** | Show any step that is still simulated. If a beat isn't real by recording time, drop it and shorten the segment. |

## 4 · IBM Bob as the brain (2:10–2:40)

| | |
|---|---|
| **Screen** | One real Bob diagnosis on a failure the rules can't place, with its cost. |
| **Capture** | Part of the capped Bob pass (Karmanya's go, at most 5 Bobcoins in total): one repo from the INCONCLUSIVE/PARTIAL list run with `--brain auto --bob-budget 0.19`, recorded. Show the Bob request (evidence ids, redacted text), Bob's answer, the fix, and the replay deciding whether it counts. |
| **Voice** | "Rules handle the known breaks for free. What they can't place goes to IBM Bob, with the evidence attached and a hard budget. Bob's fix only counts if the replay passes." |
| **On screen** | The real Bobcoin cost of that call, from the run's report. The three layers: **rules first · Bob judges · verify always**. |
| **If the Bob pass hasn't run** | Show the Bob sessions and custom modes in the repo (`bob_sessions/`, `.bob/`) as how HUMBLE was built, and skip any cost number. |

## 5 · Four surfaces and the ask (2:40–3:00)

| | |
|---|---|
| **Screen** | Four quick cards over the landing page, then the cover (banner 2). |
| **Voice** | "One engine, four ways in. A CI check that keeps docs honest, the desktop guide for new hires, live proofs on the web, and audits at scale. Your README, proven on a clean machine." |
| **On screen** | README CI Action (**planned** unless #181 is merged and shown working) · HUMBLE desktop · Prove it live · Audit at scale. Close: **HUMBLE: your README, proven on a clean machine** · Arnav · Karmanya · Powered by IBM Bob 2.0. |

---

## Capture checklist (Karmanya's PC)

- [ ] OBS: 1920×1080, 60 fps, full screen. The 150 % Windows scaling is fine (the spatial code handles it).
- [ ] Close Discord and any windows with personal data before recording. The deny-list keeps password
      managers and private windows out of spatial captures, but not out of OBS.
- [ ] Docker Desktop running; `docker compose version` works.
- [ ] Segment 2: run `verify` once as a rehearsal, then record the second take.
- [ ] Segment 3: only after Edith's re-test of the console passes.
- [ ] Segment 4: inside the Bob pass, with Karmanya's go.
- [ ] Every number checked against its source file before export.
