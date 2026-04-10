#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from chapterflow_v13_prose_audit import audit_package, tokenize

ANCHOR_BUCKETS = {
    "ch01-03": {"abuse", "poverty", "racism", "grief", "mirror", "school", "weight", "obesity", "labor"},
    "ch04-06": {"buds", "hell", "week", "service", "race", "cookie", "duty", "pain", "injury"},
    "ch07-08": {"40%", "forty", "governor", "planning", "pacing", "logistics", "strategy"},
    "ch09-10": {"ranger", "leadership", "standard", "delta", "record", "failure", "after", "action"},
    "ch11": {"addison", "stillness", "stretch", "recovery", "repair", "retirement", "reconciliation"},
}


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def chapter_anchor_bucket(number):
    if number <= 3:
        return "ch01-03"
    if number <= 6:
        return "ch04-06"
    if number <= 8:
        return "ch07-08"
    if number <= 10:
        return "ch09-10"
    return "ch11"


def chapter_breakdown_blob(chapter):
    content = chapter.get("contentVariants", {})
    pieces = []
    for depth_name in ("easy", "medium", "hard"):
        breakdown = content.get(depth_name, {}).get("chapterBreakdown", {})
        if isinstance(breakdown, dict):
            pieces.extend(text for text in breakdown.values() if isinstance(text, str))
    return " ".join(pieces)


def summarize(pkg, source_path):
    result = audit_package(pkg, source_path=source_path)
    by_chapter = {}
    for issue in result["issues"]:
        prefix = issue["location"].split(".")[0]
        row = by_chapter.setdefault(prefix, {"issues": {}, "total": 0})
        row["issues"][issue["issue_type"]] = row["issues"].get(issue["issue_type"], 0) + 1
        row["total"] += 1

    chapters = pkg.get("chapters", []) if isinstance(pkg, dict) else [pkg]
    rows = []
    for chapter in chapters:
        number = chapter.get("number", 0)
        key = f"ch{number}"
        bucket = chapter_anchor_bucket(number)
        tokens = set(tokenize(chapter_breakdown_blob(chapter)))
        rows.append({
            "chapter": key,
            "totalIssues": by_chapter.get(key, {}).get("total", 0),
            "issues": by_chapter.get(key, {}).get("issues", {}),
            "anchorBucket": bucket,
            "anchorHits": sorted(ANCHOR_BUCKETS[bucket] & tokens),
        })
    return {"rows": rows, "issues": result["issues"]}


def emit_markdown(summary):
    lines = [
        "# Can't Hurt Me prose sentry",
        "",
        "| Chapter | Issues | Anchor bucket | Anchor hits |",
        "| --- | ---: | --- | --- |",
    ]
    for row in summary["rows"]:
        hits = ", ".join(row["anchorHits"]) if row["anchorHits"] else "none"
        lines.append(f"| {row['chapter']} | {row['totalIssues']} | {row['anchorBucket']} | {hits} |")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Generate a full-book sentry report for Can't Hurt Me.")
    parser.add_argument("path", help="Path to a chapter package JSON file.")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of markdown.")
    args = parser.parse_args()

    input_path = Path(args.path)
    summary = summarize(load_json(input_path), input_path)
    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(emit_markdown(summary))


if __name__ == "__main__":
    main()
