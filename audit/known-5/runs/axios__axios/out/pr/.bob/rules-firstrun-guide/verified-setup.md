# Verified setup for axios/axios

Verified by HUMBLE on 2026-09-26 at commit `961241f6c1` on a clean `node:19` machine. Clone to running took 0s.

Prerequisites: Node.js 19.

## Steps

1. `curl -fsSL https://bun.sh/install | bash && export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH"`
   - Kind: install (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
2. `bun add axios`
   - Kind: other
   - Expect: exits with code 0.
3. `curl -fsSL https://deno.land/install.sh | sh && export DENO_INSTALL="$HOME/.deno" && export PATH="$DENO_INSTALL/bin:$PATH"`
   - Kind: install (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
4. `curl -fsSL https://deno.land/x/install/install.sh | sh && export DENO_INSTALL="$HOME/.deno" && export PATH="$DENO_INSTALL/bin:$PATH"`
   - Kind: install (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
5. `npm ci`
   - Kind: install
   - Expect: exits with code 0.
6. `npm rebuild husky`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-1.sh: line 5: bun: command not found` | The README.md line 573 documents `bun add axios` but the Docker base image `node:19` does not include Bun; running the command fails with `bun: command not found` (exit 127) because Bun must be installed separately before it can be used. | Before running `bun add axios`, install Bun first: `curl -fsSL https://bun.sh/install \| bash` (and reload your shell or export `~/.bun/bin` onto PATH). |
