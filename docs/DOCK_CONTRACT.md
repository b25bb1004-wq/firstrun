# FirstRun Dock: the contract (#90)

One page that the Dock UI (Zeus), the shell and bridge (Friday) and the solo agents (Edith, Hermes) all build against. Change it only by PR, and say so in #firstrun_1.

## 1. Solo agents (CLI)

Every agent runs on its own and writes the **same `events.ndjson`** the full pipeline writes, so its character animates in the Dock.

```
firstrun <agent> <target> [--out <dir>] [--json] [--bob-budget N]
```

| Agent | Command | Target | Result (`--json` prints it as the last stdout line) |
|---|---|---|---|
| scout | `firstrun scout <repo>` | path or GitHub URL | `{ agent:'scout', facts }` |
| planner | `firstrun plan <repo>` | path or GitHub URL | `{ agent:'planner', plan, conflicts }` |
| runner | `firstrun run <repo> --as-written` | path or URL | `{ agent:'runner', verdict:'WORKS-AS-WRITTEN'|'BROKEN-AS-WRITTEN', firstFailure }` |
| doctor | `firstrun doctor --log <file|-> [--repo <dir>]` | a failure log | `{ agent:'doctor', diagnosis, fix, bobcoins }` |
| verifier | `firstrun replay <run-dir>` | a finished run | `{ agent:'verifier', replay:{ status, durationMs } }` |
| scribe | `firstrun scribe <run-dir>` | a finished run | `{ agent:'scribe', files:{ report, readmeDiff, passport } }` |
| guide | `firstrun guide <repo>` | path | interactive (Bob Guide mode) |
| all | `firstrun verify <repo>` | path or URL | the full run (today's behaviour) |

- `--out` defaults to `<repo>/.firstrun/<agent>-<id>/`; the run dir always contains `events.ndjson`.
- Exit code: `0` done, `1` the agent found a problem (e.g. broken as written), `2` the agent itself failed.
- Nothing prints or stores credentials; tokens copied from READMEs are masked (#83).

## 2. Events (already emitted by the pipeline; solo agents reuse them)

One JSON object per line: `{ t, run, agent, type, data }`, with `agent` one of `scout planner runner doctor verifier scribe guide swarm`.

| type | who | data (fields the Dock uses) |
|---|---|---|
| `phase` | any | `{ phase: scout|plan|coldstart|repair|replay|publish|done }` |
| `facts` | scout | `{ stack, docs, node, python, services }` |
| `plan` | planner | `{ image, steps[], conflicts[] }` |
| `step.start` / `step.end` | runner, verifier | `{ stepId, command, exitCode, durationMs, status }` |
| `diagnosis` / `fix` | doctor | `{ stepId, diagnosis:{ cause, class, ruleId|by } }` / `{ fix }` |
| `evidence` | doctor | `{ id, stepId, status: verified|progressed|needs-human|failed }` |
| `bob` | doctor, planner | `{ bobcoins, ok, taskId }` |
| `replay.start` / `replay.end` | verifier | `{ status }` |
| `artifact` / `passport` | scribe | `{ path }` / passport |
| `done` | swarm (full run) or the solo agent | `{ verdict }` |
| `error` | swarm or the solo agent | `{ message }` |
| `step.inserted` / `step.log` | runner | an inserted fix step / batched step output (the Dock ignores `step.log`) |

## 3. Character states (derived in `src/dock-state.js`, pure and tested, owned by Friday)

`idle` · `working` · `done` · `needs_you`, plus a one-line `line` for the speech bubble.

| Character | working when | done when | needs_you when |
|---|---|---|---|
| Scout | `phase:scout` | `facts` | `error` from scout |
| Planner | `phase:plan` | `plan` (line: "N steps, M conflicts") | plan has 0 runnable steps (NO-SETUP-DOCS) |
| Runner | `step.start` by runner | `phase:replay` or `done` | a runner `step.end` fails (line: the command) |
| Doctor | `phase:repair` | `evidence` verified/progressed | `evidence` needs-human |
| Verifier | `replay.start` | `replay.end` passed | `replay.end` failed |
| Scribe | `phase:publish` | `passport` / `done` | none |
| Guide | the user opens it | none | none |

## 4. IPC between the Dock window and the Electron main process

| Channel | Direction | Payload |
|---|---|---|
| `dock:run` | UI → main | `{ agent: 'all'|'scout'|…, target: string }` |
| `dock:state` | main → UI (push, throttled to 10/s) | `{ target, agent, phase, verdict, characters:{ scout:{state,line}, … }, evidence:[{id,status,cause}], bobcoins, runDir }` |
| `dock:open` | UI → main | `{ what: 'report'|'readme-diff'|'passport'|'folder', runDir }` |
| `dock:cancel` | UI → main | `{}` |
| `dock:lens` | UI → main | `{}` (opens Lens, the Doctor's circle-an-error mode) |
| `dock:toggle` | button → main | `{}` (opens or closes the panel) |

## 5. Files and owners

- `lens/main.js`, `lens/dock-bridge.js` (tray, floating button, hotkey, spawning agents, tailing events): **Friday**
- `src/dock-state.js` + `test/dock-state.test.js`: **Friday**
- `lens/dock/` (`index.html`, `dock.js`, `dock.css`, `characters/*.svg`): **Zeus**. Uses `ui/theme.css` tokens and talks only through `window.dock` (preload): `run({ agent, target })`, `open`, `cancel`, `lens`, `toggle`, `onState`.
- `src/cli.js` cases `scout`, `doctor`, `scribe`, and `plan --out`: **Friday** (#93, taken over from Edith); `run --as-written`, `replay`: **Hermes**. Each in its own PR with its own test file.
- Hotkey: `Alt+Command+Space` (Mac), `Control+Alt+Space` (Windows/Linux). The floating button starts top-left and is draggable.
