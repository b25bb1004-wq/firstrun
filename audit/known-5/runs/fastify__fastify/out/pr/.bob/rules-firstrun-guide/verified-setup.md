# Verified setup for fastify/fastify

Verified by HUMBLE on 2026-09-26 at commit `f7f73aa7d0` on a clean `node:22` machine. Clone to running took 0s.

Prerequisites: Node.js 22.

## Steps

1. `xattr -dr com.apple.quarantine /Applications/VSCodeFastify/Visual\ Studio\ Code.app`
   - Kind: other
   - Expect: exits with code 0.
2. `mkdir -p /Applications/VSCodeFastify/code-portable-data/{user-data,extensions}`
   - Kind: other
   - Expect: exits with code 0.
3. `alias code-fastify="/Applications/VSCodeFastify/Visual\ Studio\ Code.app/Contents/Resources/app/bin/code"`
   - Kind: other
   - Expect: exits with code 0.
4. `❯ code-fastify --version`
   - Kind: other
   - Expect: exits with code 0.
5. `1.50.0`
   - Kind: other
   - Expect: exits with code 0.
6. `93c2f0fbf16c5a4b10e4d5f89737d9c2c25488a3`
   - Kind: other
   - Expect: exits with code 0.
7. `x64`
   - Kind: other
   - Expect: exits with code 0.
8. `code-fastify --install-extension dbaeumer.vscode-eslint`
   - Kind: other
   - Expect: exits with code 0.
9. `[ -d /Applications/VSCodeFastify/code-portable-data/extensions/dbaeumer.vscode-eslint-* ] && echo "found"`
   - Kind: other
   - Expect: exits with code 0.
10. `code-fastify .`
   - Kind: other
   - Expect: exits with code 0.
11. `npm i fastify-plugin @fastify/mongodb`
   - Kind: install
   - Expect: exits with code 0.
12. `npm i fastify-cli`
   - Kind: install
   - Expect: exits with code 0.
13. `npm start`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/. Leave it running in its own terminal.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
