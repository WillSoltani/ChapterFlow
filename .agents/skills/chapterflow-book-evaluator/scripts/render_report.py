#!/usr/bin/env python3
"""Render a deterministic, self-contained ChapterFlow evaluation report."""

from __future__ import annotations

import argparse
import html
import json
import math
import os
import re
import sys
import tempfile
from collections import OrderedDict
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


DOMAIN_CATALOG: "OrderedDict[str, dict[str, Any]]" = OrderedDict(
    [
        ("epistemic_integrity", {"name": "Epistemic Integrity and Intellectual Honesty", "weight": 15, "subcriteria": OrderedDict([
            ("claim_support_fit", "Claim-support fit"), ("uncertainty_limitations", "Uncertainty and limitations"),
            ("internal_consistency_qa", "Internal consistency and instructional QA"), ("misuse_safeguards", "Misuse safeguards")])}),
        ("audience_fit", {"name": "Audience Fit, Comprehensibility, and Cognitive Economy", "weight": 12, "subcriteria": OrderedDict([
            ("language_clarity", "Language clarity"), ("beginner_onboarding", "Beginner onboarding"),
            ("signal_noise_framework_load", "Signal-to-noise and framework load"), ("audience_context_accessibility", "Audience and context accessibility")])}),
        ("mental_model_coherence", {"name": "Mental-Model Coherence and Explanatory Depth", "weight": 15, "subcriteria": OrderedDict([
            ("central_model", "Central model"), ("mechanism_causal_explanation", "Mechanism and causal explanation"),
            ("cross_concept_integration", "Cross-concept integration"), ("nuance_diagnostic_power", "Nuance and diagnostic power")])}),
        ("learning_architecture", {"name": "Learning Architecture and Productive Processing", "weight": 12, "subcriteria": OrderedDict([
            ("sequencing_scaffolding", "Sequencing and scaffolding"), ("worked_examples_contrasts", "Worked examples and contrasts"),
            ("active_processing", "Active processing"), ("feedback_metacognitive_calibration", "Feedback and metacognitive calibration")])}),
        ("retention_retrieval", {"name": "Retention and Retrieval Support", "weight": 10, "subcriteria": OrderedDict([
            ("meaningful_retrieval_cues", "Meaningful retrieval cues"), ("cumulative_reinforcement", "Cumulative reinforcement"),
            ("quiz_retrieval_depth", "Quiz and retrieval depth"), ("interference_control_consolidation", "Interference control and consolidation")])}),
        ("transfer_action_judgment", {"name": "Purpose-Appropriate Transfer, Action, and Practical Judgment", "weight": 15, "subcriteria": OrderedDict([
            ("concrete_actions", "Concrete actions"), ("cross_context_transfer", "Cross-context transfer"),
            ("implementation_feedback_support", "Implementation and feedback support"), ("boundaries_adaptation_tradeoffs", "Boundaries, adaptation, and tradeoffs")])}),
        ("motivation_autonomy", {"name": "Motivation, Autonomy, and Calibrated Agency", "weight": 8, "subcriteria": OrderedDict([
            ("personal_relevance", "Personal relevance"), ("achievable_progress", "Achievable progress"),
            ("autonomy_non_shaming_tone", "Autonomy and non-shaming tone"), ("calibrated_confidence", "Calibrated confidence")])}),
        ("engagement_momentum", {"name": "Instructionally Aligned Engagement and Reading Momentum", "weight": 8, "subcriteria": OrderedDict([
            ("curiosity_momentum", "Curiosity and momentum"), ("narrative_example_vividness", "Narrative and example vividness"),
            ("emotional_relevance", "Emotional relevance"), ("instructional_alignment", "Instructional alignment and absence of decoration")])}),
        ("whole_book_coherence", {"name": "Whole-Book Coherence, Consistency, and Completion Value", "weight": 5, "subcriteria": OrderedDict([
            ("chapter_necessity_order", "Chapter necessity and order"), ("quality_consistency_pacing", "Quality consistency and pacing"),
            ("redundancy_cumulative_load", "Redundancy and cumulative load"), ("synthesis_completion_value", "Synthesis and completion value")])}),
    ]
)

GATE_LABELS = OrderedDict(
    [
        ("technical_completeness", "Technical completeness"),
        ("epistemic_instructional_safety", "Epistemic and instructional safety"),
        ("ethics_reader_autonomy", "Ethics and reader autonomy"),
        ("purpose_audience_declaration", "Purpose and audience declaration"),
        ("external_accuracy", "External accuracy"),
    ]
)

BASE_ANCHORS = OrderedDict(
    [
        (0, "Invalid, absent, seriously misleading, internally broken, or harmful."),
        (1, "Weak. Major recurring deficiencies substantially obstruct trust, understanding, memory, or use."),
        (2, "Adequate or mixed. The basic function exists, but important weaknesses, inconsistency, or superficiality remain."),
        (3, "Strong. The feature works reliably across most chapters, with limited and repairable weaknesses."),
        (4, "Exceptional. The feature is exemplary across nearly the entire book, handles difficult cases and boundaries, and is hard to improve materially."),
    ]
)

DEFAULT_PHILOSOPHY = [
    "Truth and justification are not interchangeable with entertainment.",
    "Understanding requires connected explanatory relationships, not isolated claims.",
    "Practical usefulness includes judgment, context, tradeoffs, and knowing when not to use a technique.",
    "Reader autonomy matters; shame, coercion, hype, and false certainty are not substitutes for learning.",
    "A weighted average cannot erase serious epistemic, ethical, or safety defects.",
    "Design inspection assesses support for learning, not actual reader outcomes.",
]

SAMPLE_WARNING = (
    "EXPERIMENTAL CHAPTER SAMPLE — NOT A FULL-BOOK EVALUATION. "
    "Scores, rankings, gates, and recommendations describe only the selected chapters; "
    "unsampled content may materially change every result."
)


class RenderError(ValueError):
    """Raised when canonical report data cannot be rendered safely."""


