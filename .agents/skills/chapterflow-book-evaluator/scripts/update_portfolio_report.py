#!/usr/bin/env python3
"""Transactionally replace one full-content book in the 140-book report snapshot."""

from __future__ import annotations

import argparse
import base64
import copy
import csv
import hashlib
import html as html_lib
import io
import json
import math
import os
import re
import stat
import tempfile
import uuid
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Mapping, MutableMapping, Sequence

from common import EvaluationError, read_json
from generate_remediation_prompts import markdown_pack, remediation_pack
from validate_book_result import _jsonschema_errors
from validate_report import validate_report as full_report_validator


EXPECTED_BOOKS = 140
EXPECTED_SUBCRITERIA = 36
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
DOWNLOAD_EXPORTS = (
    "ChapterFlow_140_Scorecard.csv",
    "ChapterFlow_140_Diagnostics.csv",
    "ChapterFlow_140_Weighted_Points.csv",
    "ChapterFlow_140_Subcriterion_Audit.csv",
    "ChapterFlow_140_Chapter_Evidence.csv",
    "ChapterFlow_140_QA_Findings.csv",
    "ChapterFlow_140_Summary.md",
)
RECEIPT_SCHEMA = Path(__file__).resolve().parents[1] / "references" / "portfolio-update-receipt.schema.json"


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _sequence(value: Any) -> list[Any]:
    return list(value) if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)) else []


def _finite_number(value: Any, label: str) -> float:
    if isinstance(value, bool):
        raise EvaluationError(f"{label} must be a finite number")
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise EvaluationError(f"{label} must be a finite number") from exc
    if not math.isfinite(parsed):
        raise EvaluationError(f"{label} must be a finite number")
    return parsed


def _nonnegative_int(value: Any, label: str) -> int:
    parsed = _finite_number(value, label)
    if parsed < 0 or int(parsed) != parsed:
        raise EvaluationError(f"{label} must be a nonnegative integer")
    return int(parsed)


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _script_json(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return (
        encoded.replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


class ScriptSpanParser(HTMLParser):
    """Locate raw script-body spans without using regex on HTML."""

    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=False)
        self.source = source
        self.line_offsets = [0]
        for match in re.finditer("\n", source):
            self.line_offsets.append(match.end())
        self.active: tuple[str, int] | None = None
        self.spans: dict[str, list[tuple[int, int]]] = {}

    def _offset(self) -> int:
        line, column = self.getpos()
        return self.line_offsets[line - 1] + column

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "script":
            return
        identifier = dict(attrs).get("id")
        if identifier not in {"report-data", "source-downloads"}:
            return
        if self.active is not None:
            raise EvaluationError("nested report script elements are not supported")
        self.active = (identifier, self._offset() + len(self.get_starttag_text()))

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self.active is not None:
            identifier, start = self.active
            self.spans.setdefault(identifier, []).append((start, self._offset()))
            self.active = None


def _script_spans(html: str) -> dict[str, tuple[int, int]]:
    parser = ScriptSpanParser(html)
    parser.feed(html)
    parser.close()
    result: dict[str, tuple[int, int]] = {}
    for identifier in ("report-data", "source-downloads"):
        matches = parser.spans.get(identifier, [])
        if len(matches) != 1:
            raise EvaluationError(f"HTML must contain exactly one #{identifier} script; found {len(matches)}")
        result[identifier] = matches[0]
    return result


def _read_html_payloads(html: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, tuple[int, int]]]:
    spans = _script_spans(html)
    try:
        report = json.loads(html[slice(*spans["report-data"])])
        downloads = json.loads(html[slice(*spans["source-downloads"])])
    except json.JSONDecodeError as exc:
        raise EvaluationError(f"invalid embedded HTML JSON: {exc}") from exc
    if not isinstance(report, dict) or not isinstance(downloads, dict):
        raise EvaluationError("embedded report-data and source-downloads must be JSON objects")
    return report, downloads, spans


def _replace_script_payloads(
    html: str,
    spans: Mapping[str, tuple[int, int]],
    report: Mapping[str, Any],
    downloads: Mapping[str, Any],
) -> str:
    replacements = [
        (spans["report-data"], _script_json(report)),
        (spans["source-downloads"], _script_json(downloads)),
    ]
    for (start, end), content in sorted(replacements, key=lambda item: item[0][0], reverse=True):
        html = html[:start] + content + html[end:]
    return html


class VisibleMethodParser(HTMLParser):
    """Find method-facing element bodies while leaving scripts and data untouched."""

    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=False)
        self.source = source
        self.line_offsets = [0]
        for match in re.finditer("\n", source):
            self.line_offsets.append(match.end())
        self.stack: list[dict[str, Any]] = []
        self.spans: dict[str, tuple[int, int]] = {}
        self.method_lists: dict[str, tuple[int, int]] = {}
        self.method_headings: dict[str, tuple[int, int]] = {}

    def _offset(self) -> int:
        line, column = self.getpos()
        return self.line_offsets[line - 1] + column

    def _has_ancestor(self, predicate: Any) -> bool:
        return any(predicate(item) for item in self.stack)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        entry: dict[str, Any] = {
            "tag": tag,
            "attrs": attributes,
            "start": self._offset() + len(self.get_starttag_text()),
            "method": self._has_ancestor(lambda item: item["tag"] == "section" and item["attrs"].get("id") == "methods")
            or (tag == "section" and attributes.get("id") == "methods"),
            "source_summary": self._has_ancestor(lambda item: item["tag"] == "details" and "source-summary" in str(item["attrs"].get("class") or "").split())
            or (tag == "details" and "source-summary" in str(attributes.get("class") or "").split()),
            "footer": self._has_ancestor(lambda item: item["tag"] == "footer") or tag == "footer",
        }
        self.stack.append(entry)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        return

    def handle_endtag(self, tag: str) -> None:
        index = next((position for position in range(len(self.stack) - 1, -1, -1) if self.stack[position]["tag"] == tag), None)
        if index is None:
            return
        entry = self.stack[index]
        del self.stack[index:]
        end = self._offset()
        attributes = entry["attrs"]
        raw = self.source[entry["start"]:end]
        if tag == "h1" and "hero_title" not in self.spans:
            self.spans["hero_title"] = (entry["start"], end)
        elif tag == "p" and "scope-note" in str(attributes.get("class") or "").split():
            self.spans["scope_note"] = (entry["start"], end)
        elif tag == "p" and "lede" in str(attributes.get("class") or "").split():
            self.spans["lede"] = (entry["start"], end)
        elif tag == "p" and entry["footer"]:
            self.spans["footer"] = (entry["start"], end)
        elif tag == "pre" and entry["source_summary"]:
            self.spans["source_summary"] = (entry["start"], end)
        elif tag == "summary" and entry["source_summary"]:
            self.spans["source_summary_label"] = (entry["start"], end)
        elif tag == "h3" and entry["method"]:
            heading = html_lib.unescape(re.sub(r"<[^>]+>", "", raw)).strip()
            if heading:
                self.method_headings[heading] = (entry["start"], end)
                for ancestor in reversed(self.stack):
                    if ancestor["tag"] == "article":
                        ancestor["heading"] = heading
                        break
        elif tag == "ul" and entry["method"]:
            heading = next((str(item.get("heading")) for item in reversed(self.stack) if item["tag"] == "article" and item.get("heading")), "")
            if heading:
                self.method_lists[heading] = (entry["start"], end)


