#!/usr/bin/env bash
# Demo CLI session for HUMBLE video recording
# Runs a real end-to-end session on examples/acme-shop
# Every line comes from the actual tools - no invented output

set -uo pipefail  # Don't exit on command failure (verify is expected to fail)

FIRSTRUN="node bin/firstrun.js"
ACME="/home/dev/firstrun4/examples/acme-shop"
RUN_DIR="/home/dev/firstrun4/fixtures/runs/acme-shop/.firstrun"

# Helper: pause for video pacing
pause() { sleep "${1:-2}"; }

# Helper: print a section header
section() {
  echo
  echo "═══════════════════════════════════════════════════════════════"
  echo "  $1"
  echo "═══════════════════════════════════════════════════════════════"
  echo
  pause 1
}

# Helper: run command and continue even if it fails
run_cmd() {
  echo "$ $*"
  "$@" || true
  echo
}

# Start clean
cd /home/dev/firstrun4

section "HUMBLE verify on acme-shop (shows EBADENGINE break)"
run_cmd $FIRSTRUN verify "$ACME" --verbose
pause 3

section "HUMBLE plan on acme-shop (static docs-vs-code conflicts)"
run_cmd $FIRSTRUN plan "$ACME"
pause 3

section "HUMBLE guard on three commands (ok, warn, block)"
run_cmd $FIRSTRUN guard "npm install"
pause 1
run_cmd $FIRSTRUN guard "sudo npm install -g foo"
pause 1
run_cmd $FIRSTRUN guard "rm -rf /"
pause 2

section "HUMBLE guard --self (self-check)"
run_cmd $FIRSTRUN guard --self
pause 2

section "HUMBLE onboard --dry-run (verified guide from fixture run)"
run_cmd $FIRSTRUN onboard "$ACME" --from "$RUN_DIR" --dry-run
pause 2

echo
echo "═══════════════════════════════════════════════════════════════"
echo "  DEMO COMPLETE"
echo "═══════════════════════════════════════════════════════════════"