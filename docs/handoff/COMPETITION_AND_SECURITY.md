# IBM Bob 2.0 hackathon: the field, HUMBLE's edge, and the security agent

Edith, 27 Sep 2026 (07:30 IST). Source: all 171 submissions listed on the lablab.ai event page at that time,
read from their titles and descriptions; the closest competitor (Day-One Ready) was read in full. Deadline: **27 Sep,
20:30 IST** (event page), not 18:00.

## 1. The field at a glance (171 projects)

| Cluster | ~Count | Examples | What it means for us |
|---|---|---|---|
| **Codebase onboarding / repo understanding** | **~25** | RepoReady, REPOREVEAL, CodeQadam, Code/Pilot, OmniDev, IntelliOnboard, RepoPilot 2.0, Legacy Codebase Onboarding (RepoGuide), Bob X-Ray, JARVIS Dev, TraceOn, Smart Developer Onboarding Assistant, Lawang Onboard, CodeOns, DevOnboard, **Day-One Ready**, Repo Autopsy, TriRepo, First-PR Fast Lane, Prove Me Wrong, Memento, Whylode, Decision Memory | Our category is the most crowded. Almost all of them **read and summarise** (docs, architecture maps, guides, Q&A). |
| **Docs-vs-code drift** | ~6 | DriftLens, DriftGuard, Day-One Ready, Repo Autopsy, TriRepo | Static contradiction finders. Only Day-One Ready runs anything. |
| **"Proof / verified" AI changes** | ~25 | Proofline, HUNT, Relocate, CacheProof, Witnessed, TestGenAI, uncaught, SameBuild, PackProof, Cutover, MergeWitness, RedFirst, PRism, Plumbline | "Proof" is the buzzword of this round. Saying "proven" is not enough; we must **show** the replay. |
| **Security** | ~20 | Sentinel Sandbox, ContextSentry, ShadowAgent Guard, Inbin Gate, PatchSentinel, Bob Secure Review, Dependency Blackout, DevShield, Forge, Tinker, VulnTrace, SolGuardian | Useful for the security agent (section 4): the good ideas are pre-execution scanning, repo-content firewalls, and hallucinated-dependency checks. |
| **Screen-aware assistants** | 2 | **Melo AI** (sees your screen, guides step by step in real time), Usher | Only Melo overlaps with HUMBLE's guide, and it is generic (not repo-specific, no proof). |
| Review / release / debugging / other | rest | PR reviewers, release gates, incident-to-PR, domain apps | Not our lane. |

## 2. Our closest competitors, honestly

