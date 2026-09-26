# firstrun · task05 · Bob Doctor: no source edits + JSON retry

- **Tool:** IBM Bob Shell 2.0.5, headless (agent mode, `--max-cost 1.5`) on Karmanya's PC
- **Task id:** `65152cdedd496704ded98abde4409306`
- **Cost:** 1.15 Bobcoins · 17 tool calls · 2 min 6 s
- **Why:** in FirstRun's GeekyAnts run, Bob (Doctor mode) rewrote application source (src/providers/Locals.ts) and a later Bob reply had no JSON, ending the run.
- **Review (Edith):** when Bob's only fix was a source edit, the suggestion was dropped on its way out of diagnose() and never reached the evidence; carried it into the diagnosis and rendered it in FIRSTRUN.md ('Suggested code change for the maintainer (not applied)'), with a test.

## Prompt given to Bob
Task in this repo (FirstRun, Node.js ESM). Two small robustness changes to how FirstRun uses IBM Bob as its fallback Doctor. Match the surrounding style (short, dense, same comment density). Do NOT commit.

CONTEXT (real run, GeekyAnts/express-typescript): FirstRun asked Bob (mode `firstrun-doctor`) to diagnose a silent failure. Bob diagnosed it well, but (1) for one break it returned a `write` action that rewrote APPLICATION SOURCE (`src/providers/Locals.ts`) to add a default, and FirstRun applied it; FirstRun's promise is to fix the setup (README, env templates, compose, version files), never the maintainer's code. (2) Another Bob reply had no parsable JSON, and the run stopped: "IBM Bob replied without the expected JSON".

1. src/doctor/index.js, `validateBobFix(j)`:
   - Add a helper `isSetupFile(p)`: true for README*/docs (*.md, *.rst under any dir), `.env.example` / `.env.sample` / `*.env.example`, `docker-compose*.yml|yaml`, `compose.yml|yaml`, `.nvmrc`, `.node-version`, `.python-version`, `.tool-versions`, `tsconfig.json`, `package.json`. Anything else (e.g. `src/**`, `app/**`, `*.ts`, `*.py`, `*.js` outside those) is application source.
   - `write` actions and `patches` whose path is application source are NOT applied: drop them, and collect `{ path, why }` into `fix.suggestions` (why = diagnosis.cause). If that leaves no actions and no patches, return `{ ok: true, diagnosis, fix: null, suggestions }` so the step ends "needs a human" with the suggestion visible. Otherwise keep the fix and attach `suggestions` to it. Everything else in validateBobFix stays as it is.
2. src/doctor/index.js, `diagnose`: if the Bob call fails ONLY because the reply had no parsable JSON (`!res.ok` and the error mentions the expected JSON), retry ONCE with the same request plus a final line: `Your previous reply was not valid JSON. Reply with exactly one JSON object in a \`\`\`json block and nothing else.` Only if the Bobcoin budget still has room (`bobBudget.remaining() > 0` when a budget is given). Count the retry's Bobcoins with `bobBudget.spend(...)` and `onBob(...)` like the first call. Report the combined cost in `diagnosis.bobcoins`.
3. src/brain/modes.js, the `firstrun-doctor` mode's instructions (the list containing "Ground every claim in a file you read…"): add one line: `Fix the setup, not the application: change only the README/docs, env templates (.env.example), compose files, runtime version files, tsconfig.json or package.json. Never rewrite application source; if the only fix is in the code, explain it in "cause" and give no action.`
4. Tests in test/doctor.test.js, style of the existing `validateBobFix` test ('Bob replies are parsed and validated defensively'):
   - a Bob reply with one `exec` action plus a `write` to `src/providers/Locals.ts` → the exec is kept, the write is dropped, `fix.suggestions[0].path === 'src/providers/Locals.ts'`;
   - a reply whose only action is a `write` to `src/app.ts` → `fix === null`, `suggestions.length === 1`;
   - a `write` to `.env.example` and a patch to `docker-compose.yml` → both kept.
   (The retry path can stay untested if the fake Bob in test/fixtures makes it awkward; say so.)

Run `node --test test/*.test.js`; ALL tests must pass. Report what you changed.
