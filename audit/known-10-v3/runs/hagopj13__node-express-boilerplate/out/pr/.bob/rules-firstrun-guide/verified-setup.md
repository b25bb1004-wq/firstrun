# Verified setup for hagopj13/node-express-boilerplate

Verified by FirstRun on 2026-09-25 at commit `179ae84efe` on a clean `node:22` machine. Clone to running took 44s.

Prerequisites: Node.js 22.

## Steps

1. `npx rimraf ./.git`
   - Kind: other
   - Expect: exits with code 0.
2. `yarn install`
   - Kind: install
   - Expect: exits with code 0.
3. `node bin/createNodejsApp.js --help`
   - Kind: test
   - Expect: exits with code 0.
4. `cp .env.example .env`
   - Kind: env
   - Expect: exits with code 0.
5. `PORT=3000`
   - Kind: other
   - Expect: exits with code 0.
6. `MONGODB_URL=mongodb://127.0.0.1:27017/node-boilerplate`
   - Kind: other
   - Expect: exits with code 0.
7. `JWT_SECRET=thisisasamplesecret`
   - Kind: other
   - Expect: exits with code 0.
8. `JWT_ACCESS_EXPIRATION_MINUTES=30`
   - Kind: other
   - Expect: exits with code 0.
9. `JWT_REFRESH_EXPIRATION_DAYS=30`
   - Kind: other
   - Expect: exits with code 0.
10. `SMTP_HOST=email-server`
   - Kind: other
   - Expect: exits with code 0.
11. `SMTP_PORT=587`
   - Kind: other
   - Expect: exits with code 0.
12. `SMTP_USERNAME=email-server-username`
   - Kind: other
   - Expect: exits with code 0.
13. `SMTP_PASSWORD=email-server-password`
   - Kind: other
   - Expect: exits with code 0.
14. `EMAIL_FROM=support@yourapp.com`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-2.sh: line 4: yarn: command not found` | `yarn` is not installed; the docs assume it is. | Yarn (via `corepack enable`) |
