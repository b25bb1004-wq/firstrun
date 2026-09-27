# RULE FACTORY EVALUATION REPORT

Generated: 2026-09-27

## Summary

| Metric | Value |
|--------|-------|
| Total recorded failures (3 audit corpuses) | 132 |
| Failures with at least one matching rule | 73 (55%) |
| Failures with NO matching rule (backlog) | 59 (45%) |
| Rule conflicts (different fixes) | 21 (16% of corpus) |
| True conflicts (contradictory fixes) | 0 |
| Total rules in registry | 53 |
| Rules with ≥1 real-log match | 22 (42%) |
| Known dead rules (scenario not in corpus) | 31 |

## Coverage Before vs After New Rules

| Corpus | Failures | Before (original 22 rules) | After (all 53 rules) | Gain |
|--------|----------|---------------------------|----------------------|------|
| v2-31-final-combined (31 repos) | ~60 | ~25 (42%) | ~38 (63%) | +13 |
| factory-1 (19 repos) | ~35 | ~10 (29%) | ~18 (51%) | +8 |
| v2-31-final-bob (11 repos) | ~37 | ~15 (41%) | ~17 (46%) | +2 |

*Before = rules existing before rule-factory slice (node-engine, missing-npm-script, missing-env-var, etc.)*
*After = all 53 rules including 31 new from factory (NODE slice + engine v2 + general research)*

## Rules That Fire on Recorded Corpus (22)

| Rule | Fires | Conflicts | Class |
|------|-------|-----------|-------|
| missing-tool | 39 | 14 | missing-tool |
| missing-env-var | 11 | 3 | missing-env |
| python-version | 4 | 2 | runtime-version |
| secret-required | 4 | 0 | needs-secret |
| docs-for-other-repo | 2 | 0 | docs-mismatch |
| poetry-no-root | 2 | 0 | missing-dependency |
| browser-system-libs | 2 | 0 | missing-tool |
| node-builtin-missing | 2 | 1 | runtime-version |
| npm-peer-conflict | 1 | 0 | missing-dependency |
| interactive-prompt | 1 | 0 | interactive |
| test-runner-undeclared | 1 | 0 | missing-dependency |
| env-invalid-value | 1 | 1 | missing-env |
| python-era-runtime | 1 | 0 | runtime-version |
| django-admin-renamed | 1 | 0 | missing-tool |
| python-dependency-drift | 1 | 0 | missing-dependency |
| pnpm-broken-lockfile | 1 | 0 | missing-dependency |
| wrong-package-manager | 1 | 0 | missing-dependency |
| wrong-package-manager-yarn | 1 | 0 | missing-dependency |
| unbounded-range-no-lockfile | 1 | 0 | missing-dependency |
| npm-engine-warn | 1 | 0 | runtime-version |
| shebang-interpreter-missing | 1 | 0 | runtime-version |
| wrong-directory | 1 | 0 | wrong-order |

## Dead Rules (31) — Scenario Not in Corpus

These rules exist but their failure patterns don't appear in the 132 recorded failures. They are **not** broken — they target scenarios we haven't hit yet.

