#!/usr/bin/env python3
"""Hand tracking for Iron Man mode (light toolset: onnxruntime + numpy + ffmpeg).

Finds the speaker's hand in the reel source and writes src/talk/hands.json, so
Remotion can pin holograms to the open palm or draw a beam from a pointing
finger. Models: MediaPipe palm detector + hand landmarks as ONNX (OpenCV Zoo,
~8 MB together, downloaded by setup-lite.sh). No PyTorch, OpenCV or MediaPipe.

  lpy S/scripts/hand.py --ranges "1.6-33.4"           # ORIGINAL seconds
  lpy S/scripts/hand.py --ranges "1.6-33.4" --sheet   # + contact sheet out/reel/hands.png

Output (all positions in 1080x1920 px of public/talk/ig1080.mp4):
  {"fps":30, "step":2, "frames":[orig frame...],
   "hands":[null | {"palm":[x,y], "tip":[x,y], "size":px, "g":"open|point|pinch|fist|other",
                    "score":0-1, "lm":[[x,y]*21]}]}
Remotion interpolates between samples (iron.tsx useHand).
"""
import argparse
import json
import math
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lite import session  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--src", default="public/talk/ig1080.mp4")
ap.add_argument("--ranges", required=True, help='ORIGINAL seconds, e.g. "1.6-33.4,40-52"')
ap.add_argument("--step", type=int, default=2, help="analyse every Nth frame (2 = 15 per second)")
ap.add_argument("--out", default="src/talk/hands.json")
ap.add_argument("--min-score", type=float, default=0.55)
ap.add_argument("--sheet", action="store_true")
a = ap.parse_args()

W, H, FPS = 1080, 1920, 30
DW, DH = 540, 960  # decode at half size; landmarks are mapped back x2
K = W / DW

palm = session("palm_detection_mediapipe_2023feb.onnx")
pose = session("handpose_estimation_mediapipe_2023feb.onnx")


# ---- palm detector anchors (MediaPipe SSD, 192 px, strides 8,16,16,16) ----
def make_anchors():
    out = []
    for stride, per in ((8, 2), (16, 6)):
        n = 192 // stride
        for y in range(n):
            for x in range(n):
                for _ in range(per):
                    out.append(((x + 0.5) / n, (y + 0.5) / n))
    return np.array(out, dtype=np.float32)


ANCH = make_anchors()  # 2016 x 2
assert len(ANCH) == 2016


def detect_palms(img):
    """img: DH x DW x 3 uint8 RGB -> list of (score, box[cx,cy,w,h], kps 7x2) in img px."""
    side = max(DW, DH)
    pad = np.zeros((side, side, 3), np.uint8)
    ox, oy = (side - DW) // 2, (side - DH) // 2
    pad[oy : oy + DH, ox : ox + DW] = img
    small = resize(pad, 192, 192)
    x = (small.astype(np.float32) / 255.0)[None]
    reg, sc = palm.run(None, {"input_1": x})
    reg, sc = reg[0], sc[0, :, 0]
    score = 1 / (1 + np.exp(-np.clip(sc, -100, 100)))
    idx = np.where(score > a.min_score)[0]
    dets = []
    for i in idx:
        r = reg[i] / 192.0
        cx, cy = r[0] + ANCH[i, 0], r[1] + ANCH[i, 1]
        w, h = r[2], r[3]
        kps = r[4:18].reshape(7, 2) + ANCH[i]
        dets.append((float(score[i]), np.array([cx, cy, w, h]) * side, kps * side))
    # NMS
    dets.sort(key=lambda d: -d[0])
    keep = []
    for d in dets:
        if all(iou(d[1], k[1]) < 0.3 for k in keep):
            keep.append(d)
    return [(s, b - np.array([ox, oy, 0, 0]), k - np.array([ox, oy])) for s, b, k in keep]


def iou(a_, b_):
    ax0, ay0, ax1, ay1 = a_[0] - a_[2] / 2, a_[1] - a_[3] / 2, a_[0] + a_[2] / 2, a_[1] + a_[3] / 2
    bx0, by0, bx1, by1 = b_[0] - b_[2] / 2, b_[1] - b_[3] / 2, b_[0] + b_[2] / 2, b_[1] + b_[3] / 2
    iw, ih = max(0, min(ax1, bx1) - max(ax0, bx0)), max(0, min(ay1, by1) - max(ay0, by0))
    inter = iw * ih
    return inter / (a_[2] * a_[3] + b_[2] * b_[3] - inter + 1e-6)


