#!/usr/bin/env bash
# Put Arnav's voice-over on the silent draft.
#
#   bash tools/video/add-voice.sh voice.m4a
#   bash tools/video/add-voice.sh voice.m4a --desktop my-desktop-capture.mp4
#
# --desktop replaces the placeholder window 1:20-2:10 (80 s .. 130 s, 50 s) with your own screen
# recording (Win+G). The capture is scaled/padded to 1920x1080 @ 30 fps; if it runs longer than
# 50 s only the first 50 s are used (trim it first, or use --desktop-start SEC to pick the start);
# if shorter, its last frame is held.
# Output: docs/pitch/video/humble-final.mp4 (H.264 + AAC, -shortest).
set -euo pipefail
cd "$(dirname "$0")/../.."
DRAFT=${DRAFT:-docs/pitch/video/humble-draft.mp4}
OUT=${OUT:-docs/pitch/video/humble-final.mp4}
VOICE=${1:?usage: add-voice.sh voice.m4a [--desktop capture.mp4] [--desktop-start SEC]}
shift
DESK=""; DSS=0
while [ $# -gt 0 ]; do
  case "$1" in
    --desktop) DESK=$2; shift 2 ;;
    --desktop-start) DSS=$2; shift 2 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
A=80; L=50; FPS=30
vf="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=$FPS,format=yuv420p"

if [ -n "$DESK" ]; then
  ffmpeg -y -loglevel error -i "$DRAFT" -ss "$DSS" -i "$DESK" -i "$VOICE" -filter_complex \
    "[0:v]trim=0:$A,setpts=PTS-STARTPTS[a];\
     [1:v]$vf,trim=duration=$L,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=$L,trim=duration=$L[b];\
     [0:v]trim=start=$((A+L)),setpts=PTS-STARTPTS[c];\
     [a][b][c]concat=n=3:v=1[v]" \
    -map "[v]" -map 2:a:0 -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r $FPS \
    -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
else
  ffmpeg -y -loglevel error -i "$DRAFT" -i "$VOICE" -map 0:v:0 -map 1:a:0 \
    -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
fi
ffprobe -v error -show_entries format=duration -of default=nw=1 "$OUT"
echo "wrote $OUT (judges stop at 3:00; keep it under that)"
