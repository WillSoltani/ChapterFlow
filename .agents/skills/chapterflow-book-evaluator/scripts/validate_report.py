#!/usr/bin/env python3
"""Validate ChapterFlow report completeness, arithmetic, safety, and offline use."""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Mapping, Sequence
from urllib.parse import urlsplit

from render_report import (
    DOMAIN_CATALOG,
    GATE_LABELS,
    SAMPLE_WARNING,
    book_id,
    book_meta,
    book_title,
    is_sample_report,
    mapping,
    parse_rubric_markdown,
    sample_limited_text,
    sampling_metadata,
    selected_chapter_positions,
    sequence,
    text_value,
)
from validate_book_result import _jsonschema_errors


REQUIRED_SECTION_IDS = (
    "overview", "dashboard", "remediation", "comparison", "rubric", "books", "chapters",
    "qa", "agreement", "cross-book", "methods",
)
REMOTE_SCHEMES = {"http", "https", "ftp", "ws", "wss"}
NETWORK_JS_PATTERNS = (
    r"\bfetch\s*\(", r"\bXMLHttpRequest\b", r"\bWebSocket\s*\(",
    r"\bEventSource\s*\(", r"\bnavigator\.sendBeacon\s*\(",
)
UNSAFE_JS_PATTERNS = (
    r"\.innerHTML\b", r"\.outerHTML\b", r"\binsertAdjacentHTML\b",
    r"\bdocument\.write\s*\(", r"\beval\s*\(", r"\bnew\s+Function\s*\(",
)
SAMPLE_SCOPE_COLUMNS = {
    "evaluation_mode",
    "sample_source_chapter_count",
    "sample_selected_chapter_count",
    "sample_not_selected_chapter_count",
    "sample_selected_positions",
}


