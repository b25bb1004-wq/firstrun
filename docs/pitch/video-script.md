# Video script (target 4:00, hard limits 3:00–5:00)

*Draft for issue #1. `{{NAME}}` is the product name placeholder until Arnav decides (currently
FirstRun, maybe Proofread). Spoken lines are ~560 words, about 4 minutes at a calm pace.*

**Honesty rules for this video** (from `CLAUDE.md`):
- acme-shop is a **demo repo with seeded breaks**, so it gets an on-screen label every time it
  appears.
- `fixtures/runs/` is synthetic, so it never appears in the video. The fallback for a failed
  live take is a screen recording of a **real** `verify` run, not `fixtures/replay.js`.
- Every number on screen comes from `audit/real-16/audit.json`, `docs/WHY_FIRSTRUN.md` or a
  source listed at the bottom.

Judging criteria and where this script covers them: **Presentation** (the whole piece; 1 and 9
bookend it), **Business value** (1, 7, 8), **Application of technology** (3–6),
**Originality** (2, 8).

---

## 1 · The problem (0:00–0:30)

**Screen:** a clean-looking README "Getting started" section, then a terminal that fails at the
first step.

> Every repository has a "Getting started" section. It's the first thing a new hire or a new
> contributor reads, and it's the only code in the repo that nobody tests. Versions move on,
> environment variables get added, scripts get renamed, a database sneaks in, and nothing
> notices until a newcomer gets stuck on day one.

**On screen:** "Finding information: developers' #1 friction point (Atlassian DevEx 2025)" ·
"72% of engineering leaders: new hires need >1 month to ship 3 meaningful PRs (Cortex 2024)"

## 2 · Our evidence (0:30–0:50)

**Screen:** the audit swarm view in the dashboard (`ui --root audit`), 16 tiles.

> We checked this on 16 popular open-source repositories, each pinned to an exact commit, on a
> clean machine, following the README literally. Of the 14 we could follow to the end, 12 broke.

**On screen:** **"12 of 14 READMEs broke on a clean machine."** Smaller: "16 repos audited ·
2 worked as written · 2 couldn't be run to the end"

## 3 · The idea (0:50–1:10)

**Screen:** the pipeline diagram (Scout → Planner → Runner → Doctor → Verifier → Scribe).

> {{NAME}} acts like a brand-new contributor. It follows your README on a clean machine,
> repairs every step that breaks, proves each repair, and hands the maintainer a pull request
> with a README that is proven to work.

## 4 · Demo: seconds, no Docker (1:10–1:30)

**Screen:** `node bin/firstrun.js plan examples/acme-shop`. **Label: "Demo repo with seeded
breaks."**

> First, a static read. In a few seconds, with no Docker, it compares the docs with the code:
> the README says Node 16 but `.nvmrc` says 20, it copies a file that doesn't exist, it runs a
> script that was renamed, it never mentions a required secret, and it never starts Redis.

## 5 · Demo: the proof (1:30–2:30)

**Screen:** `verify examples/acme-shop` in the live dashboard. Step cards go red, then green.
Open one evidence record.

> Now the real test. Each README step runs in a clean container. `npm install` fails on
> Node 16; the Doctor recognises it, rebuilds the machine on Node 20, and the step passes.
> The missing file, the renamed script, the missing secret and the missing Redis are fixed the
> same way, one at a time.
>
> Every fix carries an evidence record: the failing command and its real output, the change,
> and the same step passing. Maintainers don't have to trust an AI's opinion. They review proof.
>
> Then the Verifier throws the machine away and replays the corrected guide from zero. Only now
> does the repo get its Setup Passport, and the README diff is just a handful of changed lines.

**On screen:** Setup Passport: VERIFIED · 5 breaks found · 5 fixed · 0 need a human.
*(Read the numbers off the actual recorded run.)*

## 6 · IBM Bob (2:30–3:10)

**Screen:** Bob IDE in 🚀 FirstRun mode calling the MCP tools; then an evidence card labelled
"diagnosed by IBM Bob"; then 🧭 FirstRun Guide answering a newcomer.

> Rules handle the common breaks for free. For a failure no rule knows, {{NAME}} asks IBM Bob.
> Bob Shell runs headlessly in our Doctor mode, reads the repository and returns a structured
> fix, and {{NAME}} proves that fix in the sandbox like any other. Every call has a Bobcoin
> budget and the cost is shown on the evidence card.
>
> Inside Bob IDE, our custom modes and MCP server let you verify a repo without leaving the
> editor. And the Guide mode ships into every verified repo, so Bob can walk the next newcomer
> through setup steps that are known to work.

**Blocked until recorded for real:** the Bob-diagnosed evidence card and its Bobcoin cost
(`audit.json` currently shows 0 Bob diagnoses). If no real Bob fix exists by recording time, cut
the middle sentence and show only the IDE modes and MCP.

## 7 · Market (3:10–3:30)

**Screen:** simple bottom-up funnel.

> Every team that onboards engineers, and every open-source project that wants contributors,
> has this problem. GitHub alone has more than 180 million developers and 630 million
> repositories. The buyer is the engineering team that pays for a newcomer's lost first weeks
> and a senior engineer's interrupted afternoons.

**On screen:** "180M+ developers · 630M repositories on GitHub (Octoverse 2025)"
*(We have no sourced market-size figure yet. See open question 3.)*

## 8 · Business model and competitors (3:30–3:50)

**Screen:** comparison table from `docs/WHY_FIRSTRUN.md` §3, then the pricing tiers.

> Others explain code, or test README snippets and report failures, or get an environment
> running for a bot. {{NAME}} is the only one that repairs the human-facing README and proves
> the repair. The CLI and the check for public repos are free. Teams pay per private repository
> for continuous drift guarding on every pull request, and enterprises pay for self-hosted
> runners and onboarding analytics.

**On screen:** Free (open source, public repos) · Team (per private repo / month) · Enterprise
(self-hosted, SSO) *(tier names and prices are a proposal; see open question 2)*

## 9 · Future and close (3:50–4:10)

> Next: macOS and Windows runners, a GitHub App that runs on every pull request, and a feedback
> loop where each fix Bob finds becomes a new free rule. {{NAME}} makes the README the most
> tested file in the repo: verified, repaired with evidence, and guarded on every pull request.

**On screen:** logo, `{{NAME}}: your README, proven`, repo URL and the Application URL.

---

## Open questions (for Karmanya and Arnav)

1. **Product name:** the script uses `{{NAME}}` throughout, so a rename is one find-and-replace.
2. **Pricing:** is the free / per-private-repo / enterprise split right, and do we show prices?
3. **Market size:** use only the GitHub numbers (sourced), or add a TAM figure? I'd only add one
   with a citable source.
4. **Bob segment:** who records the real Bob diagnosis, and on which repo?
   (`docs/MORNING.md` §2 suggests JKHeadley/rest-hapi with `--bob-budget 2`.)
5. **`docs/DEMO.md` fallback:** it suggests `fixtures/replay.js` if the live run fails, but those
   runs are synthetic. I suggest replacing it with a recording of a real run.
6. **Weak spot:** the audit's rules-only run fixed 2 of 18 real breaks. The script avoids that
   number. If Bob fixes some, section 6 can say "rules fixed X, Bob fixed Y".

## Sources

- Atlassian, State of Developer Experience 2025; Cortex 2024 (as cited in `docs/WHY_FIRSTRUN.md`)
- Audit: `audit/real-16/audit.json` → `summary`: 16 total, 2 verified, 12 broke on a clean
  machine, 2 errored
- [GitHub Octoverse 2025](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/):
  180M+ developers, 630M repositories
