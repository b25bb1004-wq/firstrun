# HUMBLE, the onboarder

> One agent a developer actually meets. Six specialists work behind it. It lives in the corner of the screen, runs
> the whole setup check in the background, and then either **does the setup for you** or **walks you through it on
> your own screen**, pointing at exactly where to click and type, and checking each step as you go.

Owner of the idea: Karmanya. Spec: Edith, 27 Sep 2026. Status: design + hackathon MVP scope.

---

## 1. What HUMBLE is

HUMBLE is the **main agent**, the onboarder. It combines the six agents the engine already has:

| Agent | Role inside HUMBLE | What the user sees |
|---|---|---|
| **Harvey** (Scout) | Reads the repo: docs, manifests, lockfiles, compose, CI, code | "Reading your repo…" |
| **Unity** (Planner) | Turns the docs into exact, ordered steps and flags where docs and code disagree | The step list |
| **Mach** (Runner) | Runs every step on a clean machine in the background | Live progress |
| **DR.BO** (Doctor) | Diagnoses what breaks: rules first, IBM Bob when no rule explains it | "Found why step 3 breaks" |
| **Larp** (Verifier) | Throws the machine away and replays the repaired guide from zero | "Proven from zero." |
| **Echo** (Scribe) | Writes the fixed README, the passport and the **guide script** HUMBLE teaches from | The two choices |

