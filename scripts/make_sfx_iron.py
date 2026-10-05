#!/usr/bin/env python3
"""Iron Man mode sound kit, v3 "film" (numpy synthesis, nothing to license).

    make_sfx_iron.py [public_dir=public]

History (Noor, 4 Oct 2026): v1 sine sweeps sounded like a cartoon; v2 had bell
and chime tones and still sounded like a mobile game (Candy Crush). Film sci-fi
UI sound has almost NO musical notes: sub-bass weight, air, mechanical texture,
dark reverb. So v3 uses no pitched tones at all, only noise shaped by filters,
sub-bass thumps and long dark tails. Use few of them: big moments only.

public/sfx/ (stereo):
  hud_on.wav    1.3 s power-up: sub swell + air rising + servo whirr, ends in a thump
  holo.wav      0.6 s hologram opening: soft air whoosh into a low thump (every panel)
  lock.wav      0.8 s lock-on: two muted mechanical clicks + low thunk + dark tail
  hit.wav       1.6 s cinematic impact for the big moment (number, best take, AI core)
  scan.wav      1.0 s dark scanner sweep (globe, scan line)
  slice.wav     0.9 s energy cut: air in, hard crack + sub punch, dark tail (no ring)
  data.wav      0.25 s tiny muted data clicks (a row/label landing; very quiet)
  power_off.wav 1.2 s power-down: falling air + sub drop
public/music/:
  iron-bed.wav  60 s dark drone bed (sub + slow moving air), loops under speech
"""
import os
import sys
import wave

import numpy as np

SR = 44100
pub = sys.argv[1] if len(sys.argv) > 1 else "public"
rng = np.random.default_rng(3)
os.makedirs(f"{pub}/sfx", exist_ok=True)
os.makedirs(f"{pub}/music", exist_ok=True)


def T(sec):
    return np.arange(int(sec * SR)) / SR


def noise(n):
    return rng.standard_normal(n)


def biquad(x, fc, q, kind="bp"):
    """time-varying RBJ biquad: bp (band-pass), lp (low-pass), hp (high-pass)."""
    n = len(x)
    fc = np.broadcast_to(np.asarray(fc, float), (n,))
    q = np.broadcast_to(np.asarray(q, float), (n,))
    w = 2 * np.pi * np.clip(fc, 15, SR * 0.45) / SR
    cw, al = np.cos(w), np.sin(w) / (2 * q)
    a0 = 1 + al
    if kind == "bp":
        b0, b1, b2 = al, 0 * al, -al
    elif kind == "lp":
        b0, b1, b2 = (1 - cw) / 2, 1 - cw, (1 - cw) / 2
    else:
        b0, b1, b2 = (1 + cw) / 2, -(1 + cw), (1 + cw) / 2
    b0, b1, b2, a1, a2 = b0 / a0, b1 / a0, b2 / a0, -2 * cw / a0, (1 - al) / a0
    y = np.zeros(n)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(n):
        yi = b0[i] * x[i] + b1[i] * x1 + b2[i] * x2 - a1[i] * y1 - a2[i] * y2
        x2, x1, y2, y1 = x1, x[i], y1, yi
        y[i] = yi
    return y


def thump(t, f0=110, f1=38, decay=0.25):
    """sub-bass punch: a fast pitch drop felt more than heard (not a note)."""
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay) * (1 - np.exp(-t / 0.002))


def reverb(x, sec=1.6, mix=0.35, dark=3500, seed=0):
    """stereo dark room tail (FFT convolution with low-passed decaying noise)."""
    r = np.random.default_rng(seed)
    t = T(sec)
    out = []
    for _ in range(2):
        ir = r.standard_normal(len(t)) * np.exp(-t / (sec / 5))
        ir = biquad(ir, dark, 0.7, "lp")
        ir[: int(0.015 * SR)] = 0
        ir /= np.sqrt((ir**2).sum())
        n = len(x) + len(ir)
        wet = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)
        out.append(np.pad(x, (0, len(ir))) * (1 - mix) + wet * mix * 1.6)
    return np.stack(out, 1)


