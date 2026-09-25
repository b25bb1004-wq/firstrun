# Verified setup for erev0s/VAmPI

Verified by FirstRun on 2026-09-24 at commit `f16052dce8` on a clean `python:3.12` machine. Clone to running took 1s.

Prerequisites: Python 3.12, Docker (for backing services).

## Steps

1. `docker-compose up -d`
   - Kind: services
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
