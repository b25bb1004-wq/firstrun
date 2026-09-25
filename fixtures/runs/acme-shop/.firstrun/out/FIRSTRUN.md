# FirstRun report: acme-labs/acme-shop

Verdict: **VERIFIED** at `9d6540e` in `node:20.11.1-bookworm`.

Clone to running from zero: 3m12s.

## Repairs

- E1 (S2) runtime-version: package.json requires Node >=20.11.0 and .npmrc sets engine-strict, but the README says Node 16. (verified, diagnosed by rules)
- E2 (S3) missing-file: .env.sample does not exist; the repository ships .env.example instead. (verified, diagnosed by rules)
- E3 (S5) missing-script: package.json has no "migrate" script; the migration script is "db:migrate". (verified, diagnosed by rules)
- E4 (S6) missing-env: src/config/env.ts requires SESSION_SECRET of at least 32 characters, but .env.example leaves it empty and the README never mentions it. (verified, diagnosed by IBM Bob)
- E5 (S8) missing-service: The session store connects to Redis on 127.0.0.1:6379, but the README only starts Postgres. (verified, diagnosed by rules)
