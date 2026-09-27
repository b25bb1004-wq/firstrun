# HUMBLE, the onboarder: detailed design (v2)

Idea: Arnav (boss). Design: Edith, 27 Sep 2026. Builds on `HUMBLE_ONBOARDER.md` (the product spec) and
`COMPETITION_AND_SECURITY.md` (the field + the security agent). Incorporates Zeus' review on PR #153.

## 0. What changed since v1
| Change | Why |
|---|---|
| **Phase 0: security pre-flight** before anything runs | HUMBLE runs strangers' commands; no onboarding competitor protects the user. |
| **Host profile + platform gap** (the sandbox is Linux, the user may not be) | Zeus #1: a Linux-proven guide can still fail on Windows/macOS. HUMBLE must say which steps are proven *for the user's platform*. |
| **Non-interactive execution + per-step `timeoutMs` + `undo`** in `guide.json` | Zeus #2, #4: hidden prompts freeze Autopilot; every step needs a bound and a way back. |
| **Window-relative grounding** | Zeus #3: DPI scaling (Retina 2×, Windows 125/150 %) makes raw-pixel OCR jitter. |
| **Masked secret field in the console** that writes straight into `.env` | Zeus #5: never through terminal history, never logged, never sent to a model. |
| **Scorecard of what was not verified**, **tamper-evident session log** | Lessons from Day-One Ready and Proofline. |

## 1. System overview

```
                 ┌──────────────────────── HUMBLE (Lens, Electron) ─────────────────────────┐
 user ──click──▶ │ corner icon ─▶ console window ◀─▶ orchestrator (state machine) ◀─▶ stage   │
                 │                                   │        ▲            │      (robot    │
                 │                                   │        │events      │       overlay) │
                 └───────────────────────────────────┼────────┼────────────┼────────────────┘
                                                     ▼        │            ▼
                    Vigil pre-flight ─▶ firstrun engine (Harvey·Unity·Mach·DR.BO·Larp·Echo) ─▶ guide.json
                                         in an isolated Docker machine            │
                                                                                  ▼
                              host probe (read-only) ─▶ fitted plan ─▶ Autopilot | Guide ─▶ session log, README PR
```
Components: **orchestrator** (one state machine, below), **engine bridge** (existing `lens/dock-bridge.js` +
`firstrun verify`), **host probe**, **executor** (runs steps in the user's terminal), **checker** (verifies a step
landed), **grounder** (finds where to point), **stage** (robot overlay), **console** (UI), **Vigil** (security),
**ledger** (hash-chained session log).

## 2. The seven agents behind HUMBLE
Harvey (Scout), Unity (Planner), Mach (Runner), DR.BO (Doctor), Larp (Verifier), Echo (Scribe), plus **Vigil**
(security guard, new). HUMBLE is the only one the user talks to.

## 3. State machine (the orchestrator)
```
IDLE ─open─▶ DETECT_REPO ─found─▶ PREFLIGHT ─clear/caution-ack─▶ ISOLATE ─solved─▶ PROBE_HOST ─▶ REPORT
                 │ not found                │ block                  │ unsolved              ▲
                 ▼                          ▼                        ▼                       │
              ASK_REPO                   BLOCKED                  PARTIAL_REPORT ────────────┘
REPORT ─"Do it for me"─▶ AUTOPILOT ─all steps landed─▶ DONE ─▶ OFFER_PR
REPORT ─"Show me how"─▶ GUIDE ─────all steps landed─▶ DONE
AUTOPILOT|GUIDE ─step did not land─▶ STEP_TRIAGE ─known difference─▶ back to the same step (hint)
                                                 └─new problem───▶ REISOLATE(step) ─solved─▶ resume
any ─user cancels─▶ PAUSED (progress saved) ─resume─▶ same state
```
Every transition is written to the ledger. The console and robot are pure functions of the current state.

## 4. The phases in detail

### Phase 0: Vigil pre-flight (before any command runs, even in the sandbox)
Input: the repo checkout. Output: `clear | caution | block` with evidence (file:line).
Rules (MVP, deterministic): `curl|wget … | sh` from non-allowlisted hosts; `sudo` in setup steps; TLS checks disabled
(`--insecure`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, `strict-ssl false`); `preinstall/postinstall` scripts that fetch or
exec; base64/obfuscated payloads; committed secrets (same patterns as `tools/check-secrets.sh`); dependencies absent
from the registry (hallucinated/typosquat: one registry lookup each). Later: known-malicious package feeds,
prompt-injection text aimed at agents, egress allowlist from the plan.
`caution` = explained in the console; the user must acknowledge before Phase 1. `block` = HUMBLE refuses and shows why.

