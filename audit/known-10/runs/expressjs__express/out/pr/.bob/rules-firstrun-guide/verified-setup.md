# Verified setup for expressjs/express

Verified by FirstRun on 2026-09-25 at commit `9a34acf03c` on a clean `node:18` machine. Clone to running took 53s.

Prerequisites: Node.js 18.

## Steps

1. `npm install express`
   - Kind: install
   - Expect: exits with code 0.
2. `npm install -g express-generator@4`
   - Kind: install
   - Expect: exits with code 0.
3. `express /tmp/foo`
   - Kind: other
   - Expect: exits with code 0.
4. `cd /tmp/foo`
   - Kind: other
   - Expect: exits with code 0.
5. `npm install`
   - Kind: install
   - Expect: exits with code 0.
6. `npm start`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/ (HTTP 200). Leave it running in its own terminal.
7. `npm install`
   - Kind: install
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
