# Verified setup for fastify/fastify

Verified by HUMBLE on 2026-09-26 at commit `f7f73aa7d0` on a clean `node:22` machine. Clone to running took 85s.

Prerequisites: Node.js 22.

## Steps

1. `mkdir -p /Applications/VSCodeFastify/code-portable-data/{user-data,extensions}`
   - Kind: other
   - Expect: exits with code 0.
2. `alias code-fastify="/Applications/VSCodeFastify/Visual\ Studio\ Code.app/Contents/Resources/app/bin/code"`
   - Kind: other
   - Expect: exits with code 0.
3. `[ -d /Applications/VSCodeFastify/code-portable-data/extensions/dbaeumer.vscode-eslint-* ] && echo "found"`
   - Kind: other
   - Expect: exits with code 0.
4. `code-fastify .`
   - Kind: other
   - Expect: exits with code 0.
5. `npm i fastify-plugin @fastify/mongodb`
   - Kind: install
   - Expect: exits with code 0.
6. `npm i fastify-cli`
   - Kind: install
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
