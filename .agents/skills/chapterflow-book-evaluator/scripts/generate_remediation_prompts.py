#!/usr/bin/env python3
"""Generate deterministic below-80 remediation ledgers and book prompt packs."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, Mapping, MutableMapping, Sequence


DOMAIN_SPECS: list[dict[str, Any]] = [
    {
        "key": "epistemic_integrity",
        "label": "Epistemic Integrity and Intellectual Honesty",
        "weight": 15,
        "subcriteria": ["Claim–support fit", "Uncertainty and limitations", "Internal consistency and instructional QA", "Misuse safeguards"],
        "instructions": [
            "Audit central claims, causal language, recommendations, caveats, contradictions, and answer/explanation alignment against the exact source content.",
            "Separate fact, inference, interpretation, and recommendation; place material limitations and boundary conditions where the reader uses the claim.",
            "Correct semantic quiz or mapping defects before adding new material, then add misuse and safety boundaries tied to the relevant technique.",
            "Independently recheck every changed claim, answer, explanation, safeguard, and cross-chapter term for consistency.",
        ],
    },
    {
        "key": "audience_fit",
        "label": "Audience Fit, Comprehensibility, and Cognitive Economy",
        "weight": 12,
        "subcriteria": ["Language clarity", "Beginner onboarding", "Signal-to-noise and framework load", "Audience and context accessibility"],
        "instructions": [
            "Trace the first-use path for every prerequisite, technical term, acronym, framework, and context assumption before revising prose.",
            "Define or demonstrate concepts before use, expose transitions and reasoning, and consolidate labels that make the reader manage avoidable complexity.",
            "Replace narrow or specialist-only examples with varied contexts while preserving the precision required by the subject.",
            "Run a novice continuity pass from the opening through the first complex application and record every remaining prerequisite burden.",
        ],
    },
    {
        "key": "mental_model_coherence",
        "label": "Mental-Model Coherence and Explanatory Depth",
        "weight": 15,
        "subcriteria": ["Central model", "Mechanism and causal explanation", "Cross-concept integration", "Nuance and diagnostic power"],
        "instructions": [
            "Write a one-page map of the intended central model, its mechanisms, distinctions, and limits before editing chapters.",
            "Make each major recommendation traceable to an explicit mechanism and show how later chapters reuse, distinguish, or constrain earlier concepts.",
            "Add contrasting cases, counterexamples, boundary cases, and diagnostic questions that separate superficially similar situations.",
            "Remove or merge frameworks that do not contribute a distinct explanatory or diagnostic function.",
        ],
    },
    {
        "key": "learning_architecture",
        "label": "Learning Architecture and Productive Processing",
        "weight": 12,
        "subcriteria": ["Sequencing and scaffolding", "Worked examples and contrasts", "Active processing", "Feedback and metacognitive calibration"],
        "instructions": [
            "Reconstruct the prerequisite graph and verify that chapter and component order moves from model to guided practice to independent judgment.",
            "Add worked contrasts that expose reasoning, failure modes, and choice points instead of merely decorating a principle.",
            "Require prediction, retrieval, comparison, self-explanation, diagnosis, or application before showing the answer.",
            "Make feedback explain why alternatives fail, what misconception the error reveals, and what the reader should revisit or try next.",
        ],
    },
    {
        "key": "retention_retrieval",
        "label": "Retention and Retrieval Support",
        "weight": 10,
        "subcriteria": ["Meaningful retrieval cues", "Cumulative reinforcement", "Quiz and retrieval depth", "Interference control and consolidation"],
        "instructions": [
            "Identify the smallest meaningful retrieval cue for each major idea and remove arbitrary or competing labels.",
            "Schedule cumulative retrieval across later chapters in new contexts instead of repeating chapter-local recognition questions.",
            "Rewrite cueable or pattern-based questions so success requires recall, discrimination, diagnosis, explanation, or application.",
            "Add comparison and synthesis maps that distinguish adjacent concepts and consolidate the final model without verbatim repetition.",
        ],
    },
    {
        "key": "transfer_action_judgment",
        "label": "Purpose-Appropriate Transfer, Action, and Practical Judgment",
        "weight": 15,
        "subcriteria": ["Concrete actions", "Cross-context transfer", "Implementation and feedback support", "Boundaries, adaptation, and tradeoffs"],
        "instructions": [
            "For each major idea, specify a recognition cue, a feasible first action, a competent attempt, and observable feedback.",
            "Teach the deep structure across multiple contexts and distinguish cases that look similar but require a different response.",
            "Complete the implementation loop with barriers, environment or social support, observation, reflection, revision, and follow-up.",
            "Add tradeoffs, adaptation rules, stop conditions, escalation paths, and situations where the technique should not be used.",
        ],
    },
    {
        "key": "motivation_autonomy",
        "label": "Motivation, Autonomy, and Calibrated Agency",
        "weight": 8,
        "subcriteria": ["Personal relevance", "Achievable progress", "Autonomy and non-shaming tone", "Calibrated confidence"],
        "instructions": [
            "Connect practice to reader-chosen goals and credible situations without using hype, fear, shame, or forced urgency.",
            "Stage manageable attempts, visible progress, recovery from failure, and optional paths for different constraints.",
            "Replace moralizing or universal prescriptions with choice, context, compassionate correction, and explicit boundaries.",
            "Tie confidence to demonstrated practice, feedback, uncertainty, and clear signals for seeking more help.",
        ],
    },
    {
        "key": "engagement_momentum",
        "label": "Instructionally Aligned Engagement and Reading Momentum",
        "weight": 8,
        "subcriteria": ["Curiosity and momentum", "Narrative and example vividness", "Emotional relevance", "Instructional alignment and absence of decoration"],
        "instructions": [
            "Map every hook, example, emotional beat, and transition to the model, judgment, retrieval, or transfer function it must perform.",
            "Vary case contexts, stakes, pacing, and narrative form; remove repeated staging, decorative timestamps, props, or specificity that does not teach.",
            "Use emotion to clarify perspective and consequence while keeping claims and reasoning visible.",
            "End chapters with a meaningful unresolved question or next use that emerges from learning rather than an artificial cliffhanger.",
        ],
    },
    {
        "key": "whole_book_coherence",
        "label": "Whole-Book Coherence, Consistency, and Completion Value",
        "weight": 5,
        "subcriteria": ["Chapter necessity and order", "Quality consistency and pacing", "Redundancy and cumulative load", "Synthesis and completion value"],
        "instructions": [
            "Give every chapter a unique job in the learning journey and move, merge, or remove material whose role cannot be distinguished.",
            "Audit pacing and component quality chapter by chapter; repair local dips without flattening useful variation in rhythm or difficulty.",
            "Separate purposeful spaced reinforcement from repeated explanation and consolidate frameworks that compete for attention.",
            "Rebuild the ending as an integrated model, retrieval opportunity, practical next-use plan, and honest account of what remains unresolved.",
        ],
    },
]

GENERIC_QA_PREFIX = "no major structural anomaly"

PRIORITY_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}

QA_DOMAIN_RULES: list[tuple[tuple[str, ...], tuple[str, ...]]] = [
    (("longest", "answer length", "recognition cue", "quiz"), ("learning_architecture", "retention_retrieval")),
    (("timestamp", "exact-time", "exact time", "staging"), ("engagement_momentum", "whole_book_coherence")),
    (("acronym", "jargon", "prerequisite"), ("audience_fit",)),
    (("similar", "repetition", "repetitive", "formulaic"), ("engagement_momentum", "whole_book_coherence", "retention_retrieval")),
    (("source", "metadata", "edition", "administrative"), ("epistemic_integrity", "whole_book_coherence")),
    (("immediate action", "try this", "missing action"), ("transfer_action_judgment",)),
    (("duplicate", "missing field", "structural"), ("epistemic_integrity", "whole_book_coherence")),
    (("chapter length", "completion", "cumulative-load", "cumulative load"), ("whole_book_coherence", "retention_retrieval")),
]

GATE_DOMAIN_MAP = {
    "technical": {"epistemic_integrity", "whole_book_coherence"},
    "epistemic": {"epistemic_integrity", "mental_model_coherence"},
    "ethics": {"epistemic_integrity", "transfer_action_judgment", "motivation_autonomy"},
    "external_accuracy": {"epistemic_integrity"},
}

TOKEN_STOPWORDS = {
    "about", "after", "again", "against", "also", "because", "before", "being", "between", "book", "chapter",
    "condition", "could", "domain", "every", "from", "have", "into", "more", "most", "must", "only", "other",
    "reader", "score", "should", "than", "that", "their", "there", "these", "they", "this", "those", "through",
    "under", "using", "where", "which", "while", "with", "without", "would",
}


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _is_sample_payload(payload: Mapping[str, Any]) -> bool:
    run = _mapping(payload.get("run"))
    sampling = _mapping(run.get("sampling"))
    books = payload.get("books") if isinstance(payload.get("books"), list) else []
    return (
        payload.get("result_type") == "experimental_chapter_sample_report"
        or run.get("evaluation_mode") == "chapter_sample"
        or sampling.get("mode") == "chapter_sample"
        or _mapping(payload.get("meta")).get("evaluation_mode") == "chapter_sample"
        or any(
            isinstance(book, Mapping)
            and (
                book.get("result_type") == "experimental_chapter_sample_evaluation"
                or _mapping(book.get("evaluation_scope")).get("mode") == "chapter_sample"
            )
            for book in books
        )
    )


def _sequence(value: Any) -> list[Any]:
    return list(value) if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)) else []


def _number(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if math.isfinite(parsed) else default


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, Mapping):
        locator = " · ".join(str(value.get(key) or "").strip() for key in ("chapter", "section", "item_id", "locator") if value.get(key))
        description = str(value.get("paraphrase") or value.get("description") or value.get("rationale") or value.get("summary") or value.get("text") or "").strip()
        return f"{locator}: {description}" if locator and description else locator or description
    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        return "; ".join(filter(None, (_text(item) for item in value)))
    return str(value)


def _slug(value: str) -> str:
    return "-".join(filter(None, "".join(character.lower() if character.isalnum() else " " for character in value).split()))


def _md_cell(value: Any) -> str:
    return _text(value).replace("|", "\\|").replace("\n", " ")


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(content, encoding="utf-8")
    os.replace(temporary, path)


def _rubric_domain(payload: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    domains = _mapping(_mapping(payload.get("rubric")).get("domains"))
    value = domains.get(key)
    return _mapping(value)


def _normalise_book(payload: Mapping[str, Any], book: Mapping[str, Any], index: int) -> dict[str, Any]:
    canonical = any(isinstance(value, Mapping) for value in _mapping(book.get("domains")).values())
    metadata = _mapping(book.get("book")) if canonical else book
    evaluation_mode = _text(_mapping(payload.get("run")).get("evaluation_mode")) or _text(_mapping(payload.get("meta")).get("evaluation_mode"))
    sample_mode = evaluation_mode == "chapter_sample" or _mapping(_mapping(payload.get("run")).get("sampling")).get("mode") == "chapter_sample"
    normalised: dict[str, Any] = {
        "source_kind": "canonical" if canonical else "screening",
        "sample_mode": sample_mode,
        "id": _text(metadata.get("book_id") or metadata.get("slug") or book.get("id") or f"book-{index + 1}"),
        "title": _text(metadata.get("title") or book.get("title") or metadata.get("book_id") or f"Book {index + 1}"),
        "author": _text(metadata.get("author") or book.get("author")),
        "source_file": _text(metadata.get("package_path") or book.get("file") or metadata.get("source_file")),
        "rank": int(_number(book.get("rank"), index + 1)),
        "score": _number(book.get("overall_score") if canonical else book.get("score")),
        "confidence": _text(_mapping(book.get("confidence")).get("level") if canonical else book.get("confidence")),
        "profile": _text(book.get("profile")),
        "categories": [_text(item) for item in _sequence(book.get("categories")) if _text(item)],
        "tags": [_text(item) for item in _sequence(book.get("tags")) if _text(item)],
        "domains": [],
        "gates": [],
        "qa": [],
        "diagnostics": dict(_mapping(book.get("diagnostics_full"))),
        "chapters": [],
        "strengths": [],
        "technical_findings": [],
        "evaluation_mode": evaluation_mode or "Not supplied",
        "evaluation_note": "Experimental selected-chapter estimate; unsampled content may materially change every conclusion." if sample_mode else "Screening or adjudicated design result; score lift requires a fresh evaluation.",
        "assessment": "",
        "weaknesses": [],
    }

    raw_domains = _mapping(book.get("domains"))
    if canonical:
        for domain_index, spec in enumerate(DOMAIN_SPECS, 1):
            record = _mapping(raw_domains.get(spec["key"]))
            rubric_record = _rubric_domain(payload, spec["key"])
            raw_subcriteria = _mapping(record.get("subcriteria"))
            subcriteria = []
            canonical_keys = list(raw_subcriteria)
            for sub_index, (sub_key, sub_label) in enumerate(zip(canonical_keys, spec["subcriteria"]), 1):
                sub_record = _mapping(raw_subcriteria.get(sub_key))
                subcriteria.append({
                    "key": sub_key,
                    "label": _text(sub_record.get("name") or sub_record.get("label") or sub_label),
                    "rating": _number(sub_record.get("rating")),
                    "rationale": _text(sub_record.get("rationale")),
                    "evidence": [_text(item) for item in _sequence(sub_record.get("strength_evidence")) + _sequence(sub_record.get("limitation_evidence")) if _text(item)],
                    "index": sub_index,
                })
            normalised["domains"].append({
                "key": spec["key"],
                "label": _text(rubric_record.get("name") or rubric_record.get("label") or spec["label"]),
                "weight": _number(record.get("weight"), _number(rubric_record.get("weight"), spec["weight"])),
                "score": _number(record.get("domain_score")),
                "weighted_points": _number(record.get("weighted_points")),
                "pattern": _text(record.get("whole_book_pattern")),
                "subcriteria": subcriteria,
                "index": domain_index,
            })
        for gate_key, gate in _mapping(book.get("gates")).items():
            gate_record = _mapping(gate)
            normalised["gates"].append({"key": gate_key, "status": _text(gate_record.get("status")), "note": _text(gate_record.get("rationale")), "evidence": [_text(item) for item in _sequence(gate_record.get("evidence")) if _text(item)]})
        qa = _mapping(book.get("qa"))
        for key in ("semantic_quiz_issues", "formulaic_pattern_notes", "self_validation_notes"):
            normalised["qa"].extend(_text(item) for item in _sequence(qa.get(key)) if _text(item))
        normalised["technical_findings"] = [_text(item) for item in _sequence(book.get("technical_findings")) if _text(item)]
        for chapter in _sequence(book.get("chapter_evidence")):
            chapter_record = _mapping(chapter)
            normalised["chapters"].append({
                "number": chapter_record.get("chapter_index"),
                "title": _text(chapter_record.get("title")),
                "takeaway": _text(chapter_record.get("central_ideas")),
                "try": _text(chapter_record.get("transfer_support")),
            })
        normalised["strengths"] = [_text(item) for item in _sequence(_mapping(book.get("analysis")).get("strongest_qualities")) if _text(item)]
        analysis = _mapping(book.get("analysis"))
        normalised["assessment"] = _text(analysis.get("summary") or analysis.get("overall_assessment") or analysis.get("primary_limitations"))
        normalised["weaknesses"] = [
            {"domain": _text(_mapping(item).get("domain") or _mapping(item).get("name")), "improvement": _text(_mapping(item).get("improvement") or _mapping(item).get("recommendation") or item)}
            for item in _sequence(analysis.get("weakest_qualities") or analysis.get("limitations"))
            if _text(item)
        ]
    else:
        domain_names = _sequence(payload.get("domain_names"))
        domain_weights = _mapping(payload.get("domain_weights"))
        all_subcriteria = _sequence(book.get("subcriteria"))
        for domain_index, spec in enumerate(DOMAIN_SPECS, 1):
            label = _text(domain_names[domain_index - 1]) if len(domain_names) >= domain_index else spec["label"]
            items = [item for item in all_subcriteria if _text(_mapping(item).get("domain")) == label]
            subcriteria = []
            for sub_index, item in enumerate(items, 1):
                record = _mapping(item)
                subcriteria.append({
                    "key": f"s{sub_index:02d}",
                    "label": _text(record.get("subcriterion") or spec["subcriteria"][sub_index - 1]),
                    "rating": _number(record.get("rating")),
                    "rationale": "",
                    "evidence": [],
                    "index": sub_index,
                })
            score = _number(raw_domains.get(label))
            weight = _number(domain_weights.get(label), spec["weight"])
            normalised["domains"].append({
                "key": spec["key"], "label": label, "weight": weight, "score": score,
                "weighted_points": _number(_mapping(book.get("weighted_points")).get(label), score / 4 * weight),
                "pattern": "", "subcriteria": subcriteria, "index": domain_index,
            })
        gates = _mapping(book.get("gates"))
        shared_note = _text(gates.get("note"))
        nonpass_keys = {
            key for key in ("technical", "epistemic", "ethics")
            if _text(gates.get(key)).casefold().replace("-", "_").replace(" ", "_") not in {"", "pass", "not_assessed"}
        }
        for key in ("technical", "epistemic", "ethics", "external_accuracy"):
            normalised["gates"].append({"key": key, "status": _text(gates.get(key)), "note": shared_note if key in nonpass_keys else "", "evidence": []})
        normalised["qa"] = [_text(item) for item in _sequence(book.get("qa")) if _text(item)]
        for chapter in _sequence(book.get("chapter_evidence")):
            record = _mapping(chapter)
            normalised["chapters"].append({
                "number": record.get("number"), "title": _text(record.get("title")), "takeaway": _text(record.get("takeaway")),
                "try": _text(record.get("try")), "hook": _text(record.get("hook")),
                "counterintuition": _text(record.get("counterintuition")), "core_skill": _text(record.get("coreSkill")),
                "extracts": [_text(item) for item in _sequence(record.get("extracts")) if _text(item)],
            })
        normalised["strengths"] = [_text(_mapping(item).get("domain")) for item in _sequence(book.get("strengths")) if _text(_mapping(item).get("domain"))]
        normalised["assessment"] = _text(book.get("assessment"))
        normalised["weaknesses"] = [
            {"domain": _text(_mapping(item).get("domain")), "improvement": _text(_mapping(item).get("improvement"))}
            for item in _sequence(book.get("weaknesses"))
            if _text(_mapping(item).get("domain") or _mapping(item).get("improvement"))
        ]
    return normalised


def _priority(scope: str, current: float, book: Mapping[str, Any]) -> str:
    failed_gate = any(gate.get("status", "").casefold() in {"fail", "unevaluable"} for gate in book["gates"])
    conditional_gate = any(gate.get("status", "").casefold() == "conditional" for gate in book["gates"])
    if scope == "overall":
        if current < 60 or failed_gate:
            return "P0"
        if current < 70 or conditional_gate:
            return "P1"
        return "P2"
    if scope == "domain":
        return "P1" if current <= 2.5 or failed_gate else "P2"
    if current <= 1:
        return "P0"
    if current <= 2:
        return "P2"
    return "P3"


def _conditions(book: Mapping[str, Any]) -> list[dict[str, Any]]:
    conditions: list[dict[str, Any]] = []
    if book["score"] < 80:
        overall_gap = round(max(0.0, 80.0 - book["score"]), 4)
        conditions.append({
            "id": "O-001", "scope": "overall", "domain_key": None, "label": "Content Design Score",
            "current": book["score"], "percent": book["score"], "target": 80.0,
            "deficit": overall_gap, "weight": 100.0, "modeled_lift": overall_gap,
            "priority": _priority("overall", book["score"], book), "evidence_class": "score-only",
            "evidence_summary": "The supplied overall score is below the requested 80% floor.",
            "verification": "Recalculate the complete weighted score after a fresh rubric evaluation; do not edit the score artifact.",
        })
    for domain in book["domains"]:
        if domain["score"] < 3.2:
            target = 3.25
            direct = bool(domain.get("pattern"))
            conditions.append({
                "id": f"D-{domain['index']:02d}", "scope": "domain", "domain_key": domain["key"], "label": domain["label"],
                "current": domain["score"], "percent": domain["score"] / 4 * 100, "target": target,
                "deficit": round(target - domain["score"], 4), "weight": domain["weight"],
                "modeled_lift": round(max(0.0, (target - domain["score"]) / 4 * domain["weight"]), 4),
                "priority": _priority("domain", domain["score"], book), "evidence_class": "direct" if direct else "score-only",
                "evidence_summary": domain.get("pattern") or "No chapter-level rationale was supplied for this domain score.",
                "verification": "Re-rate all four domain subcriteria from source evidence and confirm the recalculated domain score is at least 3.25/4.",
            })
        for subcriterion in domain["subcriteria"]:
            if subcriterion["rating"] < 3.2:
                direct = bool(subcriterion.get("rationale") or subcriterion.get("evidence"))
                conditions.append({
                    "id": f"S-{domain['index']:02d}-{subcriterion['index']:02d}", "scope": "subcriterion", "domain_key": domain["key"],
                    "label": subcriterion["label"], "current": subcriterion["rating"], "percent": subcriterion["rating"] / 4 * 100,
                    "target": 4.0, "deficit": round(4.0 - subcriterion["rating"], 4), "weight": domain["weight"],
                    "modeled_lift": round(max(0.0, (4.0 - subcriterion["rating"]) * domain["weight"] / 16), 4),
                    "priority": _priority("subcriterion", subcriterion["rating"], book), "evidence_class": "direct" if direct else "score-only",
                    "evidence_summary": subcriterion.get("rationale") or "No chapter-level rationale was supplied for this subcriterion score.",
                    "verification": "Apply the exact 0–4 anchor to fresh source evidence; the supplied integer scale first passes this strict threshold at 4/4.",
                })
    scope_order = {"overall": 0, "domain": 1, "subcriterion": 2}
    return sorted(conditions, key=lambda condition: (PRIORITY_ORDER[condition["priority"]], -condition["modeled_lift"], scope_order[condition["scope"]], condition["id"]))


def _contextual_diagnostics(book: Mapping[str, Any]) -> list[dict[str, Any]]:
    qa_text = " ".join(book["qa"]).casefold()
    diagnostics = book["diagnostics"]
    rules = [
        (("longest", "answer length", "recognition cue"), ("correct_longest_share", "answer_length_ratio"), "quiz answer-pattern signal", ("learning_architecture", "retention_retrieval")),
        (("timestamp", "exact-time", "exact time", "staging"), ("exact_time_example_share",), "example-staging signal", ("engagement_momentum", "whole_book_coherence")),
        (("acronym",), ("acronyms_per_10k", "unique_acronyms"), "acronym-load signal", ("audience_fit",)),
        (("similar", "repetition", "repetitive", "formulaic"), ("avg_chapter_similarity", "max_chapter_similarity", "high_similarity_share", "adjacent_similarity"), "similarity/repetition signal", ("engagement_momentum", "whole_book_coherence", "retention_retrieval")),
        (("source", "metadata", "edition", "administrative"), ("source_meta_per_10k", "source_meta_chapter_share", "first_chapter_source_meta"), "source-administration signal", ("epistemic_integrity", "whole_book_coherence")),
        (("immediate action", "try this", "missing action"), ("try_missing_share",), "immediate-action completeness signal", ("transfer_action_judgment",)),
        (("duplicate", "missing field"), ("duplicate_ids", "duplicate_titles", "duplicate_full", "missing_fields"), "structural-integrity signal", ("epistemic_integrity", "whole_book_coherence")),
    ]
    result = []
    for terms, keys, label, domain_keys in rules:
        if not any(term in qa_text for term in terms):
            continue
        values = {key: diagnostics[key] for key in keys if key in diagnostics}
        if values:
            result.append({"label": label, "values": values, "evidence_class": "contextual", "domain_keys": list(domain_keys)})
    return result


def _direct_evidence(book: Mapping[str, Any]) -> list[str]:
    evidence = []
    if book.get("assessment"):
        evidence.append(f"Supplied evaluator assessment: {book['assessment']}")
    for weakness in book.get("weaknesses", []):
        if weakness.get("domain") or weakness.get("improvement"):
            evidence.append(f"Supplied domain target — {weakness.get('domain') or 'Unassigned'}: {weakness.get('improvement') or 'No remediation text supplied.'}")
    for gate in book["gates"]:
        normalised_status = gate["status"].casefold().replace("-", "_").replace(" ", "_")
        if normalised_status not in {"pass", "not_assessed"} or gate.get("note"):
            evidence.append(f"Gate {gate['key']} — {gate['status']}: {gate.get('note') or 'No rationale supplied.'}")
            evidence.extend(f"Gate evidence: {item}" for item in gate.get("evidence", []) if item)
    evidence.extend(f"Technical finding: {item}" for item in book.get("technical_findings", []) if item)
    evidence.extend(f"QA finding: {item}" for item in book["qa"] if item and not item.casefold().startswith(GENERIC_QA_PREFIX))
    missing_actions = [chapter for chapter in book["chapters"] if not chapter.get("try")]
    for chapter in missing_actions:
        evidence.append(f"Blank immediate-action field: chapter {chapter.get('number')} — {chapter.get('title') or 'Untitled'}")
    return list(dict.fromkeys(evidence))


def _chapter_context(book: Mapping[str, Any]) -> list[dict[str, Any]]:
    chapters = book["chapters"]
    if not chapters:
        return []
    indices = list(dict.fromkeys((0, len(chapters) // 2, len(chapters) - 1)))
    for index, chapter in enumerate(chapters):
        if not chapter.get("try") and index not in indices:
            indices.append(index)
        if len(indices) >= 6:
            break
    selected = []
    for index in indices[:6]:
        chapter = chapters[index]
        selected.append({"number": chapter.get("number"), "title": chapter.get("title") or "Untitled", "navigation_context": chapter.get("takeaway") or "No concise takeaway supplied."})
    return selected


def _qa_for_domain(book: Mapping[str, Any], domain_key: str) -> list[str]:
    result = []
    for finding in book["qa"]:
        folded = finding.casefold()
        if folded.startswith(GENERIC_QA_PREFIX):
            continue
        mapped = {
            key
            for terms, keys in QA_DOMAIN_RULES
            if any(term in folded for term in terms)
            for key in keys
        }
        if domain_key in mapped:
            result.append(finding)
    return list(dict.fromkeys(result))


def _gate_evidence_for_domain(book: Mapping[str, Any], domain_key: str) -> list[str]:
    result = []
    for gate in book["gates"]:
        status = gate.get("status", "").casefold().replace("-", "_").replace(" ", "_")
        if status in {"", "pass", "not_assessed"}:
            continue
        if domain_key in GATE_DOMAIN_MAP.get(gate.get("key"), set()):
            result.append(f"Gate {gate['key']} — {gate.get('status')}: {gate.get('note') or 'No rationale supplied.'}")
    return result


def _token_weights(*groups: tuple[str, float]) -> dict[str, float]:
    weights: dict[str, float] = {}
    for text, multiplier in groups:
        for token in re.findall(r"[a-z0-9]+", text.casefold()):
            if len(token) < 5 or token in TOKEN_STOPWORDS:
                continue
            weights[token] = max(weights.get(token, 0.0), multiplier)
    return weights


def _chapter_targets(book: Mapping[str, Any], domain: Mapping[str, Any], related: Sequence[Mapping[str, Any]], limit: int = 3) -> list[dict[str, Any]]:
    matching_weaknesses = [item for item in book.get("weaknesses", []) if item.get("domain") == domain.get("label")]
    weakness_text = " ".join(item.get("improvement", "") for item in matching_weaknesses)
    condition_text = " ".join(condition.get("label", "") for condition in related)
    topic_text = " ".join(book.get("tags", []))
    weights = _token_weights(
        (book.get("assessment", ""), 4.0),
        (weakness_text, 3.0),
        (condition_text, 2.0),
        (topic_text, 1.0),
    )
    candidates = []
    for index, chapter in enumerate(book.get("chapters", [])):
        title = chapter.get("title") or "Untitled"
        body = " ".join([
            title, chapter.get("takeaway", ""), chapter.get("try", ""), chapter.get("hook", ""),
            chapter.get("counterintuition", ""), chapter.get("core_skill", ""), " ".join(chapter.get("extracts", [])),
        ]).casefold()
        title_folded = title.casefold()
        matched = [token for token in weights if token in body]
        score = sum(weights[token] * (3.0 if token in title_folded else 1.0) for token in matched)
        candidates.append((score, -index, chapter, sorted(matched, key=lambda token: (-weights[token], token))[:6]))
    if not candidates:
        return []
    selected = [item for item in sorted(candidates, reverse=True, key=lambda item: (item[0], item[1])) if item[0] > 0][:limit]
    if not selected:
        indices = list(dict.fromkeys((0, len(candidates) // 2, len(candidates) - 1)))[:limit]
        selected = [candidates[index] for index in indices]
    return [
        {
            "number": item[2].get("number"),
            "title": item[2].get("title") or "Untitled",
            "matched_terms": item[3],
            "navigation_context": item[2].get("takeaway") or "No concise takeaway supplied.",
            "evidence_status": "navigation target; verify against the source before editing",
        }
        for item in selected
    ]


def _workstreams(book: Mapping[str, Any], conditions: Sequence[Mapping[str, Any]], diagnostics: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for domain, spec in zip(book["domains"], DOMAIN_SPECS):
        related = [condition for condition in conditions if condition.get("domain_key") == domain["key"]]
        if not related:
            continue
        priority = min((condition["priority"] for condition in related), key=lambda item: PRIORITY_ORDER[item])
        qa_findings = _qa_for_domain(book, domain["key"])
        if qa_findings and PRIORITY_ORDER[priority] > PRIORITY_ORDER["P2"]:
            priority = "P2"
        relevant_diagnostics = [item for item in diagnostics if domain["key"] in item.get("domain_keys", [])]
        matching_weaknesses = [item for item in book.get("weaknesses", []) if item.get("domain") == domain["label"]]
        chapter_targets = _chapter_targets(book, domain, related)
        evidence = []
        if book.get("assessment"):
            evidence.append(f"Book-specific supplied assessment: {book['assessment']}")
        evidence.extend(f"Domain-specific supplied target: {item.get('improvement')}" for item in matching_weaknesses if item.get("improvement"))
        evidence.extend(_gate_evidence_for_domain(book, domain["key"]))
        evidence.extend(f"QA finding: {item}" for item in qa_findings)
        evidence.extend(
            f"Condition {condition['id']} rationale: {condition['evidence_summary']}"
            for condition in related if condition.get("evidence_class") == "direct"
        )
        evidence = list(dict.fromkeys(evidence))
        unknowns = []
        score_only = [condition["id"] for condition in related if condition.get("evidence_class") == "score-only"]
        if score_only:
            unknowns.append(f"No condition-specific adjudicated rationale was supplied for: {', '.join(score_only)}. Confirm the defect and record exact locators before editing.")
        if chapter_targets:
            unknowns.append("Chapter targets below are ranked navigation hypotheses from supplied metadata, not proof that a defect occurs there.")
        specific_instructions = []
        if book.get("assessment"):
            specific_instructions.append(
                f"Start with this book-specific evaluator hypothesis: {book['assessment']} Locate each named claim, mechanism, pattern, or risk in the source; record the chapter and component before changing it."
            )
        for weakness in matching_weaknesses:
            if weakness.get("improvement"):
                specific_instructions.append(f"Execute the supplied {domain['label']} remediation target: {weakness['improvement']}")
        if chapter_targets:
            anchors = "; ".join(
                f"Chapter {item['number']} “{item['title']}”" + (f" (matched: {', '.join(item['matched_terms'])})" if item["matched_terms"] else "")
                for item in chapter_targets
            )
            specific_instructions.append(
                f"Inspect these ranked source-navigation targets first: {anchors}. For each, state whether the listed conditions are confirmed, not found, or need a different locator."
            )
        if qa_findings:
            specific_instructions.append(
                "Repair the source components implicated by these supplied QA findings, then rerun the same detector and report before/after values: " + " | ".join(qa_findings)
            )
        result.append({
            "domain_key": domain["key"], "domain": domain["label"], "priority": priority,
            "condition_ids": [condition["id"] for condition in related], "current_score": domain["score"],
            "target_floor": 3.25 if domain["score"] < 3.2 else None,
            "modeled_lift_to_floor": round(max(0.0, (3.25 - domain["score"]) / 4 * domain["weight"]), 4),
            "instructions": specific_instructions + list(spec["instructions"]),
            "evidence": evidence,
            "unknowns": unknowns or ["No unresolved evidence gap was recorded; still verify every source locator before implementation."],
            "chapter_targets": chapter_targets,
            "qa_findings": qa_findings,
            "acceptance": [
                "Record the source chapters/components inspected and concise locators for each implemented change.",
                "Map every P0–P2 condition ID to a change or an explicit unresolved explanation; keep deferred P3 IDs in the ledger.",
                "Reapply the exact rubric anchors from source evidence and rerun relevant diagnostics using the same detector.",
                "Confirm the change does not degrade a higher-scoring domain, introduce a gate defect, or claim a measured reader outcome.",
            ],
            "supporting_signals": relevant_diagnostics,
        })
    return result


def _prompt(book: Mapping[str, Any], conditions: Sequence[Mapping[str, Any]], workstreams: Sequence[Mapping[str, Any]], direct: Sequence[str], diagnostics: Sequence[Mapping[str, Any]], chapters: Sequence[Mapping[str, Any]]) -> str:
    gate_lines = [f"- `{gate['key']}`: **{gate['status'] or 'not supplied'}**" + (f" — {gate['note']}" if gate.get("note") else "") for gate in book["gates"]]
    domain_lines = [f"| {domain['label']} | {domain['score']:.2f}/4 | {domain['score'] / 4 * 100:.1f}% | {domain['weight']:.0f}% | {domain['weighted_points']:.2f} |" for domain in book["domains"]]
    ledger_lines = []
    for condition in conditions:
        current = f"{condition['current']:.1f}/100" if condition["scope"] == "overall" else f"{condition['current']:.2f}/4"
        target = f"{condition['target']:.1f}/100" if condition["scope"] == "overall" else f"{condition['target']:.2f}/4"
        ledger_lines.append(f"| {condition['id']} | {condition['priority']} | {condition['scope']} | {_md_cell(condition['label'])} | {current} | {condition['percent']:.1f}% | {target} | {condition['modeled_lift']:.2f} pts | {condition['evidence_class']} |")
    evidence_lines = [f"- {item}" for item in direct] or ["- No direct defect evidence was supplied. Score conditions remain review targets, not proven diagnoses."]
    diagnostic_lines = [f"- {item['label']}: " + ", ".join(f"`{key}`={value}" for key, value in item["values"].items()) for item in diagnostics] or ["- No supplied QA wording justified attaching a diagnostic metric to the prompt."]
    chapter_lines = [f"- Chapter {item['number']}: **{item['title']}** — navigation context: {item['navigation_context']}" for item in chapters] or ["- No chapter navigation records were supplied; inspect the source package directly."]
    workstream_blocks = []
    for order, stream in enumerate(workstreams, 1):
        steps = "\n".join(f"{index}. {instruction}" for index, instruction in enumerate(stream["instructions"], 1))
        acceptance = "\n".join(f"- [ ] {item}" for item in stream["acceptance"])
        stream_evidence = "\n".join(f"- {item}" for item in stream.get("evidence", [])) or "- No domain-specific evidence was supplied; treat the scores as inspection targets."
        stream_diagnostics = "\n".join(
            f"- {item['label']}: " + ", ".join(f"`{key}`={value}" for key, value in item.get("values", {}).items())
            for item in stream.get("supporting_signals", [])
        ) or "- No domain-mapped diagnostic signal was justified by the supplied QA wording."
        stream_unknowns = "\n".join(f"- {item}" for item in stream.get("unknowns", []))
        stream_chapters = "\n".join(
            f"- Chapter {item['number']}: **{item['title']}** — {item['evidence_status']}"
            + (f"; matched terms: {', '.join(item['matched_terms'])}" if item.get("matched_terms") else "")
            + f". Context: {item['navigation_context']}"
            for item in stream.get("chapter_targets", [])
        ) or "- Inspect the complete source package and establish exact locators before editing."
        target = f" Target the first attainable domain floor of {stream['target_floor']:.2f}/4; modeled overall contribution {stream['modeled_lift_to_floor']:.2f} points." if stream["target_floor"] else " The domain already clears 80%; close the listed subcriterion conditions without degrading it."
        workstream_blocks.append(
            f"### {order}. {stream['priority']} — {stream['domain']}\n\n"
            f"Conditions: {', '.join(f'`{item}`' for item in stream['condition_ids'])}. Current domain score: {stream['current_score']:.2f}/4.{target}\n\n"
            "Evidence mapped to this workstream:\n\n"
            f"{stream_evidence}\n\n"
            "Contextual signals mapped to this workstream:\n\n"
            f"{stream_diagnostics}\n\n"
            "Known evidence gaps:\n\n"
            f"{stream_unknowns}\n\n"
            "Ranked chapter/source inspection targets:\n\n"
            f"{stream_chapters}\n\n"
            "Implementation instructions:\n\n"
            f"{steps}\n\nAcceptance criteria:\n\n{acceptance}"
        )
    strengths = "\n".join(f"- Preserve: {item}" for item in book["strengths"]) or "- Preserve all demonstrated strengths and unrelated reader-facing content."
    overall_gap = round(max(0.0, 80.0 - book["score"]), 4)
    sample_boundary = "This is an experimental selected-chapter result. Work only from the selected package and never generalize the prompt to unsampled chapters." if book["sample_mode"] else "Use the complete source package when available; this supplied score record alone is not a chapter-level diagnosis."
    return f"""# ChapterFlow remediation implementation prompt — {book['title']}

