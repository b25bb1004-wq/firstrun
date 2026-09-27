# HUMBLE Console: build spec (every detail)

Owner map: **Hermes-1** = Electron console (`lens/humble/console.*`, opened from the Dock). **Hermes-3** = shared console core (typing engine, flight math, line grammar, reel player: `lens/humble/console-core.js`, used by both consoles). **Luna** = web console (`web/`, inner screen of the "Prove it live" hero). **Zeus** = visual polish and the mascot (`lens/humble/robot.*`, branch `zeus/humble-robot`). **Edith** = copy (section 9). **Hermes-2** = reel data (`web/public/data/reels/*.json`). Both consoles implement the SAME sequence from the SAME data; only the host differs.

Reference: heyclicky (source: github.com/farzaa/clicky: `OverlayWindow.swift`, `CompanionManager.swift`, `CompanionPanelView.swift`, `DesignSystem.swift`). Numbers marked (C) are copied from Clicky's source; the rest are ours.

Design freedom (Karmanya): the anti-vibecode list is suspended; Clicky-style dot grid, window frames, glows and purple/sparkles are allowed where they look best. Honesty and security rules are NOT relaxed.

Hard rules: no invented text in the terminal (every line comes from a real run event, the guide, or the probe); no new dependencies (CSS + `requestAnimationFrame`); never echo secrets (all displayed output goes through `src/redact.js`); every Run asks first; `prefers-reduced-motion` = no motion, same content.

---

## 1. Layout

```
+--------------------------------------------------+  width 380 (web: 100% up to 560)
| (mascot 56x56)  HUMBLE            [status dot] x |  header 64 high, padding 16
|                 onboarding acme-shop             |
|--------------------------------------------------|  1px --c-line
| $ npm ci                                    ✓ 4s |  terminal pane
|   why: installs the locked dependencies          |  min-height 240, max 420, scrolls
| $ npm test                                  ✗    |
|   > Error: Cannot find module 'pg'               |
|  ▌                                               |  block caret
|--------------------------------------------------|
| [ Show me how ]  [ Do it for me ]      step 2/6  |  footer 52 high
+--------------------------------------------------+
  watch onboarding again                             10px link under the panel
```

(The lines above are layout placeholders only; real content always comes from data.)

- Panel: radius 12, border 1px `--c-line`, shadow `0 18px 48px rgba(0,0,0,.45)`, background `--c-surface`.
- Opens anchored to the Dock button (Electron) / centered in the hero (web). Open: from scale .96 + opacity 0 + translateY 8px to 1/1/0, 220ms `--hb-ease-out`.
- Close (x or Esc): reverse, 160ms. Esc never kills a running command; it asks "stop the command? y/n".

## 2. Tokens (dark default; light theme swaps bg/ink/line exactly like robot.css)

| token | value | use |
|---|---|---|
| `--c-bg` | `#16120e` | page behind panel (web) |
| `--c-surface` | `#1c1712` | panel |
| `--c-term` | `#120e0a` | terminal pane |
| `--c-line` | `#342c24` | borders, dividers |
| `--c-ink` | `#efe7da` | primary text |
| `--c-ink-2` | `#b8ab98` | why lines, meta |
| `--c-ink-3` | `#7a6e5f` | timestamps, step counter |
| `--c-core` | `#ff9a3c` | mascot, caret, prompt `$`, focus ring, bubbles |
| `--c-hi` | `#ffc47a` | glow highlights, hover |
| `--c-deep` | `#e0701c` | pressed buttons |
| `--c-ok` | `#3dd68c` | pass ✓ (same as `--agent-verifier`) |
| `--c-fail` | `#ff5c7a` | fail ✗ (same as doctor) |
| `--c-warn` | `#ffb224` | checklist rows not yet satisfied (C: Radix Amber 9) |
| `--c-bob` | `#5E9EFF` | anything IBM Bob produced |
| `--hb-ease-out` | `cubic-bezier(0.23,1,0.32,1)` | entrances |
| `--hb-ease-bounce` | `cubic-bezier(0.34,1.56,0.64,1)` | bubbles, check marks |

Type: terminal `ui-monospace, "JetBrains Mono", "Cascadia Code", Menlo, monospace` 12.5px / 1.55; UI `Inter, system-ui` 12px medium; header title 14px semibold (C); step counter 10px semibold uppercase, letter-spacing .06em.
Spacing scale (C): 4 8 12 16 20 24 32. Radii (C): small 6, medium 8; panel 12.

