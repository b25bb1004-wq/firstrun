# Verified setup for nerdeveloper/hackathon-starter-kit

Verified by HUMBLE on 2026-09-27 at commit `d129ad7465+dirty` on a clean `node:10` machine. Clone to running took 20s.

Prerequisites: Node.js 10.

## Steps

1. `cp env.variable.env variable.env`
   - Kind: env (the README used to say `cp .env.variable.env variable.env`)
   - Expect: exits with code 0.
2. `npm install`
   - Kind: install
   - Expect: exits with code 0.
3. `npm i -g ngrok`
   - Kind: install
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `cp: cannot stat '.env.variable.env': No such file or directory` | .env.variable.env does not exist; the repo ships env.variable.env. | cp env.variable.env variable.env |