## Assignment and source boundary

Remediate the ChapterFlow package identified below. Work only in its source package. Preserve unrelated content and existing strengths. Do not edit scores, ratings, rankings, reports, or evaluation artifacts to simulate improvement. {sample_boundary}

- Book ID: `{book['id']}`
- Title: **{book['title']}**
- Author: {book['author'] or 'Not supplied'}
- Source: `{book['source_file'] or 'Not supplied'}`
- Rank: {book['rank']}
- Current overall: **{book['score']:.1f}/100**
- Minimum arithmetic lift to 80: **{overall_gap:.1f} points**
- Confidence: {book['confidence'] or 'Not supplied'}
- Evaluation mode: {book['evaluation_mode']}
- Evaluation boundary: {book['evaluation_note']}

## Immutable gate snapshot

{chr(10).join(gate_lines) if gate_lines else '- Gate records were not supplied.'}

A score lift never clears a failed or conditional gate. Reassess gates independently after source repairs. External accuracy remains `not_assessed` unless a separately authorized verification run occurs.

## Domain score snapshot

| Domain | Current | Percent | Weight | Weighted points |
|---|---:|---:|---:|---:|
{chr(10).join(domain_lines)}

## Complete strict-below-80 condition ledger

The requested rule uses raw values. Domain scores first pass at 3.25/4; supplied integer subcriterion ratings first pass at 4/4. Rating-3 conditions are real 75% enhancement items, but gate defects and ratings 0–2 take priority.

