#!/usr/bin/env bash
# Record the demo CLI session to an asciinema-style cast file and transcript
# Uses `script` with timing since asciinema is not available

set -euo pipefail

CAST_DIR="/home/dev/firstrun4/demo/casts"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CAST_FILE="$CAST_DIR/demo-$TIMESTAMP.cast"
TIMING_FILE="$CAST_DIR/demo-$TIMESTAMP.timing"
TRANSCRIPT_FILE="$CAST_DIR/demo-$TIMESTAMP.txt"

mkdir -p "$CAST_DIR"

echo "Recording demo session to:"
echo "  Cast:  $CAST_FILE"
echo "  Timing: $TIMING_FILE"
echo "  Transcript: $TRANSCRIPT_FILE"
echo

# Use script command to record the session with timing
# script -c "command" --log-timing=timing_file output_file
script -c "/home/dev/firstrun4/tools/demo/run-cli-demo.sh" --log-timing="$TIMING_FILE" "$CAST_FILE"

# Also create a plain-text transcript (strip escape sequences)
cat "$CAST_FILE" | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' > "$TRANSCRIPT_FILE"

echo
echo "Recording complete."
echo "Cast file: $CAST_FILE"
echo "Timing file: $TIMING_FILE"
echo "Transcript: $TRANSCRIPT_FILE"
echo
echo "To replay:"
echo "  scriptreplay -t \"$TIMING_FILE\" \"$CAST_FILE\""