| Rule | Target Scenario |
|------|-----------------|
| node-engine | README declares wrong Node version |
| node-native-build | Native addon fails to build (bcrypt, node-sass) |
| node-test-flag | `--test` flag on Node <18 |
| python-version | Python version mismatch from requires-python |
| missing-npm-script | Script name typo in package.json |
| missing-copy-source | `cp` source file missing |
| missing-requirements-file | `pip install -r` file missing |
| moved-entrypoint | Entry point moved (manage.py → flask/uvicorn) |
| env-empty-value | Template has blank values rejected by validator |
| env-placeholder-value | Template has placeholder (YourConnectionString) |
| mongo-legacy-driver | MongoDB 6+ legacy opcode error |
| missing-service | Connection refused to DB/Redis/Mongo |
| missing-migrations | "relation does not exist" / "no such table" |
| prisma-generate | "run prisma generate" |
| ts-skip-lib-check | TS errors only in node_modules/*.d.ts |
| deps-not-installed | Command not found before install step |
| unbounded-range-no-lockfile | Unbounded dep range + no lockfile |
| apt-package-missing | `apt install` package not found |
| python-venv-required | PEP 668 externally-managed-environment |
| apt-lists-missing | `apt install` before `apt-get update` |
| shebang-interpreter-missing | `./manage.py` bad interpreter |
| wrong-directory | File exists but in subdir |
| failing-tests | Test suite runs but some tests fail |
| needs-docker-daemon | Docker daemon not available in sandbox |
| venv-not-created | `poetry env info` before `poetry install` |
| wheel-python-mismatch | Locked wheel requires specific CPython |
| browser-not-downloaded | Playwright browser not downloaded |
| python-stdlib-removed | Python 3.12+ removed stdlib module (distutils) |
| node-openssl-legacy | Webpack 4 + OpenSSL 3 (Node 17+) |
| python-native-headers | Native Python pkg needs headers (pg_config, Python.h) |
| npm-ci-lock-mismatch | `npm ci` lockfile out of sync |
| yarn-frozen-lockfile | `yarn --frozen-lockfile` lockfile stale |
| pnpm-broken-lockfile | pnpm lockfileVersion 6 incompatible |
| pnpm-not-installed | pnpm-lock.yaml but no pnpm |
| yarn-not-installed | yarn.lock but no yarn |
| wrong-package-manager | pnpm on npm lockfile |
| wrong-package-manager-yarn | npm on yarn lockfile |
| npm-engine-warn | EBADENGINE warning (non-fatal) |

## Conflicts (21 detected, 0 true conflicts)

All detected conflicts are **complementary** — different rules addressing different aspects of the same failure. No two rules propose contradictory fixes.

| Repo | Step | Rules | Notes |
|------|------|-------|-------|
| Louis3797__express-ts-auth-service | S13 | missing-env-var + env-empty-value | Both fill env vars; env-empty-value also patches .env.example |
| axios__axios | S9 | node-builtin-missing + browser-not-downloaded | Node version + missing Playwright browsers |
| edwinhern__express-typescript | S1 | missing-tool + test-runner-undeclared | pnpm not installed + vitest not declared |
| przemek-nowicki__node-express-template.ts | S3 | env-invalid-value + test-runner-undeclared | NODE_ENV + jest not declared |
| shadcn-ui__taxonomy | S1 (×2) | missing-tool + pnpm-broken-lockfile | corepack enable + --no-frozen-lockfile |
| teamhide__fastapi-boilerplate | S2 (×2) | python-version + missing-tool (+ poetry-no-root) | Python version + poetry install |
| vargasjona__fastapi-alembic-sqlmodel-async | S8 (×8) | missing-tool + venv-not-created | poetry not installed + env not created |
| lincolnloop__django-layout | S5 (×2) | missing-tool + needs-docker-daemon | uv not installed + docker daemon |
| lincolnloop__django-layout | S7 | missing-tool + needs-docker-daemon | pre-commit + docker daemon |
| ndabAP__vue-sails-example | S4 (×2) | missing-env-var + npm-engine-warn | PYTHON env + Node engine warning |

## Backlog: Unmatched Failures (59 failures, grouped by error)

| Count | Error Pattern | Repos |
|-------|--------------|-------|
| 4 | `nodemon: not found` in `npm run dev` | GeekyAnts__express-typescript |
| 2 | `rest-hapi` test coverage command chain fails | JKHeadley__rest-hapi |
| 2 | `uv run bash scripts/test.sh` downloading deps | fastapi__fastapi |
| 2 | `bash: scripts/prestart.sh: No such file or directory` | fastapi__full-stack-fastapi-template |
| 1 | `bun run dev` - frontend only, backend not started | fastapi__full-stack-fastapi-template |
| 1 | `error: Script not found "build"` | fastapi__full-stack-fastapi-template |
| 2 | `yarn test` runs lint+unit+types | fastify__fastify |
| 1 | `make test` → pytest | httpie__cli |
| 1 | `npm warn old lockfile` on install | maitraysuthar__rest-api-nodejs-mongodb |
| 1 | `nodemon ./bin/www` in dev | maitraysuthar__rest-api-nodejs-mongodb |
| 1 | `nyc _mocha` test | maitraysuthar__rest-api-nodejs-mongodb |
| 2 | `npm start` → sass + node app.js | sahat__hackathon-starter |
| 2 | `npx playwright install chromium` downloading | sahat__hackathon-starter |
| 6 | `BASE_URL` port mismatch in playwright tests | sahat__hackathon-starter |
| 2 | `pnpm dev` → concurrently contentlayer + next | shadcn-ui__taxonomy |
| 1 | `alembic upgrade head` pymysql connection error | teamhide__fastapi-boilerplate |
| 1 | `make test` → pytest | teamhide__fastapi-boilerplate |
| 1 | `commander` node --test + check:type:ts | tj__commander.js |
| 2 | `poetry install` pyproject.toml not found (wrong dir) | vargasjona__fastapi-alembic-sqlmodel-async |
| 2 | `./manage.py: Permission denied` | wagtail__bakerydemo |
| 1 | `aws: command not found` | hardyscc__aws-nestjs-starter |
| 1 | `sls dynamodb install` | hardyscc__aws-nestjs-starter |
| 3 | `sls dynamodb start` | hardyscc__aws-nestjs-starter |
| 1 | `jest` with ts-jest warning | hardyscc__aws-nestjs-starter |
| 1 | `docker compose up` → Error 97 (no docker daemon) | lincolnloop__django-layout |
| 1 | `npm install` peer conflict ts-jest/@types/jest | marcomelilli__nestjs-email-authentication |
| 1 | `npm run start` → ts-node | marcomelilli__nestjs-email-authentication |
| 1 | `npm run start:prod` → dist/src/main not found | monstar-lab-oss__nestjs-starter-rest-api |
| 3 | `npm run test:e2e` → jest failures | monstar-lab-oss__nestjs-starter-rest-api |
| 1 | Node.js 10.x deprecated warning | ndabAP__vue-sails-example |
| 1 | `cp .env.variable.env variable.env` missing source | nerdeveloper__hackathon-starter-kit |
| 1 | `npm start` → build:dev chain | nerdeveloper__hackathon-starter-kit |
| 1 | `npm test` → jest OAuth2Strategy error | nerdeveloper__hackathon-starter-kit |
| 1 | `make start_dev_db` → docker run postgres | tko22__flask-boilerplate |
| 1 | `make setup` → docker run postgres | tko22__flask-boilerplate |
| 1 | `pip install` no matching distribution (wagtail) | wagtail__bakerydemo |
| 1 | `python app.py` import error (wtforms) | realpython__flask-boilerplate |

## Notable Patterns in Backlog

1. **Global tool assumptions** — `nodemon`, `aws`, `sls`, `make`, `docker` assumed installed
2. **Wrong working directory** — `prestart.sh` in `backend/`, `poetry install` in wrong dir
3. **Missing build step** — `npm run build` script doesn't exist
4. **Playwright browser download** — already downloading but then fails on system libs
5. **Permission denied** — `./manage.py` loses executable bit on clone
6. **Service not started** — Frontend dev server starts but backend not running
7. **PyPI wheel unavailable** — wagtail pins Django 6.0 requiring Python ≥3.12 but running on 3.11
8. **Test configuration issues** — Jest/TS config warnings, OAuth2 strategy errors

## Slice Owner Action Items

| Slice | Rules Needed | Priority |
|-------|--------------|----------|
| NODE | `missing-global-tool` (nodemon, aws, sls, docker, make) | High |
| NODE | `missing-build-script` (detect `npm run build` not in scripts) | Medium |
| PYTHON | `permission-denied-shebang` (chmod +x manage.py) | Medium |
| PYTHON | `pip-wheel-mismatch` (Python version from wheel tag) | Medium |
| DOCKER | `docker-daemon-missing` (already have `needs-docker-daemon`) | Low |
| TEST | `playwright-base-url-mismatch` (port config) | Low |
| TEST | `test-config-warning` (jest ts-jest, OAuth2 strategy) | Low |

## Next Steps

1. **Add `missing-global-tool` rule** — catches `nodemon`, `aws`, `sls`, `docker`, `make` not found when not declared in deps
2. **Fix priority for `missing-tool`** — currently fires on everything; should yield to more specific rules
3. **Add `permission-denied-shebang`** — `chmod +x` fix for `./manage.py`
4. **Document dead rules** — keep them; they'll fire on future repos
5. **Run eval on next corpus** — verify coverage improves