| ID | Priority | Scope | Condition | Current | Percent | Target floor | Modeled contribution | Evidence |
|---|---|---|---|---:|---:|---:|---:|---|
{chr(10).join(ledger_lines)}

No chapter-level rationale was supplied for any `score-only` row. Treat it as a review target, inspect the package, and record new source locators before implementing or claiming resolution. Modeled contributions are arithmetic scenarios, not promised rerating outcomes; do not sum every theoretical 3→4 lift into a forecast.

## Evidence packet

### Direct supplied evidence

{chr(10).join(evidence_lines)}

### Contextual diagnostic signals

{chr(10).join(diagnostic_lines)}

Diagnostics are supporting signals, not causal proof or measured reader outcomes. Use the same detector for before/after comparison and do not invent an unpublished pass threshold.

### Source navigation context

{chr(10).join(chapter_lines)}

These chapter records help locate the material. Do not treat their text as proof of a defect unless a supplied gate, QA finding, or adjudicated rationale explicitly connects it.

## Prioritized implementation workstreams

{chr(10).join(workstream_blocks)}

## Preservation constraints

{strengths}
- Do not weaken epistemic, ethical, safety, audience, or accessibility protections to gain points elsewhere.
- Do not add component quantity unless each new item performs a verified instructional function.

## Final validation and rerating

