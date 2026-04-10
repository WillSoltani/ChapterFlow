#!/usr/bin/env python3
import json, re, sys
from pathlib import Path

CONTAMINATION_PATTERNS = [
    r"\bkeep the prose narrow and concrete\b",
    r"\bkeep this question alive\b",
    r"\bthreshold question\b",
    r"\breading calibration\b",
    r"\bunsupported zones\b",
    r"\bused lazily, the point turns into\b",
    r"\bkeep the judgment close to the source\b",
]

META_PATTERNS = [
    r"\bthe chapter says\b",
    r"\bthe chapter teaches\b",
    r"\bthe chapter's\b",
    r"\bChapter \d+\b",
]

def iter_strings(obj, path="$"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from iter_strings(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from iter_strings(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj

def is_tone_object(x):
    return isinstance(x, dict) and set(x.keys()) >= {"gentle", "direct", "competitive"} and all(isinstance(x[k], str) and x[k].strip() for k in ["gentle","direct","competitive"])

def check_tone_object(x, path, findings):
    if not is_tone_object(x):
        findings.append(("FAIL", path, "expected tone object"))
        return
    vals = [x["gentle"].strip(), x["direct"].strip(), x["competitive"].strip()]
    if len(set(vals)) < 3:
        findings.append(("FAIL", path, "tone collapse: identical variants"))

def lint_chapter(ch, findings):
    quiz = ch.get("quiz")
    if not isinstance(quiz, dict) or not isinstance(quiz.get("questions"), list) or len(quiz.get("questions")) == 0:
        findings.append(("FAIL", "$.quiz.questions", "quiz missing or empty"))
    elif len(quiz["questions"]) != 10:
        findings.append(("WARN", "$.quiz.questions", f"expected 10 questions, found {len(quiz['questions'])}"))
    for idx, ex in enumerate(ch.get("examples", [])):
        check_tone_object(ex.get("scenario"), f"$.examples[{idx}].scenario", findings)
        check_tone_object(ex.get("whatToDo"), f"$.examples[{idx}].whatToDo", findings)
        check_tone_object(ex.get("whyItMatters"), f"$.examples[{idx}].whyItMatters", findings)
    for p, s in iter_strings(ch):
        for pat in CONTAMINATION_PATTERNS:
            if re.search(pat, s, flags=re.I):
                findings.append(("FAIL", p, f"contamination phrase: {pat}"))
        if re.search(r"\b(\w+)\s+\1\b", s, flags=re.I):
            findings.append(("WARN", p, "repeated consecutive word"))
        if re.search(r"(?:^|[\.\?!]\s+)(?:you just|the|a|and|but|or)\s*$", s.strip(), flags=re.I):
            findings.append(("WARN", p, "possible truncation"))
    # required tone object surfaces if present
    cv = ch.get("contentVariants", {})
    for depth in ["easy", "medium", "hard"]:
        dv = cv.get(depth, {})
        if "chapterBreakdown" in dv: check_tone_object(dv["chapterBreakdown"], f"$.contentVariants.{depth}.chapterBreakdown", findings)
        for ti, tk in enumerate(dv.get("keyTakeaways", [])):
            check_tone_object(tk.get("point"), f"$.contentVariants.{depth}.keyTakeaways[{ti}].point", findings)
            if depth in ("medium","hard") and "moreDetails" in tk:
                check_tone_object(tk["moreDetails"], f"$.contentVariants.{depth}.keyTakeaways[{ti}].moreDetails", findings)

def main():
    if len(sys.argv) < 2:
        print("Usage: chapterflow_v15_lint.py <json-path> [chapter_gate|release_gate]")
        sys.exit(2)
    path = Path(sys.argv[1])
    mode = sys.argv[2] if len(sys.argv) > 2 else "chapter_gate"
    data = json.loads(path.read_text(encoding="utf-8"))
    findings = []
    if "chapters" in data:
        for idx, ch in enumerate(data["chapters"]):
            lint_chapter(ch, findings)
    else:
        lint_chapter(data, findings)
    meta_count = 0
    for p, s in iter_strings(data):
        for pat in META_PATTERNS:
            if re.search(pat, s):
                meta_count += 1
    print(f"MODE: {mode}")
    print(f"META_REFERENCES: {meta_count}")
    fail_count = 0
    warn_count = 0
    for sev, p, msg in findings:
        print(f"{sev}: {p}: {msg}")
        if sev == "FAIL": fail_count += 1
        if sev == "WARN": warn_count += 1
    print(f"SUMMARY FAIL={fail_count} WARN={warn_count}")
    sys.exit(1 if fail_count else 0)

if __name__ == "__main__":
    main()
