# Verified setup for maitraysuthar/rest-api-nodejs-mongodb

Verified by HUMBLE on 2026-09-27 at commit `6a1ba2da70` on a clean `node:16` machine. Clone to running took 39s.

Prerequisites: Node.js 16.

## Steps

1. `npm install`
   - Kind: install
   - Expect: exits with code 0.
2. `cp .env.example .env`
   - Kind: env
   - Expect: exits with code 0.
3. `npm run dev`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/ (HTTP 200). Leave it running in its own terminal.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `npm error node-pre-gyp ERR! stack Error: Failed to execute '/usr/local/bin/node /usr/local/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js build --fallback-to-build --module=/workspace/node` | bcrypt ^3.0.6 does not build on Node.js 22: bcrypt ^3.0.6 in package.json supports Node.js 12–16 only (bcrypt's compatibility table); Node.js 18+ needs bcrypt >= 6. Node.js 16 is end-of-life, so upgrading bcrypt is the lasting fix. | Node.js 16 (see bcrypt's compatibility table: bcrypt ^3.0.6 supports Node.js 12–16; upgrading to bcrypt >= 6 lets you use a current Node.js) |
| `App starting error: Invalid connection string` | MONGODB_URL=YourConnectionString is a placeholder in .env.example, and the app fails on it; HUMBLE sets MONGODB_URL=mongodb://127.0.0.1:27017/rest-api-nodejs-mongodb (the commented example in .env.example). | `.env.example` now has a working local value for `MONGODB_URL` instead of a placeholder. |
