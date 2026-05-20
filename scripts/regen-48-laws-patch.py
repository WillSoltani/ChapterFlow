#!/usr/bin/env python3
"""Patch the 6 genuine validation issues in agent batch outputs before merge.

- Ch7 memLine[1]: agent wrote "She had..." but prose says "Inara had..." — fix the memLine.
- Ch8 memLine[0]: "He had not asked once." (22 chars, under 30) — extend with preceding sentence.
- Ch9 memLine[1]: "The work had said it." (21 chars, under 30) — extend with preceding sentence.
- Ch22: "Chiang Kai-shek" → "Chiang's Nationalist army" / "the Nationalists" (Kai forbidden via word-boundary).
- Ch35: same — multiple "Chiang Kai-shek" replacements.
- Ch45 memLine[1]: change to lowercase to match prose verbatim.
"""
import json
from pathlib import Path

ROOT = Path("/Users/willsoltani/dev/chapterflow-siliconx")
BATCH_DIR = ROOT / "scripts/48-laws-batches"


def patch_ch5_8():
    path = BATCH_DIR / "batch-ch5-8.json"
    d = json.load(open(path))
    for u in d["updates"]:
        if u["number"] == 7:
            # memLine[1]: fix "She had..." to "Inara had..." to match prose verbatim
            u["memorableLines"][1]["text"] = "Inara had personally authored none of the pieces that built the reputation. She had authored the field in which the pieces could exist."
        elif u["number"] == 8:
            # memLine[0]: extend "He had not asked once." with the preceding sentence (uses "Tariq", not "He")
            u["memorableLines"][0]["text"] = "Tariq let the visitor explain what the visitor needed. He had not asked once."
    json.dump(d, open(path, "w"), indent=2, ensure_ascii=False)
    print(f"Patched {path.name}")


def patch_ch9_12():
    path = BATCH_DIR / "batch-ch9-12.json"
    d = json.load(open(path))
    for u in d["updates"]:
        if u["number"] == 9:
            # memLine[1]: extend "The work had said it." with preceding sentence
            u["memorableLines"][1]["text"] = "When the ceiling was unveiled in October 1512, no one argued with him about whether he was a sculptor or a painter ever again. The work had said it."
    json.dump(d, open(path, "w"), indent=2, ensure_ascii=False)
    print(f"Patched {path.name}")


def patch_ch21_24():
    path = BATCH_DIR / "batch-ch21-24.json"
    d = json.load(open(path))
    for u in d["updates"]:
        if u["number"] == 22:
            # Replace all "Chiang Kai-shek" with "Chiang" (drop the "Kai-shek" portion)
            # — and any standalone "Kai" too, though there shouldn't be any.
            for tier in ("fastRead", "deepRead", "fullRead"):
                u["breakdown"][tier] = u["breakdown"][tier].replace("Chiang Kai-shek", "Chiang")
            u["hook"] = u["hook"].replace("Chiang Kai-shek", "Chiang")
            u["counterintuition"] = u["counterintuition"].replace("Chiang Kai-shek", "Chiang")
            u["keyTakeaway"] = u["keyTakeaway"].replace("Chiang Kai-shek", "Chiang")
            u["tryThisNow"] = u["tryThisNow"].replace("Chiang Kai-shek", "Chiang")
    json.dump(d, open(path, "w"), indent=2, ensure_ascii=False)
    print(f"Patched {path.name}")


def patch_ch33_36():
    path = BATCH_DIR / "batch-ch33-36.json"
    d = json.load(open(path))
    for u in d["updates"]:
        if u["number"] == 35:
            for tier in ("fastRead", "deepRead", "fullRead"):
                u["breakdown"][tier] = u["breakdown"][tier].replace("Chiang Kai-shek", "Chiang")
            u["hook"] = u["hook"].replace("Chiang Kai-shek", "Chiang")
            u["counterintuition"] = u["counterintuition"].replace("Chiang Kai-shek", "Chiang")
            u["keyTakeaway"] = u["keyTakeaway"].replace("Chiang Kai-shek", "Chiang")
            u["tryThisNow"] = u["tryThisNow"].replace("Chiang Kai-shek", "Chiang")
    json.dump(d, open(path, "w"), indent=2, ensure_ascii=False)
    print(f"Patched {path.name}")


def patch_ch45_48():
    path = BATCH_DIR / "batch-ch45-48.json"
    d = json.load(open(path))
    for u in d["updates"]:
        if u["number"] == 45:
            # memLine[1] capitalization mismatch — prose has lowercase "human beings"
            u["memorableLines"][1]["text"] = "human beings hate revolution and tolerate restoration."
    json.dump(d, open(path, "w"), indent=2, ensure_ascii=False)
    print(f"Patched {path.name}")


def main():
    patch_ch5_8()
    patch_ch9_12()
    patch_ch21_24()
    patch_ch33_36()
    patch_ch45_48()
    print("\nAll 6 patches applied. Re-run merger to verify.")


if __name__ == "__main__":
    main()