def write(path, x, peak=0.89):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    keep = np.where(np.abs(x).max(1) > 2e-4 * np.abs(x).max())[0]
    x = x[: keep[-1] + 1].copy()
    f = min(len(x), int(0.03 * SR))
    x[-f:] *= np.linspace(1, 0, f)[:, None]
    x = x / (np.abs(x).max() + 1e-9) * peak
    with wave.open(path, "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def sfx(name, x, **kw):
    write(f"{pub}/sfx/{name}", reverb(x, **kw))


def air(t, f0, f1, q=0.8, shape=None):
    """noise through a moving band-pass: the 'whoosh' (no tone)."""
    n = len(t)
    fc = f0 * (f1 / f0) ** (t / t[-1])
    a = biquad(noise(n), fc, q)
    return a * (shape if shape is not None else 1)


# holo: soft whoosh rising into a low thump
t = T(0.6)
rise = np.clip(t / 0.35, 0, 1) ** 2.5 * np.exp(-np.clip(t - 0.35, 0, None) / 0.06)
x = 0.8 * air(t, 400, 2400, 0.7, rise)
tt = np.clip(t - 0.35, 0, None)
x += 0.9 * thump(tt, 90, 40, 0.18) * (t >= 0.35)
sfx("holo.wav", x, sec=1.4, mix=0.3, seed=1)

# hud_on: sub swell + air + servo whirr (amplitude-modulated low-mid noise), thump at the end
t = T(1.3)
n = len(t)
swell = np.sin(2 * np.pi * 42 * t) * np.clip(t / 1.1, 0, 1) ** 2
servo = biquad(noise(n), 300 + 500 * (t / 1.3), 2.0) * (0.5 + 0.5 * np.sin(2 * np.pi * (18 + 30 * t) * t)) * np.clip(t / 1.1, 0, 1)
whoosh = air(t, 300, 3000, 0.7, np.clip(t / 1.1, 0, 1) ** 3)
tt = np.clip(t - 1.1, 0, None)
end = thump(tt, 120, 36, 0.3) * (t >= 1.1)
x = 0.5 * swell * (t < 1.1) + 0.35 * servo * (t < 1.12) + 0.5 * whoosh * (t < 1.12) + 1.0 * end
sfx("hud_on.wav", x, sec=1.8, mix=0.35, seed=2)

# lock: two muted mechanical clicks, then a low thunk
t = T(0.8)
n = len(t)
clicks = np.zeros(n)
for d in (0.0, 0.07):
    m = (t >= d) & (t < d + 0.008)
    clicks[m] = noise(m.sum()) * np.exp(-(t[m] - d) / 0.002)
clicks = biquad(clicks, 1800, 1.2)
tt = np.clip(t - 0.14, 0, None)
x = 0.7 * clicks + 1.0 * thump(tt, 140, 45, 0.15) * (t >= 0.14) + 0.25 * biquad(noise(n), 600, 1.0) * np.exp(-tt / 0.03) * (t >= 0.14)
sfx("lock.wav", x, sec=1.4, mix=0.3, seed=3)

# hit: cinematic impact (the big moments)
t = T(1.6)
n = len(t)
x = 1.0 * thump(t, 160, 32, 0.6)
x += 0.5 * biquad(noise(n), 900, 0.6) * np.exp(-t / 0.05)
x += 0.25 * air(t, 2500, 300, 0.6, np.exp(-t / 0.5))
sfx("hit.wav", x, sec=2.4, mix=0.4, dark=2500, seed=4)

# scan: dark sweep through noise
t = T(1.0)
n = len(t)
fc = 250 * (10 ** (0.5 - 0.5 * np.cos(np.pi * t)))
x = biquad(noise(n), fc, 3.0) * np.sin(np.pi * t) ** 1.5
sfx("scan.wav", x, sec=1.2, mix=0.3, seed=5)

# slice: air in, crack + sub punch, dark tail (no ring)
t = T(0.9)
n = len(t)
x = 0.6 * air(t, 800, 5000, 0.8, np.clip(t / 0.1, 0, 1) ** 3 * (t < 0.1))
tt = np.clip(t - 0.1, 0, None)
on = t >= 0.1
x += 1.0 * biquad(noise(n), 3500, 0.7) * np.exp(-tt / 0.02) * on
x += 1.0 * thump(tt, 150, 40, 0.2) * on
x += 0.3 * air(t, 3000, 400, 0.7, np.exp(-tt / 0.25) * on)
sfx("slice.wav", x, sec=1.5, mix=0.32, seed=6)

# data: tiny muted clicks
t = T(0.25)
n = len(t)
x = np.zeros(n)
for d in (0.0, 0.03, 0.05, 0.09):
    m = (t >= d) & (t < d + 0.004)
    x[m] = noise(m.sum())
x = biquad(x, 1400, 1.5)
sfx("data.wav", x, sec=0.6, mix=0.25, seed=7)

# power_off: falling air + sub drop
t = T(1.2)
n = len(t)
x = 0.7 * air(t, 3000, 150, 0.8, np.exp(-t / 0.5))
x += 0.9 * np.sin(2 * np.pi * np.cumsum(70 * np.exp(-t / 0.5) + 25) / SR) * np.exp(-t / 0.6)
sfx("power_off.wav", x, sec=1.8, mix=0.35, seed=8)

# iron-bed: 60 s dark drone, loops (ends match the start)
t = T(60.0)
n = len(t)
lfo = lambda f, ph=0: 0.5 + 0.5 * np.sin(2 * np.pi * f * t + ph)  # f = whole cycles per 60 s / 60
drone = 0.6 * np.sin(2 * np.pi * 41.2 * t) + 0.35 * np.sin(2 * np.pi * 61.7 * t) * lfo(1 / 20)
airbed = biquad(noise(n), 350 + 250 * lfo(1 / 30), 1.5) * (0.4 + 0.6 * lfo(1 / 15, 1))
hi = biquad(noise(n), 2500 + 800 * lfo(1 / 12, 2), 4.0) * 0.15 * lfo(1 / 10)
pulse = (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 0.5 * t))) * 0  # no beat: a beat makes it a game loop
x = drone + 0.6 * airbed + hi + pulse
fade = int(2 * SR)
x[:fade] *= np.linspace(0, 1, fade)
x[-fade:] = x[-fade:] * np.linspace(1, 0, fade) + x[:fade] * np.linspace(0, 1, fade) * 0
write(f"{pub}/music/iron-bed.wav", np.stack([x, np.roll(x, 900)], 1), peak=0.7)
print("iron sfx v3 (film, no tones) -> public/sfx + public/music/iron-bed.wav")
