#!/usr/bin/env python3
"""Convert one full-content adjudication into the compact 140-book report shape."""

from __future__ import annotations

import argparse
import copy
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Mapping, Sequence

from common import EvaluationError, agreement_statistics, atomic_write_json, estimate_word_count, inspect_package, read_json, source_hash
from generate_remediation_prompts import DOMAIN_SPECS
from validate_book_result import validate_result
from worker_receipts import artifact_sha256, validate_pair_chain


SUBCRITERION_KEYS = {
    "epistemic_integrity": ["claim_support_fit", "uncertainty_limitations", "internal_consistency_qa", "misuse_safeguards"],
    "audience_fit": ["language_clarity", "beginner_onboarding", "signal_noise_framework_load", "audience_context_accessibility"],
    "mental_model_coherence": ["central_model", "mechanism_causal_explanation", "cross_concept_integration", "nuance_diagnostic_power"],
    "learning_architecture": ["sequencing_scaffolding", "worked_examples_contrasts", "active_processing", "feedback_metacognitive_calibration"],
    "retention_retrieval": ["meaningful_retrieval_cues", "cumulative_reinforcement", "quiz_retrieval_depth", "interference_control_consolidation"],
    "transfer_action_judgment": ["concrete_actions", "cross_context_transfer", "implementation_feedback_support", "boundaries_adaptation_tradeoffs"],
    "motivation_autonomy": ["personal_relevance", "achievable_progress", "autonomy_non_shaming_tone", "calibrated_confidence"],
    "engagement_momentum": ["curiosity_momentum", "narrative_example_vividness", "emotional_relevance", "instructional_alignment"],
    "whole_book_coherence": ["chapter_necessity_order", "quality_consistency_pacing", "redundancy_cumulative_load", "synthesis_completion_value"],
}
ADJUDICATED_SCHEMA = Path(__file__).resolve().parents[1] / "references" / "adjudicated-book.schema.json"
BLIND_SCHEMA = Path(__file__).resolve().parents[1] / "references" / "book-evaluation.schema.json"


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _sequence(value: Any) -> list[Any]:
    return list(value) if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)) else []


def _status(value: Any) -> str:
    text = str(value or "").replace("_", " ").strip()
    return " ".join(part.capitalize() for part in text.split()) or "Not supplied"


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


def _find_existing(report: Mapping[str, Any], book_id: str) -> dict[str, Any]:
    matches = [
        item for item in _sequence(report.get("books"))
        if isinstance(item, Mapping) and str(item.get("id") or "") == book_id
    ]
    if len(matches) != 1:
        raise EvaluationError(f"expected exactly one portfolio book for {book_id!r}; found {len(matches)}")
    return copy.deepcopy(dict(matches[0]))


def _package_book(package: Mapping[str, Any]) -> Mapping[str, Any]:
    return _mapping(package.get("book"))


def _package_chapters(package: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    chapters = [item for item in _sequence(package.get("chapters")) if isinstance(item, Mapping)]
    if len(chapters) != len(_sequence(package.get("chapters"))):
        raise EvaluationError("package contains a non-object chapter")
    return chapters


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, Mapping):
        result = []
        for item in value.values():
            result.extend(_strings(item))
        return result
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        result = []
        for item in value:
            result.extend(_strings(item))
        return result
    return []


