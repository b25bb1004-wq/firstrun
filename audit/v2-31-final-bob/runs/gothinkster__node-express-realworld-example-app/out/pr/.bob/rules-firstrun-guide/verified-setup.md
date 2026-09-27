# Verified setup for gothinkster/node-express-realworld-example-app

Verified by HUMBLE on 2026-09-27 at commit `30b68e1e88` on a clean `node:22` machine. Clone to running took 63s.

Prerequisites: Node.js 22.

## Steps

1. `npm install`
   - Kind: install
   - Expect: exits with code 0.
2. `npx prisma generate`
   - Kind: migrate
   - Expect: exits with code 0.
3. `export DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres`
   - Kind: env (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
4. `npx prisma migrate deploy`
   - Kind: migrate
   - Expect: exits with code 0.
5. `npx prisma db seed`
   - Kind: migrate
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `error: Environment variable not found: DATABASE_URL.` | The app requires DATABASE_URL at startup, but the docs never mention it. | export DATABASE_URL=… |
| `Error: P1001: Can't reach database server at `localhost`:`5432`` | README.md line 46 runs `npx prisma migrate deploy` without ever starting a PostgreSQL server; the error `P1001: Can't reach database server at localhost:5432` proves no database is running. | Before running `npx prisma migrate deploy`, start a PostgreSQL instance (e.g. `docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine`) and set DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres. |
