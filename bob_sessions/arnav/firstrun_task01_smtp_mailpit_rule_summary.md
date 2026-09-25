# Task #46 in this repo (FirstRun). Edit src/doctor/rules.js, rule 'env-placeholder-value' (around line 452), and add a test in test/doctor.test.js.

Problem: on a real repo, .env.example has EMAIL_SMTP_HOST=YourSMTPHost, EMAIL_SMTP_PORT=YourSMTPPort, EMAIL_SMTP_USERNAME=YourSMTPUsername, EMAIL_SMTP_PASSWORD=YourSMTPPassword. The rule only fixes the one variable the log mentions (EMAIL_SMTP_HOST), leaves the other mail variables as placeholders, and never starts a mail server, so helpers/mailer.js still fails.

Change: when any hit placeholder is a mail variable (name matches /^(\w+_)?(SMTP|MAIL|EMAIL)_/), also set every other mail variable in the env template that is a placeholder, using devValue() (host localhost, port 1025, user dev, password a generated dev- value, FROM dev@example.com; add *_SECURE -> false). Then add one service action for Mailpit, built from SERVICES.mailpit in src/doctor/services.js, in the same shape the missing-service rule uses: { type: 'service', name, image, env, port }. Mention the local mail catcher in the cause text. Do not change behaviour for non-mail placeholders.

