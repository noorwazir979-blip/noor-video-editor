"""Hand-corrected Urdu spellings for one reel (example), keyed by whisper word start time.
Value None deletes the word. Writes scratch/words_fixed.whisper.json."""
import json

P = "scratch/"  # run from the Remotion project root
FIX = {
    2.58: "سوشل",
    12.64: "دوں",
    14.48: "اتنی",
    17.68: "سوچ",
    17.94: "رہا",
    20.38: "ہوں",
    45.08: "ٹائپنگ",
    45.40: "سینٹر",
    46.98: "درہم",
    47.52: "درہم",
    47.76: "دے کے",
    48.22: "انوائس",
    49.68: "سمپل",
    51.56: "سوچا",
    52.04: "نہ",
    52.50: "ایپ",
    56.72: "کی۔",
    62.10: "ویڈیو",
    62.26: "دیکھی",
    62.46: None,
    62.92: "کنسیئرج",
    66.08: "بزنسز",
    66.64: "ہیں",
    68.20: "نہیں",
    68.64: "ہیں۔",
    74.18: "سوچا",
    74.68: "نہ",
    76.50: "موقع",
    80.72: "اے آئی",
    84.40: "اے آئی",
    84.82: "کنسیئرج",
    89.32: "یو اے ای",
    93.80: "اسسٹنٹ",
    95.06: "زیادہ،",
    98.94: "سے",
    99.06: "رابطہ",
    99.22: None,
    102.56: "واٹس",
    103.14: "ایپ",
    104.96: "سسٹم",
    105.30: "بنا",
    106.10: "آفس",
    106.66: "بھی",
    108.22: "وہ",
    108.64: "کر کے",
    109.80: "تھینک یو",
    7.26: None,  # placeholder never matches (سوچی starts 6.84)
}
d = json.load(open(P + "words_all.whisper.json"))
hit = set()
for s in d["segments"]:
    out = []
    for w in s["words"]:
        k = round(w["start"], 2)
        if k in FIX:
            hit.add(k)
            if FIX[k] is None:
                continue
            w["word"] = " " + FIX[k]
        out.append(w)
    s["words"] = out
    s["text"] = "".join(w["word"] for w in out)
json.dump(d, open(P + "words_fixed.whisper.json", "w"), ensure_ascii=False)
print("fixed", len(hit), "missing", sorted(set(FIX) - hit))
