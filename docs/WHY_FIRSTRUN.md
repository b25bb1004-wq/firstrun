# HUMBLE: the problem, the solution, and why this solution

*Team brief for the IBM Bob 2.0 Hackathon (lablab.ai, 25–27 Sep 2026). Last updated 25 Sep 2026.*

---

## 1. The problem

**A README's setup instructions are the one part of a repo that nobody tests.**

Application code has unit tests, CI and linters, so it breaks loudly when something changes. The
"Getting started" section is written once and then quietly goes out of date:

- the Node or Python version moves on (the docs say 16, the project now needs 20),
- someone adds a required environment variable to `.env` but never to the docs,
- a script gets renamed (`npm run dev` becomes `npm run start:dev`),
- the app starts depending on Postgres, Redis or Mongo, and the README never says to start it,
- a migration or seed step becomes necessary but nobody writes it down.

Nothing catches any of this, because the maintainers already have a working machine. **The first
person to find out is a newcomer**: a new hire, an intern or an open-source contributor.

### What it costs

- The newcomer loses hours or days fighting a setup that "works on my machine".
- A senior engineer gets pulled away to help, often answering the same question for the fifth time.
- The fix ends up in a Slack thread instead of the README, so the next person hits the same wall.

### Numbers

| Fact | Source |
|---|---|
| Finding information is developers' **#1 friction point** | Atlassian DevEx 2025 (3,500 devs) |
| **72%** of engineering leaders say new hires need **more than a month** to ship their first 3 meaningful PRs | Cortex 2024 |
| **75%** of developers keep re-answering questions they've already answered | Stack Overflow 2024 |
| Only **24%** of ~864K public Jupyter notebooks ran without errors; top cause: missing dependencies | Pimentel et al. 2019 |

### Our own evidence

HUMBLE followed the READMEs of **16 real, popular public repos** (pinned to exact commits) on a
clean machine. **Only 2 of 16 worked as written.** The other 14 had 18 breaks between them, and two
runs couldn't finish at all. The audit is in `audit/real-16/`.

---

## 2. The solution: HUMBLE

**One line:** HUMBLE acts like a brand-new contributor. It follows your README literally on a
clean machine, fixes whatever breaks, proves each fix, and gives you back a README that is *proven*
to work.

### The pipeline (six agents)

```
clone → Scout → Planner → Runner ─✗→ Doctor → fix → Runner ─✓→ … → Verifier → Scribe
```

| Agent | What it does | Why it matters |
|---|---|---|
| **Scout** | Reads the docs *and* the ground truth: `package.json`, lockfiles, `.nvmrc`, compose files, `.env.example`, CI workflows, the source code that reads env vars | Catches "docs say X, code says Y" |
| **Planner** | Turns the README prose into ordered shell steps, the way a newcomer reads them. Flags docs-vs-code conflicts in **seconds, without Docker** | A fast check before any container starts |
| **Runner** | Runs each step in a **clean Docker container**. Keeps shell state between steps. Starts databases as sidecars on localhost. Health-checks dev servers | A real "fresh laptop", not a simulation |
| **Doctor** | When a step fails, it diagnoses the cause. **Deterministic rules first**; anything they don't recognise goes to **IBM Bob** | Cheap and reproducible on common breaks, smart on the rare ones |
| **Verifier** | Throws the machine away and **replays the whole repaired plan from zero** | A fix only counts if it works from scratch |
| **Scribe** | Writes the smallest README diff, patches `.env.example` and compose files, produces a Setup Passport badge, evidence report, devcontainer, CI drift guard and a Bob guide mode | Packages all of it as a PR the maintainer can merge |

### Evidence records: the core idea

Every fix comes with an evidence record:

1. **The failure:** the exact command and its real output.
2. **The diagnosis and fix:** who made it (a named rule, or "IBM Bob, N Bobcoins") and what changed.
3. **The pass:** the same step succeeding after the fix, then again in the from-zero replay.

A maintainer doesn't have to trust an AI's opinion. They review **proof**.

### Keeping the README correct afterwards

- **Drift guard:** a GitHub Action runs `firstrun guard` on every PR, so an added env var or a
  version bump without a docs update gets flagged before merge.
