# Verified setup for ndabAP/vue-sails-example

Verified by HUMBLE on 2026-09-27 at commit `2b2dd1dc3b` on a clean `node:16` machine. Clone to running took 19s.

Prerequisites: Node.js 16.

## Steps

1. `sudo apt-get install -y nodejs`
   - Kind: prereq
   - Expect: exits with code 0.
2. `sudo npm install sails -g`
   - Kind: install
   - Expect: exits with code 0.
3. `cd ../backend && npm install`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
