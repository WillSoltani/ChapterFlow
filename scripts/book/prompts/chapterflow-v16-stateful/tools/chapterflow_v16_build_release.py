
#!/usr/bin/env python3
from pathlib import Path
import json, sys, uuid, datetime

def load_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def main():
    if len(sys.argv) != 3:
        print("Usage: chapterflow_v16_build_release.py <pack_root> <run_root>")
        sys.exit(2)
    pack_root = Path(sys.argv[1])
    run_root = Path(sys.argv[2])
    manifest = load_json(run_root / "manifests" / "run-manifest.json")
    validated_files = sorted((run_root / "validated").glob("ch*.chapter.json"))
    chapters = [load_json(p) for p in validated_files]
    book = {
        "bookId": manifest["bookId"],
        "title": manifest["title"],
        "author": manifest["author"],
        "categories": manifest.get("categories", []),
        "tags": manifest.get("tags", []),
        "edition": manifest.get("edition", {}),
        "variantFamily": "EMH",
    }
    package = {
        "schemaVersion": "1.1.0",
        "packageId": str(uuid.uuid4()),
        "createdAt": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "contentOwner": "ChapterFlow",
        "book": book,
        "chapters": chapters,
    }
    out = run_root / "release" / f"{manifest['bookId']}.modern.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(out)
if __name__ == "__main__":
    main()
