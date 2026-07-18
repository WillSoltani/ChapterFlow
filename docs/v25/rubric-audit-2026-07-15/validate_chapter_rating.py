#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

SKILL_SCRIPTS = Path(__file__).resolve().parents[3] / ".agents/skills/chapterflow-book-evaluator/scripts"
sys.path.insert(0, str(SKILL_SCRIPTS))
from worker_receipts import artifact_sha256, validate_dispatch_receipt  # noqa: E402

DOMAINS = {
    "epistemic_integrity": (15, ["claim_support_fit", "uncertainty_limitations", "internal_consistency_qa", "misuse_safeguards"]),
    "audience_fit": (12, ["language_clarity", "beginner_onboarding", "signal_noise_framework_load", "audience_context_accessibility"]),
    "mental_model_coherence": (15, ["central_model", "mechanism_causal_explanation", "cross_concept_integration", "nuance_diagnostic_power"]),
    "learning_architecture": (12, ["sequencing_scaffolding", "worked_examples_contrasts", "active_processing", "feedback_metacognitive_calibration"]),
    "retention_retrieval": (10, ["meaningful_retrieval_cues", "cumulative_reinforcement", "quiz_retrieval_depth", "interference_control_consolidation"]),
    "transfer_action_judgment": (15, ["concrete_actions", "cross_context_transfer", "implementation_feedback_support", "boundaries_adaptation_tradeoffs"]),
    "motivation_autonomy": (8, ["personal_relevance", "achievable_progress", "autonomy_non_shaming_tone", "calibrated_confidence"]),
    "engagement_momentum": (8, ["curiosity_momentum", "narrative_example_vividness", "emotional_relevance", "instructional_alignment"]),
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--inspection", type=Path, required=True)
    parser.add_argument("--dispatch", type=Path, required=True)
    args = parser.parse_args()

    result = json.loads(args.input.read_text())
    inspection = json.loads(args.inspection.read_text())
    dispatch = json.loads(args.dispatch.read_text())
    errors: list[str] = []

    if result.get("schema_version") != "1.0.0":
        errors.append("schema_version must be 1.0.0")
    if result.get("artifact_type") != "chapterflow_standalone_chapter_rating":
        errors.append("artifact_type is invalid")
    errors.extend(validate_dispatch_receipt(dispatch, result=result, inspection=inspection))
    if result.get("worker_task_id") != dispatch.get("worker_task_id"):
        errors.append("worker_task_id differs from receipt")
    if result.get("worker_session_id") != dispatch.get("worker_session_id"):
        errors.append("worker_session_id differs from receipt")

    source = Path(inspection["source_path"])
    source_bytes = source.read_bytes()
    if hashlib.sha256(source_bytes).hexdigest() != inspection.get("source_hash"):
        errors.append("source hash drift")
    headings = [line for line in source.read_text().splitlines() if line.startswith("#")]
    heading_hash = hashlib.sha256(("\n".join(headings) + "\n").encode()).hexdigest()
    if heading_hash != inspection.get("heading_inventory_sha256"):
        errors.append("heading inventory drift")

    chapter = result.get("chapter") or {}
    expected_chapter = inspection["chapter_inventory"][0]
    for key in ("chapter_id", "number", "title"):
        if chapter.get(key) != expected_chapter.get(key):
            errors.append(f"chapter.{key} differs from inspection")
    if chapter.get("source_path") != inspection.get("source_path"):
        errors.append("chapter.source_path differs from inspection")
    if chapter.get("heading_inventory_sha256") != inspection.get("heading_inventory_sha256"):
        errors.append("chapter.heading_inventory_sha256 differs from inspection")
    if chapter.get("read_status") != "full":
        errors.append("chapter.read_status must be full")
    section_inventory = chapter.get("section_inventory")
    if not isinstance(section_inventory, list) or len(section_inventory) != len(headings) - 1:
        errors.append(f"section_inventory must cover all {len(headings) - 1} H2/H3 headings")

    scope = result.get("scope") or {}
    expected_scope = {
        "actual_book_inventory_complete": False,
        "full_book_score": None,
        "full_book_certification": "unevaluable",
        "domain_9": "unassessable",
    }
    if scope.get("scope_type", scope.get("type", scope.get("name", result.get("scope") if isinstance(result.get("scope"), str) else None))) not in (None, "standalone_chapter_audit"):
        errors.append("scope type must be standalone_chapter_audit")
    for key, value in expected_scope.items():
        if scope.get(key) != value:
            errors.append(f"scope.{key} must equal {value!r}")

    domains = result.get("domains") or {}
    if set(domains) != set(DOMAINS):
        errors.append("domains must contain exactly Domains 1-8")
    weighted_total = 0.0
    for domain_key, (weight, criterion_keys) in DOMAINS.items():
        domain = domains.get(domain_key) or {}
        if domain.get("weight") != weight:
            errors.append(f"{domain_key}.weight must be {weight}")
        subs = domain.get("subcriteria") or {}
        if set(subs) != set(criterion_keys):
            errors.append(f"{domain_key}.subcriteria keys are invalid")
            continue
        ratings = []
        for criterion_key in criterion_keys:
            sub = subs.get(criterion_key) or {}
            rating = sub.get("rating")
            if not isinstance(rating, int) or isinstance(rating, bool) or not 0 <= rating <= 4:
                errors.append(f"{domain_key}.{criterion_key}.rating must be integer 0-4")
                continue
            ratings.append(rating)
            if not str(sub.get("rationale") or sub.get("anchor_rationale") or "").strip():
                errors.append(f"{domain_key}.{criterion_key} needs rationale")
            evidence = sub.get("evidence")
            if not isinstance(evidence, list) or not evidence:
                errors.append(f"{domain_key}.{criterion_key} needs evidence")
        if len(ratings) == 4:
            expected_score = sum(ratings) / 4
            expected_points = expected_score / 4 * weight
            if not math.isclose(float(domain.get("domain_score", -1)), expected_score, abs_tol=1e-9):
                errors.append(f"{domain_key}.domain_score arithmetic mismatch")
            if not math.isclose(float(domain.get("weighted_points", -1)), expected_points, abs_tol=1e-9):
                errors.append(f"{domain_key}.weighted_points arithmetic mismatch")
            weighted_total += expected_points
        if len(domain.get("strengths") or []) < 2:
            errors.append(f"{domain_key} needs at least two strengths")
        if len(domain.get("limitations") or []) < 1:
            errors.append(f"{domain_key} needs at least one limitation")
        if not str(domain.get("pattern") or domain.get("within_chapter_pattern") or "").strip():
            errors.append(f"{domain_key} needs pattern")
        if not str(domain.get("rationale") or domain.get("anchor_linked_rationale") or domain.get("anchor_rationale") or "").strip():
            errors.append(f"{domain_key} needs rationale")
        if not str(domain.get("scope_note") or "").strip():
            errors.append(f"{domain_key} needs scope_note")

    expected_diagnostic = weighted_total / 95 * 100
    if not math.isclose(float(result.get("chapter_diagnostic_score", -1)), expected_diagnostic, abs_tol=1e-9):
        errors.append("chapter_diagnostic_score arithmetic mismatch")
    if len(result.get("improvements") or []) != 3:
        errors.append("exactly three improvements required")
    for key in ("diagnostic_band", "strongest_qualities", "weakest_qualities", "engagement_curve", "comprehension_retention_analysis", "practical_use_judgment_analysis", "best_fit_readers", "struggling_readers", "verdict"):
        if not result.get(key):
            errors.append(f"missing {key}")

    if errors:
        for error in sorted(set(errors)):
            print(error)
        return 2
    print(json.dumps({
        "status": "valid",
        "input": str(args.input),
        "result_canonical_sha256": artifact_sha256(result),
        "chapter_diagnostic_score": result["chapter_diagnostic_score"],
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
