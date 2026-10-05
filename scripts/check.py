#!/usr/bin/env python3
"""Retention check for a noor-reel timeline, BEFORE rendering.

    check.py src/talk/Reel.tsx src/talk/reel-segments.json [--style heavy|calm] [--max-still S]

A viewer needs a visual change every ~2-3 s or they scroll. This lists
every change the edit makes (cuts between pieces, zoom snaps, push-ins,
overlays, emojis, sound hits), maps them to EDIT seconds, and flags:
  - any stretch longer than --max-still with nothing changing
  - no hook headline at frame 0
  - nothing happening in the first 1.5 s besides the hook
  - total length outside 15-90 s
--style calm (the trust look: snaps only at cuts, no emojis or hits) allows
5 s still stretches instead of 3. Notes (do not fail): the hook headline and
the first spoken words share no word (the three-layer hook), an end card
longer than 1.5 s (end on the payoff), no send/follow/comment line on the end card.
Exit code 1 when something is flagged, so it can gate the render.

It reads beat times from the Reel.tsx source with simple patterns, so
write beats the way the template does: from={12.3}, E(12.3), at: 12.3.
"""
import argparse
import json
import re
import sys

ap = argparse.ArgumentParser()
ap.add_argument("reel")
ap.add_argument("segments")
ap.add_argument("--style", choices=["heavy", "calm"], default="heavy")
ap.add_argument("--max-still", type=float, default=None)
a = ap.parse_args()
if a.max_still is None:
    a.max_still = 5.0 if a.style == "calm" else 3.0

src = open(a.reel).read()
spec = json.load(open(a.segments))
fps = spec.get("fps", 30)
segs = spec["segments"]
if "frames" not in segs[0]:
    sys.exit("run cut.py first (segments have no frame counts)")


def edit(t):
    off = 0
    for s in segs:
        if s["a"] - 1e-6 <= t <= s["b"] + 1e-6:
            return (off + round((t - s["a"]) * fps)) / fps
        off += s["frames"]
    off = 0
    prev = None
    for s in segs:  # in a small removed pause: the template moves it to the next piece
        if s["a"] > t:
            if prev is not None and s["a"] - prev["b"] <= 1.2 and t > prev["b"]:
                return off / fps
            return None  # not in this cut (a short version): the template switches it off
        off += s["frames"]
        prev = s
    return None


speech = sum(s["frames"] for s in segs) / fps
total = speech + spec.get("outro", 0)
events = []
off = 0
for i, s in enumerate(segs):
    events.append((off / fps, "cut" if i else "start"))
    off += s["frames"]
# the template's automatic snaps: at every cut (>= 0.7 s apart) and on the
# next word start once 2.4 s pass inside a piece (same rule as Reel.noor.tsx)
import os
wpath = os.path.join(os.path.dirname(a.segments), "reel-words.json")
if os.path.exists(wpath) and "MID_SNAP" in src and a.style == "heavy":
    words = json.load(open(wpath))
    last = -999
    off = 0
    for s in segs:
        if off - last >= 0.7 * fps:
            last = off
        for w in words:
            wf = round(w["start"] * fps)
            if wf <= off or wf >= off + s["frames"] - 0.6 * fps:
                continue
            if wf - last >= 2.4 * fps:
                events.append((wf / fps, "snap"))
                last = wf
        off += s["frames"]
# SNAPS inside takes are written as [t, z] pairs; overlays as from={t};
# sfx and helpers as E(t); pushes as at: t
code = re.sub(r"//.*", "", src)
code = re.sub(r"\{/\*.*?\*/\}", "", code, flags=re.S)
pats = [(r"from=\{([\d.]+)\}", "overlay"), (r"\bE\(([\d.]+)\)", "hit"), (r"\{\s*at:\s*([\d.]+),\s*z:", "push"), (r"\[\s*([\d.]+)\s*,\s*1\.\d+\s*\]", "snap")]
if a.style == "calm":  # the calm style drops emojis and sound hits (except <Hit ... keep />)
    code = re.sub(r"<Emoji\b[^>]*/>", "", code)
    pats.append((r"<Hit\s+t=\{([\d.]+)\}[^>]*\bkeep\b", "hit"))
else:
    pats.append((r"<Hit\s+t=\{([\d.]+)\}", "hit"))
bad = []
skipped = []
for pat, kind in pats:
    for m in re.finditer(pat, code):
        t = float(m.group(1))
        e = edit(t)
        if e is None:
            skipped.append(t)
        else:
            events.append((e, kind))
events.sort()

flags = []
if "<HookTitle" not in code:
    flags.append("no <HookTitle> hook headline: the first frame is also the cover")
early = [k for t, k in events if 0.05 < t <= 1.5 and k not in ("start",)]
if not early:
    flags.append("nothing changes in the first 1.5 s besides the hook")
times = [t for t, _ in events] + [speech]
gaps = []
for t0, t1 in zip(times, times[1:]):
    if t1 - t0 > a.max_still:
        gaps.append((t0, t1))