Match the surrounding code style (short, dense, same comment density). Run: node --test test/*.test.js and make sure all tests pass. Do not commit.

---

**Status:** active  **Date:** 2026-09-25

---

### 👤 User

Task #46 in this repo (FirstRun). Edit src/doctor/rules.js, rule 'env-placeholder-value' (around line 452), and add a test in test/doctor.test.js.

Problem: on a real repo, .env.example has EMAIL_SMTP_HOST=YourSMTPHost, EMAIL_SMTP_PORT=YourSMTPPort, EMAIL_SMTP_USERNAME=YourSMTPUsername, EMAIL_SMTP_PASSWORD=YourSMTPPassword. The rule only fixes the one variable the log mentions (EMAIL_SMTP_HOST), leaves the other mail variables as placeholders, and never starts a mail server, so helpers/mailer.js still fails.

Change: when any hit placeholder is a mail variable (name matches /^(\w+_)?(SMTP|MAIL|EMAIL)_/), also set every other mail variable in the env template that is a placeholder, using devValue() (host localhost, port 1025, user dev, password a generated dev- value, FROM dev@example.com; add *_SECURE -> false). Then add one service action for Mailpit, built from SERVICES.mailpit in src/doctor/services.js, in the same shape the missing-service rule uses: { type: 'service', name, image, env, port }. Mention the local mail catcher in the cause text. Do not change behaviour for non-mail placeholders.

Match the surrounding code style (short, dense, same comment density). Run: node --test test/*.test.js and make sure all tests pass. Do not commit.

---

### 🤖 Assistant

> 🔧 called: read_file, read_file

Let me start by reading the relevant files to understand the codebase.

> 🔧 **read_file** — src/doctor/rules.js

> 🔧 **read_file** — src/doctor/services.js

### 🤖 Assistant

> 🔧 called: grep, read_file

Now let me read the `devValue` function and the surrounding area:

> 🔧 **read_file** — test/doctor.test.js

> 🔧 **grep** — devValue|PLACEHOLDER|MAIL_RE\|SMTP_RE

### 🤖 Assistant

> 🔧 called: read_file, read_file



> 🔧 **read_file** — test/doctor.test.js

> 🔧 **read_file** — src/doctor/rules.js

### 🤖 Assistant

> 🔧 called: read_file, read_file

Now let me look at the existing test at line 166-181 more carefully and understand the imports in `rules.js`:

> 🔧 **read_file** — src/doctor/rules.js

> 🔧 **read_file** — src/doctor/rules.js

### 🤖 Assistant

> 🔧 called: read_file

Now I have a clear picture. Let me also check how `SERVICE_CATALOG` is imported and how `serviceFor` is used in the missing-service rule to understand the exact shape needed:

> 🔧 **read_file** — src/doctor/rules.js

### 🤖 Assistant

> 🔧 called: update_todo_list

Now I have everything I need. Let me understand the task:

1. In `env-placeholder-value` rule (line ~452-483): when any hit placeholder is a mail variable (matches `/^(\w+_)?(SMTP|MAIL|EMAIL)_/`), also set every other mail variable in the env template that is a placeholder using `devValue()`, and add a Mailpit service action.

2. The `devValue` function already handles mail vars (host→localhost, port→1025, user→dev, password via secret pattern → `dev-<hex>`). I need to also handle `_SECURE` → `false` and `_FROM`/`_SENDER` → `dev@example.com` (already done in `devValue` for FROM).

Let me check what `devValue` returns for `_PASSWORD` and `_SECURE`:
- `EMAIL_SMTP_PASSWORD` would match `/(SECRET|KEY|TOKEN|SALT|PASSWORD|PASS|PEPPER|SIGNING)/` → `dev-<hex>` with kind `generated` ✓
- `EMAIL_SMTP_SECURE` would match `/(ENABLED|DEBUG|VERBOSE)$/`? No. It would fall through to `changeme` with `unknown` kind.

So I need to handle `_SECURE` in `devValue`, OR handle it specially in the mail expansion. The task says "add `*_SECURE -> false`", so I should add it.

Now let me also understand the `_SECURE` issue — it won't match any existing pattern in `devValue`. The simplest fix: add a case to `devValue` for `_SECURE` suffix, and add the mail expansion logic to `env-placeholder-value`.

Let me also look at how `SERVICES` from `services.js` is referenced in the task description. The task says "built from `SERVICES.mailpit` in `src/doctor/services.js`" — that refers to `SERVICE_CATALOG.mailpit`. The `serviceFor` function is already imported in `rules.js` line 6.

Now let me implement the changes:

> 🔧 **update_todo_list** — 
[-] Add SECURE→false to devValue, then expand mail vars + Mailpit service in env-placeholder-value rule
[ ] Add test in test/doctor.test.js
[ ] Run tests and verify all pass


### 🤖 Assistant

> 🔧 called: apply_diff



> 🔧 **apply_diff** — src/doctor/rules.js

### 🤖 Assistant

> 🔧 called: apply_diff

Now let me update the `env-placeholder-value` rule to add mail expansion and Mailpit service action:

> 🔧 **apply_diff** — src/doctor/rules.js

### 🤖 Assistant

> 🔧 called: read_file

Now let me add the test. First, let me read the end of the test file to find where to insert:

> 🔧 **read_file** — test/doctor.test.js

### 🤖 Assistant

> 🔧 called: read_file



> 🔧 **read_file** — test/doctor.test.js

### 🤖 Assistant

> 🔧 called: apply_diff

Now I have the full picture. Let me add the test right after line 181 (after the existing `placeholder values` test and before the `an exact Python pin` test). The new test needs to verify:

1. When `EMAIL_SMTP_HOST=YourSMTPHost` is the hit variable, the rule also sets `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USERNAME`, `EMAIL_SMTP_PASSWORD` from the template
2. A Mailpit service action is added
3. The cause mentions "mail catcher"

> 🔧 **apply_diff** — test/doctor.test.js

### 🤖 Assistant

> 🔧 called: update_todo_list



> 🔧 **update_todo_list** — 
[x] Add SECURE→false to devValue, then expand mail vars + Mailpit service in env-placeholder-value rule
[x] Add test in test/doctor.test.js
[-] Run tests and verify all pass


### 🤖 Assistant

> 🔧 called: execute_command



> 🔧 **execute_command** — node --test test/*.test.js 2>&1

### 🤖 Assistant

> 🔧 called: update_todo_list

All 45 tests pass including the new one.

> 🔧 **update_todo_list** — 
[x] Add SECURE→false to devValue, then expand mail vars + Mailpit service in env-placeholder-value rule
[x] Add test in test/doctor.test.js
[x] Run tests and verify all pass


### 🤖 Assistant

All 45 tests pass. Here's a summary of every change made:

---

**[`src/doctor/rules.js`](src/doctor/rules.js:116) — `devValue`**

Added one new case for `*_SECURE` mail variables (line 116):
```js
if (/^(\w+_)?(SMTP|MAIL|EMAIL)_SECURE$/.test(n)) return { value: 'false', kind: 'local' };
```

**[`src/doctor/rules.js`](src/doctor/rules.js:453) — `env-placeholder-value` rule**

Three additions inside the `test()` body:

1. **Mail expansion** — after the initial `sets` is built, detects if any hit key matches `/^(\w+_)?(SMTP|MAIL|EMAIL)_/`. If so, finds every *other* mail placeholder in the template not already in `sets` and calls `devValue()` on it, pushing the result onto `sets`.

2. **Mailpit service action** — builds a `{ type: 'service', … }` object from `serviceFor('mailpit', …)` (same shape the `missing-service` rule uses) and appends it to `actions`.

3. **Cause text** — the cause string now ends with `" and starts a local mail catcher (Mailpit)"` when `mailHit` is true. The leading "is/are a placeholder" part uses only the original `hit` variables (via `hitSets`), so non-hit mail vars that were expanded don't inflate the cause.

**Non-mail paths are unchanged** — the `if (mailHit)` block is never entered for URLs, DB connection strings, or other placeholder types.

---

**[`test/doctor.test.js`](test/doctor.test.js:183) — new test**

`'mail placeholder: fills all mail vars and adds Mailpit service action'` — builds a tmp repo with a `.env.example` containing all four mail placeholders plus one non-mail placeholder (`APP_NAME=MyApp`), triggers the DNS error path (`getaddrinfo ENOTFOUND YourSMTPHost`), then asserts:
- All four mail keys are patched with correct local values (`localhost`, `1025`, `dev`, `/^dev-/`)
- `APP_NAME` is **not** touched
- A `service` action with `image: axllent/mailpit` is present
- The cause contains `"mail catcher"`