| Project | What it does | Where HUMBLE is ahead | Where they are ahead / risk |
|---|---|---|---|
| **Day-One Ready** | Runs the setup commands, self-corrects platform issues, scorecard of what wasn't verified | Isolated clean machine (not the dev's laptop), **replay from zero**, README fix + PR, a 31-repo audit, the on-screen guide | They also execute and are honest about limits; their demo found real security issues (hardcoded debug PIN). Judges will compare us directly. |
| **DevOnboard** | Scans the repo, **checks your environment**, personalised onboarding | We execute and prove; they (by description) generate guidance | "Personalised to your machine" is a pitch point we must also show (HUMBLE's machine snapshot). |
| **Repo Autopsy / TriRepo / DriftLens / DriftGuard** | Find README-vs-code contradictions statically | We **run** the docs and prove the contradiction with a failing log, then fix it | Their static checks are fast and broad; ours are slower. Our CI-as-reference findings cover the static side too. |
| **Melo AI** | Screen assistant, real-time step-by-step guidance | Every step HUMBLE teaches is **pre-solved and proven** for this exact repo; Melo improvises | Melo may already have a polished live demo of screen guidance. |
| **RepoReady / Proofline** (the two the boss shared) | RepoReady: deterministic readiness report + Bob via MCP. Proofline: risk-gated agent changes with adversarial re-testing and a hash-chained audit log | We run the real setup; RepoReady only reads. Proofline is a different lane (change safety), but its **tamper-evident audit log** is worth borrowing for HUMBLE's evidence. | Proofline's rigour and certificates set a high bar for "evidence". |

**HUMBLE's defensible edge (say this in the pitch, in this order):**
1. It **runs** your README on a **clean, isolated machine**, not your laptop.
2. It **repairs** what breaks and **proves** the repair by **throwing the machine away and replaying from zero**.
3. It then **teaches it back to a human on their own screen** (Guide) or does it for them (Autopilot), using only proven steps.
4. It works **at scale** (31 public repos, pinned commits, real numbers) and hands maintainers a README PR.
No other submission, from its description, combines execution + clean replay + repair PR + on-screen guided walkthrough.

**Risks to fix before judging:** the category is crowded, so a judge skimming 25 onboarding entries will lump us in unless
the video shows the **clean machine breaking, DR.BO fixing, and the replay passing** in the first 20 seconds, then
HUMBLE's robot pointing on screen. The 11 PARTIALs must be explained (see the audit PR) and IBM Bob must visibly do real
work (the capped Bob pass).

## 3. Onboarder design: what the field changes (adds to HUMBLE_ONBOARDER.md)

1. **Scorecard of what was NOT verified** (Day-One Ready's best idea): HUMBLE's report lists exactly which steps are
   proven, which were skipped and why, and which need a human, so the user never over-trusts it.
2. **Machine-fit, shown up front** (DevOnboard's pitch): the report states "you already have X, you're missing Y" from
   the read-only snapshot before the two choices.
3. **Tamper-evident session log** (from Proofline): every Autopilot action and every Guide step check is appended to a
   hash-chained log in `.firstrun/humble-session.json`; editing an entry breaks the chain. Cheap, and a strong
   evidence story.
4. **Security pre-flight before Phase 1** (section 4): HUMBLE scans the repo before running anything, even in the
   sandbox, and refuses or warns on malicious setup steps. Nobody else in the onboarding cluster does this.
5. **Teach the "why", not only the "what"** (Prove Me Wrong, Whylode): each Guide step's **Why?** shows the real failure
   log from the isolated run, so the user learns what breaks and why, not just what to type.
6. **Honest partial handling:** if Phase 1 ends with needs-human steps, HUMBLE shows them as a separate short list with
   the evidence, never hidden inside the guide.

## 4. The security agent (Vigil working name; joins the six as HUMBLE's guard)

**Why it belongs:** HUMBLE runs strangers' setup commands. That is exactly how supply-chain attacks land
(post-install scripts, curl-to-shell installers, typosquatted packages, poisoned `.env` examples). A tool that runs
READMEs must protect the person running it.

**What it does, in order:**
1. **Pre-flight scan (before Phase 1, before any command runs):**
   - Setup commands: flags `curl … | sh` from unknown hosts, `sudo` outside the sandbox, disabling TLS checks, writes
     outside the repo, obfuscated/base64-decoded payloads, reverse-shell and crypto-miner patterns.
   - Dependencies: typosquats and **hallucinated packages** (names that don't exist on the registry, the ShadowAgent
     Guard idea), known-malicious and yanked versions, install scripts (`preinstall/postinstall`) that fetch or exec,
     lockfile/manifest mismatches.
   - Repo content: secrets committed in the repo, prompt-injection text in docs aimed at AI agents (the ContextSentry
     idea), binaries and archives with no source.
   - Verdict: **clear / caution (explain and ask) / block** (never runs, with the evidence).
2. **Sandbox hardening while Phase 1 runs:** no host mounts beyond the repo copy, network egress only to package
   registries plus what the plan declares, resource and time limits (already partly there), no Docker socket, and the
   container is discarded after the replay.
3. **Protect the user during Autopilot/Guide:** a step flagged in pre-flight is never auto-run on the user's machine;
   secrets are never typed, logged or sent to a model; every action goes in the tamper-evident log.
4. **Report:** a short security section in the passport and README PR ("no install scripts fetch remote code", or the
   exact risky line), so maintainers can fix it too.

**MVP for today:** rules-based pre-flight on the plan's commands and the manifests (curl-to-shell, sudo, TLS-off,
install scripts, secrets committed, packages missing from the registry via one lookup per dependency), shown in the
console before Phase 1, and a "security" section in the passport. The deeper items (egress allowlist, malware
signatures, prompt-injection scanning) are later.

## 5. Next actions (in priority order, for today's 20:30 IST deadline)
1. Video leads with the replay moment, then HUMBLE's guide (Karmanya narrates).
2. Capped Bob pass (≤5 Bobcoins) on the INCONCLUSIVE/FAILED repos: visible IBM Bob work.
3. Relabel honest partials (setup proven, a few upstream tests fail) and fix the serve-detection bug.
4. HUMBLE MVP (console + robot + guide on GeekyAnts) and the security pre-flight MVP.
5. Landing: switch numbers to the final audit; merge landing + numbers in one deploy.

## 6. What they actually built (repo inspection of all 171, 27 Sep 08:00 IST)
Method: every submission page's declared repo was inspected through the GitHub API (file tree, commits, languages).
This measures **build substance**, not quality, UX or pitch; videos were not watched. (Demo/video/slide flags from the
page template were unreliable and are ignored.)

| Metric (170 public repos) | Median | 75th pct | 90th pct | Max | **HUMBLE** |
|---|---|---|---|---|---|
| Code files | 17 | 37 | 74 | 1618 | **146** |
| Test files | 2 | 7 | 19 | 352 | **390** |
| Commits | 8 | 16 | 35 | 374 | **193** |

Only 103/170 have any tests, 24 Docker, 30 CI, 47 Bob custom modes, 95 bob_sessions, 21 MCP. HUMBLE has all six.
On a simple substance score (code, tests, commits, Docker, CI, Bob modes/sessions) HUMBLE scores ~44; the top
competitor scores 38 (PHANTOM GRID: 443 code files, 374 commits), then Adhera, ForgeFlow, TestGenAI, Cutover,
Nightshift, CodeGuardian, ShipSafe, Proofline (#9). No onboarding competitor is in the top 10 except RepoDoc/Lawang
Onboard around 11-14.

**BLOCKER:** our repo (b25bb1004-wq/firstrun) is **private**; lablab requires a public repo. It also still has a
token-shaped string in history (commit 21daab3, flagged by tools/check-secrets.sh) that must be purged before it goes
public (issue #75).