def resize(img, w, h):
    """nearest-ish area resize with numpy (good enough for a 192 px detector input)."""
    ys = (np.arange(h) + 0.5) * img.shape[0] / h
    xs = (np.arange(w) + 0.5) * img.shape[1] / w
    return img[ys.astype(int).clip(0, img.shape[0] - 1)][:, xs.astype(int).clip(0, img.shape[1] - 1)]


def sample(img, cx, cy, size, rot, n=224):
    """rotated square crop (bilinear) -> n x n x 3 float, plus the mapping back."""
    c, s = math.cos(rot), math.sin(rot)
    u = (np.arange(n) + 0.5) / n - 0.5
    gx, gy = np.meshgrid(u * size, u * size)
    X = cx + gx * c - gy * s
    Y = cy + gx * s + gy * c
    x0, y0 = np.floor(X).astype(int), np.floor(Y).astype(int)
    fx, fy = (X - x0)[..., None], (Y - y0)[..., None]
    hh, ww = img.shape[:2]

    def px(yy, xx):
        ok = ((xx >= 0) & (xx < ww) & (yy >= 0) & (yy < hh))[..., None]
        return img[yy.clip(0, hh - 1), xx.clip(0, ww - 1)].astype(np.float32) * ok

    out = px(y0, x0) * (1 - fx) * (1 - fy) + px(y0, x0 + 1) * fx * (1 - fy) + px(y0 + 1, x0) * (1 - fx) * fy + px(y0 + 1, x0 + 1) * fx * fy

    def back(p):  # crop px (n) -> img px
        qx, qy = (p[:, 0] / n - 0.5) * size, (p[:, 1] / n - 0.5) * size
        return np.stack([cx + qx * c - qy * s, cy + qx * s + qy * c], 1)

    return out, back


def landmarks(img, det):
    """palm detection -> 21 landmarks in img px (MediaPipe palm->hand ROI rules)."""
    _, box, kps = det
    w0, m = kps[0], kps[2]  # wrist, middle-finger knuckle
    rot = math.pi / 2 - math.atan2(-(m[1] - w0[1]), m[0] - w0[0])
    rot = (rot + math.pi) % (2 * math.pi) - math.pi
    size = max(box[2], box[3])
    # shift the ROI towards the fingers by half a box, then enlarge 2.6x
    cx = box[0] + 0.5 * size * math.sin(rot)
    cy = box[1] - 0.5 * size * math.cos(rot)
    crop, back = sample(img, cx, cy, size * 2.6, rot)
    out = pose.run(None, {"input_1": (crop / 255.0)[None].astype(np.float32)})
    lm = out[0].reshape(21, 3)[:, :2]
    conf = float(np.ravel(out[1])[0])
    if conf > 1 or conf < 0:
        conf = 1 / (1 + math.exp(-conf))
    return back(lm), conf


def gesture(lm):
    """open / point / pinch / fist from finger extension (wrist distance tip vs pip)."""
    wr = lm[0]
    d = lambda i: np.linalg.norm(lm[i] - wr)
    palm_sz = np.linalg.norm(lm[9] - wr) + 1e-6
    ext = [d(t) > d(p) * 1.15 for t, p in ((8, 6), (12, 10), (16, 14), (20, 18))]
    pinch = np.linalg.norm(lm[4] - lm[8]) < 0.35 * palm_sz
    if pinch and not all(ext[1:]):
        return "pinch"
    if sum(ext) >= 4:
        return "open"
    if ext[0] and sum(ext[1:]) <= 1:
        return "point"
    if sum(ext) == 0:
        return "fist"
    return "other"


def frames_of(t0, t1):
    """yield (orig_frame, rgb DHxDW) for every `step`-th frame between t0 and t1 s."""
    f0 = int(round(t0 * FPS))
    n = int(round((t1 - t0) * FPS))
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{f0 / FPS:.3f}", "-i", a.src, "-frames:v", str(n),
           "-vf", f"scale={DW}:{DH}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    sz = DW * DH * 3
    for k in range(n):
        buf = p.stdout.read(sz)
        if len(buf) < sz:
            break
        if k % a.step == 0:
            yield f0 + k, np.frombuffer(buf, np.uint8).reshape(DH, DW, 3)
    p.stdout.close()
    p.wait()


