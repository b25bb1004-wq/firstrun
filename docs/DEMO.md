# HUMBLE Demo Recording Kit

This document defines the exact shot list, timings, and recording instructions for the HUMBLE submission video (max 3 minutes, real screens only).

---

## Shot List with Timings

| Time | Duration | Shot | Description |
|------|----------|------|-------------|
| 0:00–0:20 | 20s | **Broken README hook** | Terminal shows `firstrun verify examples/acme-shop --verbose` — the EBADENGINE break (node:16 cannot be pulled in WSL/Docker), plus the 5 static docs-vs-code conflicts found by the Planner. |
| 0:20–1:20 | 60s | **The real run** | Full scripted session from `tools/demo/run-cli-demo.sh`: verify → plan → guard (ok/warn/block) → guard --self → onboard --dry-run. Every line is real tool output. |
| 1:20–2:10 | 50s | **Windows console + debugger + guard** | On Karmanya's Windows PC (Edith lane): the HUMBLE Console UI at `http://localhost:4173` showing the Debugger beam on the acme-shop failure, the DR.BO diagnosis, the fix, the replay from zero, the VERIFIED badge, then `firstrun guard` on three commands (one ok, one warn, one block). |
| 2:10–2:40 | 30s | **One real Bob call with cost** | Only with Karmanya's go-ahead. A single `firstrun doctor --bob-budget 1` on an unknown failure, showing the Bob spend line in the report (e.g., "Bob: 0.12 coins"). No Bobcoins spent outside this shot. |
| 2:40–3:00 | 20s | **Four surfaces + the ask** | Quick cuts: (1) CLI verify, (2) Console UI dashboard, (3) Lens spatial overlay (BEAM), (4) Guard classification table. End frame: "Your README, proven. Try `npx humble verify`" + repo URL. |

---

## What to Record on Which Machine

| Shot | Machine | Operator | Notes |
|------|---------|----------|-------|
| 0:00–1:20 (CLI demo) | Arnav's MacBook / WSL | Hermes / Friday | Run `tools/demo/record.sh` to produce cast + transcript. |
| 1:20–2:10 (Windows console) | **Karmanya's PC** | **Edith** | Must run `firstrun ui` on Windows, open `http://localhost:4173`, demonstrate Debugger beam + guard. Edith operates. |
| 2:10–2:40 (Bob call) | Karmanya's PC | **Karmanya (go-ahead) + Edith** | Only record with explicit Karmanya approval. Use a fixture run with an unknown failure, run `firstrun doctor --bob-budget 1`. |
| 2:40–3:00 (Four surfaces) | Arnav's MacBook / WSL | Hermes / Friday | Quick cuts from existing recordings + live CLI. |

---

## Regenerating Numbers After the Bob Pass

After the Bob-assisted run completes, regenerate the dashboard data for the submission:

```bash
# From the repo root
node web/build.js --audit
```

This rebuilds `web/public/data/runs/` with the latest run data (including any Bob-fixed repos). The dashboard at `firstrun ui` will reflect the updated numbers.

---

## Recording the CLI Demo (Machines with Docker Not Available)

Since Docker is not available in the current WSL environment, the `firstrun verify` step will show the real EBADENGINE failure (cannot pull node:16). This is the intended "broken README" hook.

**To record:**

```bash
cd /home/dev/firstrun4
./tools/demo/record.sh
```

This produces:
- `demo/casts/demo-YYYYMMDD-HHMMSS.cast` — raw script capture
- `demo/casts/demo-YYYYMMDD-HHMMSS.timing` — timing data for replay
- `demo/casts/demo-YYYYMMDD-HHMMSS.txt` — plain-text transcript (for PR body)

**To replay:**

```bash
scriptreplay -t demo/casts/demo-YYYYMMDD-HHMMSS.timing demo/casts/demo-YYYYMMDD-HHMMSS.cast
```

---

## Transcript Tail (for PR Body)

After recording, the last ~50 lines of the transcript will be pasted into the PR body. Example:

```
... (output from verify, plan, guard, guard --self, onboard --dry-run) ...

═══════════════════════════════════════════════════════════════
  DEMO COMPLETE
═══════════════════════════════════════════════════════════════
```

---

## Checklist Before Submitting

- [ ] CLI demo recorded via `tools/demo/record.sh`
- [ ] Cast + timing + transcript committed to `demo/casts/`
- [ ] Windows console shot recorded by Edith on Karmanya's PC
- [ ] Bob call shot recorded only with Karmanya's explicit go-ahead
- [ ] Four-surfaces montage assembled
- [ ] `web/build.js --audit` run to refresh dashboard numbers
- [ ] Full test suite green: `node --test test/*.test.js`
- [ ] `bash tools/check-secrets.sh` passes (run after `git fetch origin`)
- [ ] PR opened against `friday/integration` with title: `demo kit: scripted real runs for the video`
- [ ] PR body includes transcript tail
- [ ] **No credentials** anywhere (verify with `git diff --cached | grep -E 'sk-ant-[A-Za-z0-9]|AKIA[0-9A-Z]{8}|ghp_[A-Za-z0-9]{10}|nvapi-|xox[bp]-'`)

---

## Files in This Kit

- `tools/demo/run-cli-demo.sh` — scripted real CLI session
- `tools/demo/record.sh` — records session to cast + transcript
- `demo/casts/` — output directory (gitignored, but commit the cast/transcript for the PR)
- `docs/DEMO.md` — this file