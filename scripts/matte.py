#!/usr/bin/env python3
"""Cut the speaker out of the background: writes public/talk/fg.webm, the
same timeline as public/talk/ig1080.mp4 but with a transparent background
(VP9 with alpha). The Reel template uses it for TEXT BEHIND THE HEAD and
BACKGROUND SWAPS (speaker in front of a website, a headline, a skyline).

    lpy matte.py [--method ai|green] [--ranges "17.5-21,60.2-63"] [--from 0 --to END]
                 [--src public/talk/ig1080.mp4] [--out public/talk/fg.webm]

--method ai     Robust Video Matting (ONNX, 15 MB, no PyTorch, no green
                cloth). Recurrent, so edges stay steady over time; good on
                hair. Runs on a half-size copy (540x960) and the alpha is
                scaled back up by ffmpeg, which is ~4x faster than full size
                with no visible loss once the edge is feathered.
--method green  chroma key for a green cloth/backdrop: cleanest edges, takes
                seconds. --similarity 0.10-0.25 if the cloth is unevenly lit.
--from/--to     only this range (ORIGINAL seconds); transparent padding keeps
                the timeline matched. Use it: only matte the moments that
                need it (text behind head, background swap).

Memory: one frame at a time through ffmpeg pipes (~300 MB total).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ap = argparse.ArgumentParser()
ap.add_argument("--method", default="ai", choices=["ai", "green"])
ap.add_argument("--src", default="public/talk/ig1080.mp4")
ap.add_argument("--out", default="public/talk/fg.webm", help="base name: files become fg_<frame>.webm")
ap.add_argument("--manifest", default="src/talk/fg.json")
ap.add_argument("--from", dest="t0", type=float, default=None)
ap.add_argument("--to", dest="t1", type=float, default=None)
ap.add_argument("--ranges", default=None, help='several moments at once: "17.5-21,60.2-63" (ORIGINAL seconds)')
ap.add_argument("--similarity", type=float, default=0.16)
ap.add_argument("--work-scale", type=float, default=0.5, help="size the AI sees (0.5 = 540x960)")
ap.add_argument("--speaker-only", choices=["auto", "on", "off"], default="auto",
                help="keep only the speaker (street.py face track): people walking behind are not cut out with him; auto = on for street videos")
a = ap.parse_args()

probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", a.src], capture_output=True, text=True).stdout)
st = probe["streams"][0]
W, H = st["width"], st["height"]
num, den = map(int, st["r_frame_rate"].split("/"))
fps = num / den
DUR = float(probe["format"]["duration"])
vp9 = ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "4M", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1"]

if a.ranges:
    ranges = [tuple(float(x) for x in r.split("-")) for r in a.ranges.split(",")]
else:
    ranges = [(a.t0 or 0.0, a.t1 if a.t1 is not None else DUR)]
# snap to the frame grid so the cut-out lines up with the video exactly
ranges = sorted((round(r0 * fps), round(r1 * fps)) for r0, r1 in ranges)

# street videos: a column around the speaker's face (src/talk/face.json from street.py)
FACE = None
scene = json.load(open("src/talk/scene.json")) if os.path.exists("src/talk/scene.json") else {}
if a.speaker_only == "on" or (a.speaker_only == "auto" and scene.get("scene") == "street"):
    if os.path.exists("src/talk/face.json"):
        fj = json.load(open("src/talk/face.json"))
        pts = [(f, s) for f, s in zip(fj["frames"], fj["speaker"]) if s]
        if pts:
            FACE = (np.array([p[0] for p in pts]), np.array([p[1][0] for p in pts]), np.array([p[1][2] for p in pts]))
            print("speaker-only cut-out (people behind him stay in the background)", file=sys.stderr)
    else:
        print("speaker-only: no src/talk/face.json, run street.py first", file=sys.stderr)


def speaker_mask(frame, w, h):
    fr, xs, ws = FACE
    cx = np.interp(frame, fr, xs) * w / W
    fw = np.interp(frame, fr, ws) * w / W
    d = np.abs(np.arange(w) - cx) / max(1.0, 2.2 * fw)  # shoulders ~2x the face width each side
    return np.clip((1.0 - d) / 0.15, 0, 1)[None, :].astype(np.float32)


def _unused_pad(n_frames, out):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black@0.0:s={W}x{H}:r={fps},format=yuva420p", "-frames:v", str(n_frames), *vp9[:-4], out], check=True)


def matte(f0, f1, out):
    t0, n = f0 / fps, f1 - f0
    if a.method == "green":
        vf = f"chromakey=0x00FF00:{a.similarity}:0.08,despill=green,format=yuva420p"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t0}", "-i", a.src, "-frames:v", str(n), "-vf", vf, "-an", *vp9, out], check=True)
        return
    from lite import session

    net = session("rvm_mobilenetv3_fp32.onnx")
    w, h = int(W * a.work_scale) // 2 * 2, int(H * a.work_scale) // 2 * 2
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{t0}", "-i", a.src, "-frames:v", str(n), "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    # ffmpeg merges the FULL-size original with the upscaled alpha
    enc = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-ss", f"{t0}", "-i", a.src,
         "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{w}x{h}", "-r", f"{fps}", "-i", "-",
         "-filter_complex", f"[1]scale={W}:{H}:flags=bicubic,gblur=sigma=1.2[al];[0][al]alphamerge,format=yuva420p",
         "-frames:v", str(n), "-an", *vp9, out],
        stdin=subprocess.PIPE,
    )
    rec = [np.zeros((1, 1, 1, 1), dtype=np.float32)] * 4
    ratio = np.array([min(1.0, 512 / max(w, h))], dtype=np.float32)  # RVM sees ~512 px on the long side
    k = 0
    fsize = w * h * 3
    while True:
        buf = dec.stdout.read(fsize)
        if len(buf) < fsize:
            break
        src = np.frombuffer(buf, dtype=np.uint8).reshape(h, w, 3).transpose(2, 0, 1)[None].astype(np.float32) / 255.0
        _fgr, pha, *rec = net.run(None, {"src": src, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": ratio})
        m = np.clip((pha[0, 0] - 0.06) / 0.88, 0, 1)
        if FACE is not None:
            m = m * speaker_mask(f0 + k, w, h)
        enc.stdin.write((m * 255).astype(np.uint8).tobytes())
        k += 1
        if k % 150 == 0:
            print(f"  {t0 + k / fps:.1f}s", file=sys.stderr)
    enc.stdin.close()
    enc.wait()
    dec.wait()


# one small file per moment + a manifest the Reel template imports (src/talk/fg.json);
# no transparent filler for the rest of the video, so cost = only the moments used
os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
man = []
base = os.path.splitext(a.out)[0]
for f0, f1 in ranges:
    out = f"{base}_{f0}.webm"
    matte(f0, f1, out)
    rel = os.path.relpath(out, "public")
    man.append({"f0": f0, "f1": f1, "src": rel})
    print(f"  cut-out {f0 / fps:.2f}-{f1 / fps:.2f}s -> {out}", file=sys.stderr)
os.makedirs(os.path.dirname(a.manifest), exist_ok=True)
json.dump(man, open(a.manifest, "w"), indent=1)
print(f"matte ({a.method}) {len(man)} moment(s) -> {a.manifest}")
