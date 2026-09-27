# Verified setup for kellyjonbrazil/jello

Verified by HUMBLE on 2026-09-27 at commit `b43c9b2460` on a clean `python:3.12` machine. Clone to running took 9s.

Prerequisites: Python 3.12.

## Steps

1. `pip3 install jello`
   - Kind: install
   - Expect: exits with code 0.
2. `jello --help`
   - Kind: test
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
