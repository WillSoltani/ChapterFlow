#!/usr/bin/env python3
"""Aggregate validated adjudicated evaluations into canonical JSON and CSVs."""

from __future__ import annotations

import argparse
import copy
import json
import re
import statistics
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from common import (
    DOMAINS,
    GATE_KEYS,
    RUBRIC_VERSION,
    SCHEMA_VERSION,
    EvaluationError,
    atomic_write_text,
    atomic_write_json,
    calculate_scores,
    inspect_package,
    rating_paths,
    read_json,
    sha256_file,
    source_hash,
    write_csv,
)
from export_portfolio_book_update import _validate_rater_pair
from generate_remediation_prompts import markdown_pack, remediation_pack
from validate_book_result import validate_result


def _title(record: Mapping[str, Any]) -> str:
    return str((record.get("book") or {}).get("title") or (record.get("book") or {}).get("book_id") or "Untitled")


def _book_id(record: Mapping[str, Any]) -> str:
    return str((record.get("book") or {}).get("book_id") or "unknown-book")


def _is_sample_run(run: Mapping[str, Any]) -> bool:
    sampling = run.get("sampling") if isinstance(run.get("sampling"), Mapping) else {}
    return run.get("evaluation_mode") == "chapter_sample" or sampling.get("mode") == "chapter_sample"


def _is_sample_record(record: Mapping[str, Any]) -> bool:
    scope = record.get("evaluation_scope") if isinstance(record.get("evaluation_scope"), Mapping) else {}
    return (
        record.get("result_type") in {"experimental_chapter_sample_evaluation", "experimental_chapter_sample_report"}
        or record.get("evaluation_mode") == "chapter_sample"
        or scope.get("mode") == "chapter_sample"
    )


