# Verified setup for fastify/fastify

Verified by HUMBLE on 2026-09-27 at commit `f7f73aa7d0` on a clean `node:22` machine. Clone to running took 95s.

Prerequisites: Node.js 22.

## Steps

1. `yarn`
   - Kind: install
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `/firstrun/step-1.sh: line 5: yarn: command not found` | `yarn` is not installed; the docs assume it is. | Yarn (via `corepack enable`) |
