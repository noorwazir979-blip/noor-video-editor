#!/usr/bin/env python3
"""noor-reel sound kit, part 2 (numpy synthesis, no samples to license).

    make_sfx2.py [public_dir=public]

Adds to public/sfx/:
  riser.wav     1.2 s rising filtered noise + tone: builds tension INTO a reveal (end it on the reveal frame)
  boom.wav      deep cinematic hit: the hook drop, a big number, the end card
  swoosh.wav    short airy swipe: a cutaway sliding in or out
  cash.wav      "ka-ching": money, prices, AED amounts
  shutter.wav   camera shutter: a screenshot or photo appearing
  typing.wav    0.8 s keyboard burst: a prompt or text being typed
  notify.wav    phone notification ping: a WhatsApp/message moment
and to public/music/:
  bed-soft.wav  60 s quiet ambient pulse (90 bpm) to loop under speech when no
                licensed track is given; MusicBed ducks it under the voice
"""
import os
import sys
import wave

import numpy as np

SR = 44100
pub = sys.argv[1] if len(sys.argv) > 1 else "public"
rng = np.random.default_rng(11)
os.makedirs(f"{pub}/sfx", exist_ok=True)
os.makedirs(f"{pub}/music", exist_ok=True)


def write(path, x, stereo=False):
    x = np.clip(x, -1, 1)
    if stereo and x.ndim == 1:
        x = np.stack([x, x], axis=1)
    pcm = (x * 32767).astype("<i2")
    with wave.open(path, "w") as w:
        w.setnchannels(2 if stereo else 1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(path, round(len(x) / SR, 2), "s")


def t(d):
    return np.arange(int(d * SR)) / SR


def lp(x, cutoff):
    # one-pole lowpass with a per-sample (array) or fixed cutoff in Hz
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    p = 0.0
    for i in range(len(x)):
        p += a[i] * (x[i] - p)
        y[i] = p
    return y


def norm(x, peak=0.9):
    return x / (np.max(np.abs(x)) + 1e-9) * peak


# riser: noise through an opening filter + a rising tone, swelling in
tt = t(1.2)
prog = tt / tt[-1]
noise = rng.uniform(-1, 1, len(tt))
r = lp(noise, 300 + 7000 * prog**2) * (prog**1.6)
tone = np.sin(2 * np.pi * np.cumsum(180 + 700 * prog**2) / SR) * 0.35 * prog**2
write(f"{pub}/sfx/riser.wav", norm(r + tone, 0.8))

# boom: sine drop 90 -> 38 Hz with a noise transient and long tail
tt = t(1.6)
f = 38 + 52 * np.exp(-tt * 9)
body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.6)
click = lp(rng.uniform(-1, 1, len(tt)), 2500) * np.exp(-tt * 60) * 0.6
write(f"{pub}/sfx/boom.wav", norm(body + click, 0.95))

# swoosh: band of noise sweeping up then down, short
tt = t(0.42)
prog = tt / tt[-1]
env = np.sin(np.pi * prog) ** 2
s = lp(rng.uniform(-1, 1, len(tt)), 800 + 5000 * np.sin(np.pi * prog)) * env
write(f"{pub}/sfx/swoosh.wav", norm(s - lp(s, 400), 0.7))

# cash: two bright bell partials + a coin rattle
tt = t(0.9)
bell = sum(a * np.sin(2 * np.pi * fr * tt) * np.exp(-tt * d) for fr, a, d in ((2093, 0.5, 5), (3136, 0.35, 7), (4186, 0.2, 9)))
bell2 = np.zeros_like(tt)
o = int(0.11 * SR)
bell2[o:] = bell[: len(tt) - o] * 0.8
rattle = lp(rng.uniform(-1, 1, len(tt)), 6000) * np.exp(-tt * 18) * 0.25
write(f"{pub}/sfx/cash.wav", norm(bell + bell2 + rattle, 0.8))

# shutter: two clicks 70 ms apart with a soft whir between
tt = t(0.22)
x = np.zeros_like(tt)
for at in (0.0, 0.07):
    i = int(at * SR)
    n = int(0.03 * SR)
    burst = rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / SR * 160)
    x[i : i + n] += burst - lp(burst, 1500)
write(f"{pub}/sfx/shutter.wav", norm(x, 0.8))

# typing: random key clicks for 0.8 s
tt = t(0.8)
x = np.zeros_like(tt)
at = 0.0
while at < 0.75:
    i = int(at * SR)
    n = int(0.018 * SR)
    burst = rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / SR * 260) * rng.uniform(0.5, 1)
    x[i : i + n] += burst - lp(burst, 2000)
    at += rng.uniform(0.06, 0.13)
write(f"{pub}/sfx/typing.wav", norm(x, 0.6))

# notify: two-note ping (E6, B6)
tt = t(0.5)
x = np.zeros_like(tt)
for i0, fr in ((0, 1319), (int(0.12 * SR), 1976)):
    seg = tt[: len(tt) - i0]
    x[i0:] += np.sin(2 * np.pi * fr * seg) * np.exp(-seg * 9)
write(f"{pub}/sfx/notify.wav", norm(x, 0.7))

# bed-soft: 60 s, 90 bpm, Am - F - C - G pad with a soft kick and shaker
bpm = 90
beat = 60 / bpm
dur = 60.0
tt = t(dur)
x = np.zeros_like(tt)
chords = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (130.81, 164.81, 196.0), (196.0, 246.94, 293.66)]
bar = 4 * beat
for k in range(int(dur / bar) + 1):
    c = chords[k % 4]
    i0 = int(k * bar * SR)
    i1 = min(len(tt), int((k + 1) * bar * SR))
    seg = tt[: i1 - i0]
    env = np.minimum(1, seg / 0.6) * np.minimum(1, (bar - seg) / 0.6)
    pad = sum(np.sin(2 * np.pi * fr * seg) + 0.3 * np.sin(2 * np.pi * fr * 2.003 * seg) for fr in c)
    x[i0:i1] += pad * env * 0.09
for b in range(int(dur / beat)):
    i0 = int(b * beat * SR)
    n = min(int(0.25 * SR), len(tt) - i0)
    seg = np.arange(n) / SR
    if b % 2 == 0:
        x[i0 : i0 + n] += np.sin(2 * np.pi * np.cumsum(50 + 60 * np.exp(-seg * 30)) / SR) * np.exp(-seg * 14) * 0.5
    j = i0 + int(beat / 2 * SR)
    m = min(int(0.05 * SR), len(tt) - j)
    if m > 0:
        sh = rng.uniform(-1, 1, m) * np.exp(-np.arange(m) / SR * 80) * 0.08
        x[j : j + m] += sh - lp(sh, 4000)
x = lp(x, 5000)
fade = np.minimum(1, np.minimum(tt / 2, (dur - tt) / 2))
write(f"{pub}/music/bed-soft.wav", norm(x * fade, 0.6), stereo=True)
