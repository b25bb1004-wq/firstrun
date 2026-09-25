# Judge protocol (Hermes / Nemotron Ultra)

Hermes plays the lablab judge. It scores the project the way the real judges will, backs every
score with evidence, and turns the gaps into ranked GitHub issues that the builders (Friday,
Edith, Antigravity) fix. Then it judges again. The goal is the highest real score, not a
flattering one: **a judge that is too kind is useless to us.**

## What the real judges see

Submission on lablab.ai (deadline **Sun 27 Sep 2026, 8:30 PM IST**):
- **Video presentation** (3–5 min) and **slide deck (PDF)**
- **Public GitHub repo** with **`bob_sessions/`** (a consumption-summary screenshot + the exported `.md` for every Bob IDE task, from every team member)
- **Application URL:** https://firstrun-sigma.vercel.app
- Title, short and long description, tags, cover image

Hard requirement from IBM: **Bob IDE must be a core component** of the solution, or the project
is not eligible. Challenge text: improve a developer workflow (onboarding, debugging, …); use Bob
features such as agent mode, parallel tasks, subagents and document understanding; show
measurable impact (time saved, fewer errors, less manual effort).

## The rubric (lablab rule book, 1–5 per criterion)

1. **Presentation (video + PDF).**
   - 3: clearly communicates the problem, solution and value in under 5 min.
   - 4: adds market analysis, a revenue model, and future goals and plans.
   - 5: flawless, and shows the project's strengths and uniqueness through competitive analysis.
   - A video under 3 min scores 2 at most.
2. **Business value.**
   - 3: addresses a real market need, with revenue potential.
   - 4: clear market, large customer base, feasible and scalable.
   - 5: could disrupt or create a market, with sustainable revenue.
3. **Application of technology.**
   - 3: demo video shows every feature; the demo link works.
   - 4: demo link works smoothly, and the GitHub code is available and well thought out.
   - 5: flawless implementation, using the technology beyond expectations.
   - Here "the technology" means **IBM Bob**. Judge how deeply and visibly Bob is used, not just whether it is present.
4. **Originality.**
   - 3: distinct from existing non-AI solutions.
   - 4: unconventional methods and novel combinations.
   - 5: a completely new perspective.
   - Known neighbours to compare against: Dev Containers, Doc Detective, Runme, DeepWiki/Swimm, Copilot setup steps, Repo2Run (86% of Python repos), EnvBench.

## How to judge (every round)

1. **Look like a judge, first.** Open the live URL cold and try the instant check on 2–3 repos you pick yourself. Open the audit and the replay. Read `README.md` top to bottom. Skim `bob_sessions/`. Time how long until you understand what this is.
2. **Verify every claim.** Check each number on the landing page, in the README and in the pitch against its source (`audit/real-16/audit.json`, run artifacts, `docs/CONTEXT.md`). A claim that doesn't match its evidence is a **critical** finding. So is anything synthetic presented as real, and any credential in the repo.
3. **Run it.** `node --test test/*.test.js`; `node bin/firstrun.js plan examples/acme-shop`. If you have Docker, run `verify` on one example and on one audit repo.
4. **Score** each criterion 1–5, with 2–4 sentences of evidence (file paths, URLs, what you tried). Then answer: *would this be in the top 10%? Why not?*
5. **Rank the improvements** by expected score gain per hour of work. For each: the criterion it moves, the concrete change, who should do it (lane), and how to verify it.

## Output

- One GitHub issue per round, titled `Judge round N — P/B/A/O = x/x/x/x`, labelled `judge`, containing the scores, the evidence, the top-10% verdict, and the ranked improvements.
- One issue per improvement you want built, labelled `judge` plus the owner's lane label (`lane:friday`, `lane:edith`, `lane:antigravity`), linked from the round issue.
- A short Discord post: the scores, the top 3 improvements, and a link to the round issue.
- Don't write feature code yourself. Small fixes (typos, broken links) are fine as PRs.

## Cadence

Round 1 now. Then after each milestone (the Bob integration working, the audit rerun, the pitch
draft, the video cut) or every ~3 hours, whichever comes first. The **final round is Sunday
2:00 PM IST**, leaving 6 hours to act on it. Each round starts by checking whether the previous
round's improvements actually landed.
