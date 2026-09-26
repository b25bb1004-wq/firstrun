# firstrun · task04 · ts-skip-lib-check rule (GeekyAnts)

- **Tool:** IBM Bob Shell 2.0.5, headless (agent mode, `--max-cost 1.5`) on Karmanya's PC
- **Task id:** `df5454c2cf3d5d1e99589bcc61506b49`
- **Cost:** 1.38 Bobcoins · 17 tool calls · 94 s
- **Found by IBM Bob first:** in FirstRun's GeekyAnts run, Bob (Doctor mode) diagnosed that the build fails on mongoose's .d.ts types because tsconfig.json has no skipLibCheck. This task turns that diagnosis into a free deterministic rule.
- **Review (Edith):** Bob's patch regex expected an unquoted `compilerOptions` key; on GeekyAnts' real tsconfig it added a *second* compilerOptions block (JSON keeps the last one, so skipLibCheck would be lost). Fixed the regex; added a regression test that parses the result.

## Prompt given to Bob
Task in this repo (FirstRun, Node.js ESM). Add ONE deterministic Doctor rule plus a patch op and tests. Match the surrounding style (short, dense, same comment density). Do NOT commit.

REAL FAILURE (GeekyAnts/express-typescript, `npm run build` = `tsc`, Node 22):
```
node_modules/mongoose/node_modules/mongodb/mongodb.d.ts(74,178): error TS2304: Cannot find name 'AsyncDisposable'.
node_modules/mongoose/node_modules/mongodb/mongodb.d.ts(122,5): error TS1165: A computed property name in an ambient context must refer to an expression whose type is a literal type or a 'unique symbol' type.
node_modules/mongoose/node_modules/mongodb/mongodb.d.ts(122,13): error TS2339: Property 'asyncDispose' does not exist on type 'SymbolConstructor'.
```
Every TypeScript error is inside a dependency's `.d.ts` under `node_modules/`; the project's own code compiles. The repo's tsconfig.json has no `skipLibCheck`. The standard fix is `"skipLibCheck": true` in `compilerOptions`.

1. src/patches.js, `applyPatchOps`: add op `tsconfig-skip-lib-check`. It sets `compilerOptions.skipLibCheck` to true in a tsconfig text that may contain // comments and trailing commas (so do NOT use JSON.parse on the whole file). Approach: if `"skipLibCheck"` already appears, set its value to `true`; otherwise insert `"skipLibCheck": true,` as the first property right after the `"compilerOptions": {` opening brace, keeping the file's indentation. Idempotent: applying twice gives the same text. If there is no `compilerOptions` object, add one right after the file's first `{`.

2. src/doctor/rules.js: new rule `ts-skip-lib-check`, placed with the other build/tooling rules (before `deps-not-installed` is fine). Fires only when ALL of:
   - the log has at least one line matching `^<path>\((\d+),(\d+)\): error TS\d+:`,
   - EVERY such error line's path starts with `node_modules/` and ends in `.d.ts`,
   - the repo has a `tsconfig.json` in `facts.files`.
   Result: `ruleId: 'ts-skip-lib-check'`, `class: 'missing-dependency'`, confidence 0.85, a cause that names the dependency file (e.g. "TypeScript type-checks node_modules/mongoose/node_modules/mongodb/mongodb.d.ts; the errors are all inside dependencies, not this project's code, and tsconfig.json has no skipLibCheck"), and fix: `{ actions: [], patches: [{ path: 'tsconfig.json', op: 'tsconfig-skip-lib-check' }], doc: { kind: 'note', text: '`tsconfig.json` now sets `skipLibCheck: true`: the build failed on type errors inside dependencies, not in this project.' } }`. It must NOT fire if any TS error is in the project's own files (then it's a real code error).

3. Tests (add to test/doctor.test.js in the style of the neighbouring tests, using `tmpRepo` and `ctxIn`):
   - the three real lines above + a tsconfig.json → rule fires, patch op present;
   - one of the lines replaced by `src/app.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.` → rule does NOT fire;
   - patch op: a tsconfig with a // comment and a trailing comma gets `"skipLibCheck": true`; applying twice changes nothing; an existing `"skipLibCheck": false` becomes true.

Run `node --test test/*.test.js`; ALL tests must pass (59 on main). Report what you changed.
