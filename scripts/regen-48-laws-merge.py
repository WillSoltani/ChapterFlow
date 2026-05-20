#!/usr/bin/env python3
"""Merge all batch-chN-M.json outputs from parallel agents into the 48 Laws package.

Reads all files matching scripts/48-laws-batches/batch-ch*.json, applies each
chapter update to the package, validates floors and banned phrases, and writes
the package back.
"""
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path("/Users/willsoltani/dev/chapterflow-siliconx")
PACKAGE = ROOT / "book-packages/the-48-laws-of-power.v21.json"
BATCH_DIR = ROOT / "scripts/48-laws-batches"

# Banned phrases that should not appear anywhere in regenerated prose
BANNED_PHRASES = [
    "boundary condition", "keeps the chapter honest", "keeps the chapter from",
    "strips away", "is not decorative", "is not magic", "operating logic",
    "tidy explanation", "selective suspicion", "diagnostic discipline",
    "durable practice", "usable lesson", "reframes behavior",
    "installs the operational", "On a note beside the work",
    "Most readers assume", "Most readers think", "Most people assume",
    "Most people think", "The paradox is that", "The paradox is this",
    "The mistaken move is", "The dangerous move is", "The last mistake is",
    "The mistake is to", "The trap is to", "The trap is not",
    "Keep the clue", "Leave the costume",
    "in three plain moves", "point toward the chosen work",
    "If the next act is visible", "The easy mistake is",
    "The mistake is treating", "the real lever is",
    "That matters because", "chapter argues that", "The chapter argues",
    # Task-specific bans
    "on the table makes",  # the failed slot-fill template
    "the real lever is", "the real X is", "the hidden X is",
    "the stronger X is", "the sharper X is", "the deeper X is",
]

# v13 + banned modern pool — should NOT appear in regenerated chapters
FORBIDDEN_NAMES = {
    "Priya", "Omar", "Maya", "Marcus", "Elena", "Lena", "Victor", "Theo",
    "Jonah", "Mateo", "Tessa", "Owen", "Mira", "Malik", "Nadia", "Felix",
    "Caleb", "Talia", "Elise", "Naomi",
    "Sarah", "Jordan", "Jess", "Alex", "Maria", "Kai", "Nia", "Dev", "Ravi",
    "Anika", "Jamal", "Hannah", "Liam", "Aisha", "Chen", "Sam",
}

REQUIRED_FIELDS = {
    "hook", "counterintuition", "keyTakeaway", "tryThisNow",
    "breakdown", "memorableLines"
}


def validate_update(u: dict) -> list[str]:
    issues = []
    n = u.get("number", "?")

    # Required fields
    for f in REQUIRED_FIELDS:
        if f not in u:
            issues.append(f"Ch{n}: missing field '{f}'")
            return issues

    # Field length ranges
    h = len(u["hook"])
    if h < 60 or h > 140:
        issues.append(f"Ch{n} hook={h} chars OUT OF RANGE 60-140")
    c = len(u["counterintuition"])
    if c < 80 or c > 280:
        issues.append(f"Ch{n} counterintuition={c} chars OUT OF RANGE 80-280")

    br = u["breakdown"]
    # Task verification only enforces UNDER-floor. Over-ceiling we log but don't block.
    for tier, lo, hi in (("fastRead", 400, 700), ("deepRead", 1200, 1800), ("fullRead", 2800, 3800)):
        if tier not in br:
            issues.append(f"Ch{n}: missing breakdown.{tier}")
            continue
        l = len(br[tier])
        if l < lo:
            issues.append(f"Ch{n} {tier}={l} UNDER floor {lo}")

    # KeyTakeaway word count
    kt_words = len(u["keyTakeaway"].split())
    if kt_words > 30:
        issues.append(f"Ch{n} keyTakeaway={kt_words} words OVER 30-word limit")

    # MemorableLines: 3 items, each 30-180 chars, verbatim in breakdown
    if not isinstance(u["memorableLines"], list) or len(u["memorableLines"]) != 3:
        issues.append(f"Ch{n}: memorableLines must be exactly 3 items, got {len(u.get('memorableLines', []))}")
    else:
        all_prose = br.get("fastRead", "") + "\n" + br.get("deepRead", "") + "\n" + br.get("fullRead", "")
        for i, ml in enumerate(u["memorableLines"]):
            if not isinstance(ml, dict) or "text" not in ml or "location" not in ml:
                issues.append(f"Ch{n} memorableLines[{i}]: missing text/location")
                continue
            t = ml["text"]
            tl = len(t)
            if tl < 30 or tl > 180:
                issues.append(f"Ch{n} memLine[{i}] len={tl} OUT OF RANGE 30-180")
            if t not in all_prose:
                issues.append(f"Ch{n} memLine[{i}] NOT VERBATIM in breakdown: '{t[:60]}...'")

    # Em dash check (anywhere)
    all_text = u["hook"] + " " + u["counterintuition"] + " " + u["keyTakeaway"] + " " + u["tryThisNow"] + " " + br.get("fastRead", "") + " " + br.get("deepRead", "") + " " + br.get("fullRead", "")
    if "—" in all_text:
        issues.append(f"Ch{n}: em-dash found in prose (use periods or commas)")

    # Banned phrases (case-insensitive)
    lower = all_text.lower()
    for p in BANNED_PHRASES:
        if p.lower() in lower:
            issues.append(f"Ch{n}: banned phrase '{p}' found")

    # Forbidden names (whole-word)
    for name in FORBIDDEN_NAMES:
        if re.search(rf'\b{re.escape(name)}\b', all_text):
            issues.append(f"Ch{n}: forbidden name '{name}' found in prose")

    return issues


