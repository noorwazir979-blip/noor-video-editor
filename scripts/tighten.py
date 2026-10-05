#!/usr/bin/env python3
"""Cut the pauses INSIDE the chosen takes, so the reel moves at a jump-cut
pace (top short-form creators cut every pause over ~0.3 s).

    tighten.py src/talk/reel-segments.json public/talk/voice-clean.wav \
        [--max-gap 0.3] [--pad-in 0.08] [--pad-out 0.14] [--min-piece 0.35] \
        [--keep 12.4-14.0]... [--street] [--dry]

Reads the hand-chosen takes (original seconds), finds speech with Silero
VAD (a neural speech detector, robust to traffic/AC noise where an ffmpeg
dB threshold fails), and splits every take at each pause longer than
--max-gap. Each piece keeps --pad-in before the speech and --pad-out after
it so no syllable is clipped. A pause you want to keep for drama (a beat
before a punchline) goes in --keep as an original-seconds range.

Writes the split takes back to the same file (the hand version is saved as
reel-segments.hand.json the first time) and prints what was removed. Run
cut.py afterwards as usual; every new cut gets a zoom snap automatically
in the noor-reel Reel template.
"""
import argparse
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lite import read_audio_16k, speech_spans  # noqa: E402  (ONNX Silero, no PyTorch)

ap = argparse.ArgumentParser()
ap.add_argument("segments")
ap.add_argument("wav")
ap.add_argument("--max-gap", type=float, default=0.3)
ap.add_argument("--pad-in", type=float, default=0.08)
ap.add_argument("--pad-out", type=float, default=0.14)
ap.add_argument("--min-piece", type=float, default=0.35)
ap.add_argument("--keep", action="append", default=[])
ap.add_argument("--dry", action="store_true")
ap.add_argument("--street", action="store_true", help="outdoor/walking: stricter speech detector, and speech much quieter than the speaker (people passing, a radio) counts as a pause")
a = ap.parse_args()

hand = a.segments.replace(".json", ".hand.json")
if not os.path.exists(hand):
    shutil.copy(a.segments, hand)
spec = json.load(open(hand))

wav = read_audio_16k(a.wav)
speech = speech_spans(wav, threshold=0.6 if a.street else 0.45, min_silence=a.max_gap)
if a.street and speech:
    # the speaker holds the phone: his voice is the loudest. Other voices are far quieter.
    import numpy as np

    lvl = [10 * np.log10(float(np.mean(wav[int(s * 16000) : int(e * 16000)] ** 2)) + 1e-12) for s, e in speech]
    ref = float(np.percentile(lvl, 75))
    quiet = [sp for sp, l in zip(speech, lvl) if l < ref - 14]
    speech = [sp for sp, l in zip(speech, lvl) if l >= ref - 14]
    if quiet:
        print(f"street: {len(quiet)} quiet voice stretch(es) treated as background: " + ", ".join(f"{s:.1f}-{e:.1f}s" for s, e in quiet))
keeps = [tuple(map(float, k.split("-"))) for k in a.keep]

out = []
removed = 0.0
for seg in spec["segments"]:
    A, B = seg["a"], seg["b"]
    # speech islands inside this take, padded and clipped to the take
    isl = [(max(A, s - a.pad_in), min(B, e + a.pad_out)) for s, e in speech if e > A and s < B]
    if not isl:
        out.append({k: seg[k] for k in ("a", "b", "note") if k in seg})
        continue
    # merge islands whose gap is short, or that a --keep range bridges
    merged = [list(isl[0])]
    for s, e in isl[1:]:
        gap = s - merged[-1][1]
        bridged = any(k0 <= merged[-1][1] + 0.05 and k1 >= s - 0.05 for k0, k1 in keeps)
        if gap <= 0.12 or bridged:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    # first piece starts at the hand start, last ends at the hand end
    merged[0][0] = A
    merged[-1][1] = B
    # drop slivers by gluing them to a neighbour
    pieces = []
    for p in merged:
        if pieces and (p[1] - p[0] < a.min_piece or pieces[-1][1] - pieces[-1][0] < a.min_piece):
            pieces[-1][1] = p[1]
        else:
            pieces.append(p)
    for i, (s, e) in enumerate(pieces):
        d = {"a": round(s, 2), "b": round(e, 2)}
        if i == 0 and "note" in seg:
            d["note"] = seg["note"]
        out.append(d)
    kept = sum(e - s for s, e in pieces)
    removed += (B - A) - kept
    print(f"take {A:7.2f}-{B:7.2f}: {len(pieces)} piece(s), removed {(B - A) - kept:4.2f}s of pause")

total_before = sum(s["b"] - s["a"] for s in spec["segments"])
print(f"\n{len(spec['segments'])} takes -> {len(out)} pieces; speech {total_before:.1f}s -> {total_before - removed:.1f}s (removed {removed:.1f}s)")
if not a.dry:
    spec["segments"] = out
    for k in ("totalFrames",):
        spec.pop(k, None)
    json.dump(spec, open(a.segments, "w"), ensure_ascii=False, indent=2)
    print(f"written {a.segments} (hand cut kept in {hand})")
