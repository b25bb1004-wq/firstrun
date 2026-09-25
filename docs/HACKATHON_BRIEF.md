# IBM Bob 2.0 Hackathon: everything the organisers ask for

Compiled 25 Sep 2026 (evening, IST) from the official sources listed at the bottom: the event
page, the **IBM Bob 2.0 hackathon guide** (released at kickoff; it replaces the May guide), the IBM
repo template, and lablab's rules, submission guidelines and "How to win" guide. **Where the event
page and lablab's generic guidance disagree, the event page wins.** Every agent: read this before
working on anything that ends up in the submission.

---

## ⚠️ What changed from our earlier assumptions

| Topic | We assumed | Official (event page / Bob 2.0 guide) | Action |
|---|---|---|---|
| **Video length** | 3–5 min | **3 minutes maximum.** "Judges will not watch more than 3 minutes." At least **90 seconds** of the solution working on screen | Script for ≤ 3:00; update the pitch plan (#1, PR #5) |
| **Written statements** | Long description only | **Two statements, ≤ 500 words each:** Problem & Solution (Long Description), plus an **IBM Bob Usage Statement** | New task: draft both (#4) |
| **Bob evidence** | `.md` export + screenshot per task | **Task session summary screenshots (PNG)** from **each team member**, in `bob_sessions/`. Menu path: Bob IDE chat → **Tasks** → select the task → click the task header → screenshot | Updated `bob_sessions/README.md`; `.md` exports optional |
| **Screenshot names** | `NN-slug.png` | `teamname_task01_short_description_summary.png` | Pick one team name and use it everywhere |
| **License** | Apache-2.0 | Prize terms: "Submissions must be **original and MIT-compliant**" | Arnav/Karmanya decide: relicense to MIT (simplest) |
| **Bob account** | "hackathon IBMid" | Invite email says "added to **ibm-hackathon-xxxx**", Enterprise plan (check spam). In Bob IDE select instance **`ibm-coding-challenge-uat` (us-east)** | Both humans: find the invite, sign in, check the instance |
| **Credential safety** | `.gitignore` | IBM template adds **`.bobignore`** (stops Bob reading `.env` and credentials) and a stricter `.gitignore` | Added `.bobignore` |
| **Data** | n/a | Keep a **list of every public website whose data you used**; no PI, no social media, no confidential or client data | Add `docs/DATA_SOURCES.md` (16 audited repos + licenses) |

---

## The challenge (verbatim essentials)

"Create a solution that improves a specific developer workflow, such as **onboarding**, debugging,
code review, testing, application maintenance, or release and deployment processes. Start by
clearly defining a problem where time, effort, or errors are too high today. Then, using IBM Bob
2.0, build a working prototype on a real or sample project that demonstrates a full solution…
Leverage features like **Agent mode, parallel tasks, subagents, and document understanding** to
manage and improve multiple steps, not just assist with coding. Clearly **demonstrate impact**:
productivity up; manual effort, errors or rework down; time to complete tasks cut."

- **Bob IDE is required** and must be a **core component** to be eligible for judging. Bob Shell is optional.
- Optional: IBM watsonx.ai, watsonx Orchestrate (mention them in the Bob Usage Statement if used).
- Onboarding is literally the first example use case in the guide ("Smart developer onboarding
  assistant"), which is our category. Originality has to come from *how*: evidence, replay from
  zero, proven fixes.

## Judging criteria (event page wording)

1. **Application of Technology**: "How complete and well thought-out the project is, with a clear application of IBM Bob 2.0."
2. **Presentation**: "The clarity and effectiveness of the project presentation."
3. **Business Value**: "The impact and practical value, considering how effectively the solution addresses a high priority issue."
4. **Originality**: "The uniqueness and creativity of the solution and the approach in applying IBM Bob 2.0."

The lablab rule book scores each 1–5 (details in `docs/JUDGING.md`). Presentation 4+ needs market
analysis, a revenue model and future plans; 5 adds competitive analysis.

## Submission form: every field

Submit on lablab.ai **before Sun 27 Sep 2026, 11:00 AM ET = 8:30 PM IST** (the late window is only
for approved technical issues).

| Section | Field | Requirement | Owner | Status |
|---|---|---|---|---|
| Basic | Project Title | Clear, descriptive | Arnav (name decision) | ⏳ FirstRun vs Proofread |
| | Short Description | ≤ 255 characters | Edith draft | ⏳ |
| | Long Description | **Problem & Solution, ≤ 500 words**: problem, what it is, target users, how they use it, why creative and unique | Edith draft, humans approve | ⏳ |
| | **IBM Bob Usage Statement** | **≤ 500 words**: how and where Bob was used, specifically, throughout development (+ watsonx if used) | Friday draft (knows the Bob integration), humans approve | ⏳ |
| | Technology & Category Tags | Pick relevant tags | anyone | ⏳ |
| Code | **Public** code repository | Public link; includes code/files Bob helped with | Arnav flips visibility at the end | ⏳ private now |
| | Bob task session summary screenshots | **From each team member**, in `bob_sessions/` | Arnav + Karmanya | ⏳ Bob not signed in yet |
| | Demo Application Platform | Streamlit / Replit / **Vercel** | done | ✅ Vercel |
| | Application URL | Link to interact with the prototype | done | ✅ https://firstrun-sigma.vercel.app |
| Media | Cover Image | PNG or JPG, **16:9** recommended | Hades | ⏳ needs name |
| | **Video** | **MP4, ≤ 3:00**, ≥ 90 s of the solution in action, **narrated**, clearly shows **how Bob is used**; creativity encouraged | humans record; Edith script | ⏳ |
| | Slide Presentation | PDF; lablab: 8–10 slides, 2–3 sentences each: problem, solution, demo screenshot, market (**TAM/SAM**), revenue, competitors/USP, team, next steps | DaVinci (out of credits) → Hades/Edith | ⏳ |

## Bob evidence: exact steps (Bob 2.0 guide)

1. `bob_sessions/` must exist in the repo (it does).
2. Bob IDE chat → **Tasks** → pick a task for this project. If your tasks span workspaces, pick **All**.
3. Click the **task header**; the **task session consumption summary** appears.
4. Screenshot it as **PNG**, named `teamname_task01_short_description_summary.png`.
5. Repeat for **every** task related to the project; put all of them in `bob_sessions/<name>/`.
6. Run `node tools/check-bob-sessions.js`, then commit.

Tips: 40 Bobcoins per person, no top-ups. When they run out you can keep building, but no more
Bob. Plan tasks across both members. Bob 2.0 features worth showing (the judges read the challenge
text): **Agent mode, subagents, parallel tasks, document understanding**, plus custom modes, skills,
MCP, and the Review and PR workflows. FirstRun already ships custom modes and an MCP server for Bob.

## Rules that can disqualify or cost points

- **No IBM Cloud / Bob credentials anywhere** in the repo. IBM monitoring suspends accounts
  immediately. Check `git diff` before every commit; `.env` stays ignored; `.bobignore` is in place.
- **Original and MIT-compliant** submissions; no plagiarism. Unethical behaviour (gaming votes,
  unauthorised automation, fraud) means disqualification.
- **Data:** only data whose terms allow it; keep a list of sources; no personal, client,
  confidential or social-media data.
- A **private repo** at judging time lowers the score. Make it public before submitting.
- **Deadline is hard:** 8:30 PM IST Sunday.

## lablab's "How to win" tips that apply to us

- The demo must be understandable in **30 seconds**; judges reward clarity over polish.
- Business value = a **specific target user**, a rough **TAM**, **one revenue model**, and "why
  this couldn't be built without AI".
- Application of technology = a **deployed demo URL**, a real repo with **commits spread across
  the event**, and AI doing something genuinely novel (not a chatbot wrapper).
- Build the **golden path** the judges will follow, and fix every bug on it first.
- **Record the video early** (time to re-record), and **submit with time to spare**. The last hours
  are for judge questions, not features.

## Sources

- Event page: https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon
- IBM Bob 2.0 hackathon guide: https://lablab-ibm-bob-2-hackathon-guide.s3.us.cloud-object-storage.appdomain.cloud/index.html
- IBM repo template: https://github.com/watsonxhackathon/ibm-hackathon-template
- lablab rule book: https://lablab.ai/hackathon-rules
- lablab submission guidelines: https://lablab.ai/delivering-your-hackathon-solution
- How to win an AI hackathon: https://lablab.ai/guide/how-to-win-an-ai-hackathon
- Prize and participation terms: https://lablab.ai/terms-of-use#16-participation-terms
