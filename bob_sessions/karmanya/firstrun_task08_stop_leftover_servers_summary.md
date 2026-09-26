# firstrun · task08 · stop leftover dev servers before repairs (GeekyAnts runner bug)

- **Tool:** IBM Bob Shell 2.0.5, headless (`bob run`, agent mode, `--max-cost 1.5`) on Karmanya's PC
- **Task id:** `a69fca36a38968b1d81407603843ef01`
- **Cost:** 1.52 Bobcoins · 22 tool calls · 270 s
- **Origin:** GeekyAnts headline run. `tsc --watch & nodemon` kept running after `serve()` reported a crash; the Doctor's mongoose pin swapped node_modules under it and nodemon restarted onto a half-replaced tree (`Cannot find module '../../error/mongooseError'`). In a clean container the same pin works.
- **Review (Edith):** Bob's process-group kill in `serve()` and `stopServers()` are correct (checked by hand in node:22-slim: the watcher's group dies). Two fixes by Edith:
  (1) `exec()` never wrote the `step-*.pid` files `stopServers()` reads, so detected servers still leaked. The step script now records its process group (GNU `timeout` gives it one) and removes it when the step finishes; added a Docker test.
  (2) The Docker test grepped `/proc/*/cmdline` for the script text and matched its own grep; killed processes also linger as zombies because PID 1 is `sleep infinity`. The tests now check `node` processes that aren't in state Z. 135/135 incl. both Docker tests.

## Prompt given to Bob
Fix a runner bug in src/sandbox.js (+ a call site in src/pipeline.js), with a new test file. Do not commit.

## The bug (real run, GeekyAnts/express-typescript)
Step `npm run dev` = `tsc --watch & NODE_ENV=development nodemon dist`. FirstRun starts it with `Sandbox.serve()` (setsid bash ... in the background). The app crashed, `serve()` returned exitCode 1 ("the server crashed during startup"), but the process group kept running: tsc --watch and nodemon are watchers and never exit. Then the Doctor applied a repair `npm install --no-save --legacy-peer-deps mongoose@^6.4.6` in the same container. npm replaced node_modules/mongoose while nodemon/tsc were still watching; nodemon restarted onto a half-replaced tree and crashed with `Error: Cannot find module '../../error/mongooseError'`. In a clean container the same pin works fine, so the leftover watcher is the cause. The same can happen with `exec()` when its watcher decides a never-exiting step is a server ("still running and listening on port N").

## Change
1. `serve()`: when it returns a FAILURE (crash detected, process exited, or the not-ready timeout), kill that server's whole process group before returning. The pid in /firstrun/serve-<id>.pid is the setsid session leader, so `kill -TERM -- -<pid>` then, after ~2 s, `kill -KILL -- -<pid>` (ignore errors). On SUCCESS keep it running (the verify probe needs it) but remember the pid file.
2. Add `async stopServers()` to Sandbox: kills every process group recorded in /firstrun/serve-*.pid (TERM, short wait, KILL), and also every step process `exec()` left running as a detected server. For exec(), record the step so it can be killed: run the step under `setsid` and write its pid to /firstrun/step-<id>.pid, or kill by matching `/firstrun/step-<id>.sh` with pkill -f. Pick the simplest reliable one; bash/procps exist in node and python images, but prefer plain `kill` + /proc if you can.
3. src/pipeline.js: before applying a repair fix's actions (where the Doctor's fix is executed, before the retry of the step), call `await sandbox.stopServers()`. Servers are restarted by the retry anyway. Do NOT stop services started as sidecars (compose services like mongo/redis run in separate containers; leave them alone).
4. Keep behavior identical when nothing is running.

## Tests: new file test/stop-servers.test.js (node:test)
- Unit-level: a fake Sandbox or stubbed `run` asserting that after `serve()` detects a crash it issues a kill of the process group (-pid), and that `stopServers()` kills every recorded pid file.
- If Docker is available (`docker info` exit 0), an integration test with image node:22-slim: start `serve('node -e "setInterval(()=>{},1000); console.error(\"Error: Cannot find module x\")"')`, which crashes-but-keeps-running like nodemon; assert serve returns exitCode 1 AND the process is gone afterwards (`pgrep -f setInterval` finds nothing). Skip the Docker test cleanly when Docker isn't running.

Run `node --test test/*.test.js`; all must pass. Match the surrounding style and comment density. Keep it small.