def _refresh_visible_method_copy(source: str, report: Mapping[str, Any]) -> str:
    meta = _mapping(report.get("meta"))
    method_counts = _mapping(meta.get("evaluation_method_counts"))
    full_count = _nonnegative_int(method_counts.get("full_content_blind_dual_rater_adjudication", 0), "full-content method count")
    legacy_count = _nonnegative_int(method_counts.get("legacy_screening_or_unprovenanced", 0), "legacy method count")
    chapters = _nonnegative_int(meta.get("chapters"), "meta.chapters")
    words = _nonnegative_int(meta.get("words"), "meta.words")
    parser = VisibleMethodParser(source)
    parser.feed(source)
    parser.close()
    replacements: list[tuple[tuple[int, int], str]] = []

    def add(key: str, content: str) -> None:
        if key in parser.spans:
            replacements.append((parser.spans[key], content))

    all_full = legacy_count == 0
    add("hero_title", "140-book full-content content-design evaluation" if all_full else "140-book mixed-method content-design evaluation")
    add(
        "lede",
        f"A self-contained explorer for scores, gates, nine weighted domains, all 36 subcriteria, diagnostics, QA findings, and {chapters:,} chapter evidence records.",
    )
    add(
        "scope_note",
        f"{full_count} full-content blind dual-rater adjudication record(s) and {legacy_count} legacy screening record(s). "
        "External factual accuracy and measured reader outcomes remain separately scoped; hard gates override weighted scores.",
    )
    add("footer", "ChapterFlow 140-book full-content evaluation · Offline report" if all_full else "ChapterFlow 140-book mixed-method evaluation · Offline report")
    add("source_summary_label", "Current generated summary")
    add("source_summary", html_lib.escape(_summary_markdown(report).decode("utf-8"), quote=False))

    scope_items = (
        f"<li>{len(_sequence(report.get('books'))):,} packages represented.</li>"
        f"<li>{chapters:,} chapters and approximately {words / 1_000_000:.2f} million reader-facing words represented.</li>"
        "<li>Nine weighted domains and 36 subcriteria are recorded for every book.</li>"
        f"<li>{full_count} record(s) have explicit full-content blind dual-rater adjudication provenance; {legacy_count} retain legacy screening provenance.</li>"
    )
    interpretation_items = (
        f"<li>This is {'a full-content adjudication portfolio' if all_full else 'a mixed-method portfolio'}, with method provenance attached per book.</li>"
        "<li>Compare scores only after checking each record’s evaluation method, confidence, and hard gates.</li>"
        "<li>External factual accuracy is not implied unless the individual record explicitly documents it.</li>"
        "<li>Scores assess design support; they do not measure retention, transfer, completion, satisfaction, or behavior change.</li>"
    )
    availability_items = (
        f"<li>Independent primary/verification ratings and adjudication trails are available for {full_count} record(s), not the {legacy_count} legacy record(s).</li>"
        "<li>Source hashes and all-chapter coverage are authoritative only where explicit evaluation provenance is attached.</li>"
        "<li>External-accuracy evidence remains unavailable unless separately assessed on the individual record.</li>"
        "<li>No measured reader outcomes are included.</li>"
    )
    for heading, content in (
        ("Scope", scope_items),
        ("Interpretation boundary", interpretation_items),
        ("Unavailable in this package", availability_items),
        ("Evidence availability by record", availability_items),
    ):
        if heading in parser.method_lists:
            replacements.append((parser.method_lists[heading], content))
    for heading in ("Unavailable in this package", "Evidence availability by record"):
        if heading in parser.method_headings:
            replacements.append((parser.method_headings[heading], "Evidence availability by record"))

    for span, content in sorted(replacements, key=lambda item: item[0][0], reverse=True):
        source = source[:span[0]] + content + source[span[1]:]
    source = source.replace(
        'stat("Confidence cohorts", `${payload.meta.profile_counts.prior} + ${payload.meta.profile_counts.scalable}`, "Prior close-read + scalable screening")',
        'stat("Evaluation methods", `${payload.meta.full_content_evaluation_count} + ${payload.meta.evaluation_method_counts.legacy_screening_or_unprovenanced}`, "Full adjudication + legacy screening")',
    )
    source = source.replace("Single-screening subcriterion ratings on the 0–4 scale", "Recorded subcriterion ratings on the 0–4 scale")
    source = source.replace("All 36 single-screening subcriterion ratings", "All 36 recorded subcriterion ratings")
    source = source.replace("These metrics are screening proxies.", "These metrics are diagnostic proxies.")
    source = source.replace(
        "Download the exact files supplied in the results package or the normalized JSON used by this report.",
        "Download regenerated audit exports and the normalized companion files used by this report.",
    )
    return source


def _domain_contract(report: Mapping[str, Any]) -> tuple[list[str], dict[str, float]]:
    names = [str(item) for item in _sequence(report.get("domain_names"))]
    if len(names) != 9 or len(set(names)) != 9 or any(not item for item in names):
        raise EvaluationError("report must declare exactly nine unique domain names")
    raw_weights = _mapping(report.get("domain_weights"))
    if set(raw_weights) != set(names):
        raise EvaluationError("domain_weights must exactly match domain_names")
    weights = {name: _finite_number(raw_weights[name], f"domain weight {name}") for name in names}
    if any(value <= 0 for value in weights.values()) or not math.isclose(sum(weights.values()), 100.0, abs_tol=1e-9):
        raise EvaluationError("domain weights must be positive and sum to 100")
    return names, weights


