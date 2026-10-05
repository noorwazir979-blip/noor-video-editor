#!/usr/bin/env bash
# Render A/B versions of ONE finished reel project for Instagram Trial Reels
# (strategy: test the edit style, the hook and the second caption line instead
# of guessing). Each variant is a Remotion --props switch read by Reel.tsx, so
# nothing is copied and nothing is re-transcribed.
#
#   variants.sh [variant ...]          (run from the project root)
#   variant = <style>-<hook>[-<line>]  style heavy|calm, hook A|B, line english|arabic|none
#   default: heavy-A calm-A            (the edit-style test)
#   e.g.     variants.sh heavy-A heavy-B         hook test (needs HOOK_B in Reel.tsx)
#            variants.sh calm-A-arabic           a UAE-owner version with an Arabic line
#
# Writes out/talk-reel-<variant>.mp4, one after another (RAM-aware like
# render-lite.sh), detached: it survives wsl.exe exiting. Log: out/reel/variants.log
# Progress: tr '\r' '\n' < out/reel/variants.log | grep -E "^==|Rendered" | tail -3
set -euo pipefail
S="$(cd "$(dirname "$0")/.." && pwd)"
vs=("$@"); [ ${#vs[@]} -eq 0 ] && vs=(heavy-A calm-A)
for v in "${vs[@]}"; do
  IFS=- read -r style hook line <<<"$v"
  case "$style" in heavy|calm) ;; *) echo "bad style in $v (heavy|calm)"; exit 1;; esac
  case "$hook" in A|B) ;; *) echo "bad hook in $v (A|B)"; exit 1;; esac
  case "${line:-english}" in english|arabic|none) ;; *) echo "bad line in $v"; exit 1;; esac
  if [ "$hook" = B ] && grep -qE "HOOK_B: typeof HOOK_A \| null = null" src/talk/Reel.tsx; then
    echo "$v needs HOOK_B in src/talk/Reel.tsx"; exit 1
  fi
  if [ "${line:-}" = arabic ] && [ "$(tr -d '[:space:]' < src/talk/reel-lines.ar.json)" = "[]" ]; then
    echo "$v needs Arabic lines: subs.py ... --arabic arabic.json"; exit 1
  fi
  echo "== check $v"; python3 "$S/scripts/check.py" src/talk/Reel.tsx src/talk/reel-segments.json --style "$style" | tail -4 || true
done
if pgrep -f "[r]emotion render" >/dev/null; then echo "a render is already running"; exit 1; fi
mkdir -p out/reel
free_gb=$(awk '/MemAvailable/ {printf "%.1f", $2/1024/1024}' /proc/meminfo)
conc=$(awk -v f="$free_gb" -v c="$(nproc)" 'BEGIN { n=int((f-1.5)/0.9); m=int(c/2); if (n>m) n=m; if (n<1) n=1; print n }')
cache=$(awk -v f="$free_gb" 'BEGIN { m=int(f*1024*1024*1024*0.15); if (m>1073741824) m=1073741824; if (m<268435456) m=268435456; print m }')
echo "free RAM ${free_gb} GB -> ${conc} tab(s); rendering ${vs[*]}"
job=""
for v in "${vs[@]}"; do
  IFS=- read -r style hook line <<<"$v"
  props="{\"style\":\"$style\",\"hook\":\"$hook\",\"line\":\"${line:-english}\"}"
  job+="echo '== $v'; npx remotion render src/index.ts TalkReel out/talk-reel-$v.mp4 --codec h264 --crf 18 --concurrency $conc --offthreadvideo-cache-size-in-bytes $cache --props='$props' --log=error; "
done
setsid nohup bash -c "$job echo '== all done'" > out/reel/variants.log 2>&1 < /dev/null &
disown
echo "rendering in the background -> out/talk-reel-<variant>.mp4 (log out/reel/variants.log)"
echo "Post each as an Instagram Trial Reel (non-followers only), compare after 24-48 h, then log both with log.py."
