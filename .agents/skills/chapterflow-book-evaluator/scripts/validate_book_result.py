#!/usr/bin/env python3
"""Validate a blind or adjudicated ChapterFlow evaluation and its arithmetic."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Mapping

from common import (
    CERTIFICATION_STATUSES,
    DOMAINS,
    GATE_KEYS,
    GATE_STATUSES,
    SAMPLE_CERTIFICATION_STATUSES,
    SAMPLE_CLASSIFICATION,
    SAMPLE_EVALUATION_MODE,
    SAMPLE_INFERENCE_SCOPE,
    SAMPLE_PACKAGE_MODE,
    SAMPLE_PROTOCOL_VERSION,
    SAMPLE_RESULT_TYPE,
    SAMPLE_SCORE_LABEL,
    SAMPLE_SELECTION_ALGORITHM,
    SHA256_PATTERN,
    EvaluationError,
    calculate_scores,
    derive_certification,
    derive_sample_certification,
    evaluation_scope_from_sample_metadata,
    is_chapter_sample,
    inspect_package,
    json_equivalent,
    rating_paths,
    read_json,
    sample_selected_content_sufficient,
    source_hash,
)
from worker_receipts import validate_result_receipt_membership


SAMPLE_SCOPE_KEYS = {
    "protocol_version",
    "mode",
    "sample_mode",
    "inference_scope",
    "score_label",
    "public_seed",
    "per_book_seed_sha256",
    "selection_algorithm",
    "selection_manifest_sha256",
    "original_source",
    "sampled_package_sha256",
    "requested_chapter_count",
    "selected_chapter_count",
    "selected_chapters",
    "scope_limitation",
    "full_book_certification_eligible",
}
SAMPLE_SELECTION_KEYS = {
    "original_chapter_index",
    "original_chapter_position",
    "selection_order",
    "chapter_id",
    "chapter_number",
    "chapter_title",
    "chapter_fingerprint_sha256",
    "selection_rank_sha256",
}
SAMPLE_RATING_PATHS = {
    f"domains.{domain}.subcriteria.{subcriterion}"
    for domain, subcriterion in rating_paths()
}
REQUIRED_SAMPLE_LIMITED_PATHS = {
    path for path in SAMPLE_RATING_PATHS if path.startswith("domains.whole_book_coherence.subcriteria.")
}


def _jsonschema_errors(data: Any, schema: Any) -> list[str]:
    try:
        import jsonschema  # type: ignore
    except ImportError:
        return _mini_schema_errors(data, schema, schema)
    validator = jsonschema.Draft202012Validator(schema)
    errors = []
    for error in sorted(validator.iter_errors(data), key=lambda item: list(item.absolute_path)):
        path = ".".join(str(part) for part in error.absolute_path) or "$"
        errors.append(f"schema {path}: {error.message}")
    return errors


def _mini_schema_errors(data: Any, schema: Any, root: Any, path: str = "$") -> list[str]:
    """Validate the conservative JSON-Schema subset used by this skill."""
    if schema is True:
        return []
    if schema is False:
        return [f"schema {path}: value is forbidden"]
    if not isinstance(schema, dict):
        return []
    if "$ref" in schema:
        ref = schema["$ref"]
        if not isinstance(ref, str) or not ref.startswith("#/"):
            return [f"schema {path}: unsupported reference {ref!r}"]
        target = root
        try:
            for part in ref[2:].split("/"):
                target = target[part.replace("~1", "/").replace("~0", "~")]
        except (KeyError, TypeError):
            return [f"schema {path}: unresolved reference {ref}"]
        return _mini_schema_errors(data, target, root, path)
    errors: list[str] = []
    for child in schema.get("allOf", []):
        errors.extend(_mini_schema_errors(data, child, root, path))
    if "anyOf" in schema:
        attempts = [_mini_schema_errors(data, child, root, path) for child in schema["anyOf"]]
        if not any(not attempt for attempt in attempts):
            errors.append(f"schema {path}: does not match any allowed schema")
    if "oneOf" in schema:
        attempts = [_mini_schema_errors(data, child, root, path) for child in schema["oneOf"]]
        if sum(1 for attempt in attempts if not attempt) != 1:
            errors.append(f"schema {path}: must match exactly one allowed schema")
    expected_type = schema.get("type")
    if expected_type is not None:
        types = expected_type if isinstance(expected_type, list) else [expected_type]
        if not any(_matches_type(data, item) for item in types):
            return [f"schema {path}: expected type {' or '.join(types)}, got {type(data).__name__}"]
    if "const" in schema and data != schema["const"]:
        errors.append(f"schema {path}: must equal {schema['const']!r}")
    if "enum" in schema and data not in schema["enum"]:
        errors.append(f"schema {path}: value {data!r} is not in the allowed enum")
    if isinstance(data, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in data:
                errors.append(f"schema {path}: missing required property {key}")
        properties = schema.get("properties", {})
        pattern_properties = schema.get("patternProperties", {})
        for key, value in data.items():
            child_path = f"{path}.{key}"
            if key in properties:
                errors.extend(_mini_schema_errors(value, properties[key], root, child_path))
                continue
            matched = False
            for pattern, child_schema in pattern_properties.items():
                if re.search(pattern, key):
                    matched = True
                    errors.extend(_mini_schema_errors(value, child_schema, root, child_path))
            if not matched and schema.get("additionalProperties") is False:
                errors.append(f"schema {child_path}: additional property is not allowed")
            elif not matched and isinstance(schema.get("additionalProperties"), dict):
                errors.extend(_mini_schema_errors(value, schema["additionalProperties"], root, child_path))
        if "minProperties" in schema and len(data) < schema["minProperties"]:
            errors.append(f"schema {path}: needs at least {schema['minProperties']} properties")
        if "maxProperties" in schema and len(data) > schema["maxProperties"]:
            errors.append(f"schema {path}: allows at most {schema['maxProperties']} properties")
    if isinstance(data, list):
        if "minItems" in schema and len(data) < schema["minItems"]:
            errors.append(f"schema {path}: needs at least {schema['minItems']} items")
        if "maxItems" in schema and len(data) > schema["maxItems"]:
            errors.append(f"schema {path}: allows at most {schema['maxItems']} items")
        if schema.get("uniqueItems") and len({json.dumps(item, sort_keys=True, default=str) for item in data}) != len(data):
            errors.append(f"schema {path}: items must be unique")
        if isinstance(schema.get("items"), dict):
            for index, item in enumerate(data):
                errors.extend(_mini_schema_errors(item, schema["items"], root, f"{path}[{index}]"))
    if isinstance(data, str):
        if "minLength" in schema and len(data) < schema["minLength"]:
            errors.append(f"schema {path}: string is shorter than {schema['minLength']}")
        if "maxLength" in schema and len(data) > schema["maxLength"]:
            errors.append(f"schema {path}: string is longer than {schema['maxLength']}")
        if "pattern" in schema and re.search(schema["pattern"], data) is None:
            errors.append(f"schema {path}: string does not match required pattern")
    if isinstance(data, (int, float)) and not isinstance(data, bool):
        if "minimum" in schema and data < schema["minimum"]:
            errors.append(f"schema {path}: value is below {schema['minimum']}")
        if "maximum" in schema and data > schema["maximum"]:
            errors.append(f"schema {path}: value is above {schema['maximum']}")
        if "multipleOf" in schema:
            quotient = float(data) / float(schema["multipleOf"])
            if abs(quotient - round(quotient)) > 1e-9:
                errors.append(f"schema {path}: value is not a multiple of {schema['multipleOf']}")
    return errors


def _matches_type(value: Any, expected: str) -> bool:
    return {
        "null": value is None,
        "object": isinstance(value, dict),
        "array": isinstance(value, list),
        "string": isinstance(value, str),
        "boolean": isinstance(value, bool),
        "integer": isinstance(value, int) and not isinstance(value, bool),
        "number": isinstance(value, (int, float)) and not isinstance(value, bool),
    }.get(expected, True)


def _numeric_close(left: Any, right: Any, tolerance: float = 1e-8) -> bool:
    try:
        return abs(float(left) - float(right)) <= tolerance
    except (TypeError, ValueError):
        return False


def _all_strings(value: Any, path: str = "$") -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    if isinstance(value, str):
        found.append((path, value))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            found.extend(_all_strings(item, f"{path}[{index}]"))
    elif isinstance(value, dict):
        for key, item in value.items():
            found.extend(_all_strings(item, f"{path}.{key}"))
    return found


def _non_negative_integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _positive_integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 1


def _sample_verdict_prefix(selected_count: int) -> str:
    words = {
        1: "one",
        2: "two",
        3: "three",
        4: "four",
        5: "five",
        6: "six",
        7: "seven",
        8: "eight",
        9: "nine",
        10: "ten",
    }
    count_label = words.get(selected_count, str(selected_count))
    return f"Experimental {count_label}-chapter sample:"


def _sample_scope_errors(
    data: Mapping[str, Any],
    *,
    expected_evaluation_scope: Mapping[str, Any] | None,
) -> list[str]:
    errors: list[str] = []
    if data.get("result_type") != SAMPLE_RESULT_TYPE:
        errors.append(f"result_type must be {SAMPLE_RESULT_TYPE}")
    if data.get("sample_scope_acknowledged") is not True:
        errors.append("sample_scope_acknowledged must be true")
    if data.get("unsampled_content_claims_found") is not False:
        errors.append("unsampled_content_claims_found must be false")

    scope = data.get("evaluation_scope")
    if not isinstance(scope, Mapping):
        errors.append("evaluation_scope must be an object in chapter-sample mode")
        scope = {}
    if set(scope) != SAMPLE_SCOPE_KEYS:
        errors.append("evaluation_scope must contain exactly the sample contract fields")
    constants = {
        "protocol_version": SAMPLE_PROTOCOL_VERSION,
        "mode": SAMPLE_EVALUATION_MODE,
        "sample_mode": SAMPLE_PACKAGE_MODE,
        "inference_scope": SAMPLE_INFERENCE_SCOPE,
        "score_label": SAMPLE_SCORE_LABEL,
        "full_book_certification_eligible": False,
    }
    for key, expected in constants.items():
        if scope.get(key) != expected:
            errors.append(f"evaluation_scope.{key} must equal {expected!r}")
    for key in ("per_book_seed_sha256", "selection_manifest_sha256", "sampled_package_sha256"):
        if not SHA256_PATTERN.fullmatch(str(scope.get(key) or "")):
            errors.append(f"evaluation_scope.{key} must be a lowercase SHA-256 digest")
    if not str(scope.get("public_seed") or "").strip():
        errors.append("evaluation_scope.public_seed is required")
    if not isinstance(scope.get("selection_algorithm"), Mapping) or not scope.get("selection_algorithm"):
        errors.append("evaluation_scope.selection_algorithm must be a non-empty object")
    elif scope["selection_algorithm"].get("name") != SAMPLE_SELECTION_ALGORITHM:
        errors.append(
            f"evaluation_scope.selection_algorithm.name must equal {SAMPLE_SELECTION_ALGORITHM!r}"
        )
    if not str(scope.get("scope_limitation") or "").strip():
        errors.append("evaluation_scope.scope_limitation is required")

    original = scope.get("original_source")
    if not isinstance(original, Mapping):
        errors.append("evaluation_scope.original_source must be an object")
        original = {}
    if set(original) != {"path", "sha256", "chapter_count"}:
        errors.append("evaluation_scope.original_source must contain exactly path, sha256, and chapter_count")
    if not str(original.get("path") or "").strip():
        errors.append("evaluation_scope.original_source.path is required")
    if not SHA256_PATTERN.fullmatch(str(original.get("sha256") or "")):
        errors.append("evaluation_scope.original_source.sha256 must be a lowercase SHA-256 digest")
    population_count = original.get("chapter_count")
    if not _non_negative_integer(population_count):
        errors.append("evaluation_scope.original_source.chapter_count must be a non-negative integer")
        population_count = 0

    requested_count = scope.get("requested_chapter_count")
    selected_count = scope.get("selected_chapter_count")
    if not _positive_integer(requested_count):
        errors.append("evaluation_scope.requested_chapter_count must be a positive integer")
        requested_count = 0
    if not _positive_integer(selected_count):
        errors.append("evaluation_scope.selected_chapter_count must be a positive integer")
        selected_count = 0
    if selected_count > requested_count:
        errors.append("evaluation_scope.selected_chapter_count cannot exceed requested_chapter_count")
    if selected_count > population_count:
        errors.append("evaluation_scope.selected_chapter_count cannot exceed original population chapter_count")

    selected = scope.get("selected_chapters")
    if not isinstance(selected, list):
        errors.append("evaluation_scope.selected_chapters must be an array")
        selected = []
    if len(selected) != selected_count:
        errors.append(
            f"evaluation_scope.selected_chapters has {len(selected)} records; expected selected_chapter_count {selected_count}"
        )
    identities: list[tuple[Any, Any, Any]] = []
    positions: list[int] = []
    selection_orders: list[int] = []
    for index, selection in enumerate(selected):
        path = f"evaluation_scope.selected_chapters[{index}]"
        if not isinstance(selection, Mapping):
            errors.append(f"{path} must be an object")
            continue
        if set(selection) != SAMPLE_SELECTION_KEYS:
            errors.append(f"{path} must contain exactly the sample selection fields")
        original_index = selection.get("original_chapter_index")
        original_position = selection.get("original_chapter_position")
        selection_order = selection.get("selection_order")
        if not _non_negative_integer(original_index):
            errors.append(f"{path}.original_chapter_index must be a non-negative integer")
        if not _positive_integer(original_position):
            errors.append(f"{path}.original_chapter_position must be a positive integer")
        elif _non_negative_integer(original_index) and original_position != original_index + 1:
            errors.append(f"{path} original position must equal original index plus one")
        if not _positive_integer(selection_order):
            errors.append(f"{path}.selection_order must be a positive integer")
        if not isinstance(selection.get("chapter_id"), str):
            errors.append(f"{path}.chapter_id must be a string")
        if not isinstance(selection.get("chapter_title"), str) or not selection.get("chapter_title"):
            errors.append(f"{path}.chapter_title must be a non-empty string")
        for hash_key in ("chapter_fingerprint_sha256", "selection_rank_sha256"):
            if not SHA256_PATTERN.fullmatch(str(selection.get(hash_key) or "")):
                errors.append(f"{path}.{hash_key} must be a lowercase SHA-256 digest")
        if isinstance(original_position, int) and not isinstance(original_position, bool):
            positions.append(original_position)
        if isinstance(selection_order, int) and not isinstance(selection_order, bool):
            selection_orders.append(selection_order)
        identities.append((original_position, selection.get("chapter_id"), selection.get("chapter_title")))
    if positions != sorted(positions) or len(set(positions)) != len(positions):
        errors.append("evaluation_scope.selected_chapters must have unique positions in original source order")
    if sorted(selection_orders) != list(range(1, len(selected) + 1)):
        errors.append("evaluation_scope.selected_chapters selection_order values must be exactly 1..selected_chapter_count")

    if data.get("source_hash") != scope.get("sampled_package_sha256"):
        errors.append("source_hash must equal evaluation_scope.sampled_package_sha256")
    book = data.get("book") if isinstance(data.get("book"), Mapping) else {}
    if book.get("chapter_count_expected") != selected_count:
        errors.append("book.chapter_count_expected must equal evaluation_scope.selected_chapter_count")

    evidence = data.get("chapter_evidence")
    if not isinstance(evidence, list):
        evidence = []
    observed_identities: list[tuple[Any, Any, Any]] = []
    for index, chapter in enumerate(evidence):
        path = f"chapter_evidence[{index}]"
        if not isinstance(chapter, Mapping):
            continue
        original_index = chapter.get("original_chapter_index")
        original_position = chapter.get("original_chapter_position")
        selection_order = chapter.get("selection_order")
        if not _non_negative_integer(original_index):
            errors.append(f"{path}.original_chapter_index must be a non-negative integer")
        if not _positive_integer(original_position):
            errors.append(f"{path}.original_chapter_position must be a positive integer")
        elif _non_negative_integer(original_index) and original_position != original_index + 1:
            errors.append(f"{path} original position must equal original index plus one")
        if chapter.get("chapter_index") != original_position:
            errors.append(f"{path}.chapter_index must equal original_chapter_position")
        if not _positive_integer(selection_order):
            errors.append(f"{path}.selection_order must be a positive integer")
        observed_identities.append((original_position, chapter.get("chapter_id"), chapter.get("title")))
        if index < len(selected) and isinstance(selected[index], Mapping):
            if selection_order != selected[index].get("selection_order"):
                errors.append(f"{path}.selection_order does not match the selected chapter contract")
    if observed_identities != identities:
        errors.append("chapter_evidence must match the exact selected chapter positions, ids, and titles in source order")

    limited = data.get("scope_limited_subcriteria")
    if not isinstance(limited, list) or not limited:
        errors.append("scope_limited_subcriteria must be a non-empty array")
    else:
        if len(limited) != len(set(item for item in limited if isinstance(item, str))):
            errors.append("scope_limited_subcriteria must contain unique rating paths")
        unknown = [item for item in limited if item not in SAMPLE_RATING_PATHS]
        if unknown:
            errors.append("scope_limited_subcriteria contains an unknown rubric rating path")
        missing_required = REQUIRED_SAMPLE_LIMITED_PATHS - set(
            item for item in limited if isinstance(item, str)
        )
        if missing_required:
            errors.append(
                "scope_limited_subcriteria must include all whole_book_coherence subcriteria in chapter-sample mode"
            )

    if expected_evaluation_scope is not None and not json_equivalent(scope, expected_evaluation_scope):
        errors.append("evaluation_scope mismatch against the expected job contract")
    return errors


def _sample_package_errors(
    data: Mapping[str, Any],
    package: Mapping[str, Any],
    *,
    sampled_package_sha256: str,
) -> list[str]:
    errors: list[str] = []
    metadata = package.get("_chapterflowEvaluationSample")
    if not isinstance(metadata, Mapping):
        return ["sample package lacks _chapterflowEvaluationSample metadata"]
    scope = data.get("evaluation_scope")
    if not isinstance(scope, Mapping):
        return ["evaluation_scope is required before sample package verification"]
    try:
        expected = evaluation_scope_from_sample_metadata(
            metadata,
            sampled_package_sha256=sampled_package_sha256,
            selection_manifest_sha256=str(scope.get("selection_manifest_sha256") or ""),
            scope_limitation=str(scope.get("scope_limitation") or ""),
        )
    except EvaluationError as exc:
        return [f"sample package metadata is invalid: {exc}"]
    if not json_equivalent(scope, expected):
        errors.append("evaluation_scope does not match embedded _chapterflowEvaluationSample metadata")
    if metadata.get("run_id") != data.get("run_id"):
        errors.append("sample package run_id does not match result run_id")
    book = data.get("book") if isinstance(data.get("book"), Mapping) else {}
    if metadata.get("book_id") != book.get("book_id"):
        errors.append("sample package book_id does not match result book_id")

    chapters = package.get("chapters")
    selected = metadata.get("selected_chapters")
    if not isinstance(chapters, list) or not isinstance(selected, list):
        errors.append("sample package chapters and selected_chapters must be arrays")
        return errors
    if len(chapters) != len(selected):
        errors.append("sample package chapter count does not match embedded selected_chapters")
        return errors
    for index, (chapter, selection) in enumerate(zip(chapters, selected)):
        if not isinstance(chapter, Mapping) or not isinstance(selection, Mapping):
            errors.append(f"sample package selected chapter {index} must be an object")
            continue
        chapter_id = chapter.get("chapterId")
        if chapter_id in (None, ""):
            chapter_id = chapter.get("id")
        if str(chapter_id or "") != selection.get("chapter_id"):
            errors.append(f"sample package chapter {index} id does not match embedded selection")
        if str(chapter.get("title") or "") != selection.get("chapter_title"):
            errors.append(f"sample package chapter {index} title does not match embedded selection")
        fingerprint = hashlib.sha256(
            json.dumps(chapter, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        if fingerprint != selection.get("chapter_fingerprint_sha256"):
            errors.append(f"sample package chapter {index} fingerprint does not match embedded selection")
    return errors


def _unqualified_full_book_claims(value: Any) -> list[str]:
    claim_patterns = (
        re.compile(r"\b(?:the|this)\s+book\s+(?:always|never|consistently|uniformly|throughout|is|has|uses|provides|offers|supports|lacks|fails|contains|maintains|builds)\b", re.IGNORECASE),
        re.compile(r"\bthroughout\s+(?:the\s+)?book\b", re.IGNORECASE),
        re.compile(r"\b(?:all|every|each)\s+chapters?\b", re.IGNORECASE),
        re.compile(r"\b(?:book-wide|whole-book)\b", re.IGNORECASE),
    )
    qualifier = re.compile(
        r"\b(?:selected|sampled|sample-wide|sample|unsampled|not\s+(?:a\s+)?full-book|cannot\s+(?:establish|infer)|does\s+not\s+establish)\b",
        re.IGNORECASE,
    )
    found: list[str] = []
    for path, text in _all_strings(value):
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", text):
            if any(pattern.search(sentence) for pattern in claim_patterns) and qualifier.search(sentence) is None:
                found.append(path)
                break
    return found


def validate_result(
    data: Mapping[str, Any],
    *,
    schema: Mapping[str, Any] | None = None,
    expected_source_hash: str | None = None,
    expected_book_id: str | None = None,
    expected_job_id: str | None = None,
    expected_run_id: str | None = None,
    expected_role: str | None = None,
    expected_evaluation_scope: Mapping[str, Any] | None = None,
    sample_package: Mapping[str, Any] | None = None,
    sample_package_sha256: str | None = None,
    source_inspection: Mapping[str, Any] | None = None,
    worker_dispatch_receipt: Mapping[str, Any] | None = None,
    blind_pair_seal: Mapping[str, Any] | None = None,
    require_full_content: bool = False,
    adjudicated: bool | None = None,
) -> list[str]:
    errors: list[str] = []
    if schema is not None:
        errors.extend(_jsonschema_errors(data, schema))
    sample_mode = is_chapter_sample(data) or data.get("result_type") == SAMPLE_RESULT_TYPE
    if sample_mode:
        errors.append("chapter-sample results are disabled; evaluate every source chapter in full-content mode")
    if require_full_content and source_inspection is None:
        errors.append("full-content validation requires a source package or source inspection inventory")
    if require_full_content and not expected_source_hash:
        errors.append("full-content validation requires the exact current source hash")
    if data.get("schema_version") != "2.0.0":
        errors.append("schema_version must be 2.0.0")
    if expected_source_hash and data.get("source_hash") != expected_source_hash:
        errors.append(f"source_hash mismatch: expected {expected_source_hash}, got {data.get('source_hash')}")
    expected_book = data.get("book") if isinstance(data.get("book"), Mapping) else {}
    if expected_book_id and expected_book.get("book_id") != expected_book_id:
        errors.append(f"book_id mismatch: expected {expected_book_id}, got {expected_book.get('book_id')}")
    if expected_job_id and data.get("job_id") != expected_job_id:
        errors.append(f"job_id mismatch: expected {expected_job_id}, got {data.get('job_id')}")
    if expected_run_id and data.get("run_id") != expected_run_id:
        errors.append(f"run_id mismatch: expected {expected_run_id}, got {data.get('run_id')}")
    if expected_role and data.get("rater_role") != expected_role:
        errors.append(f"rater_role mismatch: expected {expected_role}, got {data.get('rater_role')}")
    if adjudicated is None:
        adjudicated = "rater_agreement" in data or data.get("rater_role") == "adjudicated"
    role = data.get("rater_role")
    if not adjudicated and role not in {"primary", "verification"}:
        errors.append("rater_role must be primary or verification")
    if not adjudicated and require_full_content:
        if worker_dispatch_receipt is None or blind_pair_seal is None:
            errors.append("full-content blind validation requires a worker dispatch receipt and sealed blind-pair receipt")
        elif source_inspection is not None:
            errors.extend(
                validate_result_receipt_membership(
                    result=data,
                    dispatch=worker_dispatch_receipt,
                    pair_seal=blind_pair_seal,
                    inspection=source_inspection,
                )
            )

    book = data.get("book")
    if not isinstance(book, dict):
        errors.append("book must be an object")
        book = {}
    counts = {}
    for key in ("chapter_count_expected", "chapter_count_read_full", "chapter_count_partial", "chapter_count_inaccessible"):
        value = book.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            errors.append(f"book.{key} must be a non-negative integer")
            value = 0
        counts[key] = value
    if counts["chapter_count_read_full"] + counts["chapter_count_partial"] + counts["chapter_count_inaccessible"] != counts["chapter_count_expected"]:
        errors.append("chapter counts must sum to chapter_count_expected")
    expected_all_accessible = counts["chapter_count_read_full"] == counts["chapter_count_expected"] - counts["chapter_count_inaccessible"] and counts["chapter_count_partial"] == 0
    if book.get("all_accessible_chapters_read") is not expected_all_accessible:
        errors.append("all_accessible_chapters_read conflicts with chapter counts")

    chapter_evidence = data.get("chapter_evidence")
    if not isinstance(chapter_evidence, list):
        errors.append("chapter_evidence must be an array")
        chapter_evidence = []
    if len(chapter_evidence) != counts["chapter_count_expected"]:
        errors.append(f"chapter_evidence has {len(chapter_evidence)} records; expected {counts['chapter_count_expected']}")
    status_counts = {"full": 0, "partial": 0, "inaccessible": 0}
    for index, chapter in enumerate(chapter_evidence):
        if not isinstance(chapter, dict):
            errors.append(f"chapter_evidence[{index}] must be an object")
            continue
        status = chapter.get("read_status")
        if status not in status_counts:
            errors.append(f"chapter_evidence[{index}].read_status is invalid")
        else:
            status_counts[status] += 1
        if status != "inaccessible" and not chapter.get("evidence"):
            errors.append(f"chapter_evidence[{index}] lacks locator evidence")
    if status_counts["full"] != counts["chapter_count_read_full"] or status_counts["partial"] != counts["chapter_count_partial"] or status_counts["inaccessible"] != counts["chapter_count_inaccessible"]:
        errors.append("chapter_evidence read statuses conflict with book chapter counts")
    if source_inspection is not None:
        inventory = source_inspection.get("chapter_inventory")
        source_book_id = source_inspection.get("book_id")
        if not isinstance(inventory, list):
            errors.append("source inspection chapter_inventory must be an array")
            inventory = []
        source_count = source_inspection.get("chapter_count")
        if require_full_content and source_inspection.get("inventory_complete") is not True:
            inventory_errors = source_inspection.get("inventory_errors")
            detail = "; ".join(str(item) for item in inventory_errors) if isinstance(inventory_errors, list) else "missing completeness proof"
            errors.append(f"source inspection inventory is incomplete or unscoreable: {detail}")
        if not isinstance(source_count, int) or isinstance(source_count, bool) or source_count < 0:
            errors.append("source inspection chapter_count must be a non-negative integer")
        elif source_count != len(inventory):
            errors.append(
                f"source inspection chapter_count conflicts with inventory: declared {source_count}, found {len(inventory)}"
            )
        if source_book_id and book.get("book_id") != source_book_id:
            errors.append(f"book.book_id does not match source inspection: expected {source_book_id}, got {book.get('book_id')}")
        if counts["chapter_count_expected"] != len(inventory):
            errors.append(
                f"book.chapter_count_expected does not match source inventory: expected {len(inventory)}, got {counts['chapter_count_expected']}"
            )
        if len(chapter_evidence) != len(inventory):
            errors.append(f"chapter_evidence does not cover the full source inventory: expected {len(inventory)}, got {len(chapter_evidence)}")
        for index, source_chapter in enumerate(inventory):
            if index >= len(chapter_evidence) or not isinstance(source_chapter, Mapping):
                continue
            result_chapter = chapter_evidence[index]
            if not isinstance(result_chapter, Mapping):
                continue
            expected_index = source_chapter.get("chapter_index")
            expected_id = source_chapter.get("chapter_id")
            expected_title = str(source_chapter.get("title") or "")
            if result_chapter.get("chapter_index") != expected_index:
                errors.append(
                    f"chapter_evidence[{index}].chapter_index does not match source inventory: expected {expected_index}, got {result_chapter.get('chapter_index')}"
                )
            if expected_id not in (None, "") and str(result_chapter.get("chapter_id") or "") != str(expected_id):
                errors.append(f"chapter_evidence[{index}].chapter_id does not match source inventory")
            if str(result_chapter.get("title") or "") != expected_title:
                errors.append(f"chapter_evidence[{index}].title does not match source inventory")
        if require_full_content:
            if counts["chapter_count_read_full"] != len(inventory):
                errors.append("every source chapter must be read in full")
            if counts["chapter_count_partial"] != 0 or counts["chapter_count_inaccessible"] != 0:
                errors.append("full-content evaluation cannot contain partial or inaccessible chapter reads")
            if book.get("all_accessible_chapters_read") is not True:
                errors.append("book.all_accessible_chapters_read must be true in full-content mode")
    if sample_mode:
        errors.extend(
            _sample_scope_errors(
                data,
                expected_evaluation_scope=expected_evaluation_scope,
            )
        )
        if sample_package is not None:
            if not SHA256_PATTERN.fullmatch(str(sample_package_sha256 or "")):
                errors.append("sample_package_sha256 is required with sample_package")
            else:
                errors.extend(
                    _sample_package_errors(
                        data,
                        sample_package,
                        sampled_package_sha256=str(sample_package_sha256),
                    )
                )

    gates = data.get("gates")
    if not isinstance(gates, dict):
        errors.append("gates must be an object")
        gates = {}
    if set(gates) != set(GATE_KEYS):
        errors.append(f"gates must contain exactly: {', '.join(GATE_KEYS)}")
    for gate_key in GATE_KEYS:
        gate = gates.get(gate_key)
        if not isinstance(gate, dict):
            errors.append(f"gates.{gate_key} must be an object")
            continue
        if gate.get("status") not in GATE_STATUSES:
            errors.append(f"gates.{gate_key}.status is invalid")
        if not str(gate.get("rationale") or "").strip():
            errors.append(f"gates.{gate_key}.rationale is required")
    if isinstance(gates.get("external_accuracy"), dict) and gates["external_accuracy"].get("status") != "not_assessed":
        errors.append("external_accuracy must be not_assessed in isolated mode")
    if sample_mode:
        sample_gate_statuses = {
            "technical_completeness": {"conditional", "fail", "unevaluable", "not_assessed"},
            "epistemic_instructional_safety": {"fail", "not_assessed"},
            "ethics_reader_autonomy": {"fail", "not_assessed"},
            "purpose_audience_declaration": {"not_assessed"},
            "external_accuracy": {"not_assessed"},
        }
        for gate_key, allowed in sample_gate_statuses.items():
            gate = gates.get(gate_key)
            if isinstance(gate, Mapping) and gate.get("status") not in allowed:
                errors.append(
                    f"gates.{gate_key}.status must be one of {', '.join(sorted(allowed))} in chapter-sample mode"
                )
            if isinstance(gate, Mapping) and gate.get("status") == "fail" and not gate.get("evidence"):
                errors.append(f"gates.{gate_key} observed fail requires selected-chapter evidence")
        if not sample_selected_content_sufficient(data):
            technical_status = (gates.get("technical_completeness") or {}).get("status")
            if technical_status not in {"fail", "unevaluable"}:
                errors.append(
                    "gates.technical_completeness must be fail or unevaluable when selected content is insufficient"
                )

    domains = data.get("domains")
    if not isinstance(domains, dict):
        errors.append("domains must be an object")
        domains = {}
    if set(domains) != set(DOMAINS):
        errors.append("domains must contain exactly the nine rubric domains")
    rating_count = 0
    for domain_key, definition in DOMAINS.items():
        domain = domains.get(domain_key)
        if not isinstance(domain, dict):
            errors.append(f"domains.{domain_key} is missing")
            continue
        if domain.get("weight") != definition["weight"]:
            errors.append(f"domains.{domain_key}.weight must be {definition['weight']}")
        if not str(domain.get("whole_book_pattern") or "").strip():
            errors.append(f"domains.{domain_key}.whole_book_pattern is required")
        elif sample_mode and not str(domain.get("whole_book_pattern")).startswith("Sample-wide pattern:"):
            errors.append(f"domains.{domain_key}.whole_book_pattern must begin with 'Sample-wide pattern:'")
        subcriteria = domain.get("subcriteria")
        if not isinstance(subcriteria, dict):
            errors.append(f"domains.{domain_key}.subcriteria must be an object")
            continue
        if set(subcriteria) != set(definition["subcriteria"]):
            errors.append(f"domains.{domain_key}.subcriteria must contain exactly four defined keys")
        strength_count = 0
        limitation_count = 0
        for subcriterion_key in definition["subcriteria"]:
            item = subcriteria.get(subcriterion_key)
            if not isinstance(item, dict):
                errors.append(f"domains.{domain_key}.subcriteria.{subcriterion_key} is missing")
                continue
            rating = item.get("rating")
            if not isinstance(rating, (int, float)) or isinstance(rating, bool) or float(rating) < 0 or float(rating) > 4:
                errors.append(f"{domain_key}.{subcriterion_key}.rating must be between 0 and 4")
            elif adjudicated:
                if float(rating) * 2 != int(float(rating) * 2):
                    errors.append(f"{domain_key}.{subcriterion_key}.rating must use 0.5 increments")
            elif not isinstance(rating, int) or isinstance(rating, bool):
                errors.append(f"{domain_key}.{subcriterion_key}.rating must be an integer for blind raters")
            else:
                rating_count += 1
            if not str(item.get("rationale") or "").strip():
                errors.append(f"{domain_key}.{subcriterion_key}.rationale is required")
            strengths = item.get("strength_evidence")
            limitations = item.get("limitation_evidence")
            if isinstance(strengths, list):
                strength_count += len(strengths)
            else:
                errors.append(f"{domain_key}.{subcriterion_key}.strength_evidence must be an array")
            if isinstance(limitations, list):
                limitation_count += len(limitations)
            else:
                errors.append(f"{domain_key}.{subcriterion_key}.limitation_evidence must be an array")
        if strength_count < 2:
            errors.append(f"domains.{domain_key} needs at least two chapter-level strengths")
        if limitation_count < 1:
            errors.append(f"domains.{domain_key} needs at least one chapter-level limitation")
    if not adjudicated and rating_count != 36:
        errors.append(f"expected 36 integer ratings, found {rating_count}")

    try:
        recalculated = copy.deepcopy(dict(data))
        calculated = calculate_scores(recalculated)
        for domain_key in DOMAINS:
            source_domain = domains.get(domain_key, {}) if isinstance(domains, dict) else {}
            if not _numeric_close(source_domain.get("domain_score"), recalculated["domains"][domain_key]["domain_score"]):
                errors.append(f"domains.{domain_key}.domain_score arithmetic mismatch")
            if not _numeric_close(source_domain.get("weighted_points"), recalculated["domains"][domain_key]["weighted_points"]):
                errors.append(f"domains.{domain_key}.weighted_points arithmetic mismatch")
        if not _numeric_close(data.get("overall_score"), calculated["overall_score"]):
            errors.append("overall_score arithmetic mismatch")
        expected_classification = recalculated["classification"]
        if data.get("classification") != expected_classification:
            errors.append(f"classification mismatch: expected {expected_classification!r}")
        expected_certification = (
            derive_sample_certification(
                gates,
                selected_content_sufficient=sample_selected_content_sufficient(data),
            )
            if sample_mode
            else derive_certification(gates)
        )
        if data.get("certification_status") != expected_certification:
            errors.append(f"certification_status mismatch: expected {expected_certification}")
    except (EvaluationError, KeyError, TypeError, ValueError) as exc:
        errors.append(f"score calculation failed: {exc}")

    allowed_certifications = SAMPLE_CERTIFICATION_STATUSES if sample_mode else CERTIFICATION_STATUSES
    if data.get("certification_status") not in allowed_certifications:
        errors.append("certification_status is invalid")
    analysis = data.get("analysis")
    if not isinstance(analysis, dict):
        errors.append("analysis must be an object")
    else:
        improvements = analysis.get("highest_impact_improvements")
        if not isinstance(improvements, list) or len(improvements) != 3:
            errors.append("analysis.highest_impact_improvements must contain exactly three items")
        if sample_mode:
            scope = data.get("evaluation_scope") if isinstance(data.get("evaluation_scope"), Mapping) else {}
            selected_count = scope.get("selected_chapter_count")
            expected_prefix = _sample_verdict_prefix(selected_count if isinstance(selected_count, int) else 0)
            verdict = str(analysis.get("final_verdict") or "")
            if not verdict.startswith(expected_prefix):
                errors.append(f"analysis.final_verdict must begin with {expected_prefix!r}")
    qa = data.get("qa")
    if not isinstance(qa, dict):
        errors.append("qa must be an object")
    else:
        for key in ("all_36_subcriteria_present", "evidence_minimums_pass", "calculation_check_pass"):
            if qa.get(key) is not True:
                errors.append(f"qa.{key} must be true")
        if qa.get("unsupported_outcome_claims_found") is not False:
            errors.append("qa.unsupported_outcome_claims_found must be false")

    prohibited_patterns = [
        re.compile(r"\b(?:readers?|participants?)\s+(?:will|did)\s+(?:retain|remember|change|improve|complete|apply)\b", re.IGNORECASE),
        re.compile(r"\b(?:measured|proved|demonstrated)\s+(?:actual\s+)?(?:retention|behavior change|satisfaction|completion)\b", re.IGNORECASE),
        re.compile(r"\bexternally\s+(?:verified|fact[- ]checked)\b", re.IGNORECASE),
    ]
    for path, text in _all_strings(data.get("analysis", {})) + _all_strings(data.get("domains", {})):
        if any(pattern.search(text) for pattern in prohibited_patterns):
            errors.append(f"unsupported outcome or external-verification claim at {path}")
    if sample_mode:
        narrative = {
            "analysis": data.get("analysis", {}),
            "domains": data.get("domains", {}),
            "gates": data.get("gates", {}),
            "technical_findings": data.get("technical_findings", []),
        }
        for path in _unqualified_full_book_claims(narrative):
            errors.append(f"unqualified full-book claim in chapter-sample result at {path}")
    return sorted(set(errors))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", type=Path, help="JSON Schema; focused validation still runs without it")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--expected-source-hash")
    parser.add_argument("--expected-book-id")
    parser.add_argument("--expected-job-id")
    parser.add_argument("--expected-run-id")
    parser.add_argument("--expected-role", choices=("primary", "verification", "adjudicated"))
    parser.add_argument("--source-package", type=Path, help="Canonical source package used to prove exact all-chapter coverage")
    parser.add_argument("--inspection", type=Path, help="Previously generated inspect_package.py JSON")
    parser.add_argument("--worker-dispatch-receipt", type=Path, help="Orchestrator-issued receipt for this exact blind worker")
    parser.add_argument("--blind-pair-seal", type=Path, help="Orchestrator-sealed pair receipt containing this exact result")
    parser.add_argument("--require-full-content", action="store_true", help="Require every exact source-inventory chapter to be read fully")
    parser.add_argument("--temp-root", type=Path, default=Path(".chapterflow-evaluation-validation-tmp"))
    parser.add_argument("--adjudicated", action="store_true", help="Allow adjudicated half-point ratings")
    parser.add_argument("--json", action="store_true", dest="json_output", help="Print a machine-readable result")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        data = read_json(args.input)
        schema = read_json(args.schema) if args.schema else None
        if args.source_package and args.inspection:
            raise EvaluationError("use only one of --source-package or --inspection")
        source_inspection = None
        expected_source_hash = args.expected_source_hash
        if args.source_package:
            source_inspection = inspect_package(args.source_package, args.temp_root)
            expected_source_hash = expected_source_hash or source_hash(args.source_package)
        elif args.inspection:
            inspection_record = read_json(args.inspection)
            if not isinstance(inspection_record, Mapping):
                raise EvaluationError("inspection JSON must be an object")
            supplied_inspection = inspection_record.get("inspection") if isinstance(inspection_record.get("inspection"), Mapping) else inspection_record
            if args.require_full_content:
                package_path = inspection_record.get("package_path")
                recorded_hash = inspection_record.get("source_hash")
                if not isinstance(package_path, str) or not package_path.strip() or not isinstance(recorded_hash, str):
                    raise EvaluationError(
                        "full-content --inspection must be an inspect_package.py artifact with package_path and source_hash"
                    )
                package = Path(package_path).resolve()
                actual_hash = source_hash(package)
                if actual_hash != recorded_hash:
                    raise EvaluationError("inspection source package hash has drifted")
                actual_inspection = inspect_package(package, args.temp_root)
                if not json_equivalent(supplied_inspection, actual_inspection):
                    raise EvaluationError("inspection inventory does not match an independent inspection of its source package")
                source_inspection = actual_inspection
                expected_source_hash = expected_source_hash or actual_hash
            else:
                source_inspection = supplied_inspection
                if isinstance(inspection_record.get("source_hash"), str):
                    expected_source_hash = expected_source_hash or inspection_record["source_hash"]
        errors = validate_result(
            data,
            schema=schema,
            expected_source_hash=expected_source_hash,
            expected_book_id=args.expected_book_id,
            expected_job_id=args.expected_job_id,
            expected_run_id=args.expected_run_id,
            expected_role=args.expected_role,
            source_inspection=source_inspection,
            worker_dispatch_receipt=read_json(args.worker_dispatch_receipt) if args.worker_dispatch_receipt else None,
            blind_pair_seal=read_json(args.blind_pair_seal) if args.blind_pair_seal else None,
            require_full_content=args.require_full_content,
            adjudicated=True if args.adjudicated else None,
        )
    except (OSError, json.JSONDecodeError, EvaluationError) as exc:
        errors = [f"could not load input or schema: {exc}"]
    result = {"valid": not errors, "input": str(args.input), "error_count": len(errors), "errors": errors}
    if args.json_output:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif errors:
        print("INVALID")
        for error in errors:
            print(f"- {error}")
    else:
        print("VALID")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
