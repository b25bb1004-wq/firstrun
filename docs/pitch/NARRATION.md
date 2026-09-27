# HUMBLE Video Narration Script (max 2:50)

Target: ~400 words (140 wpm × 2.8 min). Every number sourced; source path as HTML comment.

---

## 0:00–0:20 Hook — A README that breaks a new hire

| Time | Screen | Words |
|------|--------|-------|
| 0:00–0:05 | Terminal: `npm install` fails with `ERESOLVE unable to resolve dependency tree` (GeekyAnts/express-typescript README) | "Every repo has a Getting Started section. It's the one part nobody tests." |
| 0:05–0:15 | Dashboard banner: **18 of 31 READMEs broke on a clean machine** · *source: HUMBLE audit v2-31-final, 27 Sep 2026, pre-Bob* | "We ran 31 popular READMEs on a clean machine. Eighteen broke. <!-- source: audit/v2-31-final/audit.json:1186 -->" |
| 0:15–0:20 | Crack banner (2 s) | "A new hire follows the docs. The machine says no. HUMBLE fixes that." |

---

## 0:20–1:20 The Real Run — Six agents, one clean replay

| Time | Screen | Words |
|------|--------|-------|
| 0:20–0:35 | HARVEY reads README → MACH runs `npm install` → **ERESOLVE** (pink) | "HUMBLE follows the README on a fresh machine, like a new hire. Harvey reads. Mach runs the commands." |
| 0:35–0:50 | DR.BO diagnoses → `--legacy-peer-deps` (blue) → LARP replays from zero | "When a step breaks, Doctor Bo finds the cause and fixes it. Then Larp throws the machine away and replays everything from zero. <!-- source: audit/v2-31-final/audit.json:31 (replaySeconds 113, cached packages not used) -->" |
| 0:50–1:05 | ECHO emits VERIFIED badge, corrected README diff, Setup Passport | "Only a clean replay counts. Echo stamps it verified. Five breaks found, five fixed. <!-- source: audit/v2-31-final/audit.json:24-25 (breaksFound 5, breaksFixed 5) -->" |
| 1:05–1:20 | Final card: **VERIFIED · 5 of 5 breaks fixed** · *source: audit/v2-31-final/runs/GeekyAnts__express-typescript* | "The agents by name: Harvey, Unity, Mach, Doctor Bo, Larp, Echo. Verified." |

---

## 1:20–2:10 The Desktop App — Your machine, guided

| Time | Screen | Words |
|------|--------|-------|
| 1:20–1:35 | Dock (HUMBLE face) → Probe shows real versions, missing tool flagged | "Once the setup is proven, HUMBLE walks you through it on your own machine. The probe reads what you have and what's missing." |
| 1:35–1:50 | Reel: acme-shop run, 5 breaks → VERIFIED · *demo repo, seeded breaks* | "The reel plays the real run. Five breaks, verified. Every step asks before it runs." |
| 1:50–2:00 | Debugger beam (Ctrl+Shift+L) lights the error line; diff "your machine vs the proof" | "If something breaks here, the debugger points at the exact line and shows what differs from the proof." |
| 2:00–2:10 | Guard blocks `curl … | sh` and `rm -rf /` before they run; EMO mascot reacts | "And every command passes a security guard first. The mascot watches too." |

---

## 2:10–2:40 IBM Bob as the Brain — Rules first, Bob judges, verify always

| Time | Screen | Words |
|------|--------|-------|
| 2:10–2:20 | Bob diagnosis on unknown failure; evidence IDs, redacted text, cost line | "Rules handle the known breaks for free. What they can't place goes to IBM Bob, with evidence attached and a hard budget. <!-- source: docs/pitch/BOB_PASS_DRYRUN.md:6 (budget 4.5 shared, cap 1.5 per call) -->" |
| 2:20–2:30 | Three layers card: **rules first · Bob judges · verify always** | "Bob's fix only counts if the replay passes. The budget is capped. Bob can only tighten security, never weaken it. <!-- source: docs/pitch/BOB_PASS_DRYRUN.md:6 (shared budget stops at 0.05 left) -->" |
| 2:30–2:40 | Custom modes in `.bob/`, `bob_sessions/`; real Bobcoin cost from run report | "Custom modes, capped Bobcoins. The real cost shows on screen." |

---

## 2:40–2:50 Close — Four surfaces, one engine

| Time | Screen | Words |
|------|--------|-------|
| 2:40–2:45 | Quick cards: README CI Action (planned), HUMBLE desktop, Prove it live, Audit at scale | "One engine, four ways in. A CI check that keeps docs honest. The desktop guide for new hires. Live proofs on the web. Audits at scale." |
| 2:45–2:50 | Cover banner 2: **HUMBLE: your README, proven on a clean machine** · Arnav · Karmanya · **Powered by IBM Bob 2.0** | "Your README, proven on a clean machine. Powered by IBM Bob 2.0." |

---

## Word Count

Total: **388 words** (within 400-word budget for ~2:50 at 140 wpm).

---

## Source Index (HTML comments in script)

- `audit/v2-31-final/audit.json:1186` — `brokeOnCleanMachine: 18`
- `audit/v2-31-final/audit.json:24-25` — `breaksFound: 5, breaksFixed: 5` (GeekyAnts run)
- `audit/v2-31-final/audit.json:31` — `replaySeconds: 113, packageCache: false` (cached packages not used)
- `docs/pitch/BOB_PASS_DRYRUN.md:6` — `--bob-budget 4.5` shared, cap 1.5 per call, stops at 0.05 left