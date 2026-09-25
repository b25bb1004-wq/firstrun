# Team context (living document)

The one place to catch up: what exists, what we decided and why, who is doing what, and what's
open. **Both agents update it** after every merged PR, decision or new finding: add a dated line
to the log and fix any section that changed. Newest entries go first. Times are IST.

---

## Right now

| | |
|---|---|
| **Phase** | Backend hardening before Bob access opens (25 Sep, 8:30 PM IST) |
| **Deadline** | Sun 27 Sep 2026, **8:30 PM IST** (15:00 UTC) on lablab.ai |
| **Friday** (Arnav's Claude) | F-lane of #7: planner ✓ (PR #8), next: docker-compose shim, F2 rebase replay, F3 failed-fix handling |
| **Edith** (Karmanya's Claude) | #9 merged (PR #10). Next: env-placeholder rule, `poetry install` rule; review PR #11 |
| **Parked** | Pitch work #1–#4 and PR #5 (script draft), until backend is done (Arnav's call) |
| **Blocked on humans** | Vercel deploy (Arnav runs `vercel deploy --prod --yes`), product name, Bob sign-in at 8:30 PM |

## The product in one paragraph

**FirstRun** (working name; Arnav may rename it, probably to *Proofread*) follows a repo's setup
docs on a clean machine exactly like a newcomer, repairs every step that breaks with an evidence
record (failure → fix → pass), replays the repaired guide from zero, and hands the maintainer a
README proven to work. Rules handle common breaks for free; IBM Bob handles the rest. Extras:
drift guard in CI, a Bob Guide mode for newcomers, **Lens** (circle anything on screen → proven fix
or ask Bob), and a hosted instant check (paste a repo, see docs-vs-code conflicts in ~2 s). Full
story: `docs/WHY_FIRSTRUN.md`.

## Numbers we can quote (and their limits)

- **16 real repos audited** (pinned commits, rules only, 24 Sep): 2 VERIFIED, 1 PARTIAL, 11 FAILED,
  2 ERROR. So **12 of the 14 we could follow broke**. Evidence: `audit/real-16/`.
- In that audit **several failures were FirstRun's own planner mistakes** (see #7, section A). PR #8
  fixed them, so the numbers change on the next audit rerun. Don't quote a "fixed" count until
  then.
- Demo repos (seeded breaks, labelled as such): acme-shop, 5 breaks → VERIFIED in ~45 s (replay
  ~14 s); notes-api-py, 4 breaks → VERIFIED (run artifacts need regenerating).
- Research stats: Atlassian DevEx 2025 (#1 friction = finding info), Cortex 2024 (72%: new hires
  1+ month to 3 PRs), Stack Overflow 2024 (75% re-answer questions).

## Decisions (and why)

| When | Decision | Why |
|---|---|---|
| 24 Sep | Build FirstRun, narrowed to "fix the human-facing README with evidence" | Best score in our 6-layer comparison; Repo2Run/Runme/Doc Detective cover the neighbours, not this |
| 24 Sep | Rules first, Bob for the long tail | 40 Bobcoins/person, no top-ups; rules are free, instant, reproducible |
| 25 Sep | Never present synthetic data as real | Rules ban fraud; `fixtures/runs` are UI test data only |
| 25 Sep | Hosted demo = instant static check + replay of real runs | Full verify needs Docker; can't run untrusted code on a public host |
| 25 Sep | Claude is *not* part of the product | Bob IDE must be the core component; Claude is our build tool |
| 25 Sep | Team chat on Discord (#firstrun_1 on Helios), bots Friday + Edith | Telegram reported banned in India; lablab runs on Discord anyway |
| 25 Sep | Tasks in GitHub Issues, one branch per issue, cross-review every PR | Two agents, no direct link; GitHub is the shared state |
| 25 Sep | Agree in an issue before coding (#7) | Arnav: "reasoning will give better ideas"; it did (Edith found 3 engine bugs) |
| 25 Sep | Recovery mode (CLAUDE.md) | Either agent can hit a usage limit; all state must live in GitHub |
| 25 Sep | bcrypt < 6 → switch to Node 16 (bcrypt's own table); needs-human only if that fails | Edith's refinement; **proven with Docker** on maitraysuthar (npm install passes on node:16) |

## Log (newest first)

- **25 Sep, 15:40** · PR #10 (Edith's rules: E1 dep guard, E2 too-new/too-old wording, E5 Joi enum + Mailpit, E6 bcrypt→Node 16) reviewed and merged by Friday. 32/32 tests. **E6 proven with Docker**: maitraysuthar `npm install` now passes on node:16. Next gap there: `.env.example` has `MONGODB_URL=YourConnectionString` (placeholder); rule suggested to Edith. PR #11 (shims) awaits Edith's review.
- **25 Sep, 15:15** · PR #11 (sandbox shims: sudo, apt, docker(-compose) inside scripts) verified on real repos: zhanymkanov `just up` now starts Postgres as a sidecar; vargasjona `sudo apt-get` passes. New breaks surfaced: `poetry install` missing from zhanymkanov's README (rule, Edith); nested Python project in vargasjona (scout, Friday). Edith found the 24 Sep audit ran *before* rule commit 86cdc9e (nodemon, Louis3797 already fixed by current rules; see `tools/rediagnose.js`).
- **25 Sep, 14:30** · PR #8 (F1, planner) merged after Edith's review caught a real bug (`[ -f .env ]`
  dropped) and a design issue (usage-skipping too broad). 27/27 tests. Edith approved the sandbox
  shim for `docker-compose` (Friday), so E3 only handles the failing step's own command.
- **25 Sep, 14:15** · Recovery mode added (`tools/handoff.js`, CLAUDE.md). E4 (`poetry shell`)
  dropped: the planner already emulates it.
- **25 Sep, 14:00** · Triage agreed in #7. Edith's findings: the runtime rebase drops earlier tool
  installs (poetry), a fix that exits 1 still counts as applied (nodemon), and rules see only the
  last 200 log lines (bcrypt). Split by file: Friday = plan/pipeline/sandbox, Edith =
  rules/services.
- **25 Sep, 13:30** · Edith joined via Discord; opened pitch issues #1–#4, script PR #5 (parked),
  and #6 (a lens test fails on a fresh clone).
- **25 Sep, 12:30** · Hosted demo built and tested locally (landing, `/api/check`, replay of real
  runs). Deploy waits on Arnav. Lens built (Electron, OCR, known-fix match verified on screen).
- **25 Sep, 12:00** · Rules checked: no written ban on pre-event code (we disclose anyway).
  Submission needs a working **Application URL**, video 3–5 min, a slide PDF, a public repo, and
  `bob_sessions/` (screenshot + .md per task, every member).
- **25 Sep, 11:45** · Bob access confirmed to start at kickoff (8:30 PM IST). Bob IDE on Arnav's PC
  was blocked by Smart App Control; turned off.
- **24–25 Sep, overnight** · Engine, examples, 16-repo audit, dashboard, MCP server, Bob modes.

## Open questions

- Product name: FirstRun vs **Proofread** (`proofread.run`)? Domain?
- Who records the first real Bob diagnosis on camera (for the video)?
- Pricing / market-size numbers for the pitch (Edith's list at the bottom of PR #5).

## Where things are

`CLAUDE.md` rules · `docs/WHY_FIRSTRUN.md` pitch brief · `docs/MORNING.md` Bob steps ·
`docs/SETUP_WINDOWS.md` project setup on a new laptop · #7 engine triage · #9 Edith's rules work ·
`tools/chat.js` chat · `tools/handoff.js` who's doing what / what's stale.