def _validate_book_shape(book: Mapping[str, Any], names: Sequence[str], *, label: str) -> None:
    book_id = str(book.get("id") or "")
    if not book_id:
        raise EvaluationError(f"{label}.id must be nonempty")
    domains = _mapping(book.get("domains"))
    if set(domains) != set(names):
        raise EvaluationError(f"{label}.domains must exactly match the nine report domains")
    rows = [item for item in _sequence(book.get("subcriteria")) if isinstance(item, Mapping)]
    if len(rows) != EXPECTED_SUBCRITERIA or len(rows) != len(_sequence(book.get("subcriteria"))):
        raise EvaluationError(f"{label} must contain exactly {EXPECTED_SUBCRITERIA} subcriteria objects")
    by_domain: Counter[str] = Counter()
    labels: set[tuple[str, str]] = set()
    for index, row in enumerate(rows):
        domain = str(row.get("domain") or "")
        subcriterion = str(row.get("subcriterion") or "")
        if domain not in names or not subcriterion:
            raise EvaluationError(f"{label}.subcriteria[{index}] has an invalid domain or label")
        key = (domain, subcriterion)
        if key in labels:
            raise EvaluationError(f"{label} has duplicate subcriterion {domain!r} / {subcriterion!r}")
        labels.add(key)
        rating = _finite_number(row.get("rating"), f"{label}.subcriteria[{index}].rating")
        if not 0 <= rating <= 4:
            raise EvaluationError(f"{label}.subcriteria[{index}].rating must be in [0, 4]")
        by_domain[domain] += 1
    if any(by_domain[name] != 4 for name in names):
        raise EvaluationError(f"{label} must contain exactly four subcriteria for every domain")


def _validate_portfolio(report: Mapping[str, Any]) -> tuple[list[str], dict[str, float]]:
    names, weights = _domain_contract(report)
    books = _sequence(report.get("books"))
    if len(books) != EXPECTED_BOOKS or any(not isinstance(item, Mapping) for item in books):
        raise EvaluationError(f"report must contain exactly {EXPECTED_BOOKS} book objects")
    ids: list[str] = []
    for index, book in enumerate(books):
        record = _mapping(book)
        _validate_book_shape(record, names, label=f"books[{index}]")
        ids.append(str(record.get("id")))
    if len(set(ids)) != EXPECTED_BOOKS:
        duplicates = sorted(item for item, count in Counter(ids).items() if count > 1)
        raise EvaluationError(f"book ids must be unique; duplicates: {duplicates}")
    return names, weights


def _validate_update(envelope: Mapping[str, Any], names: Sequence[str]) -> tuple[str, dict[str, Any]]:
    if envelope.get("schema_version") != "1.0.0":
        raise EvaluationError("book update envelope must declare schema_version=1.0.0")
    if envelope.get("evaluation_mode") != "full_content":
        raise EvaluationError("book update envelope must declare evaluation_mode=full_content")
    book_id = str(envelope.get("book_id") or "")
    source_hash = str(envelope.get("source_hash") or "")
    book = copy.deepcopy(dict(_mapping(envelope.get("book"))))
    if not book_id or str(book.get("id") or "") != book_id:
        raise EvaluationError("book update envelope and book.id must contain the same nonempty id")
    _validate_book_shape(book, names, label="book_update.book")
    provenance = _mapping(book.get("evaluation_provenance"))
    if provenance.get("method") != "full_book_blind_dual_rater_adjudication":
        raise EvaluationError("book update lacks blind dual-rater adjudication provenance")
    if provenance.get("evaluation_mode") != "full_content" or provenance.get("all_chapters_read") is not True:
        raise EvaluationError("book update provenance must certify full-content all-chapter reading")
    if provenance.get("rater_pair_validated") is not True:
        raise EvaluationError("book update provenance must certify a validated blind rater pair")
    if not SHA256_PATTERN.fullmatch(source_hash) or provenance.get("source_hash") != source_hash:
        raise EvaluationError("book update source hashes are missing, malformed, or inconsistent")
    for key in (
        "run_id", "job_id", "primary_job_id", "verification_job_id", "blind_pair_id",
        "primary_worker_task_id", "primary_worker_session_id",
        "verification_worker_task_id", "verification_worker_session_id", "evaluated_at_utc",
    ):
        if not str(provenance.get(key) or "").strip():
            raise EvaluationError(f"book update provenance.{key} must be nonempty")
    job_ids = {
        str(provenance.get("job_id")).strip(),
        str(provenance.get("primary_job_id")).strip(),
        str(provenance.get("verification_job_id")).strip(),
    }
    if len(job_ids) != 3:
        raise EvaluationError("adjudicated, primary, and verification job ids must be distinct")
    if len({str(provenance.get("primary_worker_task_id")), str(provenance.get("verification_worker_task_id"))}) != 2:
        raise EvaluationError("primary and verification worker task ids must be distinct")
    if len({str(provenance.get("primary_worker_session_id")), str(provenance.get("verification_worker_session_id"))}) != 2:
        raise EvaluationError("primary and verification worker session ids must be distinct")
    for key in (
        "blind_pair_inventory_sha256", "primary_dispatch_receipt_sha256",
        "verification_dispatch_receipt_sha256", "blind_pair_seal_sha256",
    ):
        if not SHA256_PATTERN.fullmatch(str(provenance.get(key) or "")):
            raise EvaluationError(f"book update provenance.{key} must be a lowercase SHA-256 digest")
    expected = _nonnegative_int(provenance.get("chapter_count_expected"), "chapter_count_expected")
    read_full = _nonnegative_int(provenance.get("chapter_count_read_full"), "chapter_count_read_full")
    chapters = _nonnegative_int(book.get("chapters"), "book_update.book.chapters")
    if not expected or expected != read_full or expected != chapters:
        raise EvaluationError("full-content provenance counts must equal the positive book chapter count")
    chapter_evidence = _sequence(book.get("chapter_evidence"))
    if len(chapter_evidence) != chapters or any(not isinstance(item, Mapping) for item in chapter_evidence):
        raise EvaluationError("book update chapter_evidence must contain one object for every chapter")
    for index, row in enumerate(_sequence(book.get("subcriteria"))):
        rating = _finite_number(_mapping(row).get("rating"), f"book_update.book.subcriteria[{index}].rating")
        if not math.isclose(rating * 2, round(rating * 2), abs_tol=1e-9):
            raise EvaluationError("book update subcriterion ratings must use the 0.5 adjudication grid")
    book.pop("remediation", None)
    return book_id, book


