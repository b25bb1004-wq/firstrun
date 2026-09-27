#!/usr/bin/env bash
# Build the SILENT HUMBLE submission video (picture track only) on the docs/pitch/NARRATION.md timecodes.
#
#   bash tools/video/build.sh                 # capture (headless Chrome) + assemble
#   SKIP_CAPTURE=1 bash tools/video/build.sh  # re-assemble from docs/pitch/video/build/
#
# Output: docs/pitch/video/humble-draft.mp4 (1920x1080, 30 fps, H.264 yuv420p, no audio, 2:50).
# Add the voice-over afterwards with tools/video/add-voice.sh.
# Needs: ffmpeg, node, Chrome, playwright-core (set PW_CORE=/path/to/node_modules/playwright-core
# if it is not installed in this repo).
set -euo pipefail
cd "$(dirname "$0")/../.."
REPO=$(pwd)
B=docs/pitch/video/build
OUT=docs/pitch/video/humble-draft.mp4
FPS=30
D=0.5            # crossfade length (s)
THREAD_START=${THREAD_START:-28}   # where in the captured thread-guide reel the 18 s window starts
mkdir -p "$B/clips"

if [ "${SKIP_CAPTURE:-0}" != "1" ]; then
  node tools/video/serve.cjs "$REPO" 4194 & SERVER=$!
  trap 'kill $SERVER 2>/dev/null || true' EXIT
  sleep 1
  LOCAL=http://127.0.0.1:4194 node tools/video/capture.cjs "$B"
fi

enc=(-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r $FPS -an)
vf="scale=1920:1080:force_original_aspect_ratio=decrease:out_range=tv,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=$FPS,format=yuv420p"

# still image -> clip of $2 seconds
still() { ffmpeg -y -loglevel error -loop 1 -framerate $FPS -t "$2" -i "$1" -vf "$vf" "${enc[@]}" "$3"; }
# captured frame sequence -> clip ($2 = start offset, $3 = length); optional overlay png $5
seq_clip() {
  local src=$1 ss=$2 len=$3 out=$4 ov=${5:-}
  if [ -n "$ov" ]; then
    ffmpeg -y -loglevel error -f concat -safe 0 -i "$B/$src/list.txt" -loop 1 -i "$ov" \
      -filter_complex "[0:v]$vf,trim=start=$ss:duration=$len,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=$len[a];[a][1:v]overlay=0:0:shortest=0,trim=duration=$len,format=yuv420p" "${enc[@]}" "$out"
  else
    ffmpeg -y -loglevel error -f concat -safe 0 -i "$B/$src/list.txt" \
      -vf "$vf,trim=start=$ss:duration=$len,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=$len,trim=duration=$len" "${enc[@]}" "$out"
  fi
}
still_ov() { ffmpeg -y -loglevel error -loop 1 -framerate $FPS -t "$2" -i "$1" -loop 1 -i "$4" \
  -filter_complex "[0:v]$vf[a];[a][1:v]overlay=0:0,trim=duration=$2" "${enc[@]}" "$3"; }

C=docs/pitch/cards; S=docs/pitch/deck/preview; K=$B/clips
pad() { awk "BEGIN{print $1+$D}"; }

echo "== segments"
# 0:00-0:20 hook
seq_clip term_hook 0 "$(pad 5)" $K/01.mp4                                  # 0:00 ERESOLVE (recorded run, 6x)
seq_clip audit 0 "$(pad 10)" $K/02.mp4 "$B/ov-audit.png"                    # 0:05 /audit, 19 of 31
still $C/01-hook.png "$(pad 5)" $K/03.mp4                                   # 0:15 crack banner
# 0:20-1:20 the real run
seq_clip term_run 0 "$(pad 45)" $K/04.mp4                                   # 0:20 GeekyAnts run, 2x then 15x
still $C/02-real-run.png "$(pad 3)" $K/05.mp4                               # 1:05 VERIFIED 5 of 5
n=6; for a in harvey unity mach drbo larp echo; do still $C/agent-$a.png "$(pad 2)" $K/0$n.mp4; n=$((n+1)); done  # 1:08-1:20
# 1:20-2:10 desktop app: PLACEHOLDER (4 s card) + live-site fallback under a placeholder banner
still $B/card-placeholder.png 4 $K/d1.mp4
seq_clip hero 0 8 $K/d2.mp4 "$B/ov-live.png"
seq_clip thread "$THREAD_START" 18 $K/d3.mp4 "$B/ov-acme.png"
still $C/03-windows-console.png 10 $K/d4.mp4
seq_clip emo 0 "$(pad 10)" $K/d5.mp4 "$B/ov-live.png"
ffmpeg -y -loglevel error -i $K/d1.mp4 -i $K/d2.mp4 -i $K/d3.mp4 -i $K/d4.mp4 -i $K/d5.mp4 -loop 1 -i $B/ov-placeholder.png \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v]concat=n=5:v=1[c];[c][5:v]overlay=0:0:enable='gte(t,4)',trim=duration=$(pad 50),format=yuv420p" "${enc[@]}" $K/12.mp4
# 2:10-2:40 IBM Bob
still $B/card-04-ibm-bob-filled.png "$(pad 10)" $K/13.mp4                   # rules first, Bob judges; 4.58 Bobcoins
still $S/slide-07.png "$(pad 10)" $K/14.mp4                                 # three layers + 11 -> 14
still $B/card-bob-cost-filled.png "$(pad 10)" $K/15.mp4                     # Bob pass cost 4.58
# 2:40-2:50 close
still $C/05-four-surfaces.png "$(pad 5)" $K/16.mp4
still $S/slide-12.png 5 $K/17.mp4

echo "== assemble with ${D}s crossfades"
DUR=(5 10 5 45 3 2 2 2 2 2 2 50 10 10 10 5 5)
FILES=($K/01.mp4 $K/02.mp4 $K/03.mp4 $K/04.mp4 $K/05.mp4 $K/06.mp4 $K/07.mp4 $K/08.mp4 $K/09.mp4 $K/010.mp4 $K/011.mp4 $K/12.mp4 $K/13.mp4 $K/14.mp4 $K/15.mp4 $K/16.mp4 $K/17.mp4)
inputs=(); for f in "${FILES[@]}"; do inputs+=(-i "$f"); done
fc=""; prev="[0:v]"; off=0
for i in $(seq 1 $((${#FILES[@]} - 1))); do
  off=$(awk "BEGIN{print $off + ${DUR[$((i-1))]}}")
  fc+="${prev}[$i:v]xfade=transition=fade:duration=$D:offset=$off[x$i];"; prev="[x$i]"
done
fc+="${prev}scale=out_range=tv,format=yuv420p[out]"
ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$fc" -map "[out]" "${enc[@]}" -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate,codec_name,pix_fmt -of default=nw=1 "$OUT"
echo "wrote $OUT"
