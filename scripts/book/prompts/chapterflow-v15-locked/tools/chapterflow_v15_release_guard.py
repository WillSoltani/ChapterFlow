#!/usr/bin/env python3
import json, sys, hashlib
from pathlib import Path

def norm(obj):
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def sha(obj):
    return hashlib.sha256(norm(obj).encode("utf-8")).hexdigest()

def main():
    if len(sys.argv) != 3:
        print("Usage: chapterflow_v15_release_guard.py RUN_ROOT RELEASE_PATH")
        sys.exit(2)
    run_root = Path(sys.argv[1])
    release_path = Path(sys.argv[2])
    release = json.loads(release_path.read_text(encoding="utf-8"))
    validated_root = run_root / "validated"
    validated = {}
    for p in validated_root.glob("ch*.chapter.json"):
        ch = json.loads(p.read_text(encoding="utf-8"))
        validated[int(ch["number"])] = ch
    fail = False
    if "chapters" not in release:
        print("FAIL: release missing chapters array")
        sys.exit(1)
    if len(release["chapters"]) != len(validated):
        print(f"FAIL: release chapters {len(release['chapters'])} != validated {len(validated)}")
        fail = True
    for ch in release["chapters"]:
        n = int(ch["number"])
        if n not in validated:
            print(f"FAIL: release chapter {n} missing validated source")
            fail = True
            continue
        if sha(ch) != sha(validated[n]):
            print(f"FAIL: release chapter {n} does not match validated artifact")
            fail = True
    if not fail:
        print("PASS: release assembled from validated chapters only")
    sys.exit(1 if fail else 0)

if __name__ == "__main__":
    main()