def _condition_snapshot(report: Mapping[str, Any], target_id: str) -> tuple[int, int]:
    summary = _mapping(report.get("remediation_summary"))
    conditions = _mapping(summary.get("conditions"))
    old_total = _nonnegative_int(conditions.get("total"), "remediation_summary.conditions.total")
    books = [_mapping(item) for item in _sequence(report.get("books"))]
    per_book = []
    target_count: int | None = None
    for book in books:
        count = _nonnegative_int(_mapping(book.get("remediation")).get("condition_count"), f"{book.get('id')}.remediation.condition_count")
        per_book.append(count)
        if book.get("id") == target_id:
            target_count = count
    if sum(per_book) != old_total:
        raise EvaluationError("existing remediation summary does not equal the per-book condition ledger")
    if target_count is None:
        raise EvaluationError(f"target book {target_id!r} is absent")
    return old_total, target_count


def _band(score: float) -> str:
    if score >= 90:
        return "Reference-standard"
    if score >= 80:
        return "Strong"
    if score >= 70:
        return "Valuable but uneven"
    if score >= 60:
        return "Substantial redesign needed"
    return "Not ready"


def _recompute_target(book: MutableMapping[str, Any], names: Sequence[str], weights: Mapping[str, float]) -> None:
    rows = [_mapping(item) for item in _sequence(book.get("subcriteria"))]
    domain_scores: dict[str, float] = {}
    weighted_points: dict[str, float] = {}
    for name in names:
        ratings = [_finite_number(item.get("rating"), f"{book.get('id')}.{name}.rating") for item in rows if item.get("domain") == name]
        if len(ratings) != 4:
            raise EvaluationError(f"{book.get('id')} does not have four ratings for {name}")
        score = sum(ratings) / 4
        domain_scores[name] = round(score, 8)
        weighted_points[name] = round(score / 4 * weights[name], 8)
    overall = round(sum(weighted_points.values()), 8)
    book["domains"] = domain_scores
    book["weighted_points"] = weighted_points
    book["score"] = overall
    book["band"] = _band(overall)


def _rerank(books: list[MutableMapping[str, Any]]) -> None:
    books.sort(key=lambda item: (-_finite_number(item.get("score"), f"{item.get('id')}.score"), str(item.get("title") or "").casefold(), str(item.get("id") or "")))
    previous_score: float | None = None
    previous_rank = 0
    for position, book in enumerate(books, 1):
        score = _finite_number(book.get("score"), f"{book.get('id')}.score")
        if previous_score is None or not math.isclose(score, previous_score, abs_tol=1e-9):
            previous_rank = position
            previous_score = score
        book["rank"] = previous_rank


def _display_status(value: Any) -> str:
    text = str(value or "Not supplied").replace("_", " ").strip()
    return " ".join(part.capitalize() for part in text.split()) or "Not supplied"


def _has_valid_full_provenance(book: Mapping[str, Any]) -> bool:
    provenance = _mapping(book.get("evaluation_provenance"))
    job_ids = [str(provenance.get(key) or "").strip() for key in ("job_id", "primary_job_id", "verification_job_id")]
    task_ids = [str(provenance.get(key) or "").strip() for key in ("primary_worker_task_id", "verification_worker_task_id")]
    session_ids = [str(provenance.get(key) or "").strip() for key in ("primary_worker_session_id", "verification_worker_session_id")]
    proof_hashes = [
        str(provenance.get(key) or "")
        for key in (
            "blind_pair_inventory_sha256", "primary_dispatch_receipt_sha256",
            "verification_dispatch_receipt_sha256", "blind_pair_seal_sha256",
        )
    ]
    expected = provenance.get("chapter_count_expected")
    read_full = provenance.get("chapter_count_read_full")
    chapters = book.get("chapters")
    return (
        provenance.get("method") == "full_book_blind_dual_rater_adjudication"
        and provenance.get("evaluation_mode") == "full_content"
        and provenance.get("all_chapters_read") is True
        and provenance.get("rater_pair_validated") is True
        and all(job_ids)
        and len(set(job_ids)) == 3
        and all(task_ids) and len(set(task_ids)) == 2
        and all(session_ids) and len(set(session_ids)) == 2
        and str(provenance.get("blind_pair_id") or "").strip() != ""
        and all(SHA256_PATTERN.fullmatch(value) is not None for value in proof_hashes)
        and SHA256_PATTERN.fullmatch(str(provenance.get("source_hash") or "")) is not None
        and isinstance(expected, int) and not isinstance(expected, bool) and expected > 0
        and read_full == expected
        and chapters == expected
        and len(_sequence(book.get("chapter_evidence"))) == expected
    )