def _sample_manifest_path(run_dir: Path, run: Mapping[str, Any]) -> Path:
    sampling = run.get("sampling") if isinstance(run.get("sampling"), Mapping) else {}
    configured = sampling.get("selection_manifest_json")
    candidates: list[Path] = []
    if configured:
        configured_path = Path(str(configured))
        if configured_path.is_absolute():
            candidates.append(configured_path)
        else:
            candidates.extend((run_dir / configured_path, run_dir.parent / configured_path))
    candidates.extend(
        (
            run_dir / "data" / "chapter-sample-manifest.json",
            run_dir / "tmp" / "chapter-sample-manifest.json",
            run_dir / "chapter-sample-manifest.json",
        )
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    raise EvaluationError("Sample run is missing its chapter-sample selection manifest")


def _sample_manifest(run_dir: Path, run: dict[str, Any]) -> dict[str, Any]:
    path = _sample_manifest_path(run_dir, run)
    manifest = read_json(path)
    if not isinstance(manifest, dict):
        raise EvaluationError(f"Sample selection manifest must contain an object: {path}")
    sampling = run.setdefault("sampling", {})
    if not isinstance(sampling, dict):
        raise EvaluationError("run.sampling must be an object in chapter_sample mode")
    digest = sha256_file(path)
    configured_digest = str(sampling.get("selection_manifest_sha256") or "")
    if configured_digest and configured_digest != digest:
        raise EvaluationError(
            f"Sample selection manifest hash mismatch: run={configured_digest} actual={digest}"
        )
    sampling["selection_manifest_sha256"] = digest
    sampling.setdefault("selection_manifest_json", path.relative_to(run_dir).as_posix() if path.is_relative_to(run_dir) else str(path))
    csv_manifest_path = path.with_suffix(".csv")
    sampling.setdefault(
        "selection_manifest_csv",
        csv_manifest_path.relative_to(run_dir).as_posix()
        if csv_manifest_path.is_relative_to(run_dir)
        else str(csv_manifest_path),
    )
    sampling.setdefault("mode", "chapter_sample")
    sampling.setdefault("protocol_version", str(manifest.get("schema_version") or "1.0.0"))
    sampling.setdefault("sample_mode", manifest.get("sample_mode"))
    sampling.setdefault("score_scope", "selected_chapters_only")
    sampling.setdefault("result_interpretation", "exploratory_sample_estimate")
    sampling.setdefault("score_label", "Experimental four-chapter sample score")
    sampling.setdefault("requested_chapters_per_book", 4)
    sampling.setdefault("sampling_seed", manifest.get("sampling_seed"))
    manifest_method = manifest.get("selection_method")
    manifest_method_name = manifest_method.get("name") if isinstance(manifest_method, Mapping) else None
    sampling.setdefault("selection_algorithm", manifest_method_name)
    sampling.setdefault("population_chapter_count", manifest.get("source_chapter_count"))
    sampling.setdefault("selected_chapter_count", manifest.get("selected_chapter_count"))
    population = int(sampling.get("population_chapter_count") or 0)
    selected = int(sampling.get("selected_chapter_count") or 0)
    sampling.setdefault("not_sampled_chapter_count", population - selected)
    sampling.setdefault("blind_chapter_reads", selected * 2)
    sampling.setdefault("population_coverage_ratio", selected / population if population else 0.0)
    sampling.setdefault("full_book_certification_eligible", False)
    sampling.setdefault(
        "scope_limitation",
        manifest.get("scope_limitation")
        or "Experimental chapter sample; unsampled content may materially change every result.",
    )
    if not sampling.get("sampling_seed") or not sampling.get("selection_algorithm"):
        raise EvaluationError("Sample run must record sampling_seed and selection_algorithm")
    selection_algorithm = sampling.get("selection_algorithm")
    if selection_algorithm != "sha256-lowest-rank-v1":
        raise EvaluationError(
            "Sample run selection_algorithm must be sha256-lowest-rank-v1"
        )
    if selection_algorithm != manifest_method_name:
        raise EvaluationError(
            "Sample run selection_algorithm differs from the selection manifest method"
        )
    if sampling.get("score_scope") != "selected_chapters_only":
        raise EvaluationError("Sample run score_scope must be selected_chapters_only")
    if sampling.get("result_interpretation") != "exploratory_sample_estimate":
        raise EvaluationError(
            "Sample run result_interpretation must be exploratory_sample_estimate"
        )
    expected_literals = {
        "mode": "chapter_sample",
        "protocol_version": "1.0.0",
        "sample_mode": "deterministic-four-chapter-sample",
        "score_label": "Experimental four-chapter sample score",
        "requested_chapters_per_book": 4,
        "blind_chapter_reads": selected * 2,
        "full_book_certification_eligible": False,
    }
    for field, expected_value in expected_literals.items():
        if sampling.get(field) != expected_value:
            raise EvaluationError(
                f"Sample run sampling.{field} must be {expected_value!r}"
            )
    if population < selected or selected < 1:
        raise EvaluationError(
            f"Invalid sample totals: population={population}, selected={selected}"
        )
    if int(sampling.get("not_sampled_chapter_count") or -1) != population - selected:
        raise EvaluationError("run.sampling.not_sampled_chapter_count is inconsistent")
    manifest_population = int(manifest.get("source_chapter_count") or 0)
    manifest_selected = int(manifest.get("selected_chapter_count") or 0)
    if (manifest_population, manifest_selected) != (population, selected):
        raise EvaluationError(
            "Sample totals differ between run manifest and selection manifest: "
            f"run={population}/{selected}, selection={manifest_population}/{manifest_selected}"
        )
    return manifest


def _selected_chapters(value: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    selected = value.get("selected_chapters")
    return [item for item in selected if isinstance(item, Mapping)] if isinstance(selected, list) else []


def _selected_positions(value: Mapping[str, Any]) -> list[int]:
    positions: list[int] = []
    for item in _selected_chapters(value):
        raw = item.get("original_chapter_position")
        if raw is None and isinstance(item.get("original_chapter_index"), int):
            raw = int(item["original_chapter_index"]) + 1
        if raw is None:
            raw = item.get("chapter_position", item.get("chapter_index"))
        if isinstance(raw, int) and not isinstance(raw, bool):
            positions.append(raw)
    return positions


def _sample_book_manifest(manifest: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    books = manifest.get("books")
    if not isinstance(books, list):
        raise EvaluationError("Sample selection manifest books must be an array")
    result: dict[str, Mapping[str, Any]] = {}
    for raw in books:
        if not isinstance(raw, Mapping):
            raise EvaluationError("Sample selection manifest book entries must be objects")
        identifier = str(raw.get("book_id") or "")
        if not identifier or identifier in result:
            raise EvaluationError(f"Invalid or duplicate book_id in sample selection manifest: {identifier!r}")
        result[identifier] = raw
    return result


def _sample_scope_columns(
    record: Mapping[str, Any],
    sample_book: Mapping[str, Any],
) -> dict[str, Any]:
    scope = record.get("evaluation_scope")
    if not isinstance(scope, Mapping):
        raise EvaluationError(f"Sample adjudicated record is missing evaluation_scope: {_book_id(record)}")
    source_count = int(
        scope.get("population_chapter_count")
        or scope.get("source_chapter_count")
        or sample_book.get("source_chapter_count")
        or 0
    )
    scope_selected = _selected_chapters(scope)
    manifest_selected = _selected_chapters(sample_book)
    if scope_selected != manifest_selected:
        raise EvaluationError(
            f"Sample evaluation_scope selected chapters differ from selection manifest: {_book_id(record)}"
        )
    selected = scope_selected
    selected_count = int(scope.get("selected_chapter_count") or sample_book.get("selected_chapter_count") or len(selected))
    positions = _selected_positions(scope) or _selected_positions(sample_book)
    if selected_count != len(positions):
        raise EvaluationError(
            f"Sample scope for {_book_id(record)} declares {selected_count} chapters but has {len(positions)} positions"
        )
    if source_count != int(sample_book.get("source_chapter_count") or 0):
        raise EvaluationError(
            f"Sample source chapter count differs from selection manifest: {_book_id(record)}"
        )
    original_source = scope.get("original_source") if isinstance(scope.get("original_source"), Mapping) else {}
    identity_pairs = (
        ("original source hash", original_source.get("sha256"), sample_book.get("full_source_sha256")),
        ("sampled package hash", scope.get("sampled_package_sha256"), sample_book.get("sampled_package_sha256")),
    )
    for label, actual, expected in identity_pairs:
        if actual != expected:
            raise EvaluationError(
                f"Sample {label} differs from selection manifest for {_book_id(record)}"
            )
    return {
        "evaluation_mode": "chapter_sample",
        "sample_source_chapter_count": source_count,
        "sample_selected_chapter_count": selected_count,
        "sample_not_selected_chapter_count": source_count - selected_count,
        "sample_selected_positions": ";".join(str(value) for value in positions),
    }


def _load_records(run_dir: Path) -> list[tuple[Path, dict[str, Any]]]:
    records = []
    for path in sorted((run_dir / "raw" / "adjudicated").glob("*.json"), key=lambda item: item.name.casefold()):
        data = read_json(path)
        if not isinstance(data, dict):
            raise EvaluationError(f"Adjudicated record must be an object: {path}")
        if _is_sample_record(data):
            raise EvaluationError(f"chapter-sample adjudication is disabled: {path}")
        before = copy.deepcopy(data)
        calculate_scores(data)
        adjustments = []
        for domain_key in DOMAINS:
            for field in ("domain_score", "weighted_points"):
                old = before.get("domains", {}).get(domain_key, {}).get(field)
                new = data["domains"][domain_key][field]
                if old is None or abs(float(old) - float(new)) > 1e-8:
                    adjustments.append({"path": f"domains.{domain_key}.{field}", "worker_value": old, "deterministic_value": new})
        old_overall = before.get("overall_score")
        if old_overall is None or abs(float(old_overall) - float(data["overall_score"])) > 1e-8:
            adjustments.append({"path": "overall_score", "worker_value": old_overall, "deterministic_value": data["overall_score"]})
        if adjustments:
            qa = data.setdefault("qa", {})
            notes = qa.setdefault("self_validation_notes", [])
            notes.append(f"Aggregator corrected {len(adjustments)} arithmetic field(s); see deterministic_adjustments in report data.")
            data["deterministic_adjustments"] = adjustments
        records.append((path, data))
    if not records:
        raise EvaluationError(f"No adjudicated JSON files found in {run_dir / 'raw/adjudicated'}")
    return records


def _load_rater(run_dir: Path, role: str, filename: str) -> dict[str, Any]:
    path = run_dir / "raw" / role / filename
    try:
        value = read_json(path)
    except (OSError, json.JSONDecodeError) as exc:
        raise EvaluationError(f"missing or unreadable {role} blind record: {path}") from exc
    if not isinstance(value, dict):
        raise EvaluationError(f"{role} blind record must be a JSON object: {path}")
    if isinstance(value, dict) and _is_sample_record(value):
        raise EvaluationError(f"chapter-sample blind record is disabled: {path}")
    return value


def _attach_rater_values(
    run_dir: Path,
    source_filename: str,
    record: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    primary = _load_rater(run_dir, "primary", source_filename)
    verification = _load_rater(run_dir, "verification", source_filename)
    values: dict[str, Any] = {}
    for domain_key, subcriterion_key in rating_paths():
        path = f"domains.{domain_key}.subcriteria.{subcriterion_key}"
        final = record["domains"][domain_key]["subcriteria"][subcriterion_key]["rating"]
        values[path] = {
            "primary": primary["domains"][domain_key]["subcriteria"][subcriterion_key]["rating"],
            "verification": verification["domains"][domain_key]["subcriteria"][subcriterion_key]["rating"],
            "final": final,
        }
    record["rater_values"] = values
    return primary, verification


def _source_package(run_manifest: Mapping[str, Any], book_id: str) -> tuple[Path, str]:
    matches = [
        item for item in run_manifest.get("packages", [])
        if isinstance(item, Mapping)
        and str(item.get("package_id") or "") == book_id
        and item.get("canonical") is True
        and item.get("scoreable") is True
    ]
    if len(matches) != 1:
        raise EvaluationError(f"run manifest must contain exactly one canonical scoreable source for {book_id!r}")
    repository_root = Path(str(run_manifest.get("repository_root") or "")).resolve()
    source = Path(str(matches[0].get("source_path") or ""))
    if not source.is_absolute():
        source = repository_root / source
    source = source.resolve()
    if not source.exists():
        raise EvaluationError(f"current source package is missing for {book_id!r}: {source}")
    actual_hash = source_hash(source)
    if str(matches[0].get("source_hash") or "") != actual_hash:
        raise EvaluationError(f"current source package hash drifted after discovery for {book_id!r}")
    return source, actual_hash


def _require_identical_sample_scope(
    record: Mapping[str, Any],
    primary: Mapping[str, Any] | None,
    verification: Mapping[str, Any] | None,
) -> None:
    book_id = _book_id(record)
    final_scope = record.get("evaluation_scope")
    if not isinstance(final_scope, Mapping):
        raise EvaluationError(f"Sample adjudicated record is missing evaluation_scope: {book_id}")
    if final_scope.get("mode") != "chapter_sample":
        raise EvaluationError(f"Sample adjudicated evaluation_scope.mode must be chapter_sample: {book_id}")
    for role, blind in (("primary", primary), ("verification", verification)):
        if blind is None:
            continue
        blind_scope = blind.get("evaluation_scope")
        if not isinstance(blind_scope, Mapping):
            raise EvaluationError(f"Available {role} record is missing evaluation_scope: {book_id}")
        if blind_scope != final_scope:
            raise EvaluationError(
                f"Sample evaluation_scope differs between {role} and adjudicated records: {book_id}"
            )


def _require_sample_scope_run_identity(record: Mapping[str, Any], sampling: Mapping[str, Any]) -> None:
    scope = record.get("evaluation_scope")
    if not isinstance(scope, Mapping):
        raise EvaluationError(f"Sample adjudicated record is missing evaluation_scope: {_book_id(record)}")
    scope_algorithm = scope.get("selection_algorithm")
    scope_algorithm_name = scope_algorithm.get("name") if isinstance(scope_algorithm, Mapping) else None
    comparisons = (
        ("public_seed", scope.get("public_seed"), sampling.get("sampling_seed")),
        ("selection_algorithm.name", scope_algorithm_name, sampling.get("selection_algorithm")),
        ("selection_manifest_sha256", scope.get("selection_manifest_sha256"), sampling.get("selection_manifest_sha256")),
    )
    for field, actual, expected in comparisons:
        if actual != expected:
            raise EvaluationError(
                f"Sample evaluation_scope.{field} differs from run sampling metadata: {_book_id(record)}"
            )


def _rank(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered = sorted(records, key=lambda item: (-float(item["overall_score"]), _title(item).casefold(), _book_id(item)))
    for index, record in enumerate(ordered, start=1):
        record["rank"] = index
    tie_number = 0
    active_group: list[dict[str, Any]] = []
    for record in ordered:
        if not active_group:
            active_group = [record]
        elif abs(float(active_group[0]["overall_score"]) - float(record["overall_score"])) <= 1.0:
            active_group.append(record)
        else:
            if len(active_group) > 1:
                tie_number += 1
                for item in active_group:
                    item["tie_group"] = f"effective-tie-{tie_number}"
            else:
                active_group[0]["tie_group"] = None
            active_group = [record]
    if active_group:
        if len(active_group) > 1:
            tie_number += 1
            for item in active_group:
                item["tie_group"] = f"effective-tie-{tie_number}"
        else:
            active_group[0]["tie_group"] = None
    return ordered


def _category_winners(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    winners = []
    for domain_key, definition in DOMAINS.items():
        best = max(float(record["domains"][domain_key]["domain_score"]) for record in records)
        leaders = [_book_id(record) for record in records if abs(float(record["domains"][domain_key]["domain_score"]) - best) <= 1e-8]
        winners.append({"category": definition["name"], "domain_key": domain_key, "score": best, "book_ids": leaders})
    return winners


def _default_cross_book_analysis(
    records: list[dict[str, Any]],
    winners: list[dict[str, Any]],
    *,
    sample_mode: bool = False,
) -> dict[str, Any]:
    averages = {
        domain_key: statistics.mean(float(record["domains"][domain_key]["domain_score"]) for record in records)
        for domain_key in DOMAINS
    }
    lowest_domain = min(averages, key=averages.get)
    highest_domain = max(averages, key=averages.get)
    targeted = max(
        records,
        key=lambda record: float(record["overall_score"]) / 25.0 - min(float(record["domains"][key]["domain_score"]) for key in DOMAINS),
    )
    redesign = min(records, key=lambda record: float(record["overall_score"]))
    result = {
        "best_overall_content_design": _book_id(records[0]),
        "meaningful_score_differences": "Scores are interpreted with gate status, confidence, and evidence; books within one point are treated as effectively tied.",
        "greatest_targeted_improvement_opportunity": _book_id(targeted),
        "greatest_redesign_need": _book_id(redesign),
        "choose_this_book_if": {
            _book_id(record): str((record.get("analysis") or {}).get("best_fit_reader") or "its stated audience and purpose match your context")
            for record in records
        },
        "content_team_lesson": f"Across this isolated set, {DOMAINS[lowest_domain]['name']} is the lowest average design domain; strengthen it without sacrificing the strongest shared domain, {DOMAINS[highest_domain]['name']}.",
        "domain_average_scores": averages,
        "category_winners": winners,
        "limitations": ["This comparison uses package content only.", "It evaluates design support rather than measured reader outcomes."],
    }
    if sample_mode:
        result.update(
            {
                "best_overall_content_design": _book_id(records[0]),
                "meaningful_score_differences": "Experimental sample scores describe only the selected chapters; books within one point are treated as effectively tied, and unsampled content may change every ordering.",
                "content_team_lesson": f"Within the selected chapter samples, {DOMAINS[lowest_domain]['name']} is the lowest average observed design domain; this is a provisional sample finding, not a catalog-wide conclusion.",
                "limitations": [
                    "Only the deterministically selected chapters were inspected.",
                    "Scores, order, gates, and recommendations may change materially after reading unsampled content.",
                    "The inspection evaluates design support rather than measured reader outcomes.",
                ],
            }
        )
    return result


_RESOLUTION_METHODS = {
    "exact_id",
    "exact_title",
    "chapter_number",
    "chapter_number_and_title",
    "number_list",
    "number_range",
    "id_list",
    "id_range",
    "array_index",
    "mixed_explicit",
}
_SEVERITY_ORDER = {"none": 0, "info": 1, "warning": 2, "error": 3}
_BOOK_SCOPE_LOCATORS = {"book", "book object", "book metadata", "whole package", "package"}
_NUMBER_ATOM = r"\d+(?:\s*-\s*\d+)?"
_NUMBER_SEPARATOR = r"(?:\s*,\s*(?:and\s+)?|\s+and\s+)"
_CHAPTER_NUMBER_PATTERN = re.compile(
    rf"\b(?:chapters?|ch)\s+({_NUMBER_ATOM}(?:{_NUMBER_SEPARATOR}{_NUMBER_ATOM})*)",
    re.IGNORECASE,
)


def _normalize_locator(value: Any) -> str:
    """Normalize locator syntax without weakening exact semantic matching."""

    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    text = text.replace("\N{EN DASH}", "-").replace("\N{EM DASH}", "-").replace("\N{MINUS SIGN}", "-")
    return re.sub(r"\s+", " ", text).strip()


def _chapter_registry(record: Mapping[str, Any]) -> dict[str, Any]:
    book_id = _book_id(record)
    chapters = record.get("chapter_evidence")
    if not isinstance(chapters, list):
        raise EvaluationError(f"chapter_evidence must be an array for {book_id}")
    by_index: dict[int, Mapping[str, Any]] = {}
    by_id: dict[str, list[int]] = {}
    by_title: dict[str, list[int]] = {}
    for chapter in chapters:
        if not isinstance(chapter, Mapping):
            raise EvaluationError(f"chapter_evidence entries must be objects for {book_id}")
        index = chapter.get("chapter_index")
        if not isinstance(index, int) or isinstance(index, bool) or index < 1:
            raise EvaluationError(f"Invalid chapter_index for {book_id}: {index!r}")
        if index in by_index:
            raise EvaluationError(f"Duplicate chapter_index {index} for {book_id}")
        by_index[index] = chapter
        chapter_id = chapter.get("chapter_id")
        if chapter_id:
            by_id.setdefault(_normalize_locator(chapter_id), []).append(index)
        title = chapter.get("title")
        if title:
            by_title.setdefault(_normalize_locator(title), []).append(index)
    return {"by_index": by_index, "by_id": by_id, "by_title": by_title}


def _book_scope_locator(normalized: str) -> bool:
    if normalized in _BOOK_SCOPE_LOCATORS:
        return True
    return normalized.startswith("book metadata ") or normalized.startswith("book metadata(")


def _parse_number_expression(expression: str, valid_indices: set[int]) -> tuple[list[int], str] | None:
    normalized = _normalize_locator(expression)
    normalized = re.sub(r"\s*,\s*and\s+", ",", normalized)
    normalized = re.sub(r"\s+and\s+", ",", normalized)
    parts = [part.strip() for part in normalized.split(",")]
    if not parts or any(not part for part in parts):
        return None
    indices: list[int] = []
    used_range = False
    for part in parts:
        single = re.fullmatch(r"\d+", part)
        range_match = re.fullmatch(r"(\d+)\s*-\s*(\d+)", part)
        if single:
            indices.append(int(part))
        elif range_match:
            first, last = (int(value) for value in range_match.groups())
            if first > last:
                return None
            indices.extend(range(first, last + 1))
            used_range = True
        else:
            return None
    resolved = sorted(set(indices))
    if not resolved or any(index not in valid_indices for index in resolved):
        return None
    if len(resolved) == 1:
        method = "chapter_number"
    elif used_range:
        method = "number_range"
    else:
        method = "number_list"
    return resolved, method


def _extract_numeric_chapter_references(
    normalized: str,
    valid_indices: set[int],
    *,
    technical: bool,
) -> list[tuple[set[int], str]]:
    matches: list[tuple[set[int], str]] = []
    for match in _CHAPTER_NUMBER_PATTERN.finditer(normalized):
        parsed = _parse_number_expression(match.group(1), valid_indices)
        if parsed:
            indices, method = parsed
            matches.append((set(indices), method))
        else:
            matches.append((set(), "number_range" if "-" in match.group(1) else "number_list"))

    if technical:
        array_indices = {int(value) + 1 for value in re.findall(r"\bchapters\[(\d+)\]", normalized)}
        if array_indices:
            if array_indices <= valid_indices:
                matches.append((array_indices, "array_index"))
            else:
                matches.append((set(), "array_index"))

        # Some human-authored technical locators use a plural Chapter prefix once,
        # then continue chapter numbers at the start of semicolon-delimited clauses.
        for plural in re.finditer(r"\bchapters\s+", normalized):
            tail = normalized[plural.end() :]
            segments = tail.split(";")
            if len(segments) < 2:
                continue
            continuation: set[int] = set()
            for segment in segments:
                leading = re.match(rf"\s*({_NUMBER_ATOM}(?:{_NUMBER_SEPARATOR}{_NUMBER_ATOM})*)", segment)
                if not leading:
                    continue
                parsed = _parse_number_expression(leading.group(1), valid_indices)
                if parsed:
                    continuation.update(parsed[0])
                else:
                    matches.append((set(), "number_list"))
                    continuation.clear()
                    break
            if continuation:
                matches.append((continuation, "number_list" if len(continuation) > 1 else "chapter_number"))
    return matches


def _resolve_chapter_locator(
    locator: Any,
    registry: Mapping[str, Any],
    *,
    technical: bool,
) -> dict[str, Any]:
    """Resolve an explicit locator to chapters, book scope, or an auditable failure."""

    normalized = _normalize_locator(locator)
    if not normalized:
        return {"scope": "unresolved", "reason": "empty locator"}
    if _book_scope_locator(normalized):
        return {"scope": "book", "resolution": "book_scope"}

    by_index: Mapping[int, Any] = registry["by_index"]
    by_id: Mapping[str, list[int]] = registry["by_id"]
    by_title: Mapping[str, list[int]] = registry["by_title"]
    valid_indices = set(by_index)

    if normalized in by_id:
        matches = by_id[normalized]
        if len(matches) != 1:
            return {"scope": "unresolved", "reason": "ambiguous exact chapter id"}
        return {"scope": "chapters", "indices": matches, "resolution": "exact_id"}
    if normalized in by_title:
        matches = by_title[normalized]
        if len(matches) != 1:
            return {"scope": "unresolved", "reason": "ambiguous exact chapter title"}
        return {"scope": "chapters", "indices": matches, "resolution": "exact_title"}

    number_and_title = re.fullmatch(r"(?:chapter|ch)\s+(\d+)(?:\s+-\s+|\s*:\s*)(.+)", normalized)
    if number_and_title:
        index = int(number_and_title.group(1))
        if index not in valid_indices:
            return {"scope": "unresolved", "reason": "chapter number out of range"}
        expected_title = _normalize_locator(by_index[index].get("title"))
        if _normalize_locator(number_and_title.group(2)) != expected_title:
            return {"scope": "unresolved", "reason": "chapter number/title conflict"}
        return {"scope": "chapters", "indices": [index], "resolution": "chapter_number_and_title"}

    explicit_sets: list[tuple[set[int], str]] = []
    id_set: set[int] | None = None
    id_occurrences: list[tuple[int, str, int]] = []
    for chapter_id, indices in by_id.items():
        for occurrence in re.finditer(rf"(?<![a-z0-9]){re.escape(chapter_id)}(?![a-z0-9])", normalized):
            if len(indices) != 1:
                return {"scope": "unresolved", "reason": "ambiguous chapter id collision"}
            id_occurrences.append((occurrence.start(), chapter_id, indices[0]))
    if id_occurrences:
        id_occurrences.sort()
        id_indices = [item[2] for item in id_occurrences]
        unique_id_indices = sorted(set(id_indices))
        method = "exact_id" if len(unique_id_indices) == 1 else "id_list"
        if len(id_occurrences) == 2:
            first_id, second_id = id_occurrences[0][1], id_occurrences[1][1]
            if re.fullmatch(rf"{re.escape(first_id)}\s*-\s*{re.escape(second_id)}", normalized):
                first, last = id_occurrences[0][2], id_occurrences[1][2]
                if first > last or any(index not in valid_indices for index in range(first, last + 1)):
                    return {"scope": "unresolved", "reason": "invalid chapter id range"}
                unique_id_indices = list(range(first, last + 1))
                method = "id_range"
        id_set = set(unique_id_indices)
        explicit_sets.append((id_set, method))

    numeric_sets = _extract_numeric_chapter_references(normalized, valid_indices, technical=technical)
    explicit_sets.extend(numeric_sets)
    if not technical:
        bare = _parse_number_expression(normalized, valid_indices)
        if bare:
            explicit_sets.append((set(bare[0]), bare[1]))

    if not explicit_sets:
        return {"scope": "unresolved", "reason": "no explicit chapter locator matched"}
    if any(not indices for indices, _method in explicit_sets):
        return {"scope": "unresolved", "reason": "chapter locator contains an out-of-range array index"}

    # Multiple explicit syntaxes may corroborate one set (for example `1 / id`).
    # Technical locators may also deliberately name multiple disjoint Chapter clauses.
    sets = [indices for indices, _method in explicit_sets]
    if technical:
        resolved_numeric = set().union(*(indices for indices, _method in numeric_sets)) if numeric_sets else set()
        if id_set is not None and resolved_numeric and id_set != resolved_numeric:
            return {"scope": "unresolved", "reason": "conflicting explicit chapter locators"}
        resolved = id_set if id_set is not None else resolved_numeric
    else:
        resolved = sets[0]
        if any(indices != resolved for indices in sets[1:]):
            return {"scope": "unresolved", "reason": "conflicting explicit chapter locators"}
    if not resolved or not resolved <= valid_indices:
        return {"scope": "unresolved", "reason": "chapter locator resolved outside the chapter registry"}
    methods = {method for _indices, method in explicit_sets}
    method = next(iter(methods)) if len(methods) == 1 else "mixed_explicit"
    if method not in _RESOLUTION_METHODS:
        raise EvaluationError(f"Unsupported chapter resolution method: {method}")
    return {"scope": "chapters", "indices": sorted(resolved), "resolution": method}


def _domain_source_ref(
    book_id: str,
    domain_key: str,
    subcriterion_key: str,
    polarity: str,
    evidence_index: int,
) -> dict[str, Any]:
    return {
        "book_id": book_id,
        "domain_key": domain_key,
        "subcriterion_key": subcriterion_key,
        "polarity": polarity,
        "evidence_index": evidence_index,
    }


def _build_chapter_filter_index(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a report-only, source-addressable chapter filtering sidecar."""

    seen_books: set[str] = set()
    chapter_entries: list[dict[str, Any]] = []
    entries_by_key: dict[tuple[str, int], dict[str, Any]] = {}
    book_scope_domain: list[dict[str, Any]] = []
    book_scope_findings: list[dict[str, Any]] = []
    unresolved_domain: list[dict[str, Any]] = []
    unresolved_findings: list[dict[str, Any]] = []

    for record in records:
        book_id = _book_id(record)
        if book_id in seen_books:
            raise EvaluationError(f"Duplicate book_id in adjudicated records: {book_id}")
        seen_books.add(book_id)
        registry = _chapter_registry(record)
        for chapter_index, chapter in sorted(registry["by_index"].items()):
            observations = chapter.get("trust_qa_safety_issues")
            if not isinstance(observations, list):
                raise EvaluationError(f"trust_qa_safety_issues must be an array for {book_id} chapter {chapter_index}")
            entry = {
                "chapter_key": f"{book_id}::{chapter_index}",
                "book_id": book_id,
                "chapter_index": chapter_index,
                "chapter_id": chapter.get("chapter_id"),
                "domain_keys": [],
                "domain_associations": [],
                "max_issue_severity": "none",
                "issue_associations": [],
                "untyped_observation_count": len(observations),
            }
            entries_by_key[(book_id, chapter_index)] = entry
            chapter_entries.append(entry)

        for domain_key, definition in DOMAINS.items():
            domain = (record.get("domains") or {}).get(domain_key)
            if not isinstance(domain, Mapping):
                raise EvaluationError(f"Missing domain {domain_key} for {book_id}")
            subcriteria = domain.get("subcriteria")
            if not isinstance(subcriteria, Mapping):
                raise EvaluationError(f"Missing subcriteria for {book_id}/{domain_key}")
            for subcriterion_key in definition["subcriteria"]:
                item = subcriteria.get(subcriterion_key)
                if not isinstance(item, Mapping):
                    raise EvaluationError(f"Missing subcriterion {book_id}/{domain_key}/{subcriterion_key}")
                for evidence_field, polarity in (("strength_evidence", "strength"), ("limitation_evidence", "limitation")):
                    evidence_items = item.get(evidence_field)
                    if not isinstance(evidence_items, list):
                        raise EvaluationError(f"{evidence_field} must be an array for {book_id}/{domain_key}/{subcriterion_key}")
                    for evidence_index, evidence in enumerate(evidence_items):
                        if not isinstance(evidence, Mapping):
                            raise EvaluationError(f"Evidence must be an object for {book_id}/{domain_key}/{subcriterion_key}")
                        locator = str(evidence.get("chapter") or "")
                        source = _domain_source_ref(book_id, domain_key, subcriterion_key, polarity, evidence_index)
                        resolution = _resolve_chapter_locator(locator, registry, technical=False)
                        if resolution["scope"] == "book":
                            book_scope_domain.append({**source, "locator": locator})
                        elif resolution["scope"] == "unresolved":
                            unresolved_domain.append({**source, "locator": locator, "reason": resolution["reason"]})
                        else:
                            for chapter_index in resolution["indices"]:
                                entries_by_key[(book_id, chapter_index)]["domain_associations"].append(
                                    {
                                        "domain_key": domain_key,
                                        "subcriterion_key": subcriterion_key,
                                        "polarity": polarity,
                                        "evidence_index": evidence_index,
                                        "resolution": resolution["resolution"],
                                    }
                                )

        findings = record.get("technical_findings")
        if not isinstance(findings, list):
            raise EvaluationError(f"technical_findings must be an array for {book_id}")
        for finding_index, finding in enumerate(findings):
            if not isinstance(finding, Mapping):
                raise EvaluationError(f"Technical finding {finding_index} must be an object for {book_id}")
            locator = str(finding.get("locator") or "")
            severity = str(finding.get("severity") or "")
            finding_type = str(finding.get("type") or "")
            if severity not in _SEVERITY_ORDER or severity == "none":
                raise EvaluationError(f"Invalid technical-finding severity for {book_id}: {severity!r}")
            resolution = _resolve_chapter_locator(locator, registry, technical=True)
            source = {"book_id": book_id, "technical_finding_index": finding_index, "locator": locator}
            if resolution["scope"] == "book":
                book_scope_findings.append(source)
            elif resolution["scope"] == "unresolved":
                unresolved_findings.append({**source, "reason": resolution["reason"]})
            else:
                for chapter_index in resolution["indices"]:
                    entry = entries_by_key[(book_id, chapter_index)]
                    entry["issue_associations"].append(
                        {
                            "technical_finding_index": finding_index,
                            "severity": severity,
                            "type": finding_type,
                            "resolution": resolution["resolution"],
                        }
                    )

    domain_position = {key: index for index, key in enumerate(DOMAINS)}
    subcriterion_position = {
        (domain_key, subcriterion_key): index
        for domain_key, definition in DOMAINS.items()
        for index, subcriterion_key in enumerate(definition["subcriteria"])
    }
    polarity_position = {"strength": 0, "limitation": 1}
    for entry in chapter_entries:
        entry["domain_associations"].sort(
            key=lambda item: (
                domain_position[item["domain_key"]],
                subcriterion_position[(item["domain_key"], item["subcriterion_key"])],
                polarity_position[item["polarity"]],
                item["evidence_index"],
            )
        )
        associated = {item["domain_key"] for item in entry["domain_associations"]}
        entry["domain_keys"] = [domain_key for domain_key in DOMAINS if domain_key in associated]
        entry["issue_associations"].sort(key=lambda item: item["technical_finding_index"])
        if entry["issue_associations"]:
            entry["max_issue_severity"] = max(
                (item["severity"] for item in entry["issue_associations"]),
                key=_SEVERITY_ORDER.__getitem__,
            )

    return {
        "index_version": "1.0.0",
        "domain_filter_semantics": "A chapter matches a domain only when final adjudicated strength or limitation evidence for that domain explicitly resolves to the chapter.",
        "severity_filter_semantics": "Severity is the maximum chapter-scoped severity from structured technical_findings; free-text trust/QA/safety observations are not severity-inferred.",
        "chapters": chapter_entries,
        "book_scope_domain_evidence": book_scope_domain,
        "book_scope_technical_findings": book_scope_findings,
        "unresolved_domain_evidence": unresolved_domain,
        "unresolved_technical_findings": unresolved_findings,
    }


def _chapter_index_csv_rows(
    records: list[dict[str, Any]],
    chapter_filter_index: Mapping[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    records_by_id = {_book_id(record): record for record in records}
    domain_rows: list[dict[str, Any]] = []
    issue_rows: list[dict[str, Any]] = []
    for entry in chapter_filter_index["chapters"]:
        record = records_by_id[entry["book_id"]]
        book = record["book"]
        common = {
            "run_id": record["run_id"],
            "book_id": entry["book_id"],
            "title": _title(record),
            "package_path": book["package_path"],
            "chapter_index": entry["chapter_index"],
            "chapter_id": entry["chapter_id"],
        }
        for association in entry["domain_associations"]:
            domain_key = association["domain_key"]
            subcriterion_key = association["subcriterion_key"]
            evidence_field = f"{association['polarity']}_evidence"
            evidence = record["domains"][domain_key]["subcriteria"][subcriterion_key][evidence_field][association["evidence_index"]]
            domain_rows.append(
                {
                    **common,
                    "domain_key": domain_key,
                    "domain": DOMAINS[domain_key]["name"],
                    "subcriterion_key": subcriterion_key,
                    "subcriterion": DOMAINS[domain_key]["subcriteria"][subcriterion_key],
                    "polarity": association["polarity"],
                    "evidence_index": association["evidence_index"],
                    "resolution": association["resolution"],
                    "evidence_chapter": evidence["chapter"],
                    "evidence_section": evidence.get("section"),
                    "evidence_item_id": evidence.get("item_id"),
                }
            )
        for association in entry["issue_associations"]:
            finding = record["technical_findings"][association["technical_finding_index"]]
            issue_rows.append(
                {
                    **common,
                    "technical_finding_index": association["technical_finding_index"],
                    "severity": association["severity"],
                    "type": association["type"],
                    "reader_facing": finding["reader_facing"],
                    "locator": finding["locator"],
                    "resolution": association["resolution"],
                    "description": finding["description"],
                    "scoring_treatment": finding["scoring_treatment"],
                }
            )
    return domain_rows, issue_rows


def aggregate(run_dir: Path, skill_dir: Path) -> dict[str, Any]:
    run_manifest_path = run_dir / "data" / "run-manifest.json"
    run_manifest = read_json(run_manifest_path)
    if not isinstance(run_manifest, dict):
        raise EvaluationError("run-manifest.json must contain an object")
    sample_mode = _is_sample_run(run_manifest)
    if sample_mode:
        raise EvaluationError("chapter-sample aggregation is disabled; evaluate every source chapter in full-content mode")
    selection_manifest: dict[str, Any] | None = _sample_manifest(run_dir, run_manifest) if sample_mode else None
    sample_books = _sample_book_manifest(selection_manifest) if selection_manifest is not None else {}

    loaded = _load_records(run_dir)
    records = []
    for path, record in loaded:
        primary = _load_rater(run_dir, "primary", path.name)
        verification = _load_rater(run_dir, "verification", path.name)
        identifier = _book_id(record)
        package_path, actual_hash = _source_package(run_manifest, identifier)
        inspection = inspect_package(package_path, run_dir / "tmp" / "aggregate-source-inspection")
        receipt_root = run_dir / "jobs" / "worker-receipts" / identifier
        receipt_paths = {
            "primary": receipt_root / "primary.dispatch.json",
            "verification": receipt_root / "verification.dispatch.json",
            "pair": receipt_root / "pair.seal.json",
        }
        try:
            receipt_values = {key: read_json(value) for key, value in receipt_paths.items()}
        except (OSError, json.JSONDecodeError) as exc:
            raise EvaluationError(f"missing or unreadable worker receipt chain for {identifier}: {exc}") from exc
        if any(not isinstance(value, Mapping) for value in receipt_values.values()):
            raise EvaluationError(f"worker receipt chain must contain JSON objects for {identifier}")
        _validate_rater_pair(
            primary,
            verification,
            record,
            source_inspection=inspection,
            actual_hash=actual_hash,
            book_id=identifier,
            primary_dispatch=receipt_values["primary"],
            verification_dispatch=receipt_values["verification"],
            pair_seal=receipt_values["pair"],
        )
        adjudicated_schema = read_json(skill_dir / "references" / "adjudicated-book.schema.json")
        if not isinstance(adjudicated_schema, Mapping):
            raise EvaluationError("adjudicated-book.schema.json must be a JSON object")
        adjudicated_errors = validate_result(
            record,
            schema=adjudicated_schema,
            expected_source_hash=actual_hash,
            expected_book_id=identifier,
            expected_run_id=str(run_manifest.get("run_id") or ""),
            expected_role="adjudicated",
            source_inspection=inspection,
            require_full_content=True,
            adjudicated=True,
        )
        if adjudicated_errors:
            raise EvaluationError(f"invalid adjudicated record for {identifier}: " + " | ".join(adjudicated_errors))
        _attach_rater_values(run_dir, path.name, record)
        if sample_mode:
            _require_identical_sample_scope(record, primary, verification)
            _require_sample_scope_run_identity(record, run_manifest["sampling"])
            sample_book = sample_books.get(identifier)
            if not sample_book:
                raise EvaluationError(f"Sample selection manifest is missing adjudicated book: {identifier}")
            # Materialize and validate the shared CSV/report scope once before ranking.
            _sample_scope_columns(record, sample_book)
        records.append(record)
    if sample_mode and set(sample_books) != {_book_id(record) for record in records}:
        missing = sorted(set(sample_books) - {_book_id(record) for record in records})
        extra = sorted({_book_id(record) for record in records} - set(sample_books))
        raise EvaluationError(
            f"Sample adjudicated/selection book sets differ; missing adjudications={missing}, unknown adjudications={extra}"
        )
    records = _rank(records)
    winners = _category_winners(records)
    chapter_filter_index = _build_chapter_filter_index(records)
    chapter_domain_index_rows, chapter_issue_index_rows = _chapter_index_csv_rows(records, chapter_filter_index)
    manual_analysis_path = run_dir / "data" / "cross-book-analysis.json"
    if manual_analysis_path.exists():
        cross_book_analysis = read_json(manual_analysis_path)
    else:
        cross_book_analysis = _default_cross_book_analysis(records, winners, sample_mode=sample_mode)
    expected = int(run_manifest.get("canonical_books", 0))
    if expected and len(records) != expected:
        raise EvaluationError(f"Expected {expected} adjudicated books, found {len(records)}")
    if run_manifest.get("status") != "completed":
        run_manifest["status"] = "aggregated"
    run_manifest["books_adjudicated"] = len(records)
    run_manifest["chapters_read_full"] = sum(int(record["book"]["chapter_count_read_full"]) for record in records)
    run_manifest["chapters_partial"] = sum(int(record["book"]["chapter_count_partial"]) for record in records)
    run_manifest["chapters_inaccessible"] = sum(int(record["book"]["chapter_count_inaccessible"]) for record in records)
    if sample_mode:
        run_manifest["evaluation_mode"] = "chapter_sample"
        sampling = run_manifest["sampling"]
        actual_selected = sum(len(record.get("chapter_evidence", [])) for record in records)
        if actual_selected != int(sampling["selected_chapter_count"]):
            raise EvaluationError(
                f"Adjudicated chapter evidence count {actual_selected} differs from selected total {sampling['selected_chapter_count']}"
            )
    validation = run_manifest.setdefault("validation", {})
    if not str(validation.get("book_results") or "").startswith("passed"):
        validation["book_results"] = "passed"
    atomic_write_json(run_manifest_path, run_manifest)

    scorecard_rows = []
    domain_rows = []
    subcriterion_rows = []
    chapter_rows = []
    gate_rows = []
    technical_rows = []
    agreement_rows = []
    calibration_rows = []
    for record in records:
        book = record["book"]
        book_id = _book_id(record)
        title = _title(record)
        run_id = str(record["run_id"])
        package_path = str(book["package_path"])
        sample_columns = _sample_scope_columns(record, sample_books[book_id]) if sample_mode else {}
        gates_summary = "; ".join(f"{key}={record['gates'][key]['status']}" for key in GATE_KEYS)
        scorecard = {
            "run_id": run_id,
            "rank": record["rank"],
            "book_id": book_id,
            "title": title,
            "package_path": package_path,
            "overall_score": round(float(record["overall_score"]), 1),
            "classification": record["classification"],
            "certification_status": record["certification_status"],
            "confidence": (record.get("confidence") or {}).get("level", "low"),
            "chapter_completeness": (record.get("confidence") or {}).get("chapter_completeness_ratio", 0),
            "tie_group": record.get("tie_group") or "",
            "gates": gates_summary,
            **sample_columns,
        }
        if sample_mode:
            scorecard["sample_order"] = record["rank"]
        for domain_key in DOMAINS:
            scorecard[domain_key] = round(float(record["domains"][domain_key]["domain_score"]), 2)
        scorecard_rows.append(scorecard)
        for domain_key, definition in DOMAINS.items():
            domain = record["domains"][domain_key]
            domain_rows.append(
                {
                    "run_id": run_id,
                    "rank": record["rank"],
                    "book_id": book_id,
                    "title": title,
                    "package_path": package_path,
                    "domain_key": domain_key,
                    "domain": definition["name"],
                    "weight": definition["weight"],
                    "domain_score": round(float(domain["domain_score"]), 2),
                    "weighted_points": round(float(domain["weighted_points"]), 2),
                    "whole_book_pattern": domain["whole_book_pattern"],
                }
            )
            for subcriterion_key, subcriterion_name in definition["subcriteria"].items():
                item = domain["subcriteria"][subcriterion_key]
                path = f"domains.{domain_key}.subcriteria.{subcriterion_key}"
                rater_value = record["rater_values"][path]
                subcriterion_rows.append(
                    {
                        "run_id": run_id,
                        "rank": record["rank"],
                        "book_id": book_id,
                        "title": title,
                        "package_path": package_path,
                        "domain_key": domain_key,
                        "domain": definition["name"],
                        "subcriterion_key": subcriterion_key,
                        "subcriterion": subcriterion_name,
                        "primary_rating": rater_value["primary"],
                        "verification_rating": rater_value["verification"],
                        "final_rating": rater_value["final"],
                        "rationale": item["rationale"],
                        "strength_evidence": item["strength_evidence"],
                        "limitation_evidence": item["limitation_evidence"],
                    }
                )
        for chapter in record.get("chapter_evidence", []):
            selected_manifest = _selected_chapters(record["evaluation_scope"]) if sample_mode else []
            sample_selection = next(
                (
                    item for item in selected_manifest
                    if item.get("original_chapter_position") == chapter.get("chapter_index")
                    or item.get("chapter_id") == chapter.get("chapter_id")
                ),
                {},
            )
            chapter_rows.append(
                {
                    "run_id": run_id,
                    "book_id": book_id,
                    "title": title,
                    "package_path": package_path,
                    "chapter_index": chapter["chapter_index"],
                    "chapter_id": chapter.get("chapter_id"),
                    "chapter_title": chapter["title"],
                    "read_status": chapter["read_status"],
                    "central_ideas": chapter["central_ideas"],
                    "mental_model_contribution": chapter["mental_model_contribution"],
                    "engagement_and_pacing": chapter["engagement_and_pacing"],
                    "learning_support": chapter["learning_support"],
                    "retention_support": chapter["retention_support"],
                    "transfer_support": chapter["transfer_support"],
                    "trust_qa_safety_issues": chapter["trust_qa_safety_issues"],
                    "evidence": chapter["evidence"],
                    **sample_columns,
                    **(
                        {
                            "sample_selection_order": sample_selection.get("selection_order"),
                            "original_chapter_position": sample_selection.get(
                                "original_chapter_position", chapter.get("chapter_index")
                            ),
                        }
                        if sample_mode
                        else {}
                    ),
                }
            )
        for gate_key in GATE_KEYS:
            gate = record["gates"][gate_key]
            gate_rows.append({"run_id": run_id, "book_id": book_id, "title": title, "package_path": package_path, "gate": gate_key, "status": gate["status"], "rationale": gate["rationale"], "evidence": gate.get("evidence", []), **sample_columns})
        for finding in record.get("technical_findings", []):
            technical_rows.append({"run_id": run_id, "book_id": book_id, "title": title, "package_path": package_path, **finding})
        agreement = record.get("rater_agreement") or {}
        agreement_rows.append(
            {
                "run_id": run_id,
                "book_id": book_id,
                "title": title,
                "package_path": package_path,
                "mean_absolute_subcriterion_difference": agreement.get("mean_absolute_subcriterion_difference"),
                "maximum_subcriterion_difference": agreement.get("maximum_subcriterion_difference"),
                "overall_score_difference": agreement.get("overall_score_difference"),
                "gate_conflicts": agreement.get("gate_conflicts", []),
                "disagreement_count": len(agreement.get("disagreements", [])),
                "confidence": (record.get("confidence") or {}).get("level"),
                "confidence_rationale": (record.get("confidence") or {}).get("rationale"),
            }
        )
        for change in record.get("calibration_changes", []):
            calibration_rows.append({"run_id": run_id, "book_id": book_id, "title": title, "package_path": package_path, **change})

    sample_scope_fields = [
        "evaluation_mode", "sample_source_chapter_count", "sample_selected_chapter_count",
        "sample_not_selected_chapter_count", "sample_selected_positions",
    ] if sample_mode else []
    scorecard_fields = ["run_id", "rank", *(("sample_order",) if sample_mode else ()), "book_id", "title", "package_path", "overall_score", "classification", "certification_status", "confidence", "chapter_completeness", "tie_group", "gates", *sample_scope_fields, *DOMAINS.keys()]
    write_csv(run_dir / "data" / "scorecard.csv", scorecard_fields, scorecard_rows)
    write_csv(run_dir / "data" / "domain-scores.csv", ("run_id", "rank", "book_id", "title", "package_path", "domain_key", "domain", "weight", "domain_score", "weighted_points", "whole_book_pattern"), domain_rows)
    write_csv(run_dir / "data" / "subcriteria.csv", ("run_id", "rank", "book_id", "title", "package_path", "domain_key", "domain", "subcriterion_key", "subcriterion", "primary_rating", "verification_rating", "final_rating", "rationale", "strength_evidence", "limitation_evidence"), subcriterion_rows)
    write_csv(run_dir / "data" / "chapter-evidence.csv", ("run_id", "book_id", "title", "package_path", "chapter_index", "chapter_id", "chapter_title", "read_status", "central_ideas", "mental_model_contribution", "engagement_and_pacing", "learning_support", "retention_support", "transfer_support", "trust_qa_safety_issues", "evidence", *sample_scope_fields, *(("sample_selection_order", "original_chapter_position") if sample_mode else ())), chapter_rows)
    write_csv(
        run_dir / "data" / "chapter-domain-index.csv",
        (
            "run_id", "book_id", "title", "package_path", "chapter_index", "chapter_id",
            "domain_key", "domain", "subcriterion_key", "subcriterion", "polarity",
            "evidence_index", "resolution", "evidence_chapter", "evidence_section", "evidence_item_id",
        ),
        chapter_domain_index_rows,
    )
    write_csv(
        run_dir / "data" / "chapter-issue-index.csv",
        (
            "run_id", "book_id", "title", "package_path", "chapter_index", "chapter_id",
            "technical_finding_index", "severity", "type", "reader_facing", "locator",
            "resolution", "description", "scoring_treatment",
        ),
        chapter_issue_index_rows,
    )
    write_csv(run_dir / "data" / "gates.csv", ("run_id", "book_id", "title", "package_path", "gate", "status", "rationale", "evidence", *sample_scope_fields), gate_rows)
    write_csv(run_dir / "data" / "technical-findings.csv", ("run_id", "book_id", "title", "package_path", "severity", "type", "locator", "description", "reader_facing", "scoring_treatment"), technical_rows)
    write_csv(run_dir / "data" / "rater-agreement.csv", ("run_id", "book_id", "title", "package_path", "mean_absolute_subcriterion_difference", "maximum_subcriterion_difference", "overall_score_difference", "gate_conflicts", "disagreement_count", "confidence", "confidence_rationale"), agreement_rows)
    write_csv(run_dir / "data" / "calibration-log.csv", ("run_id", "book_id", "title", "package_path", "path", "original", "final", "reason", "evidence"), calibration_rows)

    csv_downloads = {}
    for path in sorted((run_dir / "data").glob("*.csv"), key=lambda item: item.name):
        csv_downloads[path.name] = path.read_text(encoding="utf-8")
    rubric_path = skill_dir / "references" / "rubric-v2.md"
    rubric_markdown = rubric_path.read_text(encoding="utf-8")
    report_data = {
        **({"result_type": "experimental_chapter_sample_report"} if sample_mode else {}),
        "schema_version": SCHEMA_VERSION,
        "rubric_version": RUBRIC_VERSION,
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "run": run_manifest,
        "rubric": {"markdown": rubric_markdown, "domains": DOMAINS, "formula": "sum((mean of four subcriterion ratings / 4) × domain weight)"},
        "books": records,
        "chapter_filter_index": chapter_filter_index,
        "rankings": [{"rank": record["rank"], "book_id": _book_id(record), "title": _title(record), "score": record["overall_score"], "tie_group": record.get("tie_group")} for record in records],
        "category_winners": winners,
        "cross_book_analysis": cross_book_analysis,
        "limitations": run_manifest.get("limitations", []),
        "csv_downloads": csv_downloads,
    }
    prompt_pack = remediation_pack(report_data)
    atomic_write_json(run_dir / "data" / "remediation-prompts.json", prompt_pack)
    atomic_write_text(run_dir / "data" / "remediation-prompts.md", markdown_pack(prompt_pack))
    atomic_write_json(run_dir / "data" / "report-data.json", report_data)
    return report_data


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--skill-dir", type=Path, default=Path(__file__).resolve().parents[1])
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        data = aggregate(args.run_dir.resolve(), args.skill_dir.resolve())
    except (EvaluationError, OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        print(f"aggregation error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({"books": len(data["books"]), "chapters": sum(len(book.get("chapter_evidence", [])) for book in data["books"]), "report_data": str((args.run_dir / 'data/report-data.json').resolve())}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
