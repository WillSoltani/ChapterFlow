#!/usr/bin/env python3
import json
import subprocess
import sys
import hashlib
from pathlib import Path

from chapterflow_v13_good_strategy_bad_strategy import (
    BOOK_ID,
    is_good_strategy_bad_strategy_data,
    normalize_chapter,
    normalize_release_package,
    normalize_review_package,
    normalized_book_metadata,
    serialize_json,
)


def utc_now():
    return subprocess.check_output(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], text=True).strip()


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save_json(path, payload):
    serialize_json(path, payload)


def canonical_sha(obj):
    payload = json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def main():
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v13_good_strategy_bad_strategy_repair.py RUN_ROOT")
        sys.exit(2)

    run_root = Path(sys.argv[1])
    manifest_path = run_root / "manifests" / "run-manifest.json"
    manifest = load_json(manifest_path)
    if not is_good_strategy_bad_strategy_data(manifest, source_path=manifest_path):
        print("Run is not good-strategy-bad-strategy; refusing repair.")
        sys.exit(1)

    validated_dir = run_root / "validated"
    structured_dir = run_root / "structured"
    review_dir = run_root / "validated"
    release_dir = run_root / "release"

    chapter_payloads = {}
    for path in sorted(structured_dir.glob("ch*.chapter.json")):
        chapter = normalize_chapter(load_json(path))
        save_json(path, chapter)

    for path in sorted(validated_dir.glob("ch*.chapter.json")):
        chapter = normalize_chapter(load_json(path))
        save_json(path, chapter)
        chapter_payloads[path.stem.replace(".chapter", "")] = chapter

    chapter_numbers = sorted(chapter["number"] for chapter in chapter_payloads.values())
    manifest["bookRequest"]["title"] = "Good Strategy / Bad Strategy"
    manifest["bookRequest"]["author"] = "Richard Rumelt"
    manifest["book"] = normalized_book_metadata(manifest.get("book", {}), chapter_numbers=chapter_numbers)
    save_json(manifest_path, manifest)

    for path in sorted(review_dir.glob("ch*.review-package.json")):
        stem = path.stem.replace(".review-package", "")
        review = load_json(path)
        review["chapters"] = [chapter_payloads[stem]]
        review = normalize_review_package(review, chapter_numbers=chapter_numbers)
        save_json(path, review)

    release_book = normalized_book_metadata(manifest.get("book", {}), chapter_numbers=chapter_numbers)
    release_payload = normalize_release_package({
        "schemaVersion": "1.1.0",
        "packageId": f"{BOOK_ID}-{manifest.get('runId', 'run')}-modern",
        "createdAt": utc_now(),
        "contentOwner": "ChapterFlow",
        "book": release_book,
        "chapters": [chapter_payloads[key] for key in sorted(chapter_payloads.keys())],
    })
    save_json(release_dir / f"{BOOK_ID}.modern.json", release_payload)
    save_json(release_dir / "book.release.json", release_payload)

    continuity_path = run_root / "continuity" / "continuity-state.json"
    if continuity_path.exists():
        continuity = load_json(continuity_path)
        approved = continuity.get("approvedChapterHashes", {})
        for stem, chapter in chapter_payloads.items():
            approved[stem] = canonical_sha(chapter)
        continuity["approvedChapterHashes"] = approved
        save_json(continuity_path, continuity)

    print(f"Repaired {BOOK_ID} run at {run_root}")


if __name__ == "__main__":
    main()