The user never has to know the six exist. HUMBLE speaks for them. (In the UI the robot can briefly "wear" an
agent's colour or tool while that agent works, so a curious user can see who is doing what.)

**Why this is the unique point:** existing tools either *set up environments for agents* (EnvBench, Repo2Run, Installamatic)
or *point at the screen in general* (Clicky, Google DeepMind's Magic Pointer). HUMBLE is the first to do both **for a
specific repo, with proof**: it has already run the setup on a clean machine, so every step it teaches is known to
work, and every fix has evidence behind it.

## 2. Principles

1. **Proven before shown.** HUMBLE only teaches or applies steps Larp has replayed from zero. Nothing is guessed live.
2. **Never act without consent.** Every command is shown before it runs. Secrets are never typed by the robot.
3. **Point, don't describe.** "Click here" with the robot standing next to the button beats a paragraph of text.
4. **Check every step.** A step is done when HUMBLE has *seen* it succeed (exit code, file, port, page), not when
   the user clicks Next.
5. **Cute, never in the way.** The robot is small, calm, and silent unless spoken to. The window never covers the
   thing it is teaching.
6. **Palette and rules.** Oat, blue, hot pink; Bricolage + Futura/Jost; the anti-vibecode list applies.
   (Section 4 explains why the console is not a banned "terminal mockup": it is a real console with real output.)

## 3. The journey

```
[ corner icon ] --click / hotkey--> [ HUMBLE console opens ]
        |
        v
  Background run (the six agents): read → plan → run on a clean machine → diagnose → fix → replay from zero
        |
        v
  Report: "Your README has 4 steps that break. I fixed and proved all 4. Your machine is missing Node 18."
        |
        +--> Choice A: "Do it for me"      (Autopilot)
        |
        +--> Choice B: "Show me how"       (Guide: the robot walks you through it on your screen)
        |
        v
  Done: app running on YOUR machine, verified. Echo offers the README fix as a PR.
```

### 3.1 Activation
- **Corner icon** (existing Lens dock button, 56 px, always on top, draggable, remembers its corner).
- States: *sleeping* (idle), *awake* (repo detected in the focused editor/terminal), *working* (background run),
  *needs you* (a choice or a question is waiting, gentle pulse once, never looping), *done*.
- Opens with a click or a hotkey (Ctrl/⌘ + Shift + H). It detects the current repo from the focused VS Code / Bob IDE
  window, the terminal's working directory, or asks.

### 3.2 The background run
- Uses the existing engine (`firstrun verify`) through the Lens bridge (`lens/dock-bridge.js`), streaming
  `events.ndjson`. Every engine event maps to a robot state and a console line (section 5.3).
- Two things are checked, not one:
  1. **The clean machine** (Docker): does the README work from zero, and what fixes it? (what the engine does today)
  2. **The user's machine** (read-only probe): which tools, versions, services and ports the user already has.
     `node -v`, `python --version`, `docker info`, free ports, existing `.env`. Nothing is installed or changed here.
- The **gap** between "what the proven guide needs" and "what your machine has" becomes the personalised plan.

### 3.3 The report
One short paragraph, plain words, then the two big choices. Example:

> I ran this repo's setup on a clean machine. 4 steps broke; I fixed all 4 and proved it from zero in 1m53s.
> On your machine you already have Node 22 and Docker. You're missing MongoDB and Redis. 6 steps to go.
>
> **[ Do it for me ]**   **[ Show me how ]**

### 3.4 Choice A: "Do it for me" (Autopilot)
- Runs the **personalised plan** in the user's own terminal (VS Code integrated terminal when available, otherwise a
  terminal HUMBLE opens), one step at a time, each step:
  1. shown with the exact command and *why* ("Redis isn't started by the README; the app needs it on 6379"),
  2. confirmed (per step, or "approve all" after the user has seen the list),
  3. run, with output streamed into the console,
  4. **verified** with the step's check (exit code / file / port / HTTP), which is the same check Larp used.
- File changes (README, `.env` from `.env.example`, compose) are shown as a diff and applied only on approval.
- **Undo:** every change is recorded; "Undo last" and "Undo all" restore files and stop anything HUMBLE started.
- **Secrets:** when a step needs a real secret (an API key), HUMBLE stops and asks the user to paste it into the file
  themselves (it points at the exact line). It never types, stores or logs secrets.
- Ends with the app running and verified, then offers Echo's README fix as a PR ("help the next person").

### 3.5 Choice B: "Show me how" (Guide)
This is the heart of it: a learner-friendly, interactive walkthrough on the user's real screen.
- The robot **walks** from the corner to where the action is (the terminal, a file in the editor, the browser),
  **points** at the exact spot, and says one or two sentences.
- The user does the step. HUMBLE **watches for success** (terminal output, file saved, port open, page responds) and
  only then celebrates briefly and walks to the next step.
- Each step has three levels of help: **Hint** (where), **Show** (the exact text, copy button), **Do it** (fall back to
  Autopilot for just this step).
- **Why?** button on every step: the evidence from the clean-machine run ("on a clean machine `npm install` failed
  with ERESOLVE; `--legacy-peer-deps` fixes it; here is the log").
- **When the user's step fails** (a different error than expected), Lens reads the error on screen (OCR). A known
  failure gets its proven fix instantly; an unknown one goes to DR.BO (rules, then IBM Bob). This is the bridge to the
  future debugging feature.
- **Adapts to the learner:** "I'm new to this" (explains terms: what a port is, what `.env` does) vs "I know what I'm
  doing" (short, faster, fewer stops).
- **Progress** is saved: close the window mid-way, and HUMBLE resumes at the same step.

## 4. The UI

### 4.1 The console window (the "small terminal-like window")
- A compact panel (~420 × 520 px) that opens from the corner icon. It is a **real console**: every line is a real
  engine event or real command output, which is why it is not the "fake terminal mockup" the design rules ban. It still
  follows the design system: oat surface (roasted-oat in dark), hairline rules, 2 px corners, no shadows, Futura/Jost
  for HUMBLE's words, a mono face only for commands and output.
- Layout, top to bottom:
  1. Header: the robot's small portrait, repo name, a one-word status.
  2. The **agent strip**: Harvey · Unity · Mach · DR.BO · Larp · Echo, each lighting up while it works (text + colour,
     no icons from icon sets).
  3. The **feed**: HUMBLE's short sentences, commands, results; collapsible logs.
  4. The **action area**: the two choices, then per-step buttons (Hint / Show / Do it / Why? / Skip).
- It moves out of the way automatically: when the robot points at something under the window, the window slides to
  the opposite corner.

### 4.2 The robot (HUMBLE)
- A small **Bob-style toy robot** (a friendly, rounded, antenna'd robot in HUMBLE's palette; drawn for us as SVG
  sprites or Lottie, not a stock icon).
- Size ~48–64 px on screen; lives in a transparent, click-through overlay above all windows (one per display).
- **States and animations** (each short, purposeful, not looping except a subtle idle breath):
  `sleep`, `wake`, `think` (agents working; small gears/antenna blink), `walk` (to a target, arced path),
  `point` (arm extends, a small pointer triangle at the target, like Clicky's), `talk` (speech bubble with 1–2 lines),
  `wait` (watching the user's step), `celebrate` (tiny hop when a step verifies), `worried` (a step failed), `stuck`
  (needs the user: a secret, a choice).
- **Motion rules:** ease-out curves, arced flights with a slight scale-up mid-flight (Clicky's technique), stops
  *beside* a target, never on top of it; respects reduced motion (teleports + fades instead of walking).

### 4.3 Pointing (how the robot knows where to stand)
Grounding, from most to least precise; the first provider that returns a confident target wins:
1. **Editor API** (VS Code / Bob IDE extension): exact file, line and range for "edit line 12 of `.env`"; the
   terminal panel's bounds for "run this".
2. **Accessibility tree** (OS a11y APIs): named buttons and fields in other apps.
3. **OCR text match** (Lens already ships Tesseract.js): find the exact text on screen ("npm run dev", "PORT=").
4. **Vision model pointing** (Clicky's protocol): send a screenshot (≤1280 px per side, own windows excluded) and ask
   the model to answer with `[POINT:x,y:label:screenN]` or `[POINT:none]`; convert screenshot pixels → display
   coordinates (scale, per-display offsets, clamp with padding so the robot stands beside the target).
If nothing is confident, HUMBLE says so and shows the instruction in the console instead of pointing at a guess.

## 5. Architecture

### 5.1 Where it runs
- **Desktop:** an evolution of **Lens** (Electron, already cross-platform: Windows, macOS, Linux). HUMBLE reuses its
  dock button, dock panel, screen capture (`desktopCapturer`), overlay and the engine bridge.
- **Editor:** a thin **VS Code / IBM Bob IDE extension** that gives HUMBLE the editor and terminal APIs (exact
  file/line targets, running commands in the integrated terminal, reading exit codes via shell integration). Bob IDE
  also reaches HUMBLE through the existing MCP tools (`firstrun_plan`, `firstrun_verify`, …) and the Guide mode.
- **Engine:** the existing `firstrun` CLI (Engine v2 on main), unchanged, plus one new output: the **guide script**.

### 5.2 Windows (Electron)
| Window | Purpose |
|---|---|
| `corner` | the 56 px icon (existing dock button) |
| `console` | the HUMBLE window (evolves the existing dock panel) |
| `stage` (one per display) | full-screen, transparent, click-through overlay where the robot walks and points |

### 5.3 Engine events → robot and console
| Engine event | Robot | Console |
|---|---|---|
| `facts` (Harvey) | `think`, Harvey lit | "Reading your repo…" |
| `plan` (Unity) | `think`, Unity lit | "N steps found; docs and code disagree on X" |
| `step.start/end` (Mach) | `think` | step line, pass/fail |
| `diagnosis` (DR.BO) | `worried` → `think` | "Step 3 breaks: <cause>" |
| `fix` | `think` | "Fix: <doc text>" |
| `replay.*` (Larp) | `think` | "Proving it from zero…" |
| `done` VERIFIED (Echo) | `celebrate` → `talk` | the report + the two choices |

### 5.4 The guide script (new, written by Echo)
Echo already writes `FIRSTRUN.md`, the README diff and the passport. It will also write `guide.json`, the
machine-readable script both choices execute:

```json
{
  "repo": "GeekyAnts/express-typescript", "commit": "6b9bb70e23", "verdict": "VERIFIED",
  "steps": [
    {
      "id": "S3",
      "say": "Install dependencies. This project needs a flag the README forgot.",
      "why": { "evidence": "E1", "cause": "npm refuses the conflicting peer dependencies", "log": "logs/S3-1.log" },
      "do": { "type": "run", "command": "npm install --legacy-peer-deps", "where": "terminal" },
      "target": { "kind": "terminal" },
      "check": { "type": "exit", "code": 0 },
      "userMachine": { "needs": ["node>=18"], "skipIf": null },
      "risk": "low"
    },
    {
      "id": "R2",
      "say": "Start MongoDB. The README assumes it's already running.",
      "do": { "type": "run", "command": "docker compose up -d mongo" },
      "check": { "type": "port", "port": 27017 }
    },
    {
      "id": "E1",
      "say": "Create your .env from the example, then paste your own API key on the line I'm pointing at.",
      "do": { "type": "edit", "file": ".env", "fromTemplate": ".env.example", "userFills": ["OPENAI_API_KEY"] },
      "target": { "kind": "file-line", "file": ".env", "match": "OPENAI_API_KEY=" },
      "check": { "type": "file-has", "file": ".env", "match": "^OPENAI_API_KEY=.+" },
      "secret": true
    }
  ],
  "done": { "type": "http", "url": "http://127.0.0.1:4040/", "expect": 200 }
}
```
Step `do.type`: `run` | `edit` | `open` (a file or URL) | `click` (a UI element, via grounding). `check.type`:
`exit` | `port` | `http` | `file-has` | `process`. Every field comes from the verified run; nothing is invented at
guide time.

### 5.5 The user-machine probe
Read-only commands, each with a timeout: tool versions (`node`, `python`, `docker`, package managers), running
services and occupied ports, existing files (`.env`). The plan is diffed against it: steps already satisfied are
marked "you already have this" and skipped.

### 5.6 Safety model
- Autopilot and Guide run only **proven** steps, only in the repo folder, only after consent.
- Allowed actions: the commands from `guide.json`, file edits limited to docs/config paths (the same allowlist the
  Doctor already enforces: never application source code).
- Secrets: never typed, stored, logged, or sent to a model. Screenshots sent for pointing exclude HUMBLE's own windows
  and are never stored.
- Everything is undoable; an audit log of every action is saved to `.firstrun/humble-session.json`.

## 6. Built on Clicky (MIT) and Magic Pointer ideas

- **Clicky** (farzaa/clicky, MIT; Swift/macOS) proved the interaction: a buddy next to the cursor that sees the screen
  and points. We reuse its **ideas and protocol**, re-implemented in Electron so it runs everywhere:
  per-display transparent overlays; screenshots capped at 1280 px with the app's own windows excluded; the
  `[POINT:x,y:label:screenN]` / `[POINT:none]` tag; the arced, scale-up flight that stops *beside* the target. If we
  copy any code or assets, we keep its MIT notice in `THIRD_PARTY_NOTICES.md`. Windows ports (clicky-windows,
  openclicky) are references for the Windows capture and overlay details.
- **Google DeepMind's Magic Pointer** shows the next step: the pointer understands what you're focused on. HUMBLE
  applies it to one job: onboarding, and later debugging, with proof.
- **What HUMBLE adds that neither has:** a repo-specific, pre-verified script. Clicky improvises every answer; HUMBLE
  teaches steps it has already proven on a clean machine, and checks each one on yours.

## 7. Hackathon MVP (submission today, 18:00 IST)

Scope we can build and demo honestly in the time left:

| # | MVP piece | Builds on | Owner |
|---|---|---|---|
| 1 | Echo writes `guide.json` from the verified run (steps, say, why/evidence, command, check) | scribe + passport | backend agent |
| 2 | Console window: agent strip, live feed from events, the two choices | Lens dock panel + dock-bridge | Edith |
| 3 | The robot: SVG sprite with `think / walk / point / talk / celebrate / worried` | new `lens/humble/` | Zeus |
| 4 | Stage overlay + pointing via **terminal target + OCR text match** (no vision model needed for the demo) | Lens overlay + Tesseract | Edith |
| 5 | Autopilot on **one demo repo** (GeekyAnts): per-step confirm, run in a terminal, verify each check | engine + guide.json | Edith |
| 6 | Guide mode on the same repo: robot walks to the terminal, points, waits for the check, celebrates | 3 + 4 + 5 | Edith + Zeus |
| 7 | 30-second screen recording for the video | all | Karmanya (narration) |

Explicitly **later** (say so honestly in the pitch): vision-model pointing, accessibility-tree grounding, the VS Code
extension, voice, the user-machine probe beyond versions, undo-all, debugging mode.

## 8. Open questions for Karmanya
1. Robot design: draw our own "Bob-style toy robot", or is there an official IBM Bob mascot asset we are allowed to use?
2. Autopilot consent: per-step confirm by default, or "approve all" after showing the list?
3. Should HUMBLE also offer the README fix as a PR at the end (needs GitHub auth in Lens)?
4. Voice: skip for the hackathon (recommended), or push-to-talk in the MVP?

## 9. Note on IBM Bob in the numbers
The final 31-repo run was rules-only (0 Bobcoins) by decision. HUMBLE's DR.BO path uses Bob when no rule explains a
failure; before submission we should run the capped Bob pass (≤ 5 Bobcoins, INCONCLUSIVE/FAILED repos only) so the
Bob part of the story has real evidence, and so the demo can show at least one Bob-diagnosed fix.

---
Sources: [farzaa/clicky](https://github.com/farzaa/clicky) (MIT), [How Clicky works (Isaac Flath)](https://isaacflath.com/writing/how-clicky-works),
[openclicky](https://github.com/jasonkneen/openclicky), [clicky-windows](https://github.com/Bitshank-2338/clicky-windows),
[DeepMind Magic Pointer (9to5Google)](https://9to5google.com/2026/05/12/deepmind-googlebook-magic-pointer/).