def _recompute_meta(report: MutableMapping[str, Any]) -> None:
    books = [_mapping(item) for item in _sequence(report.get("books"))]
    profile_counts = Counter(str(book.get("profile") or "unknown") for book in books)
    gate_specs = [
        ("Technical gate", "technical"),
        ("Epistemic gate", "epistemic"),
        ("Ethics gate", "ethics"),
        ("External accuracy", "external_accuracy"),
    ]
    if any("purpose_audience" in _mapping(book.get("gates")) for book in books):
        gate_specs.insert(3, ("Purpose/audience gate", "purpose_audience"))
    gate_counts: dict[str, dict[str, int]] = {}
    for label, key in gate_specs:
        counts = Counter(_display_status(_mapping(book.get("gates")).get(key)) for book in books)
        gate_counts[label] = dict(sorted(counts.items()))
    component_keys = ("examples", "questions", "review_cards", "memorable_lines")
    component_totals = {
        key: sum(_nonnegative_int(_mapping(book.get("diagnostics_full")).get(key, 0), f"{book.get('id')}.diagnostics_full.{key}") for book in books)
        for key in component_keys
    }
    full_count = sum(_has_valid_full_provenance(book) for book in books)
    legacy_count = len(books) - full_count
    if legacy_count:
        evaluation_mode = f"Mixed-method portfolio: {full_count} full-content blind dual-rater adjudication(s); {legacy_count} legacy screening record(s)"
        warning = (
            "This portfolio is mixed-method. Only records with explicit full-content provenance are blind dual-rater adjudications; "
            "all other scores retain their legacy screening method and must not be described as equivalently adjudicated."
        )
        title = "ChapterFlow 140-book mixed-method content-design evaluation"
    else:
        evaluation_mode = "Full-content blind dual-rater adjudication portfolio"
        warning = "Every portfolio record contains explicit full-content all-chapter adjudication provenance."
        title = "ChapterFlow 140-book full-content content-design evaluation"
    meta = dict(_mapping(report.get("meta")))
    meta.update({
        "title": title,
        "evaluation_mode": evaluation_mode,
        "books": len(books),
        "chapters": sum(_nonnegative_int(book.get("chapters"), f"{book.get('id')}.chapters") for book in books),
        "words": sum(_nonnegative_int(book.get("words"), f"{book.get('id')}.words") for book in books),
        "subcriteria": sum(len(_sequence(book.get("subcriteria"))) for book in books),
        "qa_findings": sum(len(_sequence(book.get("qa"))) for book in books),
        "profile_counts": dict(sorted(profile_counts.items())),
        "gate_counts": gate_counts,
        "component_totals": component_totals,
        "evaluation_method_counts": {
            "full_content_blind_dual_rater_adjudication": full_count,
            "legacy_screening_or_unprovenanced": legacy_count,
        },
        "full_content_evaluation_count": full_count,
        "method_warning": warning,
    })
    report["meta"] = meta