- **Guide mode:** a Bob mode (🧭 HUMBLE Guide) walks a newcomer through the *verified* steps on
  their own machine. It already knows the recorded failure signatures, e.g. "if you see
  `ECONNREFUSED :6379`, start Redis."

### Where IBM Bob fits (Bob IDE must be a core component, per the rules)

- **Reasoning engine:** Bob Shell runs headlessly in the 🩺 HUMBLE Doctor mode. It reads the repo
  and returns a structured JSON fix, which HUMBLE validates (destructive commands are refused)
  and then **proves in the sandbox**.
- **Its home:** custom Bob modes plus an MCP server, so you can plan, verify and inspect evidence
  from inside Bob IDE.
- **The newcomer's guide:** the Guide mode ships into every repo HUMBLE verifies.

---

## 3. Why this solution, and not something else

We chose this through a scored comparison (see `~\Downloads\context.md` and the three research PDFs).

### What we compared against

| Idea | Why not |
|---|---|
| AI code review | Crowded field, so it scored low on originality |
| Postmortem-to-guardrail | Already built on IBM Bob (Scar Tissue, TechXchange 2026 hackathon) |
| "Explain my codebase" onboarding bots | Crowded among Bob entries (Atlas, Reposense, context-onboarding-buddy, ai-repo-navigator) |
| HUMBLE as originally written | Too broad (platform matrix, architecture maps, day-1 guide), so we narrowed it on 25 Sep |

### What makes HUMBLE different from existing tools

| Tool | What it does | What HUMBLE adds |
|---|---|---|
| Dev Containers | Someone writes the config by hand | HUMBLE *derives* it from a run that passed |
| Doc Detective, Runme | Test README code blocks and *report* failures | HUMBLE *repairs* the README and proves the repair |
| DeepWiki, Swimm | Explain the code | HUMBLE proves the setup actually runs |
| Copilot setup steps, Repo2Run | Get the environment running *for the bot* (Repo2Run: 86% of Python repos) | **Our wedge is the human-facing README**: fix the docs a person reads, with evidence |

### Why the design choices hold up

- **Follow the docs literally.** That's how newcomers fail, so it's how you find the real bugs.
- **Rules before AI.** Most setup breaks come from about 10 recognisable classes. Rules are free,
  instant and reproducible, and each member has **only 40 Bobcoins, no top-ups**. Bob handles the
  long tail, where judgment is needed.
- **Nothing is fixed until it replays from zero.** This is what earns a maintainer's trust.
- **Smallest diff wins.** Maintainers merge small PRs and ignore rewrites.
- **Never invent secrets.** Real credentials become "needs a human", never fake values.

---

## 4. The weak spot

In the 16-repo audit (rules only, no Bob), **only 2 of 18 breaks were fixed and 12 were marked
"needs a human."** Some are out of scope (apps that only run inside their own Docker image, real
credentials). The rest are exactly what Bob is for. If Bob turns a few of them into VERIFIED, the
pitch becomes: *"Rules fixed the common breaks for free; IBM Bob fixed the hard ones for N Bobcoins."*

---

## 5. What the rules require (checked 25 Sep 2026)

- **Timing:** starts 25 Sep **8:30 PM IST** (15:00 UTC); deadline 27 Sep **8:30 PM IST**.
- **Bob IDE must be a core component.** No written rule bans pre-event code; we disclose it anyway.
- **`bob_sessions/`:** for every task, every member: a screenshot of the task consumption summary
  plus the exported `.md`. No credentials anywhere (IBM deactivates accounts).
- **Submission:** title, short and long description, tags, cover image, **video (3–5 min)** and a
  **slide PDF**, **public GitHub repo**, demo platform and a **working Application URL**.
- **Judged on:** Presentation · Business value · Application of technology · Originality.
  The video should cover the problem, solution, market, revenue model, competitors and future plans.

Sources: [event page](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon) ·
[rule book](https://lablab.ai/hackathon-rules) ·
[submission guidelines](https://lablab.ai/delivering-your-hackathon-solution) ·
[IBM participant guide (PDF)](https://watsonx-hackathons-2026.s3.us.cloud-object-storage.appdomain.cloud/Lablab-IBM-Bob-hackathon-guide-May-2026.pdf)
