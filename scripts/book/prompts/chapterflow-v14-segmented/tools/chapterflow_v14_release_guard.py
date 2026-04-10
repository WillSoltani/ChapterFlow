#!/usr/bin/env python3
import json, sys, hashlib
from pathlib import Path

def sha_bytes(data: bytes):
    return hashlib.sha256(data).hexdigest()

def main(run_root, release_path):
    run = Path(run_root)
    release = Path(release_path)
    if not release.exists():
        print("FAIL\nrelease package missing")
        raise SystemExit(1)
    data = json.loads(release.read_text(encoding='utf-8'))
    validated = {p.stem.split('.')[0]: json.loads(p.read_text(encoding='utf-8')) for p in (run/'validated').glob('ch*.chapter.json')}
    chapters = data.get('chapters', [])
    problems = []
    for ch in chapters:
        key = f"ch{int(ch['number']):02d}"
        if key not in validated:
            problems.append(f"validated chapter missing for {key}")
            continue
        if sha_bytes(json.dumps(ch, sort_keys=True, ensure_ascii=False).encode()) != sha_bytes(json.dumps(validated[key], sort_keys=True, ensure_ascii=False).encode()):
            problems.append(f"release chapter differs from validated {key}")
    if problems:
        print("FAIL")
        for p in problems:
            print(p)
        raise SystemExit(1)
    print("PASS")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: chapterflow_v14_release_guard.py RUN_ROOT RELEASE_JSON")
        raise SystemExit(2)
    main(sys.argv[1], sys.argv[2])