- [ ] The source package parses and passes its existing schema and technical checks.
- [ ] Every changed file, chapter, component, and concise evidence locator is recorded.
- [ ] Every P0–P2 condition maps to an implemented change or explicit unresolved explanation; every deferred P3 remains listed.
- [ ] Relevant diagnostics are rerun with the same detector and before/after values are recorded.
- [ ] Semantic answers, explanations, claims, safeguards, and cross-chapter terms are independently checked.
- [ ] A fresh evaluator applies the canonical rubric; no score change is claimed by the remediation agent.
- [ ] Gates are reassessed independently from weighted score.
- [ ] No external-accuracy or measured retention, transfer, completion, satisfaction, or behavior-change claim is introduced.

## Required implementation hand-back

```json
{{
  "book_id": "{book['id']}",
  "conditions_addressed": [],
  "conditions_deferred": [],
  "changed_files": [],
  "changed_chapters": [],
  "evidence_locators": [],
  "before_after_diagnostics": [],
  "validation_commands": [],
  "validation_results": [],
  "gate_status_requested_for_reassessment": [],
  "residual_risks": [],
  "score_changes_claimed": false
}}
```
"""


def attach_remediation(payload: MutableMapping[str, Any]) -> dict[str, Any]:
    """Attach a deterministic remediation object to every book and return portfolio metadata."""
    if _is_sample_payload(payload):
        raise ValueError("chapter-sample remediation is disabled; use a full-content evaluation")
    books = _sequence(payload.get("books"))
    totals = Counter()
    priority_totals = Counter()
    evidence_totals = Counter()
    packet_totals = Counter()
    domain_totals = Counter()
    for index, raw_book in enumerate(books):
        if not isinstance(raw_book, MutableMapping):
            raise ValueError(f"books[{index}] must be an object")
        book = _normalise_book(payload, raw_book, index)
        conditions = _conditions(book)
        direct = _direct_evidence(book)
        diagnostics = _contextual_diagnostics(book)
        chapters = _chapter_context(book)
        workstreams = _workstreams(book, conditions, diagnostics)
        counts = Counter(condition["scope"] for condition in conditions)
        priorities = Counter(condition["priority"] for condition in conditions)
        evidence = Counter(condition["evidence_class"] for condition in conditions)
        prompt = _prompt(book, conditions, workstreams, direct, diagnostics, chapters)
        remediation = {
            "threshold_percent": 80.0,
            "required": bool(conditions),
            "overall_below_80": book["score"] < 80,
            "minimum_overall_lift": round(max(0.0, 80.0 - book["score"]), 4),
            "minimum_overall_lift_basis": "Supplied displayed overall score; a fresh evaluator must recompute from source evidence.",
            "evaluation_mode": book["evaluation_mode"],
            "condition_count": len(conditions),
            "condition_counts": {"overall": counts["overall"], "domain": counts["domain"], "subcriterion": counts["subcriterion"]},
            "priority_counts": {priority: priorities[priority] for priority in ("P0", "P1", "P2", "P3")},
            "condition_evidence_counts": {key: evidence[key] for key in ("direct", "contextual", "score-only")},
            "evidence_packet_counts": {"direct_items": len(direct), "contextual_signals": len(diagnostics)},
            "conditions": conditions,
            "direct_evidence": list(direct),
            "contextual_diagnostics": list(diagnostics),
            "chapter_context": list(chapters),
            "workstreams": workstreams,
            "prompt_markdown": prompt,
        }
        raw_book["remediation"] = remediation
        totals.update(counts)
        priority_totals.update(priorities)
        evidence_totals.update(evidence)
        packet_totals["books_with_direct_items"] += int(bool(direct))
        packet_totals["books_with_contextual_signals"] += int(bool(diagnostics))
        packet_totals["direct_items"] += len(direct)
        packet_totals["contextual_signals"] += len(diagnostics)
        for condition in conditions:
            if condition["scope"] == "domain":
                domain_totals[condition["domain_key"]] += 1
    summary = {
        "threshold_percent": 80.0,
        "books": len(books),
        "books_with_conditions": sum(bool(_mapping(book).get("remediation", {}).get("condition_count")) for book in books),
        "books_below_80_overall": totals["overall"],
        "conditions": {"overall": totals["overall"], "domain": totals["domain"], "subcriterion": totals["subcriterion"], "total": sum(totals.values())},
        "priorities": {priority: priority_totals[priority] for priority in ("P0", "P1", "P2", "P3")},
        "condition_evidence_classes": {key: evidence_totals[key] for key in ("direct", "contextual", "score-only")},
        "evidence_packets": {key: packet_totals[key] for key in ("books_with_direct_items", "books_with_contextual_signals", "direct_items", "contextual_signals")},
        "domain_trigger_counts": {spec["key"]: domain_totals[spec["key"]] for spec in DOMAIN_SPECS},
        "generation_rule": "One complete ledger entry per raw score below 80%; one comprehensive deduplicated implementation prompt per book.",
    }
    payload["remediation_summary"] = summary
    return summary


def remediation_pack(payload: MutableMapping[str, Any]) -> dict[str, Any]:
    summary = attach_remediation(payload)
    books = []
    for index, book in enumerate(_sequence(payload.get("books"))):
        normalised = _normalise_book(payload, _mapping(book), index)
        books.append({
            "book_id": normalised["id"], "title": normalised["title"], "author": normalised["author"],
            "source_file": normalised["source_file"], "rank": normalised["rank"], "overall_score": normalised["score"],
            "remediation": _mapping(book).get("remediation"),
        })
    return {"schema_version": "1.0.0", "summary": summary, "books": books}


def markdown_pack(pack: Mapping[str, Any]) -> str:
    summary = _mapping(pack.get("summary"))
    header = (
        "# ChapterFlow below-80 remediation prompt pack\n\n"
        f"- Books: {summary.get('books', 0)}\n"
        f"- Books with conditions: {summary.get('books_with_conditions', 0)}\n"
        f"- Overall conditions: {_mapping(summary.get('conditions')).get('overall', 0)}\n"
        f"- Domain conditions: {_mapping(summary.get('conditions')).get('domain', 0)}\n"
        f"- Subcriterion conditions: {_mapping(summary.get('conditions')).get('subcriterion', 0)}\n\n"
        "Each prompt preserves every strict-below-80 condition while deduplicating implementation into domain workstreams.\n\n"
    )
    prompts = [_text(_mapping(_mapping(item).get("remediation")).get("prompt_markdown")) for item in _sequence(pack.get("books"))]
    return header + "\n\n---\n\n".join(prompt for prompt in prompts if prompt) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Canonical or normalized report-data JSON")
    parser.add_argument("--output-report-data", type=Path, help="Write report data with remediation attached")
    parser.add_argument("--json-output", type=Path, help="Write the compact remediation prompt pack as JSON")
    parser.add_argument("--markdown-output", type=Path, help="Write all book prompts as Markdown")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not any((args.output_report_data, args.json_output, args.markdown_output)):
        raise SystemExit("at least one output argument is required")
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(payload, MutableMapping):
        raise SystemExit("input report data must be a JSON object")
    pack = remediation_pack(payload)
    if args.output_report_data:
        _atomic_write(args.output_report_data, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    if args.json_output:
        _atomic_write(args.json_output, json.dumps(pack, ensure_ascii=False, indent=2) + "\n")
    if args.markdown_output:
        _atomic_write(args.markdown_output, markdown_pack(pack))
    print(json.dumps(pack["summary"], indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
