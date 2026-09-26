# IBM Bob task sessions (required for judging)

IBM's rule (Bob 2.0 hackathon guide): **every team member** uploads a screenshot of the **task
session consumption summary** (PNG) for **every** Bob IDE task related to the project, into this
folder, in the public repo. Exporting the task history as `.md` next to it is optional but welcome. Without them the judges can't
see that Bob is a core component, and Bob being core is the eligibility condition.

## Layout

```
bob_sessions/
  arnav/     <team>_task01_first_bob_diagnosis_summary.png   (+ optional .md with the same name)
  karmanya/  <team>_task01_guide_mode_walkthrough_summary.png
```

One folder per person. IBM's naming: `teamname_task01_short_description_summary.png` (use our
lablab team name for `<team>`). If you also export the `.md`, give it the same name. `node tools/check-bob-sessions.js` checks the pairs and scans for credentials before you commit.

## Steps (Bob IDE, from the Bob 2.0 hackathon guide)

1. Bob IDE chat → **Tasks**, to show the task list. Check you're in the right workspace (or pick **All**).
2. Select the task. It opens in the chat panel.
3. Click the **task header**. The **task session consumption summary** appears.
4. **Screenshot** it as **PNG**, named `<team>_taskNN_short_description_summary.png`.
5. Optional: export the task history as `.md` with the same name.
6. Repeat for every task. Then run the checker, commit, and push.

**Credentials:** IBM deactivates accounts if Bob or Cloud credentials appear in the repo. Check both
the `.md` and the screenshot before committing. The checker catches common key formats, but it
can't read screenshots.

## Sessions worth recording (real work, using FirstRun's Bob modes)

Open the `FirstRun` folder in Bob IDE, so it picks up `.bob/custom_modes.yaml` and the `firstrun`
MCP server (approve it when asked). Each task below is real work that moves the project forward:

| Who | Mode | Task |
|---|---|---|
| Arnav | 🚀 FirstRun | "Verify `.firstrun-work/repos/maitraysuthar__rest-api-nodejs-mongodb` and explain its remaining failure (npm test)." This is the first real Bob diagnosis. |
| Arnav | 🧭 FirstRun Guide | In `examples/acme-shop`: "I just cloned this. Help me get it running." |
| Karmanya | 🚀 FirstRun | "Look at audit/real-16-v2/audit.json. Which repos still need a human, and why? Propose a Doctor rule for the most common case." Then build it in Code mode, with a test. |
| Karmanya | 🩺 FirstRun Doctor | Diagnose the teamhide `make test` failure (read-only), and compare with the rules' verdict. |
| Everyone | Ask / Code | Any real change you make with Bob: reviews, fixes, docs. Export them all. |

Budget: 40 Bobcoins per person, no top-ups. The consumption summary shows the cost of each task,
and the judges see it too, so keep tasks focused.
