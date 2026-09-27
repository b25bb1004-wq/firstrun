# Verified setup for Louis3797/express-ts-auth-service

Verified by HUMBLE on 2026-09-26 at commit `fc6722badf` on a clean `node:22` machine. Clone to running took 113s.

Prerequisites: Node.js 22.

## Steps

1. `npm install --global yarn`
   - Kind: install
   - Expect: exits with code 0.
2. `yarn install`
   - Kind: install
   - Expect: exits with code 0.
3. `cp .env.example .env`
   - Kind: env (added by HUMBLE: the README missed it)
   - Expect: exits with code 0.
4. `yarn start`
   - Kind: serve
   - Expect: the app answers at http://127.0.0.1:4000/ (HTTP 404). Leave it running in its own terminal.
5. `yarn test`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
| `Error: Environment variable validation error:` | The app requires PORT, SERVER_URL, CORS_ORIGIN, ACCESS_TOKEN_SECRET and 11 more from .env.example, but the docs never say to create .env from it. | cp .env.example .env |
| `Error: Environment variable validation error:` | .env.example leaves 16 required values blank and the app rejects empty values. HUMBLE fills PORT, SERVER_URL, CORS_ORIGIN, ACCESS_TOKEN_SECRET and 12 more with local values (the app's own defaults where it has them, generated dev secrets, a local mail catcher for SMTP). | `.env.example` now has working local values for the variables that were blank (PORT, SERVER_URL, CORS_ORIGIN, ACCESS_TOKEN_SECRET and 12 more). |