### Phase 1: isolation (HUMBLE does the whole job first, alone)
Unchanged engine: scout → plan → run on a clean machine → diagnose (rules, then IBM Bob if allowed) → fix → throw the
machine away → replay from zero. Sandbox hardening: repo copy only, no Docker socket, CPU/memory/time limits, egress to
package registries plus what the plan declares. Ends **solved** (every step passes from zero) or **unsolved** (some
steps need a human). HUMBLE never starts a guide on an unsolved step; unsolved steps go to the scorecard.

### Phase 1b: host profile (read-only, once, up front)
Collected: OS + version, shell (bash/zsh/PowerShell), CPU arch, WSL present, Docker running, tool versions (node,
python, package managers, git, make), services listening, occupied ports the guide needs, existing `.env`, disk space.
Output `host.json`. Nothing is installed or changed.

**Platform gap rule (honesty):** the guide is proven on Linux. For each step HUMBLE marks one of:
`proven` (same platform, or platform-neutral like `npm install`), `translated` (an equivalent for the user's platform,
e.g. `export X=1` → `$env:X=1` in PowerShell, `cp` → `Copy-Item`; shown with a "not proven on your OS" label), or
`recommend-wsl-or-docker` (steps that only make sense on Linux, e.g. `apt-get`). On Windows, HUMBLE's default
recommendation is to follow the guide inside WSL or a dev container when more than one step is non-neutral.

### Phase 2: the report (only after Phase 1 is complete)
```
I set this repo up on a clean machine, fixed what broke and proved it from zero in 1m53s.
  Proven for you:     5 steps     (2 already done on your machine)
  Not proven:         1 step      needs your OpenAI key (you'll paste it into a private field, never shared)
  Differences:        your machine has Node 20; the guide was proven on Node 22 → I'll use nvm, or you can
Security:             clear (no install scripts fetch remote code)
          [ Do it for me ]      [ Show me how ]      scorecard ▸
```
The scorecard lists every step with its status (proven / translated / already satisfied / needs human / skipped
with reason) and links to the evidence (log, diagnosis, fix).

### Phase 3a: Autopilot ("Do it for me")
For each step of the fitted plan: show (command, why, risk) → consent (per step by default; "approve the rest" after
the first) → run → check → record. Execution rules:
- runs in the user's own terminal session (VS Code integrated terminal via the extension when present; otherwise a
  pseudo-terminal HUMBLE owns, visible in the console);
- **non-interactive by default:** `CI=1`, `npm_config_yes=true`, `PIP_NO_INPUT=1`, `DEBIAN_FRONTEND=noninteractive`,
  plus per-tool flags recorded in the step (`-y`, `--no-input`); stdin is closed unless the step declares `stdin`;
- **bounded:** `timeoutMs` per step (defaults: install 25 min, test 5 min, serve 150 s, other 12 min, the same limits as
  the engine); on timeout the step is stopped and triaged, never left hanging;
- **undoable:** each step records its `undo` (e.g. `docker compose down mongo`, restore the previous `.env`); "Undo last"
  and "Undo all" replay them in reverse;
