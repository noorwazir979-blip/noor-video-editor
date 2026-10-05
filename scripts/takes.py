#!/usr/bin/env python3
"""Screenshots of the takes Claude threw away, for the "best take" reveal.

Reads the kept pieces (reel-segments.json) and grabs one frame from the middle
of every part of the ORIGINAL recording that was left out (retakes, wrong
starts, long silences), so the reel can show them as real screenshots next to
the take it kept.

  lpy S/scripts/takes.py                     # all rejected parts >= 1.2 s
  lpy S/scripts/takes.py --max 5 --min-gap 1.5

Writes public/takes/bad_<n>.jpg (540x960, or 960x540 for a widescreen video) and src/talk/takes.json:
  {"shots": [{"src": "takes/bad_1.jpg", "t": 17.4, "len": 1.5}, ...]}
Longest rejected parts first (those are the real retakes), then put back in
recording order so "TAKE 1, 2, 3" reads naturally.
"""
import argparse
import json
import os
import subprocess

ap = argparse.ArgumentParser()
ap.add_argument("--segments", default="src/talk/reel-segments.json")
ap.add_argument("--src", default="public/talk/ig1080.mp4")
ap.add_argument("--out", default="src/talk/takes.json")
ap.add_argument("--min-gap", type=float, default=1.2, help="ignore left-out parts shorter than this (s)")
ap.add_argument("--max", type=int, default=5)
a = ap.parse_args()

segs = json.load(open(a.segments))["segments"]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.src], capture_output=True, text=True).stdout.strip())
kept = sorted((s["a"], s["b"]) for s in segs)
gaps = []
prev = 0.0
for s0, s1 in kept + [(dur, dur)]:
    if s0 - prev >= a.min_gap:
        gaps.append((prev, s0))
    prev = max(prev, s1)
# a long gap holds several retakes: one shot per ~4 s of it (max 3)
cands = []
for g0, g1 in gaps:
    n = min(3, max(1, int((g1 - g0) // 4)))
    for k in range(n):
        t = g0 + (g1 - g0) * (k + 0.5) / n
        cands.append((t, (g1 - g0) / n))
cands = sorted(sorted(cands, key=lambda c: -c[1])[: a.max])
os.makedirs("public/takes", exist_ok=True)
shots = []
for i, (t, ln) in enumerate(cands, 1):
    p = f"public/takes/bad_{i}.jpg"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", a.src, "-frames:v", "1", "-vf", "scale='if(gt(iw,ih),960,540)':'if(gt(iw,ih),540,960)'", "-q:v", "3", p], check=True)
    shots.append({"src": f"takes/bad_{i}.jpg", "t": round(t, 2), "len": round(ln, 2)})
json.dump({"shots": shots}, open(a.out, "w"), indent=1)
print(f"{len(gaps)} left-out parts; {len(shots)} screenshots -> public/takes/, {a.out}")
for s in shots:
    print(f"  {s['src']}  at {s['t']:.1f} s (part of {s['len']:.1f} s)")