## 3. Terminal pane: line grammar

Each line has a kind; the kind picks color and prefix. Nothing else may appear.

| kind | prefix | color | source |
|---|---|---|---|
| `cmd` | `$ ` (the `$` in `--c-core`) | `--c-ink` | guide step `command` / reel beat `step` |
| `why` | 2 spaces + `why: ` | `--c-ink-2` | guide step `why` |
| `out` | 2 spaces | `--c-ink-2`; max 6 lines then `… N more lines` (click expands) | live stdout/stderr, redacted |
| `fail` | 2 spaces + `> ` | `--c-fail` | reel `fail` beat / failing checker |
| `diag` | 2 spaces + agent tag `[DR.BO]` | tag in agent color, text `--c-ink`; `[BOB]` tag in `--c-bob` | reel `diagnosis` beat |
| `was` | 2 spaces + `- ` | `--c-fail` 70% opacity, strikethrough | README line before |
| `fix` | 2 spaces + `+ ` | `--c-ok` | README line after |
| `pass` | right-aligned `✓ Ns` on the cmd line | `--c-ok` | checker passed; N = real duration |
| `sys` | none, italic | `--c-ink-3` | "checking your machine (read-only)…" |

- Right status on a running `cmd`: braille spinner `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` at 80ms/frame in `--c-ink-3`, then `✓ Ns` or `✗`.
- ✓ enters scale .6 → 1 on `--hb-ease-bounce`, 260ms. ✗ enters with a 3-frame horizontal shake (±2px, 180ms).
- Caret: block `▌` in `--c-core`, blink 1.06s `steps(2)`; hidden while typing, shown when waiting for input.
- Auto-scroll to bottom unless the user scrolled up; then show a `↓ new output` pill (20px high, bottom-right).
- Text selectable; a copy icon appears on hover over a `cmd` line (copies the command only).

## 4. Typing engine (one function, shared)

`type(el, text, {min, max})` appends one character per tick.
- Welcome and prompts: fixed 30ms/char (C).
- Pointing bubbles: random 30–60ms/char (C).
- Commands in the terminal: 18ms/char, then 120ms pause before the `why` line.
- Output lines: never typed; appear line by line every 40ms.
- Reduced motion or hidden tab: full text instantly.
- Any key or click finishes the current line instantly (never skips a confirmation).

## 5. The mascot: LAMPLIGHTER (approved by Karmanya; Zeus's `lens/humble/robot.*`, turnaround sheet `lens/humble/lamplighter-turnaround.jpg`)

States in robot.js: `sleep think talk point celebrate worried`.

| moment | state |
|---|---|
| panel closed / idle > 60s | `sleep` (iris half closed, lantern dim) |
| probing, loading guide, command running | `think` (lantern pulses slowly, visor lenses scan) |
| typing welcome, why lines, bubbles | `talk` |
| flying to / pointing at a line | `point` (lantern BEAM onto the target) |
| checker passes | `celebrate` 1.2s (sparkles allowed), then `talk` |
| checker fails / command errors | `worried` until the next action (lantern flickers) |

- **Boot** (first open only): IRIS-SHUTTER boot, 5 blades open over 420ms (steps), while the belly lantern warms from 0 to full glow over the same 420ms. Lenses focus last.
- **Blink**: a quick iris close/open every 3–6s (random), 120ms.
- **Eye-dart**: the visor lenses swivel toward each new terminal line, 150ms.
- **Peek** (signature move): the eyestalk telescopes up and leans toward something new (a checklist row flipping, the first fail line) before the flight starts, 280ms out, 200ms back.
- **Cartridges**: in the agent colours (`--agent-*` tokens); the one for the active agent glows when that agent's line prints.
- **Glow**: lantern + hover-disc glow; at rest `drop-shadow(0 0 8px var(--c-core))`, in flight radius = 8 + (scale − 1) × 20 px (C).

## 6. Flight (mascot points at a line or page element)

