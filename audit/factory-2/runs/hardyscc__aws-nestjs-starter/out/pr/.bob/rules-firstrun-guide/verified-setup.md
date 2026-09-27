# Verified setup for hardyscc/aws-nestjs-starter

Verified by HUMBLE on 2026-09-27 at commit `2e312502fc` on a clean `node:22` machine. Clone to running took 34s.

Prerequisites: Node.js 22.

## Steps

1. `npm install`
   - Kind: install
   - Expect: exits with code 0.
2. `npm run sls:offline`
   - Kind: other
   - Expect: exits with code 0.
3. `npm run sls:online`
   - Kind: other
   - Expect: exits with code 0.
4. `npm run start:online`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/dev/graphql. Leave it running in its own terminal.
5. `npm run test:e2e`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