- **scoped:** file edits only in the repo and only on docs/config paths (the Doctor's allowlist); no global installs
  without an explicit consent line naming what will be installed.

### Phase 3b: Guide ("Show me how")
Same fitted plan, the user types. Per step: robot walks to the target → points → says one or two sentences → waits →
checker confirms → celebrate → next. Help ladder per step: **Hint** (where) → **Show** (exact text + copy) → **Do it**
(Autopilot for this step only) → **Why?** (the failure log and fix from Phase 1) → **Skip** (only if the step is
optional; recorded). Two learner modes: *new to this* (explains terms, one idea per step) and *experienced* (short, can
expand the whole list and tick through it).

### Phase 4: handoff
Done screen: app running + the `done` check result; the scorecard; the session ledger; "Offer this fix to the
maintainers" (Echo's README PR, needs GitHub auth); "Save this guide" (guide.json + FIRSTRUN.md).

## 5. `guide.json` v1 (written by Echo; everything comes from the verified run)
```json
{
  "schema": "humble.guide/1",
  "repo": "GeekyAnts/express-typescript", "commit": "6b9bb70e23", "verdict": "VERIFIED",
  "provenOn": { "image": "node:22", "os": "linux", "replaySeconds": 113, "runId": "v2-31-final-GeekyAnts__express-typescript" },
  "env": { "CI": "1", "npm_config_yes": "true" },
  "steps": [
    {
      "id": "S3", "title": "Install dependencies",
      "say": { "new": "This installs the libraries the app needs. The README forgot one flag; I've added it.",
               "experienced": "npm install needs --legacy-peer-deps (peer conflict)." },
      "why": { "evidenceId": "E1", "cause": "npm refuses the conflicting peer dependencies", "log": "logs/S3-1.log" },
      "do": { "type": "run", "command": "npm install --legacy-peer-deps", "cwd": ".", "stdin": null },
      "platform": { "linux": "proven", "darwin": "proven", "win32": "proven" },
      "target": { "kind": "terminal" },
      "check": { "type": "exit", "code": 0 },
      "timeoutMs": 1500000,
      "undo": { "type": "run", "command": "rm -rf node_modules" },
      "risk": "low", "optional": false, "alreadySatisfiedIf": null
    },
    {
      "id": "E1", "title": "Add your OpenAI key",
      "do": { "type": "secret", "file": ".env", "fromTemplate": ".env.example", "key": "OPENAI_API_KEY" },
      "target": { "kind": "console-field" },
      "check": { "type": "file-has", "file": ".env", "pattern": "^OPENAI_API_KEY=.+" },
      "secret": true, "undo": { "type": "restore-file", "file": ".env" }
    }
  ],
  "done": { "type": "http", "url": "http://127.0.0.1:4040/", "expect": 200 },
  "scorecard": { "proven": 5, "translated": 0, "needsHuman": 1, "skipped": [{ "command": "vim .env", "why": "opens an editor" }] },
  "security": { "verdict": "clear", "findings": [] },
  "hash": "sha256 of the canonical JSON, recorded in the ledger"
}
```
Step `do.type`: `run | edit | secret | open | click`. `check.type`: `exit | port | http | file-has | process |
command-output`. `target.kind`: `terminal | file-line | browser | console-field | ui-element`.

## 6. Grounding (where the robot points)
Pipeline, first confident answer wins, confidence ≥ 0.8 to point:
1. **Editor/terminal API** (VS Code / Bob IDE extension): exact file/line or the terminal panel bounds. Confidence 1.0.
2. **Accessibility tree** (Windows UI Automation, macOS AX, AT-SPI): element bounds by role + name.
3. **OCR on the target window, not the screen:** capture the focused window (Electron `desktopCapturer` window source),
   run Tesseract on it, match the expected text (normalised, fuzzy ratio ≥ 0.85), map the word box to screen with
   `screenX = winX + boxX / window.scaleFactor` (per-display scale factor from Electron's `screen` API). This removes
   the DPI jitter Zeus raised.
4. **Vision pointing** (later): screenshot ≤ 1280 px, HUMBLE's windows excluded, model answers
   `[POINT:x,y:label:screenN]` or `[POINT:none]`; same coordinate mapping.
Below threshold: no pointing; the console shows the instruction and says "I couldn't find it on screen".
The robot stops **beside** the target (offset 24 px, away from the text), never on it; if the console covers the
target, the console slides to the opposite corner.

## 7. Checker (did the step land?)
| check | how |
|---|---|
| `exit` | exit code from shell integration (VS Code) or the pseudo-terminal |
| `port` | TCP connect to 127.0.0.1:port, retry every 500 ms up to the step timeout |
| `http` | GET url, expect status (and optional body substring) |
| `file-has` | read file, regex; for secrets the value is never read into memory beyond the regex test |
| `process` | a process with the expected command line is alive |
| `command-output` | run a read-only probe command, match output (e.g. `node -v` ≥ 18) |

## 8. When a step does not land (STEP_TRIAGE)
Order: (1) compare the user's command with the expected one (typo, wrong folder: point at the difference);
(2) compare `host.json` (missing tool, wrong version, port busy: show the proven fix for that difference);
(3) known failure signatures from Phase 1 (Lens OCR reads the error, same signature → the proven fix);
(4) otherwise **REISOLATE**: reproduce the user's situation in the sandbox (same versions from `host.json`), solve it
there with the engine, prove it, return with the answer. HUMBLE never improvises a fix on the user's machine.

## 9. Secrets
A masked input field inside the console, shown for `do.type: secret`. HUMBLE writes the value straight into the file
(creating it from the template if needed), then drops it from memory. Never echoed, logged, sent to a model, put in a
screenshot, or typed into a terminal. The ledger records only "OPENAI_API_KEY set" (not the value). Screenshots for
grounding exclude the console while a secret field is open.

## 10. Ledger (tamper-evident session log)
`.firstrun/humble-session.jsonl`, one entry per event: `{ seq, time, state, stepId, action, result, evidenceRef,
prevHash, hash }` where `hash = sha256(prevHash + canonical(entry))`. "Verify log" recomputes the chain; any edited
entry breaks it visibly. Included in the passport and the README PR description.

## 11. The robot and the console
Robot states and triggers: `sleep` (idle) · `wake` (repo detected) · `think` (Phase 0/1 running; the active agent's
colour on its antenna) · `worried` (a break found / step not landed) · `walk` (to a target) · `point` · `talk` ·
`wait` (user's turn) · `celebrate` (check passed) · `stuck` (needs the user: secret, consent). Motion: ease-out, arced
flights with a small mid-flight scale-up, stops beside targets; reduced motion = fade and teleport.
Console: header (robot portrait, repo, one-word status) · agent strip (seven names light up) · feed (HUMBLE's short
sentences, commands, collapsible logs) · action area. Copy rules: one idea per sentence, plain words, no jargon in
"new to this" mode, always say *why*. Accessibility: fully keyboard-driven (Tab/Enter, Ctrl+Shift+H to open), feed is
an ARIA live region, colour is never the only signal, text scales with the OS setting.

## 12. IBM Bob inside HUMBLE
DR.BO asks IBM Bob when no rule explains a failure (capped Bobcoins, user-visible budget); Bob reviews the plan before
Phase 1 when `--brain auto` (#136); the HUMBLE orchestrator mode and Guide mode ship as Bob custom modes; Bob IDE
reaches HUMBLE through the MCP tools. In the console, every Bob-assisted fix is labelled "diagnosed with IBM Bob" with
its cost.

## 13. Code layout and interfaces (in `lens/`)
```
lens/humble/orchestrator.js   state machine, ledger writes, drives console + stage
lens/humble/preflight.js      Vigil rules (Phase 0)
lens/humble/probe.js          host profile → host.json
lens/humble/fit.js            guide.json + host.json → fitted plan (proven/translated/satisfied/wsl)
lens/humble/executor.js       pty runner: env, non-interactive flags, timeouts, undo stack
lens/humble/checker.js        exit/port/http/file-has/process/command-output
lens/humble/grounder.js       editor API → a11y → window OCR → vision; coordinate mapping
lens/humble/ledger.js         hash-chained jsonl
lens/humble/console.html|js   the window
lens/humble/stage.html|js     robot overlay (per display), sprite states (Zeus)
lens/humble/robot/*.svg       robot sprites (Zeus)
src/scribe/guide.js           Echo: writes guide.json from run + passport (engine side)
```
IPC (main ↔ console/stage): `humble:state`, `humble:step`, `humble:point {x,y,display,label}`, `humble:consent`,
`humble:secret` (write-only, value never sent back), `humble:undo`, `humble:log`.

## 14. Budgets
Console open < 300 ms; robot animations at 60 fps, transform/opacity only; grounding (window OCR) < 800 ms; checker
polling ≤ 2 Hz; idle CPU ≈ 0 (stage draws only while the robot moves).

## 15. Test plan
Unit: fit.js (platform matrix), checker (each type), ledger (tamper detection), preflight (each rule with a fixture),
executor (timeout + non-interactive + undo, against a fake shell). Integration: GeekyAnts end to end in Autopilot and
Guide on Windows and Linux; a repo with an interactive prompt; a repo with a malicious postinstall fixture (must block).
Visual: robot states snapshot; reduced-motion snapshot.

## 16. Build plan to today's deadline (20:30 IST), with cut lines
| Slot | Build | Owner | Cut if late |
|---|---|---|---|
| now → 12:00 | `src/scribe/guide.js` (guide.json from GeekyAnts' final-run artefacts) | a Hermes | none (needed) |
| now → 12:00 | robot SVG states | Zeus | fewer states (think/point/celebrate) |
| 11:00 → 15:00 | console + orchestrator + executor (Autopilot) on GeekyAnts | Edith | per-step consent only |
| 13:00 → 16:30 | stage overlay + grounding (terminal bounds + window OCR) + Guide | Edith + Zeus | point at the terminal panel only |
| 14:00 → 16:30 | Vigil pre-flight rules + security line in the report | a Hermes | three rules (curl-pipe, sudo, install scripts) |
| 16:30 → 18:00 | record the demo, merge, README section | Karmanya (narration), Friday (merge) | none |
Later (say so in the pitch): vision pointing, accessibility-tree grounding, VS Code extension, translated steps
beyond simple cases, voice, debugging mode.

## 17. 60-second demo script (for the video)
0–10 s: click the corner icon on GeekyAnts; the robot wakes; Vigil: "security clear". 10–25 s: the agent strip lights
up; the clean machine breaks on `npm install`, DR.BO fixes it, Larp replays from zero: "proven in 1m53s". 25–35 s: the
report with the scorecard and the two choices. 35–55 s: "Show me how": the robot walks to the terminal, points at the
prompt, the user types, the check passes, the robot hops; the secret step uses the private field. 55–60 s: app running,
"Offer this fix to the maintainers".

## 18. How we'll know it works
Time from clone to running app for a newcomer (target: under the README-only time, measured on GeekyAnts); steps
needing a human per repo; share of guide steps that land first try; zero secrets in any log; zero unconsented actions
(from the ledger).
