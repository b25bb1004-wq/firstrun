# Verified setup for shadcn-ui/taxonomy

Verified by HUMBLE on 2026-09-27 at commit `298a8857c7` on a clean `node:22` machine. Clone to running took 0s.

Prerequisites: Node.js 22.

## Steps

1. `cp .env.example .env.local`
   - Kind: env
   - Expect: exits with code 0.
2. `pnpm dev`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:3000/. Leave it running in its own terminal.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
