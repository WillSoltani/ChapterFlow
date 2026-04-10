#!/usr/bin/env python3
import sys, pathlib, json, re, hashlib

CONTAMINATION_PHRASES = [
    "keep the prose narrow and concrete",
    "used lazily, the point turns into",
    "threshold question",
    "reading calibration",
    "keep this question alive",
    "source is short and works by contrast",
]

TRUNCATION_EXEMPT_KEYS = {
    "chapterId",
    "exampleId",
    "questionId",
    "cardId",
    "format",
    "endingType",
    "category",
    "difficulty",
}

def load_jsons(root):
    files = []
    for sub in ["validated", "release"]:
        d = root / sub
        if d.exists():
            files.extend(sorted(d.glob("*.json")))
    return files

def scan_obj(obj, issues, path=""):
    if isinstance(obj, dict):
        # tone collapse check
        if set(obj.keys()) >= {"gentle","direct","competitive"}:
            vals = [obj.get("gentle",""), obj.get("direct",""), obj.get("competitive","")]
            if any(not isinstance(v, str) for v in vals):
                pass
            else:
                if len(set(vals)) < 3:
                    issues.append(f"Tone collapse at {path}")
        for k,v in obj.items():
            new_path = f"{path}.{k}" if path else k
            if k == "scenario" and isinstance(v, str):
                issues.append(f"Scenario is plain string at {new_path}")
            scan_obj(v, issues, new_path)
    elif isinstance(obj, list):
        for i,v in enumerate(obj):
            scan_obj(v, issues, f"{path}[{i}]")
    elif isinstance(obj, str):
        low = obj.lower()
        key_name = path.split(".")[-1] if path else ""
        for phrase in CONTAMINATION_PHRASES:
            if phrase in low:
                issues.append(f"Contamination phrase '{phrase}' at {path}")
        if re.search(r'\b(\w+)\s+\1\b', obj.lower()):
            issues.append(f"Repeated consecutive word at {path}")
        if key_name not in TRUNCATION_EXEMPT_KEYS and obj.strip().endswith(("you just", "the", "a", "and", "but", "or")):
            issues.append(f"Possible truncation at {path}")

def main(run_root):
    run_root = pathlib.Path(run_root)
    issues = []
    files = load_jsons(run_root)
    if not files:
        print("No validated/release JSON files found.")
        sys.exit(1)
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            issues.append(f"Invalid JSON: {f}: {e}")
            continue
        scan_obj(data, issues, path=f.name)
        # quiz empty
        if f.name.endswith(".chapter.json") or f.name.endswith(".review-package.json") or f.name.endswith(".modern.json"):
            chapters = data.get("chapters", [])
            for ch in chapters:
                quiz = ch.get("quiz")
                if isinstance(quiz, dict) and quiz.get("questions") == []:
                    issues.append(f"Empty quiz questions in {f.name} chapter {ch.get('number')}")
    if issues:
        print("ARTIFACT GUARD FAIL")
        for i in issues:
            print("-", i)
        sys.exit(1)
    print("ARTIFACT GUARD PASS")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v17_artifact_guard.py <run_root>")
        sys.exit(2)
    main(sys.argv[1])