class AuditParser(HTMLParser):
    """Collect structural and resource facts without executing the document."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.local_links: list[str] = []
        self.external_resources: list[str] = []
        self.labels_for: list[str] = []
        self.controls_with_id: list[str] = []
        self.scripts: list[tuple[dict[str, str], str]] = []
        self.styles: list[str] = []
        self.visible_text: list[str] = []
        self.book_detail_count = 0
        self.remediation_book_count = 0
        self.remediation_prompt_count = 0
        self.chapter_fallback_count = 0
        self.noscript_count = 0
        self.main_count = 0
        self.skip_links = 0
        self.live_regions = 0
        self.headings: list[tuple[str, str | None]] = []
        self.book_scores: list[tuple[str, str]] = []
        self.domain_scores: list[tuple[str, str]] = []
        self._script_attrs: dict[str, str] | None = None
        self._script_parts: list[str] = []
        self._style_parts: list[str] | None = None
        self._noscript_depth = 0
        self._suppressed_text_depth = 0

    @staticmethod
    def _remote(value: str) -> bool:
        if value.startswith("//"):
            return True
        return urlsplit(value).scheme.casefold() in REMOTE_SCHEMES

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.casefold(): (value or "") for key, value in attrs}
        identifier = values.get("id")
        if identifier:
            self.ids.append(identifier)
        classes = set(values.get("class", "").split())
        if tag == "noscript":
            self.noscript_count += 1
            self._noscript_depth += 1
        if tag == "main":
            self.main_count += 1
        if "book-detail" in classes and self._noscript_depth == 0:
            self.book_detail_count += 1
        if "remediation-book" in classes and self._noscript_depth == 0:
            self.remediation_book_count += 1
        if "remediation-prompt" in classes and self._noscript_depth == 0:
            self.remediation_prompt_count += 1
        if "chapter-card" in classes and self._noscript_depth > 0:
            self.chapter_fallback_count += 1
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.headings.append((tag, identifier))
        if values.get("role") == "status" or values.get("aria-live") in {"polite", "assertive"}:
            self.live_regions += 1
        if tag == "label" and values.get("for"):
            self.labels_for.append(values["for"])
        if tag in {"input", "select", "textarea", "button"} and identifier:
            self.controls_with_id.append(identifier)
        if tag == "a":
            href = values.get("href", "")
            if href.startswith("#"):
                self.local_links.append(href[1:].split("?", 1)[0])
            if "skip-link" in classes and href == "#main-content":
                self.skip_links += 1
        resource_attributes = {
            "script": ("src",), "link": ("href",), "img": ("src", "srcset"),
            "iframe": ("src",), "object": ("data",), "embed": ("src",),
            "audio": ("src",), "video": ("src", "poster"), "source": ("src", "srcset"),
        }
        for attribute in resource_attributes.get(tag, ()):
            resource = values.get(attribute, "")
            if resource and (self._remote(resource) or (tag in {"script", "link"} and not resource.startswith(("#", "data:")))):
                self.external_resources.append(f"{tag}[{attribute}]={resource}")
        if tag == "script":
            self._script_attrs = values
            self._script_parts = []
            self._suppressed_text_depth += 1
        if tag == "style":
            self._style_parts = []
            self._suppressed_text_depth += 1
        if values.get("data-book-score"):
            self.book_scores.append((values["data-book-score"], values.get("data-score-value", "")))
        if values.get("data-domain-score"):
            self.domain_scores.append((values["data-domain-score"], values.get("data-score-value", "")))

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._script_attrs is not None:
            self.scripts.append((self._script_attrs, "".join(self._script_parts)))
            self._script_attrs = None
            self._script_parts = []
            self._suppressed_text_depth = max(0, self._suppressed_text_depth - 1)
        if tag == "style" and self._style_parts is not None:
            self.styles.append("".join(self._style_parts))
            self._style_parts = None
            self._suppressed_text_depth = max(0, self._suppressed_text_depth - 1)
        if tag == "noscript":
            self._noscript_depth = max(0, self._noscript_depth - 1)

    def handle_data(self, data: str) -> None:
        if self._script_attrs is not None:
            self._script_parts.append(data)
        elif self._style_parts is not None:
            self._style_parts.append(data)
        elif self._suppressed_text_depth == 0 and data.strip():
            self.visible_text.append(data.strip())


def strict_json_load(path: Path) -> Any:
    def reject_constant(value: str) -> None:
        raise ValueError(f"non-finite JSON number: {value}")

    with path.open("r", encoding="utf-8") as stream:
        return json.load(stream, parse_constant=reject_constant)


def close(left: float, right: float, tolerance: float = 1e-7) -> bool:
    return math.isfinite(left) and math.isfinite(right) and abs(left - right) <= tolerance


def number(value: Any) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return math.nan
    return result if math.isfinite(result) else math.nan


def validate_arithmetic(data: Mapping[str, Any], errors: list[str]) -> dict[str, float]:
    expected_scores: dict[str, float] = {}
    books = [mapping(item) for item in sequence(data.get("books"))]
    for book_index, book in enumerate(books):
        identifier = book_id(book, book_index)
        title = book_title(book)
        domains = mapping(book.get("domains"))
        missing_domains = [key for key in DOMAIN_CATALOG if key not in domains]
        extra_domains = [key for key in domains if key not in DOMAIN_CATALOG]
        if missing_domains:
            errors.append(f"{title}: missing domains: {', '.join(missing_domains)}")
        if extra_domains:
            errors.append(f"{title}: unexpected domains: {', '.join(extra_domains)}")
        weighted_total = 0.0
        subcriterion_count = 0
        for domain_key, definition in DOMAIN_CATALOG.items():
            domain = mapping(domains.get(domain_key))
            subcriteria = mapping(domain.get("subcriteria"))
            missing = [key for key in definition["subcriteria"] if key not in subcriteria]
            extra = [key for key in subcriteria if key not in definition["subcriteria"]]
            if missing:
                errors.append(f"{title}/{domain_key}: missing subcriteria: {', '.join(missing)}")
            if extra:
                errors.append(f"{title}/{domain_key}: unexpected subcriteria: {', '.join(extra)}")
            ratings = []
            for sub_key in definition["subcriteria"]:
                rating = number(mapping(subcriteria.get(sub_key)).get("rating"))
                if not math.isfinite(rating) or rating < 0 or rating > 4 or not close(rating * 2, round(rating * 2)):
                    errors.append(f"{title}/{domain_key}/{sub_key}: rating must be a 0.5 increment from 0 through 4")
                    continue
                ratings.append(rating)
                subcriterion_count += 1
            if len(ratings) != 4:
                continue
            calculated_domain = sum(ratings) / 4
            stored_domain = number(domain.get("domain_score"))
            if not close(stored_domain, calculated_domain):
                errors.append(f"{title}/{domain_key}: domain_score {domain.get('domain_score')!r} != calculated {calculated_domain}")
            calculated_weighted = calculated_domain / 4 * float(definition["weight"])
            stored_weighted = number(domain.get("weighted_points"))
            if not close(stored_weighted, calculated_weighted):
                errors.append(f"{title}/{domain_key}: weighted_points {domain.get('weighted_points')!r} != calculated {calculated_weighted}")
            weighted_total += calculated_weighted
        if subcriterion_count != 36:
            errors.append(f"{title}: expected 36 valid subcriterion ratings, found {subcriterion_count}")
        stored_overall = number(book.get("overall_score"))
        if subcriterion_count == 36 and not close(stored_overall, weighted_total):
            errors.append(f"{title}: overall_score {book.get('overall_score')!r} != calculated {weighted_total}")
        expected_scores[identifier] = weighted_total
        gates = mapping(book.get("gates"))
        missing_gates = [key for key in GATE_LABELS if key not in gates]
        if missing_gates:
            errors.append(f"{title}: missing gates: {', '.join(missing_gates)}")
    return expected_scores


def validate_csv_downloads(data: Mapping[str, Any], errors: list[str]) -> None:
    downloads = mapping(data.get("csv_downloads"))
    required = {
        "scorecard.csv", "domain-scores.csv", "subcriteria.csv", "chapter-evidence.csv",
        "gates.csv", "technical-findings.csv", "rater-agreement.csv", "calibration-log.csv",
        "chapter-domain-index.csv", "chapter-issue-index.csv",
    }
    missing = sorted(required - set(downloads))
    if missing:
        errors.append(f"embedded CSV downloads missing: {', '.join(missing)}")
    for filename, raw in downloads.items():
        content = raw if isinstance(raw, str) else mapping(raw).get("content")
        if not isinstance(content, str):
            errors.append(f"csv_downloads.{filename} must be CSV text")
            continue
        try:
            rows = list(csv.reader(io.StringIO(content, newline="")))
        except csv.Error as error:
            errors.append(f"csv_downloads.{filename} is not valid CSV: {error}")
            continue
        if not rows or not rows[0] or not any(cell.strip() for cell in rows[0]):
            errors.append(f"csv_downloads.{filename} has no header")
        elif any(len(row) != len(rows[0]) for row in rows[1:]):
            errors.append(f"csv_downloads.{filename} has inconsistent row widths")


def validate_embedded_json(raw_html: str, source: Mapping[str, Any], parser: AuditParser, errors: list[str]) -> Mapping[str, Any] | None:
    candidates = [content for attrs, content in parser.scripts if attrs.get("id") == "chapterflow-report-data" and attrs.get("type") == "application/json"]
    if len(candidates) != 1:
        errors.append(f"expected exactly one inert #chapterflow-report-data script, found {len(candidates)}")
        return None
    content = candidates[0]
    try:
        embedded = json.loads(content)
    except (json.JSONDecodeError, ValueError) as error:
        errors.append(f"embedded report JSON does not parse: {error}")
        return None
    if embedded != source:
        errors.append("embedded report data is not semantically identical to report-data.json")
    match = re.search(
        r'<script\s+type="application/json"\s+id="chapterflow-report-data">(.*?)</script>',
        raw_html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if not match:
        errors.append("could not locate the canonical embedded JSON container with deterministic attributes")
    else:
        raw_payload = match.group(1)
        unsafe = [character for character in ("<", ">", "&", "\u2028", "\u2029") if character in raw_payload]
        if unsafe:
            errors.append("embedded JSON contains raw HTML/script parsing characters: " + ", ".join(repr(value) for value in unsafe))
        if re.search(r"</script", raw_payload, flags=re.IGNORECASE):
            errors.append("embedded JSON contains a raw closing script sequence")
    return embedded


def validate_structure(data: Mapping[str, Any], parser: AuditParser, errors: list[str]) -> None:
    counts = Counter(parser.ids)
    duplicates = sorted(identifier for identifier, count in counts.items() if count > 1)
    if duplicates:
        errors.append("duplicate HTML ids: " + ", ".join(duplicates))
    missing_sections = [identifier for identifier in REQUIRED_SECTION_IDS if identifier not in counts]
    if missing_sections:
        errors.append("missing report sections: " + ", ".join(missing_sections))
    if parser.main_count != 1 or "main-content" not in counts:
        errors.append("report must contain exactly one main landmark with id=main-content")
    if parser.skip_links != 1:
        errors.append("report must contain one skip link targeting #main-content")
    if not any(tag == "h1" for tag, _ in parser.headings) or len([tag for tag, _ in parser.headings if tag == "h1"]) != 1:
        errors.append("report must contain exactly one h1")
    unresolved_targets = sorted({target for target in parser.local_links if target and target not in counts})
    if unresolved_targets:
        errors.append("local links target missing ids: " + ", ".join(unresolved_targets))
    missing_label_targets = sorted({target for target in parser.labels_for if target not in counts})
    if missing_label_targets:
        errors.append("labels target missing controls: " + ", ".join(missing_label_targets))
    if parser.live_regions < 2:
        errors.append("interactive result counts need live status regions")
    if parser.noscript_count < 2:
        errors.append("report lacks adequate no-JavaScript fallback content")
    books = [mapping(item) for item in sequence(data.get("books"))]
    if parser.book_detail_count < len(books):
        errors.append(f"static book detail fallback incomplete: expected {len(books)}, found {parser.book_detail_count}")
    chapter_count = sum(len(sequence(book.get("chapter_evidence"))) for book in books)
    if parser.chapter_fallback_count < chapter_count:
        errors.append(f"static chapter fallback incomplete: expected {chapter_count}, found {parser.chapter_fallback_count}")
    visible = " ".join(parser.visible_text)
    for book_index, book in enumerate(books):
        if book_title(book) not in visible:
            errors.append(f"book title absent from static report: {book_title(book)!r}")
        identifier = book_id(book, book_index)
        if not any(item == identifier for item, _ in parser.book_scores):
            errors.append(f"book lacks static score/detail marker: {identifier}")
        for chapter in sequence(book.get("chapter_evidence")):
            chapter_title = str(mapping(chapter).get("title") or mapping(chapter).get("chapter_id") or "Untitled")
            if chapter_title not in visible:
                errors.append(f"chapter title absent from static report: {book_title(book)} / {chapter_title}")


def validate_content_coverage(data: Mapping[str, Any], parser: AuditParser, errors: list[str]) -> None:
    visible = " ".join(parser.visible_text)
    sample_mode = is_sample_report(data)
    markdown = str(mapping(data.get("rubric")).get("markdown") or "")
    parsed = parse_rubric_markdown(markdown)
    parsed_domains = mapping(parsed.get("domains"))
    for domain_key, definition in DOMAIN_CATALOG.items():
        domain = mapping(parsed_domains.get(domain_key))
        domain_name = str(domain.get("name") or definition["name"])
        if domain_name not in visible:
            errors.append(f"rubric domain absent from static report: {domain_name}")
        parsed_subcriteria = mapping(domain.get("subcriteria"))
        for sub_key, sub_name in definition["subcriteria"].items():
            criterion = mapping(parsed_subcriteria.get(sub_key))
            name = str(criterion.get("name") or sub_name)
            if name not in visible:
                errors.append(f"rubric subcriterion absent from static report: {name}")
            anchors = mapping(criterion.get("anchors"))
            if len({int(key) for key in anchors if str(key).isdigit() and 0 <= int(key) <= 4}) != 5:
                errors.append(f"rubric subcriterion lacks all 0–4 anchors in canonical reference: {sub_key}")
            for rating in range(5):
                anchor = str(anchors.get(rating, anchors.get(str(rating), "")))
                if sample_mode:
                    anchor = sample_limited_text(anchor)
                if anchor and anchor not in visible:
                    errors.append(f"rubric anchor absent from static report: {sub_key}/{rating}")
    for label in GATE_LABELS.values():
        if label not in visible:
            errors.append(f"hard gate absent from static report: {label}")
    for book in sequence(data.get("books")):
        record = mapping(book)
        for raw in sequence(mapping(record.get("rater_agreement")).get("disagreements")):
            rationale = str(mapping(raw).get("adjudication_rationale") or "")
            if rationale and rationale not in visible:
                errors.append(f"adjudication rationale absent from static report: {book_title(record)}")
        for raw in sequence(record.get("calibration_changes")):
            change = mapping(raw)
            text = str(change.get("reason") or change.get("rationale") or "")
            if text and text not in visible:
                errors.append(f"calibration rationale absent from static report: {book_title(record)}")


def validate_remediation(data: Mapping[str, Any], parser: AuditParser, errors: list[str]) -> None:
    books = [mapping(item) for item in sequence(data.get("books"))]
    expected_totals = Counter()
    for book_index, book in enumerate(books):
        expected_ids: list[str] = []
        score = float(book.get("overall_score") or 0)
        if score < 80:
            expected_ids.append("O-001")
            expected_totals["overall"] += 1
        domains = mapping(book.get("domains"))
        for domain_index, (domain_key, definition) in enumerate(DOMAIN_CATALOG.items(), 1):
            domain = mapping(domains.get(domain_key))
            domain_value = float(domain.get("domain_score") or 0)
            if domain_value < 3.2:
                expected_ids.append(f"D-{domain_index:02d}")
                expected_totals["domain"] += 1
            subcriteria = mapping(domain.get("subcriteria"))
            for sub_index, subcriterion_key in enumerate(definition["subcriteria"], 1):
                rating = float(mapping(subcriteria.get(subcriterion_key)).get("rating") or 0)
                if rating < 3.2:
                    expected_ids.append(f"S-{domain_index:02d}-{sub_index:02d}")
                    expected_totals["subcriterion"] += 1
        remediation = mapping(book.get("remediation"))
        conditions = [mapping(item) for item in sequence(remediation.get("conditions"))]
        actual_ids = [str(item.get("id") or "") for item in conditions]
        label = book_title(book)
        if actual_ids != list(dict.fromkeys(actual_ids)):
            errors.append(f"remediation condition ids are duplicated for {label}")
        if set(actual_ids) != set(expected_ids) or len(actual_ids) != len(expected_ids):
            errors.append(f"remediation condition ledger mismatch for {label}: expected {len(expected_ids)}, found {len(actual_ids)}")
        stored_condition_count = remediation.get("condition_count")
        if not isinstance(stored_condition_count, int) or isinstance(stored_condition_count, bool) or stored_condition_count != len(expected_ids):
            errors.append(f"remediation condition_count mismatch for {label}")
        prompt = str(remediation.get("prompt_markdown") or "")
        if len(prompt.strip()) < 500:
            errors.append(f"remediation prompt is missing or incomplete for {label}")
        for condition_id in expected_ids:
            if condition_id not in prompt:
                errors.append(f"remediation prompt omits {condition_id} for {label}")
        mapped_ids = {
            str(condition_id)
            for stream in sequence(remediation.get("workstreams"))
            for condition_id in sequence(mapping(stream).get("condition_ids"))
        }
        expected_domain_ids = {condition_id for condition_id in expected_ids if condition_id != "O-001"}
        if mapped_ids != expected_domain_ids:
            errors.append(f"remediation workstream mapping mismatch for {label}")
        if any(str(item.get("evidence_class")) == "score-only" for item in conditions) and "No chapter-level rationale was supplied" not in prompt:
            errors.append(f"remediation prompt lacks score-only evidence warning for {label}")
        if "Do not edit scores" not in prompt:
            errors.append(f"remediation prompt lacks score-artifact prohibition for {label}")
        expected_mode = str(mapping(data.get("run")).get("evaluation_mode") or mapping(data.get("meta")).get("evaluation_mode") or "Not supplied")
        if str(remediation.get("evaluation_mode") or "") != expected_mode or f"Evaluation mode: {expected_mode}" not in prompt:
            errors.append(f"remediation prompt loses the exact evaluation mode for {label}")
        expected_gap = round(max(0.0, 80.0 - score), 4)
        if float(remediation.get("minimum_overall_lift") or 0) != expected_gap:
            errors.append(f"remediation arithmetic gap is not deterministically rounded for {label}")
        if "**Pass** —" in prompt:
            errors.append(f"remediation prompt attaches a rationale to a passing gate for {label}")
        streams = [mapping(stream) for stream in sequence(remediation.get("workstreams"))]
        for stream in streams:
            for field in ("evidence", "unknowns", "chapter_targets", "supporting_signals", "instructions"):
                if field not in stream:
                    errors.append(f"remediation workstream lacks {field} for {label}")
            if sequence(stream.get("qa_findings")) and str(stream.get("priority")) == "P3":
                errors.append(f"QA finding failed to promote remediation workstream for {label}")
        condition_evidence = Counter(str(item.get("evidence_class") or "") for item in conditions)
        stored_condition_evidence = mapping(remediation.get("condition_evidence_counts"))
        for evidence_class in ("direct", "contextual", "score-only"):
            if int(stored_condition_evidence.get(evidence_class) or 0) != condition_evidence[evidence_class]:
                errors.append(f"condition evidence count mismatch for {label}: {evidence_class}")
        packet_counts = mapping(remediation.get("evidence_packet_counts"))
        if int(packet_counts.get("direct_items") or 0) != len(sequence(remediation.get("direct_evidence"))):
            errors.append(f"direct evidence packet count mismatch for {label}")
        if int(packet_counts.get("contextual_signals") or 0) != len(sequence(remediation.get("contextual_diagnostics"))):
            errors.append(f"contextual evidence packet count mismatch for {label}")
        if is_sample_report(data) and "experimental selected-chapter" not in prompt.casefold():
            errors.append(f"sample remediation prompt lacks selected-chapter boundary for {label}")
    summary = mapping(data.get("remediation_summary"))
    summary_counts = mapping(summary.get("conditions"))
    for scope in ("overall", "domain", "subcriterion"):
        if int(summary_counts.get(scope) or 0) != expected_totals[scope]:
            errors.append(f"remediation summary {scope} count mismatch")
    if int(summary_counts.get("total") or 0) != sum(expected_totals.values()):
        errors.append("remediation summary total count mismatch")
    if parser.remediation_book_count != len(books):
        errors.append(f"static remediation book coverage incomplete: expected {len(books)}, found {parser.remediation_book_count}")
    if parser.remediation_prompt_count != len(books):
        errors.append(f"static remediation prompt coverage incomplete: expected {len(books)}, found {parser.remediation_prompt_count}")


def validate_chapter_filter_index(data: Mapping[str, Any], errors: list[str]) -> None:
    """Verify the derived filter sidecar is complete and source-addressable."""

    sidecar = mapping(data.get("chapter_filter_index"))
    books = [mapping(item) for item in sequence(data.get("books"))]
    books_by_id = {book_id(book, index): book for index, book in enumerate(books)}
    expected_chapters: dict[str, tuple[Mapping[str, Any], Mapping[str, Any]]] = {}
    expected_domain_sources: set[tuple[str, str, str, str, int]] = set()
    expected_finding_sources: set[tuple[str, int]] = set()
    for book_index, book in enumerate(books):
        identifier = book_id(book, book_index)
        for chapter in sequence(book.get("chapter_evidence")):
            item = mapping(chapter)
            chapter_index = item.get("chapter_index")
            if isinstance(chapter_index, int) and not isinstance(chapter_index, bool):
                expected_chapters[f"{identifier}::{chapter_index}"] = (book, item)
        for domain_key, definition in DOMAIN_CATALOG.items():
            domain = mapping(mapping(book.get("domains")).get(domain_key))
            subcriteria = mapping(domain.get("subcriteria"))
            for subcriterion_key in definition["subcriteria"]:
                item = mapping(subcriteria.get(subcriterion_key))
                for polarity in ("strength", "limitation"):
                    for evidence_index, _evidence in enumerate(sequence(item.get(f"{polarity}_evidence"))):
                        expected_domain_sources.add((identifier, domain_key, subcriterion_key, polarity, evidence_index))
        for finding_index, _finding in enumerate(sequence(book.get("technical_findings"))):
            expected_finding_sources.add((identifier, finding_index))

    entries = [mapping(item) for item in sequence(sidecar.get("chapters"))]
    actual_keys = [str(item.get("chapter_key") or "") for item in entries]
    duplicates = sorted(key for key, count in Counter(actual_keys).items() if key and count > 1)
    if duplicates:
        errors.append("chapter_filter_index has duplicate chapter keys: " + ", ".join(duplicates))
    missing = sorted(set(expected_chapters) - set(actual_keys))
    extra = sorted(set(actual_keys) - set(expected_chapters))
    if missing:
        errors.append("chapter_filter_index is missing chapters: " + ", ".join(missing))
    if extra:
        errors.append("chapter_filter_index has unknown chapters: " + ", ".join(extra))

    severity_order = {"none": 0, "info": 1, "warning": 2, "error": 3}
    resolved_domain_sources: set[tuple[str, str, str, str, int]] = set()
    resolved_finding_sources: set[tuple[str, int]] = set()
    for entry in entries:
        key = str(entry.get("chapter_key") or "")
        expected = expected_chapters.get(key)
        if not expected:
            continue
        book, chapter = expected
        identifier = str(entry.get("book_id") or "")
        if identifier not in books_by_id or key != f"{identifier}::{entry.get('chapter_index')}":
            errors.append(f"chapter_filter_index key metadata is inconsistent: {key}")
            continue
        if entry.get("chapter_id") != chapter.get("chapter_id"):
            errors.append(f"chapter_filter_index chapter_id differs from canonical chapter: {key}")
        observations = sequence(chapter.get("trust_qa_safety_issues"))
        if entry.get("untyped_observation_count") != len(observations):
            errors.append(f"chapter_filter_index observation count differs from canonical chapter: {key}")

        association_domains: set[str] = set()
        for association_raw in sequence(entry.get("domain_associations")):
            association = mapping(association_raw)
            domain_key = str(association.get("domain_key") or "")
            subcriterion_key = str(association.get("subcriterion_key") or "")
            polarity = str(association.get("polarity") or "")
            evidence_index = association.get("evidence_index")
            if domain_key not in DOMAIN_CATALOG or subcriterion_key not in DOMAIN_CATALOG.get(domain_key, {}).get("subcriteria", {}):
                errors.append(f"chapter_filter_index has an unknown domain/subcriterion association: {key}")
                continue
            if polarity not in {"strength", "limitation"} or not isinstance(evidence_index, int) or isinstance(evidence_index, bool):
                errors.append(f"chapter_filter_index has an invalid evidence association: {key}")
                continue
            source = (identifier, domain_key, subcriterion_key, polarity, evidence_index)
            if source not in expected_domain_sources:
                errors.append(f"chapter_filter_index points to missing adjudicated evidence: {key}/{domain_key}/{subcriterion_key}")
                continue
            resolved_domain_sources.add(source)
            association_domains.add(domain_key)
        expected_domain_keys = [domain_key for domain_key in DOMAIN_CATALOG if domain_key in association_domains]
        if sequence(entry.get("domain_keys")) != expected_domain_keys:
            errors.append(f"chapter_filter_index domain_keys do not match associations: {key}")

        severities: list[str] = []
        for association_raw in sequence(entry.get("issue_associations")):
            association = mapping(association_raw)
            finding_index = association.get("technical_finding_index")
            if not isinstance(finding_index, int) or isinstance(finding_index, bool):
                errors.append(f"chapter_filter_index has an invalid technical finding index: {key}")
                continue
            findings = sequence(book.get("technical_findings"))
            if finding_index < 0 or finding_index >= len(findings):
                errors.append(f"chapter_filter_index points to a missing technical finding: {key}/{finding_index}")
                continue
            finding = mapping(findings[finding_index])
            if association.get("severity") != finding.get("severity") or association.get("type") != finding.get("type"):
                errors.append(f"chapter_filter_index issue association differs from the technical finding: {key}/{finding_index}")
            resolved_finding_sources.add((identifier, finding_index))
            severities.append(str(finding.get("severity") or ""))
        expected_severity = max(severities, key=lambda value: severity_order.get(value, -1)) if severities else "none"
        if entry.get("max_issue_severity") != expected_severity:
            errors.append(f"chapter_filter_index max severity is incorrect: {key}")

    book_domain_sources: set[tuple[str, str, str, str, int]] = set()
    unresolved_domain_sources: set[tuple[str, str, str, str, int]] = set()
    for target, values in (
        (book_domain_sources, sequence(sidecar.get("book_scope_domain_evidence"))),
        (unresolved_domain_sources, sequence(sidecar.get("unresolved_domain_evidence"))),
    ):
        for raw in values:
            item = mapping(raw)
            evidence_index = item.get("evidence_index")
            if isinstance(evidence_index, int) and not isinstance(evidence_index, bool):
                target.add((str(item.get("book_id") or ""), str(item.get("domain_key") or ""), str(item.get("subcriterion_key") or ""), str(item.get("polarity") or ""), evidence_index))
    domain_partitions = (resolved_domain_sources, book_domain_sources, unresolved_domain_sources)
    if any(left & right for index, left in enumerate(domain_partitions) for right in domain_partitions[index + 1:]):
        errors.append("chapter_filter_index domain evidence appears in more than one scope partition")
    if set().union(*domain_partitions) != expected_domain_sources:
        errors.append("chapter_filter_index does not exhaustively partition final adjudicated evidence")

    book_finding_sources = {
        (str(mapping(item).get("book_id") or ""), mapping(item).get("technical_finding_index"))
        for item in sequence(sidecar.get("book_scope_technical_findings"))
    }
    unresolved_finding_sources = {
        (str(mapping(item).get("book_id") or ""), mapping(item).get("technical_finding_index"))
        for item in sequence(sidecar.get("unresolved_technical_findings"))
    }
    finding_partitions = (resolved_finding_sources, book_finding_sources, unresolved_finding_sources)
    if any(left & right for index, left in enumerate(finding_partitions) for right in finding_partitions[index + 1:]):
        errors.append("chapter_filter_index technical findings appear in more than one scope partition")
    if set().union(*finding_partitions) != expected_finding_sources:
        errors.append("chapter_filter_index does not exhaustively partition technical findings")


def _csv_dict_rows(data: Mapping[str, Any], filename: str, errors: list[str]) -> tuple[list[str], list[dict[str, str]]]:
    content = mapping(data.get("csv_downloads")).get(filename)
    if not isinstance(content, str):
        errors.append(f"sample report is missing embedded {filename}")
        return [], []
    try:
        reader = csv.DictReader(io.StringIO(content, newline=""))
        rows = list(reader)
    except csv.Error as error:
        errors.append(f"sample {filename} is invalid CSV: {error}")
        return [], []
    return list(reader.fieldnames or []), rows


def validate_sample_report(data: Mapping[str, Any], parser: AuditParser, errors: list[str]) -> None:
    """Reject sample reports that could be mistaken for full-book evaluations."""

    if not is_sample_report(data):
        return
    run = mapping(data.get("run"))
    sampling = sampling_metadata(data)
    visible = " ".join(parser.visible_text)
    visible_folded = visible.casefold()

    if data.get("result_type") != "experimental_chapter_sample_report":
        errors.append("sample report result_type must be experimental_chapter_sample_report")
    if SAMPLE_WARNING not in visible:
        errors.append("sample report is missing the mandatory experimental full-book warning")
    if "experimental" not in visible_folded or "chapter-sample" not in visible_folded:
        errors.append("sample report title must identify an experimental chapter-sample evaluation")

    required_metadata = {
        "sampling_seed": "Sampling seed",
        "selection_algorithm": "Selection algorithm",
        "selection_manifest_sha256": "Selection manifest SHA-256",
        "population_chapter_count": "Population chapters",
        "selected_chapter_count": "Selected chapters",
        "not_sampled_chapter_count": "Not sampled",
    }
    for field, label in required_metadata.items():
        value = sampling.get(field)
        if value in (None, ""):
            errors.append(f"sample run is missing run.sampling.{field}")
        if label not in visible:
            errors.append(f"sample report does not display {label}")
        if value not in (None, "") and str(value) not in visible:
            errors.append(f"sample report does not display run.sampling.{field} value")

    manifest_hash = str(sampling.get("selection_manifest_sha256") or "")
    if not re.fullmatch(r"[0-9a-f]{64}", manifest_hash):
        errors.append("run.sampling.selection_manifest_sha256 must be a lowercase SHA-256 digest")
    if sampling.get("selection_algorithm") != "sha256-lowest-rank-v1":
        errors.append("sample selection algorithm must be sha256-lowest-rank-v1")
    if sampling.get("score_scope") != "selected_chapters_only":
        errors.append("sample score_scope must be selected_chapters_only")
    if sampling.get("result_interpretation") != "exploratory_sample_estimate":
        errors.append("sample result_interpretation must be exploratory_sample_estimate")
    if sampling.get("full_book_certification_eligible") is not False:
        errors.append("sample report must declare full_book_certification_eligible=false")

    population = sampling.get("population_chapter_count")
    selected = sampling.get("selected_chapter_count")
    not_sampled = sampling.get("not_sampled_chapter_count")
    if not all(isinstance(value, int) and not isinstance(value, bool) for value in (population, selected, not_sampled)):
        errors.append("sample population, selected, and not-sampled totals must be integers")
        population_number = selected_number = not_sampled_number = 0
    else:
        population_number = int(population)
        selected_number = int(selected)
        not_sampled_number = int(not_sampled)
        if population_number != selected_number + not_sampled_number:
            errors.append("sample totals do not satisfy population = selected + not sampled")
        expected_coverage = selected_number / population_number if population_number else 0.0
        if not close(number(sampling.get("population_coverage_ratio")), expected_coverage):
            errors.append("sample population_coverage_ratio is inconsistent with population totals")

    forbidden_full_mode_phrases = (
        "every accessible reader-facing chapter and component was read",
        "overall ranking",
        "chapter completeness",
        "total content design score",
        "per-book evaluations",
        "chapter-by-chapter evidence browser",
    )
    for phrase in forbidden_full_mode_phrases:
        if phrase in visible_folded:
            errors.append(f"sample report contains misleading full-content language: {phrase}")
    for required_label in (
        "Sample order",
        "Experimental sample score",
        "Sample read coverage",
        "Selected source positions",
        "Experimental chapter-sample methodology",
    ):
        if required_label.casefold() not in visible_folded:
            errors.append(f"sample report is missing required sample label: {required_label}")

    expected_by_book: dict[str, dict[str, Any]] = {}
    source_population_total = 0
    selected_total = 0
    for index, raw in enumerate(sequence(data.get("books"))):
        book = mapping(raw)
        identifier = book_id(book, index)
        scope = mapping(book.get("evaluation_scope"))
        if scope.get("mode") != "chapter_sample":
            errors.append(f"sample report book evaluation_scope.mode is invalid: {identifier}")
            continue
        original_source = mapping(scope.get("original_source"))
        source_count = original_source.get("chapter_count")
        selected_count = scope.get("selected_chapter_count")
        positions = selected_chapter_positions(scope)
        if not isinstance(source_count, int) or isinstance(source_count, bool):
            errors.append(f"sample report book lacks original source chapter count: {identifier}")
            continue
        if not isinstance(selected_count, int) or isinstance(selected_count, bool):
            errors.append(f"sample report book lacks selected chapter count: {identifier}")
            continue
        if selected_count != len(positions) or len(set(positions)) != len(positions):
            errors.append(f"sample report book has inconsistent selected positions: {identifier}")
        if len(sequence(book.get("chapter_evidence"))) != selected_count:
            errors.append(f"sample report chapter evidence count differs from selected scope: {identifier}")
        position_text = ", ".join(str(value) for value in positions)
        if position_text and position_text not in visible:
            errors.append(f"sample report does not display selected source positions for {identifier}")
        source_population_total += source_count
        selected_total += selected_count
        expected_by_book[identifier] = {
            "evaluation_mode": "chapter_sample",
            "sample_source_chapter_count": str(source_count),
            "sample_selected_chapter_count": str(selected_count),
            "sample_not_selected_chapter_count": str(source_count - selected_count),
            "sample_selected_positions": ";".join(str(value) for value in positions),
        }
    if source_population_total != population_number or selected_total != selected_number:
        errors.append(
            "sample per-book scopes do not sum to run population/selected totals"
        )

    for filename in ("scorecard.csv", "gates.csv", "chapter-evidence.csv"):
        fields, rows = _csv_dict_rows(data, filename, errors)
        required_fields = set(SAMPLE_SCOPE_COLUMNS)
        if filename == "scorecard.csv":
            required_fields.add("sample_order")
        if filename == "chapter-evidence.csv":
            required_fields.update({"sample_selection_order", "original_chapter_position"})
        missing = sorted(required_fields - set(fields))
        if missing:
            errors.append(f"sample {filename} is missing scope columns: {', '.join(missing)}")
        for row in rows:
            identifier = str(row.get("book_id") or "")
            expected = expected_by_book.get(identifier)
            if expected is None:
                errors.append(f"sample {filename} contains an unknown book_id: {identifier}")
                continue
            for field, value in expected.items():
                if row.get(field) != value:
                    errors.append(f"sample {filename} has incorrect {field} for {identifier}")
                    break


def validate_assets(raw_html: str, parser: AuditParser, errors: list[str]) -> None:
    if parser.external_resources:
        errors.append("external resource dependencies found: " + ", ".join(parser.external_resources))
    if len(parser.styles) != 1:
        errors.append(f"expected exactly one inline style block, found {len(parser.styles)}")
    if len(parser.scripts) != 2:
        errors.append(f"expected one inert data script and one inline application script, found {len(parser.scripts)} scripts")
    app_scripts = [content for attrs, content in parser.scripts if attrs.get("type") != "application/json"]
    app_script = "\n".join(app_scripts)
    for pattern in NETWORK_JS_PATTERNS:
        if re.search(pattern, app_script):
            errors.append(f"network-capable JavaScript pattern is forbidden: {pattern}")
    for pattern in UNSAFE_JS_PATTERNS:
        if re.search(pattern, app_script):
            errors.append(f"unsafe HTML/code injection JavaScript pattern is forbidden: {pattern}")
    style = "\n".join(parser.styles)
    if re.search(r"@import\b|url\s*\(\s*['\"]?(?:https?:)?//", style, flags=re.IGNORECASE):
        errors.append("stylesheet contains an external import or URL")
    required_css = (":focus-visible", "@media print", "prefers-reduced-motion", "overflow-x", "min-block-size: 2.75rem")
    for token in required_css:
        if token not in style:
            errors.append(f"accessibility/responsive stylesheet token missing: {token}")
    required_markup = (
        'name="viewport"', 'class="skip-link"', 'id="main-content"',
        'aria-live="polite"', 'id="reset-filters"', 'id="show-disagreements"',
        'id="show-evidence"', 'id="downloads"',
    )
    for token in required_markup:
        if token not in raw_html:
            errors.append(f"required accessible/control markup missing: {token}")
    required_js = ("createElementNS", 'role: "img"', "View chart data table", "textContent", "URL.createObjectURL", "report.csv_downloads", "chapter_filter_index", "row.filterMetadata.domain_keys", "row.filterMetadata.max_issue_severity")
    for token in required_js:
        if token not in app_script:
            errors.append(f"required offline/accessible interaction behavior missing: {token}")
    if "user-scalable=no" in raw_html.casefold() or "maximum-scale=1" in raw_html.casefold():
        errors.append("viewport metadata prevents 200% zoom")

    node = shutil.which("node")
    if node and app_script:
        temporary_name = ""
        try:
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".js", delete=False) as stream:
                stream.write(app_script)
                temporary_name = stream.name
            result = subprocess.run([node, "--check", temporary_name], capture_output=True, text=True, timeout=20, check=False)
            if result.returncode:
                errors.append("inline JavaScript syntax check failed: " + (result.stderr.strip() or result.stdout.strip()))
        except (OSError, subprocess.SubprocessError) as error:
            errors.append(f"inline JavaScript syntax check could not complete: {error}")
        finally:
            if temporary_name:
                Path(temporary_name).unlink(missing_ok=True)


def validate_displayed_scores(data: Mapping[str, Any], parser: AuditParser, expected: Mapping[str, float], errors: list[str]) -> None:
    seen_book_scores: dict[str, list[float]] = {}
    for identifier, raw in parser.book_scores:
        seen_book_scores.setdefault(identifier, []).append(number(raw))
    for identifier, calculated in expected.items():
        values = seen_book_scores.get(identifier, [])
        if not values:
            errors.append(f"displayed score marker missing for {identifier}")
        elif any(not close(value, calculated) for value in values):
            errors.append(f"displayed score differs from deterministic calculation for {identifier}")
    books = [mapping(item) for item in sequence(data.get("books"))]
    expected_domains: dict[str, float] = {}
    for book_index, book in enumerate(books):
        identifier = book_id(book, book_index)
        for domain_key in DOMAIN_CATALOG:
            expected_domains[f"{identifier}:{domain_key}"] = number(mapping(mapping(book.get("domains")).get(domain_key)).get("domain_score"))
    seen_domains = {identifier: number(raw) for identifier, raw in parser.domain_scores}
    for identifier, value in expected_domains.items():
        if identifier not in seen_domains:
            errors.append(f"displayed domain score marker missing for {identifier}")
        elif not close(seen_domains[identifier], value):
            errors.append(f"displayed domain score differs from canonical data for {identifier}")


def _is_portfolio_snapshot(data: Mapping[str, Any]) -> bool:
    names = data.get("domain_names")
    books = data.get("books")
    if not isinstance(names, list) or not isinstance(books, list) or not books:
        return False
    first = books[0] if isinstance(books[0], Mapping) else {}
    domains = first.get("domains") if isinstance(first, Mapping) else None
    return isinstance(domains, Mapping) and bool(domains) and all(
        isinstance(value, (int, float)) and not isinstance(value, bool) for value in domains.values()
    )


def validate_portfolio_snapshot(report_path: Path, data_path: Path) -> list[str]:
    """Complete independent validator for the compact 140-book portfolio snapshot."""

    errors: list[str] = []
    source = strict_json_load(data_path)
    if not isinstance(source, Mapping):
        return ["portfolio report data must contain an object"]
    names = source.get("domain_names")
    weights = source.get("domain_weights")
    books = source.get("books")
    if not isinstance(names, list) or len(names) != 9 or len(set(names)) != 9 or any(not isinstance(item, str) or not item for item in names):
        errors.append("portfolio must declare exactly nine unique nonempty domain_names")
        names = []
    if not isinstance(weights, Mapping) or set(weights) != set(names):
        errors.append("portfolio domain_weights must exactly match domain_names")
        weights = {}
    else:
        weight_values = [number(weights[name]) for name in names]
        if any(not math.isfinite(value) or value <= 0 for value in weight_values) or not close(sum(weight_values), 100.0):
            errors.append("portfolio domain weights must be positive and sum to 100")
    if not isinstance(books, list) or len(books) != 140 or any(not isinstance(item, Mapping) for item in books):
        errors.append("portfolio must contain exactly 140 book objects")
        books = [item for item in books or [] if isinstance(item, Mapping)] if isinstance(books, list) else []
    identifiers = [str(book.get("id") or "") for book in books]
    if any(not item for item in identifiers) or len(set(identifiers)) != len(identifiers):
        errors.append("portfolio book ids must be nonempty and unique")
    expected_order = sorted(
        books,
        key=lambda book: (-number(book.get("score")), str(book.get("title") or "").casefold(), str(book.get("id") or "")),
    )
    previous_score: float | None = None
    expected_rank = 0
    for position, book in enumerate(expected_order, 1):
        identifier = str(book.get("id") or f"book-{position}")
        domains = book.get("domains") if isinstance(book.get("domains"), Mapping) else {}
        if set(domains) != set(names) or any(not math.isfinite(number(value)) or not 0 <= number(value) <= 4 for value in domains.values()):
            errors.append(f"{identifier}: domains must contain nine finite scores in [0, 4]")
        rows = book.get("subcriteria") if isinstance(book.get("subcriteria"), list) else []
        if len(rows) != 36 or any(not isinstance(row, Mapping) for row in rows):
            errors.append(f"{identifier}: exactly 36 subcriteria objects are required")
        else:
            counts: Counter[str] = Counter()
            labels: set[tuple[str, str]] = set()
            for row in rows:
                domain = str(row.get("domain") or "")
                label = str(row.get("subcriterion") or "")
                rating = number(row.get("rating"))
                counts[domain] += 1
                if not label or (domain, label) in labels or domain not in names or not math.isfinite(rating) or not 0 <= rating <= 4:
                    errors.append(f"{identifier}: malformed or duplicate subcriterion record")
                    break
                labels.add((domain, label))
            if names and any(counts[name] != 4 for name in names):
                errors.append(f"{identifier}: every domain must have exactly four subcriteria")
        chapters = book.get("chapters")
        evidence = book.get("chapter_evidence")
        if not isinstance(chapters, int) or isinstance(chapters, bool) or chapters < 1:
            errors.append(f"{identifier}: chapters must be a positive integer")
        elif not isinstance(evidence, list) or len(evidence) != chapters or any(not isinstance(item, Mapping) for item in evidence):
            errors.append(f"{identifier}: chapter_evidence must cover every declared chapter")
        score = number(book.get("score"))
        if not math.isfinite(score) or not 0 <= score <= 100:
            errors.append(f"{identifier}: score must be finite in [0, 100]")
        if previous_score is None or not close(score, previous_score):
            expected_rank = position
            previous_score = score
        if book.get("rank") != expected_rank:
            errors.append(f"{identifier}: rank does not match deterministic score/title/id ordering")
    meta = source.get("meta") if isinstance(source.get("meta"), Mapping) else {}
    if meta.get("books") != len(books):
        errors.append("portfolio meta.books does not match the book inventory")
    if meta.get("chapters") != sum(int(book.get("chapters") or 0) for book in books):
        errors.append("portfolio meta.chapters does not match the book inventory")
    if not report_path.is_file() or report_path.stat().st_size == 0:
        errors.append(f"portfolio HTML does not exist or is empty: {report_path}")
        return errors
    raw_html = report_path.read_text(encoding="utf-8")
    parser = AuditParser()
    parser.feed(raw_html)
    parser.close()
    if parser.external_resources:
        errors.append("portfolio HTML contains external resource dependencies: " + ", ".join(parser.external_resources))
    embedded_candidates = [content for attrs, content in parser.scripts if attrs.get("id") == "report-data" and attrs.get("type") == "application/json"]
    download_candidates = [content for attrs, content in parser.scripts if attrs.get("id") == "source-downloads" and attrs.get("type") == "application/json"]
    if len(embedded_candidates) != 1:
        errors.append(f"portfolio HTML must contain exactly one inert #report-data script; found {len(embedded_candidates)}")
    else:
        try:
            embedded = json.loads(embedded_candidates[0])
            if embedded != source:
                errors.append("portfolio embedded report data differs from the external JSON")
        except json.JSONDecodeError as exc:
            errors.append(f"portfolio embedded report data is invalid JSON: {exc}")
    if len(download_candidates) != 1:
        errors.append(f"portfolio HTML must contain exactly one inert #source-downloads script; found {len(download_candidates)}")
    else:
        try:
            downloads = json.loads(download_candidates[0])
        except json.JSONDecodeError as exc:
            errors.append(f"portfolio source-downloads is invalid JSON: {exc}")
            downloads = {}
        if not isinstance(downloads, Mapping):
            errors.append("portfolio source-downloads must be an object")
        else:
            for name, record in downloads.items():
                if not isinstance(record, Mapping):
                    errors.append(f"portfolio download {name} metadata must be an object")
                    continue
                if "base64" not in record:
                    continue
                try:
                    payload = __import__("base64").b64decode(str(record.get("base64") or ""), validate=True)
                except ValueError:
                    errors.append(f"portfolio download {name} has invalid base64")
                    continue
                if record.get("bytes") != len(payload) or record.get("sha256") != __import__("hashlib").sha256(payload).hexdigest():
                    errors.append(f"portfolio download {name} size/hash metadata is stale")
    return sorted(set(errors))


def validate_report(report_path: Path, data_path: Path) -> list[str]:
    errors: list[str] = []
    if not report_path.is_file() or report_path.stat().st_size == 0:
        return [f"report does not exist or is empty: {report_path}"]
    source = strict_json_load(data_path)
    if not isinstance(source, Mapping):
        return ["report-data.json must contain an object"]
    if _is_portfolio_snapshot(source):
        return validate_portfolio_snapshot(report_path, data_path)
    if is_sample_report(source):
        return ["chapter-sample reports are disabled; validate full-content evaluations only"]
    schema_name = "report-data.schema.json"
    schema_path = Path(__file__).resolve().parents[1] / "references" / schema_name
    if not schema_path.is_file():
        errors.append(f"report-data schema is missing: {schema_path}")
    else:
        schema = strict_json_load(schema_path)
        errors.extend(f"report-data {error}" for error in _jsonschema_errors(source, schema))
    raw_html = report_path.read_text(encoding="utf-8")
    parser = AuditParser()
    try:
        parser.feed(raw_html)
        parser.close()
    except Exception as error:  # HTMLParser can expose malformed source edge cases.
        errors.append(f"HTML parsing failed: {error}")
        return errors
    validate_embedded_json(raw_html, source, parser, errors)
    expected_scores = validate_arithmetic(source, errors)
    validate_csv_downloads(source, errors)
    validate_structure(source, parser, errors)
    validate_content_coverage(source, parser, errors)
    validate_remediation(source, parser, errors)
    validate_chapter_filter_index(source, errors)
    validate_sample_report(source, parser, errors)
    validate_assets(raw_html, parser, errors)
    validate_displayed_scores(source, parser, expected_scores, errors)
    return errors


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True, help="Rendered self-contained report.html")
    parser.add_argument("--data", type=Path, required=True, help="Canonical report-data.json")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        errors = validate_report(args.report.resolve(), args.data.resolve())
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"report validation error: {error}", file=sys.stderr)
        return 2
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(json.dumps({"status": "failed", "errors": len(errors), "report": str(args.report.resolve())}, sort_keys=True))
        return 1
    data = strict_json_load(args.data.resolve())
    print(json.dumps({"status": "valid", "books": len(sequence(mapping(data).get("books"))), "report": str(args.report.resolve())}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
