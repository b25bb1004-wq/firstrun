# FirstRun report: lumen-health/intake-service

Verdict: **PARTIAL** at `aaf1875` in `python:3.11-slim-bookworm`.

Clone to running from zero: 0m45s.

## Repairs

- E1 (S3) missing-env: intake/settings.py builds a Fernet cipher from INTAKE_SIGNING_KEY, which must be a urlsafe base64 32-byte key; the example leaves it blank. (verified, diagnosed by IBM Bob)
- E2 (S4) needs-secret: Startup verifies TWILIO_AUTH_TOKEN against the Twilio API; a real credential is required and cannot be generated. (needs-human, diagnosed by rules)
