# firstrun · task06 · unbounded-range-no-lockfile rule (from Bob's GeekyAnts diagnosis)

- **Tool:** IBM Bob Shell 2.0.5, headless (`bob run`, agent mode, `--max-cost 1.5`) on Karmanya's PC
- **Task id:** `d4f13c4e3651407626f98871ed079b9f`
- **Cost:** 1.41 Bobcoins · 18 tool calls · 114 s
- **Driven by:** Edith (Karmanya's Claude Code). Origin: Bob's own GeekyAnts diagnosis (tsconfig lib vs AsyncDisposable in mongodb.d.ts), traced one layer up by Edith in a clean node:22 container: `mongoose ">=6.4.6"` + no lockfile → 9.10.2 → 19 TS errors; `mongoose@^6.4.6` → build exits 0.
- **Review (Edith):** 6/6 tests passed, but 4 issues sent back to Bob as task07: cause text named the floor major as the installed one; `>=1 <2` counted as unbounded; bare-word package matching; and the rule would not fire on the real repo once #70 removes the node_modules errors (3 unbounded deps, log names none).

## Prompt given to Bob
Add ONE new Doctor rule to src/doctor/rules.js, with its own test file. Do not change any other rule.

## Background (a real finding: GeekyAnts/express-typescript, your own earlier diagnosis)
package.json has `"mongoose": ">=6.4.6"` and the repo has NO lockfile. A fresh `npm install` today gets mongoose 9.10.2, and `npm run build` (tsc) fails with 19 errors, e.g.
  src/models/User.ts(64,11): error TS2349: This expression is not callable.
  node_modules/mongoose/node_modules/mongodb/mongodb.d.ts(74,..): error TS2304: Cannot find name 'AsyncDisposable'.
Installing `mongoose@^6.4.6` (gets 6.13.11) makes the build exit 0. Verified in a clean node:22 container.
So the README was right when written; an open-ended version range let it rot.

## The rule: id `unbounded-range-no-lockfile`
Place it with the other Node rules, before generic fallbacks. It fires only when ALL hold:
1. The failing step's log shows a build/type/import failure (e.g. `error TS\d+`, `SyntaxError`, `is not a function`, `Cannot find module`, `ERR_REQUIRE_ESM`).
2. The repo has no lockfile: none of package-lock.json, npm-shrinkwrap.json, yarn.lock, pnpm-lock.yaml, bun.lockb, bun.lock in the project dir. Use whatever facts the scout already provides; if none exists, read the dir with fs (see how other rules get the repo root / facts.projectDir).
3. package.json `dependencies` or `devDependencies` has at least one UNBOUNDED range: `>=X`, `>X`, `*`, `latest`, `x`, or empty string. Ranges with an upper bound (`^`, `~`, `>=1 <2`, exact) are NOT unbounded.
4. Pick the package to pin: prefer an unbounded package whose name appears in the log (e.g. `node_modules/mongoose/`, or in a `node_modules/<pkg>/...` path, including scoped `@scope/pkg`). If several unbounded packages exist and none is named in the log, pick none and return null (don't guess).

Fix:
- Pin to the range's own floor major: `>=6.4.6` → `^6.4.6`. For `*`/`latest`/`x`/empty there is no floor → return null.
- actions: `[{ type: 'insert-before', command: 'npm install --no-save <pkg>@^<floor>' }]` inserted before the failing step. If the plan's install step uses `--legacy-peer-deps`, add that flag too. Use yarn/pnpm equivalents if the plan's install step uses them (`yarn add <pkg>@^X`, `pnpm add <pkg>@^X`).
- doc: `{ kind: 'insert-step', text: <same command> }`
- cause: `"<pkg>" is declared as "<range>" with no lockfile, so a fresh install gets <pkg> <major>.x, newer than the code was written for; pinning to ^<floor> restores the version the setup docs assumed.` (say "a newer major" if the installed version isn't known from the log)
- class: reuse an existing class if one fits (look at the classes other rules use, e.g. 'runtime-version' or 'missing-dependency'); do not invent a new UI class.
- confidence 0.7.
- If the codebase has a way to carry a maintainer suggestion (search for `suggestion`), add: "Pin `<pkg>` in package.json to `^<floor>` and commit a lockfile." Otherwise leave it out.

## Tests: new file test/unbounded-range.test.js (node:test, same style as test/doctor.test.js)
1. GeekyAnts shape (tmp dir with package.json `"mongoose": ">=6.4.6"`, no lockfile, log with the TS2349 + node_modules/mongoose line) → rule fires, command is `npm install --no-save mongoose@^6.4.6`.
2. Same but with package-lock.json present → no fire.
3. `"mongoose": "^6.4.6"` (bounded) → no fire.
4. Two unbounded packages, neither in the log → no fire.
5. `"mongoose": "*"` → no fire (no floor).
6. Plan install step `npm install --legacy-peer-deps` → command includes `--legacy-peer-deps`.

Run `node --test test/*.test.js`; all must pass. Keep the change small and match the surrounding code style (comment density, naming). Do not edit README or other docs.
