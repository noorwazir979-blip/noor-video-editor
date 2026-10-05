#!/usr/bin/env python3
"""Results log for every reel (strategy section 10: judge videos by what they
did for the business, decide only from several videos, review monthly).

    log.py add --video noor-11pm-calm-A.mp4 --series 1 --hook costly-moment \
               --lang roman --style calm --hookv A [--line english] [--script <md>] [--length 41]
    log.py set <id> views=1200 watched=46 vvs=74 sends=9 saves=4 follows=6 owner_dms=1 checkups=0
    log.py show [--last 15]
    log.py review                      # averages per series, style, hook type and language

Numbers to fill 48 h after posting: views, watched (% watched or avg %),
vvs (YouTube viewed vs swiped %), sends, saves, follows, owner_dms, checkups.
The file is ./reel-log.csv in the folder you run it from;
set NOOR_REEL_LOG to use another path. csv module only.
"""
import argparse
import csv
import datetime
import os
import sys

COLS = ["id", "date", "video", "script", "series", "hook_type", "language", "style", "hook_variant", "second_line",
        "length_s", "views", "watched", "vvs", "sends", "saves", "follows", "owner_dms", "checkups", "notes"]
NUM = ["views", "watched", "vvs", "sends", "saves", "follows", "owner_dms", "checkups"]


def log_path():
    if os.environ.get("NOOR_REEL_LOG"):
        return os.environ["NOOR_REEL_LOG"]
    return "reel-log.csv"


def load(p):
    if not os.path.exists(p):
        return []
    with open(p, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def save(p, rows):
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in COLS})


ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest="cmd", required=True)
a1 = sub.add_parser("add")
for k in ("video", "script", "series", "hook", "lang", "style", "hookv", "line", "length", "notes"):
    a1.add_argument("--" + k, default="")
a2 = sub.add_parser("set")
a2.add_argument("id")
a2.add_argument("pairs", nargs="+")
a3 = sub.add_parser("show")
a3.add_argument("--last", type=int, default=15)
sub.add_parser("review")
a = ap.parse_args()
p = log_path()
rows = load(p)

if a.cmd == "add":
    nid = str(max([int(r["id"]) for r in rows if r["id"].isdigit()] or [0]) + 1)
    rows.append({"id": nid, "date": datetime.date.today().isoformat(), "video": a.video, "script": a.script,
                 "series": a.series, "hook_type": a.hook, "language": a.lang, "style": a.style or "heavy",
                 "hook_variant": a.hookv or "A", "second_line": a.line or "english", "length_s": a.length, "notes": a.notes})
    save(p, rows)
    print(f"added #{nid} -> {p}")
elif a.cmd == "set":
    r = next((r for r in rows if r["id"] == a.id), None)
    if not r:
        sys.exit(f"no row #{a.id}")
    for kv in a.pairs:
        k, _, v = kv.partition("=")
        if k not in COLS:
            sys.exit(f"unknown column {k}; columns: {', '.join(COLS)}")
        r[k] = v
    save(p, rows)
    print(f"updated #{a.id}")
elif a.cmd == "show":
    show = ["id", "date", "series", "hook_type", "language", "style", "hook_variant", "views", "watched", "sends", "follows", "owner_dms"]
    print("  ".join(show))
    for r in rows[-a.last:]:
        print("  ".join(r.get(c, "") or "-" for c in show))
else:  # review
    def num(r, k):
        try:
            return float(r.get(k) or "")
        except ValueError:
            return None

    for key in ("series", "style", "hook_type", "language", "hook_variant"):
        groups = {}
        for r in rows:
            groups.setdefault(r.get(key) or "?", []).append(r)
        print(f"\nby {key}:")
        for g, rs in sorted(groups.items()):
            parts = []
            for k in ("views", "watched", "sends", "follows", "owner_dms"):
                vals = [v for v in (num(r, k) for r in rs) if v is not None]
                if vals:
                    parts.append(f"{k} {sum(vals) / len(vals):.1f}")
            flag = "" if len(rs) >= 3 else "  (fewer than 3 videos: do not decide yet)"
            print(f"  {g:<16} n={len(rs):<3} " + ", ".join(parts) + flag)
    print("\nKeep the top 2 series, drop the bottom 2, try 2 new experiments. Judge by owner_dms first.")
