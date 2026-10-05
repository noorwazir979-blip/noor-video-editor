#!/usr/bin/env bash
# Memory-safe render for small machines (8 GB laptops, WSL with 4-8 GB).
# Picks the number of parallel browser tabs from the RAM that is FREE right
# now (~0.9 GB per tab plus 1.5 GB headroom), caps the video frame cache,
# runs detached (setsid, survives the calling shell / wsl.exe), and logs.
# Same quality as a full-speed render, just fewer frames at once.
#
#   render-lite.sh [CompositionId=TalkReel] [out=out/talk-reel.mp4] [extra remotion args...]
#   e.g. render-lite.sh TalkReel out/sample.mp4 --frames=0-299
#
# Progress: tr '\r' '\n' < out/reel/render.log | grep Rendered | tail -1
set -euo pipefail
comp="${1:-TalkReel}"; out="${2:-out/talk-reel.mp4}"; shift $(( $# > 2 ? 2 : $# )) || true
mkdir -p out/reel "$(dirname "$out")"
free_gb=$(awk '/MemAvailable/ {printf "%.1f", $2/1024/1024}' /proc/meminfo)
cores=$(nproc)
conc=$(awk -v f="$free_gb" -v c="$cores" 'BEGIN { n=int((f-1.5)/0.9); m=int(c/2); if (n>m) n=m; if (n<1) n=1; print n }')
cache=$(awk -v f="$free_gb" 'BEGIN { m=int(f*1024*1024*1024*0.15); if (m>1073741824) m=1073741824; if (m<268435456) m=268435456; print m }')
if pgrep -f "[r]emotion render" >/dev/null; then echo "a render is already running"; exit 1; fi
echo "free RAM ${free_gb} GB -> ${conc} tab(s), frame cache $((cache/1024/1024)) MB"
setsid nohup npx remotion render src/index.ts "$comp" "$out" --codec h264 --crf 18 \
  --concurrency "$conc" --offthreadvideo-cache-size-in-bytes "$cache" --log=error "$@" \
  > out/reel/render.log 2>&1 < /dev/null &
disown
sleep 20
tr '\r' '\n' < out/reel/render.log | grep -E "Rendered|rror" | tail -1 || true
echo "rendering -> $out (log out/reel/render.log)"