def track(img, prev):
    """MediaPipe-style tracking: the next crop comes from the last landmarks,
    so a hand the palm detector misses (moving, half out of frame) is kept."""
    w0, m = prev[0], prev[9]
    rot = math.pi / 2 - math.atan2(-(m[1] - w0[1]), m[0] - w0[0])
    c, s = math.cos(rot), math.sin(rot)
    # landmark box in the hand's own rotated frame
    rel = prev - prev.mean(0)
    u = rel[:, 0] * c + rel[:, 1] * s
    v = -rel[:, 0] * s + rel[:, 1] * c
    size = max(u.max() - u.min(), v.max() - v.min())
    mu, mv = (u.max() + u.min()) / 2, (v.max() + v.min()) / 2 - 0.1 * size
    cx = prev.mean(0)[0] + mu * c - mv * s
    cy = prev.mean(0)[1] + mu * s + mv * c
    crop, back = sample(img, cx, cy, size * 2.0, rot)
    out = pose.run(None, {"input_1": (crop / 255.0)[None].astype(np.float32)})
    conf = float(np.ravel(out[1])[0])
    if conf > 1 or conf < 0:
        conf = 1 / (1 + math.exp(-conf))
    return back(out[0].reshape(21, 3)[:, :2]), conf


ranges = [tuple(float(x) for x in r.split("-")) for r in a.ranges.split(",")]
frames, hands, thumbs = [], [], []
for t0, t1 in ranges:
    prev = None
    for fr, img in frames_of(t0, t1):
        best = None
        if prev is not None:
            lm, conf = track(img, prev)
            if conf >= 0.6:
                best = (lm, conf)
        if best is None:
            for det in detect_palms(img)[:2]:
                lm, conf = landmarks(img, det)
                if conf < 0.5:
                    continue
                if best is None or conf > best[1]:
                    best = (lm, conf)
        prev = best[0] if best is not None else None
        frames.append(fr)
        if best is None:
            hands.append(None)
        else:
            lm = best[0] * K
            palm_c = lm[[0, 5, 9, 13, 17]].mean(0)
            hands.append({
                "palm": [round(float(v), 1) for v in palm_c],
                "tip": [round(float(v), 1) for v in lm[8]],
                "size": round(float(np.linalg.norm(lm[9] - lm[0])), 1),
                "g": gesture(lm),
                "score": round(best[1], 2),
                "lm": [[round(float(x), 1), round(float(y), 1)] for x, y in lm],
            })
        if a.sheet and len(thumbs) < 24 and best is not None and len(frames) % 6 == 0:
            thumbs.append((fr, img.copy(), best[0]))
        if len(frames) % 60 == 0:
            seen = sum(h is not None for h in hands)
            print(f"  {fr / FPS:6.1f} s  hand in {seen}/{len(frames)} samples", flush=True)

os.makedirs(os.path.dirname(a.out), exist_ok=True)
json.dump({"fps": FPS, "step": a.step, "W": W, "H": H, "frames": frames, "hands": hands}, open(a.out, "w"))
seen = [h for h in hands if h]
from collections import Counter

print(f"hands -> {a.out}: hand visible in {len(seen)}/{len(hands)} samples; gestures {dict(Counter(h['g'] for h in seen))}")

# spans where the hand is up (for writing beats): runs of visible samples >= 0.5 s
spans, start = [], None
for i, h in enumerate(hands + [None]):
    if h and start is None:
        start = i
    if not h and start is not None:
        if (frames[i - 1] - frames[start]) / FPS >= 0.5:
            gs = Counter(x["g"] for x in hands[start:i]).most_common(1)[0][0]
            spans.append((frames[start] / FPS, frames[i - 1] / FPS, gs))
        start = None
for s0, s1, g in spans:
    print(f"  hand up {s0:6.2f}-{s1:6.2f} s (orig)  mostly {g}")

if a.sheet and thumbs:
    # contact sheet: up to 24 thumbs with landmarks dotted, via ffmpeg
    tw, th = 270, 480
    cols = 6
    rows = (len(thumbs) + cols - 1) // cols
    sheet = np.zeros((rows * th, cols * tw, 3), np.uint8)
    for j, (fr, img, lm) in enumerate(thumbs):
        t = resize(img, tw, th).copy()
        for x, y in lm / 2:
            xi, yi = int(x), int(y)
            t[max(0, yi - 2) : yi + 3, max(0, xi - 2) : xi + 3] = (0, 255, 255)
        r, c = divmod(j, cols)
        sheet[r * th : (r + 1) * th, c * tw : (c + 1) * tw] = t
    os.makedirs("out/reel", exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{sheet.shape[1]}x{sheet.shape[0]}",
                    "-i", "-", "out/reel/hands.png"], input=sheet.tobytes(), check=True)
    print("contact sheet -> out/reel/hands.png")
