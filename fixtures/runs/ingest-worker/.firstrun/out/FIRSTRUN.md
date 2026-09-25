# FirstRun report: harbor-labs/ingest-worker

Verdict: **PARTIAL** at `e91cd76` in `python:3.12-slim-bookworm`.

Clone to running from zero: 1m05s.

## Repairs

- E1 (S1) missing-tool: Poetry is not installed in a clean Python image and the README does not say how to get it. (verified, diagnosed by rules)
- E2 (S3) needs-secret: The sink writes to a real S3 bucket and needs AWS credentials; no local emulator is configured. (needs-human, diagnosed by rules)
