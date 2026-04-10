#!/usr/bin/env python3
import sys, pathlib, json, hashlib

def sha256_bytes(b):
    import hashlib
    h = hashlib.sha256()
    h.update(b)
    return h.hexdigest()

def main(run_root):
    run_root = pathlib.Path(run_root)
    release_files = list((run_root / "release").glob("*.json"))
    if not release_files:
        print("RELEASE GUARD FAIL")
        print("No release JSON found")
        sys.exit(1)
    release_path = release_files[0]
    data = json.loads(release_path.read_text(encoding="utf-8"))
    commits_dir = run_root / "commits"
    if not commits_dir.exists():
        print("RELEASE GUARD FAIL")
        print("No commits directory")
        sys.exit(1)
    commit_files = sorted(commits_dir.glob("ch*.commit.json"))
    commit_map = {}
    for cf in commit_files:
        c = json.loads(cf.read_text(encoding="utf-8"))
        commit_map[c["chapter"]] = c["hashes"]["validatedChapter"]

    issues = []
    chapters = data.get("chapters", [])
    for ch in chapters:
        num = ch.get("number")
        val_path = run_root / "validated" / f"ch{num:02d}.chapter.json"
        if not val_path.exists():
            issues.append(f"Missing validated chapter for {num}")
            continue
        val = json.loads(val_path.read_text(encoding="utf-8"))
        if isinstance(val, dict) and "chapters" in val:
            payloads = val.get("chapters") or []
            if len(payloads) != 1:
                issues.append(f"Validated wrapper for {num} must contain exactly one chapter payload")
                continue
            val = payloads[0]
        # compare chapter payload exactly
        if ch != val:
            issues.append(f"Release chapter {num} differs from validated chapter JSON")
    if issues:
        print("RELEASE GUARD FAIL")
        for i in issues:
            print("-", i)
        sys.exit(1)
    print("RELEASE GUARD PASS")
    print(release_path)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v17_release_guard.py <run_root>")
        sys.exit(2)
    main(sys.argv[1])
