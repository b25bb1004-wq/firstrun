# FirstRun report: orbit-dev/telemetry-ui

Verdict: **VERIFIED** at `deaa51b` in `node:20-bookworm`.

Clone to running from zero: 0m51s.

## Repairs

- E1 (S2) missing-tool: pnpm is not installed in a clean Node image; package.json pins pnpm@9.1.0 via Corepack. (verified, diagnosed by rules)
