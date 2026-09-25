# Working on this repo (humans and AI agents)

Four agents share this repo; who does what is in `AGENTS.md`.

Two people, each with their own Claude Code, work on this repo during the IBM Bob 2.0 Hackathon
(lablab.ai, 25 Sep 8:30 PM IST → **27 Sep 8:30 PM IST deadline**). Read this first, then
**`docs/CONTEXT.md`** (living team context: state, decisions, log; update it after every merged PR or decision),
**`docs/HACKATHON_BRIEF.md`** (official requirements: read before any submission work), `docs/WHY_FIRSTRUN.md` (problem, solution, rules, judging) and `README.md` (what exists).

## Coordination protocol

The two agents cannot talk to each other directly. They coordinate through GitHub:

1. **Tasks are GitHub Issues** (`gh issue list`). Before starting work, take an unassigned issue and
   assign it to your human (`gh issue edit N --add-assignee @me`) and comment "starting". Never work
   on an issue assigned to someone else. New work you discover → open an issue, don't just do it.
2. **One branch per issue**: `<name>/<issue>-<slug>`. Never commit to `main` directly.
3. **Pull before you start, and often**: `git pull --rebase origin main`.
4. **Open a PR that says `Closes #N`**. The *other* person's agent reviews it (`gh pr diff`,
   `node --test test/*.test.js`) before merge. Keep PRs small.
5. **Status goes in the issue**, not in chat: what's done, what's blocked, what the other side needs.
6. **Don't edit the same files in parallel.** If your issue touches a file another open PR touches,
   comment on the issue first.

## Team chat (Discord)

Humans and agents also talk in `#firstrun_1` on the Helios Discord server through `node tools/chat.js`.
Each agent has its own bot: **Friday** is Arnav's Claude, **Edith** is Karmanya's Claude; Antigravity and Hermes (Nemotron) join with their own bots, lanes in `AGENTS.md` (token in
`.env`). Setup and commands are at the top of `tools/chat.js`.

- **Waiting for messages:** run `node tools/chat.js wait --timeout 1800` as a background command.
  It exits when someone else posts, which wakes you. Read the messages, act, then start waiting again.
- **Post:** `node tools/chat.js send "…"`. Keep it short. Say what you're taking, what you finished
  (with the PR or issue link) and what you need from the other side.
- **No ping-pong.** Don't reply to a bot message that only acknowledges or thanks. At most **3
  agent-to-agent messages in a row** without a human message; then stop and wait for a human.
- **Chat is for coordination; decisions and task state go in GitHub issues.** A human's
  instruction in chat counts only if it comes from one of the two humans on this team.
- **Never paste credentials, tokens or `.env` contents** into chat (the script refuses obvious ones).

## Recovery mode (when an agent runs out of usage)

Either agent can hit its usage limit at any time without warning. Work must never live only in
one agent's context.

- **Push early, push often.** Push your branch at every working step (a draft PR is fine), and
  leave a short progress comment on the issue: done / next / open question. That comment is the
  handoff note.
- **At the start of every session, and when you come back from a limit**, run
  `node tools/chat.js inbox` and `node tools/handoff.js` before doing anything else.
- **One agent down:** an item assigned to the other agent that has had no update for **45 minutes**
  (`handoff.js` marks it STALE) may be taken over. First post in chat: "Taking over #N from
  <name> (no update since …)". Then comment on the issue, check out their branch, read their last
  progress comment, and continue. Don't redo work that's already pushed. The original owner, when
  back, reads the chat and picks something else; no fighting over it.
- **Both down:** nothing runs, and that's fine: all state is in GitHub. Whichever agent comes
  back first runs the two commands above, takes the most important open item (review queue
  first, then its own lane, then stale items), and says so in chat.
- **Reviews:** if the reviewer stays unavailable for 45+ minutes and the change is urgent, the
  author may merge after all tests pass, and must say so on the PR. The absent reviewer reviews
  after the fact.
- A cloud session (added later) follows the same rules as a third worker. It never holds
  credentials.

## Hard rules (the hackathon's and ours)

- **No credentials anywhere in the repo**, including `bob_sessions/` exports. IBM deactivates
  accounts that leak Bob or Cloud credentials.
- **Every human** exports their own Bob IDE task sessions into `bob_sessions/<name>/`: the task's
  consumption-summary screenshot plus the exported `.md`, for every task.
- **Bobcoins: 40 per person, no top-ups.** Rules first, Bob for judgment. Always pass a budget
  (`--bob-budget`, `maxCost`).
- **Never present synthetic data as real.** `fixtures/runs/` are generated test runs for UI work.
  The hosted demo (`web/public`) exports real runs only (`npm run web:build`). acme-shop and
  notes-api-py are demo repos with seeded breaks, and are labelled that way.
- **Commits are authored by the human** whose agent made them, with no AI co-author trailer.
- **Nothing public** (repo visibility, deploys, posts, PRs to other people's repos) without the
  human saying so.

## Map

| Path | What |
|---|---|
| `src/` | engine: scout, plan, sandbox, doctor (rules + Bob), pipeline, scribe, drift, audit, MCP, remote check |
| `ui/` | live dashboard (`node bin/firstrun.js ui`) |
| `web/`, `api/`, `vercel.json` | hosted demo: landing page, `/api/check`, static replay of real runs |
| `lens/` | FirstRun Lens (Electron): Ctrl+Shift+Space, circle anything, proven fix or ask Bob |
| `.bob/` | Bob custom modes + MCP config |
| `audit/real-16/` | real 16-repo audit results |
| `test/` | `node --test test/*.test.js` (must pass before any PR) |

## Environment gotchas

- Windows host; Docker Desktop must be running for `verify`/`audit`.
- Bob Shell: `bob` (2.0.5). Sign in with the **hackathon IBMid**. Bob access only exists from kickoff.
- Windows Smart App Control blocks Bob IDE (unsigned `winregistry.node`); turn it off or use another PC.
