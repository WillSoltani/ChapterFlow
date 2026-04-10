#!/usr/bin/env python3
import sys
from pathlib import Path

REQUIRED_MANIFESTS = ["source-ledger.json", "edition-lock.json"]
REQUIRED_FREEZE = ["source-discovery.md", "source-freeze-report.md", "toc.json"]

def main():
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v13_source_guard.py RUN_ROOT")
        sys.exit(2)
    run_root = Path(sys.argv[1])
    fails = []
    manifests = run_root / 'manifests'
    for name in REQUIRED_MANIFESTS:
        if not (manifests / name).exists():
            fails.append(f"missing {manifests / name}")
    freeze = run_root / 'source-freeze'
    if not freeze.exists():
        fails.append('source-freeze directory missing')
    else:
        for name in REQUIRED_FREEZE:
            if not (freeze / name).exists():
                fails.append(f"missing {freeze / name}")
        if not any((freeze / name).exists() for name in ['book-source.txt', 'book-source.md']):
            fails.append('missing frozen primary text or preview file in source-freeze')
    for f in fails:
        print('FAIL', f)
    print(f"FAIL={len(fails)} WARN=0")
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
