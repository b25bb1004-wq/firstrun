# FirstRun live-audit repo list

Built 2026-09-25 for the IBM Bob 2.0 hackathon demo. `repos.json` in this
directory lists 16 real, public GitHub repos for FirstRun's parallel audit
("N of M READMEs broke on a clean machine").

## Selection criteria

Every repo satisfies all of:

- Node.js (JS/TS) or Python web app / API / small full-stack / CLI project,
  with a README "Getting Started / Installation / Development / Running
  locally"-style section containing fenced shell commands.
- Feasible to set up in a clean Linux Docker container in well under
  10 minutes: no paid cloud accounts, no *mandatory* real third-party API
  keys (optional keys are fine), no GPU, no mobile/Electron/desktop GUI, no
  Kubernetes. Needing Postgres/Redis/MySQL/MongoDB is fine — FirstRun runs
  those as sidecars.
- Small clone (well under 50 MB), 50+ GitHub stars, not archived.
- A deliberate mix of very actively maintained repos (pushed within the
  last several months) and repos that have gone 1–3+ years without a push
  (more likely to have drifted from their own README).
- Picked to make static drift spottable without ever running the setup:
  README-stated Node/Python version vs. `.nvmrc` / `package.json#engines` /
  `.python-version` / `requires-python` / CI matrix; README-referenced
  scripts or files that don't exist; env vars read in code
  (`process.env.X`, `os.environ[...]`, `os.getenv`) missing or only
  placeholder-stubbed in `.env.example`; services used in code (queues,
  brokers, object storage) not mentioned in the README or docker-compose.

## How the list was built

1. Used `gh search repos` (authenticated `gh` CLI) across several queries —
   Node/Express + Mongo APIs, TypeScript Express starters, Python
   FastAPI/Flask boilerplates, and small Node/Python CLIs — filtered by
   language, star count, repo size, and archived state.
2. Pulled each candidate's metadata via `gh api repos/OWNER/REPO` (default
   branch, `pushed_at`, stars, size, archived) and the default branch's
   HEAD commit SHA via `gh api repos/OWNER/REPO/commits/<branch>`, which is
   what's pinned as `ref` in `repos.json` for reproducibility.
3. Shallow-cloned (`git clone --depth 1`) each candidate into a scratch
   folder under `.firstrun-work/scout/` to statically read the README,
   `package.json`/`pyproject.toml`/`requirements.txt`, `.nvmrc` /
   `.python-version` / `.tool-versions`, `.env.example`/`.env.template`,
   `docker-compose.yml`, and CI workflow files, and to grep source for env
   var usage and service clients (Mongo/Redis/MySQL/RabbitMQ/MinIO/etc.).
   No setup command from any candidate's README was ever executed —
   FirstRun's own Runner is what will do that. All scratch clones were
   deleted after inspection (`.firstrun-work/scout/` is empty again).
4. One initial candidate (`kutia-software-company/express-typescript-starter`)
   was dropped after inspection because its README has no inline setup
   section at all (it just links out to an external docs site) and was
   replaced with `Louis3797/express-ts-auth-service`, which has a proper
   README "Getting Started" section and two independently verifiable,
   concrete bugs (a docker-compose port mismatch and a missing Prisma
   migration step).
5. Ranked the final 16 by demo value: clearest setup section + highest-
   confidence, most concretely-evidenced drift + fastest install first.

## Contents

`repos.json` — one entry per repo with `slug`, `url`, pinned `ref` (commit
SHA), `stack`, `services`, `stars`, `lastCommit`, `readmeSetupSection`,
`suspectedDrift` (each with `what` + file/line `evidence`), `risk`
(low/medium/high), and a one-line `why` explaining its value as an audit
target.
