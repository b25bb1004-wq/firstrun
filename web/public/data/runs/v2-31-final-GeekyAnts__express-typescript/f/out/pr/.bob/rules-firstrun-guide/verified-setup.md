# Verified setup for GeekyAnts/express-typescript

Verified by HUMBLE on 2026-09-26 at commit `6b9bb70e23` on a clean `node:22` machine. Clone to running took 113s.

Prerequisites: Node.js 22, Docker (for backing services).

## Steps

1. `npm install --legacy-peer-deps`
   - Kind: install (the README used to say `npm install`)
   - Expect: exits with code 0.
2. `npm install --global nodemon`
   - Kind: install (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
3. `docker compose -f docker-compose.yaml up -d mongo`
   - Kind: services (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
4. `docker compose -f docker-compose.yaml up -d redis`
   - Kind: services (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
5. `npm run dev`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:4040/ (HTTP 200). Leave it running in its own terminal.
6. `docker-compose up`
   - Kind: services
   - Expect: exits with code 0.
7. `docker-compose up -d`
   - Kind: services
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `npm error ERESOLVE unable to resolve dependency tree` | Current npm refuses the project's conflicting peer dependencies (older npm versions only warned); the lockfile resolves with --legacy-peer-deps. | npm install --legacy-peer-deps |
| `sh: 1: nodemon: not found` | The scripts call `nodemon`, but it isn't a dependency of the project: the docs assume it is installed globally. | npm install --global nodemon |
| `Error [MongoError]: failed to connect to server [127.0.0.1:27017] on first connect [Error: connect ECONNREFUSED 127.0.0.1:27017` | The app connects to MongoDB on localhost:27017, but the docs never start it. | docker compose -f docker-compose.yaml up -d mongo |
| `Error: connect ECONNREFUSED 127.0.0.1:6379` | The app connects to Redis on localhost:6379, but the docs never start it. | docker compose -f docker-compose.yaml up -d redis |
| `[ERROR] :: TypeError: OAuth2Strategy requires a clientID option` | The app's MongoDB driver uses legacy opcodes that MongoDB 6 and later removed ("Unsupported OP_QUERY command"), so it connects but every write fails. The docs don't say which MongoDB to run; the driver needs 4.4 or older. | MongoDB 4.4 (this project's driver can't talk to MongoDB 6+): docker run -d -p 27017:27017 mongo:4.4 |
