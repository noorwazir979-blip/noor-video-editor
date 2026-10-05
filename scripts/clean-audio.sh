#!/usr/bin/env bash
# Clean the voice in the prepped reel source: AI noise removal
# (DeepFilterNet3), a gentle voice EQ, then loudness to -16 LUFS, and swap
# the cleaned track into public/talk/ig1080.mp4 (video stream copied).
# Run from the Remotion project root, AFTER prep.sh and BEFORE transcribe.py
# (whisper hears the clean track better).
#
#   clean-audio.sh [public/talk/ig1080.mp4] [strength_db=30 | street]
#
# Keeps the original as public/talk/ig1080.raw.mp4 so it can be undone.
# strength_db caps how much noise is removed (deep-filter -a):
# 30 keeps a little room tone so the voice does not sound "underwater";
# 100 removes everything (loud traffic, AC). "street" = 60 plus a higher
# rumble cut (110 Hz: wind on the mic, engines) for outdoor/walking videos.
set -euo pipefail
src="${1:-public/talk/ig1080.mp4}"
lim="${2:-30}"
hp=80
if [ "$lim" = street ]; then lim=60; hp=110; fi
T="${REEL_LITE:-$HOME/.local/share/reel-lite}/bin"
work=$(mktemp -d /tmp/clean-XXXX)
raw="${src%.mp4}.raw.mp4"
[ -f "$raw" ] || cp "$src" "$raw"

ffmpeg -y -loglevel error -i "$raw" -vn -ac 1 -ar 48000 "$work/voice.wav"
"$T/deep-filter" -D -a "$lim" -o "$work/out" "$work/voice.wav" >/dev/null 2>&1
clean="$work/out/voice.wav"
# voice EQ: cut rumble below 80 Hz, a little presence at 3 kHz, tame harsh
# 7 kHz, then two-pass-free loudness normalisation to -16 LUFS
ffmpeg -y -loglevel error -i "$clean" \
  -af "highpass=f=$hp,equalizer=f=3000:t=q:w=1.2:g=2.5,equalizer=f=7000:t=q:w=2:g=-1.5,acompressor=threshold=-20dB:ratio=3:attack=8:release=120,loudnorm=I=-16:TP=-1.5:LRA=9" \
  -ar 48000 "$work/final.wav"
ffmpeg -y -loglevel error -i "$raw" -i "$work/final.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "$src"
cp "$work/final.wav" "$(dirname "$src")/voice-clean.wav"
before=$(ffmpeg -hide_banner -nostats -i "$raw" -af ebur128 -f null - 2>&1 | grep " I:" | tail -1 | awk '{print $2}')
after=$(ffmpeg -hide_banner -nostats -i "$src" -af ebur128 -f null - 2>&1 | grep " I:" | tail -1 | awk '{print $2}')
rm -rf "$work"
echo "voice cleaned: $src (loudness $before -> $after LUFS; original kept at $raw)"
