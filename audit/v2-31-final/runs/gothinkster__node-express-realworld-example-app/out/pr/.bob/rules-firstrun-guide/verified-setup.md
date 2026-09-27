# Verified setup for gothinkster/node-express-realworld-example-app

Verified by HUMBLE on 2026-09-27 at commit `30b68e1e88` on a clean `node:22` machine. Clone to running took 0s.

Prerequisites: Node.js 22.

## Steps

1. `npx prisma generate`
   - Kind: migrate
   - Expect: exits with code 0.
2. `npx prisma migrate deploy`
   - Kind: migrate
   - Expect: exits with code 0.
3. `npx nx serve api`
   - Kind: other
   - Expect: exits with code 0.
4. `npx prisma db seed`
   - Kind: migrate
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