def main():
    if not BATCH_DIR.exists():
        print(f"ERROR: batch dir {BATCH_DIR} not found")
        sys.exit(1)

    batch_files = sorted(glob.glob(str(BATCH_DIR / "batch-ch*.json")))
    if not batch_files:
        print(f"ERROR: no batch files in {BATCH_DIR}")
        sys.exit(1)

    print(f"Found {len(batch_files)} batch files:")
    for bf in batch_files:
        print(f"  {Path(bf).name}")

    # Load package
    pkg = json.load(open(PACKAGE))
    chapters_by_num = {c["number"]: c for c in pkg["chapters"]}

    all_updates = []
    all_issues = []
    chapters_covered = set()

    for bf in batch_files:
        try:
            batch = json.load(open(bf))
        except Exception as e:
            all_issues.append(f"{Path(bf).name}: JSON parse error: {e}")
            continue
        if "updates" not in batch or not isinstance(batch["updates"], list):
            all_issues.append(f"{Path(bf).name}: missing 'updates' list")
            continue
        for u in batch["updates"]:
            n = u.get("number")
            if n is None or not isinstance(n, int):
                all_issues.append(f"{Path(bf).name}: chapter missing valid 'number' field")
                continue
            if n in chapters_covered:
                all_issues.append(f"{Path(bf).name}: duplicate chapter {n}")
                continue
            chapters_covered.add(n)
            issues = validate_update(u)
            all_issues.extend(issues)
            all_updates.append(u)

    # Expected: chapters 5-48 covered
    expected = set(range(5, 49))
    missing = expected - chapters_covered
    extra = chapters_covered - expected
    if missing:
        all_issues.append(f"MISSING chapters: {sorted(missing)}")
    if extra:
        all_issues.append(f"UNEXPECTED chapters (outside 5-48): {sorted(extra)}")

    print(f"\nValidation: {len(all_issues)} issue(s) across {len(all_updates)} chapter updates")
    if all_issues:
        print("\nISSUES:")
        for i in all_issues:
            print(f"  {i}")

    if "--dry-run" in sys.argv:
        print("\n(dry-run: not writing package)")
        return 0 if not all_issues else 1

    if all_issues and "--force" not in sys.argv:
        print("\nRefusing to merge with validation issues. Use --force to override.")
        return 1

    # Apply updates
    for u in all_updates:
        ch = chapters_by_num[u["number"]]
        ch["hook"] = u["hook"]
        ch["counterintuition"] = u["counterintuition"]
        ch["keyTakeaway"] = u["keyTakeaway"]
        ch["tryThisNow"] = u["tryThisNow"]
        ch["breakdown"]["fastRead"] = u["breakdown"]["fastRead"]
        ch["breakdown"]["deepRead"] = u["breakdown"]["deepRead"]
        ch["breakdown"]["fullRead"] = u["breakdown"]["fullRead"]
        ch["memorableLines"] = u["memorableLines"]

    with open(PACKAGE, "w") as f:
        json.dump(pkg, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Tier summary
    print("\nTIER LENGTHS (merged):")
    for u in sorted(all_updates, key=lambda x: x["number"]):
        br = u["breakdown"]
        print(f"  Ch{u['number']:2d}: fast={len(br['fastRead']):4d} deep={len(br['deepRead']):4d} full={len(br['fullRead']):4d}")

    print(f"\nMerged {len(all_updates)} chapters into {PACKAGE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
