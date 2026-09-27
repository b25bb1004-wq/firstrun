# Verified setup for mongodb-developer/mern-stack-example

Verified by HUMBLE on 2026-09-27 at commit `6a5e9397b1` on a clean `node:20` machine. Clone to running took 0s.

Prerequisites: Node.js 20.

## Steps

1. `cp mern/server/config.env.example mern/server/config.env`
   - Kind: env
   - Expect: exits with code 0.
2. `cd mern/server`
   - Kind: other
   - Expect: exits with code 0.
3. `npm install`
   - Kind: install
   - Expect: exits with code 0.
4. `cd mern/client`
   - Kind: other
   - Expect: exits with code 0.
5. `npm run dev`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:5173/. Leave it running in its own terminal.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