def _compact_chapters(chapters: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for index, chapter in enumerate(chapters, 1):
        quiz = _mapping(chapter.get("quiz"))
        blooms = Counter(str(_mapping(item).get("bloomLevel") or "").casefold() for item in _sequence(quiz.get("questions")))
        memorable = _strings(chapter.get("memorableLines"))
        examples = [str(_mapping(item).get("title") or "").strip() for item in _sequence(chapter.get("examples"))]
        takeaway = str(chapter.get("keyTakeaway") or "").strip()
        immediate = str(chapter.get("tryThisNow") or "").strip()
        result.append({
            "number": chapter.get("number", index),
            "title": str(chapter.get("title") or f"Chapter {index}"),
            "hook": str(chapter.get("hook") or ""),
            "counterintuition": str(chapter.get("counterintuition") or ""),
            "takeaway": takeaway,
            "try": immediate or None,
            "extracts": memorable[:6],
            "examples": [item for item in examples if item],
            "blooms": {key: value for key, value in blooms.items() if key},
            "coreSkill": takeaway,
            "challenge": immediate,
        })
    return result


def _diagnostics(chapters: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    chapter_words = [estimate_word_count(chapter) for chapter in chapters]
    examples = [item for chapter in chapters for item in _sequence(chapter.get("examples")) if isinstance(item, Mapping)]
    questions = [item for chapter in chapters for item in _sequence(_mapping(chapter.get("quiz")).get("questions")) if isinstance(item, Mapping)]
    review_cards = [item for chapter in chapters for item in _sequence(chapter.get("reviewCards"))]
    memorable_lines = [item for chapter in chapters for item in _sequence(chapter.get("memorableLines"))]
    correct_longest = 0
    ratios = []
    higher = 0
    invalid = 0
    for question in questions:
        choices = [str(item) for item in _sequence(question.get("choices"))]
        correct = question.get("correctIndex")
        if not isinstance(correct, int) or isinstance(correct, bool) or correct < 0 or correct >= len(choices):
            invalid += 1
            continue
        lengths = [max(len(re.findall(r"\b[\w'-]+\b", choice)), 1) for choice in choices]
        other = [length for index, length in enumerate(lengths) if index != correct]
        if other:
            ratios.append(lengths[correct] / max(mean(other), 0.1))
            if lengths[correct] > max(other):
                correct_longest += 1
        if str(question.get("bloomLevel") or "").casefold() not in {"", "remember", "understand"}:
            higher += 1
    exact_time = re.compile(r"\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*[ap]\.?m\.?)?\b", re.IGNORECASE)
    exact_time_examples = sum(bool(exact_time.search(" ".join(_strings(item)))) for item in examples)
    mean_words = mean(chapter_words) if chapter_words else 0.0
    variance = mean((value - mean_words) ** 2 for value in chapter_words) if chapter_words else 0.0
    duplicate_full = len(chapters) - len({json.dumps(chapter, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for chapter in chapters})
    return {
        "diagnostics_provenance": "post-repair package recomputation; unsupported legacy metrics intentionally omitted",
        "chapters": len(chapters),
        "total_words": sum(chapter_words),
        "mean_chapter_words": mean_words,
        "chapter_word_cv": math.sqrt(variance) / mean_words if mean_words else 0.0,
        "examples": len(examples),
        "examples_per_chapter": len(examples) / len(chapters) if chapters else 0.0,
        "exact_time_example_share": exact_time_examples / len(examples) if examples else 0.0,
        "questions": len(questions),
        "questions_per_chapter": len(questions) / len(chapters) if chapters else 0.0,
        "higher_bloom_share": higher / len(questions) if questions else 0.0,
        "correct_longest_share": correct_longest / len(questions) if questions else 0.0,
        "answer_length_ratio": mean(ratios) if ratios else 0.0,
        "invalid_questions": invalid,
        "review_cards": len(review_cards),
        "cards_per_chapter": len(review_cards) / len(chapters) if chapters else 0.0,
        "memorable_lines": len(memorable_lines),
        "lines_per_chapter": len(memorable_lines) / len(chapters) if chapters else 0.0,
        "try_missing_share": sum(not str(chapter.get("tryThisNow") or "").strip() for chapter in chapters) / len(chapters) if chapters else 0.0,
        "duplicate_full": duplicate_full,
        "missing_fields": 0,
    }


def _validate_rater_pair(
    primary: Mapping[str, Any],
    verification: Mapping[str, Any],
    adjudicated: Mapping[str, Any],
    *,
    source_inspection: Mapping[str, Any],
    actual_hash: str,
    book_id: str,
    primary_dispatch: Mapping[str, Any],
    verification_dispatch: Mapping[str, Any],
    pair_seal: Mapping[str, Any],
) -> dict[str, Any]:
    schema = read_json(BLIND_SCHEMA)
    run_id = str(adjudicated.get("run_id") or "")
    errors: list[str] = []
    for role, record in (("primary", primary), ("verification", verification)):
        errors.extend(
            f"{role}: {item}"
            for item in validate_result(
                record,
                schema=schema,
                expected_source_hash=actual_hash,
                expected_book_id=book_id,
                expected_run_id=run_id,
                expected_role=role,
                source_inspection=source_inspection,
                worker_dispatch_receipt=primary_dispatch if role == "primary" else verification_dispatch,
                blind_pair_seal=pair_seal,
                require_full_content=True,
                adjudicated=False,
            )
        )
    errors.extend(
        f"worker receipt chain: {item}"
        for item in validate_pair_chain(
            primary=primary,
            verification=verification,
            primary_dispatch=primary_dispatch,
            verification_dispatch=verification_dispatch,
            pair_seal=pair_seal,
            inspection=source_inspection,
        )
    )
    primary_job = str(primary.get("job_id") or "")
    verification_job = str(verification.get("job_id") or "")
    adjudicated_job = str(adjudicated.get("job_id") or "")
    if not primary_job or not verification_job or not adjudicated_job or len({primary_job, verification_job, adjudicated_job}) != 3:
        errors.append("primary, verification, and adjudicated records must have distinct nonempty job_id values")

    if not errors:
        expected = agreement_statistics(primary, verification)
        actual = _mapping(adjudicated.get("rater_agreement"))
        for key in (
            "mean_absolute_subcriterion_difference",
            "maximum_subcriterion_difference",
            "overall_score_difference",
        ):
            try:
                matches = math.isclose(float(actual.get(key)), float(expected[key]), abs_tol=1e-9)
            except (TypeError, ValueError):
                matches = False
            if not matches:
                errors.append(f"adjudicated rater_agreement.{key} does not match the two blind records")

        expected_disagreements = {
            (str(item["path"]), float(item["primary"]), float(item["verification"]))
            for item in expected["disagreements"]
        }
        actual_disagreements = {
            (str(_mapping(item).get("path") or ""), float(_mapping(item).get("primary") or 0), float(_mapping(item).get("verification") or 0))
            for item in _sequence(actual.get("disagreements"))
        }
        if actual_disagreements != expected_disagreements:
            errors.append("adjudicated disagreement inventory does not match the two blind records")
        if any(_mapping(item).get("source_rechecked") is not True for item in _sequence(actual.get("disagreements"))):
            errors.append("every adjudicated rating disagreement must be source-rechecked")

        expected_gate_conflicts = {
            (str(item["gate"]), str(item["primary"]), str(item["verification"]))
            for item in expected["gate_conflicts"]
        }
        actual_gate_conflicts = {
            (str(_mapping(item).get("gate") or ""), str(_mapping(item).get("primary") or ""), str(_mapping(item).get("verification") or ""))
            for item in _sequence(actual.get("gate_conflicts"))
        }
        if actual_gate_conflicts != expected_gate_conflicts:
            errors.append("adjudicated gate-conflict inventory does not match the two blind records")
        if any(_mapping(item).get("source_rechecked") is not True for item in _sequence(actual.get("gate_conflicts"))):
            errors.append("every adjudicated gate conflict must be source-rechecked")
    if errors:
        raise EvaluationError("invalid blind rater pair: " + " | ".join(errors))
    workers = _mapping(pair_seal.get("workers"))
    primary_worker = _mapping(workers.get("primary"))
    verification_worker = _mapping(workers.get("verification"))
    return {
        "blind_pair_id": pair_seal.get("pair_id"),
        "blind_pair_inventory_sha256": pair_seal.get("inventory_sha256"),
        "primary_dispatch_receipt_sha256": artifact_sha256(primary_dispatch),
        "verification_dispatch_receipt_sha256": artifact_sha256(verification_dispatch),
        "blind_pair_seal_sha256": artifact_sha256(pair_seal),
        "primary_worker_task_id": primary_worker.get("worker_task_id"),
        "primary_worker_session_id": primary_worker.get("worker_session_id"),
        "verification_worker_task_id": verification_worker.get("worker_task_id"),
        "verification_worker_session_id": verification_worker.get("worker_session_id"),
    }


def export_update(
    report: Mapping[str, Any],
    primary: Mapping[str, Any],
    verification: Mapping[str, Any],
    adjudicated: Mapping[str, Any],
    package: Mapping[str, Any],
    primary_dispatch: Mapping[str, Any],
    verification_dispatch: Mapping[str, Any],
    pair_seal: Mapping[str, Any],
    *,
    package_path: Path,
    evaluator_thread_id: str | None = None,
) -> dict[str, Any]:
    book_record = _mapping(adjudicated.get("book"))
    book_id = str(book_record.get("book_id") or "")
    title = str(book_record.get("title") or "")
    if not book_id:
        raise EvaluationError("adjudicated book.book_id is required")
    existing = _find_existing(report, book_id)
    chapters = _package_chapters(package)
    package_metadata = _package_book(package)
    actual_hash = source_hash(package_path)
    if adjudicated.get("source_hash") != actual_hash:
        raise EvaluationError("adjudicated source_hash does not match the current package")
    package_id = str(package_metadata.get("bookId") or package.get("packageId") or "")
    if package_id and package_id != book_id:
        raise EvaluationError(f"package book id mismatch: expected {book_id}, got {package_id}")
    expected = int(book_record.get("chapter_count_expected") or 0)
    if not bool(book_record.get("all_accessible_chapters_read")) or int(book_record.get("chapter_count_read_full") or 0) != expected:
        raise EvaluationError("adjudication is not a complete all-chapter evaluation")
    if int(book_record.get("chapter_count_partial") or 0) or int(book_record.get("chapter_count_inaccessible") or 0):
        raise EvaluationError("full-content portfolio updates cannot contain partial or inaccessible chapter reads")
    if len(chapters) != expected:
        raise EvaluationError(f"package has {len(chapters)} chapters; adjudication expected {expected}")
    source_inspection = inspect_package(package_path, package_path.parent / ".chapterflow-portfolio-inspection-tmp")
    receipt_proof = _validate_rater_pair(
        primary,
        verification,
        adjudicated,
        source_inspection=source_inspection,
        actual_hash=actual_hash,
        book_id=book_id,
        primary_dispatch=primary_dispatch,
        verification_dispatch=verification_dispatch,
        pair_seal=pair_seal,
    )
    schema = read_json(ADJUDICATED_SCHEMA)
    errors = validate_result(
        adjudicated,
        schema=schema,
        expected_source_hash=actual_hash,
        expected_book_id=book_id,
        expected_role="adjudicated",
        source_inspection=source_inspection,
        require_full_content=True,
        adjudicated=True,
    )
    if errors:
        raise EvaluationError("invalid adjudication: " + " | ".join(errors))

    domain_names = _sequence(report.get("domain_names"))
    expected_domain_names = [spec["label"] for spec in DOMAIN_SPECS]
    if domain_names != expected_domain_names:
        raise EvaluationError("portfolio domain_names do not match the canonical nine-domain rubric order")
    domain_scores: dict[str, float] = {}
    weighted_points: dict[str, float] = {}
    subcriteria: list[dict[str, Any]] = []
    existing_labels: dict[str, list[str]] = {}
    for item in _sequence(existing.get("subcriteria")):
        if not isinstance(item, Mapping):
            continue
        existing_labels.setdefault(str(item.get("domain") or ""), []).append(str(item.get("subcriterion") or ""))
    if len(_sequence(existing.get("subcriteria"))) != 36 or any(len(existing_labels.get(label, [])) != 4 for label in domain_names):
        raise EvaluationError("existing portfolio book must contain exactly four subcriteria in each of nine domains")
    for index, (spec, label) in enumerate(zip(DOMAIN_SPECS, domain_names), 1):
        domain = _mapping(_mapping(adjudicated.get("domains")).get(spec["key"]))
        score = float(domain.get("domain_score") or 0)
        domain_scores[str(label)] = score
        weighted_points[str(label)] = float(domain.get("weighted_points") or 0)
        ratings = _mapping(domain.get("subcriteria"))
        labels = existing_labels.get(str(label)) or list(spec["subcriteria"])
        for sub_index, key in enumerate(SUBCRITERION_KEYS[spec["key"]]):
            item = _mapping(ratings.get(key))
            evidence_count = len(_sequence(item.get("strength_evidence"))) + len(_sequence(item.get("limitation_evidence")))
            subcriteria.append({
                "domain": str(label),
                "subcriterion": labels[sub_index] if sub_index < len(labels) else spec["subcriteria"][sub_index],
                "rating": float(item.get("rating") or 0),
                "evidence_proxy": min(4, evidence_count),
                "rationale": str(item.get("rationale") or ""),
                "evidence": _sequence(item.get("strength_evidence")) + _sequence(item.get("limitation_evidence")),
            })

    score = float(adjudicated.get("overall_score") or 0)
    ranked_domains = sorted(domain_scores.items(), key=lambda item: (-item[1], item[0]))
    improvements = [str(item) for item in _sequence(_mapping(adjudicated.get("analysis")).get("highest_impact_improvements"))]
    weakest = sorted(domain_scores.items(), key=lambda item: (item[1], item[0]))[:2]
    strengths = [{"domain": label, "score": value} for label, value in ranked_domains[:2]]
    weaknesses = [
        {"domain": label, "score": value, "improvement": improvements[index] if index < len(improvements) else "Reinspect this domain against the rubric anchors."}
        for index, (label, value) in enumerate(weakest)
    ]
    gate_map = {
        "technical": "technical_completeness",
        "epistemic": "epistemic_instructional_safety",
        "ethics": "ethics_reader_autonomy",
        "purpose_audience": "purpose_audience_declaration",
        "external_accuracy": "external_accuracy",
    }
    gates = {}
    nonpass_notes = []
    for output_key, canonical_key in gate_map.items():
        gate = _mapping(_mapping(adjudicated.get("gates")).get(canonical_key))
        gates[output_key] = _status(gate.get("status"))
        if canonical_key != "external_accuracy" and str(gate.get("status")) != "pass":
            nonpass_notes.append(f"{output_key}: {gate.get('rationale')}")
    gates["note"] = " | ".join(nonpass_notes)

    qa_record = _mapping(adjudicated.get("qa"))
    qa = []
    for key in ("semantic_quiz_issues", "formulaic_pattern_notes", "self_validation_notes"):
        qa.extend(str(item) for item in _sequence(qa_record.get(key)) if str(item).strip())
    qa.extend(str(_mapping(item).get("description")) for item in _sequence(adjudicated.get("technical_findings")) if str(_mapping(item).get("description") or "").strip())
    if not qa:
        qa = ["No major structural anomaly was detected in the post-repair full-content adjudication."]
    diagnostics_full = _diagnostics(chapters)
    compact_chapters = _compact_chapters(chapters)
    analysis = _mapping(adjudicated.get("analysis"))

    existing.update({
        "title": str(package_metadata.get("title") or title),
        "author": str(package_metadata.get("author") or existing.get("author") or ""),
        "chapters": len(chapters),
        "words": int(book_record.get("word_count_estimate") or diagnostics_full["total_words"]),
        "score": score,
        "band": _band(score),
        "confidence": _status(_mapping(adjudicated.get("confidence")).get("level")),
        "profile_description": "Post-repair full-content evaluation with two blind raters and independent adjudication.",
        "gates": gates,
        "domains": domain_scores,
        "subcriteria": subcriteria,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "assessment": str(analysis.get("final_verdict") or analysis.get("overall_reader_experience") or ""),
        "qa": list(dict.fromkeys(qa)),
        "diagnostics_full": diagnostics_full,
        "diagnostics": {
            "quiz_longest_share": diagnostics_full["correct_longest_share"],
            "answer_length_ratio": diagnostics_full["answer_length_ratio"],
            "higher_bloom_share": diagnostics_full["higher_bloom_share"],
            "exact_time_example_share": diagnostics_full["exact_time_example_share"],
        },
        "chapter_evidence": compact_chapters,
        "file": package_path.name,
        "categories": list(_sequence(package_metadata.get("categories")) or _sequence(existing.get("categories"))),
        "tags": list(_sequence(package_metadata.get("tags")) or _sequence(existing.get("tags"))),
        "weighted_points": weighted_points,
        "evaluation_provenance": {
            "method": "full_book_blind_dual_rater_adjudication",
            "evaluation_mode": "full_content",
            "run_id": adjudicated.get("run_id"),
            "job_id": adjudicated.get("job_id"),
            "source_hash": actual_hash,
            "chapter_count_expected": expected,
            "chapter_count_read_full": expected,
            "all_chapters_read": True,
            "rater_pair_validated": True,
            "primary_job_id": primary.get("job_id"),
            "verification_job_id": verification.get("job_id"),
            **receipt_proof,
            "evaluator_thread_id": evaluator_thread_id,
            "evaluated_at_utc": datetime.now(timezone.utc).isoformat(),
        },
    })
    existing.pop("remediation", None)
    return {
        "schema_version": "1.0.0",
        "evaluation_mode": "full_content",
        "book_id": book_id,
        "source_hash": actual_hash,
        "book": existing,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report-data", type=Path, required=True)
    parser.add_argument("--primary", type=Path, required=True)
    parser.add_argument("--verification", type=Path, required=True)
    parser.add_argument("--primary-dispatch", type=Path, required=True)
    parser.add_argument("--verification-dispatch", type=Path, required=True)
    parser.add_argument("--blind-pair-seal", type=Path, required=True)
    parser.add_argument("--adjudicated", type=Path, required=True)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--evaluator-thread-id")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        report = read_json(args.report_data)
        primary = read_json(args.primary)
        verification = read_json(args.verification)
        primary_dispatch = read_json(args.primary_dispatch)
        verification_dispatch = read_json(args.verification_dispatch)
        pair_seal = read_json(args.blind_pair_seal)
        adjudicated = read_json(args.adjudicated)
        package = read_json(args.package)
        if not all(isinstance(item, Mapping) for item in (report, primary, verification, primary_dispatch, verification_dispatch, pair_seal, adjudicated, package)):
            raise EvaluationError("report, blind records, worker receipts, pair seal, adjudication, and package must be JSON objects")
        update = export_update(
            report,
            primary,
            verification,
            adjudicated,
            package,
            primary_dispatch,
            verification_dispatch,
            pair_seal,
            package_path=args.package,
            evaluator_thread_id=args.evaluator_thread_id,
        )
        atomic_write_json(args.output, update)
    except (EvaluationError, OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"portfolio export error: {exc}")
        return 2
    print(json.dumps({"book_id": update["book_id"], "score": update["book"]["score"], "chapters": update["book"]["chapters"], "output": str(args.output)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
