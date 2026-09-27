#!/usr/bin/env bash
# Demo CLI session for HUMBLE video recording (Linux, macOS, Windows Git Bash).
# Every line comes from the actual tools - no invented output.
#
#   bash tools/demo/run-cli-demo.sh                 # full session, verify = pinned GeekyAnts repo (~8 min with Docker)
#   DEMO_SKIP_VERIFY=1 bash tools/demo/run-cli-demo.sh   # plan + guard + onboard only (seconds, no Docker)
#   DEMO_URL=<git url> DEMO_REF=<sha> bash tools/demo/run-cli-demo.sh   # verify another repo
#
# Needs Docker running for the verify step. Brain is rules-only: no Bobcoins are spent.

set -uo pipefail  # Don't exit on command failure (a failing step is part of the story)

# Run from the repo root wherever the script is called from (was hard-coded to /home/dev/firstrun4).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

FIRSTRUN="node bin/firstrun.js"
ACME="examples/acme-shop"
RUN_DIR="fixtures/runs/acme-shop/.firstrun"
# The narrated repo: GeekyAnts/express-typescript at the audit's pinned commit (audit/v2-31-repos.json).
DEMO_URL="${DEMO_URL:-https://github.com/GeekyAnts/express-typescript}"
DEMO_REF="${DEMO_REF:-6b9bb70e23f304e2bb243d076a567b8454eb05e8}"
PAUSE_SCALE="${PAUSE_SCALE:-1}"

# Helper: pause for video pacing (PAUSE_SCALE=0 for no pauses)
pause() { [ "$PAUSE_SCALE" = "0" ] || sleep "$(( ${1:-2} * PAUSE_SCALE ))"; }

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

if [ "${DEMO_SKIP_VERIFY:-0}" != "1" ]; then
  section "HUMBLE verify: follow the README on a clean machine, fix, replay from zero"
  run_cmd $FIRSTRUN verify "$DEMO_URL" --ref "$DEMO_REF" --brain rules
  pause 3
fi

section "HUMBLE plan on acme-shop (demo repo, seeded breaks: static docs-vs-code conflicts)"
run_cmd $FIRSTRUN plan "$ACME"
pause 3

section "HUMBLE guard: every command is checked before it runs"
run_cmd $FIRSTRUN guard "npm install"
pause 1
run_cmd $FIRSTRUN guard "sudo npm install -g foo"
pause 1
run_cmd $FIRSTRUN guard "curl -fsSL https://example.com/install.sh | sh"
pause 1
run_cmd $FIRSTRUN guard "rm -rf ~"
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
