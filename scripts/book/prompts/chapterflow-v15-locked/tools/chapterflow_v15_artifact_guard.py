#!/usr/bin/env python3
import json, re, sys, hashlib
from pathlib import Path

CONTAMINATION = [
    "keep the prose narrow and concrete",
    "keep this question alive",
    "threshold question",
    "reading calibration",
    "used lazily, the point turns into",
]

def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def count_meta(obj):
    txt = json.dumps(obj, ensure_ascii=False)
    return len(re.findall(r"\b(the chapter says|the chapter teaches|the chapter's|Chapter \d+)\b", txt, flags=re.I))

def chapter_checks(ch):
    issues = []
    if not ch.get("quiz", {}).get("questions"):
        issues.append("empty quiz")
    for i, ex in enumerate(ch.get("examples", [])):
        sc = ex.get("scenario")
        if not isinstance(sc, dict) or not all(k in sc for k in ("gentle","direct","competitive")):
            issues.append(f"example {i+1} scenario not tone object")
    txt = json.dumps(ch, ensure_ascii=False)
    for c in CONTAMINATION:
        if c.lower() in txt.lower():
            issues.append(f"contamination: {c}")
    return issues

def main():
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v15_artifact_guard.py RUN_ROOT")
        sys.exit(2)
    run_root = Path(sys.argv[1])
    validated = run_root / "validated"
    report_lines = []
    cal_paths = [validated / "ch01.chapter.json", validated / "ch02.chapter.json"]
    if not all(p.exists() for p in cal_paths):
        print("Missing calibration chapters")
        sys.exit(1)
    cal_chs = [load_json(p) for p in cal_paths]
    baseline_meta = max(count_meta(ch) for ch in cal_chs)
    fail = False
    for p in sorted(validated.glob("ch*.chapter.json")):
        ch = load_json(p)
        issues = chapter_checks(ch)
        meta = count_meta(ch)
        if meta > baseline_meta * 2 + 10:
            issues.append(f"meta-distance spike: {meta} vs baseline {baseline_meta}")
        if issues:
            fail = True
            report_lines.append(f"{p.name}: FAIL")
            for i in issues:
                report_lines.append(f"- {i}")
        else:
            report_lines.append(f"{p.name}: PASS")
    out = run_root / "reports" / "latest.artifact-guard.md"
    out.write_text("\n".join(report_lines) + "\n", encoding="utf-8")
    print("\n".join(report_lines))
    sys.exit(1 if fail else 0)

if __name__ == "__main__":
    main()