def esc(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def attr(value: Any) -> str:
    return esc(value)


def mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def sequence(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def is_sample_report(data: Mapping[str, Any]) -> bool:
    run = mapping(data.get("run"))
    sampling = mapping(run.get("sampling"))
    return (
        data.get("result_type") == "experimental_chapter_sample_report"
        or data.get("evaluation_mode") == "chapter_sample"
        or run.get("evaluation_mode") == "chapter_sample"
        or sampling.get("mode") == "chapter_sample"
        or any(
            isinstance(book, Mapping)
            and (
                book.get("result_type") == "experimental_chapter_sample_evaluation"
                or mapping(book.get("evaluation_scope")).get("mode") == "chapter_sample"
            )
            for book in sequence(data.get("books"))
        )
    )


def sampling_metadata(data: Mapping[str, Any]) -> Mapping[str, Any]:
    return mapping(mapping(data.get("run")).get("sampling"))


def selected_chapter_positions(scope: Mapping[str, Any]) -> list[int]:
    positions: list[int] = []
    for raw in sequence(scope.get("selected_chapters")):
        item = mapping(raw)
        value = item.get("original_chapter_position")
        if value is None and isinstance(item.get("original_chapter_index"), int):
            value = int(item["original_chapter_index"]) + 1
        if value is None:
            value = item.get("chapter_position", item.get("chapter_index"))
        if isinstance(value, int) and not isinstance(value, bool):
            positions.append(value)
    return positions


def book_sample_scope(book: Mapping[str, Any]) -> Mapping[str, Any]:
    return mapping(book.get("evaluation_scope"))


def sample_limited_text(value: Any) -> str:
    text = str(value or "")
    replacements = (
        ("across nearly the entire book", "across the selected chapter sample"),
        ("across the entire book", "across the selected chapter sample"),
        ("book-wide", "sample-wide"),
        ("whole-book pattern", "sample-wide pattern"),
        ("throughout the book", "throughout the selected sample"),
    )
    for old, new in replacements:
        text = re.sub(re.escape(old), new, text, flags=re.IGNORECASE)
    return text


def finite(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if math.isfinite(number) else default


def display_number(value: Any, places: int = 1, unavailable: str = "—") -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return unavailable
    return f"{number:.{places}f}" if math.isfinite(number) else unavailable


def text_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    if isinstance(value, list):
        return "; ".join(filter(None, (text_value(item) for item in value)))
    if isinstance(value, Mapping):
        locator = " · ".join(
            filter(None, (text_value(value.get(key)) for key in ("package_path", "chapter", "section", "item_id", "locator")))
        )
        body = text_value(
            value.get("paraphrase")
            or value.get("description")
            or value.get("rationale")
            or value.get("summary")
            or value.get("text")
        )
        if locator and body:
            return f"{locator}: {body}"
        if body or locator:
            return body or locator
        return "; ".join(f"{key}: {text_value(item)}" for key, item in value.items())
    return str(value)


def slug(value: Any, fallback: str = "item") -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", str(value or "")).strip("-").lower()
    return normalized[:80] or fallback


def book_meta(book: Mapping[str, Any]) -> Mapping[str, Any]:
    return mapping(book.get("book")) or book


def book_id(book: Mapping[str, Any], index: int = 0) -> str:
    meta = book_meta(book)
    return str(meta.get("book_id") or meta.get("slug") or book.get("slug") or f"book-{index + 1}")


def book_title(book: Mapping[str, Any]) -> str:
    meta = book_meta(book)
    return str(meta.get("title") or book.get("title") or meta.get("book_id") or "Untitled book")


def report_books(data: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    values = [mapping(item) for item in sequence(data.get("books"))]
    return sorted(values, key=lambda item: (finite(item.get("rank"), 10**9), book_title(item).casefold(), book_id(item)))


def unique_book_slugs(books: Sequence[Mapping[str, Any]]) -> dict[str, str]:
    result: dict[str, str] = {}
    seen: set[str] = set()
    for index, book in enumerate(books):
        identifier = book_id(book, index)
        base = slug(book_meta(book).get("slug") or identifier, f"book-{index + 1}")
        candidate = base
        suffix = 2
        while candidate in seen:
            candidate = f"{base}-{suffix}"
            suffix += 1
        seen.add(candidate)
        result[identifier] = candidate
    return result


def badge(status: Any, prefix: str | None = None) -> str:
    normalized = slug(status, "neutral").replace("-", "_")
    label = str(status or "not assessed").replace("_", " ")
    visible = f"{prefix}: {label}" if prefix else label
    return f'<span class="badge {attr(normalized)}">{esc(visible)}</span>'


def metric(label: Any, value: Any, note: Any = "") -> str:
    return f'<div class="metric"><span class="metric-label">{esc(label)}</span><span class="metric-value">{esc(value)}</span><span>{esc(note)}</span></div>'


def html_list(values: Any, empty: str = "None recorded.", class_name: str = "") -> str:
    items = sequence(values)
    if not items:
        return f"<p>{esc(empty)}</p>"
    class_attr = f' class="{attr(class_name)}"' if class_name else ""
    return f"<ul{class_attr}>" + "".join(f"<li>{esc(text_value(item))}</li>" for item in items) + "</ul>"


def definition_grid(rows: Iterable[tuple[str, Any]]) -> str:
    body = []
    for label, value in rows:
        body.append(f"<dt>{esc(label)}</dt><dd>{esc(text_value(value) or 'Not recorded.')}</dd>")
    return '<dl class="definition-grid">' + "".join(body) + "</dl>"


def parse_rubric_markdown(markdown: str) -> dict[str, Any]:
    """Extract normative domain purposes, subcriterion anchors, gates, and prose."""
    parsed: dict[str, Any] = {"domains": {}, "gates": {}, "philosophy": [], "evidence": []}
    lines = markdown.splitlines()

    # Weighted-domain table carries purposes not present in the JSON domain catalog.
    table_pattern = re.compile(r"^\|\s*`([^`]+)`\s*\|\s*(?:\d+\.\s*)?([^|]+?)\s*\|\s*(\d+)%\s*\|\s*([^|]+?)\s*\|")
    for line in lines:
        match = table_pattern.match(line)
        if match:
            key, name, weight, purpose = match.groups()
            parsed["domains"].setdefault(key, {}).update({"name": name.strip(), "weight": int(weight), "purpose": purpose.strip(), "subcriteria": {}})

    domain_key: str | None = None
    criterion_key: str | None = None
    gate_key: str | None = None
    section = ""
    domain_heading = re.compile(r"^###\s+Domain\s+\d+:")
    criterion_heading = re.compile(r"^####\s+\d+\.\d+\s+`([^`]+)`\s+[—-]\s+(.+?)\s*$")
    anchor_line = re.compile(r"^-\s+\*\*([0-4]):\*\*\s*(.+?)\s*$")
    gate_heading = re.compile(r"^###\s+Gate\s+\d+:\s*(.+?)\s+[—-]\s+`([^`]+)`\s*$")
    for line in lines:
        if line.startswith("## "):
            section = line[3:].strip().casefold()
            gate_key = None
        if domain_heading.match(line):
            domain_key = None
            criterion_key = None
            # The next criterion identifies the machine domain through the catalog.
            continue
        criterion_match = criterion_heading.match(line)
        if criterion_match:
            criterion_key, criterion_name = criterion_match.groups()
            domain_key = next(
                (key for key, definition in DOMAIN_CATALOG.items() if criterion_key in definition["subcriteria"]),
                None,
            )
            if domain_key:
                domain = parsed["domains"].setdefault(domain_key, {**DOMAIN_CATALOG[domain_key], "subcriteria": {}})
                domain.setdefault("subcriteria", {})[criterion_key] = {"name": criterion_name.strip(), "anchors": {}}
            continue
        anchor_match = anchor_line.match(line)
        if anchor_match and domain_key and criterion_key:
            rating, anchor_text = anchor_match.groups()
            parsed["domains"][domain_key]["subcriteria"][criterion_key]["anchors"][int(rating)] = anchor_text.strip()
            continue
        gate_match = gate_heading.match(line)
        if gate_match:
            gate_name, gate_key = gate_match.groups()
            parsed["gates"][gate_key] = {"name": gate_name.strip(), "lines": []}
            continue
        if gate_key and line.strip() and not line.startswith("#"):
            cleaned = re.sub(r"^[-*>]\s*", "", line.strip())
            cleaned = cleaned.replace("`", "").replace("**", "")
            if cleaned:
                parsed["gates"][gate_key]["lines"].append(cleaned)
        if section == "rubric philosophy" and line.startswith("-"):
            parsed["philosophy"].append(re.sub(r"^-\s*", "", line).strip())
        if section == "evidence requirements" and line.startswith("-"):
            parsed["evidence"].append(re.sub(r"^-\s*", "", line).strip())

    for key, fallback in DOMAIN_CATALOG.items():
        domain = parsed["domains"].setdefault(key, {"name": fallback["name"], "weight": fallback["weight"], "purpose": "", "subcriteria": {}})
        domain.setdefault("name", fallback["name"])
        domain.setdefault("weight", fallback["weight"])
        domain.setdefault("purpose", "")
        for sub_key, sub_name in fallback["subcriteria"].items():
            criterion = domain.setdefault("subcriteria", {}).setdefault(sub_key, {"name": sub_name, "anchors": {}})
            criterion.setdefault("name", sub_name)
            anchors = criterion.setdefault("anchors", {})
            for rating, anchor_text in BASE_ANCHORS.items():
                anchors.setdefault(rating, anchor_text)
    return parsed


def safe_embedded_json(data: Mapping[str, Any]) -> str:
    """Serialize canonically and neutralize HTML/script parsing characters."""
    raw = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return (
        raw.replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def render_overview(data: Mapping[str, Any], books: Sequence[Mapping[str, Any]]) -> str:
    run = mapping(data.get("run"))
    sample_mode = is_sample_report(data)
    sampling = sampling_metadata(data)
    totals = {
        "expected": sum(int(finite(book_meta(book).get("chapter_count_expected"))) for book in books),
        "full": sum(int(finite(book_meta(book).get("chapter_count_read_full"))) for book in books),
        "partial": sum(int(finite(book_meta(book).get("chapter_count_partial"))) for book in books),
        "inaccessible": sum(int(finite(book_meta(book).get("chapter_count_inaccessible"))) for book in books),
    }
    components: dict[str, int] = {}
    for book in books:
        for key, value in mapping(book_meta(book).get("component_inventory")).items():
            if key == "other" and isinstance(value, Mapping):
                for other_key, other_value in value.items():
                    components[other_key] = components.get(other_key, 0) + int(finite(other_value))
            elif isinstance(value, (int, float)):
                components[key] = components.get(key, 0) + int(value)
    duplicate_value = run.get("duplicate_count", run.get("duplicates", 0))
    duplicate_count = len(duplicate_value) if isinstance(duplicate_value, list) else int(finite(duplicate_value))
    packages_found = int(finite(run.get("packages_found", run.get("discovered_packages", run.get("candidate_packages", len(books) + duplicate_count))), len(books)))
    canonical = int(finite(run.get("canonical_books", run.get("books_scored", len(books))), len(books)))
    if sample_mode:
        population = int(finite(sampling.get("population_chapter_count")))
        selected = int(finite(sampling.get("selected_chapter_count")))
        not_sampled = int(finite(sampling.get("not_sampled_chapter_count")))
        metrics = [
            ("Packages found", packages_found), ("Books sampled", canonical), ("Duplicates", duplicate_count),
            ("Population chapters", population), ("Selected chapters", selected),
            ("Not sampled", not_sampled), ("Selected chapters read in full", totals["full"]),
            ("Selected partial", totals["partial"]), ("Selected inaccessible", totals["inaccessible"]),
        ]
    else:
        metrics = [
            ("Packages found", packages_found), ("Canonical books scored", canonical), ("Duplicates", duplicate_count),
            ("Chapters expected", totals["expected"]), ("Read in full", totals["full"]),
            ("Partial", totals["partial"]), ("Inaccessible", totals["inaccessible"]),
        ]
    metrics_html = '<div class="metrics-grid">' + "".join(
        f'<div class="metric"><span class="metric-label">{esc(label)}</span><span class="metric-value">{esc(value)}</span></div>'
        for label, value in metrics
    ) + "</div>"
    metadata_rows = [
            ("Run ID", run.get("run_id") or data.get("run_id")),
            ("Generated at (UTC)", data.get("generated_at_utc") or run.get("generated_at_utc")),
            ("Schema version", data.get("schema_version")),
            ("Rubric version", data.get("rubric_version")),
            ("Isolation mode", run.get("isolation_mode") or "Repository-local, no web, no prior-score evidence"),
            ("Package directory", run.get("packages_dir") or run.get("package_directory") or "book-packages/"),
            ("Agent configuration", run.get("agent_configuration") or run.get("agents") or "Two independent raters, evidence-based adjudication"),
            ("Validation status", mapping(run.get("validation")) or run.get("validation_status") or run.get("status") or "Not recorded"),
        ]
    if sample_mode:
        metadata_rows.extend(
            [
                ("Evaluation mode", "Experimental selected-chapter sample"),
                ("Score scope", "Selected chapters only"),
                ("Result interpretation", "Exploratory sample estimate"),
                ("Sampling seed", sampling.get("sampling_seed")),
                ("Selection algorithm", sampling.get("selection_algorithm")),
                ("Selection manifest SHA-256", sampling.get("selection_manifest_sha256")),
                ("Requested chapters per book", sampling.get("requested_chapters_per_book")),
                ("Population coverage ratio", f"{finite(sampling.get('population_coverage_ratio')) * 100:.2f}%"),
            ]
        )
    metadata = definition_grid(metadata_rows)
    component_title = "Selected-chapter reader-facing component inventory" if sample_mode else "Reader-facing component inventory"
    component_html = f'<div class="panel"><h3>{esc(component_title)}</h3>'
    component_html += definition_grid((key.replace("_", " ").title(), value) for key, value in sorted(components.items())) if components else "<p>No component totals were recorded.</p>"
    component_html += "<p><strong>Interpretation:</strong> counts describe coverage only; quantity is not treated as quality.</p></div>"
    limitations = sequence(data.get("limitations") or run.get("limitations"))
    scope_warning = f'<div class="notice sample-warning"><strong>{esc(SAMPLE_WARNING)}</strong></div>' if sample_mode else ""
    return scope_warning + metrics_html + f'<div class="panel"><h3>Run identity and scope</h3>{metadata}</div>' + component_html + '<div class="panel"><h3>Limitations</h3>' + html_list(limitations, "No additional run limitations were recorded.") + "</div>"


def domain_score(book: Mapping[str, Any], key: str) -> float:
    domain = mapping(mapping(book.get("domains")).get(key))
    if domain.get("domain_score") is not None:
        return finite(domain.get("domain_score"))
    ratings = [finite(mapping(value).get("rating"), math.nan) for value in mapping(domain.get("subcriteria")).values()]
    ratings = [value for value in ratings if math.isfinite(value)]
    return sum(ratings) / len(ratings) if ratings else 0.0


def gate_summary(book: Mapping[str, Any]) -> tuple[str, str]:
    statuses = [str(mapping(mapping(book.get("gates")).get(key)).get("status") or "not_assessed") for key in GATE_LABELS]
    severity = {"fail": 5, "unevaluable": 4, "conditional": 3, "not_assessed": 2, "pass": 1}
    worst = max(statuses, key=lambda value: severity.get(value, 0), default="not_assessed")
    return worst, "; ".join(f"{GATE_LABELS[key]}: {statuses[index].replace('_', ' ')}" for index, key in enumerate(GATE_LABELS))


def render_dashboard(data: Mapping[str, Any], books: Sequence[Mapping[str, Any]], slugs: Mapping[str, str]) -> str:
    sample_mode = is_sample_report(data)
    headers = [
        ("rank", "Sample order" if sample_mode else "Rank", "number"), ("title", "Title", "text"), ("overall", "Experimental sample score" if sample_mode else "Score", "number"),
        ("classification", "Sample score band" if sample_mode else "Classification", "text"), ("certification", "Sample gate status" if sample_mode else "Certification", "text"),
        ("confidence", "Confidence", "text"), ("completeness", "Sample read coverage" if sample_mode else "Chapter completeness", "number"),
        ("gate", "Gate status", "text"),
    ] + [(key, definition["name"], "number") for key, definition in DOMAIN_CATALOG.items()]
    header_html = "".join(
        f'<th scope="col" data-sort-key="{attr(key)}" data-sort-type="{attr(kind)}"><button type="button" class="sort-button">{esc(label)}</button></th>'
        for key, label, kind in headers
    )
    rows = []
    for index, book in enumerate(books):
        meta = book_meta(book)
        identifier = book_id(book, index)
        rank = int(finite(book.get("rank"), index + 1))
        score = finite(book.get("overall_score"))
        confidence = mapping(book.get("confidence"))
        completeness = finite(confidence.get("chapter_completeness_ratio"), 0.0)
        worst_gate, gate_title = gate_summary(book)
        gate_badges = "".join(
            badge(mapping(mapping(book.get("gates")).get(gate_key)).get("status"), gate_label)
            for gate_key, gate_label in GATE_LABELS.items()
        )
        tie = book.get("tie_group")
        cells = [
            f'<td class="numeric" data-key="rank" data-sort-value="{rank}">{rank}</td>',
            f'<th scope="row" class="title-cell" data-key="title" data-sort-value="{attr(book_title(book).casefold())}"><a href="#book-{attr(slugs[identifier])}">{esc(book_title(book))}</a>' + (f' {badge("neutral", "Effective tie")}' if tie else "") + "</th>",
            f'<td class="numeric" data-key="overall" data-sort-value="{score:.8f}" data-book-score="{attr(identifier)}" data-score-value="{score:.8f}"><strong>{score:.1f}</strong></td>',
            f'<td data-key="classification" data-sort-value="{attr(book.get("classification") or "")}">{esc(book.get("classification") or "Not classified")}</td>',
            f'<td data-key="certification" data-sort-value="{attr(book.get("certification_status") or "")}">{badge(book.get("certification_status"), None)}</td>',
            f'<td data-key="confidence" data-sort-value="{attr(confidence.get("level") or "")}">{badge(confidence.get("level"), None)}</td>',
            f'<td class="numeric" data-key="completeness" data-sort-value="{completeness:.8f}">{completeness * 100:.1f}%</td>',
            f'<td data-key="gate" data-sort-value="{attr(worst_gate)}" title="{attr(gate_title)}">{gate_badges}</td>',
        ]
        for key in DOMAIN_CATALOG:
            value = domain_score(book, key)
            cells.append(f'<td class="numeric" data-key="{attr(key)}" data-sort-value="{value:.8f}" data-domain-score="{attr(identifier)}:{attr(key)}" data-score-value="{value:.8f}">{value:.2f}</td>')
        rows.append("<tr>" + "".join(cells) + "</tr>")
    caption = (
        "Experimental sample order and selected-chapter domain scores (domain columns use the 0–4 scale)"
        if sample_mode
        else "Overall ranking and domain scores (domain columns use the 0–4 scale)"
    )
    table = f'<div class="table-scroll" tabindex="0" aria-label="Sortable scorecard"><table data-sortable><caption>{esc(caption)}</caption><thead><tr>{header_html}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>'

    winners = sequence(data.get("category_winners"))
    winner_cards = []
    title_lookup = {book_id(book, index): book_title(book) for index, book in enumerate(books)}
    for winner in winners:
        item = mapping(winner)
        leaders = [title_lookup.get(str(value), str(value)) for value in sequence(item.get("book_ids") or item.get("books") or item.get("book_id"))]
        winner_cards.append(
            '<div class="metric"><span class="metric-label">' + esc(item.get("category") or item.get("domain") or item.get("domain_key")) + '</span><span class="metric-value">' + esc(", ".join(leaders) or "Not recorded") + '</span><span>' + esc(f"{'Sample domain score' if sample_mode else 'Domain score'} {display_number(item.get('score'), 2)}") + "</span></div>"
        )
    analysis = mapping(data.get("cross_book_analysis"))
    leader_note = analysis.get("meaningful_score_differences") or analysis.get("leader_explanation") or "Interpret close scores with the evidence, gates, confidence, and effective-tie labels shown above."
    leader_heading = "How the observed sample leaders differ" if sample_mode else "Why the leaders differ"
    return table + f'<div class="panel"><h3>{esc(leader_heading)}</h3><p>' + esc(leader_note) + '</p></div><div class="winner-grid">' + "".join(winner_cards) + "</div>"


def render_remediation(data: Mapping[str, Any], books: Sequence[Mapping[str, Any]], slugs: Mapping[str, str]) -> str:
    summary = mapping(data.get("remediation_summary"))
    counts = mapping(summary.get("conditions"))
    priorities = mapping(summary.get("priorities"))
    metrics = (
        '<div class="metrics-grid remediation-metrics">'
        + metric("Books with conditions", summary.get("books_with_conditions", 0), "Every low score remains traceable")
        + metric("Overall below 80", summary.get("books_below_80_overall", counts.get("overall", 0)), "80.0 passes")
        + metric("Low domains", counts.get("domain", 0), "First passing domain floor: 3.25/4")
        + metric("Low subcriteria", counts.get("subcriterion", 0), "Integer ratings first pass at 4/4")
        + '</div><div class="panel"><h3>Priority mix</h3>'
        + "".join(f'<span class="badge {key.casefold()}">{key}: {esc(priorities.get(key, 0))}</span>' for key in ("P0", "P1", "P2", "P3"))
        + '<p class="method-note">Arithmetic contributions are planning scenarios, not forecasts. Gate status remains independent.</p></div>'
    )

    matrix_head = '<tr><th class="sticky-column">Book</th><th>Overall</th>' + "".join(f'<th>{esc(definition["name"])}</th>' for definition in DOMAIN_CATALOG.values()) + '</tr>'
    matrix_rows: list[str] = []
    cards: list[str] = []
    for index, book in enumerate(books):
        identifier = book_id(book, index)
        remediation = mapping(book.get("remediation"))
        conditions = sequence(remediation.get("conditions"))
        condition_domains: dict[str, list[Mapping[str, Any]]] = {}
        for raw in conditions:
            condition = mapping(raw)
            key = str(condition.get("domain_key") or "")
            if key:
                condition_domains.setdefault(key, []).append(condition)
        domain_cells = []
        for domain_key in DOMAIN_CATALOG:
            score = domain_score(book, domain_key)
            related = condition_domains.get(domain_key, [])
            sub_count = sum(mapping(item).get("scope") == "subcriterion" for item in related)
            domain_cells.append(f'<td class="remediation-cell {"below" if score < 3.2 else "pass"}"><strong>{score:.2f}/4</strong><span>{score / 4 * 100:.1f}% · {sub_count} low subcriteria</span></td>')
        matrix_rows.append(
            f'<tr data-remediation-matrix-book="{attr(identifier)}"><th scope="row" class="sticky-column"><a href="#remediation-{attr(slugs[identifier])}">{esc(book_title(book))}</a></th>'
            f'<td class="numeric">{finite(book.get("overall_score")):.1f}</td>' + "".join(domain_cells) + '</tr>'
        )

        condition_rows = []
        for raw in conditions:
            condition = mapping(raw)
            current_suffix = "/100" if condition.get("scope") == "overall" else "/4"
            condition_rows.append(
                f'<tr data-priority="{attr(condition.get("priority"))}" data-domain="{attr(condition.get("domain_key") or "overall")}">'
                f'<td><code>{esc(condition.get("id"))}</code></td><td>{badge(condition.get("priority"), str(condition.get("priority") or "").lower())}</td>'
                f'<td>{esc(condition.get("scope"))}</td><td>{esc(condition.get("label"))}</td>'
                f'<td class="numeric">{display_number(condition.get("current"), 2)}{current_suffix}</td><td class="numeric">{display_number(condition.get("percent"), 1)}%</td>'
                f'<td>{esc(condition.get("evidence_class") or "score-only")}</td><td>{esc(condition.get("verification"))}</td></tr>'
            )
        ledger = (
            '<div class="table-scroll remediation-ledger"><table><caption>Complete strict-below-80 condition ledger</caption>'
            '<thead><tr><th>ID</th><th>Priority</th><th>Scope</th><th>Condition</th><th>Current</th><th>Percent</th><th>Evidence</th><th>Verification</th></tr></thead><tbody>'
            + "".join(condition_rows) + '</tbody></table></div>'
        )
        workstream_html = []
        for stream_raw in sequence(remediation.get("workstreams")):
            stream = mapping(stream_raw)
            signal_texts = [
                f'{mapping(item).get("label")}: ' + ", ".join(f"{key}={value}" for key, value in mapping(mapping(item).get("values")).items())
                for item in sequence(stream.get("supporting_signals"))
            ]
            chapter_texts = [
                f'Chapter {mapping(item).get("number")}: {mapping(item).get("title")} — {mapping(item).get("evidence_status")}'
                + (f'; matched {", ".join(str(value) for value in sequence(mapping(item).get("matched_terms")))}' if sequence(mapping(item).get("matched_terms")) else "")
                + f'. {mapping(item).get("navigation_context")}'
                for item in sequence(stream.get("chapter_targets"))
            ]
            workstream_html.append(
                f'<details class="remediation-workstream"><summary><strong>{esc(stream.get("priority"))} · {esc(stream.get("domain"))}</strong> — {esc(", ".join(str(value) for value in sequence(stream.get("condition_ids"))))}</summary>'
                f'<p>Current: {display_number(stream.get("current_score"), 2)}/4 · modeled lift to threshold: {display_number(stream.get("modeled_lift_to_floor"), 2)} points.</p>'
                f'<h4>Mapped evidence</h4>{html_list(stream.get("evidence") or ["No domain-specific evidence supplied; verify from source."])}'
                f'<h4>Contextual signals</h4>{html_list(signal_texts or ["No domain-mapped diagnostic signal."])}'
                f'<h4>Ranked chapter/source targets</h4>{html_list(chapter_texts or ["Inspect the complete source package."])}'
                f'<h4>Known unknowns</h4>{html_list(stream.get("unknowns"))}'
                f'<h4>Implementation</h4>{html_list(stream.get("instructions"))}<h4>Acceptance criteria</h4>{html_list(stream.get("acceptance"))}</details>'
            )
        prompt = str(remediation.get("prompt_markdown") or "")
        priority_values = sorted({str(mapping(item).get("priority") or "") for item in conditions if mapping(item).get("priority")})
        domain_values = sorted(condition_domains)
        haystack = " ".join([book_title(book)] + [text_value(item) for item in conditions] + [text_value(item) for item in sequence(remediation.get("direct_evidence"))])
        scope_grid = definition_grid([
            ("Current overall", f"{finite(book.get('overall_score')):.1f}/100"),
            ("Minimum lift to 80", f"{finite(remediation.get('minimum_overall_lift')):.1f} points"),
            ("Evaluation mode", remediation.get("evaluation_mode") or "Not supplied"),
            ("Overall below 80", remediation.get("overall_below_80")),
            ("P0 / P1 / P2 / P3", " / ".join(str(mapping(remediation.get("priority_counts")).get(key, 0)) for key in ("P0", "P1", "P2", "P3"))),
        ])
        rendered_workstreams = "".join(workstream_html) or "<p>No workstreams were generated.</p>"
        cards.append(
            f'<details class="book-detail remediation-book" id="remediation-{attr(slugs[identifier])}" data-book-id="{attr(identifier)}" '
            f'data-priorities="{attr(" ".join(priority_values))}" data-domains="{attr(" ".join(domain_values))}" data-search="{attr(haystack.casefold())}">'
            f'<summary><span class="book-summary-line"><span>{esc(book_title(book))}</span><span>{finite(book.get("overall_score")):.1f}/100 · {int(finite(remediation.get("condition_count")))} conditions</span></span></summary>'
            f'<div class="book-detail-body"><div class="summary-grid"><div class="panel"><h3>Score-lift scope</h3>{scope_grid}</div>'
            f'<div class="panel"><h3>Evidence boundary</h3><p>Score-only rows require source inspection before any diagnosis. Diagnostics are supporting signals, and modeled lift never overrides a gate.</p><p><a href="#book-{attr(slugs[identifier])}">Open full book evaluation</a></p></div></div>'
            f'{ledger}<div class="panel"><h3>Prioritized workstreams</h3>{rendered_workstreams}</div>'
            f'<details class="panel remediation-prompt-panel"><summary><strong>Comprehensive implementation prompt</strong></summary><div class="panel-heading-row"><button type="button" class="button remediation-copy" data-book-id="{attr(identifier)}">Copy prompt</button><button type="button" class="button secondary remediation-download" data-book-id="{attr(identifier)}">Download Markdown</button></div><pre class="code-block remediation-prompt">{esc(prompt or "Prompt not generated.")}</pre></details></div></details>'
        )
    matrix = '<div class="panel"><h3>Book × domain remediation matrix</h3><p>Each cell shows domain score, normalized percentage, and strict-below-80 subcriterion count.</p><div class="table-scroll remediation-matrix"><table><thead>' + matrix_head + '</thead><tbody>' + "".join(matrix_rows) + '</tbody></table></div></div>'
    return metrics + matrix + '<div id="remediation-books">' + "".join(cards) + '</div>'


def render_rubric(data: Mapping[str, Any], parsed: Mapping[str, Any]) -> str:
    sample_mode = is_sample_report(data)
    philosophy = sequence(parsed.get("philosophy")) or DEFAULT_PHILOSOPHY
    calculation_title = "Experimental sample calculation and interpretation" if sample_mode else "Calculation and interpretation"
    score_name = "Experimental chapter-sample score" if sample_mode else "Content Design Score"
    score_interpretation = (
        '<p>Score bands are exploratory descriptions of the selected chapters only; they are not full-book classifications or certifications.</p>'
        '<p>Primary raters use integers. Half-points are allowed only after explicit adjudication. A 4 requires exemplary evidence across the selected sample and does not support a full-book inference.</p>'
        if sample_mode
        else '<p>Primary raters use integers. Half-points are allowed only after explicit adjudication. A 4 is rare and requires book-wide evidence.</p>'
    )
    band_html = (
        '<ul><li>90–100: Exceptional observed sample design</li><li>80–89.9: Strong observed sample design</li><li>70–79.9: Valuable but materially uneven selected chapters</li><li>60–69.9: Substantial redesign signals in selected chapters</li><li>Below 60: Major redesign signals in selected chapters</li></ul>'
        if sample_mode
        else '<ul><li>90–100: Reference-standard design, subject to gate and core-domain rules</li><li>80–89.9: Strong design with identifiable improvements</li><li>70–79.9: Valuable but materially uneven; targeted redesign needed</li><li>60–69.9: Substantial redesign needed</li><li>Below 60: Not ready as a ChapterFlow learning product</li></ul>'
    )
    intro = (
        '<div class="rubric-intro"><div class="panel"><h3>Learning pathway and philosophy</h3>'
        '<p><strong>Pathway:</strong> attention → manageable processing → coherent understanding → active construction → retrieval → transfer → motivated and calibrated action.</p>'
        + html_list(philosophy)
        + f'</div><div class="panel"><h3>{esc(calculation_title)}</h3>'
        f'<p><code>Domain score = mean of four ratings</code><br><code>Weighted points = (domain score ÷ 4) × weight</code><br><code>{esc(score_name)} = sum of nine weighted point values</code></p>'
        + band_html + score_interpretation + '</div></div>'
    )
    gates = []
    for key, label in GATE_LABELS.items():
        gate = mapping(mapping(parsed.get("gates")).get(key))
        gates.append(f'<li><strong>{esc(gate.get("name") or label)}:</strong> {esc(" ".join(sequence(gate.get("lines"))) or "Assessed separately from the weighted score.")}</li>')
    gate_html = '<div class="panel"><h3>Hard gates</h3><ol>' + "".join(gates) + '</ol><p>External accuracy is <strong>not assessed</strong> in the default isolated run. A high weighted score cannot erase a safety, ethics, or completeness failure.</p></div>'
    base_html = '<div class="panel"><h3>Base 0–4 rating scale</h3><ol class="anchor-list">' + "".join(
        f'<li><span class="anchor-rating">{rating}</span><span>{esc(sample_limited_text(text) if sample_mode else text)}</span></li>' for rating, text in BASE_ANCHORS.items()
    ) + "</ol></div>"

    domain_blocks = []
    parsed_domains = mapping(parsed.get("domains"))
    for domain_index, (key, fallback) in enumerate(DOMAIN_CATALOG.items(), start=1):
        domain = mapping(parsed_domains.get(key))
        sub_blocks = []
        parsed_subcriteria = mapping(domain.get("subcriteria"))
        for sub_index, (sub_key, sub_name) in enumerate(fallback["subcriteria"].items(), start=1):
            criterion = mapping(parsed_subcriteria.get(sub_key))
            anchors = mapping(criterion.get("anchors"))
            anchor_html = "".join(
                f'<li><span class="anchor-rating">{rating}</span><span>{esc(sample_limited_text(anchors.get(rating, anchors.get(str(rating), BASE_ANCHORS[rating]))) if sample_mode else anchors.get(rating, anchors.get(str(rating), BASE_ANCHORS[rating])))}</span></li>'
                for rating in range(5)
            )
            sub_blocks.append(
                f'<section class="rubric-criterion" data-subcriterion="{attr(sub_key)}"><h4>{domain_index}.{sub_index} {esc(criterion.get("name") or sub_name)}</h4><ol class="anchor-list">{anchor_html}</ol></section>'
            )
        domain_blocks.append(
            f'<details class="rubric-domain" data-domain="{attr(key)}"><summary>Domain {domain_index}: {esc(domain.get("name") or fallback["name"])}{esc(" — sample-limited estimate" if sample_mode and key == "whole_book_coherence" else "")} — {int(finite(domain.get("weight"), fallback["weight"]))}%</summary><div class="rubric-domain-body"><p>{esc(sample_limited_text(domain.get("purpose") or "Purpose is defined by the observable learning-design function represented by this domain.") if sample_mode else domain.get("purpose") or "Purpose is defined by the observable learning-design function represented by this domain.")}</p>{"".join(sub_blocks)}</div></details>'
        )
    evidence = sequence(parsed.get("evidence")) or [
        "Record at least two chapter-level strengths, one limitation, one whole-book pattern, and a rationale tied to the selected anchor for every domain.",
        "Use concise paraphrases and precise local locators; do not reproduce full chapter text.",
        "Component quantity alone earns no score, and the same evidence should not be double-counted without a distinct function.",
    ]
    if sample_mode:
        evidence = [sample_limited_text(item) for item in evidence]
    evidence_html = '<div class="panel"><h3>Evidence requirements and outcome boundary</h3>' + html_list(evidence) + '<p><strong>Design/outcome distinction:</strong> the report assesses retention support, transfer support, behavior-change support, and completion value. No actual retention, behavior change, completion, or satisfaction was measured.</p></div>'
    return f'<div id="rubric-explorer">{intro}{gate_html}{base_html}{"".join(domain_blocks)}{evidence_html}</div>'


def rater_values(book: Mapping[str, Any], domain_key: str, sub_key: str, criterion: Mapping[str, Any]) -> tuple[Any, Any, Any]:
    path = f"domains.{domain_key}.subcriteria.{sub_key}"
    values = mapping(mapping(book.get("rater_values")).get(path))
    final = criterion.get("rating")
    primary = values.get("primary", criterion.get("primary_rating"))
    verification = values.get("verification", criterion.get("verification_rating"))
    if primary is not None or verification is not None:
        return primary, verification, values.get("final", final)
    for disagreement in sequence(mapping(book.get("rater_agreement")).get("disagreements")):
        item = mapping(disagreement)
        if str(item.get("path") or "").endswith(path) or path in str(item.get("path") or ""):
            return item.get("primary"), item.get("verification"), item.get("final", final)
    return None, None, final


def render_findings(findings: Any, empty: str = "No findings recorded.") -> str:
    items = sequence(findings)
    if not items:
        return f"<p>{esc(empty)}</p>"
    result = ['<ul class="finding-list">']
    for raw in items:
        finding = mapping(raw)
        if not finding:
            result.append(f'<li class="finding info"><p>{esc(text_value(raw))}</p></li>')
            continue
        severity = str(finding.get("severity") or "info").lower()
        result.append(
            f'<li class="finding {attr(severity)}">{badge(severity)} <strong>{esc(finding.get("type") or "finding")}</strong>'
            f'<p>{esc(finding.get("description") or finding.get("rationale") or text_value(finding))}</p>'
            f'<p class="finding-meta">Locator: {esc(finding.get("locator") or "not recorded")} · Reader-facing: {esc(finding.get("reader_facing", "not recorded"))} · Treatment: {esc(finding.get("scoring_treatment") or "not recorded")}</p></li>'
        )
    result.append("</ul>")
    return "".join(result)


def render_book_agreement(book: Mapping[str, Any], *, sample_mode: bool = False) -> str:
    agreement = mapping(book.get("rater_agreement"))
    confidence = mapping(book.get("confidence"))
    summary = definition_grid(
        [
            ("Mean absolute subcriterion difference", display_number(agreement.get("mean_absolute_subcriterion_difference"), 2)),
            ("Maximum subcriterion difference", display_number(agreement.get("maximum_subcriterion_difference"), 2)),
            ("Experimental sample score gap" if sample_mode else "Overall score gap", display_number(agreement.get("overall_score_difference"), 1)),
            ("Gate conflicts", agreement.get("gate_conflicts") or "None"),
            ("Confidence rationale", confidence.get("rationale")),
            ("Package ambiguity", confidence.get("package_ambiguity")),
        ]
    )
    disagreements = sequence(agreement.get("disagreements"))
    if disagreements:
        rows = []
        for raw in disagreements:
            item = mapping(raw)
            rows.append(
                "<tr>"
                f'<th scope="row">{esc(item.get("path"))}</th><td class="numeric">{esc(display_number(item.get("primary"), 1))}</td>'
                f'<td class="numeric">{esc(display_number(item.get("verification"), 1))}</td><td class="numeric">{esc(display_number(item.get("final"), 1))}</td>'
                f'<td>{esc(item.get("adjudication_rationale") or "Not recorded")}</td><td>{esc("Yes" if item.get("source_rechecked") else "No")}</td>'
                "</tr>"
            )
        disagreement_html = '<div class="table-scroll"><table><caption>Adjudicated disagreements</caption><thead><tr><th>Path</th><th>Primary</th><th>Verification</th><th>Final</th><th>Rationale</th><th>Source rechecked</th></tr></thead><tbody>' + "".join(rows) + "</tbody></table></div>"
    else:
        disagreement_html = "<p>No rating disagreement records were required.</p>"
    return summary + disagreement_html


def render_book_details(data: Mapping[str, Any], books: Sequence[Mapping[str, Any]], slugs: Mapping[str, str]) -> str:
    sample_mode = is_sample_report(data)
    blocks = []
    for index, book in enumerate(books):
        meta = book_meta(book)
        identifier = book_id(book, index)
        score = finite(book.get("overall_score"))
        confidence = mapping(book.get("confidence"))
        rank = int(finite(book.get("rank"), index + 1))
        scope = book_sample_scope(book)
        selected_positions = selected_chapter_positions(scope)
        original_source = mapping(scope.get("original_source"))
        population_count = scope.get("population_chapter_count", scope.get("source_chapter_count", original_source.get("chapter_count")))
        selected_count = scope.get("selected_chapter_count", scope.get("actual_chapter_count", len(selected_positions)))
        order_label = "Sample order" if sample_mode else "#"
        score_label = "experimental sample score" if sample_mode else "score"
        status_badge = (
            badge(book.get("certification_status"), "Sample gate status")
            if sample_mode
            else badge(book.get("certification_status"), "Certification")
        )
        summary = (
            f'<summary><span class="book-summary-line"><span>{esc(order_label)} {rank} · {esc(book_title(book))}</span>'
            f'<span class="book-score" data-book-score="{attr(identifier)}" data-score-value="{score:.8f}">{score:.1f}/100 {esc(score_label)}</span>'
            f'{status_badge}{badge(confidence.get("level"), "Confidence")}</span></summary>'
        )
        classification_label = "Sample score band" if sample_mode else "Classification"
        source_hash_label = "Sampled package hash" if sample_mode else "Source hash"
        identity = definition_grid(
            [
                (classification_label, book.get("classification")), ("Package path", meta.get("package_path")),
                (source_hash_label, book.get("source_hash") or meta.get("source_hash")),
                *(([("Original source hash", scope.get("original_source_sha256") or original_source.get("sha256"))] if sample_mode else [])),
                ("Package format", meta.get("package_format")),
                ("Nonfiction type", meta.get("nonfiction_type")), ("Audience", meta.get("declared_or_inferred_audience")),
                ("Assumed prior knowledge", meta.get("assumed_prior_knowledge")), ("Purpose", meta.get("declared_or_inferred_purpose")),
                ("Intended outcomes", meta.get("intended_outcomes")), ("Contexts and exclusions", meta.get("contexts_and_exclusions")),
                ("Default reader construct fit", meta.get("default_reader_construct_fit") or meta.get("reader_construct_fit")),
            ]
        )
        if sample_mode:
            inventory_rows = [
                ("Population chapters", population_count),
                ("Selected chapters", selected_count),
                ("Selected source positions", ", ".join(str(value) for value in selected_positions)),
                ("Selected chapters read in full", meta.get("chapter_count_read_full")),
                ("Selected partial", meta.get("chapter_count_partial")),
                ("Selected inaccessible", meta.get("chapter_count_inaccessible")),
                ("Sample read coverage", f"{finite(confidence.get('chapter_completeness_ratio')) * 100:.1f}%"),
                ("Selected-chapter estimated words", meta.get("word_count_estimate")),
                ("Selected-chapter components", meta.get("component_inventory")),
            ]
        else:
            inventory_rows = [
                ("Chapters expected", meta.get("chapter_count_expected")), ("Read in full", meta.get("chapter_count_read_full")),
                ("Partial", meta.get("chapter_count_partial")), ("Inaccessible", meta.get("chapter_count_inaccessible")),
                ("All accessible chapters read", meta.get("all_accessible_chapters_read")), ("Estimated words", meta.get("word_count_estimate")),
                ("Components", meta.get("component_inventory")),
            ]
        inventory = definition_grid(inventory_rows)
        gate_rows = []
        gates = mapping(book.get("gates"))
        for gate_key, gate_label in GATE_LABELS.items():
            gate = mapping(gates.get(gate_key))
            gate_rows.append(
                f'<tr><th scope="row">{esc(gate_label)}</th><td>{badge(gate.get("status"))}</td><td>{esc(gate.get("rationale") or "Not recorded")}</td><td>{html_list(gate.get("evidence"), "No gate evidence recorded.")}</td></tr>'
            )
        gate_caption = "Selected-chapter hard-gate assessment" if sample_mode else "Independent hard-gate assessment"
        gates_html = f'<div class="table-scroll"><table><caption>{esc(gate_caption)}</caption><thead><tr><th>Gate</th><th>Status</th><th>Rationale</th><th>Evidence</th></tr></thead><tbody>' + "".join(gate_rows) + "</tbody></table></div>"

        score_rows = []
        audit_rows = []
        disagreements = sequence(mapping(book.get("rater_agreement")).get("disagreements"))
        disagreement_paths = {str(mapping(item).get("path") or "") for item in disagreements}
        domains = mapping(book.get("domains"))
        for domain_index, (domain_key, definition) in enumerate(DOMAIN_CATALOG.items(), start=1):
            domain = mapping(domains.get(domain_key))
            d_score = domain_score(book, domain_key)
            weighted = finite(domain.get("weighted_points"), d_score / 4 * definition["weight"])
            audit_rows.append(
                f'<div class="weight-row"><span>{esc(definition["name"])} ({definition["weight"]}%)</span><span class="meter" aria-hidden="true"><span class="meter-fill" style="inline-size:{max(0, min(100, weighted / definition["weight"] * 100)):.3f}%"></span></span><strong>{weighted:.2f}</strong></div>'
            )
            subcriteria = mapping(domain.get("subcriteria"))
            for sub_index, (sub_key, sub_name) in enumerate(definition["subcriteria"].items(), start=1):
                criterion = mapping(subcriteria.get(sub_key))
                primary, verification, final = rater_values(book, domain_key, sub_key, criterion)
                path = f"domains.{domain_key}.subcriteria.{sub_key}"
                disagreed = any(path in candidate for candidate in disagreement_paths) or (
                    primary is not None and verification is not None and finite(primary) != finite(verification)
                )
                evidence = (
                    '<details class="score-evidence"><summary>Rationale and evidence</summary>'
                    f'<p><strong>Rationale:</strong> {esc(criterion.get("rationale") or "Not recorded")}</p>'
                    f'<p><strong>Strengths:</strong></p>{html_list(criterion.get("strength_evidence"), "No strength evidence recorded.")}'
                    f'<p><strong>Limitations:</strong></p>{html_list(criterion.get("limitation_evidence"), "No limitation evidence recorded.")}</details>'
                )
                score_rows.append(
                    f'<tr class="subcriterion-row" data-disagreement="{str(disagreed).lower()}"><th scope="row">{domain_index}.{sub_index} {esc(sub_name)}{evidence}</th>'
                    f'<td>{esc(definition["name"])}</td><td class="numeric">{esc(display_number(final, 1))}</td>'
                    f'<td class="numeric">{esc(display_number(primary, 1))}</td><td class="numeric">{esc(display_number(verification, 1))}</td></tr>'
                )
        score_caption = "All 36 sample-estimate subcriteria: final and blind-rater values" if sample_mode else "All 36 subcriteria: final and blind-rater values"
        scores_html = f'<div class="table-scroll" tabindex="0"><table><caption>{esc(score_caption)}</caption><thead><tr><th>Subcriterion</th><th>Domain</th><th>Final</th><th>Primary</th><th>Verification</th></tr></thead><tbody>' + "".join(score_rows) + "</tbody></table></div>"
        total_label = "Experimental chapter-sample score" if sample_mode else "Total Content Design Score"
        audit_html = '<div class="panel"><h3>Weighted-point arithmetic audit</h3><div class="weight-audit">' + "".join(audit_rows) + f'</div><p><strong>{esc(total_label)}:</strong> {score:.1f}/100</p></div>'

        analysis = mapping(book.get("analysis"))
        engagement = sequence(analysis.get("engagement_curve"))
        engagement_html = html_list(
            [f"{mapping(item).get('chapter_range', 'Range not recorded')} — {mapping(item).get('direction', 'not recorded')}: {mapping(item).get('explanation', '')}" for item in engagement],
            "No engagement curve was recorded.",
        )
        analysis_html = (
            f'<div class="panel"><h3>{"Observed sample reader experience" if sample_mode else "Overall reader experience"}</h3><p>' + esc(analysis.get("overall_reader_experience") or "Not recorded.") + '</p></div>'
            f'<div class="analysis-grid"><div class="panel"><h3>{"Sample strengths" if sample_mode else "Strongest qualities"}</h3>' + html_list(analysis.get("strongest_qualities")) + '</div>'
            f'<div class="panel"><h3>{"Sample limitations" if sample_mode else "Weakest qualities"}</h3>' + html_list(analysis.get("weakest_qualities")) + '</div>'
            '<div class="panel"><h3>Engagement curve</h3>' + engagement_html + '</div>'
            '<div class="panel"><h3>Comprehension and retention support</h3><p>' + esc(analysis.get("comprehension_and_retention_support") or "Not recorded.") + '</p></div>'
            '<div class="panel"><h3>Practical use and judgment</h3><p>' + esc(analysis.get("practical_use_and_judgment") or "Not recorded.") + '</p></div>'
            '<div class="panel"><h3>Reader fit</h3>' + definition_grid([("Best fit", analysis.get("best_fit_reader")), ("May struggle", analysis.get("readers_who_may_struggle"))]) + '</div></div>'
            f'<div class="panel"><h3>{"Three provisional sample-based improvements" if sample_mode else "Three highest-impact improvements"}</h3>' + html_list(analysis.get("highest_impact_improvements"), "No improvements recorded.") + '</div>'
            f'<div class="panel"><h3>{"Sample-limited verdict" if sample_mode else "Final verdict"}</h3><p>' + esc(analysis.get("final_verdict") or "Not recorded.") + '</p></div>'
        )
        findings_html = '<div class="panel"><h3>Technical findings</h3>' + render_findings(book.get("technical_findings")) + "</div>"
        agreement_html = '<div class="panel"><h3>Rater disagreement and adjudication</h3>' + render_book_agreement(book, sample_mode=sample_mode) + "</div>"
        calibration_html = '<div class="panel"><h3>Cross-book calibration changes</h3>' + html_list(book.get("calibration_changes"), "No calibration changes were made.") + "</div>"
        blocks.append(
            f'<details class="book-detail" id="book-{attr(slugs[identifier])}" {"open" if index == 0 else ""}>{summary}<div class="book-detail-body">'
            f'<div class="summary-grid"><div class="panel"><h3>{"Book identity and sample reader construct" if sample_mode else "Book and reader construct"}</h3>{identity}</div><div class="panel"><h3>{"Selected-chapter scope and component inventory" if sample_mode else "Chapter and component inventory"}</h3>{inventory}</div></div>'
            f'{findings_html}<div class="panel"><h3>Gate assessment and evidence</h3>{gates_html}</div><div class="panel"><h3>Subcriterion score audit</h3>{scores_html}</div>{audit_html}{agreement_html}{calibration_html}{analysis_html}</div></details>'
        )
    return "".join(blocks) or '<p class="notice">No adjudicated book records were available.</p>'


def render_chapter_card(book: Mapping[str, Any], chapter: Mapping[str, Any], book_index: int, chapter_index: int) -> str:
    title = chapter.get("title") or chapter.get("chapter_id") or "Untitled"
    index_value = chapter.get("chapter_index", chapter_index + 1)
    fields = [
        ("Central ideas", chapter.get("central_ideas")), ("Mental-model contribution", chapter.get("mental_model_contribution")),
        ("Engagement and pacing", chapter.get("engagement_and_pacing")), ("Learning support", chapter.get("learning_support")),
        ("Retention and retrieval support", chapter.get("retention_support") or chapter.get("retention_retrieval_support")),
        ("Transfer and action support", chapter.get("transfer_support") or chapter.get("transfer_action_support")),
        ("QA, trust, or safety issues", chapter.get("trust_qa_safety_issues")), ("Paraphrased evidence and locators", chapter.get("evidence")),
    ]
    field_blocks = []
    for label, value in fields:
        rendered_value = html_list(value) if isinstance(value, list) else f'<p>{esc(text_value(value) or "Not recorded.")}</p>'
        field_blocks.append(f'<section><h4>{esc(label)}</h4>{rendered_value}</section>')
    body = "".join(field_blocks)
    return (
        f'<details class="chapter-card"><summary>{esc(book_title(book))} · Chapter {esc(index_value)}: {esc(title)}</summary>'
        f'<div class="chapter-card-body"><p class="chapter-meta">{badge(chapter.get("read_status"), "Read")}'
        f'<span>Chapter ID: {esc(chapter.get("chapter_id") or "not recorded")}</span></p><div class="chapter-fields">{body}</div></div></details>'
    )


def render_chapter_fallback(books: Sequence[Mapping[str, Any]]) -> str:
    cards = []
    for book_index, book in enumerate(books):
        chapters = [mapping(item) for item in sequence(book.get("chapter_evidence"))]
        chapters.sort(key=lambda item: (finite(item.get("chapter_index"), 10**9), str(item.get("chapter_id") or "")))
        for chapter_index, chapter in enumerate(chapters):
            cards.append(render_chapter_card(book, chapter, book_index, chapter_index))
    return "".join(cards) or "<p>No chapter-level evidence was recorded.</p>"


def render_qa(books: Sequence[Mapping[str, Any]]) -> str:
    blocks = []
    for book in books:
        qa = mapping(book.get("qa"))
        confidence = mapping(book.get("confidence"))
        diagnostics = []
        for key, label in (
            ("semantic_quiz_issues", "Semantic quiz and answer-key issues"),
            ("formulaic_pattern_notes", "Repeated or formulaic patterns"),
            ("answer_length_cue_analytics", "Answer-length cue analytics"),
            ("duplicate_content_hashes", "Duplicate content hashes"),
            ("self_validation_notes", "Self-validation notes"),
        ):
            value = qa.get(key) or book.get(key)
            diagnostics.append(f'<h4>{esc(label)}</h4>{html_list(value, "None recorded or not computed.")}')
        diagnostics.append('<h4>Unresolved issues</h4>' + html_list(confidence.get("unresolved_issues"), "None recorded."))
        diagnostics.append('<h4>Gate consequences</h4>' + html_list([f"{GATE_LABELS.get(key, key)}: {mapping(value).get('status', 'not assessed')} — {mapping(value).get('rationale', '')}" for key, value in mapping(book.get("gates")).items()]))
        blocks.append(
            f'<details class="panel"><summary><strong>{esc(book_title(book))}</strong></summary><div><h3>Technical findings</h3>{render_findings(book.get("technical_findings"))}{"".join(diagnostics)}</div></details>'
        )
    return "".join(blocks) or "<p>No QA records were available.</p>"


def render_agreement(data: Mapping[str, Any], books: Sequence[Mapping[str, Any]]) -> str:
    sample_mode = is_sample_report(data)
    rows = []
    details = []
    for book in books:
        agreement = mapping(book.get("rater_agreement"))
        confidence = mapping(book.get("confidence"))
        rows.append(
            f'<tr><th scope="row">{esc(book_title(book))}</th><td class="numeric">{esc(display_number(agreement.get("mean_absolute_subcriterion_difference"), 2))}</td>'
            f'<td class="numeric">{esc(display_number(agreement.get("maximum_subcriterion_difference"), 2))}</td><td class="numeric">{esc(display_number(agreement.get("overall_score_difference"), 1))}</td>'
            f'<td>{esc(text_value(agreement.get("gate_conflicts")) or "None")}</td><td>{badge(confidence.get("level"))}</td></tr>'
        )
        details.append(f'<details class="panel"><summary><strong>{esc(book_title(book))}: disagreement matrix and calibration</strong></summary>{render_book_agreement(book, sample_mode=sample_mode)}<h4>Calibration changes</h4>{html_list(book.get("calibration_changes"), "No calibration changes.")}</details>')
    gap_label = "Experimental sample score gap" if sample_mode else "Overall score gap"
    table = f'<div class="table-scroll"><table><caption>Agreement summary</caption><thead><tr><th>Book</th><th>Mean absolute gap</th><th>Maximum gap</th><th>{esc(gap_label)}</th><th>Gate conflicts</th><th>Confidence</th></tr></thead><tbody>' + "".join(rows) + "</tbody></table></div>"
    return table + "".join(details)


def resolve_book_reference(value: Any, lookup: Mapping[str, str]) -> str:
    if isinstance(value, list):
        return ", ".join(resolve_book_reference(item, lookup) for item in value)
    return lookup.get(str(value), text_value(value))


def render_cross_book(data: Mapping[str, Any], books: Sequence[Mapping[str, Any]]) -> str:
    sample_mode = is_sample_report(data)
    analysis = mapping(data.get("cross_book_analysis"))
    lookup = {book_id(book, index): book_title(book) for index, book in enumerate(books)}
    summary = definition_grid(
        [
            ("Highest experimental sample score" if sample_mode else "Best overall content design", resolve_book_reference(analysis.get("best_overall_content_design"), lookup)),
            ("Meaningful sample score differences" if sample_mode else "Meaningful score differences", analysis.get("meaningful_score_differences")),
            ("Greatest observed sample improvement opportunity" if sample_mode else "Greatest targeted improvement opportunity", resolve_book_reference(analysis.get("greatest_targeted_improvement_opportunity"), lookup)),
            ("Most extensive redesign signal in the sample" if sample_mode else "Most extensive redesign need", resolve_book_reference(analysis.get("greatest_redesign_need") or analysis.get("most_extensive_redesign_need"), lookup)),
            ("Provisional content-team lesson from selected chapters" if sample_mode else "Most important content-team lesson", analysis.get("content_team_lesson") or analysis.get("most_important_lesson")),
        ]
    )
    winners = sequence(data.get("category_winners") or analysis.get("category_winners"))
    winner_html = []
    for raw in winners:
        winner = mapping(raw)
        winner_html.append(
            '<div class="metric"><span class="metric-label">' + esc(winner.get("category") or winner.get("domain_key") or "Category") + '</span>'
            '<span class="metric-value">' + esc(resolve_book_reference(winner.get("book_ids") or winner.get("book_id"), lookup) or "Not recorded") + '</span>'
            f'<span>{"Sample score" if sample_mode else "Score"}: ' + esc(display_number(winner.get("score"), 2)) + "</span></div>"
        )
    choose = mapping(analysis.get("choose_this_book_if"))
    recommendations = [f"{lookup.get(str(identifier), str(identifier))}: {text_value(recommendation)}" for identifier, recommendation in sorted(choose.items(), key=lambda item: lookup.get(str(item[0]), str(item[0])).casefold())]
    ranking = [f"#{int(finite(book.get('rank'), index + 1))} {book_title(book)} — {finite(book.get('overall_score')):.1f}/100" for index, book in enumerate(books)]
    limitations = sequence(data.get("limitations")) + sequence(analysis.get("limitations"))
    return (
        f'<div class="panel"><h3>{"Experimental selected-chapter synthesis" if sample_mode else "Comparative synthesis"}</h3>' + summary + '</div><div class="winner-grid">' + "".join(winner_html) + '</div>'
        f'<div class="analysis-grid"><div class="panel"><h3>{"Experimental sample order" if sample_mode else "Overall ranking"}</h3>' + html_list(ranking) + f'</div><div class="panel"><h3>{"Based on selected chapters, consider this book if…" if sample_mode else "Choose this book if…"}</h3>' + html_list(recommendations, "No contextual recommendations were recorded.") + '</div></div>'
        '<div class="panel"><h3>Limitations and uncertainty</h3>' + html_list(limitations, "No additional comparative limitations were recorded.") + "</div>"
    )


def render_methods(data: Mapping[str, Any]) -> str:
    run = mapping(data.get("run"))
    sample_mode = is_sample_report(data)
    sampling = sampling_metadata(data)
    if sample_mode:
        population = int(finite(sampling.get("population_chapter_count")))
        selected = int(finite(sampling.get("selected_chapter_count")))
        not_sampled = int(finite(sampling.get("not_sampled_chapter_count")))
        method = (
            f"A reproducible {sampling.get('selection_algorithm') or 'SHA-256'} ranking selected up to "
            f"{sampling.get('requested_chapters_per_book') or 4} chapters per book from a population of {population} chapters. "
            f"The experiment inspected {selected} selected chapters; {not_sampled} chapters were not sampled or read. "
            "Two blind raters scored all 36 subcriteria using only the identical selected chapters, and a separate adjudicator "
            "resolved differences from selected-source evidence and rubric anchors. Deterministic code recalculated sample domain "
            "means, weighted points, gate status, and experimental sample order before sample-limited cross-book calibration."
        )
    else:
        method = (
            "Every accessible reader-facing chapter and component was read in an isolated repository-local session. "
            "Two blind raters scored all 36 subcriteria, a separate adjudicator resolved differences from source evidence and anchors, "
            "and deterministic code recalculated domain means, weighted points, certification, and ranking before cross-book calibration."
        )
    versions = definition_grid(
        [
            ("Schema version", data.get("schema_version")), ("Rubric version", data.get("rubric_version")),
            ("Generated at (UTC)", data.get("generated_at_utc")), ("Formula", mapping(data.get("rubric")).get("formula")),
            ("Isolation", run.get("isolation_mode") or "No web, external reviews, reputation, prior scores, or memory used as evidence"),
            *(([
                ("Sampling seed", sampling.get("sampling_seed")),
                ("Selection algorithm", sampling.get("selection_algorithm")),
                ("Selection manifest SHA-256", sampling.get("selection_manifest_sha256")),
                ("Population chapters", sampling.get("population_chapter_count")),
                ("Selected chapters", sampling.get("selected_chapter_count")),
                ("Not sampled", sampling.get("not_sampled_chapter_count")),
            ] if sample_mode else [])),
        ]
    )
    manifest = json.dumps(run, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False)
    score_name = "Experimental chapter-sample score" if sample_mode else "Content Design Score"
    scope_boundary = (
        f'<p><strong>Sample inference boundary:</strong> {esc(SAMPLE_WARNING)} No unsampled content contributed evidence, credit, penalty, gate status, ordering, or recommendations.</p>'
        if sample_mode else ""
    )
    return (
        f'<div class="panel"><h3>{"Experimental chapter-sample methodology" if sample_mode else "Methodology"}</h3><p>{esc(method)}</p><p><strong>Formula:</strong> Domain score = mean of four subcriterion ratings. Weighted points = (domain score ÷ 4) × domain weight. {esc(score_name)} = sum of all nine weighted-point values.</p>'
        + scope_boundary +
        '<p><strong>Outcome boundary:</strong> this inspection evaluates observable retention, transfer, behavior-change, and completion support. It did not measure actual reader retention, behavior change, completion, or satisfaction, and external accuracy was intentionally not assessed.</p>'
        f'{versions}</div><details class="panel"><summary><strong>Run manifest</strong></summary><pre class="code-block">{esc(manifest)}</pre></details>'
    )


def render_report(data: Mapping[str, Any], template: str, css: str, javascript: str) -> str:
    if not isinstance(data, Mapping):
        raise RenderError("report-data.json must contain a JSON object")
    if is_sample_report(data):
        raise RenderError("chapter-sample reporting is disabled; render full-content evaluations only")
    books = report_books(data)
    slugs = unique_book_slugs(books)
    rubric_markdown = str(mapping(data.get("rubric")).get("markdown") or "")
    parsed_rubric = parse_rubric_markdown(rubric_markdown)
    run = mapping(data.get("run"))
    sample_mode = False
    default_title = "ChapterFlow Experimental Chapter-Sample Evaluation" if sample_mode else "ChapterFlow Book Evaluation"
    title = str(data.get("report_title") or run.get("report_title") or default_title)
    statuses = [str(mapping(mapping(book.get("gates")).get("external_accuracy")).get("status") or "not_assessed") for book in books]
    header_status = (
        badge(run.get("status") or mapping(run.get("validation")).get("report") or "generated", "Run")
        + badge(f"{len(books)} {'sampled books' if sample_mode else 'books'}", "Scope")
        + badge("not_assessed" if statuses and all(value == "not_assessed" for value in statuses) else "mixed", "External accuracy")
    )
    replacements = {
        "[[REPORT_TITLE]]": esc(title),
        "[[RUBRIC_VERSION]]": esc(data.get("rubric_version") or "2.0"),
        "[[REPORT_CSS]]": css,
        "[[REPORT_JS]]": javascript,
        "[[REPORT_DATA_JSON]]": safe_embedded_json(data),
        "[[HEADER_STATUS]]": header_status,
        "[[SCOPE_BANNER]]": f'<div class="notice sample-warning" role="note"><strong>{esc(SAMPLE_WARNING)}</strong></div>' if sample_mode else "",
        "[[NAV_RESULTS_LABEL]]": "Sample order" if sample_mode else "Ranking",
        "[[DASHBOARD_HEADING]]": "Experimental sample dashboard" if sample_mode else "Executive dashboard",
        "[[DASHBOARD_INTRO]]": (
            "Experimental sample scores describe only selected chapters. Sample gate status and confidence remain separate from the weighted score."
            if sample_mode else "Scores describe observable content design. Gate status and confidence remain separate from the weighted score."
        ),
        "[[COMPARISON_HEADING]]": "Interactive selected-chapter comparison" if sample_mode else "Interactive book comparison",
        "[[COMPARISON_INTRO]]": (
            "Compare two to four books using selected-chapter estimates; every chart remains sample-limited and has a labeled tabular view."
            if sample_mode else "Select two to four books, choose a scale, and hide domains to focus the comparison. Every chart also has a labeled tabular view."
        ),
        "[[BOOKS_HEADING]]": "Per-book chapter-sample estimates" if sample_mode else "Per-book evaluations",
        "[[CHAPTERS_HEADING]]": "Selected-chapter evidence browser" if sample_mode else "Chapter-by-chapter evidence browser",
        "[[CROSS_BOOK_HEADING]]": "Sample-limited cross-book analysis and recommendations" if sample_mode else "Cross-book analysis and recommendations",
        "[[OVERVIEW_HTML]]": render_overview(data, books),
        "[[DASHBOARD_HTML]]": render_dashboard(data, books, slugs),
        "[[REMEDIATION_HTML]]": render_remediation(data, books, slugs),
        "[[RUBRIC_HTML]]": render_rubric(data, parsed_rubric),
        "[[BOOK_DETAILS_HTML]]": render_book_details(data, books, slugs),
        "[[CHAPTER_FALLBACK_HTML]]": render_chapter_fallback(books),
        "[[QA_HTML]]": render_qa(books),
        "[[AGREEMENT_HTML]]": render_agreement(data, books),
        "[[CROSS_BOOK_HTML]]": render_cross_book(data, books),
        "[[METHODS_HTML]]": render_methods(data),
    }
    rendered = template
    for token, value in replacements.items():
        rendered = rendered.replace(token, value)
    remaining = sorted(set(re.findall(r"\[\[[A-Z0-9_]+\]\]", rendered)))
    if remaining:
        raise RenderError(f"unresolved template tokens: {', '.join(remaining)}")
    return rendered


def atomic_write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(value)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    skill_dir = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True, help="Canonical report-data.json")
    parser.add_argument("--output", type=Path, required=True, help="Destination self-contained report.html")
    parser.add_argument("--template", type=Path, default=skill_dir / "assets" / "report-template.html")
    parser.add_argument("--css", type=Path, default=skill_dir / "assets" / "report.css")
    parser.add_argument("--js", type=Path, default=skill_dir / "assets" / "report.js")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        with args.data.open("r", encoding="utf-8") as stream:
            data = json.load(stream)
        template = args.template.read_text(encoding="utf-8")
        css = args.css.read_text(encoding="utf-8")
        javascript = args.js.read_text(encoding="utf-8")
        output = render_report(data, template, css, javascript)
        atomic_write_text(args.output.resolve(), output)
    except (OSError, json.JSONDecodeError, RenderError, TypeError, ValueError) as error:
        print(f"report rendering error: {error}", file=sys.stderr)
        return 2
    print(json.dumps({"output": str(args.output.resolve()), "bytes": len(output.encode('utf-8')), "books": len(sequence(mapping(data).get('books')))}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
