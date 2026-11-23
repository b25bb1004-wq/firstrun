# Verified setup for addyosmani/git2txt

Verified by FirstRun on 2026-09-24 at commit `e8db771b97` on a clean `node:22` machine. Clone to running took 0s.

Prerequisites: Node.js 22.

## Steps

1. `npm install -g git2txt`
   - Kind: install
   - Expect: exits with code 0.
2. `git2txt username/repository`
   - Kind: other
   - Expect: exits with code 0.
3. `git2txt git@github.com:username/repository`
   - Kind: other
   - Expect: exits with code 0.
4. `git2txt https://github.com/username/repository`
   - Kind: other
   - Expect: exits with code 0.
5. `git2txt username/repository`
   - Kind: other
   - Expect: exits with code 0.
6. `git2txt git@github.com:username/repository`
   - Kind: other
   - Expect: exits with code 0.
7. `git2txt username/repository --output=output.txt`
   - Kind: other
   - Expect: exits with code 0.
8. `git2txt username/repository --threshold=2`
   - Kind: other
   - Expect: exits with code 0.
9. `git2txt username/repository --include-all`
   - Kind: other
   - Expect: exits with code 0.
10. `git2txt username/repository --debug`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
