#!/usr/bin/env python3
import json, sys, re
from pathlib import Path

contamination_phrases = [
    "keep the prose narrow and concrete",
    "keep this question alive",
    "used lazily, the point turns into",
    "reading calibration",
    "threshold question",
]

def flatten(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            yield from flatten(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from flatten(v)
    elif isinstance(obj, str):
        yield obj

def main(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    issues = []
    texts = list(flatten(data))
    for t in texts:
        low = t.lower()
        for p in contamination_phrases:
            if p in low:
                issues.append(f"contamination phrase: {p}")
        if re.search(r'\b(\w+)\s+\1\b', t, re.I):
            issues.append("repeated consecutive word")
    if issues:
        print("FAIL")
        for i in sorted(set(issues)):
            print(i)
        raise SystemExit(1)
    print("PASS")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v14_lint.py <json-path>")
        raise SystemExit(2)
    main(sys.argv[1])
