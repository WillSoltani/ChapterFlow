#!/usr/bin/env python3
import sys, json, hashlib
from pathlib import Path

def canonical(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))

def sha(obj):
    return hashlib.sha256(canonical(obj).encode("utf-8")).hexdigest()

def main():
    if len(sys.argv) != 3:
        print("Usage: chapterflow_v13_release_guard.py RUN_ROOT RELEASE_JSON")
        sys.exit(2)

    run_root = Path(sys.argv[1])
    release_path = Path(sys.argv[2])
    fails = []

    if not (run_root / 'manifests' / 'source-ledger.json').exists():
        fails.append('source-ledger.json missing')
    if not (run_root / 'manifests' / 'edition-lock.json').exists():
        fails.append('edition-lock.json missing')

    if not release_path.exists():
        fails.append(f"release missing: {release_path}")
        for f in fails:
            print("FAIL", f)
        print(f"FAIL={len(fails)} WARN=0")
        sys.exit(1)

    release = json.loads(release_path.read_text(encoding="utf-8"))
    chapters = release.get("chapters", [])
    by_num = {ch["number"]: ch for ch in chapters if isinstance(ch, dict) and "number" in ch}

    continuity_path = run_root / "continuity" / "continuity-state.json"
    sealed = {}
    if continuity_path.exists():
        continuity = json.loads(continuity_path.read_text(encoding="utf-8"))
        sealed = continuity.get("approvedChapterHashes", {}) or {}

    validated_dir = run_root / "validated"
    for p in sorted(validated_dir.glob("ch*.chapter.json")):
        ch = json.loads(p.read_text(encoding="utf-8"))
        num = ch.get("number")
        if num not in by_num:
            fails.append(f"release missing chapter number {num}")
            continue
        if sha(ch) != sha(by_num[num]):
            fails.append(f"release chapter {num} does not match validated chapter")
        code = f"ch{num:02d}"
        sealed_entry = sealed.get(code)
        if sealed_entry:
            if isinstance(sealed_entry, dict):
                sealed_hash = sealed_entry.get("chapterSha256") or sealed_entry.get("sha256")
            else:
                sealed_hash = sealed_entry
            validated_hash = sha(ch)
            if sealed_hash and sealed_hash != validated_hash:
                fails.append(f"sealed hash mismatch for {code}")

    for f in fails:
        print("FAIL", f)
    print(f"FAIL={len(fails)} WARN=0")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
