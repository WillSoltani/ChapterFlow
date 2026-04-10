#!/usr/bin/env python3
import json, sys, hashlib
from pathlib import Path

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def main(run_root):
    run = Path(run_root)
    validated = sorted((run/'validated').glob('ch*.chapter.json'))
    if not validated:
        print("FAIL\nno validated chapters found")
        raise SystemExit(1)
    out = {}
    for p in validated:
        out[p.name] = sha(p)
    hashes = run/'manifests'/'validated-chapter-hashes.json'
    if hashes.exists():
        existing = json.loads(hashes.read_text(encoding='utf-8'))
        drift = [k for k,v in out.items() if k in existing and existing[k] != v]
        if drift:
            print("FAIL")
            for d in drift:
                print(f"hash drift {d}")
            raise SystemExit(1)
    else:
        hashes.write_text(json.dumps(out, indent=2) + '\n', encoding='utf-8')
    print("PASS")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v14_artifact_guard.py RUN_ROOT")
        raise SystemExit(2)
    main(sys.argv[1])
