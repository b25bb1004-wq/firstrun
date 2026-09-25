# Verified setup for maitraysuthar/rest-api-nodejs-mongodb

Verified by FirstRun on 2026-09-24 at commit `6a1ba2da70` on a clean `node:22` machine. Clone to running took 0s.

Prerequisites: Node.js 22.

## Steps

1. `cp .env.example .env`
   - Kind: env
   - Expect: exits with code 0.
2. `npm run dev`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/. Leave it running in its own terminal.
3. `App is running ...`
   - Kind: other
   - Expect: exits with code 0.
4. `Press CTRL + C to stop the process.`
   - Kind: other
   - Expect: exits with code 0.
5. `npm test`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
