#!/usr/bin/env python3
"""Light transcription: faster-whisper (CTranslate2, int8) instead of the
openai-whisper CLI. Same model family (large-v3-turbo), ~1.5 GB RAM instead
of 3-5 GB, several times faster on a CPU, no PyTorch. Writes the same
whisper-style JSON, then hands it to transcribe.py --raw for the segment
table, word fixes and words.json.

    lpy transcribe_lite.py <video> --out scratch/words_all.json --language ur|en|ps|auto \
        [--model large-v3-turbo] [--fix "Cloud=Claude"]...

Other models: small (~0.5 GB RAM, weaker Urdu), medium, large-v3 (slow).
The model downloads once (~800 MB for large-v3-turbo) into ~/.cache/huggingface.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lite import read_audio_16k, threads  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("--out", required=True)
ap.add_argument("--language", default="en")
ap.add_argument("--model", default="large-v3-turbo")
ap.add_argument("--fix", action="append", default=[])
a, rest = ap.parse_known_args()

from faster_whisper import WhisperModel  # noqa: E402

t0 = time.time()
model = WhisperModel(a.model, device="cpu", compute_type="int8", cpu_threads=threads())
lang = None if a.language == "auto" else a.language
audio = read_audio_16k(a.src)
segs, info = model.transcribe(audio, language=lang, word_timestamps=True, vad_filter=False, beam_size=5, condition_on_previous_text=False)


def as_dict(s, offset=0.0):
    return {
        "start": round(s.start + offset, 2),
        "end": round(s.end + offset, 2),
        "text": s.text,
        "words": [{"word": w.word, "start": round(w.start + offset, 2), "end": round(w.end + offset, 2), "probability": round(w.probability, 3)} for w in (s.words or [])],
    }


# Hallucination guard: long-form decoding now and then emits a line in the
# wrong script (Korean, Chinese, Cyrillic...) or a junk run of symbols. Such a
# line is re-transcribed on its own, with 1 s of context on each side.
FOREIGN = re.compile(r"[Ѐ-ӿ฀-๿぀-ヿ㐀-鿿가-힯�]")
LATIN_WORDS = re.compile(r"[A-Za-z]{3,}")


def suspicious(text):
    if FOREIGN.search(text):
        return True
    # in an Urdu/Pashto run, a line that is mostly Latin is suspect too
    return a.language in ("ur", "ps") and len(LATIN_WORDS.findall(text)) > max(2, len(text.split()) // 2)


out = {"text": "", "language": info.language, "segments": []}
for s in segs:
    d = as_dict(s)
    if suspicious(s.text):
        lo, hi = max(0.0, s.start - 1.0), s.end + 1.0
        clip = audio[int(lo * 16000) : int(hi * 16000)]
        redo, _ = model.transcribe(clip, language=lang, word_timestamps=True, beam_size=5, condition_on_previous_text=False, temperature=[0.0, 0.2, 0.4])
        redo = [r for r in redo if r.end + lo > s.start - 0.2 and r.start + lo < s.end + 0.2]
        if redo and not any(suspicious(r.text) for r in redo):
            print(f"  re-listened {s.start:.1f}-{s.end:.1f}s: {s.text.strip()[:40]!r} -> {' '.join(r.text.strip() for r in redo)[:60]!r}", file=sys.stderr)
            for r in redo:
                out["segments"].append(as_dict(r, lo))
                out["text"] += r.text
            continue
        print(f"  WARNING {s.start:.1f}-{s.end:.1f}s still looks wrong, check it by hand", file=sys.stderr)
    out["segments"].append(d)
    out["text"] += s.text
    print(f"  {s.end:6.1f}s {s.text.strip()[:70]}", file=sys.stderr)
for i, d in enumerate(out["segments"]):
    d["id"] = i
raw = os.path.splitext(a.out)[0] + ".whisper.json"
os.makedirs(os.path.dirname(raw) or ".", exist_ok=True)
json.dump(out, open(raw, "w"), ensure_ascii=False)
print(f"faster-whisper {a.model} int8: {time.time() - t0:.0f}s, language {info.language}", file=sys.stderr)

here = os.path.dirname(os.path.abspath(__file__))
cmd = [sys.executable, os.path.join(here, "transcribe.py"), a.src, "--out", a.out, "--raw", raw, "--language", a.language]
for f in a.fix:
    cmd += ["--fix", f]
sys.exit(subprocess.run(cmd + rest).returncode)
