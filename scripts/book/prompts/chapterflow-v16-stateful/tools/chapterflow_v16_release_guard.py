
#!/usr/bin/env python3
from pathlib import Path
import json, sys

def load_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def norm(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False)

def main():
    if len(sys.argv) != 3:
        print("Usage: chapterflow_v16_release_guard.py <run_root> <release_json_path>")
        sys.exit(2)
    run_root = Path(sys.argv[1])
    release_path = Path(sys.argv[2])
    release = load_json(release_path)
    chapters = release.get("chapters")
    if not isinstance(chapters, list) or not chapters:
        print("FAIL: release has no chapters array")
        sys.exit(1)
    validated_files = sorted((run_root / "validated").glob("ch*.chapter.json"))
    if len(validated_files) != len(chapters):
        print(f"FAIL: release chapter count {len(chapters)} != validated files {len(validated_files)}")
        sys.exit(1)
    for vf, rel_ch in zip(validated_files, chapters):
        val_ch = load_json(vf)
        if norm(val_ch) != norm(rel_ch):
            print(f"FAIL: release chapter differs from validated file: {vf.name}")
            sys.exit(1)
    print("PASS: release guard clean")
if __name__ == "__main__":
    main()