for t0, t1 in gaps:
    flags.append(f"still for {t1 - t0:.1f}s at edit {t0:.1f}-{t1:.1f}s: add a snap, emoji, card or cutaway")
if total < 15 or total > 90:
    flags.append(f"length {total:.1f}s: aim for 30-45 s for one idea, 60-90 s for a story (long form goes to YouTube)")
flags += bad

# ---- strategy notes (advice, never fail the render) ----
notes = []
hm = re.search(r'HOOK(?:_A)?\s*=\s*\{\s*text:\s*"([^"]*)"', code)
rp = os.path.join(os.path.dirname(a.segments), "reel-words.roman.json")
wp = rp if os.path.exists(rp) else wpath
if hm and os.path.exists(wp):
    first = [w["word"] for w in json.load(open(wp, encoding="utf-8"))[:10]]
    norm = lambda x: re.sub(r"[^\w]", "", x.lower())
    hook_words = {norm(w) for w in hm.group(1).split() if len(norm(w)) > 2}
    spoken = {norm(w) for w in first}
    if hook_words and not hook_words & spoken:
        notes.append(f'hook "{hm.group(1)}" shares no word with the first spoken words ("{" ".join(first)}"): '
                     "see, read and hear should say the same thing in the first 1-2 s")
if spec.get("outro", 0) > 1.5:
    notes.append(f"end card {spec['outro']}s: end on the payoff; 1-1.5 s (or 0) gets more rewatches")
om = re.search(r"cta:\s*\"([^\"]*)\"", code)
if spec.get("outro", 0) > 0 and om and not re.search(r"send|bhej|follow|comment|checkup", om.group(1), re.I):
    notes.append(f'end card cta "{om.group(1)}": use ONE action (send line, follow with a reason, or Comment CHECKUP)')

# ---- his face is the asset: a cutaway that hides it stays short ----
for m3 in re.finditer(r"<At\s+from=\{([\d.]+)\}\s+to=\{([\d.]+)\}[^>]*>\s*<Cutaway\b[^>]*?mode=\"(top|full)\"", code):
    a0, a1 = float(m3.group(1)), float(m3.group(2))
    if a1 - a0 > 2.5:
        notes.append(f'cutaway at {a0}s hides the face for {a1 - a0:.1f}s: use mode="card" (face stays visible) or keep it to 1.5-2.5 s')

# ---- street videos (street.py wrote src/talk/scene.json and face.json) ----
tdir = os.path.dirname(a.segments)
scene = json.load(open(os.path.join(tdir, "scene.json"))) if os.path.exists(os.path.join(tdir, "scene.json")) else {}
sm = re.search(r'const SCENE[^=]*=\s*"(\w+)"', code)
tpl_scene = sm.group(1) if sm else "studio"
if scene.get("scene") == "street" and tpl_scene != "street":
    notes.append('street.py says this is a street video: set SCENE = "street" in Reel.tsx')
if tpl_scene == "street" and re.search(r"BACKDROPS[^=]*=\s*\[\s*\{", code):
    notes.append("BACKDROPS in a street video: a still picture behind a walking speaker looks fake; use BEHIND text or a Cutaway")
fpath = os.path.join(tdir, "face.json")
if os.path.exists(fpath):
    fj = json.load(open(fpath))
    pts = [(f, s) for f, s in zip(fj["frames"], fj["speaker"]) if s]
    cm = lambda n, d: float(x.group(1)) if (x := re.search(rf"const {n}\s*=\s*([\d.]+)", code)) else d
    rx, ry, rs = cm("RX", 800), cm("RY", 690), cm("RS", 250)
    for m2 in re.finditer(r"<Emoji\s+from=\{([\d.]+)\}\s+to=\{([\d.]+)\}", code):
        t0, t1 = float(m2.group(1)), float(m2.group(2))
        for f, (cx, cy, w, h) in pts:
            if t0 * fps <= f <= t1 * fps and cx + w / 2 > rx and cx - w / 2 < rx + rs and cy + h / 2 > ry and cy - h / 2 < ry + rs:
                notes.append(f"emoji at {t0}s covers the face (he moved into the reaction slot at {f / fps:.1f}s): move it (RX/RY) or pick another moment")
                break

kinds = {}
for _, k in events:
    kinds[k] = kinds.get(k, 0) + 1
print(f"length {total:.1f}s ({speech:.1f}s speech), {len(events)} visual changes: " + ", ".join(f"{v} {k}" for k, v in sorted(kinds.items())))
if skipped:
    print(f"{len(skipped)} beat(s) not in this cut, switched off: " + ", ".join(f"{t}s" for t in sorted(set(skipped))))
print(f"average change every {speech / max(1, len(events)):.1f}s  (style {a.style})")
for n in notes:
    print("note:", n)
if flags:
    print("\nFLAGS:")
    for f in flags:
        print(" -", f)
    sys.exit(1)
print("OK: something changes at least every %.1fs" % a.max_still)
