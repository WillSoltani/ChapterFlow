#!/usr/bin/env python3
import json, sys, re
from pathlib import Path

DRAFT_HEADERS = [r"^##\s+Easy\b", r"^##\s+Medium\b", r"^##\s+Hard\b"]
CONTAM = [
    "keep the prose narrow and concrete",
    "used lazily, the point turns into",
    "keep this question alive",
    "reading calibration",
    "unsupported zones",
]
ANTIFRAGILE_TITLE = "Antifragile: Things That Gain from Disorder"
ANTIFRAGILE_AUTHOR = "Nassim Nicholas Taleb"

def read(path):
    return Path(path).read_text(encoding="utf-8", errors="ignore")

def load_json(path):
    return json.loads(read(path))

def meta_text(value):
    return str(value or "").replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'").strip()

def is_antifragile_run(run_root):
    manifest_path = run_root / "manifests" / "run-manifest.json"
    if not manifest_path.exists():
        return False
    try:
        manifest = load_json(manifest_path)
    except Exception:
        return False
    book = manifest.get("book", {})
    return str(manifest.get("bookId", "")).strip() == "antifragile" or str(book.get("bookId", "")).strip() == "antifragile"

def antifragile_book_failures(book, chapter_range_required=True):
    fails = []
    if not isinstance(book, dict):
        return ["antifragile book object missing or malformed"]
    if meta_text(book.get("title")) != ANTIFRAGILE_TITLE:
        fails.append("antifragile title metadata is not normalized")
    if meta_text(book.get("author")) != ANTIFRAGILE_AUTHOR:
        fails.append("antifragile author metadata is not normalized")
    if re.search(r"[“”‘’]", str(book.get("title", "")) + str(book.get("author", ""))):
        fails.append("antifragile metadata still contains curly-quote corruption")
    edition = book.get("edition", {})
    if not isinstance(book.get("categories"), list) or not book.get("categories"):
        fails.append("antifragile categories missing")
    if book.get("variantFamily") != "EMH":
        fails.append("antifragile variantFamily missing or wrong")
    if chapter_range_required and not meta_text(book.get("chapterRange")):
        fails.append("antifragile chapterRange missing")
    if not isinstance(edition, dict) or not meta_text(edition.get("name")):
        fails.append("antifragile edition.name missing")
    if not meta_text(edition.get("sourceText")):
        fails.append("antifragile edition.sourceText missing")
    if not meta_text(edition.get("sourceProvenance")):
        fails.append("antifragile edition.sourceProvenance missing")
    if not edition.get("publishedYear"):
        fails.append("antifragile edition.publishedYear missing")
    return fails

def main():
    if len(sys.argv) != 2:
        print("Usage: chapterflow_v13_artifact_guard.py RUN_ROOT")
        sys.exit(2)
    run_root = Path(sys.argv[1])
    fails = []
    antifragile_run = is_antifragile_run(run_root)

    for req in [
        run_root / "manifests" / "run-manifest.json",
        run_root / "manifests" / "source-ledger.json",
        run_root / "manifests" / "edition-lock.json",
        run_root / "continuity" / "continuity-state.json",
    ]:
        if not req.exists():
            fails.append(f"missing required artifact {req}")

    frozen = run_root / "source-freeze"
    if not frozen.exists() or not any(frozen.iterdir()):
        fails.append("source-freeze missing or empty")

    for draft_dir in [run_root / "drafts" / "canonical", run_root / "drafts" / "edited"]:
        if draft_dir.exists():
            for p in draft_dir.glob("ch*.md"):
                txt = read(p)
                if any(re.search(pat, txt, flags=re.M) for pat in DRAFT_HEADERS):
                    fails.append(f"{p} looks like a structured pseudo-draft, not real prose")
                low = txt.lower()
                for bad in CONTAM:
                    if bad in low:
                        fails.append(f"{p} contains contamination phrase '{bad}'")

    validated = run_root / "validated"
    for p in sorted(validated.glob("ch*.chapter.json")):
        stem = p.stem.replace(".chapter", "")
        expected = [
            run_root / "briefs" / f"{stem}.md",
            run_root / "outlines" / f"{stem}.md",
            run_root / "quiz-blueprints" / f"{stem}.md",
            run_root / "drafts" / "canonical" / f"{stem}.md",
            run_root / "drafts" / "edited" / f"{stem}.md",
            run_root / "structured" / f"{stem}.chapter.json",
            run_root / "quizzes" / f"{stem}.quiz.json",
            run_root / "reports" / f"{stem}.critic.md",
            run_root / "reports" / f"{stem}.validation.md",
            run_root / "validated" / f"{stem}.review-package.json",
            run_root / "sidecars" / f"{stem}.reading-metrics.json",
            run_root / "sidecars" / "source" / f"{stem}.source.json",
        ]
        for e in expected:
            if not e.exists():
                fails.append(f"missing artifact {e}")
        if antifragile_run:
            try:
                chapter = load_json(p)
                review = load_json(run_root / "validated" / f"{stem}.review-package.json")
            except Exception as exc:
                fails.append(f"{stem}: antifragile artifact JSON parse failed: {exc}")
                continue

            chapter_book = chapter.get("book", {})
            if meta_text(chapter_book.get("title")) != ANTIFRAGILE_TITLE or meta_text(chapter_book.get("author")) != ANTIFRAGILE_AUTHOR:
                fails.append(f"{stem}: chapter-level book metadata is not normalized for antifragile")

            for item in antifragile_book_failures(review.get("book", {}), chapter_range_required=True):
                fails.append(f"{stem}: {item}")

            wrapped = review.get("chapters")
            if not isinstance(wrapped, list) or len(wrapped) != 1:
                fails.append(f"{stem}: review wrapper must contain exactly one chapter payload")
            elif wrapped[0] != chapter:
                fails.append(f"{stem}: review wrapper chapter payload does not match the full validated chapter JSON")

    if antifragile_run:
        release_path = run_root / "release" / "antifragile.modern.json"
        if release_path.exists():
            try:
                release = load_json(release_path)
            except Exception as exc:
                fails.append(f"release antifragile.modern.json parse failed: {exc}")
            else:
                if not release.get("packageId"):
                    fails.append("release antifragile.modern.json missing packageId")
                if not release.get("createdAt"):
                    fails.append("release antifragile.modern.json missing createdAt")
                if not release.get("contentOwner"):
                    fails.append("release antifragile.modern.json missing contentOwner")
                for item in antifragile_book_failures(release.get("book", {}), chapter_range_required=True):
                    fails.append(f"release antifragile.modern.json: {item}")
                for chapter in release.get("chapters", []):
                    chapter_book = chapter.get("book", {})
                    if meta_text(chapter_book.get("title")) != ANTIFRAGILE_TITLE or meta_text(chapter_book.get("author")) != ANTIFRAGILE_AUTHOR:
                        fails.append(f"release chapter {chapter.get('number', '?')}: nested book metadata is not normalized")

    for f in fails:
        print("FAIL", f)
    print(f"FAIL={len(fails)} WARN=0")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
