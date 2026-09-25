# FirstRun report: kestrel-io/kestrel-cli

Verdict: **VERIFIED** at `e9f6165` in `golang:1.22-bookworm`.

Clone to running from zero: 1m40s.

## Repairs

- E1 (S2) missing-tool: The lint target calls golangci-lint, which is not in a clean Go image and is not listed as a prerequisite. (verified, diagnosed by rules)
