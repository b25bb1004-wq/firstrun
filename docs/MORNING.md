# Morning handoff: what's done, what only you can do

## Done overnight

- **FirstRun works end to end**: `plan` (static, seconds) → `verify` (clean container, repair
  with evidence, replay from zero, publish PR files) → `guide` (newcomer walkthrough) → `guard`
  (PR drift check) → `audit` (parallel swarm) → `ui` (live dashboard) → `mcp` (tools for Bob).
- **Demo repos** `examples/acme-shop` (Node + Postgres + Redis, 5 breaks) and
  `examples/notes-api-py` (FastAPI, 4 breaks): both go from a broken README to **VERIFIED**
  with every break fixed and replayed from zero (acme-shop ~45 s end to end, replay ~14 s).
- **Real-world audit** of 16 popular public repos pinned to exact commits: `audit/real-16/`.
- **Bob integration**: Bob Shell headless as the Doctor/Planner brain, 4 custom modes
  (`.bob/custom_modes.yaml`), MCP server (`.bob/mcp.json`). Also tested against a stand-in Bob,
  because real Bob needs your login.
- 19 unit/integration tests (`node --test test/*.test.js`).
- Private GitHub repo: https://github.com/b25bb1004-wq/firstrun (commits under your name).

## Only you can do these (in order)

### 1. Sign in to Bob (5 min, each teammate)
- **Bob IDE**: download from https://bob.ibm.com/download (Windows x64), install, and sign in
  with the **hackathon IBMid**. Settings → General must show the `ibm-coding-challenge-…` instance.
- **Bob Shell** is already installed (`bob --version` → 2.0.5). Run `bob` once in a terminal and
  complete the browser login. FirstRun's modes are already installed in `~/.bob/custom_modes.yaml`.

### 2. Check Bob works with FirstRun (2 min, ~1 Bobcoin)
```powershell
cd C:\Users\ADMIN\FirstRun
node bin/firstrun.js bob            # should print "✓ Bob Shell 2.0.5"
```
Then one real Bob diagnosis on a repo where the rules give up (see `audit/real-16/audit.json`
for FAILED repos), with a hard budget:
```powershell
node bin/firstrun.js verify .firstrun-work/repos/JKHeadley__rest-hapi --brain auto --bob-budget 2
```
If Bob answers, the evidence card says "diagnosed by IBM Bob · N Bobcoins". **Note N**: it
tells us how many Bob calls the 40 Bobcoins can pay for.

### 3. Record Bob IDE sessions (required for judging; each teammate)
Open `C:\Users\ADMIN\FirstRun` in Bob IDE. It picks up the modes and the MCP server (approve
`firstrun` when asked). Suggested tasks, each a real use of Bob:
1. **🚀 FirstRun mode**: *"Plan and verify examples/notes-api-py, then explain each evidence
   record to a new contributor."* (MCP: `firstrun_plan`, `firstrun_verify`, `firstrun_status`)
2. **🚀 FirstRun mode**: *"Look at audit/real-16/audit.json. Which repos still need a human and
   why? Propose a new Doctor rule for the most common one."* Then let Bob (Code mode) implement
   that rule in `src/doctor/rules.js` with a test in `test/doctor.test.js`, and run
   `node --test test/*.test.js`.
3. **🧭 FirstRun Guide mode** in `examples/acme-shop` (after `node bin/firstrun.js apply examples/acme-shop`
   on a scratch copy): *"I just cloned this. Help me get it running."*
4. Export each task: chat panel → Views and More Actions → History → export. Put the files in
   `bob_sessions/` and commit.

Budget: 40 Bobcoins per person, no top-ups. Rules handle most breaks for free; spend Bob on the
long tail and the IDE sessions.

### 4. Record the demo video (~4 min)
Follow `docs/DEMO.md`. Dashboard: `node bin/firstrun.js ui --root examples --root audit`.

### 5. Submit (lablab.ai)
- Make the repo public: `gh repo edit b25bb1004-wq/firstrun --visibility public --accept-visibility-change-consequences`
- Check that no credentials are in the repo (there are none from me; `bob_sessions/` exports
  must be scrubbed too).
- Title: **FirstRun: your README, proven**. Use the README intro as the description.
