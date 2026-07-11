#!/usr/bin/env python3
"""Fail-closed acceptance check for a repaired, reevaluated ChapterFlow book."""

from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import importlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from repair_common import (
    RepairError,
    atomic_write_json,
    canonical_json_sha256,
    exact_book,
    history_entry_sha256,
    mapping,
    read_json,
    report_data,
    script_json_from_html,
    resolve_local_path,
    sequence,
    sha256_file,
    validate_history_chain,
    validate_json_schema,
)


DOMAIN_WEIGHTS = (15, 12, 15, 12, 10, 15, 8, 8, 5)
DOWNLOAD_EXPORTS = (
    "ChapterFlow_140_Scorecard.csv",
    "ChapterFlow_140_Diagnostics.csv",
    "ChapterFlow_140_Weighted_Points.csv",
    "ChapterFlow_140_Subcriterion_Audit.csv",
    "ChapterFlow_140_Chapter_Evidence.csv",
    "ChapterFlow_140_QA_Findings.csv",
    "ChapterFlow_140_Summary.md",
    "ChapterFlow_140_Evaluation_Report.html",
)
V2_EXCLUDE_DEEP = {
    "authoring", "sourceAnchorId", "sourceAnchorIds", "keyEvidenceAnchorIds", "titleSourceAnchorIds",
    "coreSkillSourceAnchorIds", "twentyFourHourChallengeSourceAnchorIds", "weeklyPracticeSourceAnchorIds",
    "hookSourceAnchorIds", "counterintuitionSourceAnchorIds", "keyTakeawaySourceAnchorIds", "tryThisNowSourceAnchorIds",
    "planSpec", "exampleId", "questionId", "cardId",
}
V2_EXCLUDE_TOP = {"chapterId", "number"}
READER_INTERNAL_DEEP = V2_EXCLUDE_DEEP | {"namedCaseIds", "sourceFactIds", "depthLevel"}
MACHINERY_MULTIWORD = (
    "return point", "return moment", "early signal", "late catch", "caught late",
    "first sign nobody", "set but not yet met",
)
MACHINERY_WHOLE = {"reckoning"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _number(value: Any, label: str, errors: list[str]) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        errors.append(f"{label} must be numeric")
        return None
    return float(value)


def _pass(value: Any) -> bool:
    return str(value or "").strip().replace("_", " ").casefold() == "pass"


def _condition_percent(condition: Mapping[str, Any], book: Mapping[str, Any], errors: list[str]) -> float | None:
    condition_id = str(condition.get("id") or "")
    scope = str(condition.get("scope") or "")
    if scope == "overall":
        if condition_id != "O-001":
            errors.append(f"unsupported overall condition id {condition_id!r}")
            return None
        return _number(book.get("score"), "book.score", errors)

    domains = list(mapping(book.get("domains")).items())
    if scope == "domain":
        match = re.fullmatch(r"D-(\d{2})", condition_id)
        if not match:
            errors.append(f"invalid domain condition id {condition_id!r}")
            return None
        domain_index = int(match.group(1))
        if domain_index < 1 or domain_index > len(domains):
            errors.append(f"domain condition {condition_id} is outside the updated domain inventory")
            return None
        label, rating = domains[domain_index - 1]
        if str(condition.get("label") or "") != str(label):
            errors.append(f"condition {condition_id} label does not match updated domain {label!r}")
        value = _number(rating, f"domain {label}", errors)
        return value * 25 if value is not None else None

    if scope == "subcriterion":
        match = re.fullmatch(r"S-(\d{2})-(\d{2})", condition_id)
        if not match:
            errors.append(f"invalid subcriterion condition id {condition_id!r}")
            return None
        domain_index, sub_index = (int(match.group(1)), int(match.group(2)))
        if domain_index < 1 or domain_index > len(domains):
            errors.append(f"subcriterion {condition_id} is outside the updated domain inventory")
            return None
        domain_label = str(domains[domain_index - 1][0])
        rows = [
            item for item in sequence(book.get("subcriteria"))
            if isinstance(item, Mapping) and str(item.get("domain") or "") == domain_label
        ]
        if sub_index < 1 or sub_index > len(rows):
            errors.append(f"subcriterion {condition_id} is outside updated domain {domain_label!r}")
            return None
        row = rows[sub_index - 1]
        if str(condition.get("label") or "") != str(row.get("subcriterion") or ""):
            errors.append(f"condition {condition_id} label does not match updated subcriterion")
        rating = _number(row.get("rating"), f"subcriterion {condition_id} rating", errors)
        return rating * 25 if rating is not None else None

    errors.append(f"condition {condition_id!r} has unsupported scope {scope!r}")
    return None


def _canonical_condition(
    condition_id: str,
    adjudication: Mapping[str, Any],
) -> tuple[str | None, float | None, list[Mapping[str, Any]]]:
    domains = list(mapping(adjudication.get("domains")).items())
    if condition_id == "O-001":
        evidence = []
        for domain in mapping(adjudication.get("domains")).values():
            for item in mapping(mapping(domain).get("subcriteria")).values():
                evidence.extend(mapping(entry) for entry in sequence(mapping(item).get("strength_evidence")) + sequence(mapping(item).get("limitation_evidence")) if isinstance(entry, Mapping))
        score = adjudication.get("overall_score")
        return "overall_score", float(score) if isinstance(score, (int, float)) and not isinstance(score, bool) else None, evidence
    domain_match = re.fullmatch(r"D-(\d{2})", condition_id)
    sub_match = re.fullmatch(r"S-(\d{2})-(\d{2})", condition_id)
    domain_index = int((domain_match or sub_match).group(1)) if domain_match or sub_match else 0
    if domain_index < 1 or domain_index > len(domains):
        return None, None, []
    domain_key, domain = domains[domain_index - 1]
    domain = mapping(domain)
    if domain_match:
        evidence = []
        for item in mapping(domain.get("subcriteria")).values():
            evidence.extend(mapping(entry) for entry in sequence(mapping(item).get("strength_evidence")) + sequence(mapping(item).get("limitation_evidence")) if isinstance(entry, Mapping))
        score = domain.get("domain_score")
        return f"domains.{domain_key}.domain_score", float(score) * 25 if isinstance(score, (int, float)) and not isinstance(score, bool) else None, evidence
    sub_index = int(sub_match.group(2))
    subcriteria = list(mapping(domain.get("subcriteria")).items())
    if sub_index < 1 or sub_index > len(subcriteria):
        return None, None, []
    sub_key, item = subcriteria[sub_index - 1]
    item = mapping(item)
    evidence = [mapping(entry) for entry in sequence(item.get("strength_evidence")) + sequence(item.get("limitation_evidence")) if isinstance(entry, Mapping)]
    rating = item.get("rating")
    return f"domains.{domain_key}.subcriteria.{sub_key}.rating", float(rating) * 25 if isinstance(rating, (int, float)) and not isinstance(rating, bool) else None, evidence


def _all_below_80(book: Mapping[str, Any], errors: list[str]) -> set[str]:
    below: set[str] = set()
    score = _number(book.get("score"), "book.score", errors)
    if score is not None and score < 80:
        below.add("O-001")
    domains = list(mapping(book.get("domains")).items())
    if len(domains) != 9:
        errors.append(f"updated book must contain 9 ordered domains; found {len(domains)}")
    subcriteria = sequence(book.get("subcriteria"))
    if len(subcriteria) != 36:
        errors.append(f"updated book must contain 36 subcriteria; found {len(subcriteria)}")
    for domain_index, (label, raw_rating) in enumerate(domains, 1):
        rating = _number(raw_rating, f"domain {label}", errors)
        if rating is not None and rating * 25 < 80:
            below.add(f"D-{domain_index:02d}")
        rows = [
            item for item in subcriteria
            if isinstance(item, Mapping) and str(item.get("domain") or "") == str(label)
        ]
        if len(rows) != 4:
            errors.append(f"domain {label!r} must contain 4 ordered subcriteria; found {len(rows)}")
        for sub_index, row in enumerate(rows, 1):
            rating = _number(row.get("rating"), f"subcriterion {domain_index}-{sub_index}", errors)
            if rating is not None and rating * 25 < 80:
                below.add(f"S-{domain_index:02d}-{sub_index:02d}")
    return below


def _evidence_is_specific(value: Any) -> bool:
    if not isinstance(value, Mapping):
        return False
    locator = str(value.get("locator") or "").strip()
    finding = str(value.get("finding") or value.get("result") or "").strip()
    return bool(locator and finding)


def _report_companion(html_path: Path) -> Path:
    return html_path.with_name(html_path.stem + "-data.json")


def _report_artifact_names(html_path: Path) -> list[str]:
    suffix = "-evaluation-report.html"
    if not html_path.name.endswith(suffix):
        raise RepairError(f"report HTML filename must end with {suffix!r}")
    prefix = html_path.name[: -len(suffix)]
    return [
        html_path.name,
        f"{prefix}-evaluation-report-data.json",
        f"{prefix}-remediation-prompts.json",
        f"{prefix}-remediation-prompts.md",
    ]


def _validate_evidence_matrix(
    context: Mapping[str, Any],
    fresh_qc: Mapping[str, Any],
    package: Mapping[str, Any],
    book_id: str,
    state: Mapping[str, Any],
    errors: list[str],
) -> None:
    round_id = str(fresh_qc.get("round_id") or "")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", round_id):
        errors.append("fresh QC round_id is unsafe or empty")
        return
    pipeline_root = resolve_local_path(str(mapping(context.get("pipeline")).get("working_directory") or ""))
    canonical = (pipeline_root / "state/qc-orchestrator" / book_id / round_id / "evidence-matrix.json").resolve()
    declared_raw = str(fresh_qc.get("evidence_matrix_path") or "")
    if not declared_raw or resolve_local_path(declared_raw) != canonical:
        errors.append("fresh QC evidence matrix is not at the canonical v24 path")
        return
    if not canonical.is_file():
        errors.append(f"fresh QC evidence matrix is missing: {canonical}")
        return
    if sha256_file(canonical) != str(fresh_qc.get("evidence_matrix_sha256") or ""):
        errors.append("fresh QC evidence matrix hash differs from repair verification")
    qc_entries = [mapping(item) for item in sequence(state.get("history")) if mapping(item).get("phase") == "fresh_qc_passed"]
    if len(qc_entries) != 1:
        errors.append("state history must contain exactly one fresh_qc_passed entry")
    else:
        qc_entry = qc_entries[0]
        if mapping(qc_entry.get("evidence")).get("round_id") != round_id:
            errors.append("fresh QC round differs from the sealed state-history round")
        matrix_artifacts = [mapping(item) for item in sequence(qc_entry.get("artifacts")) if mapping(item).get("label") == "evidence_matrix"]
        if len(matrix_artifacts) != 1:
            errors.append("fresh_qc_passed state history does not bind exactly one evidence matrix")
        else:
            artifact = matrix_artifacts[0]
            if resolve_local_path(str(artifact.get("path") or "")) != canonical or artifact.get("sha256") != sha256_file(canonical):
                errors.append("fresh_qc_passed state artifact is not bound to the canonical current evidence matrix")
    matrix = read_json(canonical)
    if not isinstance(matrix, Mapping):
        errors.append("fresh QC evidence matrix must be a JSON object")
        return
    if matrix.get("schemaVersion") != "qc-evidence-matrix-v1":
        errors.append("fresh QC evidence matrix schemaVersion is invalid")
    if matrix.get("bookId") != book_id or matrix.get("roundId") != round_id:
        errors.append("fresh QC evidence matrix book/round does not match this repair")
    if matrix.get("errors") != []:
        errors.append("fresh QC evidence matrix contains finalizer errors")
    decisions = sequence(matrix.get("chapters"))
    candidate_chapters = sequence(package.get("chapters"))
    index_path = (pipeline_root / "state/indexes" / f"{book_id}.json").resolve()
    if not index_path.is_file():
        errors.append(f"canonical loose-state chapter index is missing: {index_path}")
        return
    index_rows = read_json(index_path)
    if not isinstance(index_rows, list) or any(not isinstance(item, Mapping) for item in index_rows):
        errors.append("canonical loose-state chapter index is malformed")
        return
    candidate_inventory = [
        (
            str(mapping(chapter).get("chapterId") or ""),
            mapping(chapter).get("number", index),
            str(mapping(chapter).get("title") or ""),
        )
        for index, chapter in enumerate(candidate_chapters, 1)
    ]
    index_inventory = [
        (str(mapping(row).get("chapterId") or ""), mapping(row).get("chapterNumber"), str(mapping(row).get("chapterTitle") or ""))
        for row in index_rows
    ]
    if not candidate_inventory or any(not row[0] for row in candidate_inventory) or candidate_inventory != index_inventory:
        errors.append("nested candidate inventory differs from the exact canonical loose-state index")
        return
    loose_chapters: list[Mapping[str, Any]] = []
    for chapter_id, _, _ in index_inventory:
        loose_path = (pipeline_root / "state/chapters" / f"{chapter_id}.v21-native.chapter.json").resolve()
        if not loose_path.is_file():
            errors.append(f"canonical loose state chapter is missing: {loose_path}")
            continue
        loose = read_json(loose_path)
        if not isinstance(loose, Mapping):
            errors.append(f"canonical loose state chapter is malformed: {loose_path}")
            continue
        loose_chapters.append(loose)
    if len(loose_chapters) != len(candidate_chapters):
        return
    for index, (loose, candidate) in enumerate(zip(loose_chapters, candidate_chapters), 1):
        projected = _strip_reader_content_v3(loose)
        if projected != dict(mapping(candidate)):
            errors.append(f"nested candidate chapter {index} is not the faithful reader-content strip of canonical loose state")
    expected_numbers = [mapping(item).get("number", index) for index, item in enumerate(candidate_chapters, 1)]
    actual_numbers = [mapping(item).get("chapterNumber") for item in decisions]
    if len(decisions) != len(candidate_chapters) or len(set(actual_numbers)) != len(actual_numbers) or sorted(actual_numbers) != sorted(expected_numbers):
        errors.append("fresh QC evidence matrix does not cover every candidate chapter exactly once")
    loose_by_number = {mapping(item).get("number", index): mapping(item) for index, item in enumerate(loose_chapters, 1)}
    expected_checks = {
        "sourceV2": "PASS", "shipGate": "PASS", "authorCheck": "PASS", "intraBook": "PASS",
        "bookGate": "PASS", "sweep": "PASS", "manualKeyJudge": "PASS", "barRead": "GREEN",
        "confirmRead": "PUBLISHABLE", "repairLedger": "NO_OPEN_BLOCKERS", "majors": "PASS", "planEnforcement": "PASS",
    }
    for decision in decisions:
        decision = mapping(decision)
        number = decision.get("chapterNumber")
        if decision.get("finalVerdict") != "PUBLISHABLE":
            errors.append(f"fresh QC evidence matrix chapter {number} is not PUBLISHABLE")
        chapter = loose_by_number.get(number)
        if chapter is not None and decision.get("contentHash") != _chapter_content_hash_v2(chapter):
            errors.append(f"fresh QC evidence matrix chapter {number} contentHash is stale against canonical loose state")
        checks = mapping(decision.get("checks"))
        for key, expected in expected_checks.items():
            if checks.get(key) != expected:
                errors.append(f"fresh QC evidence matrix chapter {number} check {key} is not {expected}")
        if "craftRead" in checks and checks.get("craftRead") not in {"GREEN", "NOT_APPLICABLE"}:
            errors.append(f"fresh QC evidence matrix chapter {number} craftRead is not clean")
        if any(str(value) in {"CORRUPTION", "RED", "FAIL", "REVISE"} for value in checks.values()):
            errors.append(f"fresh QC evidence matrix chapter {number} contains a corruption/failure veto")


def _chapter_content_hash_v2(chapter: Mapping[str, Any]) -> str:
    def strip(value: Any, *, top: bool = False) -> Any:
        if isinstance(value, list):
            return [strip(item) for item in value]
        if isinstance(value, Mapping):
            result = {}
            for key in sorted(value):
                if key in V2_EXCLUDE_DEEP or (top and key in V2_EXCLUDE_TOP):
                    continue
                result[key] = strip(value[key])
            return result
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return value
    payload = json.dumps(strip(chapter, top=True), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _strip_reader_content_v3(chapter: Mapping[str, Any]) -> dict[str, Any]:
    """Faithful Python mirror of v24 readerContent.stripInternalFields v3.

    The run seal freezes readerContent.ts and machineryPhrases.ts; any live rule
    edit invalidates the run before this projection is trusted.
    """
    def deep(value: Any) -> Any:
        if isinstance(value, list):
            return [deep(item) for item in value]
        if isinstance(value, Mapping):
            result: dict[str, Any] = {}
            for key, child in value.items():
                if key in READER_INTERNAL_DEEP or re.search(r"SourceAnchorIds?$", key):
                    continue
                result[key] = deep(child)
            return result
        return value

    result = deep(chapter)
    result.pop("schemaVersion", None)
    plan = result.get("implementationPlan")
    if isinstance(plan, Mapping):
        result["implementationPlan"] = {key: value for key, value in plan.items() if key != "title"}
    lines = result.get("memorableLines")
    if isinstance(lines, list):
        result["memorableLines"] = [
            {key: value for key, value in item.items() if key not in {"location", "why"}} if isinstance(item, Mapping) else item
            for item in lines
        ]
    examples = result.get("examples")
    if isinstance(examples, list):
        next_examples = []
        for raw in examples:
            if not isinstance(raw, Mapping) or not isinstance(raw.get("tags"), list):
                next_examples.append(raw)
                continue
            item = dict(raw)
            tags = []
            for tag in raw["tags"]:
                if not isinstance(tag, str):
                    tags.append(tag)
                    continue
                folded = tag.strip().casefold()
                multi_hit = any(re.search(rf"\b{re.escape(surface)}\b", tag, re.IGNORECASE) for surface in MACHINERY_MULTIWORD)
                if not multi_hit and folded not in MACHINERY_WHOLE:
                    tags.append(tag)
            item["tags"] = tags
            next_examples.append(item)
        result["examples"] = next_examples
    return result


def _non_target_stable(value: Mapping[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(dict(value))
    result.pop("rank", None)
    result.pop("remediation", None)
    return result


def _validate_portfolio_receipt(
    context: Mapping[str, Any],
    current_report: Mapping[str, Any],
    report_path: Path,
    report_mirror: Mapping[str, Any],
    book_id: str,
    package_hash: str,
    errors: list[str],
) -> dict[str, Any]:
    binding: dict[str, Any] = {"receipt_path": "", "receipt_sha256": "", "transaction_id": "", "roots": []}
    books = [item for item in sequence(current_report.get("books")) if isinstance(item, Mapping)]
    ids = [str(item.get("id") or item.get("book_id") or "") for item in books]
    if len(books) != 140 or len(set(ids)) != 140 or any(not item for item in ids):
        errors.append("updated portfolio does not contain exactly 140 uniquely identified books")
    report_context = mapping(context.get("report"))
    baseline_path = resolve_local_path(str(report_context.get("baseline_data_path") or ""))
    if not baseline_path.is_file() or sha256_file(baseline_path) != str(report_context.get("baseline_data_sha256") or ""):
        errors.append("frozen baseline report-data artifact is missing or changed")
        baseline = {}
    else:
        baseline = read_json(baseline_path)
    if isinstance(baseline, Mapping):
        baseline_books = {
            str(item.get("id") or item.get("book_id") or ""): item
            for item in sequence(baseline.get("books")) if isinstance(item, Mapping)
        }
        current_books = {identifier: item for identifier, item in zip(ids, books)}
        if len(baseline_books) != 140:
            errors.append("frozen baseline portfolio does not contain 140 unique books")
        for identifier, old in baseline_books.items():
            if identifier == book_id:
                continue
            new = current_books.get(identifier)
            if new is None or _non_target_stable(new) != _non_target_stable(old):
                errors.append(f"non-target portfolio book changed outside rank/remediation: {identifier}")
                break
    receipt_raw = str(report_mirror.get("updater_receipt_path") or "")
    receipt_path = resolve_local_path(receipt_raw) if receipt_raw else Path("/__missing_updater_receipt__")
    if not receipt_path.is_file():
        errors.append("transactional portfolio updater receipt is missing")
        return binding
    binding["receipt_path"] = str(receipt_path)
    binding["receipt_sha256"] = sha256_file(receipt_path)
    if sha256_file(receipt_path) != str(report_mirror.get("updater_receipt_sha256") or ""):
        errors.append("transactional portfolio updater receipt hash mismatch")
    receipt = read_json(receipt_path)
    if not isinstance(receipt, Mapping):
        errors.append("transactional portfolio updater receipt must be a JSON object")
        return binding
    schema = read_json(Path(__file__).resolve().parents[1] / "references/portfolio-update-receipt.schema.json")
    if not isinstance(schema, Mapping):
        raise RepairError("bundled portfolio update receipt schema is malformed")
    errors.extend(f"portfolio updater receipt: {item}" for item in validate_json_schema(receipt, schema))
    if receipt.get("book_id") != book_id or receipt.get("source_hash") != package_hash:
        errors.append("portfolio updater receipt is not bound to this book/candidate hash")
    if receipt.get("baseline_report_data_sha256") != report_context.get("baseline_data_sha256"):
        errors.append("portfolio updater receipt is not bound to the frozen baseline report")
    transaction_id = str(receipt.get("transaction_id") or "")
    binding["transaction_id"] = transaction_id
    repository_root = resolve_local_path(str(mapping(context.get("repository")).get("root") or ""))
    mirror_root = (repository_root / "docs/v25/chapterflow-140-evaluation").resolve()
    expected_roots = {"primary": report_path.parent.resolve(), "mirror": mirror_root}
    roots = sequence(receipt.get("roots"))
    roots_by_kind: dict[str, Mapping[str, Any]] = {}
    for raw_root in roots:
        root = mapping(raw_root)
        kind = str(root.get("kind") or "")
        if kind in roots_by_kind:
            errors.append(f"portfolio updater receipt repeats {kind!r} root")
        roots_by_kind[kind] = root
    if set(roots_by_kind) != set(expected_roots) or len(roots) != 2:
        errors.append("portfolio updater receipt must contain exactly one primary and the canonical repo mirror root")
    names = _report_artifact_names(report_path)
    normalized_roots: list[dict[str, Any]] = []
    for kind, expected_root in expected_roots.items():
        root = roots_by_kind.get(kind, {})
        if resolve_local_path(str(root.get("root") or "")) != expected_root:
            errors.append(f"portfolio updater receipt {kind} root path is not canonical")
        rows = sequence(root.get("outputs"))
        by_name = {str(mapping(item).get("name") or ""): mapping(item) for item in rows}
        if len(rows) != 4 or set(by_name) != set(names):
            errors.append(f"portfolio updater receipt {kind} output inventory is not exact")
        normalized_outputs = []
        for name in names:
            expected_path = (expected_root / name).resolve()
            row = by_name.get(name, {})
            if not expected_path.is_file() or resolve_local_path(str(row.get("path") or "")) != expected_path:
                errors.append(f"portfolio updater receipt {kind} path mismatch for {name}")
                actual_hash = ""
            else:
                actual_hash = sha256_file(expected_path)
                if actual_hash != str(row.get("sha256") or ""):
                    errors.append(f"portfolio updater receipt {kind} output hash mismatch for {name}")
            normalized_outputs.append({"name": name, "path": str(expected_path), "sha256": actual_hash})
        normalized_roots.append({"kind": kind, "root": str(expected_root), "outputs": normalized_outputs})
    full_validator = mapping(receipt.get("full_validator"))
    data_path = report_path.parent / _report_artifact_names(report_path)[1]
    if full_validator.get("candidate_report_html_sha256") != sha256_file(report_path):
        errors.append("portfolio updater full-validator HTML hash is not the accepted report")
    if not data_path.is_file() or full_validator.get("candidate_report_data_sha256") != sha256_file(data_path):
        errors.append("portfolio updater full-validator report-data hash is not the accepted companion")
    binding["roots"] = normalized_roots
    return binding


def _validate_remediation_and_downloads(
    current_report: Mapping[str, Any],
    report_path: Path,
    errors: list[str],
) -> None:
    names = _report_artifact_names(report_path)
    data_path = report_path.parent / names[1]
    remediation_json_path = report_path.parent / names[2]
    remediation_markdown_path = report_path.parent / names[3]
    evaluator_scripts = Path(__file__).resolve().parents[2] / "chapterflow-book-evaluator/scripts"
    if str(evaluator_scripts) not in sys.path:
        sys.path.insert(0, str(evaluator_scripts))
    generator = importlib.import_module("generate_remediation_prompts")
    expected_pack = generator.remediation_pack(copy.deepcopy(dict(current_report)))
    actual_pack = read_json(remediation_json_path) if remediation_json_path.is_file() else None
    if actual_pack != expected_pack:
        errors.append("external remediation JSON was not deterministically regenerated from current report data")
    expected_markdown = generator.markdown_pack(expected_pack).encode("utf-8")
    if not remediation_markdown_path.is_file() or remediation_markdown_path.read_bytes() != expected_markdown:
        errors.append("external remediation Markdown was not deterministically regenerated from current report data")
    try:
        downloads = script_json_from_html(report_path, "source-downloads")
    except RepairError as exc:
        errors.append(str(exc))
        return
    expected_names = set(DOWNLOAD_EXPORTS) | {data_path.name, remediation_json_path.name, remediation_markdown_path.name}
    if set(downloads) != expected_names:
        errors.append("HTML source-downloads inventory is incomplete or contains unexpected entries")
    companion_paths = {
        data_path.name: data_path,
        remediation_json_path.name: remediation_json_path,
        remediation_markdown_path.name: remediation_markdown_path,
    }
    updater = importlib.import_module("update_portfolio_report")
    companion_bytes = {name: path.read_bytes() for name, path in companion_paths.items() if path.is_file()}
    try:
        recomputed_downloads = updater._refresh_downloads(downloads, current_report, companion_bytes)
    except Exception as exc:
        errors.append(f"could not recompute HTML source downloads: {exc}")
        recomputed_downloads = {}
    for name in set(updater.DOWNLOAD_EXPORTS) | set(companion_paths):
        if mapping(downloads.get(name)) != mapping(recomputed_downloads.get(name)):
            errors.append(f"source-download {name} does not match deterministic current-report export")
    for name, raw_record in downloads.items():
        record = mapping(raw_record)
        if name in companion_paths:
            path = companion_paths[name]
            if not path.is_file():
                errors.append(f"source-download companion is missing: {name}")
                continue
            payload = path.read_bytes()
        else:
            encoded = record.get("base64")
            if not isinstance(encoded, str):
                errors.append(f"source-download {name} has no base64 payload")
                continue
            try:
                payload = base64.b64decode(encoded, validate=True)
            except (ValueError, TypeError):
                errors.append(f"source-download {name} has invalid base64")
                continue
        if record.get("bytes") != len(payload) or record.get("sha256") != hashlib.sha256(payload).hexdigest():
            errors.append(f"source-download {name} byte count or sha256 is invalid")


def _stable_report_match(update_book: Mapping[str, Any], report_book: Mapping[str, Any], errors: list[str]) -> None:
    excluded = {"rank", "remediation"}
    for key, expected in update_book.items():
        if key in excluded:
            continue
        if key not in report_book:
            errors.append(f"updated report book is missing {key!r}")
        elif report_book[key] != expected:
            errors.append(f"updated report book does not match book-update field {key!r}")


def _validate_update_arithmetic(book: Mapping[str, Any], errors: list[str]) -> None:
    domains = list(mapping(book.get("domains")).items())
    subcriteria = sequence(book.get("subcriteria"))
    weighted_points = mapping(book.get("weighted_points"))
    if len(domains) != len(DOMAIN_WEIGHTS):
        return
    expected_overall = 0.0
    for index, ((label, raw_domain_score), weight) in enumerate(zip(domains, DOMAIN_WEIGHTS), 1):
        rows = [item for item in subcriteria if isinstance(item, Mapping) and str(item.get("domain") or "") == str(label)]
        if len(rows) != 4:
            continue
        ratings: list[float] = []
        for sub_index, row in enumerate(rows, 1):
            rating = _number(row.get("rating"), f"subcriterion {index}-{sub_index}", errors)
            if rating is None:
                continue
            if rating < 0 or rating > 4 or abs(rating * 2 - round(rating * 2)) > 1e-9:
                errors.append(f"subcriterion S-{index:02d}-{sub_index:02d} must use the adjudicated 0.5 rating grid")
            ratings.append(rating)
        if len(ratings) != 4:
            continue
        expected_domain = sum(ratings) / 4
        domain_score = _number(raw_domain_score, f"domain {label}", errors)
        if domain_score is None:
            continue
        if abs(domain_score - expected_domain) > 1e-9:
            errors.append(f"domain {label!r} score does not equal the mean of its four subratings")
        expected_points = expected_domain / 4 * weight
        expected_overall += expected_points
        points = _number(weighted_points.get(label), f"weighted_points {label}", errors)
        if points is None or abs(points - expected_points) > 0.051:
            errors.append(f"weighted_points {label!r} arithmetic mismatch")
    score = _number(book.get("score"), "book.score", errors)
    if score is not None and abs(score - expected_overall) > 0.051:
        errors.append(f"book.score arithmetic mismatch: expected {expected_overall:.4f}, got {score:g}")


def _validate_evaluator_record(
    path: Path,
    package: Mapping[str, Any],
    package_hash: str,
    book_id: str,
    *,
    role: str,
    adjudicated: bool,
    expected_run_id: str | None = None,
    worker_dispatch_receipt: Mapping[str, Any] | None = None,
    blind_pair_seal: Mapping[str, Any] | None = None,
) -> tuple[Mapping[str, Any] | None, list[str]]:
    if not path.is_file():
        return None, [f"canonical {role} artifact does not exist: {path}"]
    value = read_json(path)
    if not isinstance(value, Mapping):
        return None, [f"canonical {role} artifact must be a JSON object"]
    evaluator_root = Path(__file__).resolve().parents[2] / "chapterflow-book-evaluator"
    scripts = evaluator_root / "scripts"
    schema_path = evaluator_root / ("references/adjudicated-book.schema.json" if adjudicated else "references/book-evaluation.schema.json")
    if not scripts.is_dir() or not schema_path.is_file():
        return value, ["chapterflow-book-evaluator validator/schema is unavailable"]
    if str(scripts) not in sys.path:
        sys.path.insert(0, str(scripts))
    validator = importlib.import_module("validate_book_result")
    schema = read_json(schema_path)
    if not isinstance(schema, Mapping):
        return value, [f"{role} schema is malformed"]
    chapters = sequence(package.get("chapters"))
    source_inspection = {
        "book_id": book_id,
        "chapter_count": len(chapters),
        "inventory_complete": True,
        "inventory_errors": [],
        "chapter_inventory": [
            {
                "chapter_index": index,
                "chapter_id": mapping(chapter).get("chapterId") or mapping(chapter).get("id"),
                "number": mapping(chapter).get("number", index),
                "title": str(mapping(chapter).get("title") or f"Chapter {index}"),
            }
            for index, chapter in enumerate(chapters, 1)
        ],
    }
    validation_errors = validator.validate_result(
        value,
        schema=schema,
        expected_source_hash=package_hash,
        expected_book_id=book_id,
        expected_run_id=expected_run_id,
        expected_role=role,
        source_inspection=source_inspection,
        worker_dispatch_receipt=worker_dispatch_receipt,
        blind_pair_seal=blind_pair_seal,
        require_full_content=True,
        adjudicated=adjudicated,
    )
    return value, [f"canonical {role}: {item}" for item in validation_errors]


def _validate_rater_chain(
    primary: Mapping[str, Any],
    verification: Mapping[str, Any],
    adjudication: Mapping[str, Any],
    provenance: Mapping[str, Any],
    errors: list[str],
) -> None:
    primary_job = str(primary.get("job_id") or "")
    verification_job = str(verification.get("job_id") or "")
    adjudication_job = str(adjudication.get("job_id") or "")
    run_id = str(adjudication.get("run_id") or "")
    if not primary_job or not verification_job or primary_job == verification_job:
        errors.append("blind raters must have distinct nonempty job_id values")
    for label, record in (("primary", primary), ("verification", verification)):
        if record.get("run_id") != run_id:
            errors.append(f"{label} run_id differs from adjudication")
    evaluator_scripts = Path(__file__).resolve().parents[2] / "chapterflow-book-evaluator/scripts"
    if str(evaluator_scripts) not in sys.path:
        sys.path.insert(0, str(evaluator_scripts))
    common = importlib.import_module("common")
    expected = common.agreement_statistics(primary, verification)
    actual = mapping(adjudication.get("rater_agreement"))
    for key in ("mean_absolute_subcriterion_difference", "maximum_subcriterion_difference", "overall_score_difference"):
        try:
            matches = abs(float(actual.get(key)) - float(expected[key])) <= 1e-9
        except (TypeError, ValueError):
            matches = False
        if not matches:
            errors.append(f"adjudication rater_agreement.{key} does not match raw blind raters")
    expected_disagreements = {
        (str(item["path"]), float(item["primary"]), float(item["verification"]))
        for item in expected["disagreements"]
    }
    actual_disagreements = {
        (str(mapping(item).get("path") or ""), float(mapping(item).get("primary") or 0), float(mapping(item).get("verification") or 0))
        for item in sequence(actual.get("disagreements"))
    }
    if actual_disagreements != expected_disagreements:
        errors.append("adjudication disagreement inventory does not match raw blind raters")
    if any(mapping(item).get("source_rechecked") is not True for item in sequence(actual.get("disagreements"))):
        errors.append("every adjudicated rating disagreement must be source-rechecked")
    expected_gates = {
        (str(item["gate"]), str(item["primary"]), str(item["verification"]))
        for item in expected["gate_conflicts"]
    }
    actual_gates = {
        (str(mapping(item).get("gate") or ""), str(mapping(item).get("primary") or ""), str(mapping(item).get("verification") or ""))
        for item in sequence(actual.get("gate_conflicts"))
    }
    if actual_gates != expected_gates:
        errors.append("adjudication gate-conflict inventory does not match raw blind raters")
    if any(mapping(item).get("source_rechecked") is not True for item in sequence(actual.get("gate_conflicts"))):
        errors.append("every adjudicated gate conflict must be source-rechecked")
    expected_provenance = {
        "run_id": run_id,
        "job_id": adjudication_job,
        "primary_job_id": primary_job,
        "verification_job_id": verification_job,
    }
    if provenance.get("rater_pair_validated") is not True:
        errors.append("book-update provenance does not certify raw rater-pair validation")
    for key, expected_value in expected_provenance.items():
        if provenance.get(key) != expected_value:
            errors.append(f"book-update provenance {key} does not match raw evaluator artifacts")


def _compare_adjudication_update(adjudication: Mapping[str, Any], book: Mapping[str, Any], errors: list[str]) -> None:
    canonical_domains = list(mapping(adjudication.get("domains")).values())
    compact_domains = list(mapping(book.get("domains")).items())
    if len(canonical_domains) != 9 or len(compact_domains) != 9:
        errors.append("cannot reconcile adjudication and compact update domain inventories")
        return
    compact_rows = sequence(book.get("subcriteria"))
    for domain_index, (canonical, (label, compact_score)) in enumerate(zip(canonical_domains, compact_domains), 1):
        canonical = mapping(canonical)
        if abs(float(canonical.get("domain_score") or 0) - float(compact_score or 0)) > 1e-9:
            errors.append(f"book update domain {domain_index} score differs from canonical adjudication")
        canonical_ratings = [mapping(item).get("rating") for item in mapping(canonical.get("subcriteria")).values()]
        rows = [item for item in compact_rows if isinstance(item, Mapping) and str(item.get("domain") or "") == str(label)]
        compact_ratings = [mapping(item).get("rating") for item in rows]
        if compact_ratings != canonical_ratings:
            errors.append(f"book update domain {domain_index} subratings differ from canonical adjudication")
    canonical_score = adjudication.get("overall_score")
    if not isinstance(canonical_score, (int, float)) or isinstance(canonical_score, bool) or abs(float(canonical_score) - float(book.get("score") or 0)) > 0.051:
        errors.append("book update score differs from canonical adjudication")


def _validate_frozen_run(context_path: Path, context: Mapping[str, Any], state: Mapping[str, Any], errors: list[str]) -> Mapping[str, Any]:
    seal_path = (context_path.parent / "context-seal.json").resolve()
    seal: Mapping[str, Any] = {}
    if resolve_local_path(str(context.get("context_seal_path") or "")) != seal_path:
        errors.append("repair context does not point to the canonical immutable context seal")
    if resolve_local_path(str(state.get("context_seal_path") or "")) != seal_path:
        errors.append("repair state does not point to the canonical immutable context seal")
    if not seal_path.is_file():
        errors.append("immutable context seal is missing")
    else:
        loaded = read_json(seal_path)
        if not isinstance(loaded, Mapping):
            errors.append("immutable context seal must be a JSON object")
        else:
            seal = loaded
        if sha256_file(seal_path) != str(state.get("context_seal_sha256") or ""):
            errors.append("immutable context seal hash differs from state")
    if seal:
        repo_probe = subprocess.run(
            ["git", "-C", str(context_path.parent), "rev-parse", "--show-toplevel"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
        )
        repository = Path(repo_probe.stdout.strip()).resolve() if repo_probe.returncode == 0 else Path("/__missing_repository__")
        derived_ref = f"refs/chapterflow/book-repair-seals/{context_path.parent.parent.name}/{context_path.parent.name}"
        if seal.get("git_anchor_ref") != derived_ref:
            errors.append("context seal Git ref is not derived from the canonical run path")
        anchored = subprocess.run(
            ["git", "-C", str(repository), "show", f"{derived_ref}:context-seal.json"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
        ) if repository.is_dir() else None
        if anchored is None or anchored.returncode or anchored.stdout != seal_path.read_bytes():
            errors.append("context seal differs from its immutable content-addressed Git anchor")
        oid = subprocess.run(
            ["git", "-C", str(repository), "rev-parse", derived_ref],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
        ) if repository.is_dir() else None
        if oid is None or oid.returncode or oid.stdout.strip() != str(state.get("context_seal_git_oid") or ""):
            errors.append("state does not match the Git-anchored context seal object")
        blob_oid = subprocess.run(
            ["git", "-C", str(repository), "rev-parse", f"{derived_ref}:context-seal.json"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
        ) if repository.is_dir() else None
        if blob_oid is None or blob_oid.returncode or blob_oid.stdout.strip() != str(state.get("context_seal_blob_oid") or ""):
            errors.append("state does not match the Git-anchored context seal blob")
        reflog = subprocess.run(
            ["git", "-C", str(repository), "reflog", "show", "--format=%H", derived_ref],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
        ) if repository.is_dir() else None
        if reflog is None or reflog.returncode or reflog.stdout.splitlines() != ([oid.stdout.strip()] if oid is not None and oid.returncode == 0 else []):
            errors.append("context seal Git ref was rewritten after its one-time creation")
        if resolve_local_path(str(seal.get("context_path") or "")) != context_path.resolve():
            errors.append("immutable context seal points to a different context")
        if sha256_file(context_path) != str(seal.get("context_sha256") or ""):
            errors.append("repair-context.json changed after the immutable seal was written")
        if seal.get("run_id") != context.get("run_id") or seal.get("book_id") != context.get("book_id"):
            errors.append("immutable context seal identity differs from repair context")
        if mapping(state.get("authorizations")) != mapping(context.get("authorizations")) or mapping(state.get("authorizations")) != mapping(seal.get("authorizations")):
            errors.append("state authorizations differ from the immutable sealed user-authority record")
        sealed_repository = mapping(seal.get("repository_binding"))
        current_repository = mapping(context.get("repository"))
        for key in ("root", "branch", "upstream", "upstream_tracking_ref", "tracking_remote", "remote_ref", "remote_url", "remote_commit_at_freeze", "publication_tracking_mode", "remote_ref_existed_at_freeze"):
            if sealed_repository.get(key) != current_repository.get(key):
                errors.append(f"repair context repository {key} differs from immutable seal")
    if resolve_local_path(str(state.get("context_path") or "")) != context_path.resolve():
        errors.append("state context_path does not match the supplied repair context")
    if sha256_file(context_path) != str(state.get("context_sha256") or "") or (seal and state.get("context_sha256") != seal.get("context_sha256")):
        errors.append("mutable state tried to re-anchor a changed repair context")
    repair = mapping(context.get("repair"))
    prompt_path = resolve_local_path(str(repair.get("prompt_path") or ""))
    if resolve_local_path(str(state.get("repair_prompt_path") or "")) != prompt_path:
        errors.append("state repair_prompt_path differs from frozen context")
    if not prompt_path.is_file():
        errors.append("frozen repair prompt is missing")
    else:
        actual_prompt_hash = sha256_file(prompt_path)
        if actual_prompt_hash != str(repair.get("prompt_sha256") or ""):
            errors.append("repair-prompt.md differs from repair-context.json")
        if actual_prompt_hash != str(state.get("repair_prompt_sha256") or ""):
            errors.append("repair-prompt.md differs from state.json")
        if seal and (resolve_local_path(str(seal.get("repair_prompt_path") or "")) != prompt_path or actual_prompt_hash != str(seal.get("repair_prompt_sha256") or "")):
            errors.append("repair prompt differs from immutable context seal")
    baseline_path = resolve_local_path(str(mapping(context.get("report")).get("baseline_data_path") or ""))
    if seal and (
        resolve_local_path(str(seal.get("baseline_report_data_path") or "")) != baseline_path
        or not baseline_path.is_file()
        or sha256_file(baseline_path) != str(seal.get("baseline_report_data_sha256") or "")
    ):
        errors.append("frozen baseline report data differs from immutable context seal")
    conditions = sequence(repair.get("conditions"))
    condition_ids = [str(mapping(item).get("id") or "") for item in conditions]
    if repair.get("condition_count") != len(conditions) or condition_ids != [str(item) for item in sequence(repair.get("condition_ids"))] or len(condition_ids) != len(set(condition_ids)):
        errors.append("frozen below-80 condition inventory is inconsistent")
    defects = sequence(repair.get("mapped_defects"))
    defect_ids = [str(mapping(item).get("id") or "") for item in defects]
    if repair.get("mapped_defect_count") != len(defects) or len(defect_ids) != len(set(defect_ids)):
        errors.append("frozen mapped-defect inventory is inconsistent")
    authorities = sequence(mapping(context.get("pipeline")).get("authority_files"))
    if not authorities or any(not isinstance(item, Mapping) for item in authorities):
        errors.append("frozen pipeline authority inventory is missing or malformed")
    for raw in authorities:
        item = mapping(raw)
        path_raw = str(item.get("path") or "")
        path = resolve_local_path(path_raw) if path_raw else Path("/__missing_authority__")
        if not path.is_file():
            errors.append(f"frozen pipeline authority is missing: {path}")
        elif sha256_file(path) != str(item.get("sha256") or ""):
            errors.append(f"pipeline authority changed during the repair run: {path}")
    history = sequence(state.get("history"))
    if seal:
        errors.extend(validate_history_chain(history, genesis_sha256=str(seal.get("state_genesis_entry_sha256") or "")))
    expected_phases = ["context_loaded", "repairing", "repair_complete", "fresh_qc_passed", "evaluator_thread_created", "evaluation_complete", "report_updated"]
    actual_phases = [str(mapping(item).get("phase") or "") for item in history]
    if actual_phases != expected_phases:
        errors.append("repair state history is skipped, duplicated, reordered, or incomplete")
    for entry in history:
        phase = str(mapping(entry).get("phase") or "unknown")
        for artifact in sequence(mapping(entry).get("artifacts")):
            record = mapping(artifact)
            raw_path = str(record.get("path") or "")
            path = resolve_local_path(raw_path) if raw_path else Path("/__missing_phase_artifact__")
            if not path.is_file() or sha256_file(path) != str(record.get("sha256") or ""):
                errors.append(f"typed phase artifact is missing or changed: {phase}/{record.get('label')}")
    return seal


def verify(
    context: Mapping[str, Any],
    update: Mapping[str, Any],
    verification: Mapping[str, Any],
    package_path: Path,
    report_path: Path,
    *,
    context_path: Path,
    state: Mapping[str, Any],
    update_path: Path,
    repair_verification_path: Path,
) -> dict[str, Any]:
    errors: list[str] = []
    seal = _validate_frozen_run(context_path, context, state, errors)
    verification_schema_path = Path(__file__).resolve().parents[1] / "references/repair-verification.schema.json"
    verification_schema = read_json(verification_schema_path)
    if not isinstance(verification_schema, Mapping):
        raise RepairError("bundled repair-verification schema is malformed")
    errors.extend(f"repair-verification schema: {item}" for item in validate_json_schema(verification, verification_schema))
    book_id = str(context.get("book_id") or "")
    if not book_id:
        raise RepairError("repair context has no book_id")
    for label, candidate in (("book update", update), ("repair verification", verification)):
        if str(candidate.get("book_id") or "") != book_id:
            errors.append(f"{label} book_id does not equal repair context book_id")
    if update.get("schema_version") != "1.0.0":
        errors.append("book update schema_version must be 1.0.0")

    package_hash = sha256_file(package_path)
    source_context = mapping(context.get("source"))
    baseline_path = resolve_local_path(str(source_context.get("baseline_package_path") or ""))
    baseline_hash = str(source_context.get("baseline_package_sha256") or "")
    if not baseline_path.is_file() or sha256_file(baseline_path) != baseline_hash:
        errors.append("outer shipped baseline changed before acceptance; publication occurred too early or unrelated data changed")
    package = read_json(package_path)
    if not isinstance(package, Mapping):
        raise RepairError("current package must be a JSON object")
    package_id = str(mapping(package.get("book")).get("bookId") or package.get("book_id") or "")
    if package_id != book_id:
        errors.append(f"current package book id mismatch: {package_id!r}")
    chapters = sequence(package.get("chapters"))
    if not chapters or any(not isinstance(item, Mapping) for item in chapters):
        errors.append("current package does not contain a complete object chapter inventory")
    baseline_count = mapping(context.get("source")).get("baseline_chapter_count")
    if baseline_count != len(chapters):
        errors.append(f"nested candidate chapter count differs from frozen outer baseline: expected {baseline_count}, got {len(chapters)}")

    adjudication_raw_path = str(mapping(verification.get("verification_provenance")).get("adjudication_path") or "")
    adjudication_path = resolve_local_path(adjudication_raw_path) if adjudication_raw_path else Path("/__missing_adjudication__")
    adjudication, adjudication_errors = _validate_evaluator_record(
        adjudication_path, package, package_hash, book_id, role="adjudicated", adjudicated=True
    )
    errors.extend(adjudication_errors)
    declared_adjudication_hash = str(mapping(verification.get("verification_provenance")).get("adjudication_sha256") or "")
    if adjudication_path.is_file() and sha256_file(adjudication_path) != declared_adjudication_hash:
        errors.append("declared adjudication_sha256 does not match adjudication artifact")
    run_id = str(mapping(adjudication).get("run_id") or "")
    blind = mapping(verification.get("blind_raters"))
    primary_path = resolve_local_path(str(blind.get("primary_path") or "")) if blind.get("primary_path") else Path("/__missing_primary__")
    verification_path = resolve_local_path(str(blind.get("verification_path") or "")) if blind.get("verification_path") else Path("/__missing_verification__")
    primary_dispatch_path = resolve_local_path(str(blind.get("primary_dispatch_path") or "")) if blind.get("primary_dispatch_path") else Path("/__missing_primary_dispatch__")
    verification_dispatch_path = resolve_local_path(str(blind.get("verification_dispatch_path") or "")) if blind.get("verification_dispatch_path") else Path("/__missing_verification_dispatch__")
    pair_seal_path = resolve_local_path(str(blind.get("blind_pair_seal_path") or "")) if blind.get("blind_pair_seal_path") else Path("/__missing_pair_seal__")
    receipt_dir = primary_dispatch_path.parent
    if (
        primary_dispatch_path.name != "primary.dispatch.json"
        or verification_dispatch_path != receipt_dir / "verification.dispatch.json"
        or pair_seal_path != receipt_dir / "pair.seal.json"
        or receipt_dir.name != book_id
        or receipt_dir.parent.name != "worker-receipts"
        or receipt_dir.parent.parent.name != "jobs"
    ):
        errors.append("worker receipts must use exact jobs/worker-receipts/<book-id>/{primary.dispatch,verification.dispatch,pair.seal}.json paths")
    receipt_artifacts: dict[str, tuple[Path, str]] = {
        "primary dispatch": (primary_dispatch_path, str(blind.get("primary_dispatch_sha256") or "")),
        "verification dispatch": (verification_dispatch_path, str(blind.get("verification_dispatch_sha256") or "")),
        "blind pair seal": (pair_seal_path, str(blind.get("blind_pair_seal_sha256") or "")),
    }
    receipt_values: dict[str, Mapping[str, Any]] = {}
    for label, (path, declared_hash) in receipt_artifacts.items():
        if not path.is_file():
            errors.append(f"{label} artifact does not exist: {path}")
            continue
        value = read_json(path)
        if not isinstance(value, Mapping):
            errors.append(f"{label} artifact must be a JSON object")
            continue
        receipt_values[label] = value
        if sha256_file(path) != declared_hash:
            errors.append(f"{label} artifact hash mismatch")
    if primary_path.name != "primary.json":
        errors.append("raw primary blind-rater artifact must be named primary.json")
    if verification_path.name != "verification.json":
        errors.append("raw verification blind-rater artifact must be named verification.json")
    primary, primary_errors = _validate_evaluator_record(
        primary_path, package, package_hash, book_id, role="primary", adjudicated=False, expected_run_id=run_id or None,
        worker_dispatch_receipt=receipt_values.get("primary dispatch"), blind_pair_seal=receipt_values.get("blind pair seal"),
    )
    verification_record, verification_errors = _validate_evaluator_record(
        verification_path, package, package_hash, book_id, role="verification", adjudicated=False, expected_run_id=run_id or None,
        worker_dispatch_receipt=receipt_values.get("verification dispatch"), blind_pair_seal=receipt_values.get("blind pair seal"),
    )
    errors.extend(primary_errors)
    errors.extend(verification_errors)
    if primary_path.is_file() and sha256_file(primary_path) != str(blind.get("primary_sha256") or ""):
        errors.append("declared primary_sha256 does not match primary.json")
    if verification_path.is_file() and sha256_file(verification_path) != str(blind.get("verification_sha256") or ""):
        errors.append("declared verification_sha256 does not match verification.json")
    if primary is not None and verification_record is not None and len(receipt_values) == 3:
        evaluator_scripts = Path(__file__).resolve().parents[2] / "chapterflow-book-evaluator/scripts"
        if str(evaluator_scripts) not in sys.path:
            sys.path.insert(0, str(evaluator_scripts))
        worker_receipts = importlib.import_module("worker_receipts")
        source_inspection = {
            "book_id": book_id,
            "chapter_count": len(chapters),
            "inventory_complete": True,
            "inventory_errors": [],
            "chapter_inventory": [
                {
                    "chapter_index": index,
                    "chapter_id": mapping(chapter).get("chapterId") or mapping(chapter).get("id"),
                    "number": mapping(chapter).get("number", index),
                    "title": str(mapping(chapter).get("title") or f"Chapter {index}"),
                }
                for index, chapter in enumerate(chapters, 1)
            ],
        }
        errors.extend(
            "worker receipt chain: " + item
            for item in worker_receipts.validate_pair_chain(
                primary=primary,
                verification=verification_record,
                primary_dispatch=receipt_values["primary dispatch"],
                verification_dispatch=receipt_values["verification dispatch"],
                pair_seal=receipt_values["blind pair seal"],
                inspection=source_inspection,
            )
        )
        pair_seal = receipt_values["blind pair seal"]
        workers = mapping(pair_seal.get("workers"))
        primary_worker = mapping(workers.get("primary"))
        verification_worker = mapping(workers.get("verification"))
        receipt_provenance = {
            "blind_pair_id": pair_seal.get("pair_id"),
            "blind_pair_inventory_sha256": pair_seal.get("inventory_sha256"),
            "primary_dispatch_receipt_sha256": worker_receipts.artifact_sha256(receipt_values["primary dispatch"]),
            "verification_dispatch_receipt_sha256": worker_receipts.artifact_sha256(receipt_values["verification dispatch"]),
            "blind_pair_seal_sha256": worker_receipts.artifact_sha256(pair_seal),
            "primary_worker_task_id": primary_worker.get("worker_task_id"),
            "primary_worker_session_id": primary_worker.get("worker_session_id"),
            "verification_worker_task_id": verification_worker.get("worker_task_id"),
            "verification_worker_session_id": verification_worker.get("worker_session_id"),
        }
        for key, expected_value in receipt_provenance.items():
            if mapping(mapping(update.get("book")).get("evaluation_provenance")).get(key) != expected_value:
                errors.append(f"book-update provenance {key} does not match worker receipt chain")
    evaluation_entries = [mapping(item) for item in sequence(state.get("history")) if mapping(item).get("phase") == "evaluation_complete"]
    expected_evaluation_artifacts = {
        "primary": primary_path,
        "verification": verification_path,
        "primary_dispatch": primary_dispatch_path,
        "verification_dispatch": verification_dispatch_path,
        "blind_pair_seal": pair_seal_path,
        "adjudicated": adjudication_path,
        "book_update": update_path.resolve(),
    }
    if len(evaluation_entries) != 1:
        errors.append("sealed history must contain exactly one evaluation_complete entry")
    else:
        artifacts = {str(mapping(item).get("label") or ""): mapping(item) for item in sequence(evaluation_entries[0].get("artifacts"))}
        if set(artifacts) != set(expected_evaluation_artifacts):
            errors.append("evaluation_complete history artifact inventory is not exact")
        for label, expected_path in expected_evaluation_artifacts.items():
            record = artifacts.get(label, {})
            if resolve_local_path(str(record.get("path") or "")) != expected_path or (expected_path.is_file() and record.get("sha256") != sha256_file(expected_path)):
                errors.append(f"evaluation_complete history is not bound to exact {label} artifact")

    if str(update.get("evaluation_mode") or "") != "full_content":
        errors.append("book update is not a full-content evaluation")
    if str(update.get("source_hash") or "") != package_hash:
        errors.append("book update source_hash does not match the current package")
    book = mapping(update.get("book"))
    if str(book.get("id") or "") != book_id:
        errors.append("updated book id does not match repair context")
    score = _number(book.get("score"), "updated score", errors)
    if score is not None and score <= 80.0:
        errors.append(f"updated score must be strictly above 80.0; got {score:g}")
    _validate_update_arithmetic(book, errors)
    if adjudication is not None:
        _compare_adjudication_update(adjudication, book, errors)

    provenance = mapping(book.get("evaluation_provenance"))
    if provenance.get("method") != "full_book_blind_dual_rater_adjudication":
        errors.append("evaluation provenance is not blind dual-rater full-book adjudication")
    if provenance.get("evaluation_mode") != "full_content" or provenance.get("all_chapters_read") is not True:
        errors.append("evaluation provenance does not confirm full-content coverage")
    expected = provenance.get("chapter_count_expected")
    read_full = provenance.get("chapter_count_read_full")
    if expected != len(chapters) or read_full != len(chapters):
        errors.append("evaluation provenance chapter count does not match the current package")
    if str(provenance.get("source_hash") or "") != package_hash:
        errors.append("evaluation provenance source hash does not match the current package")
    if primary is not None and verification_record is not None and adjudication is not None:
        _validate_rater_chain(primary, verification_record, adjudication, provenance, errors)

    verification_provenance = mapping(verification.get("verification_provenance"))
    evaluator_thread_id = str(verification_provenance.get("evaluator_thread_id") or "")
    evaluator_project_id = str(verification_provenance.get("evaluator_project_id") or "")
    if not evaluator_thread_id:
        errors.append("repair verification has no evaluator_thread_id")
    if evaluator_thread_id != str(provenance.get("evaluator_thread_id") or ""):
        errors.append("repair verification and book update evaluator_thread_id differ")
    if verification_provenance.get("evaluator_task_forked") is not False:
        errors.append("repair verification does not prove evaluator forked=false")
    if resolve_local_path(str(verification_provenance.get("book_update_path") or "")) != update_path.resolve() or verification_provenance.get("book_update_sha256") != sha256_file(update_path):
        errors.append("repair verification is not hash-bound to the exact book update")
    thread_entries = [mapping(item) for item in sequence(state.get("history")) if mapping(item).get("phase") == "evaluator_thread_created"]
    if len(thread_entries) != 1:
        errors.append("sealed history must contain exactly one evaluator_thread_created entry")
    else:
        thread_evidence = mapping(thread_entries[0].get("evidence"))
        if thread_evidence.get("forked") != "false":
            errors.append("sealed evaluator task history does not record forked=false")
        if thread_evidence.get("thread_id") != evaluator_thread_id or thread_evidence.get("project_id") != evaluator_project_id:
            errors.append("repair verification evaluator task identity differs from sealed history")
    if verification_provenance.get("evaluated_after_repair") is not True:
        errors.append("repair verification does not confirm evaluation after repair")
    if verification_provenance.get("blind_result_sealed_before_baseline_opened") is not True:
        errors.append("blind evaluation was not sealed before the baseline repair prompt was opened")
    if not adjudication_raw_path:
        errors.append("repair verification has no adjudication artifact path")

    gates = mapping(book.get("gates"))
    for gate in ("technical", "epistemic", "ethics", "purpose_audience"):
        if not _pass(gates.get(gate)):
            errors.append(f"updated {gate} gate is not Pass")
    external = str(gates.get("external_accuracy") or "").strip().replace("_", " ").casefold()
    if external not in {"pass", "not assessed"}:
        errors.append("external accuracy gate must be Pass or Not assessed")

    original_conditions = sequence(mapping(context.get("repair")).get("conditions"))
    if any(not isinstance(item, Mapping) for item in original_conditions):
        raise RepairError("repair context contains a malformed condition")
    original_ids = [str(item.get("id") or "") for item in original_conditions]
    declared_ids = [str(item) for item in sequence(mapping(context.get("repair")).get("condition_ids"))]
    if len(original_ids) != len(set(original_ids)) or original_ids != declared_ids:
        raise RepairError("repair context condition inventory is inconsistent")

    verification_conditions = sequence(verification.get("conditions"))
    verification_by_id: dict[str, Mapping[str, Any]] = {}
    for item in verification_conditions:
        if not isinstance(item, Mapping):
            errors.append("repair verification contains a non-object condition")
            continue
        condition_id = str(item.get("id") or "")
        if condition_id in verification_by_id:
            errors.append(f"repair verification repeats condition {condition_id!r}")
        verification_by_id[condition_id] = item
    if set(verification_by_id) != set(original_ids):
        missing = sorted(set(original_ids) - set(verification_by_id))
        extra = sorted(set(verification_by_id) - set(original_ids))
        errors.append(f"repair verification condition inventory differs; missing={missing}, extra={extra}")
    condition_results = []
    for condition in original_conditions:
        condition_id = str(condition.get("id") or "")
        result = verification_by_id.get(condition_id, {})
        status = str(result.get("status") or "").strip().replace("-", "_").casefold()
        if status not in {"fixed", "confirmed_fixed"}:
            errors.append(f"condition {condition_id} is not confirmed fixed")
        evidence = sequence(result.get("evidence"))
        if not evidence or any(not _evidence_is_specific(item) for item in evidence):
            errors.append(f"condition {condition_id} lacks specific locator-and-finding evidence")
        percent = _condition_percent(condition, book, errors)
        if percent is not None and percent < 80.0:
            errors.append(f"condition {condition_id} remains below 80% at {percent:g}%")
        canonical_path, canonical_percent, canonical_evidence = _canonical_condition(condition_id, mapping(adjudication))
        if result.get("canonical_rubric_path") != canonical_path:
            errors.append(f"condition {condition_id} canonical_rubric_path does not resolve to adjudication")
        declared_percent = _number(result.get("post_repair_percent"), f"condition {condition_id} post_repair_percent", errors)
        if declared_percent is not None and (canonical_percent is None or abs(declared_percent - canonical_percent) > 1e-9):
            errors.append(f"condition {condition_id} post_repair_percent differs from adjudication")
        cited_adjudication = [mapping(item) for item in sequence(result.get("adjudication_evidence")) if isinstance(item, Mapping)]
        if not cited_adjudication or not canonical_evidence or any(dict(item) not in [dict(source) for source in canonical_evidence] for item in cited_adjudication):
            errors.append(f"condition {condition_id} adjudication_evidence does not resolve to canonical evidence")
        condition_results.append({"id": condition_id, "post_repair_percent": percent, "status": status})

    original_defects = sequence(mapping(context.get("repair")).get("mapped_defects"))
    declared_defect_count = mapping(context.get("repair")).get("mapped_defect_count")
    if any(not isinstance(item, Mapping) for item in original_defects):
        raise RepairError("repair context contains a malformed mapped defect")
    original_defect_ids = [str(item.get("id") or "") for item in original_defects]
    if declared_defect_count != len(original_defects) or len(original_defect_ids) != len(set(original_defect_ids)):
        raise RepairError("repair context mapped-defect inventory is inconsistent")
    defect_results = sequence(verification.get("mapped_defects"))
    defect_by_id: dict[str, Mapping[str, Any]] = {}
    for item in defect_results:
        if not isinstance(item, Mapping):
            errors.append("repair verification contains a non-object mapped defect")
            continue
        defect_id = str(item.get("id") or "")
        if defect_id in defect_by_id:
            errors.append(f"repair verification repeats mapped defect {defect_id!r}")
        defect_by_id[defect_id] = item
    if set(defect_by_id) != set(original_defect_ids):
        missing = sorted(set(original_defect_ids) - set(defect_by_id))
        extra = sorted(set(defect_by_id) - set(original_defect_ids))
        errors.append(f"mapped-defect verification inventory differs; missing={missing}, extra={extra}")
    mapped_defect_results = []
    for defect in original_defects:
        defect_id = str(defect.get("id") or "")
        result = defect_by_id.get(defect_id, {})
        status = str(result.get("status") or "").strip().replace("-", "_").casefold()
        if status not in {"fixed", "confirmed_fixed", "confirmed_not_present"}:
            errors.append(f"mapped defect {defect_id} is neither fixed nor confirmed not present")
        evidence = sequence(result.get("evidence"))
        if not evidence or any(not _evidence_is_specific(item) for item in evidence):
            errors.append(f"mapped defect {defect_id} lacks specific locator-and-finding evidence")
        mapped_defect_results.append({"id": defect_id, "status": status})

    below = _all_below_80(book, errors)
    if below:
        errors.append("updated evaluation contains below-80 conditions: " + ", ".join(sorted(below)))
    unresolved = sequence(verification.get("unresolved_defects"))
    if unresolved:
        errors.append("repair verification contains unresolved mapped QA/gate defects")
    new_defects = sequence(verification.get("new_defects"))
    if new_defects:
        errors.append("repair verification contains new defects")

    pipeline = mapping(verification.get("pipeline"))
    if not _pass(pipeline.get("book_gate")):
        errors.append("pipeline book-gate is not Pass")
    if not _pass(pipeline.get("major_status")):
        errors.append("pipeline major-status is not Pass")
    if str(pipeline.get("qc_converge") or "").strip() != "DETERMINISTIC-CLEAN":
        errors.append("pipeline qc-converge is not DETERMINISTIC-CLEAN")
    fresh_qc = mapping(pipeline.get("fresh_qc"))
    if not _pass(fresh_qc.get("status")):
        errors.append("fresh pipeline QC is not Pass")
    if fresh_qc.get("after_last_content_change") is not True:
        errors.append("pipeline QC was not run after the last content change")
    qc_score = _number(fresh_qc.get("score"), "fresh QC score", errors)
    if qc_score is not None and qc_score < 85.0:
        errors.append(f"fresh pipeline QC score is below 85: {qc_score:g}")
    minimum_axis = _number(fresh_qc.get("minimum_axis"), "fresh QC minimum axis", errors)
    if minimum_axis is not None and minimum_axis < 0.6:
        errors.append(f"fresh pipeline QC minimum axis is below 0.6: {minimum_axis:g}")
    if fresh_qc.get("session_independent") is not True:
        errors.append("fresh pipeline QC is not session-independent")
    _validate_evidence_matrix(context, fresh_qc, package, book_id, state, errors)

    current_report = report_data(report_path)
    report_book = exact_book(current_report, book_id)
    _stable_report_match(book, report_book, errors)
    report_provenance = mapping(report_book.get("evaluation_provenance"))
    if str(report_provenance.get("source_hash") or "") != package_hash:
        errors.append("updated report source hash does not match the current package")
    report_binding: dict[str, Any] = {"receipt_path": "", "receipt_sha256": "", "outputs": []}
    if report_path.suffix.casefold() in {".html", ".htm"}:
        _validate_remediation_and_downloads(current_report, report_path, errors)
        companion = _report_companion(report_path)
        if companion.is_file():
            companion_data = read_json(companion)
            if companion_data != current_report:
                errors.append("HTML embedded report-data differs from the companion report-data JSON")
        else:
            errors.append(f"user-facing report companion data is missing: {companion}")
        report_mirror = mapping(verification.get("report_mirror"))
        report_binding = _validate_portfolio_receipt(context, current_report, report_path, report_mirror, book_id, package_hash, errors)
        report_entries = [mapping(item) for item in sequence(state.get("history")) if mapping(item).get("phase") == "report_updated"]
        if len(report_entries) != 1:
            errors.append("sealed history must contain exactly one report_updated entry")
        else:
            report_artifacts = {str(mapping(item).get("label") or ""): mapping(item) for item in sequence(report_entries[0].get("artifacts"))}
            expected_report_artifacts = {
                "updater_receipt": resolve_local_path(str(report_mirror.get("updater_receipt_path") or "")),
                "report_html": report_path.resolve(),
            }
            if set(report_artifacts) != set(expected_report_artifacts):
                errors.append("report_updated history artifact inventory is not exact")
            for label, expected_path in expected_report_artifacts.items():
                record = report_artifacts.get(label, {})
                if resolve_local_path(str(record.get("path") or "")) != expected_path or (expected_path.is_file() and record.get("sha256") != sha256_file(expected_path)):
                    errors.append(f"report_updated history is not bound to exact {label} artifact")
        if report_mirror.get("transactional") is not True:
            errors.append("repo report mirror was not performed transactionally")
        if report_mirror.get("validated_before_mirror") is not True:
            errors.append("repo report mirror was not validated before replacement")
        repository_root = resolve_local_path(str(mapping(context.get("repository")).get("root") or ""))
        snapshot_dir = repository_root / "docs/v25/chapterflow-140-evaluation"
        declared_snapshot = str(report_mirror.get("repo_snapshot_dir") or "")
        if not declared_snapshot or resolve_local_path(declared_snapshot) != snapshot_dir.resolve():
            errors.append("repair verification repo_snapshot_dir is not the canonical repo report snapshot")
        validated_report_outputs: list[dict[str, Any]] = []
        for name in _report_artifact_names(report_path):
            source = report_path.parent / name
            mirrored = snapshot_dir / name
            if not source.is_file():
                errors.append(f"user-facing report artifact is missing: {source}")
                continue
            if not mirrored.is_file():
                errors.append(f"repo report artifact is missing: {mirrored}")
                continue
            if sha256_file(source) != sha256_file(mirrored):
                errors.append(f"repo report artifact is stale or differs byte-for-byte: {name}")
            else:
                validated_report_outputs.append({
                    "name": name,
                    "user_path": str(source.resolve()),
                    "repo_path": str(mirrored.resolve()),
                    "repo_relative_path": mirrored.relative_to(repository_root).as_posix(),
                    "sha256": sha256_file(source),
                })
    else:
        errors.append("acceptance requires the updated user-facing HTML report, not report-data alone")

    return {
        "schema_version": "1.0.0",
        "checked_at_utc": utc_now(),
        "run_id": str(context.get("run_id") or ""),
        "book_id": book_id,
        "accepted": not errors,
        "score": score,
        "threshold_rule": "strictly greater than 80.0",
        "source_hash": package_hash,
        "accepted_candidate_path": str(package_path),
        "accepted_candidate_sha256": package_hash,
        "chapter_count": len(chapters),
        "condition_results": condition_results,
        "mapped_defect_results": mapped_defect_results,
        "remaining_below_80": sorted(below),
        "report_path": str(report_path),
        "context_seal_path": str((context_path.parent / "context-seal.json").resolve()),
        "context_seal_sha256": sha256_file(context_path.parent / "context-seal.json") if (context_path.parent / "context-seal.json").is_file() else "",
        "context_seal_git_ref": str(seal.get("git_anchor_ref") or ""),
        "evaluator_thread_id": evaluator_thread_id,
        "evaluator_project_id": evaluator_project_id,
        "book_update_path": str(update_path.resolve()),
        "book_update_sha256": sha256_file(update_path),
        "repair_verification_path": str(repair_verification_path.resolve()),
        "repair_verification_sha256": sha256_file(repair_verification_path),
        "portfolio_updater_receipt_path": str(report_binding.get("receipt_path") or ""),
        "portfolio_updater_receipt_sha256": str(report_binding.get("receipt_sha256") or ""),
        "portfolio_updater_transaction_id": str(report_binding.get("transaction_id") or ""),
        "portfolio_updater_roots": report_binding.get("roots") or [],
        "validated_report_outputs": validated_report_outputs if report_path.suffix.casefold() in {".html", ".htm"} else [],
        "report_updated_and_matched": not any("report" in item.casefold() for item in errors),
        "blocking_errors": errors,
    }


def _anchor_acceptance_proof(
    repository: Path,
    *,
    ref: str,
    files: Mapping[str, Path],
    message: str,
) -> dict[str, Any]:
    blob_oids: dict[str, str] = {}
    for name, path in files.items():
        result = subprocess.run(
            ["git", "-C", str(repository), "hash-object", "-w", str(path)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
        )
        if result.returncode or not result.stdout.strip():
            raise RepairError(f"could not write acceptance anchor blob for {name}")
        blob_oids[name] = result.stdout.strip()
    tree_input = "".join(f"100644 blob {blob_oids[name]}\t{name}\n" for name in sorted(blob_oids))
    tree = subprocess.run(
        ["git", "-C", str(repository), "mktree"], input=tree_input,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
    )
    if tree.returncode or not tree.stdout.strip():
        raise RepairError("could not build acceptance anchor tree")
    commit = subprocess.run(
        ["git", "-C", str(repository), "commit-tree", tree.stdout.strip()], input=message + "\n",
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
    )
    if commit.returncode or not commit.stdout.strip():
        raise RepairError("could not build acceptance anchor commit")
    commit_oid = commit.stdout.strip()
    anchored = subprocess.run(
        ["git", "-C", str(repository), "update-ref", "--create-reflog", ref, commit_oid, "0" * 40],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
    )
    if anchored.returncode:
        raise RepairError("acceptance proof ref already exists or could not be created")
    return {"ref": ref, "commit_oid": commit_oid, "tree_oid": tree.stdout.strip(), "blob_oids": blob_oids}


def _update_state(state_path: Path, context: Mapping[str, Any], receipt: Mapping[str, Any], output_path: Path) -> dict[str, Any]:
    value = read_json(state_path)
    if not isinstance(value, Mapping):
        raise RepairError("repair state must be a JSON object")
    state = copy.deepcopy(dict(value))
    if str(state.get("run_id") or "") != str(context.get("run_id") or "") or str(state.get("book_id") or "") != str(context.get("book_id") or ""):
        raise RepairError("repair state does not belong to this repair context")
    if state.get("phase") != "report_updated":
        raise RepairError(f"acceptance requires report_updated state; found {state.get('phase')!r}")
    history = sequence(state.get("history"))
    if not history or not isinstance(history[-1], Mapping) or history[-1].get("phase") != "report_updated":
        raise RepairError("repair state history is not append-only through report_updated")
    now = str(receipt["checked_at_utc"])
    phase = "acceptance_passed" if receipt["accepted"] else "acceptance_failed"
    acceptance_seal_path = output_path.parent / "acceptance-seal.json"
    acceptance_seal = {
        "schema_version": "1.0.0",
        "run_id": receipt.get("run_id"),
        "book_id": receipt.get("book_id"),
        "accepted": receipt.get("accepted"),
        "acceptance_receipt_path": str(output_path.resolve()),
        "acceptance_receipt_sha256": sha256_file(output_path),
        "context_seal_path": receipt.get("context_seal_path"),
        "context_seal_sha256": receipt.get("context_seal_sha256"),
        "accepted_candidate_path": receipt.get("accepted_candidate_path"),
        "accepted_candidate_sha256": receipt.get("accepted_candidate_sha256"),
        "portfolio_updater_receipt_path": receipt.get("portfolio_updater_receipt_path"),
        "portfolio_updater_receipt_sha256": receipt.get("portfolio_updater_receipt_sha256"),
        "portfolio_updater_transaction_id": receipt.get("portfolio_updater_transaction_id"),
        "portfolio_updater_roots": receipt.get("portfolio_updater_roots"),
        "validated_report_outputs": receipt.get("validated_report_outputs"),
        "evaluator_thread_id": receipt.get("evaluator_thread_id"),
        "evaluator_project_id": receipt.get("evaluator_project_id"),
        "pre_acceptance_history_entry_sha256": str(mapping(history[-1]).get("entry_sha256") or ""),
    }
    atomic_write_json(acceptance_seal_path, acceptance_seal)
    artifact_inventory = [
        {
            "phase": str(mapping(entry).get("phase") or ""),
            "label": str(mapping(artifact).get("label") or ""),
            "path": str(mapping(artifact).get("path") or ""),
            "sha256": str(mapping(artifact).get("sha256") or ""),
        }
        for entry in history
        for artifact in sequence(mapping(entry).get("artifacts"))
    ]
    acceptance_manifest_path = output_path.parent / "acceptance-manifest.json"
    acceptance_manifest = {
        "schema_version": "1.0.0",
        "run_id": receipt.get("run_id"),
        "book_id": receipt.get("book_id"),
        "accepted": receipt.get("accepted"),
        "context_seal_git_ref": state.get("context_seal_git_ref"),
        "context_seal_git_oid": state.get("context_seal_git_oid"),
        "pre_acceptance_phase": str(state.get("phase") or ""),
        "pre_acceptance_history_length": len(history),
        "pre_acceptance_history_entry_sha256": str(mapping(history[-1]).get("entry_sha256") or ""),
        "history_artifacts": artifact_inventory,
        "acceptance_receipt_path": str(output_path.resolve()),
        "acceptance_receipt_sha256": sha256_file(output_path),
        "acceptance_seal_path": str(acceptance_seal_path.resolve()),
        "acceptance_seal_sha256": sha256_file(acceptance_seal_path),
        "accepted_candidate_path": receipt.get("accepted_candidate_path"),
        "accepted_candidate_sha256": receipt.get("accepted_candidate_sha256"),
        "book_update_path": receipt.get("book_update_path"),
        "book_update_sha256": receipt.get("book_update_sha256"),
        "repair_verification_path": receipt.get("repair_verification_path"),
        "repair_verification_sha256": receipt.get("repair_verification_sha256"),
        "portfolio_updater_receipt_path": receipt.get("portfolio_updater_receipt_path"),
        "portfolio_updater_receipt_sha256": receipt.get("portfolio_updater_receipt_sha256"),
        "portfolio_updater_transaction_id": receipt.get("portfolio_updater_transaction_id"),
        "validated_report_outputs": receipt.get("validated_report_outputs"),
    }
    atomic_write_json(acceptance_manifest_path, acceptance_manifest)
    repository = resolve_local_path(str(mapping(context.get("repository")).get("root") or ""))
    acceptance_ref = f"refs/chapterflow/book-repair-acceptance/{context.get('book_id')}/{context.get('run_id')}"
    anchor = _anchor_acceptance_proof(
        repository,
        ref=acceptance_ref,
        files={
            "acceptance-manifest.json": acceptance_manifest_path,
            "acceptance-receipt.json": output_path,
            "acceptance-seal.json": acceptance_seal_path,
        },
        message=f"Anchor ChapterFlow book-repair acceptance {context.get('book_id')}/{context.get('run_id')}",
    )
    state["phase"] = phase
    state["updated_at_utc"] = now
    state["acceptance"] = {
        "accepted": receipt["accepted"],
        "receipt_path": str(output_path),
        "receipt_sha256": sha256_file(output_path),
        "acceptance_seal_path": str(acceptance_seal_path),
        "acceptance_seal_sha256": sha256_file(acceptance_seal_path),
        "acceptance_manifest_path": str(acceptance_manifest_path),
        "acceptance_manifest_sha256": sha256_file(acceptance_manifest_path),
        "acceptance_git_ref": anchor["ref"],
        "acceptance_git_oid": anchor["commit_oid"],
        "acceptance_git_tree_oid": anchor["tree_oid"],
        "acceptance_git_blob_oids": anchor["blob_oids"],
        "score": receipt.get("score"),
        "blocking_error_count": len(sequence(receipt.get("blocking_errors"))),
    }
    acceptance_entry = {
        "phase": phase,
        "at_utc": now,
        "artifacts": [
            {"label": "acceptance_receipt", "path": str(output_path), "sha256": sha256_file(output_path)},
            {"label": "acceptance_seal", "path": str(acceptance_seal_path), "sha256": sha256_file(acceptance_seal_path)},
            {"label": "acceptance_manifest", "path": str(acceptance_manifest_path), "sha256": sha256_file(acceptance_manifest_path)},
        ],
        "previous_entry_sha256": str(mapping(history[-1]).get("entry_sha256") or ""),
    }
    acceptance_entry["entry_sha256"] = history_entry_sha256(acceptance_entry)
    state["history"] = history + [acceptance_entry]
    authorizations = mapping(state.get("authorizations"))
    state["publication"] = {
        "eligible": bool(receipt["accepted"] and authorizations.get("git_push") is True),
        "push_authorized_in_context": authorizations.get("git_push") is True,
        "requires_live_authority_recheck": True,
    }
    atomic_write_json(state_path, state)
    return state


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repair-context", required=True)
    parser.add_argument("--book-update", required=True)
    parser.add_argument("--repair-verification", required=True)
    parser.add_argument("--report", required=True, help="Updated HTML report (preferred) or report-data JSON")
    parser.add_argument("--package", help="Defaults to the nested post-promote candidate path frozen in repair context")
    parser.add_argument("--state", help="Defaults to state.json beside repair context")
    parser.add_argument("--output", help="Defaults to acceptance-receipt.json beside repair context")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        context_path = resolve_local_path(args.repair_context)
        update_path = resolve_local_path(args.book_update)
        verification_path = resolve_local_path(args.repair_verification)
        report_path = resolve_local_path(args.report)
        context = read_json(context_path)
        update = read_json(update_path)
        verification = read_json(verification_path)
        if not all(isinstance(item, Mapping) for item in (context, update, verification)):
            raise RepairError("context, update, and verification must be JSON objects")
        package_path = resolve_local_path(args.package or str(mapping(context.get("source")).get("candidate_package_path") or ""))
        recorded_package = resolve_local_path(str(mapping(context.get("source")).get("candidate_package_path") or ""))
        if package_path != recorded_package:
            raise RepairError("evaluated package path differs from the nested candidate path frozen in repair context")
        recorded_report = resolve_local_path(str(mapping(context.get("report")).get("path") or ""))
        if report_path != recorded_report:
            raise RepairError("updated report path differs from the path frozen in repair context")
        canonical_output_path = (context_path.parent / "acceptance-receipt.json").resolve()
        output_path = resolve_local_path(args.output) if args.output else canonical_output_path
        if output_path != canonical_output_path:
            raise RepairError("acceptance receipt output must use the canonical path beside repair-context.json")
        state_path = resolve_local_path(args.state) if args.state else context_path.parent / "state.json"
        state_before = read_json(state_path)
        if not isinstance(state_before, Mapping):
            raise RepairError("repair state must be a JSON object")
        receipt = verify(
            context,
            update,
            verification,
            package_path,
            report_path,
            context_path=context_path,
            state=state_before,
            update_path=update_path,
            repair_verification_path=verification_path,
        )
        atomic_write_json(output_path, receipt)
        state = _update_state(state_path, context, receipt, output_path)
    except (RepairError, OSError, json.JSONDecodeError) as exc:
        print(f"book-repair verification error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({
        "book_id": receipt["book_id"],
        "accepted": receipt["accepted"],
        "score": receipt["score"],
        "blocking_errors": receipt["blocking_errors"],
        "publication_eligible": state["publication"]["eligible"],
        "receipt": str(output_path),
    }, indent=2))
    return 0 if receipt["accepted"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
