#!/usr/bin/env python3
"""Street mode: make a recording filmed OUTSIDE or WHILE WALKING (cars and
people moving behind, shaky hand, traffic noise) safe for the reel template.
Studio recordings need none of this; --analyze tells which one it is.

    lpy street.py --analyze                 # fast look (2 frames/s): studio or street? what to fix
    lpy street.py                           # fix it: steady the speaker, blur other people's faces
        [--src public/talk/ig1080.mp4] [--no-steady] [--no-blur] [--smooth 0.6]
        [--ranges "12-40,55-80"]            # ORIGINAL seconds; default = the takes in
                                            # src/talk/reel-segments(.hand).json, else everything

What it does, all light (onnxruntime + numpy + ffmpeg pipes, no OpenCV):
- Finds faces with UltraFace (ONNX, 1.5 MB) on three overlapping tiles of a
  540x960 copy, so small faces in the background are found too. The biggest
  face that moves smoothly is the speaker; every other face is a bystander.
- STEADY: locks the frame to the speaker's face. The face path is smoothed
  (--smooth seconds), the frame is zoomed in just enough (3-12 %, from the
  measured shake) and shifted every frame so the face follows the smooth
  path. Walking bounce and hand shake go; slow drift stays (it looks
  natural). Nothing happens when the shake is under ~4 px (studio).
- BLUR: other people's faces get a soft oval blur that follows them (UAE
  law: no stranger's face without consent). Number plates are NOT found:
  avoid filming them close.
- Writes src/talk/face.json (speaker face per frame, after steadying) for
  check.py and matte.py, and src/talk/scene.json (the measurements).

The untouched video is kept as ig1080.unsteady.mp4 and is always the input,
so re-running is safe. The audio is copied from the current ig1080.mp4; when
clean-audio.sh already ran, its ig1080.raw.mp4 gets the new video too, so a
later clean-audio.sh keeps the steadied picture.
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lite import read_audio_16k, session, speech_spans  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--src", default="public/talk/ig1080.mp4")
ap.add_argument("--analyze", action="store_true", help="report only, 2 frames/s, video untouched")
ap.add_argument("--no-steady", action="store_true")
ap.add_argument("--no-blur", action="store_true")
ap.add_argument("--smooth", type=float, default=0.6, help="seconds: bigger = steadier, but slow drift lags")
ap.add_argument("--strength", type=float, default=0.75, help="share of the wobble removed: 1 = face locked, 0.75 keeps some natural movement")
ap.add_argument("--ranges", default=None)
ap.add_argument("--step", type=int, default=3, help="look for faces every N frames (fix mode)")
ap.add_argument("--face-out", default="src/talk/face.json")
ap.add_argument("--scene-out", default="src/talk/scene.json")
a = ap.parse_args()

src = a.src
unsteady = src.replace(".mp4", ".unsteady.mp4")
raw = src.replace(".mp4", ".raw.mp4")
vin = unsteady if os.path.exists(unsteady) else src

probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,nb_frames:format=duration", "-of", "json", vin], capture_output=True, text=True).stdout)
st = probe["streams"][0]
W, H = st["width"], st["height"]
num, den = map(int, st["r_frame_rate"].split("/"))
fps = num / den
DUR = float(probe["format"]["duration"])
NF = int(st.get("nb_frames") or round(DUR * fps))

# ---------- which frames matter ----------
ranges = None
if a.ranges:
    ranges = [tuple(float(x) for x in r.split("-")) for r in a.ranges.split(",")]
elif not a.analyze:
    for p in ("src/talk/reel-segments.hand.json", "src/talk/reel-segments.json"):
        if os.path.exists(p):
            ranges = [(s["a"], s["b"]) for s in json.load(open(p))["segments"]]
            break
if ranges:
    # 1 s of context each side so the smoothing settles before the take starts
    fr = sorted((max(0, int((r0 - 1) * fps)), min(NF, int(math.ceil((r1 + 1) * fps)))) for r0, r1 in ranges)
    merged = [list(fr[0])]
    for f0, f1 in fr[1:]:
        if f0 <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], f1)
        else:
            merged.append([f0, f1])
    ranges = [r for r in merged if r[1] - r[0] > fps]  # takes past the end of this file: skip
if not ranges:
    ranges = [[0, NF]]
inside = np.zeros(NF, bool)
for f0, f1 in ranges:
    inside[f0:f1] = True

# ---------- face detection ----------
WS = 0.5  # detector sees a 540x960 copy
ww, wh = int(W * WS) // 2 * 2, int(H * WS) // 2 * 2
TW, TH = 640, 480  # UltraFace RFB-640 input
net = session("version-RFB-640.onnx")


def nms(b):
    """Merge duplicate boxes. Biggest first, and a box mostly inside a bigger
    one goes: a tile edge gives half-face boxes (a chin, a forehead) that must
    never count as a second person."""
    if not len(b):
        return b
    ar = lambda z: (z[..., 2] - z[..., 0]) * (z[..., 3] - z[..., 1])
    b = b[np.argsort(-ar(b))]
    keep = []
    while len(b):
        keep.append(b[0])
        x1 = np.maximum(b[0, 0], b[1:, 0]); y1 = np.maximum(b[0, 1], b[1:, 1])
        x2 = np.minimum(b[0, 2], b[1:, 2]); y2 = np.minimum(b[0, 3], b[1:, 3])
        inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
        b = b[1:][inter / (ar(b[1:]) + 1e-6) < 0.4]
    return np.array(keep)


# tiles of 480 rows from the 960-row copy, overlapping so no face is split
tiles = sorted({0, max(0, (wh - TH) // 2), max(0, wh - TH)})


def detect(img):
    """img: wh x ww x 3 uint8 -> faces in FULL-res px: [[x1,y1,x2,y2,score], ...]"""
    found = []
    for y0 in tiles:
        pad = np.full((TH, TW, 3), 127, np.uint8)
        t = img[y0 : y0 + TH, : min(ww, TW)]
        pad[: t.shape[0], : t.shape[1]] = t
        x = ((pad.astype(np.float32) - 127.0) / 128.0).transpose(2, 0, 1)[None]
        scores, boxes = net.run(None, {"input": x})
        s = scores[0, :, 1]
        m = s > 0.75
        if m.any():
            b = boxes[0][m] * np.array([TW, TH, TW, TH], np.float32)
            b[:, [1, 3]] += y0
            found.append(np.concatenate([b, s[m, None]], 1))
    if not found:
        return np.zeros((0, 5), np.float32)
    b = nms(np.concatenate(found))
    b[:, [0, 2]] = np.clip(b[:, [0, 2]], 0, ww)
    b[:, [1, 3]] = np.clip(b[:, [1, 3]], 0, wh)
    b = b[(b[:, 2] - b[:, 0] >= 7) & (b[:, 3] - b[:, 1] >= 8)]  # tiny = noise
    b[:, :4] /= WS
    return b


def shift(g0, g1):
    """Camera move between two small grey frames (phase correlation), in px."""
    win = np.hanning(g0.shape[0])[:, None] * np.hanning(g0.shape[1])[None]
    R = np.fft.fft2(g1 * win) * np.conj(np.fft.fft2(g0 * win))
    r = np.abs(np.fft.ifft2(R / (np.abs(R) + 1e-9)))
    y, x = np.unravel_index(int(r.argmax()), r.shape)
    y = y - r.shape[0] if y > r.shape[0] // 2 else y
    x = x - r.shape[1] if x > r.shape[1] // 2 else x
    return math.hypot(x, y)


step = a.step
if a.analyze:  # a quick look: 6 stretches of 3 s spread over the recording
    n = 6
    ranges = [[int(f), min(NF, int(f + 3 * fps))] for f in np.linspace(0, max(0, NF - 3 * fps), n)]
samples = {}  # frame -> (speaker box or None, [other boxes])
moves = []  # camera move per look, px/s at full size
prev = None
for f0, f1 in ranges:
    g_prev = None
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{f0 / fps:.4f}", "-i", vin, "-t", f"{(f1 - f0) / fps:.4f}",
                            "-vf", f"select=not(mod(n\\,{step})),scale={ww}:{wh}", "-fps_mode", "passthrough",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    k = 0
    size = ww * wh * 3
    while True:
        buf = dec.stdout.read(size)
        if len(buf) < size:
            break
        f = f0 + k * step
        k += 1
        img = np.frombuffer(buf, np.uint8).reshape(wh, ww, 3)
        g = img[::4, ::4].mean(2)
        if g_prev is not None:
            moves.append(shift(g_prev, g) * 4 / WS * fps / step)
        g_prev = g
        faces = detect(img)
        si = None
        if len(faces):
            area = (faces[:, 2] - faces[:, 0]) * (faces[:, 3] - faces[:, 1])
            big = area >= 0.35 * area.max()
            if prev is not None:
                c = (faces[:, :2] + faces[:, 2:4]) / 2
                pc = (prev[:2] + prev[2:4]) / 2
                dist = np.hypot(*(c - pc).T) + (~big) * 1e9
                i = int(np.argmin(dist))
                # a different, much smaller face far from where he was is not him
                pa = (prev[2] - prev[0]) * (prev[3] - prev[1])
                jump = dist[i] > 0.25 * W and area[i] < 0.4 * pa
            else:
                i = int(np.argmax(area))
                jump = False
            # the speaker is the biggest face in the frame (a phone at arm's length)
            if area[i] >= 0.002 * W * H and not jump:
                si = i
                prev = faces[i]
        others = []
        for j in range(len(faces)):
            if j == si:
                continue
            if si is not None:  # never a box whose centre sits on the speaker's face
                s = faces[si]; mx, my = 0.2 * (s[2] - s[0]), 0.2 * (s[3] - s[1])
                cxj, cyj = (faces[j, 0] + faces[j, 2]) / 2, (faces[j, 1] + faces[j, 3]) / 2
                if s[0] - mx < cxj < s[2] + mx and s[1] - my < cyj < s[3] + my:
                    continue
            others.append(faces[j])
        samples[f] = (None if si is None else faces[si], others)
        if k % 100 == 0:
            print(f"  faces {f / fps:6.1f}s", file=sys.stderr)
    dec.wait()

sf = np.array(sorted(samples))
valid = np.array([samples[f][0] is not None for f in sf])
# safety: never blur a face as big as the speaker's usual face (that is him, missed for a moment)
sp_areas = [(b[2] - b[0]) * (b[3] - b[1]) for f in sf if (b := samples[f][0]) is not None]
max_other = 0.5 * float(np.median(sp_areas)) if sp_areas else 0.02 * W * H
for f in sf:
    samples[f] = (samples[f][0], [b for b in samples[f][1] if (b[2] - b[0]) * (b[3] - b[1]) < max_other])
n_others = sum(1 for f in sf if samples[f][1])

# ---------- shake: how far the face jumps around its own smooth path ----------
frames = np.arange(NF)


def gauss_smooth(y, sigma):
    if sigma < 0.5:
        return y.copy()
    r = int(3 * sigma)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    return np.convolve(np.pad(y, r, mode="edge"), k, mode="valid")


cx = np.zeros(NF); cy = np.zeros(NF); fw = np.zeros(NF); wgt = np.zeros(NF)
if valid.sum() >= 2:
    vf = sf[valid]
    bx = np.array([samples[f][0] for f in vf])
    cx = np.interp(frames, vf, (bx[:, 0] + bx[:, 2]) / 2)
    cy = np.interp(frames, vf, (bx[:, 1] + bx[:, 3]) / 2)
    fw = np.interp(frames, vf, bx[:, 2] - bx[:, 0])
    # trust the path only near real detections (a lost face for > 0.7 s: no correction)
    near = np.zeros(NF)
    for f in vf:
        near[max(0, f - int(0.35 * fps)) : f + int(0.35 * fps) + 1] = 1
    wgt = gauss_smooth(near * inside, 0.15 * fps)
sig = a.smooth * fps
dx = (gauss_smooth(cx, sig) - cx) * wgt
dy = (gauss_smooth(cy, sig) - cy) * wgt
act = wgt > 0.5
shake = float(np.percentile(np.hypot(dx[act], dy[act]), 95)) if act.sum() > fps else 0.0
dx *= a.strength
dy *= a.strength
px95, py95 = (float(np.percentile(np.abs(d[act]), 95)) if act.sum() > fps else 0.0 for d in (dx, dy))

cam = float(np.median(moves)) if moves else 0.0  # camera move, px per second (tripod ~30, walking 300+)

# ---------- sound: how far the voice stands above the background ----------
# speech band only (200-4000 Hz): room rumble and phone hum do not count
audio_src = raw if os.path.exists(raw) else src
wav = read_audio_16k(audio_src)
sp = speech_spans(wav, threshold=0.5, min_silence=0.3)
n = 1024
c = wav[: len(wav) // n * n].reshape(-1, n)
hz = np.fft.rfftfreq(n, 1 / 16000)
band = 10 * np.log10((np.abs(np.fft.rfft(c * np.hanning(n), axis=1)) ** 2)[:, (hz > 200) & (hz < 4000)].sum(1) + 1e-12)
tc = (np.arange(len(c)) + 0.5) * n / 16000
m = np.zeros(len(c), bool)
for s0, s1 in sp:
    m |= (tc >= s0) & (tc < s1)
# loud speech (80th pct of all moments) over the quietest moments (5th pct): a quiet room ~13+ dB, traffic ~8
snr = float(np.percentile(band, 80) - np.percentile(band, 5)) if m.sum() > 30 else None

# a selfie moves the phone WITH the face, so the background barely registers: the face
# wobbling in the frame is the real sign (tripod/desk ~23 px, hand-held outside ~48 px)
need_steady = (cam > 120 or shake > 35) and valid.sum() >= 2 and not a.no_steady
need_blur = n_others >= max(2, 0.01 * len(sf)) and not a.no_blur
noisy = snr is not None and snr < 10
scene = "street" if (need_steady or need_blur or noisy) else "studio"
L = lambda v: "n/a" if v is None else f"{v:.0f}"
print(f"scene: {scene.upper()}")
print(f"  camera moves {cam:.0f} px/s, face wobbles {shake:.0f} px (desk ~23, hand-held 35+)  -> {'STEADY it' if need_steady else 'fine'}")
print(f"  other people's faces in {n_others}/{len(sf)} looks  -> {'BLUR them' if need_blur else 'none'}")
print(f"  voice above background {L(snr)} dB (under 10 = noisy)  -> "
      f"{'clean-audio.sh public/talk/ig1080.mp4 street' if noisy else 'clean-audio.sh as usual'}")
if 0 < n_others and not need_blur:
    print("  (a face-like spot in a few looks only, not blurred; check: " + ", ".join(f"{f / fps:.1f}s" for f in sf if samples[f][1])[:200] + ")")
if not valid.any():
    print("  no speaker face found: steadying is off (back to the camera? check the contact sheet)")
info = {"scene": scene, "camera_px_s": round(cam), "face_jitter_px": round(shake, 1), "other_faces": n_others,
        "looks": len(sf), "voice_db": None if snr is None else round(snr, 1), "noisy": noisy}
if scene == "street":
    print('  template: SCENE = "street" in Reel.tsx; tighten.py --street; LOOK "punchy" if the picture is flat')

if a.analyze or not (need_steady or need_blur):
    os.makedirs(os.path.dirname(a.scene_out), exist_ok=True)
    json.dump(info, open(a.scene_out, "w"), indent=1)
    if not a.analyze:
        print("nothing to fix in the picture; video left as it is")
    sys.exit(0)

# ---------- fix pass: steady + blur, one frame at a time ----------
Z = 1.0
if need_steady:
    # zoom just enough that 95 % of the corrections fit inside the margin
    need = max(1 / max(0.5, 1 - 2 * px95 / W), 1 / max(0.5, 1 - 2 * py95 / H))
    Z = float(min(1.12, max(1.03, need)))
    lim_x, lim_y = (Z - 1) * W / (2 * Z), (Z - 1) * H / (2 * Z)
    dx = lim_x * np.tanh(dx / lim_x)  # soft limit: never shows a black edge
    dy = lim_y * np.tanh(dy / lim_y)
else:
    dx[:] = 0; dy[:] = 0
ZW, ZH = int(round(W * Z / 2) * 2), int(round(H * Z / 2) * 2)
o0x, o0y = (ZW - W) / 2, (ZH - H) / 2
ox = np.clip(np.round(o0x - Z * dx), 0, ZW - W).astype(int)
oy = np.clip(np.round(o0y - Z * dy), 0, ZH - H).astype(int)

# bystander boxes per frame: union of the two nearest looks, grown so a moving head stays covered
oth_f = [f for f in sf if samples[f][1]]


def others_at(f):
    if not oth_f or not need_blur:
        return []
    i = np.searchsorted(sf, f)
    near = [sf[j] for j in (i - 1, i) if 0 <= j < len(sf) and abs(sf[j] - f) <= step]
    out = []
    for g in near:
        out += samples[g][1]
    return out


def blur_box(img, b, f):
    x1, y1, x2, y2 = b[:4]
    w, h = x2 - x1, y2 - y1
    g = 0.35  # grow: hair, ears, motion between looks
    x1, x2 = x1 - g * w, x2 + g * w
    y1, y2 = y1 - g * 1.1 * h, y2 + g * 0.8 * h
    # into the steadied frame
    x1, x2 = x1 * Z - ox[f], x2 * Z - ox[f]
    y1, y2 = y1 * Z - oy[f], y2 * Z - oy[f]
    X1, Y1, X2, Y2 = max(0, int(x1)), max(0, int(y1)), min(W, int(x2)), min(H, int(y2))
    if X2 - X1 < 6 or Y2 - Y1 < 6:
        return
    r = img[Y1:Y2, X1:X2].astype(np.float32)
    h, w = r.shape[:2]
    k = max(4, min(w, h) // 5)
    hh, wq = max(1, h // k), max(1, w // k)
    small = r[: hh * k, : wq * k].reshape(hh, k, wq, k, 3).mean((1, 3)) if h >= k and w >= k else r.mean((0, 1))[None, None]
    hh, wq = small.shape[:2]
    yi = np.clip((np.arange(h) + 0.5) * hh / h - 0.5, 0, hh - 1); y0 = np.floor(yi).astype(int); y1i = np.minimum(y0 + 1, hh - 1); fy = (yi - y0)[:, None, None]
    xi = np.clip((np.arange(w) + 0.5) * wq / w - 0.5, 0, wq - 1); x0 = np.floor(xi).astype(int); x1i = np.minimum(x0 + 1, wq - 1); fx = (xi - x0)[None, :, None]
    big = (small[y0][:, x0] * (1 - fx) + small[y0][:, x1i] * fx) * (1 - fy) + (small[y1i][:, x0] * (1 - fx) + small[y1i][:, x1i] * fx) * fy
    yy = ((np.arange(h) + Y1 - (y1 + y2) / 2) / ((y2 - y1) / 2))[:, None]
    xx = ((np.arange(w) + X1 - (x1 + x2) / 2) / ((x2 - x1) / 2))[None, :]
    m = np.clip((1.0 - (xx ** 2 + yy ** 2)) / 0.3, 0, 1)[..., None]  # soft oval edge
    img[Y1:Y2, X1:X2] = (r * (1 - m) + big * m).astype(np.uint8)


if not os.path.exists(unsteady):
    shutil.copy(src, unsteady)
tmp = src.replace(".mp4", ".street-tmp.mp4")
vf = f"scale={ZW}:{ZH}:flags=bicubic" if Z > 1 else "null"
dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", unsteady, "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", f"{num}/{den}", "-i", "-",
                        "-i", src, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
                        "-c:a", "copy", "-movflags", "+faststart", "-shortest", tmp], stdin=subprocess.PIPE)
size = ZW * ZH * 3
f = 0
blurred = 0
while True:
    buf = dec.stdout.read(size)
    if len(buf) < size:
        break
    fi = min(f, NF - 1)
    frame = np.frombuffer(buf, np.uint8).reshape(ZH, ZW, 3)
    out = np.ascontiguousarray(frame[oy[fi] : oy[fi] + H, ox[fi] : ox[fi] + W])
    if inside[fi]:
        for b in others_at(fi):
            blur_box(out, b, fi)
            blurred += 1
    enc.stdin.write(out.tobytes())
    f += 1
    if f % 900 == 0:
        print(f"  fixed {f / fps:6.1f}s", file=sys.stderr)
enc.stdin.close()
enc.wait()
dec.wait()
if enc.returncode:
    sys.exit("encode failed; video left as it was")
os.replace(tmp, src)
if os.path.exists(raw):  # clean-audio.sh rebuilds from raw: give raw the new picture, keep its original sound
    t2 = raw.replace(".mp4", ".tmp.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-i", raw, "-map", "0:v", "-map", "1:a?", "-c", "copy", t2], check=True)
    os.replace(t2, raw)

# speaker face per look, in the steadied frame (check.py: emoji not on the face; matte.py: cut out only him)
track = []
for f in sf:
    b = samples[f][0]
    if b is None:
        track.append(None)
        continue
    fi = min(f, NF - 1)
    track.append([round(float(v), 1) for v in (((b[0] + b[2]) / 2) * Z - ox[fi], ((b[1] + b[3]) / 2) * Z - oy[fi], (b[2] - b[0]) * Z, (b[3] - b[1]) * Z)])
os.makedirs(os.path.dirname(a.face_out), exist_ok=True)
json.dump({"fps": fps, "W": W, "H": H, "frames": [int(x) for x in sf], "speaker": track}, open(a.face_out, "w"))
info.update({"zoom": round(Z, 3), "steadied": bool(need_steady), "blurred_boxes": blurred})
json.dump(info, open(a.scene_out, "w"), indent=1)
print(f"street fix: zoom {Z:.2f}, steadied={need_steady}, {blurred} face blurs -> {src} (original kept: {unsteady})")
print(f"face track -> {a.face_out}")
