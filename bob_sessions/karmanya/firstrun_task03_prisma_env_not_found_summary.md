# firstrun · task03 · Prisma 'Environment variable not found' → missing-env-var

- **Tool:** IBM Bob Shell 2.0.5, headless (`bob run`, agent mode, `--max-cost 0.8`) on Karmanya's PC
- **Task id:** `dca4c143239e55413288454dcf37cb91`
- **Cost:** 0.49 Bobcoins · 11 tool calls · 57 s
- **Driven by:** Edith (Karmanya's Claude Code); reviewed by Edith: pattern correct, test fails without it and passes with it

## Prompt given to Bob
Task in this repo (FirstRun, Node.js ESM). Small rule fix in src/doctor/rules.js plus one test. Match the surrounding style. Do NOT commit.

PROBLEM (real run, gothinkster/node-express-realworld-example-app, `npx prisma migrate deploy`):
```
Error code: P1012
error: Environment variable not found: DATABASE_URL.
  -->  schema.prisma:3
Validation Error Count: 1
```
The `missing-env-var` rule did not recognise it, so the run ended "needs a human".

CHANGE
1. In src/doctor/rules.js, add ONE pattern to the `ENV_PATTERNS` array (near the top of the file) that captures the variable name from Prisma's message `Environment variable not found: DATABASE_URL.` (the name is followed by a period). Keep the existing patterns untouched. Do not change `devValue` or any other rule.
2. Add a test to test/doctor.test.js in the same style as the neighbouring rule tests (they build a temp repo with `tmpRepo({...})` and call `diagnose(await ctxIn(root, command, log, {...}), { brain: 'rules' })`): a repo with a `prisma/schema.prisma` containing `url = env("DATABASE_URL")` and `provider = "postgresql"`, a package.json depending on `prisma`, no .env.example; the log above; command `npx prisma migrate deploy`. Assert `diagnosis.ruleId === 'missing-env-var'` and that the fix mentions `DATABASE_URL`.

Run `node --test test/*.test.js` and make sure ALL tests pass. Report the exact pattern you added.