Port Clicky's math 1:1 (C):
- duration = clamp(distance / 800, 0.6s, 1.4s)
- quadratic bezier: P0 = start, P2 = target, P1 = midpoint moved UP by min(distance × 0.2, 80px)
- eased progress t = 3u² − 2u³ (u = linear progress)
- rotation = atan2(B'(t)) + 90°, with B'(t) = 2(1−t)(P1−P0) + 2t(P2−P1); settle at −35° on arrival
- scale = 1 + sin(u·π) × 0.3 (1.3x mid-flight)
- driven by `requestAnimationFrame`, never CSS transitions.

Pointing = the lantern BEAM: a soft cone (linear-gradient, 18% `--c-hi` to transparent) from the lantern to the target line, fading in over 180ms on arrival and out with the bubble; the target line gets a 2px `--c-core` left bar while lit.

On arrival: bubble at (target.x + 10, target.y + 18) (C); on the FIRST character scale .5 → 1 with a spring (`--hb-ease-bounce` 400ms); glow radius starts 22 and settles to 6 ("materializing", C); text types 30–60ms random; hold 3s; fade 0.5s; fly back.
Mouse moves > 100px during the RETURN flight → cancel and snap home (C). The forward flight is never interrupted.
Bubble: bg `--c-core`, text `#1a0e04`, 11px medium, padding 4px 8px, radius 6, shadow `0 0 6px rgba(255,154,60,.5)`.

## 7. Onboarding sequence (first run; replayable)

1. **Intro panel** (no terminal yet). Mascot `sleep`. Body:
   - line 1 (14px semibold): personal line (section 9)
   - line 2 (12px `--c-ink-2`): trust line
   - label `CHECKING YOUR MACHINE` (10px semibold caps, `--c-ink-3`)
   - checklist rows from `probe.js` + the guide's required tools: 28px high; 8px dot left (`--c-warn` missing / `--c-ok` present); tool name; right side the found version or `not found` + a `how?` link that types the install hint into the terminal later.
   - rows re-poll every 2s (C polls permissions the same way); on flip, dot animates warn → ok with a 1.3x pop (200ms) and the mascot glances at it.
   - optional tools listed after a divider, marked `optional`, never block Start.
   - all required rows ok → footer types "you're all set. hit start to meet humble." and Start fades in. Start: full width, 36 high, bg `--c-core`, dark text, radius 8, hover `--c-hi`, press `--c-deep` + translateY 1px.
   - Web: the checklist shows the RECORDED probe of the demo machine, labelled `demo machine`. Never pretend it is the visitor's machine.
2. **Boot**: iris-shutter boot + lantern warm-up (section 5), 420ms.
3. **Welcome**: bubble fades in 0.4s, types "hey! i'm humble" at 30ms/char, holds 2s, fades 0.5s (C).
4. **Reel**: terminal fades in over 2s (C), then plays the real reel (Hermes-2's JSON) compressed to ~25s: step lines type, fail lines shake, diagnosis appears, the README `-`/`+` pair appears, replay lines run, and it ends with `VERIFIED · replay from zero in Ns` (N = real `replaySeconds`).
5. **Demo point**: at the first `fail` beat the mascot flies to that line: "this broke here"; then to the `+` line: "so i fixed the readme". Section 6 timings.
6. **Call to action**: 2.3s after the reel ends (C), the caret line types the CTA. Stays 10s, then fades (C); the caret keeps blinking.
7. Save `humble.onboarded = 1` (Electron: app settings; web: localStorage in try/catch). "watch onboarding again" replays steps 2–6.

`skip intro` text button (10px, `--c-ink-3`, top-right of the terminal) jumps to step 6 with all reel lines written instantly.

## 8. Guide mode (after onboarding, Electron only)

- Steps come ONLY from `guide.json` (proven steps). For each: type `cmd`, type `why`, footer shows `[ Show me how ]` (copy the command + point at where to paste) and `[ Do it for me ]`.
- Do it for me → inline confirmation replaces the footer: `run <command> in <dir>?  [ run ]  [ cancel ]` (Enter = run, Esc = cancel). Never auto-confirm, never batch-confirm.
- Running: mascot `think`, spinner, streamed redacted output, a `stop` button replaces run.
- Then run the step's checker: ✓ → `celebrate`, advance after 800ms; ✗ → `worried`, show the failure line, offer `[ ask DR.BO ]` (rules first, Bob only if configured) and `[ skip ]`.
- Steps already satisfied (from report.js): `$ cmd   ✓ already done` in `--c-ink-3`, auto-skipped 300ms apart.
- End: `VERIFIED on your machine · N steps · Ms` + Setup Passport link.

## 9. Copy (Edith owns final wording; lowercase, warm, short)

- personal: "hi, we're arnav and karmanya. this is humble."
- trust: "nothing runs without your ok. first i only look at your machine, read-only."
- ready: "you're all set. hit start to meet humble."
- welcome: "hey! i'm humble"
- point 1: "this broke here" · point 2: "so i fixed the readme"
- CTA Electron: "press enter to run step 1 on your machine" · CTA web: "press enter to replay it"
- Never "simply" or "just" (Clicky's own rule, C).

## 10. Sound (optional, OFF by default)

Clicky plays music and fades it over 3s at 90s (C). Ours: a soft key-tick per typed character at 8% volume, only if the user turns sound on (speaker icon in the header).

## 11. Accessibility and performance

- Terminal `role="log" aria-live="polite"`; bubble text is duplicated into the log for screen readers.
- Everything reachable by Tab; focus ring 2px `--c-core`, offset 2px.
- Contrast ≥ 4.5:1 for all text (verify `--c-ink-2` on `--c-term`).
- Web: lazy-mount when the hero enters the viewport; reserve height (no layout shift); added JS ≤ 25 KB gzip; Lighthouse mobile stays ≥ 90.
- Reduced motion: no flight (bubble appears beside the line), no typing, no shake, no iris animation (static open), no beam sweep (the beam appears instantly).

## 12. Acceptance checklist (paste into each PR with ticks)

- [ ] every terminal line traceable to a run event / guide step / probe fact (a test proves it)
- [ ] flight math matches section 6 (unit test: bezier point, duration clamp, scale peak)
- [ ] typing speeds match section 4
- [ ] confirmation before every run; Esc cancels; no batch confirm
- [ ] displayed output redacted (test with a fake token built at runtime, never a literal)
- [ ] reduced-motion path works
- [ ] replay onboarding and skip intro work
- [ ] light and dark theme
- [ ] `node --test test/*.test.js` green, `bash tools/check-secrets.sh` clean
- [ ] 10–20s screen recording or GIF of the sequence in the PR body
- [ ] (debugger/guard PRs) the section 13–14 acceptance items below

## 13. Built-in debugger (when a step fails on the user's machine)

Opens inline in the terminal when a checker fails or a command exits non-zero; also `firstrun onboard --debug` and a `debug` button on any failed line. Mascot `think` while analysing; the lantern beam lands on the evidence line.

1. **Capture** (local only, redacted): exit code, last 200 lines of output, command, cwd, duration, and a host snapshot from `probe.js`: versions, OS, tool names on PATH, which ports in the plan are already in use, which env var NAMES the guide needs and whether they are set. Names only, never values.
2. **Compare with the proof**: diff the host snapshot against the VERIFIED sandbox run for the same step (`run.json` + evidence), e.g. `node 18.19 here · 20.11 in the proven run`, `port 5432 already in use`, `DATABASE_URL not set`. Each difference is a `diag` line tagged `[DEBUG]` in `--c-ink`.
3. **Diagnose**: run the SAME doctor rules (`src/doctor/rules.js`) on the capture; show the matched rule id and the exact output line it matched (the beam points at it). No match → `[ ask Bob ]` only if Bob is configured, showing the budget (e.g. `≤ 0.2 Bobcoins`), sending only the redacted capture.
4. **Fix**: each proposed fix is a normal guide step (command, why, checker, undo) and goes through the same inline confirmation (section 8) and the guard (section 14). Afterwards the ORIGINAL failing step's checker runs again; only a pass counts as fixed.
5. **Report**: `copy debug report` puts redacted Markdown on the clipboard (capture, host-vs-proof diff, rule, fix tried, result), ready to paste into an issue. Nothing is uploaded.

Layout: a sub-panel inside the terminal, indented 12px, left border 2px `--c-fail` while open, turning `--c-ok` when the fix verifies. Header line `DEBUG · step 3 · <command>` (10px caps). Collapsible sections: `what happened`, `different from the proven run`, `likely cause`, `fix`; the first three open by default.

## 14. Built-in security guard (always on; no UI switch to turn it off)

Every command passes `src/onboarder/guard.js` BEFORE its confirmation is shown. Verdicts: `ok`; `warn` (the confirmation shows the reason in `--c-warn` and needs a second click); `block` (never runnable from HUMBLE; the user may copy it and run it themselves).

- **Block**: deleting outside the repo (`rm -rf` on `/`, `~`, `..` or absolute paths outside the repo; `Remove-Item -Recurse` likewise), disk/format tools, recursive `chmod 777` on home or root, writing to shell profiles or SSH keys, fork bombs, disabling security tools, reading credential stores (`~/.ssh`, `~/.aws`, browser profiles, keychains), any step whose cwd resolves outside the repo.
- **Warn**: `sudo` / admin elevation; pipe-to-shell (`curl … | sh`, `iwr … | iex`; show the domain); global installs (`npm i -g`, `pip install` outside a venv); commands that did not appear in the proven run; downloads from domains not seen in the proven run.
- **Secrets**: all output and every report go through `src/redact.js`. `.env` files are created from `.env.example` with empty values or placeholders; HUMBLE never prints, logs or uploads an `.env` value. A secret pasted into the console input is masked immediately.
- **Audit log**: every command HUMBLE ran or the user refused is appended to `.firstrun/onboard-log.jsonl` in the repo (time, command, verdict, exit code, duration; no output, no env values). A `security` tab in the header shows it, with a summary line: `12 commands run · 0 blocked · 1 warned · 0 secrets shown`.
- **Read-only promise is enforced**: the probe uses an allow-list of read-only commands (version flags, `which`/`where`, port checks), and a test proves it writes nothing outside a temp dir.

UI: a verdict chip on each `cmd` line before running: `ok` hidden, `warn` amber chip (`sudo`), `block` red chip (`blocked: deletes outside repo`). The shield icon in the header pulses once when something is blocked.

Acceptance (guard): guard tests with ≥ 25 real-world commands covering both sides of every rule; the probe side-effect test; a debugger test on the real acme-shop failure (faked host snapshot, real proof) producing the right rule and host-vs-proof diff; a report containing no secret (fake token built at runtime).

## 15. Debugger concepts borrowed from the best (what HUMBLE's debugger IS)

Each row is a proven idea from a famous debugger, mapped to setup debugging. Build in this order; ✱ = needs Docker (runs in the sandbox, never on the user's machine).

| # | borrowed from | concept | HUMBLE feature | owner |
|---|---|---|---|---|
| D1 | **Chrome DevTools / VS Code debugger** | breakpoints, step over / step into / continue, pause on exceptions, call stack | **Step controls** in the console: `F10` run this step, `F5` run to the end, `pause on failure` on by default, a `breakpoint` dot on any step (click the gutter). The "call stack" = the step's parent chain (README section → step → sub-command). | Hermes-1 (UI), Hermes-3 (state machine in console-core) |
| D2 | **Sentry** | breadcrumbs + error fingerprinting + "seen N times" | **Breadcrumbs**: the last 10 events before the failure (steps, env checks, warnings) above the error. **Fingerprint**: normalize the error (strip paths, versions, hashes, ports) → hash → match against every failure in our real audit runs (`audit/v2-31-final`, `audit/real-16-v2`): `seen in 3 of 31 real repos · fixed by rule node-version-mismatch`. Only real matches; `new failure` if none. | Hermes-2 |
| D3 | **Andreas Zeller's delta debugging (ddmin)** ✱ | shrink the difference between a passing and a failing input to the minimal cause | **Env bisect**: take the host-vs-proof differences (section 13.2), apply them to the proven sandbox with ddmin until the smallest set that reproduces the failure is found: `minimal cause: node 18 (1 of 4 differences)`. | next free Hermes |
| D4 | **git bisect** ✱ | binary-search history for the first bad commit | **README bisect**: `firstrun bisect <repo>` walks the README/lockfile history between the last VERIFIED commit and HEAD in the sandbox and names the first commit that broke setup (uses the existing drift module). | next free Hermes |
| D5 | **rr / Replay.io / WinDbg time-travel** | record once, scrub backwards | **Timeline scrubber**: every step records a snapshot (exit code, duration, files changed via `git status --porcelain`, env facts). A horizontal timeline under the terminal; drag to any step to see the state then. **Rewind** = run the recorded `undo` commands back to that step (through the guard + confirmation). Honest wording: "rewind using undo steps", not magic. | Hermes-1 (UI), Hermes-3 (snapshot model) |
| D6 | **strace / Process Monitor** ✱ | see which files, sockets and env the process touched | **Syscall lens**: re-run the failing step in the sandbox under `strace -f -e trace=file,network,process`, summarise only the useful parts: `ENOENT .env`, `ECONNREFUSED 127.0.0.1:5432`, `exec: python3.11 not found`. Each becomes evidence for the doctor rules. | next free Hermes |
| D7 | **pdb post-mortem / core dumps** ✱ | inspect the exact state at the crash | **Post-mortem shell**: `firstrun debug --shell` commits the failed sandbox container and opens a shell in it at the failing step, cwd and env as they were. | next free Hermes |
| D8 | **`flutter doctor` / `brew doctor`** | one command lists what's wrong with the machine, with fixes | Already = the intro checklist (section 7.1) + `firstrun onboard --doctor` prints it in the terminal with a fix hint per row. | Hermes-1 |
| D9 | **Wireshark-style watch / VS Code watch expressions** | watch values live | **Watch panel**: pin env facts (a port, a tool version, an env var NAME set/unset); they refresh every 2s and flash when they change. | Luna (web replay) / Hermes-1 |

Rules for all of them: evidence first (every claim links to a log line, snapshot or syscall), redaction everywhere, guard before every command, Docker-only features (✱) never touch the user's machine, and the UI says plainly when a feature needs the sandbox.

Acceptance (debugger concepts): D1 keyboard shortcuts work and pause-on-failure stops before the next step; D2 fingerprint test on real audit failures (two different repos with the same root cause hash equal; different causes differ); D3 ddmin unit test with a fake sandbox runner (4 differences, 1 culprit found in ≤ 6 runs); D5 rewind only uses recorded undo steps; D6 strace summariser tested on a recorded strace log.

## 16. One engine: the debugger and the guard run on the Bob engine (Arnav's direction)

The debugger (13, 15) and the security guard (14) are not separate tools: they are two **AI-assisted modes of the same engine** that already plans, diagnoses and reviews in HUMBLE (`src/brain/`: `askBob`, Bob custom modes in `modes.js`, rules first). The console is the face; the Bob engine is the brain.

**Engine contract (same for both modes):**
1. **Deterministic layer first** (free, instant, offline): doctor rules, fingerprint (D2), guard rules (14), syscall summary (D6). If it is sure, it answers and says `rules`.
2. **Bob layer** for anything the rules are not sure about: one `askBob` call with a dedicated mode, the redacted evidence pack, and a hard `maxCost`. Bob's answer must be JSON (use `extractJson`) and must cite the evidence line ids it used; an answer without citations is discarded.
3. **Verification layer**: nothing Bob says is trusted until it is checked: a Bob fix is re-run and the original checker must pass (debugger); a Bob security verdict can only make a command STRICTER (ok → warn → block), never looser than the rules (guard). Same principle as the plan review: Bob can hide or stop, never smuggle in.
4. **Attribution on screen**: every line shows who decided: `[rules]`, `[BOB]` in `--c-bob`, `[verified]` in `--c-ok`. The spend is shown: `Bob · 0.14 Bobcoins`.

**New Bob modes** (add to `src/brain/modes.js`, installed like the others):
- `firstrun-debugger` "🐞 HUMBLE Debugger": input = breadcrumbs, redacted capture, host-vs-proof diff, fingerprint matches, syscall summary, the step's proven command and checker. Output JSON: `{ cause, evidence: [ids], fix: { command, why, checker, undo }, confidence }`. Must not propose commands outside the repo; the proposed fix goes through the guard like any step.
- `firstrun-security` "🛡️ HUMBLE Security": input = the command, cwd, the guard's rule result, the proven run's commands and domains. Output JSON: `{ verdict: ok|warn|block, reason, evidence: [ids] }`. Called only when the rules return `warn` or the command is not in the proven run; cheap (`maxCost` 0.05). The final verdict is the STRICTER of rules and Bob.

**Budgets and fallback:** default session cap 0.5 Bobcoins, per-call caps above, shown before the call (`ask Bob · ≤ 0.2`). No Bob configured or cap reached → rules-only mode with a visible `rules only` chip; nothing breaks. Tests use a fake `askBob` (injectable), never real coins; one real Bob call per mode is recorded for the demo only with Arnav's go-ahead from Karmanya's coins.

## 17. Spatial context: HUMBLE knows where things are on your screen

Clicky's best trick (source: `ElementLocationDetector.swift`, the `[POINT:x,y:label:screenN]` tag): the companion sees the screen on demand and flies to the exact thing you need. HUMBLE does the same for setup, built on Lens (`lens/main.js`, `lens/overlay.js`: Ctrl+Shift+Space capture already exists) and on the same engine contract as section 16: **deterministic first, Bob for judgment, verification always.**

**What spatial context means in HUMBLE**
- **Where to act:** "Show me how" flies the Lamplighter to the user's own terminal window (the one whose title or cwd matches the repo) and beams at its prompt line: `paste it here`. When a dev server comes up, it beams at the browser tab/window on `localhost:PORT`, or offers to open it.
- **Where it broke:** when the user's terminal shows an error, HUMBLE finds that exact error line ON SCREEN and beams at it, then shows the diagnosis (section 13). Same for an editor showing a red squiggle in `.env` or `package.json`.
- **Where to look next:** the `.env.example` file in the editor sidebar, the Docker Desktop tray icon when Docker isn't running, the second monitor (`screen2`) if the terminal lives there.

**How it works (layers)**
1. **Window map (deterministic, no pixels):** enumerate top-level windows with title, app, bounds and screen (Electron `desktopCapturer.getSources` names + OS window APIs; on Windows `EnumWindows` via a tiny PowerShell/`node` helper, on macOS `CGWindowListCopyWindowInfo`). Match: terminal apps (Windows Terminal, iTerm, Terminal, VS Code terminal), editors, browsers with `localhost` in the title. Result = `spatial map` JSON: `[{ id: "W3", app, title, bounds, screen, role: terminal|editor|browser|docker }]`.
2. **Local OCR on demand (deterministic, private):** only on hotkey or when the user presses `look at my screen`, capture the relevant window, run the OS's built-in OCR (Windows `Windows.Media.Ocr`, macOS Vision `VNRecognizeTextRequest`), get lines with bounding boxes. Match those lines against the doctor rules and the fingerprint (D2). A match gives an exact box → exact beam target. No network, no model.
3. **Bob for judgment (text only):** if the rules can't place it, Bob (`firstrun-guide` or `firstrun-debugger` mode) receives the redacted OCR lines with box ids (`B17: "Error: connect ECONNREFUSED 127.0.0.1:5432"`) and the window map ids, and answers with a Clicky-style tag that cites ids instead of raw pixels: `[POINT:B17:the error:screen1]` or `[POINT:W3:your terminal]` or `[POINT:none]`. HUMBLE maps ids to coordinates itself, so Bob never needs the screenshot and can't point at something that isn't there.
4. **Verification:** a point is only drawn if the id exists in the current map, the box is still visible (re-check the window bounds right before the flight), and the label matches the box text for OCR targets.

**Coordinates (port Clicky's care):** convert between OCR image space, window space, screen space and the overlay's CSS pixels with DPI scale per monitor (`screen.getAllDisplays()` scaleFactor); clamp to the display; multi-monitor offsets; if the target is on another screen the Lamplighter flies to the edge nearest that screen and says `over on your other screen`.

**Privacy (non-negotiable, shown in the intro trust line):** no background capture; capture only on the hotkey or the `look at my screen` button, with a 1s amber border flash around the captured window so the user sees exactly what was read; screenshots stay in memory and are discarded after OCR; only redacted OCR text + ids may go to Bob; the security tab (14) logs every capture (time, window title, whether Bob saw text), never the image. Password managers, browser private windows and any window the user excludes are never captured (deny-list by app name).

**UI:** the beam (section 6) now targets real screen boxes; the target box gets a 2px `--c-core` rounded outline with a soft glow for the bubble's 3s hold; a small `👁 looked at: Windows Terminal` chip appears in the console header after a capture.

**Web console:** cannot see the visitor's screen: it replays a RECORDED spatial moment from our own demo machine (a screenshot we took ourselves + its real OCR boxes), labelled `recorded on our demo machine`.

Acceptance: window-map classifier tests on real window titles; coordinate conversion tests (2 monitors, 150% scaling, negative offsets); OCR matcher test on a recorded OCR result of a real error; Bob answer with an unknown id or mismatched label is rejected; a test proving no capture happens without the hotkey/button; the deny-list honoured.

**Pitch line:** "One engine. It plans your setup, proves it, debugs it on your machine, and guards every command, with IBM Bob as the brain and a rules engine as the seatbelt."

