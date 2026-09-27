# HUMBLE Video Overlay Pack

Broadcast-ready graphic overlays for the HUMBLE demo video (max 3:00) per `docs/pitch/VIDEO_SHOT_LIST.md` and Brand Guidelines #168.

## Specifications
- **Resolution**: 1920 × 1080 px (Full HD broadcast standard)
- **Format**: PNG with full 8-bit alpha channel transparency (ready to drop into OBS, DaVinci Resolve, Premiere, Final Cut Pro)
- **Typography**: Space Grotesk (headings/copy) & JetBrains Mono (metrics/agent tags)
- **Palette**: Paper (`#f4e9dc`), Ink (`#0d1030`), Electric Blue (`#1f3bff`), Crack Pink (`#f0287a`), Blueprint Line (`#b9aa9c`), Agent Hues

---

## Asset Catalog

### 1. Title Cards (1920 × 1080)
- `01-title-hook.png` — **Segment 01 · 0:00–0:20**: "A README That Breaks"
- `02-title-real-run.png` — **Segment 02 · 0:20–1:20**: "A Real Run on a Real Repo"
- `03-title-on-your-machine.png` — **Segment 03 · 1:20–2:10**: "The Console on Windows"
- `04-title-ibm-bob.png` — **Segment 04 · 2:10–2:40**: "IBM Bob, the Brain"
- `05-title-four-surfaces.png` — **Segment 05 · 2:40–3:00**: "One Engine, Four Ways In"

### 2. Lower-Thirds for Agents (1920 × 1080)
- `lowerthird-harvey.png` — **HARVEY · scout**: Reads setup docs & audits facts against reality
- `lowerthird-unity.png` — **UNITY · planner**: Translates prose into ordered machine commands
- `lowerthird-mach.png` — **MACH · runner**: Executes steps on clean isolated machine
- `lowerthird-drbo.png` — **DR.BO · doctor**: Diagnoses failures with IBM Bob
- `lowerthird-larp.png` — **LARP · verifier**: Discards machine & replays all steps from zero
- `lowerthird-echo.png` — **ECHO · scribe**: Writes minimal proved README diff & Setup Passport
- `lowerthird-vigil.png` — **VIGIL · guard**: Pre-execution security gate (blocks unsafe pipes/sudo)

### 3. Stat Cards & Proof Badges (1920 × 1080)
- `stat-audit-break.png` — "18 of 31 READMEs broke on a clean machine" (source: HUMBLE audit v2-31-final, 27 Sep 2026 · pre-Bob)
- `stat-geekyants-verified.png` — "VERIFIED · 5 of 5 breaks fixed" (source: audit/v2-31-final/runs/GeekyAnts__express-typescript)
- `stat-bob-cost-template.png` — "Bob · [__.__] Bobcoins" live spend placeholder template

### 4. Labels & Speed Badges (1920 × 1080)
- `label-4x-speed.png` — `4× speed`
- `label-8x-speed.png` — `8× speed`
- `label-cached-packages.png` — `cached packages`
- `label-demo-repo.png` — `demo repo · seeded breaks`
- `label-recorded-run.png` — `[recorded run]`

### 5. End Card & Overview
- `end-card.png` — "HUMBLE: your README, proven on a clean machine" · Arnav · Karmanya · Powered by IBM Bob 2.0
- `contact-sheet.png` — High-resolution overview of all overlays against studio backdrop

---

## How to Re-render

To re-render all overlays from the HTML source:
```bash
node docs/pitch/overlays/render.mjs
```
The script serves `overlays.html` and `contact-sheet.html` over a local HTTP server and drives headless Chrome to export 1:1 pixel-perfect transparent PNGs.
