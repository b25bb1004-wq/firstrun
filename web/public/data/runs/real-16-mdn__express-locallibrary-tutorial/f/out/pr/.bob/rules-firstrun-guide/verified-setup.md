# Verified setup for mdn/express-locallibrary-tutorial

Verified by FirstRun on 2026-09-24 at commit `b378f3dd48` on a clean `node:22` machine. Clone to running took 301s.

Prerequisites: Node.js 22.

## Steps

1. `npm install`
   - Kind: install
   - Expect: exits with code 0.
2. `DEBUG=express-locallibrary-tutorial:* npm run devstart`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/ (HTTP 302). Leave it running in its own terminal.
3. `npm test`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
