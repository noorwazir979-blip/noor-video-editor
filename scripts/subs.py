#!/usr/bin/env python3
"""Make Roman Urdu captions and an English subtitle line from the Urdu
word captions, keeping the exact word timings.

    subs.py src/talk/reel-words.json --roman roman.txt --english english.json

roman.txt: one Roman token per Urdu caption word, in order, separated by
spaces or new lines (same count as reel-words.json; check with --list).
Write "_" for a word that merges into the previous one ("اے" "آئی" -> "AI" "_").
Claude writes it by hand from the --list output: spoken Roman Urdu the way
Pakistanis text (main, nahi, toh, kyun, hai), English loanwords in normal
English spelling (business, invoice, WhatsApp, AI).

english.json: [[first_index, last_index, "English sentence"], ...] covering
the caption words sentence by sentence. Natural English, not word for word.

arabic.json (optional): same format as english.json, simple Modern Standard
Arabic sentences for UAE viewers; shown instead of the English line when the
template's SECOND_LINE is "arabic" (or the render prop line=arabic).

Writes reel-words.roman.json, reel-lines.en.json and reel-lines.ar.json next to the input.

    subs.py src/talk/reel-words.json --list     # numbered word list to translate
"""
import argparse
import json
import os
import sys

ap = argparse.ArgumentParser()
ap.add_argument("words")
ap.add_argument("--roman")
ap.add_argument("--english")
ap.add_argument("--arabic", help="arabic.json, same format as english.json")
ap.add_argument("--list", action="store_true")
ap.add_argument("--from-master", help="rebuild roman/english for THIS cut from another cut's reel-subs.master.json")
ap.add_argument("--placeholders", action="store_true", help="write empty roman/english files if missing (English recordings), so the template compiles")
a = ap.parse_args()

words = json.load(open(a.words))
if a.list:
    print(len(words), "words")
    print(" ".join(f"{i}:{w['word'].strip()}" for i, w in enumerate(words)))
    sys.exit()

d = os.path.dirname(a.words)
if a.from_master:
    mm = json.load(open(a.from_master))
    sp = json.load(open(os.path.join(d, "reel-segments.json")))
    fps_ = sp.get("fps", 30)

    def _edit(t):
        if t is None:
            return None
        for s in sp["segments"]:
            if s["a"] - 1e-6 <= t <= s["b"] + 1e-6:
                return s["editStart"] + (t - s["a"])
        return None

    if "roman" in mm:
        rw = [dict(w, start=_edit(w["start"]), end=_edit(w["end"]) or _edit(w["start"])) for w in mm["roman"]]
        rw = [w for w in rw if w["start"] is not None]
        json.dump(rw, open(os.path.join(d, "reel-words.roman.json"), "w"), ensure_ascii=False, indent=1)
        print(f"roman from master: {len(rw)} words")
    for key, fname in (("english", "reel-lines.en.json"), ("arabic", "reel-lines.ar.json")):
        if key not in mm:
            continue
        el = []
        for l in mm[key]:
            s0 = _edit(l["start"])
            if s0 is None:
                continue
            e0 = _edit(l["end"])
            if e0 is None:  # line runs past the end of a kept take: stop at the take end
                seg = next(s for s in sp["segments"] if s["a"] - 1e-6 <= l["start"] <= s["b"] + 1e-6)
                e0 = seg["editStart"] + seg["frames"] / fps_
            el.append({"text": l["text"], "start": s0, "end": e0})
        json.dump(el, open(os.path.join(d, fname), "w"), ensure_ascii=False, indent=1)
        print(f"{key} from master: {len(el)} lines")
    sys.exit()
if a.placeholders:
    for name, val in (("reel-words.roman.json", words), ("reel-lines.en.json", []), ("reel-lines.ar.json", []), ("fg.json", [])):
        p = os.path.join(d, name)
        if not os.path.exists(p):
            json.dump(val, open(p, "w"), ensure_ascii=False)
            print("placeholder", p)
if a.roman:
    toks = open(a.roman, encoding="utf-8").read().split()
    if len(toks) != len(words):
        sys.exit(f"roman.txt has {len(toks)} tokens, captions have {len(words)} words")
    out = []
    for w, t in zip(words, toks):
        if t == "_" and out:
            out[-1]["end"] = w["end"]
            continue
        out.append({"word": t.replace("~", " "), "start": w["start"], "end": w["end"]})
    json.dump(out, open(os.path.join(d, "reel-words.roman.json"), "w"), ensure_ascii=False, indent=1)
    print(f"roman: {len(out)} words -> {d}/reel-words.roman.json")
for key, src, fname in (("english", a.english, "reel-lines.en.json"), ("arabic", a.arabic, "reel-lines.ar.json")):
    if not src:
        continue
    lines = json.load(open(src, encoding="utf-8"))
    out = []
    covered = set()
    for i0, i1, text in lines:
        out.append({"text": text, "start": words[i0]["start"], "end": words[i1]["end"]})
        covered.update(range(i0, i1 + 1))
    missing = [i for i in range(len(words)) if i not in covered]
    json.dump(out, open(os.path.join(d, fname), "w"), ensure_ascii=False, indent=1)
    print(f"{key}: {len(out)} lines -> {d}/{fname}" + (f"; words not covered: {missing}" if missing else ""))

# ---- master copy in ORIGINAL seconds, so other cuts (a short version) reuse it ----
segp = os.path.join(d, "reel-segments.json")


def pieces():
    spec = json.load(open(segp))
    return spec["segments"], spec.get("fps", 30)


def to_orig(t):
    segs, fps = pieces()
    for s in segs:
        e0 = s["editStart"]
        if e0 - 1e-6 <= t <= e0 + s["frames"] / fps + 1e-6:
            return s["a"] + (t - e0)
    return None


def to_edit(t):
    segs, fps = pieces()
    for s in segs:
        if s["a"] - 1e-6 <= t <= s["b"] + 1e-6:
            return s["editStart"] + (t - s["a"])
    return None


master_p = os.path.join(d, "reel-subs.master.json")
if (a.roman or a.english or a.arabic) and os.path.exists(segp):
    m = json.load(open(master_p)) if os.path.exists(master_p) else {}
    if a.roman:
        rw = json.load(open(os.path.join(d, "reel-words.roman.json")))
        m["roman"] = [{"word": w["word"], "start": to_orig(w["start"]), "end": to_orig(w["end"])} for w in rw]
    for key, src, fname in (("english", a.english, "reel-lines.en.json"), ("arabic", a.arabic, "reel-lines.ar.json")):
        if src:
            el = json.load(open(os.path.join(d, fname)))
            m[key] = [{"text": l["text"], "start": to_orig(l["start"]), "end": to_orig(l["end"])} for l in el]
    json.dump(m, open(master_p, "w"), ensure_ascii=False, indent=1)
    print(f"master (original seconds) -> {master_p}")
