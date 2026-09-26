# HUMBLE — architecture and contracts

HUMBLE treats a repository's README as an executable procedure. It follows the
setup instructions in a clean container exactly as a newcomer would, repairs what
breaks, backs every repair with an evidence record, replays the repaired plan from
zero, and publishes a corrected README plus a Setup Passport.

This file is the contract between the engine (`src/`), the dashboard (`ui/`), the
Bob integration (`.bob/`, `src/brain/`, `src/mcp.js`) and the drift guard
(`action/`). Change the contract here first.

## Pipeline and agents

| Agent    | Module              | Job                                                              |
| -------- | ------------------- | ---------------------------------------------------------------- |
| Scout    | `src/scout/`        | Read docs + manifests + CI + compose into `facts`                |
| Planner  | `src/plan.js`       | Turn README setup sections into ordered `steps`, flag conflicts  |
| Runner   | `src/runner.js`     | Execute steps in a clean container (`src/sandbox.js`)            |
| Doctor   | `src/doctor/`       | Classify a failure (rules first, Bob when rules don't match), propose a fix |
| Verifier | `src/verify.js`     | Replay the repaired plan in a brand-new container               |
| Scribe   | `src/scribe/`       | README patch, `.env.example`, devcontainer, report, Passport     |
| Guard    | `src/drift.js`      | Static drift check between two commits (no Docker)               |

The Doctor tries deterministic rules first and calls Bob only when no rule
matches, so Bobcoins go only to failures that need reasoning. Every Bob call is
logged with its cost.

## Run directory

Every run writes to `<repo>/.firstrun/` (or `--out`):

```
.firstrun/
  run.json            # RunState (below), rewritten as the run progresses
  events.ndjson       # one Event per line (below), append-only
  plan.json           # Plan
  evidence/E1.json    # EvidenceRecord, one per repair
  logs/<attempt>.log  # full stdout+stderr per step attempt
  out/README.md       # corrected README
  out/README.diff     # unified diff vs original
  out/.env.example
  out/.devcontainer/devcontainer.json (+ docker-compose.yml when services are needed)
  out/FIRSTRUN.md     # human report
  out/passport.json
  out/passport.svg    # badge
```

## Types

```ts
type Step = {
  id: string;              // "S1".. in README order
  command: string;         // exactly as the README says (after prompt stripping)
  cwd?: string;            // relative to repo root, default "."
  kind: "prereq" | "install" | "env" | "services" | "migrate" | "build" | "serve" | "test" | "other";
  source: { file: string; line: number; section: string };  // where in the docs it came from
  origin: "readme" | "repair";   // "repair" = inserted by the Doctor
  skip?: string;           // reason if not executed (e.g. "git clone: repo already present", "macOS-only")
  serve?: { port?: number; readyPattern?: string };          // kind === "serve"
};

type Plan = {
  repo: string; commit: string;
  image: string;           // base image the newcomer starts from
  runtime: { name: "node" | "python" | "other"; version: string; source: string };
  steps: Step[];
  conflicts: { what: string; docs: string; truth: string; source: string }[];
  verify: { kind: "http" | "command" | "exit"; target: string };  // done-when
};

type Attempt = {
  stepId: string; n: number;          // n-th attempt of this step
  command: string; exitCode: number; durationMs: number;
  logTail: string;                     // last ~60 lines
  logFile: string;                     // logs/<id>-<n>.log
};

type Diagnosis = {
  class: "runtime-version" | "missing-script" | "missing-env" | "missing-service" |
         "missing-tool" | "missing-dependency" | "wrong-order" | "missing-file" |
         "platform-specific" | "needs-secret" | "unknown";
  cause: string;           // one sentence, human readable
  by: "rules" | "bob";
  ruleId?: string;
  confidence: number;      // 0..1
  bobcoins?: number;
};

type Fix = {
  actions: (
    | { type: "exec"; command: string; cwd?: string }            // run in sandbox
    | { type: "rebase"; image: string }                           // new base image, replay passed steps
    | { type: "service"; name: string; image: string; env?: Record<string,string>; port: number }
    | { type: "write"; path: string; content: string }            // file in sandbox workspace
    | { type: "replace-step"; command: string }                    // step command itself was wrong
    | { type: "insert-before"; command: string; kind: Step["kind"] }
  )[];
  doc: {                   // what changes in the README for humans
    kind: "replace-command" | "insert-step" | "prerequisite" | "note";
    text: string;
  };
};

type EvidenceRecord = {
  id: string;              // "E1"
  stepId: string;
  before: Attempt;         // the failing attempt
  diagnosis: Diagnosis;
  fix: Fix;
  after: Attempt | null;   // null => repair failed; step escalated to a human
  status: "verified" | "failed" | "needs-human";
  at: string;              // ISO time
};

type RunState = {
  id: string; repo: string; commit: string; startedAt: string; finishedAt?: string;
  phase: "scout" | "plan" | "coldstart" | "repair" | "replay" | "publish" | "done" | "error";
  plan?: Plan;
  steps: Record<string, { status: "pending" | "running" | "passed" | "failed" | "repaired" | "skipped" | "needs-human"; attempts: number }>;
  evidence: string[];      // evidence ids
  replay?: { status: "passed" | "failed"; durationMs: number; failedStep?: string };
  passport?: Passport;
  bobcoins: number;
};

type Passport = {
  repo: string; commit: string; verifiedAt: string;
  verdict: "VERIFIED" | "PARTIAL" | "FAILED";
  image: string; runtime: string;
  stepsTotal: number; stepsFromReadme: number;
  breaksFound: number; breaksFixed: number; needsHuman: number;
  replaySeconds: number;   // clone-to-running time of the repaired guide, from zero
  bobcoins: number;
};
```

## Events (`events.ndjson`, and SSE `GET /api/runs/:id/events`)

```ts
type Event = { t: string; run: string; agent: "scout"|"planner"|"runner"|"doctor"|"verifier"|"scribe"|"guard"|"swarm";
               type: string; data: any };
```

| type              | data                                                    |
| ----------------- | ------------------------------------------------------- |
| `phase`           | `{ phase }`                                             |
| `facts`           | facts summary                                           |
| `plan`            | `Plan`                                                  |
| `step.start`      | `{ stepId, n, command }`                                |
| `step.log`        | `{ stepId, n, chunk }` (throttled)                      |
| `step.end`        | `Attempt & { status }`                                  |
| `diagnosis`       | `{ stepId, diagnosis }`                                 |
| `fix`             | `{ stepId, fix }`                                       |
| `evidence`        | `EvidenceRecord`                                        |
| `replay.start` / `replay.end` | `{ status, durationMs }`                    |
| `artifact`        | `{ name, path }`                                        |
| `passport`        | `Passport`                                              |
| `bob`             | `{ mode, bobcoins, ok, taskId }`                        |
| `done` / `error`  | `{ verdict }` / `{ message }`                           |

Audit (swarm) runs add `swarm` events: `{ type: "repo.queued"|"repo.start"|"repo.done", data: { slug, verdict?, passport? } }`
and write `audit/<auditId>/audit.json`:
`{ id, startedAt, repos: [{ slug, url, status, verdict, passport, runDir }] }`.

## Dashboard HTTP API (`firstrun ui`, default port 4173)

- `GET /api/runs` → `[{ id, repo, phase, verdict, startedAt, dir }]`
- `GET /api/runs/:id` → `RunState`
- `GET /api/runs/:id/events` → SSE replaying existing events, then live events
- `GET /api/runs/:id/evidence/:eid` → `EvidenceRecord`
- `GET /api/runs/:id/file?path=out/README.diff` → raw text (restricted to the run dir)
- `GET /api/audits`, `GET /api/audits/:id`, `GET /api/audits/:id/events` (SSE)
- Static UI served from `ui/`.
