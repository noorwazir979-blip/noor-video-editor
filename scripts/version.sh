#!/usr/bin/env bash
# Make another version of a finished reel from the SAME recording, e.g. a
# 20-30 s "reach" cut next to the full one. Everything heavy is shared
# (node_modules, public/ with the cleaned video, fg.webm, sounds), so a
# version costs only its own render.
#
#   version.sh <project_dir> <name> <hand-segments.json>
#
# <hand-segments.json>: the takes for this version in ORIGINAL seconds,
# same format as reel-segments.json ({"fps":30,"outro":2.5,"segments":[{a,b,note}]}),
# usually the hook + the strongest 2-4 sentences of the full version.
# Creates <project_dir>-<name>/, runs tighten -> cut -> subtitles from the
# full version's master -> check. The Reel.tsx is copied: beats whose time is
# not in this cut switch themselves off (E() returns OFF), so normally only
# HOOK/OUTRO need a look. Then render it like any project.
set -euo pipefail
src="$(realpath "$1")"; name="$2"; segs="$(realpath "$3")"
S="$(cd "$(dirname "$0")/.." && pwd)"
dst="${src}-${name}"
mkdir -p "$dst/src/talk" "$dst/scratch" "$dst/out/reel"
for f in package.json tsconfig.json remotion.config.ts; do [ -f "$src/$f" ] && cp "$src/$f" "$dst/"; done
ln -sfn "$src/node_modules" "$dst/node_modules"
ln -sfn "$src/public" "$dst/public"
cp -r "$src/src/." "$dst/src/"
cp "$segs" "$dst/src/talk/reel-segments.json"
rm -f "$dst/src/talk/reel-segments.hand.json"
cd "$dst"
"$S/scripts/lpy" "$S/scripts/tighten.py" src/talk/reel-segments.json public/talk/voice-clean.wav
fixed="$src/scratch/words_fixed.whisper.json"; [ -f "$fixed" ] || fixed="$src/scratch/words_all.whisper.json"
python3 "$S/scripts/cut.py" "$fixed" src/talk/reel-segments.json --words-out src/talk/reel-words.json | grep -E "segments,|words ->"
if [ -f "$src/src/talk/reel-subs.master.json" ]; then
  python3 "$S/scripts/subs.py" src/talk/reel-words.json --from-master "$src/src/talk/reel-subs.master.json"
fi
python3 "$S/scripts/check.py" src/talk/Reel.tsx src/talk/reel-segments.json || true
echo "version ready: $dst  (check HOOK.until is inside the first take, then render)"
