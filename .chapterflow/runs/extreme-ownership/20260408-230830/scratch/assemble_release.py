#!/usr/bin/env python3
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path


RUN_ROOT = Path(".chapterflow/runs/extreme-ownership/20260408-230830")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    manifest = load_json(RUN_ROOT / "manifests" / "run-manifest.json")
    edition_lock = load_json(RUN_ROOT / "manifests" / "edition-lock.json")
    source_ledger = load_json(RUN_ROOT / "manifests" / "source-ledger.json")

    chapters = []
    for path in sorted((RUN_ROOT / "validated").glob("ch*.chapter.json")):
        chapters.append(load_json(path))
    chapters.sort(key=lambda ch: ch["number"])

    chosen = edition_lock["chosenEdition"]
    source_text = manifest["book"]["edition"]["sourceText"]
    source_provenance = (
        "Frozen web bundle: Open Library first-edition record, Google Books authorized preview metadata, "
        "Macmillan official work-family page excerpt, and SuperSummary chapter-level secondary summaries."
    )

    pkg = {
        "schemaVersion": "1.1.0",
        "packageId": str(uuid.uuid4()),
        "createdAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "contentOwner": "ChapterFlow",
        "book": {
            "bookId": manifest["book"]["bookId"],
            "title": manifest["book"]["title"],
            "author": manifest["book"]["author"],
            "categories": ["Leadership", "Management", "Business"],
            "tags": ["leadership", "ownership", "accountability", "teamwork", "decision-making"],
            "edition": {
                "name": chosen["name"],
                "publisher": chosen["publisher"],
                "publishedDate": chosen["publishedDate"],
                "publishedYear": chosen["publishedYear"],
                "isbn13": chosen["isbn13"],
                "format": chosen["format"],
                "sourceText": source_text,
                "sourceProvenance": source_provenance,
            },
            "variantFamily": manifest["book"]["variantFamily"],
        },
        "chapters": chapters,
    }

    release_dir = RUN_ROOT / "release"
    release_dir.mkdir(parents=True, exist_ok=True)
    release_path = release_dir / f'{manifest["book"]["bookId"]}.modern.json'
    release_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    run_log = RUN_ROOT / "reports" / "run-log.md"
    if run_log.exists():
        log_line = (
            f"- {datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')} - "
            f"Release assembly wrote `release/{manifest['book']['bookId']}.modern.json` from validated chapter JSONs only. "
            f"Edition lock and source ledger remained unchanged. Source ledger note snapshot: {source_ledger['notes']}\n"
        )
        with run_log.open("a", encoding="utf-8") as fh:
            fh.write(log_line)

    print(release_path)


if __name__ == "__main__":
    main()
