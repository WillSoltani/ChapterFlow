"""Deterministic below-80 remediation tests."""

from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SKILL_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from generate_remediation_prompts import DOMAIN_SPECS, attach_remediation, remediation_pack  # noqa: E402
from test_validation import valid_result  # noqa: E402


def payload_with_rating(rating: float, *, sample: bool = False) -> dict:
    book = valid_result(role="primary", rating=rating)
    book["rater_role"] = "adjudicated"
    book["rank"] = 1
    book["confidence"] = {
        "level": "high",
        "rationale": "Synthetic complete agreement.",
        "chapter_completeness_ratio": 1.0,
        "package_ambiguity": "none",
        "unresolved_issues": [],
    }
    book["rater_agreement"] = {
        "mean_absolute_subcriterion_difference": 0,
        "maximum_subcriterion_difference": 0,
        "overall_score_difference": 0,
        "gate_conflicts": [],
        "disagreements": [],
    }
    book["calibration_changes"] = []
    run = {"evaluation_mode": "chapter_sample" if sample else "full_content"}
    return {"run": run, "rubric": {"domains": {}}, "books": [book]}


def screening_payload() -> dict:
    domain_names = [item["label"] for item in DOMAIN_SPECS]
    subcriteria = [
        {"domain": spec["label"], "subcriterion": label, "rating": 3}
        for spec in DOMAIN_SPECS
        for label in spec["subcriteria"]
    ]
    book = {
        "id": "specific-book",
        "title": "Specific Book",
        "author": "Test Author",
        "file": "specific-book.json",
        "rank": 1,
        "score": 79.9,
        "confidence": "Medium",
        "domains": {name: 3.25 for name in domain_names},
        "weighted_points": {},
        "subcriteria": subcriteria,
        "gates": {
            "technical": "Pass", "epistemic": "Fail", "ethics": "Pass", "external_accuracy": "Not assessed",
            "note": "The named thought-broadcasting mechanism is insufficiently bounded.",
        },
        "assessment": "Thought broadcasting is presented as a mechanism without adequate boundaries.",
        "weaknesses": [{"domain": domain_names[4], "improvement": "Remove answer-length cues and add cue-free cumulative retrieval."}],
        "strengths": [],
        "qa": ["Correct answers are uniquely longest in 75% of questions."],
        "diagnostics_full": {"correct_longest_share": 0.75, "answer_length_ratio": 1.4},
        "chapter_evidence": [
            {"number": 1, "title": "Foundations", "takeaway": "Define the model.", "try": "Test it."},
            {"number": 7, "title": "Thought Broadcasting", "takeaway": "A broadcasting mechanism is proposed.", "try": "Inspect boundaries."},
        ],
        "tags": ["thought-broadcasting"],
    }
    return {
        "meta": {"evaluation_mode": "Single-evaluator screening audit"},
        "domain_names": domain_names,
        "domain_weights": {spec["label"]: spec["weight"] for spec in DOMAIN_SPECS},
        "books": [book],
    }


class RemediationPromptTests(unittest.TestCase):
    def test_rating_three_creates_complete_strict_ledger(self) -> None:
        payload = payload_with_rating(3)
        summary = attach_remediation(payload)
        remediation = payload["books"][0]["remediation"]
        self.assertEqual(46, remediation["condition_count"])
        self.assertEqual({"overall": 1, "domain": 9, "subcriterion": 36}, remediation["condition_counts"])
        self.assertEqual(46, summary["conditions"]["total"])
        self.assertEqual(36, remediation["priority_counts"]["P3"])
        self.assertIn("O-001", remediation["prompt_markdown"])
        self.assertIn("S-09-04", remediation["prompt_markdown"])
        self.assertIn("Do not edit scores", remediation["prompt_markdown"])

    def test_rating_four_has_prompt_but_no_conditions(self) -> None:
        payload = payload_with_rating(4)
        summary = attach_remediation(payload)
        remediation = payload["books"][0]["remediation"]
        self.assertEqual(0, remediation["condition_count"])
        self.assertFalse(remediation["required"])
        self.assertEqual(0, summary["conditions"]["total"])
        self.assertGreater(len(remediation["prompt_markdown"]), 500)

    def test_sample_mode_is_rejected(self) -> None:
        payload = payload_with_rating(3, sample=True)
        with self.assertRaisesRegex(ValueError, "chapter-sample remediation is disabled"):
            attach_remediation(payload)

    def test_generation_is_deterministic(self) -> None:
        first = payload_with_rating(2)
        second = copy.deepcopy(first)
        self.assertEqual(remediation_pack(first), remediation_pack(second))

    def test_screening_prompt_preserves_specific_evidence_and_gate_attribution(self) -> None:
        payload = screening_payload()
        attach_remediation(payload)
        remediation = payload["books"][0]["remediation"]
        prompt = remediation["prompt_markdown"]
        self.assertEqual(0.1, remediation["minimum_overall_lift"])
        self.assertEqual("Single-evaluator screening audit", remediation["evaluation_mode"])
        self.assertIn("Evaluation mode: Single-evaluator screening audit", prompt)
        self.assertIn("Thought broadcasting", prompt)
        self.assertIn("Chapter 7", prompt)
        self.assertNotIn("`ethics`: **Pass** —", prompt)
        self.assertGreater(remediation["evidence_packet_counts"]["direct_items"], 0)
        self.assertGreater(remediation["evidence_packet_counts"]["contextual_signals"], 0)

    def test_qa_evidence_is_mapped_and_promotes_affected_workstream(self) -> None:
        payload = screening_payload()
        attach_remediation(payload)
        streams = {item["domain_key"]: item for item in payload["books"][0]["remediation"]["workstreams"]}
        retention = streams["retention_retrieval"]
        self.assertEqual("P2", retention["priority"])
        self.assertTrue(retention["evidence"])
        self.assertTrue(retention["supporting_signals"])
        self.assertTrue(retention["unknowns"])
        self.assertTrue(retention["chapter_targets"])
        self.assertIn("Remove answer-length cues", " ".join(retention["instructions"]))


if __name__ == "__main__":
    unittest.main()
