# Bob pass dry run (0 Bobcoins spent)

Source: v2-31-final · selected 10 of 17 PARTIAL/INCONCLUSIVE/FAILED repos · doctor questions: 13 · plan-time calls: 7
Not selected (no open question for Bob; their gaps are upstream tests, timeouts or rules): teamhide__fastapi-boilerplate, maitraysuthar__rest-api-nodejs-mongodb, edwinhern__express-typescript, NayamAmarshe__please, httpie__cli, axios__axios, tj__commander.js
Plan-time Bob calls: zhanymkanov__fastapi_production_template: plan review (<= 0.2); vargasjona__fastapi-alembic-sqlmodel-async: plan review (<= 0.2); gothinkster__node-express-realworld-example-app: plan review (<= 0.2); fastapi__full-stack-fastapi-template: plan review (<= 0.2); wagtail__bakerydemo: plan review (<= 0.2); fastapi__fastapi: planner (<= 1.5); fastapi__fastapi: plan review (<= 0.2)
Budget: --bob-budget 4.5 is ONE shared total for the whole audit; each call is capped at 1.5 and never more than what is left (src/pipeline.js makeBudget). Worst case if every call hits its cap: 22.20 Bobcoins, stopped at 4.5 by the shared budget. The pass stops asking Bob once less than 0.05 is left.

### JKHeadley__rest-hapi (PARTIAL): 1 question for Bob
- **S5** `npm test` exit 1

```
          at Test.fail (/workspace/node_modules/tape/lib/test.js:408:10)
          at Test.bound [as fail] (/workspace/node_modules/tape/lib/test.js:99:32)
          at Test._exit (/workspace/node_modules/tape/lib/test.js:271:14)
          at Test.bound [as _exit] (/workspace/node_modules/tape/lib/test.js:99:32)
          at process.<anonymous> (/workspace/node_modules/tape/index.js:95:23)
          at process.emit (node:events:531:35)
          at process.processEmit [as emit] (/workspace/node_modules/signal-exit/index.js:191:37)
  ...
1..359
# tests 359
# pass  332
# fail  27
```

### zhanymkanov__fastapi_production_template (FAILED): 0 questions for Bob
_No undiagnosed failure recorded; a rerun may still ask Bob to review the plan._

### vargasjona__fastapi-alembic-sqlmodel-async (FAILED): 1 question for Bob
- **S8** `source "$(poetry env info --path)/bin/activate"` exit 1

```
/firstrun/step-8.sh: line 5: /bin/activate: No such file or directory
```

### sahat__hackathon-starter (PARTIAL): 4 questions for Bob
- **S7** `npm run test:e2e:replay` exit 1

```
|■■■■■■■■■■■■■■■■■■■■■■■■                                                        |  30% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                                |  40% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                        |  50% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                |  60% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                        |  70% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                |  80% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■        |  90% of 114.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■| 100% of 114.3 MiB
Chrome Headless Shell 153.0.8010.12 (playwright chromium-headless-shell v1243) downloaded to /root/.cache/ms-playwright/chromium_headless_shell-1243
> hackathon-starter@10.0.0 test:e2e:replay
> playwright test --config=test/playwright.config.js --project=chromium-replay
Error: http://127.0.0.1:8080 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.
```
- **S8** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium` exit 1

```
Error: http://127.0.0.1:8080 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.
```
- **S9** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium-replay` exit 1

```
Error: http://127.0.0.1:8080 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.
```
- **S10** `npx playwright test test/e2e.../testfile.e2e.test.js --config=test/playwright.config.js --project=chromium-record` exit 1

```
Error: http://127.0.0.1:8080 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.
```

### gothinkster__node-express-realworld-example-app (INCONCLUSIVE): 1 question for Bob
- **S1** `npm install` exit 135

```
npm error code 135
npm error path /workspace/node_modules/@swc/core
npm error command failed
npm error command sh -c node postinstall.js
npm error Bus error (core dumped)
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-09-27T00_32_52_913Z-debug-0.log
```

### fastapi__full-stack-fastapi-template (INCONCLUSIVE): 2 questions for Bob
- **S6** `bun run dev` exit 124

```
$ bun run --filter frontend dev
frontend dev: [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vite.dev/rolldown
frontend dev: 
frontend dev:   VITE v8.2.0  ready in 1850 ms
frontend dev: 
frontend dev:   ➜  Local:   http://localhost:5173/
frontend dev:   ➜  Network: use --host to expose
```
- **S7** `bun run build` exit 1

```
error: Script not found "build"
```

### wagtail__bakerydemo (INCONCLUSIVE): 1 question for Bob
- **S13** `./manage.py migrate` exit 127

```
env: ‘python\r’: No such file or directory
env: use -[v]S to pass options in shebang lines
```

### shadcn-ui__taxonomy (INCONCLUSIVE): 1 question for Bob
- **S1** `pnpm install` exit 1

```
! Corepack is about to download https://registry.npmjs.org/pnpm/-/pnpm-12.6.0.tgz
Downloading the pnpm 12.6.0 binary for linux-x64...
Error: ERR_PNPM_BROKEN_LOCKFILE
  × The lockfile at "/workspace/pnpm-lock.yaml" is broken: The lockfileVersion
  │ of 6.0 is incompatible with the supported formats (1:18)
```

### fastify__fastify (PARTIAL): 1 question for Bob
- **S14** `yarn test` exit 1

```
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3) {
    [cause]: Error: connect ECONNREFUSED 127.0.0.1:39147
        at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1638:16) {
      errno: -111,
      code: 'ECONNREFUSED',
      syscall: 'connect',
      address: '127.0.0.1',
      port: 39147
    }
  }
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
error Command failed with exit code 1.
```

### fastapi__fastapi (PARTIAL): 1 question for Bob
- **S2** `uv run fastapi dev` exit 1

```
Installed 190 packages in 1.16s
To use the fastapi command, please install "fastapi[standard]":
	pip install "fastapi[standard]"
Traceback (most recent call last):
  File "/workspace/.venv/bin/fastapi", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/workspace/fastapi/cli.py", line 12, in main
    raise RuntimeError(message)  # noqa: B904
    ^^^^^^^^^^^^^^^^^^^^^^^^^^^
RuntimeError: To use the fastapi command, please install "fastapi[standard]":
	pip install "fastapi[standard]"
```

## The command (run only on Karmanya's go)

```bash
node bin/firstrun.js audit audit/v2-31-repos.json --brain auto --bob-budget 4.5 --concurrency 1 --id v2-31-final-bob --only JKHeadley__rest-hapi,zhanymkanov__fastapi_production_template,vargasjona__fastapi-alembic-sqlmodel-async,sahat__hackathon-starter,gothinkster__node-express-realworld-example-app,fastapi__full-stack-fastapi-template,wagtail__bakerydemo,shadcn-ui__taxonomy,fastify__fastify,fastapi__fastapi
```