def _strip_allowed_non_target_changes(book: Mapping[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(dict(book))
    result.pop("rank", None)
    result.pop("remediation", None)
    return result


def _csv_bytes(fieldnames: Sequence[str], rows: Sequence[Mapping[str, Any]]) -> bytes:
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=list(fieldnames), extrasaction="ignore", lineterminator="\r\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: row.get(key, "") for key in fieldnames})
    return stream.getvalue().encode("utf-8")


def _download_header(record: Mapping[str, Any], name: str) -> list[str]:
    encoded = record.get("base64")
    if not isinstance(encoded, str):
        raise EvaluationError(f"embedded download {name} does not contain base64 data")
    try:
        raw = base64.b64decode(encoded, validate=True).decode("utf-8-sig")
        header = next(csv.reader(io.StringIO(raw)))
    except (ValueError, UnicodeDecodeError, csv.Error, StopIteration) as exc:
        raise EvaluationError(f"cannot read the existing {name} header") from exc
    if not header or len(set(header)) != len(header):
        raise EvaluationError(f"embedded download {name} has an invalid CSV header")
    return header


def _scorecard(report: Mapping[str, Any], header: Sequence[str]) -> bytes:
    names = [str(item) for item in _sequence(report.get("domain_names"))]
    rows = []
    for book in _sequence(report.get("books")):
        item = _mapping(book)
        gates = _mapping(item.get("gates"))
        row = {
            "title": item.get("title"), "author": item.get("author"), "chapters": item.get("chapters"),
            "words": item.get("words"), "profile": item.get("profile"), "target_screening_score": item.get("target_screening_score", ""),
            "overall": item.get("score"), "confidence": item.get("confidence"), "technical_gate": gates.get("technical"),
            "epistemic_gate": gates.get("epistemic"), "ethics_gate": gates.get("ethics"),
            "external_accuracy": gates.get("external_accuracy"), "gate_note": gates.get("note"), "rank": item.get("rank"),
        }
        row.update({name: _mapping(item.get("domains")).get(name, "") for name in names})
        rows.append(row)
    return _csv_bytes(header, rows)


def _diagnostics(report: Mapping[str, Any], header: Sequence[str]) -> bytes:
    rows = []
    for book in sorted((_mapping(item) for item in _sequence(report.get("books"))), key=lambda item: str(item.get("id") or "")):
        row = dict(_mapping(book.get("diagnostics_full")))
        row.update({
            "file": book.get("file"), "book_id": book.get("id"), "title": book.get("title"), "author": book.get("author"),
            "categories": "|".join(str(item) for item in _sequence(book.get("categories"))),
            "tags": "|".join(str(item) for item in _sequence(book.get("tags"))),
            "chapters": book.get("chapters"), "total_words": book.get("words"),
        })
        rows.append(row)
    return _csv_bytes(header, rows)


def _weighted_points(report: Mapping[str, Any], header: Sequence[str]) -> bytes:
    weights = _mapping(report.get("domain_weights"))
    rows = []
    for book in _sequence(report.get("books")):
        item = _mapping(book)
        for domain in _sequence(report.get("domain_names")):
            name = str(domain)
            rows.append({
                "title": item.get("title"), "domain": name, "weight": weights.get(name),
                "domain_score_0_4": _mapping(item.get("domains")).get(name),
                "weighted_points": _mapping(item.get("weighted_points")).get(name),
            })
    return _csv_bytes(header, rows)


def _subcriteria(report: Mapping[str, Any], header: Sequence[str]) -> bytes:
    weights = _mapping(report.get("domain_weights"))
    rows = []
    for book in sorted((_mapping(item) for item in _sequence(report.get("books"))), key=lambda item: str(item.get("title") or "").casefold()):
        for raw in _sequence(book.get("subcriteria")):
            item = _mapping(raw)
            rows.append({
                "title": book.get("title"), "domain": item.get("domain"), "weight": weights.get(str(item.get("domain"))),
                "subcriterion": item.get("subcriterion"), "rating": item.get("rating"), "evidence_proxy": item.get("evidence_proxy", ""),
            })
    return _csv_bytes(header, rows)


def _chapter_evidence(report: Mapping[str, Any], header: Sequence[str]) -> bytes:
    rows = []
    for book in _sequence(report.get("books")):
        item = _mapping(book)
        for raw in _sequence(item.get("chapter_evidence")):
            chapter = _mapping(raw)
            rows.append({
                "rank": item.get("rank"), "book": item.get("title"), "book_score": item.get("score"),
                "chapter_number": chapter.get("number"), "chapter_title": chapter.get("title"), "hook": chapter.get("hook"),
                "counterintuition": chapter.get("counterintuition"), "key_takeaway": chapter.get("takeaway"),
                "try_this_now": chapter.get("try"), "core_skill": chapter.get("coreSkill") or chapter.get("core_skill"),
                "twenty_four_hour_challenge": chapter.get("challenge"),
            })
    return _csv_bytes(header, rows)


def _qa_findings(report: Mapping[str, Any], header: Sequence[str]) -> bytes:
    rows = [
        {"book": _mapping(book).get("title"), "finding": finding}
        for book in _sequence(report.get("books"))
        for finding in _sequence(_mapping(book).get("qa"))
    ]
    return _csv_bytes(header, rows)


def _summary_markdown(report: Mapping[str, Any]) -> bytes:
    meta = _mapping(report.get("meta"))
    books = [_mapping(item) for item in _sequence(report.get("books"))]
    top = books[:25]
    method_counts = _mapping(meta.get("evaluation_method_counts"))
    legacy_count = _nonnegative_int(method_counts.get("legacy_screening_or_unprovenanced", 0), "legacy method count")
    heading = "# ChapterFlow 140-Book Full-Content Evaluation" if legacy_count == 0 else "# ChapterFlow 140-Book Mixed-Method Evaluation"
    lines = [
        heading, "", "## Scope and method", "",
        f"- {meta.get('books', 0):,} books", f"- {meta.get('chapters', 0):,} chapters analyzed",
        f"- {meta.get('words', 0):,} approximate reader-facing words",
        f"- {meta.get('full_content_evaluation_count', 0):,} books have explicit full-content blind dual-rater adjudication provenance",
        f"- {meta.get('method_warning', '')}", "", "## Top 25", "",
        "| Rank | Book | Score | Gates | Confidence | Method |", "|---:|---|---:|---|---|---|",
    ]
    for book in top:
        gates = _mapping(book.get("gates"))
        method = "Full adjudication" if _has_valid_full_provenance(book) else "Legacy screening"
        title = str(book.get("title") or "").replace("|", "\\|")
        lines.append(
            f"| {book.get('rank')} | {title} | {_finite_number(book.get('score'), 'summary score'):.2f} | "
            f"Epi {_display_status(gates.get('epistemic'))}; Ethics {_display_status(gates.get('ethics'))} | "
            f"{book.get('confidence', '')} | {method} |"
        )
    lines.extend(["", "## Domain averages", "", "| Domain | Mean score (0–4) |", "|---|---:|"])
    for domain in _sequence(report.get("domain_names")):
        name = str(domain)
        values = [_finite_number(_mapping(book.get("domains")).get(name), f"{name} score") for book in books]
        safe_name = name.replace("|", "\\|")
        lines.append(f"| {safe_name} | {sum(values) / len(values):.3f} |")
    lines.extend(["", "## Gate totals", ""])
    for gate, counts in _mapping(meta.get("gate_counts")).items():
        rendered = ", ".join(f"{status}: {count}" for status, count in _mapping(counts).items())
        lines.append(f"- {gate}: {rendered}")
    lines.extend(["", "Scores are evaluation outputs, not reader-outcome measurements. External accuracy remains unassessed unless a separately authorized verification establishes otherwise.", ""])
    return "\n".join(lines).encode("utf-8")


def _refresh_downloads(
    downloads: Mapping[str, Any],
    report: Mapping[str, Any],
    companion_bytes: Mapping[str, bytes],
) -> dict[str, Any]:
    result = copy.deepcopy(dict(downloads))
    for name in DOWNLOAD_EXPORTS:
        record = _mapping(result.get(name))
        if not record:
            raise EvaluationError(f"HTML source-downloads is missing {name}")
        if name.endswith(".csv"):
            header = _download_header(record, name)
            generators = {
                "ChapterFlow_140_Scorecard.csv": _scorecard,
                "ChapterFlow_140_Diagnostics.csv": _diagnostics,
                "ChapterFlow_140_Weighted_Points.csv": _weighted_points,
                "ChapterFlow_140_Subcriterion_Audit.csv": _subcriteria,
                "ChapterFlow_140_Chapter_Evidence.csv": _chapter_evidence,
                "ChapterFlow_140_QA_Findings.csv": _qa_findings,
            }
            payload = generators[name](report, header)
        else:
            payload = _summary_markdown(report)
        updated = dict(record)
        updated.update({"bytes": len(payload), "sha256": _sha256(payload), "base64": base64.b64encode(payload).decode("ascii")})
        result[name] = updated
    for name, payload in companion_bytes.items():
        record = _mapping(result.get(name))
        if not record:
            raise EvaluationError(f"HTML source-downloads is missing companion metadata for {name}")
        updated = dict(record)
        updated.update({"bytes": len(payload), "sha256": _sha256(payload)})
        result[name] = updated
    return result


def _validate_generated_html(
    html: str,
    report: Mapping[str, Any],
    companion_bytes: Mapping[str, bytes],
) -> None:
    embedded_report, downloads, _ = _read_html_payloads(html)
    if embedded_report != report:
        raise EvaluationError("generated HTML report-data does not match the external report JSON")
    for name, payload in companion_bytes.items():
        record = _mapping(downloads.get(name))
        if record.get("bytes") != len(payload) or record.get("sha256") != _sha256(payload):
            raise EvaluationError(f"generated HTML companion metadata is stale for {name}")
    for name in DOWNLOAD_EXPORTS:
        record = _mapping(downloads.get(name))
        try:
            payload = base64.b64decode(str(record.get("base64") or ""), validate=True)
        except ValueError as exc:
            raise EvaluationError(f"generated HTML has invalid base64 for {name}") from exc
        if record.get("bytes") != len(payload) or record.get("sha256") != _sha256(payload):
            raise EvaluationError(f"generated HTML export metadata is stale for {name}")


def _write_staged(path: Path, payload: bytes, mode: int) -> Path:
    staged = path.with_name(f".{path.name}.chapterflow-stage-{uuid.uuid4().hex}")
    descriptor = os.open(staged, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
    except Exception:
        try:
            staged.unlink()
        except OSError:
            pass
        raise
    return staged


def _transactional_replace(payloads: Mapping[Path, bytes], *, html_names: set[str]) -> None:
    staged: dict[Path, Path] = {}
    backups: dict[Path, Path | None] = {}
    ordered = sorted(payloads, key=lambda path: (path.name in html_names, str(path)))
    committed = False
    try:
        for path in ordered:
            if path.exists() and path.is_symlink():
                raise EvaluationError(f"refusing to replace symlink: {path}")
            mode = stat.S_IMODE(path.stat().st_mode) if path.exists() else 0o644
            staged[path] = _write_staged(path, payloads[path], mode)
        for path in ordered:
            backup: Path | None = None
            if path.exists():
                backup = path.with_name(f".{path.name}.chapterflow-backup-{uuid.uuid4().hex}")
                os.replace(path, backup)
            backups[path] = backup
            os.replace(staged[path], path)
        for path, expected in payloads.items():
            if path.read_bytes() != expected:
                raise OSError(f"post-commit byte verification failed for {path}")
        committed = True
    except Exception as exc:
        rollback_errors = []
        for path in reversed(ordered):
            backup = backups.get(path)
            try:
                if backup is not None and backup.exists():
                    os.replace(backup, path)
                elif path in backups and path.exists():
                    path.unlink()
            except OSError as rollback_exc:
                rollback_errors.append(f"{path}: {rollback_exc}")
        if rollback_errors:
            preserved = [str(path) for path in backups.values() if path is not None and path.exists()]
            raise OSError(
                f"transaction failed ({exc}); rollback was incomplete: {' | '.join(rollback_errors)}; "
                f"preserved backups: {preserved}"
            ) from exc
        raise
    finally:
        for staged_path in staged.values():
            try:
                staged_path.unlink()
            except FileNotFoundError:
                pass
        for backup in backups.values():
            if committed and backup is not None:
                try:
                    backup.unlink()
                except FileNotFoundError:
                    pass


def update_portfolio_snapshot(
    *,
    report_data_path: Path,
    report_html_path: Path,
    book_update_path: Path,
    remediation_json_path: Path,
    remediation_markdown_path: Path,
    receipt_path: Path,
    mirror_dirs: Sequence[Path] = (),
    dry_run: bool = False,
) -> dict[str, Any]:
    if not mirror_dirs:
        raise EvaluationError("at least one --mirror-dir is required for a portfolio refresh")
    output_paths = [report_data_path, remediation_json_path, remediation_markdown_path, report_html_path]
    if any(path.is_symlink() for path in output_paths):
        raise EvaluationError("snapshot outputs must not be symlinks")
    resolved_outputs = [path.resolve(strict=True) for path in output_paths]
    if len(set(resolved_outputs)) != len(resolved_outputs):
        raise EvaluationError("snapshot output paths must be distinct")
    if len({path.parent for path in resolved_outputs}) != 1:
        raise EvaluationError("report HTML, data, and remediation files must share one snapshot directory")
    for path in resolved_outputs:
        if path.is_symlink() or not path.is_file():
            raise EvaluationError(f"snapshot output must be a regular non-symlink file: {path}")
    if receipt_path.is_symlink():
        raise EvaluationError("portfolio update receipt must not be a symlink")
    receipt_parent = receipt_path.parent.resolve(strict=True)
    if not receipt_parent.is_dir() or receipt_parent.is_symlink():
        raise EvaluationError("portfolio update receipt parent must be an existing non-symlink directory")
    receipt_resolved = receipt_parent / receipt_path.name
    if receipt_resolved in resolved_outputs:
        raise EvaluationError("portfolio update receipt path must be distinct from the four primary outputs")
    if receipt_resolved.exists() and (receipt_resolved.is_symlink() or not receipt_resolved.is_file()):
        raise EvaluationError("existing portfolio update receipt must be a regular non-symlink file")
    if any(path.is_symlink() for path in mirror_dirs):
        raise EvaluationError("mirror directories must not be symlinks")
    mirror_roots = [path.resolve(strict=True) for path in mirror_dirs]
    if any(not path.is_dir() or path.is_symlink() for path in mirror_roots):
        raise EvaluationError("every mirror directory must already exist and must not be a symlink")
    if len(set(mirror_roots)) != len(mirror_roots) or any(path == resolved_outputs[0].parent for path in mirror_roots):
        raise EvaluationError("mirror directories must be unique and distinct from the primary snapshot directory")
    for root in mirror_roots:
        for primary in resolved_outputs:
            destination = root / primary.name
            if not destination.exists() or destination.is_symlink() or not destination.is_file():
                raise EvaluationError(f"mirror is missing a regular current snapshot file: {destination}")
            if destination.read_bytes() != primary.read_bytes():
                raise EvaluationError(f"mirror is stale or does not match the primary snapshot: {destination}")

    baseline_report_data_sha256 = _sha256(resolved_outputs[0].read_bytes())
    report = read_json(resolved_outputs[0])
    envelope = read_json(book_update_path)
    if not isinstance(report, Mapping) or not isinstance(envelope, Mapping):
        raise EvaluationError("report data and book update must be JSON objects")
    original_report = copy.deepcopy(dict(report))
    names, weights = _validate_portfolio(original_report)
    target_id, replacement = _validate_update(envelope, names)
    old_total, old_target_count = _condition_snapshot(original_report, target_id)

    original_books = {_mapping(item).get("id"): copy.deepcopy(dict(_mapping(item))) for item in _sequence(original_report.get("books"))}
    matches = [index for index, item in enumerate(_sequence(original_report.get("books"))) if _mapping(item).get("id") == target_id]
    if len(matches) != 1:
        raise EvaluationError(f"expected exactly one target book {target_id!r}; found {len(matches)}")
    updated = copy.deepcopy(original_report)
    books = [dict(_mapping(item)) for item in _sequence(updated.get("books"))]
    _recompute_target(replacement, names, weights)
    books[matches[0]] = replacement
    _rerank(books)
    updated["books"] = books
    _recompute_meta(updated)

    for book in books:
        book_id = str(book.get("id"))
        if book_id != target_id and _strip_allowed_non_target_changes(book) != _strip_allowed_non_target_changes(original_books[book_id]):
            raise EvaluationError(f"non-target book changed outside rank/remediation: {book_id}")

    pack = remediation_pack(updated)
    new_summary = _mapping(pack.get("summary"))
    new_total = _nonnegative_int(_mapping(new_summary.get("conditions")).get("total"), "new remediation total")
    new_target = next(_mapping(item) for item in _sequence(pack.get("books")) if _mapping(item).get("book_id") == target_id)
    new_target_count = _nonnegative_int(_mapping(new_target.get("remediation")).get("condition_count"), "new target condition count")
    if new_total != old_total - old_target_count + new_target_count:
        raise EvaluationError("remediation condition delta does not reconcile after target replacement")
    _validate_portfolio(updated)

    report_bytes = _json_bytes(updated)
    remediation_json_bytes = _json_bytes(pack)
    remediation_markdown_bytes = markdown_pack(pack).encode("utf-8")
    # resolved_outputs order is data, remediation JSON, remediation Markdown, HTML.
    html_source = resolved_outputs[3].read_text(encoding="utf-8")
    embedded_report, downloads, spans = _read_html_payloads(html_source)
    if embedded_report != original_report:
        raise EvaluationError("current HTML #report-data does not match the current external report data")
    companion_bytes = {
        resolved_outputs[0].name: report_bytes,
        resolved_outputs[1].name: remediation_json_bytes,
        resolved_outputs[2].name: remediation_markdown_bytes,
    }
    refreshed_downloads = _refresh_downloads(downloads, updated, companion_bytes)
    refreshed_html = _replace_script_payloads(html_source, spans, updated, refreshed_downloads)
    refreshed_html = _refresh_visible_method_copy(refreshed_html, updated)
    html_bytes = refreshed_html.encode("utf-8")
    _validate_generated_html(html_bytes.decode("utf-8"), updated, companion_bytes)

    # Invoke the independent full validator against materialized candidate files.
    # A receipt may never claim validator success based only on this updater's
    # internal checks.
    with tempfile.TemporaryDirectory(prefix="chapterflow-portfolio-full-validator-") as validator_temp:
        validator_root = Path(validator_temp)
        validator_data = validator_root / resolved_outputs[0].name
        validator_html = validator_root / resolved_outputs[3].name
        validator_data.write_bytes(report_bytes)
        validator_html.write_bytes(html_bytes)
        full_validator_errors = full_report_validator(validator_html, validator_data)
    if full_validator_errors:
        raise EvaluationError(
            "complete validate_report.py validation failed: " + " | ".join(full_validator_errors)
        )

    primary_payloads = {
        resolved_outputs[0]: report_bytes,
        resolved_outputs[1]: remediation_json_bytes,
        resolved_outputs[2]: remediation_markdown_bytes,
        resolved_outputs[3]: html_bytes,
    }
    updated_ids = [str(_mapping(item).get("id") or "") for item in _sequence(updated.get("books"))]
    transaction_id = f"portfolio-update-{uuid.uuid4().hex}"
    root_inventory = []
    for kind, root in [("primary", resolved_outputs[0].parent), *(("mirror", item) for item in mirror_roots)]:
        root_inventory.append(
            {
                "kind": kind,
                "root": str(root),
                "outputs": [
                    {
                        "name": path.name,
                        "path": str(root / path.name),
                        "sha256": _sha256(payload),
                    }
                    for path, payload in sorted(primary_payloads.items(), key=lambda item: item[0].name)
                ],
            }
        )
    receipt = {
        "schema_version": "1.1.0",
        "generator": "chapterflow-book-evaluator/scripts/update_portfolio_report.py",
        "transaction_id": transaction_id,
        "status": "valid",
        "book_id": target_id,
        "source_hash": str(envelope["source_hash"]),
        "baseline_report_data_sha256": baseline_report_data_sha256,
        "book_count": len(updated_ids),
        "unique_book_count": len(set(updated_ids)),
        "non_target_preserved": True,
        "remediation_valid": True,
        "source_downloads_valid": True,
        "full_validator_status": "valid",
        "full_validator": {
            "module": "chapterflow-book-evaluator/scripts/validate_report.py",
            "function": "validate_report",
            "status": "valid",
            "error_count": 0,
            "candidate_report_data_sha256": _sha256(report_bytes),
            "candidate_report_html_sha256": _sha256(html_bytes),
        },
        "roots": root_inventory,
    }
    receipt_schema = read_json(RECEIPT_SCHEMA)
    if not isinstance(receipt_schema, Mapping):
        raise EvaluationError("portfolio update receipt schema must be a JSON object")
    receipt_errors = _jsonschema_errors(receipt, receipt_schema)
    if receipt_errors:
        raise EvaluationError("invalid portfolio update receipt: " + " | ".join(receipt_errors))
    receipt_bytes = _json_bytes(receipt)
    all_payloads = dict(primary_payloads)
    for root in mirror_roots:
        for path, payload in primary_payloads.items():
            destination = root / path.name
            if destination.resolve(strict=False) in all_payloads:
                raise EvaluationError(f"duplicate mirror destination: {destination}")
            all_payloads[destination] = payload
    if not dry_run:
        if receipt_resolved in all_payloads:
            raise EvaluationError("portfolio update receipt collides with a snapshot or mirror output")
        all_payloads[receipt_resolved] = receipt_bytes
        _transactional_replace(all_payloads, html_names={resolved_outputs[3].name})

    return {
        "book_id": target_id,
        "score": replacement["score"],
        "rank": replacement["rank"],
        "source_hash": envelope["source_hash"],
        "old_condition_count": old_target_count,
        "new_condition_count": new_target_count,
        "portfolio_condition_count": new_total,
        "full_content_evaluation_count": _mapping(updated.get("meta")).get("full_content_evaluation_count"),
        "baseline_report_data_sha256": baseline_report_data_sha256,
        "receipt_path": str(receipt_resolved),
        "receipt_sha256": _sha256(receipt_bytes),
        "receipt_written": not dry_run,
        "transaction_id": transaction_id,
        "mirrors": [str(path) for path in mirror_roots],
        "dry_run": dry_run,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report-data", type=Path, required=True)
    parser.add_argument("--report-html", type=Path, required=True)
    parser.add_argument("--book-update", type=Path, required=True)
    parser.add_argument("--remediation-json", type=Path, required=True)
    parser.add_argument("--remediation-markdown", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True, help="Transactional portfolio update receipt JSON path")
    parser.add_argument("--mirror-dir", action="append", type=Path, required=True, help="Existing byte-identical mirror directory refreshed in the same transaction; repeatable and at least one required")
    parser.add_argument("--dry-run", action="store_true", help="Validate and build every output in memory without writing")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        summary = update_portfolio_snapshot(
            report_data_path=args.report_data,
            report_html_path=args.report_html,
            book_update_path=args.book_update,
            remediation_json_path=args.remediation_json,
            remediation_markdown_path=args.remediation_markdown,
            receipt_path=args.receipt,
            mirror_dirs=args.mirror_dir,
            dry_run=args.dry_run,
        )
    except (EvaluationError, OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"portfolio update error: {exc}")
        return 2
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
