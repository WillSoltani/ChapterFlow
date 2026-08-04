#!/usr/bin/env python3
"""Discover canonical ChapterFlow packages and create manifests and blind jobs."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from common import (
    IGNORED_NAMES,
    RUBRIC_VERSION,
    SCHEMA_VERSION,
    EvaluationError,
    atomic_write_json,
    inspect_package,
    normalized_content_hash,
    slugify,
    source_hash,
    write_csv,
)


MANIFEST_FIELDS = (
    "package_id",
    "canonical_title",
    "source_path",
    "canonical_path",
    "package_format",
    "source_hash",
    "content_hash",
    "detected_chapter_count",
    "package_byte_size",
    "duplicate_of_id",
    "discovery_warnings",
    "output_slug",
    "canonical",
    "scoreable",
)

JOB_FIELDS = (
    "job_id",
    "run_id",
    "book_id",
    "rater_role",
    "package_path",
    "source_hash",
    "rubric_path",
    "schema_path",
    "output_path",
)

DISCOVERY_DOCUMENT_NAMES = {
    "readme",
    "readme.md",
    "readme.txt",
    "license",
    "license.md",
    "license.txt",
}


def candidate_paths(packages_dir: Path) -> list[Path]:
    candidates: list[Path] = []
    for path in sorted(packages_dir.iterdir(), key=lambda item: item.name.casefold()):
        if path.name.startswith(".") or path.name in IGNORED_NAMES or path.name.casefold() in DISCOVERY_DOCUMENT_NAMES:
            continue
        if path.is_dir() or (path.is_file() and path.suffix.lower() in {".json", ".md", ".txt", ".zip"}):
            candidates.append(path)
    return candidates


def byte_size(path: Path) -> int:
    if path.is_file():
        return path.stat().st_size
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file() and not item.is_symlink())


def discover(packages_dir: Path, run_dir: Path, repo_root: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    packages_dir = packages_dir.resolve()
    run_dir = run_dir.resolve()
    repo_root = repo_root.resolve()
    if not packages_dir.is_dir():
        raise EvaluationError(f"Required package directory does not exist: {packages_dir}")
    for relative in ("data", "raw/primary", "raw/verification", "raw/adjudicated", "jobs", "jobs/worker-receipts", "logs", "tmp/extracted"):
        (run_dir / relative).mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, Any]] = []
    canonical_by_content: dict[str, str] = {}
    slug_counts: dict[str, int] = {}
    id_counts: dict[str, int] = {}
    for index, path in enumerate(candidate_paths(packages_dir), start=1):
        warnings: list[str] = []
        scoreable = True
        try:
            inspection = inspect_package(path, run_dir / "tmp" / "extracted")
            warnings.extend(inspection.get("warnings", []))
            if inspection.get("inventory_complete") is not True:
                details = inspection.get("inventory_errors") or ["source chapter inventory is not provably complete"]
                warnings.extend(f"Unscoreable inventory: {item}" for item in details)
                scoreable = False
        except (EvaluationError, OSError, json.JSONDecodeError, UnicodeError) as exc:
            inspection = {
                "package_id": slugify(path.stem),
                "book_id": slugify(path.stem),
                "title": path.stem,
                "package_format": path.suffix.lower().lstrip(".") or "directory",
                "chapter_count": 0,
            }
            warnings.append(f"Inspection failed: {type(exc).__name__}: {exc}")
            scoreable = False
        try:
            raw_source_hash = source_hash(path)
        except (EvaluationError, OSError) as exc:
            raw_source_hash = ""
            warnings.append(f"Source hash failed: {type(exc).__name__}: {exc}")
            scoreable = False
        try:
            content_hash = normalized_content_hash(path, run_dir / "tmp" / "duplicate-hash")
        except (EvaluationError, OSError, json.JSONDecodeError, UnicodeError) as exc:
            content_hash = raw_source_hash
            warnings.append(f"Normalized content hash failed: {type(exc).__name__}: {exc}")

        base_package_id = slugify(str(inspection.get("book_id") or inspection.get("package_id") or path.stem))
        if not base_package_id:
            base_package_id = f"package-{index:03d}"
        id_counts[base_package_id] = id_counts.get(base_package_id, 0) + 1
        package_id = base_package_id if id_counts[base_package_id] == 1 else f"{base_package_id}-{id_counts[base_package_id]}"
        title = str(inspection.get("title") or path.stem)
        base_slug = slugify(title, package_id)
        slug_counts[base_slug] = slug_counts.get(base_slug, 0) + 1
        output_slug = base_slug if slug_counts[base_slug] == 1 else f"{base_slug}-{slug_counts[base_slug]}"
        duplicate_of = canonical_by_content.get(content_hash) if content_hash else None
        canonical = duplicate_of is None
        if canonical and content_hash:
            canonical_by_content[content_hash] = package_id
        elif duplicate_of:
            warnings.append(f"Duplicate content of {duplicate_of}; excluded from scoring")
            scoreable = False
        source_display = _relative_or_absolute(path, repo_root)
        row = {
            "package_id": package_id,
            "canonical_title": title,
            "source_path": source_display,
            "canonical_path": source_display if canonical else _canonical_path(rows, duplicate_of),
            "package_format": inspection.get("package_format") or path.suffix.lower().lstrip(".") or "directory",
            "source_hash": raw_source_hash,
            "content_hash": content_hash,
            "detected_chapter_count": int(inspection.get("chapter_count") or 0),
            "package_byte_size": byte_size(path),
            "duplicate_of_id": duplicate_of or "",
            "discovery_warnings": warnings,
            "output_slug": output_slug,
            "canonical": canonical,
            "scoreable": bool(
                scoreable
                and canonical
                and inspection.get("inventory_complete") is True
                and int(inspection.get("chapter_count") or 0) > 0
            ),
            "absolute_path": str(path),
            "inspection": inspection,
        }
        rows.append(row)

    canonical_rows = [row for row in rows if row["canonical"] and row["scoreable"]]
    manifest_rows = [{key: row.get(key, "") for key in MANIFEST_FIELDS} for row in rows]
    write_csv(run_dir / "data" / "package-manifest.csv", MANIFEST_FIELDS, manifest_rows)

    run_id = run_dir.name
    rubric_path = repo_root / ".agents/skills/chapterflow-book-evaluator/references/rubric-v2.md"
    schema_path = repo_root / ".agents/skills/chapterflow-book-evaluator/references/book-evaluation.schema.json"
    jobs: list[dict[str, Any]] = []
    for row in sorted(canonical_rows, key=lambda item: (item["canonical_title"].casefold(), item["package_id"])):
        for role in ("primary", "verification"):
            jobs.append(
                {
                    "job_id": f"{row['package_id']}--{role}",
                    "run_id": run_id,
                    "book_id": row["package_id"],
                    "rater_role": role,
                    "package_path": row["absolute_path"],
                    "source_hash": row["source_hash"],
                    "rubric_path": str(rubric_path),
                    "schema_path": str(schema_path),
                    "output_path": str(run_dir / "raw" / role / f"{row['package_id']}.json"),
                }
            )
    write_csv(run_dir / "jobs" / "book-rater-jobs.csv", JOB_FIELDS, jobs)
    for filename, fields in (
        ("book-rater-results.csv", ("job_id", "book_id", "rater_role", "status", "output_path", "source_hash", "overall_score", "certification_status", "chapter_count_read", "sha256", "error")),
        ("adjudication-jobs.csv", ("job_id", "run_id", "book_id", "package_path", "primary_path", "verification_path", "output_path")),
        ("adjudication-results.csv", ("job_id", "book_id", "status", "output_path", "overall_score", "certification_status", "confidence", "sha256", "error")),
    ):
        write_csv(run_dir / "jobs" / filename, fields, [])
    for filename in ("validation.log", "retries.log", "report-audit.log"):
        (run_dir / "logs" / filename).touch(exist_ok=True)

    total_components: dict[str, int] = {}
    for row in canonical_rows:
        for key, value in (row.get("inspection", {}).get("component_inventory") or {}).items():
            if isinstance(value, int):
                total_components[key] = total_components.get(key, 0) + value
    run_manifest = {
        "schema_version": SCHEMA_VERSION,
        "rubric_version": RUBRIC_VERSION,
        "run_id": run_id,
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "repository_root": str(repo_root),
        "package_directory": _relative_or_absolute(packages_dir, repo_root),
        "isolation_mode": "local-packages-only; external accuracy not assessed",
        "external_verification_enabled": False,
        "status": "discovered",
        "packages_found": len(rows),
        "canonical_books": len(canonical_rows),
        "duplicates": sum(1 for row in rows if row["duplicate_of_id"]),
        "unscoreable_packages": sum(1 for row in rows if not row["scoreable"] and not row["duplicate_of_id"]),
        "chapters_expected": sum(int(row["detected_chapter_count"]) for row in canonical_rows),
        "component_counts": total_components,
        "agent_configuration": {"requested_max_threads": 6, "max_depth": 1, "orchestration": "pending"},
        "validation": {"tests": "pending", "book_results": "pending", "report": "pending", "audit": "pending"},
        "limitations": ["External factual accuracy is intentionally not assessed.", "Reader outcomes are inferred only as design support, not measured."],
        "packages": [
            {
                "package_id": row["package_id"],
                "title": row["canonical_title"],
                "source_path": row["source_path"],
                "source_hash": row["source_hash"],
                "canonical": row["canonical"],
                "scoreable": row["scoreable"],
                "duplicate_of_id": row["duplicate_of_id"] or None,
                "chapter_count": row["detected_chapter_count"],
                "warnings": row["discovery_warnings"],
            }
            for row in rows
        ],
    }
    atomic_write_json(run_dir / "data" / "run-manifest.json", run_manifest)
    return rows, run_manifest


def _relative_or_absolute(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return str(path.resolve())


def _canonical_path(rows: list[dict[str, Any]], package_id: str | None) -> str:
    for row in rows:
        if row["package_id"] == package_id:
            return str(row["source_path"])
    return ""


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--packages-dir", type=Path, required=True, help="Directory containing candidate book packages")
    parser.add_argument("--run-dir", type=Path, required=True, help="Existing or new evaluation run directory")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd(), help="Repository root (default: current directory)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        rows, manifest = discover(args.packages_dir, args.run_dir, args.repo_root)
    except (EvaluationError, OSError, json.JSONDecodeError) as exc:
        print(f"discovery error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({"run_id": manifest["run_id"], "packages_found": len(rows), "canonical_books": manifest["canonical_books"], "chapters_expected": manifest["chapters_expected"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
