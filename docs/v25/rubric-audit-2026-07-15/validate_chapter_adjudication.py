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
from worker_receipts import artifact_sha256, validate_pair_chain  # noqa: E402

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


def ratings(record: dict) -> dict[str, float]:
    result = {}
    for domain_key, (_, subkeys) in DOMAINS.items():
        for subkey in subkeys:
            path = f"domains.{domain_key}.subcriteria.{subkey}"
            result[path] = record["domains"][domain_key]["subcriteria"][subkey]["rating"]
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    for name in ("input", "primary", "verification", "primary_dispatch", "verification_dispatch", "inspection", "pair_seal"):
        parser.add_argument(f"--{name.replace('_', '-')}", dest=name, type=Path, required=True)
    args = parser.parse_args()
    record = json.loads(args.input.read_text())
    primary = json.loads(args.primary.read_text())
    verification = json.loads(args.verification.read_text())
    primary_dispatch = json.loads(args.primary_dispatch.read_text())
    verification_dispatch = json.loads(args.verification_dispatch.read_text())
    inspection = json.loads(args.inspection.read_text())
    pair_seal = json.loads(args.pair_seal.read_text())
    errors: list[str] = []

    errors.extend(validate_pair_chain(primary=primary, verification=verification, primary_dispatch=primary_dispatch, verification_dispatch=verification_dispatch, pair_seal=pair_seal, inspection=inspection))
    if record.get("schema_version") != "1.0.0" or record.get("artifact_type") != "chapterflow_standalone_chapter_adjudication":
        errors.append("adjudication schema identity is invalid")
    if record.get("rater_role") != "adjudicated":
        errors.append("rater_role must be adjudicated")
    if record.get("run_id") != primary.get("run_id") or record.get("source_hash") != inspection.get("source_hash"):
        errors.append("adjudication source/run binding mismatch")
    if (record.get("book") or {}).get("book_id") != inspection.get("book_id"):
        errors.append("adjudication book id mismatch")
    if record.get("blind_pair_seal_sha256") != artifact_sha256(pair_seal):
        errors.append("blind_pair_seal_sha256 mismatch")

    source = Path(inspection["source_path"])
    if hashlib.sha256(source.read_bytes()).hexdigest() != inspection.get("source_hash"):
        errors.append("source hash drift")
    headings = [line for line in source.read_text().splitlines() if line.startswith("#")]
    heading_hash = hashlib.sha256(("\n".join(headings) + "\n").encode()).hexdigest()
    chapter = record.get("chapter") or {}
    if heading_hash != inspection.get("heading_inventory_sha256") or chapter.get("heading_inventory_sha256") != heading_hash:
        errors.append("heading inventory mismatch")
    if chapter.get("read_status") != "full" or len(chapter.get("section_inventory") or []) != len(headings) - 1:
        errors.append("adjudication section coverage incomplete")
    expected_chapter = inspection["chapter_inventory"][0]
    for key in ("chapter_id", "number", "title"):
        if chapter.get(key) != expected_chapter.get(key):
            errors.append(f"chapter.{key} mismatch")

    scope = record.get("scope") or {}
    for key, value in {
        "scope_type": "standalone_chapter_audit",
        "actual_book_inventory_complete": False,
        "full_book_score": None,
        "full_book_certification": "unevaluable",
        "domain_9": "unassessable",
    }.items():
        if scope.get(key) != value:
            errors.append(f"scope.{key} mismatch")

    domains = record.get("domains") or {}
    if set(domains) != set(DOMAINS):
        errors.append("adjudication domains must contain exactly Domains 1-8")
    weighted_total = 0.0
    for domain_key, (weight, subkeys) in DOMAINS.items():
        domain = domains.get(domain_key) or {}
        subs = domain.get("subcriteria") or {}
        if domain.get("weight") != weight or set(subs) != set(subkeys):
            errors.append(f"{domain_key} structure invalid")
            continue
        values = []
        for subkey in subkeys:
            sub = subs[subkey]
            value = sub.get("rating")
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not 0 <= value <= 4 or not math.isclose(value * 2, round(value * 2), abs_tol=1e-9):
                errors.append(f"{domain_key}.{subkey}.rating must be a half-point 0-4")
                continue
            values.append(float(value))
            if not str(sub.get("rationale") or sub.get("anchor_rationale") or "").strip() or not (sub.get("evidence") or []):
                errors.append(f"{domain_key}.{subkey} lacks rationale/evidence")
        if len(values) == 4:
            expected_domain = sum(values) / 4
            expected_points = expected_domain / 4 * weight
            if not math.isclose(float(domain.get("domain_score", -1)), expected_domain, abs_tol=1e-9):
                errors.append(f"{domain_key}.domain_score arithmetic mismatch")
            if not math.isclose(float(domain.get("weighted_points", -1)), expected_points, abs_tol=1e-9):
                errors.append(f"{domain_key}.weighted_points arithmetic mismatch")
            weighted_total += expected_points
        if len(domain.get("strengths") or []) < 2 or len(domain.get("limitations") or []) < 1:
            errors.append(f"{domain_key} evidence minimums fail")
        if not str(domain.get("pattern") or domain.get("within_chapter_pattern") or "").strip():
            errors.append(f"{domain_key} missing pattern")
        if not str(domain.get("rationale") or domain.get("anchor_linked_rationale") or domain.get("anchor_rationale") or "").strip():
            errors.append(f"{domain_key} missing rationale")
        if not str(domain.get("scope_note") or "").strip():
            errors.append(f"{domain_key} missing scope_note")
    expected_diagnostic = weighted_total / 95 * 100
    if not math.isclose(float(record.get("chapter_diagnostic_score", -1)), expected_diagnostic, abs_tol=1e-9):
        errors.append("chapter diagnostic arithmetic mismatch")

    pvals, vvals = ratings(primary), ratings(verification)
    diffs = {path: abs(pvals[path] - vvals[path]) for path in pvals}
    agreement = record.get("rater_agreement") or {}
    expected_mad = sum(diffs.values()) / len(diffs)
    if not math.isclose(float(agreement.get("mean_absolute_subcriterion_difference", -1)), expected_mad, abs_tol=1e-9):
        errors.append("mean agreement metric mismatch")
    if not math.isclose(float(agreement.get("maximum_subcriterion_difference", -1)), max(diffs.values()), abs_tol=1e-9):
        errors.append("maximum agreement metric mismatch")
    expected_score_diff = abs(primary["chapter_diagnostic_score"] - verification["chapter_diagnostic_score"])
    if not math.isclose(float(agreement.get("chapter_diagnostic_score_difference", -1)), expected_score_diff, abs_tol=1e-9):
        errors.append("diagnostic score difference mismatch")
    input_records = agreement.get("input_records") or {}
    if input_records.get("primary_canonical_sha256") != artifact_sha256(primary) or input_records.get("verification_canonical_sha256") != artifact_sha256(verification):
        errors.append("agreement input record hashes mismatch")
    expected_disagreements = {path for path, diff in diffs.items() if diff}
    actual_disagreements = {item.get("path") for item in agreement.get("disagreements") or []}
    if actual_disagreements != expected_disagreements:
        errors.append("disagreement inventory mismatch")
    for item in agreement.get("disagreements") or []:
        path = item.get("path")
        if path in pvals and (item.get("primary") != pvals[path] or item.get("verification") != vvals[path] or not item.get("source_rechecked")):
            errors.append(f"disagreement record invalid for {path}")

    if len(record.get("improvements") or []) != 3:
        errors.append("exactly three improvements required")
    calibration_changes = record.get("calibration_changes")
    if not isinstance(calibration_changes, list):
        errors.append("calibration_changes must be an array")
    else:
        final_values = ratings(record)
        seen_calibration_paths = set()
        for change in calibration_changes:
            path = change.get("path") if isinstance(change, dict) else None
            if path not in final_values or path in seen_calibration_paths:
                errors.append("calibration change path is invalid or duplicated")
                continue
            seen_calibration_paths.add(path)
            original = change.get("original")
            final = change.get("final")
            if not isinstance(original, (int, float)) or not isinstance(final, (int, float)):
                errors.append(f"calibration change values invalid for {path}")
            elif original == final or final != final_values[path] or not math.isclose(final * 2, round(final * 2), abs_tol=1e-9):
                errors.append(f"calibration change binding invalid for {path}")
            if not str(change.get("reason") or "").strip() or not (change.get("evidence") or []):
                errors.append(f"calibration change lacks reason/evidence for {path}")
    confidence = record.get("confidence") or {}
    if confidence.get("supplied_chapter_completeness_ratio") != 1.0 or confidence.get("actual_book_ambiguity") != "material":
        errors.append("confidence must preserve chapter completeness and actual-book ambiguity")

    if errors:
        for error in sorted(set(errors)):
            print(error)
        return 2
    print(json.dumps({"status": "valid", "result_canonical_sha256": artifact_sha256(record), "chapter_diagnostic_score": record["chapter_diagnostic_score"], "mean_absolute_subcriterion_difference": expected_mad}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
