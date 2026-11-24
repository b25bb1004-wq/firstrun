# Verified setup for tj/commander.js

Verified by HUMBLE on 2026-09-26 at commit `ba6d13ddb4+dirty` on a clean `node:22` machine. Clone to running took 0s.

Prerequisites: Node.js 22.

## Steps

1. `extra --help`
   - Kind: other
   - Expect: exits with code 0.
2. `extra --drink huge`
   - Kind: other
   - Expect: exits with code 0.
3. `PORT=80 extra --donate --free-drink`
   - Kind: other
   - Expect: exits with code 0.
4. `extra --disable-server --port 8000`
   - Kind: other
   - Expect: exits with code 0.
5. `program -b subcommand`
   - Kind: other
   - Expect: exits with code 0.
6. `program subcommand -b`
   - Kind: other
   - Expect: exits with code 0.
7. `program --port=80 arg`
   - Kind: other
   - Expect: exits with code 0.
8. `program arg --port=80`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
