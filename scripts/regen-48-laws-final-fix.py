#!/usr/bin/env python3
"""Final fixes:
- Ch10 fastRead: "the author" -> "the writer" (3 hits) [missed in previous pass — it's in fastRead, not fullRead]
- Ch1, Ch4, Ch31, Ch34 examples: replace v13-pool names (Sarah, Hannah, Sam, Alex, Liam) with valid names
"""
import json
import re
from pathlib import Path

PATH = Path("/Users/willsoltani/dev/chapterflow-siliconx/book-packages/the-48-laws-of-power.v21.json")

# Replacement map for v13-pool names appearing in examples (whole-word only)
EXAMPLE_NAME_MAP = {
    "Sarah": "Adaeze",
    "Hannah": "Nadine",
    "Sam": "Bashir",
    "Alex": "Tariq",
    "Liam": "Demetrios",
}


def main():
    d = json.load(open(PATH))
    chapters = {c["number"]: c for c in d["chapters"]}

    # === Ch10 fastRead: "the author" -> "the writer" ===
    ch10 = chapters[10]
    fast10 = ch10["breakdown"]["fastRead"]
    fast10 = fast10.replace("The author on the other end", "The writer on the other end")
    fast10 = fast10.replace("The author has not changed", "The writer has not changed")
    fast10 = fast10.replace("referring the author to", "referring the writer to")
    ch10["breakdown"]["fastRead"] = fast10

    # === Examples: replace v13-pool names everywhere in examples (any chapter) ===
    name_pattern_map = {k: re.compile(rf'\b{k}\b') for k in EXAMPLE_NAME_MAP}

    for ch in d["chapters"]:
        for ex in ch.get("examples", []):
            for field in ("scenario", "title", "whatToDo", "whyItMatters"):
                if field in ex and isinstance(ex[field], str):
                    for v13_name, replacement in EXAMPLE_NAME_MAP.items():
                        ex[field] = name_pattern_map[v13_name].sub(replacement, ex[field])
            # planSpec sub-fields
            if "planSpec" in ex and isinstance(ex["planSpec"], dict):
                for k, v in ex["planSpec"].items():
                    if isinstance(v, str):
                        for v13_name, replacement in EXAMPLE_NAME_MAP.items():
                            ex["planSpec"][k] = name_pattern_map[v13_name].sub(replacement, ex["planSpec"][k])
                        # Use the substituted string
                        v = ex["planSpec"][k]

    # Verify Ch10 memorable lines still pass
    issues = []
    for n in (10,):
        ch = chapters[n]
        prose = ch["breakdown"]["fastRead"] + "\n" + ch["breakdown"]["deepRead"] + "\n" + ch["breakdown"]["fullRead"]
        for i, ml in enumerate(ch["memorableLines"]):
            if ml["text"] not in prose:
                issues.append(f"Ch{n} memLine[{i}] BROKEN: '{ml['text'][:60]}...'")

    if issues:
        print("MEMLINE ISSUES:")
        for i in issues:
            print(f"  {i}")

    # Verify v13 names now absent across breakdowns AND examples
    test_text_parts = []
    for c in d["chapters"]:
        test_text_parts.append(c["breakdown"]["fastRead"])
        test_text_parts.append(c["breakdown"]["deepRead"])
        test_text_parts.append(c["breakdown"]["fullRead"])
        for ex in c.get("examples", []):
            for field in ("scenario", "title", "whatToDo", "whyItMatters"):
                if field in ex and isinstance(ex[field], str):
                    test_text_parts.append(ex[field])
    full = " ".join(test_text_parts)

    v13_names = ["Priya", "Omar", "Maya", "Sam", "Aisha", "Marcus", "Chen", "Sarah",
                 "Jordan", "Jess", "Alex", "Maria", "Kai", "Nia", "Dev", "Ravi",
                 "Anika", "Jamal", "Hannah", "Liam"]
    remaining = {}
    for n in v13_names:
        c = len(re.findall(rf'\b{n}\b', full))
        if c > 0:
            remaining[n] = c
    if remaining:
        print(f"REMAINING v13 NAMES: {remaining}")
    else:
        print("v13 name check: CLEAN")

    with open(PATH, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nWrote {PATH}")


if __name__ == "__main__":
    main()
