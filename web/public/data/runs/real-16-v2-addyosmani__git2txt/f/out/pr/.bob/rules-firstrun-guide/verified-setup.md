# Verified setup for addyosmani/git2txt

Verified by FirstRun on 2026-09-25 at commit `e8db771b97` on a clean `node:22` machine. Clone to running took 7s.

Prerequisites: Node.js 22.

## Steps

1. `npm install -g git2txt`
   - Kind: install
   - Expect: exits with code 0.
2. `npm install`
   - Kind: install
   - Expect: exits with code 0.
3. `git2txt --help`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
