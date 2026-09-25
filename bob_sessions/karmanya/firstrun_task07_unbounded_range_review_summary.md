# firstrun · task07 · review fixes for unbounded-range-no-lockfile

- **Tool:** IBM Bob Shell 2.0.5, headless (`bob run`, agent mode, `--max-cost 1.5`) on Karmanya's PC
- **Task id:** `4858bb53eb73c5090eb280a5430d3a93`
- **Cost:** 0.77 Bobcoins · 10 tool calls · 127 s. (A first attempt was stopped by Edith before Bob edited anything: the prompt wrongly said User.ts imports mongoose directly; the corrected prompt below gives the real one-hop chain through providers/Database.ts.)
- **Review (Edith):** 69/69. Checked against the real GeekyAnts checkout with both log shapes (with and without node_modules errors): both give `npm install --no-save --legacy-peer-deps mongoose@^6.4.6`, the command verified in a container. Edith fixed one thing by hand: absolute paths in logs are the sandbox's (`/workspace/...`, `file:///workspace/...`) and are now mapped to the host checkout, with a test (70/70).

## Prompt given to Bob
Review fixes for the `unbounded-range-no-lockfile` rule you just added in src/doctor/rules.js (and its tests in test/unbounded-range.test.js). Change only that rule and that test file.

1. BUG, cause text: `major` is the FLOOR's major (6 for >=6.4.6), but the text says "a fresh install gets mongoose 6.x", which is the version it should NOT get. Say "gets a newer major of <pkg>" unless the installed version is known. Look for it in the log first (e.g. a `node_modules/<pkg>/package.json` "version" line is not in logs, so usually unknown); don't invent it. Add an assertion that the cause does not claim `6.x` for `>=6.4.6`.

2. BUG, bounded ranges counted as unbounded: `/^(>=|>)/` matches `>=1.0.0 <2.0.0` and `>=1 || >=2 <3`. Only a range that is JUST `>=X` or `>X` (optionally with whitespace, X like 6, 6.4, 6.4.6, with an optional prerelease) counts. Anything containing `<`, `||`, ` - `, or a second comparator is bounded. Add a test with `"mongoose": ">=6.4.6 <7"` → no fire.

3. TOO LOOSE, package detection: the bare-word match `\b<name>\b` fires on common words (packages named `ms`, `debug`, `yaml`, `pug`, `passport`, `chalk` appear in ordinary log text). Use only evidence that names the MODULE:
   a. a `node_modules/<pkg>/` path in the log (scoped `node_modules/@scope/pkg/` too), or
   b. a quoted module specifier in the log: `'<pkg>'` or `"<pkg>"` (e.g. `Cannot find module 'x'`, `Module '"mongoose"' has no exported member`), or
   c. NEW, import tracing: for each source file the log blames (`src/models/User.ts(64,11): error TS…`, also `at file:///app/src/x.js:3:1` / `/workspace/src/x.js:3` paths), read that file under the project dir and collect the package names it imports (`import … from 'pkg'`, `import 'pkg'`, `require('pkg')`; for `pkg/sub` take `pkg`, for `@scope/pkg/sub` take `@scope/pkg`). Unbounded deps imported by the blamed files are candidates.
   Pick the package when exactly one unbounded dep is supported by a, b or c. If several are, prefer (a)/(b) evidence over (c); if still more than one, return null.
   Remove the "only one unbounded dep in the whole manifest" fallback: a type error with no evidence linking it to that package is not enough.

   This matters for the real repo: GeekyAnts has THREE unbounded deps (mongoose >=6.4.6, passport >=0.6.0, pug >=3.0.1). Once the ts-skip-lib-check rule removes the node_modules errors, the remaining log is only
     src/models/User.ts(64,11): error TS2349: This expression is not callable.
       Type 'SaveOptions' has no call signatures.
   and the real src/models/User.ts does NOT import mongoose directly. Its imports are:
     import * as crypto from 'crypto';
     import * as bcrypt from 'bcrypt-nodejs';
     import { IUser } from '../interfaces/models/user';
     import mongoose from '../providers/Database';
   and src/providers/Database.ts has these imports and export:
     import mongoose from 'mongoose';
     import * as bluebird from 'bluebird';
     import { MongoError } from 'mongodb';
     import Locals from './Locals';
     export default mongoose;
   So (c) must follow RELATIVE imports of a blamed file ONE hop: resolve './x' / '../x' against the file's folder, trying x, x.ts, x.tsx, x.js, x.mjs, x.cjs, x/index.ts, x/index.js; collect that file's package imports too. Do not go deeper than one hop. Blamed file's own package imports + one-hop package imports are the candidate set.
   Tests mirroring this exactly: (i) 3 unbounded deps (mongoose, passport, pug) + bluebird/bcrypt-nodejs bounded (^), log above, User.ts and providers/Database.ts with the imports above → fires with mongoose. (ii) Blamed file imports both mongoose and passport directly (both unbounded), no (a)/(b) evidence → no fire. (iii) mongoose only reachable TWO hops away → no fire.

4. Keep the existing 6 tests passing (update test 4's expectation only if it relied on the removed fallback; it shouldn't).

Run `node --test test/*.test.js`; all must pass. Match the surrounding style; keep the rule compact (helper functions inside rules.js are fine).
