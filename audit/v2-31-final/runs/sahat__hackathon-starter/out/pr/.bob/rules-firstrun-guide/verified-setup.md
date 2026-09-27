# Verified setup for sahat/hackathon-starter

Verified by HUMBLE on 2026-09-27 at commit `410fccec23` on a clean `node:22` machine. Clone to running took 88s.

Prerequisites: Node.js 22, Docker (for backing services).

## Steps

1. `npm install`
   - Kind: install
   - Expect: exits with code 0.
2. `docker run -d --name mongo -p 27017:27017 mongo:7`
   - Kind: services (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
3. `npm start`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:8080/auth/facebook/callback (HTTP 302). Leave it running in its own terminal.
4. `npm test`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `[cause]: Error: connect ECONNREFUSED 127.0.0.1:27017` | The app connects to MongoDB on localhost:27017, but the docs never start it. | docker run -d --name mongo -p 27017:27017 mongo:7 |
