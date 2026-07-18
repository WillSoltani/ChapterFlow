"""Unit tests for deterministic rubric arithmetic and shared utilities."""

from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SKILL_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from common import (  # noqa: E402
    DOMAINS,
    EvaluationError,
    agreement_statistics,
    atomic_replace_directory,
    calculate_scores,
    classification_for,
    confidence_from_inputs,
    derive_certification,
    reference_standard_eligible,
    sha256_bytes,
    slugify,
    source_hash,
    write_csv,
)


def score_record(default_rating: float = 3) -> dict:
    record = {
        "gates": {
            "technical_completeness": {"status": "pass"},
            "epistemic_instructional_safety": {"status": "pass"},
            "ethics_reader_autonomy": {"status": "pass"},
            "purpose_audience_declaration": {"status": "pass"},
            "external_accuracy": {"status": "not_assessed"},
        },
        "domains": {},
    }
    for domain_key, definition in DOMAINS.items():
        record["domains"][domain_key] = {
            "weight": definition["weight"],
            "subcriteria": {
                subcriterion_key: {"rating": default_rating}
                for subcriterion_key in definition["subcriteria"]
            },
        }
    calculate_scores(record)
    return record


class RubricStructureTests(unittest.TestCase):
    def test_weights_domains_and_subcriteria_match_v2_contract(self) -> None:
        self.assertEqual(100, sum(item["weight"] for item in DOMAINS.values()))
        self.assertEqual(9, len(DOMAINS))
        self.assertEqual(36, sum(len(item["subcriteria"]) for item in DOMAINS.values()))
        self.assertTrue(all(len(item["subcriteria"]) == 4 for item in DOMAINS.values()))

    def test_domain_mean_weighted_points_and_overall_score(self) -> None:
        record = score_record(2)
        first_key = next(iter(DOMAINS))
        first_subcriteria = list(DOMAINS[first_key]["subcriteria"])
        for key, rating in zip(first_subcriteria, (4, 3, 2, 1), strict=True):
            record["domains"][first_key]["subcriteria"][key]["rating"] = rating

        calculated = calculate_scores(record)

        self.assertEqual(2.5, record["domains"][first_key]["domain_score"])
        self.assertEqual(9.375, record["domains"][first_key]["weighted_points"])
        expected = 50.0 - (15 * 0.5) + 9.375
        self.assertAlmostEqual(expected, calculated["overall_score"])
        self.assertAlmostEqual(expected, record["overall_score"])

    def test_calculation_accepts_half_points_but_rejects_other_fractions(self) -> None:
        record = score_record(3)
        first_domain = next(iter(DOMAINS))
        first_subcriterion = next(iter(DOMAINS[first_domain]["subcriteria"]))
        record["domains"][first_domain]["subcriteria"][first_subcriterion]["rating"] = 3.5
        calculate_scores(record)
        self.assertEqual(3.125, record["domains"][first_domain]["domain_score"])

        record["domains"][first_domain]["subcriteria"][first_subcriterion]["rating"] = 3.25
        with self.assertRaises(EvaluationError):
            calculate_scores(record)

    def test_uniform_ratings_produce_expected_weighted_total(self) -> None:
        for rating, expected in ((0, 0.0), (1, 25.0), (2, 50.0), (3, 75.0), (4, 100.0)):
            with self.subTest(rating=rating):
                self.assertEqual(expected, score_record(rating)["overall_score"])

    def test_classification_boundaries(self) -> None:
        cases = {
            100: "Reference-standard design, subject to gate and core-domain rules",
            90: "Reference-standard design, subject to gate and core-domain rules",
            89.999: "Strong design with identifiable improvements",
            80: "Strong design with identifiable improvements",
            79.999: "Valuable but materially uneven; targeted redesign needed",
            70: "Valuable but materially uneven; targeted redesign needed",
            69.999: "Substantial redesign needed",
            60: "Substantial redesign needed",
            59.999: "Not ready as a ChapterFlow learning product",
        }
        for score, expected in cases.items():
            with self.subTest(score=score):
                self.assertEqual(expected, classification_for(score))

    def test_reference_standard_requires_passing_gates_and_core_domains(self) -> None:
        record = score_record(4)
        self.assertTrue(reference_standard_eligible(record))

        record["gates"]["purpose_audience_declaration"]["status"] = "conditional"
        calculate_scores(record)
        self.assertFalse(reference_standard_eligible(record))
        self.assertEqual("Strong design with identifiable improvements", record["classification"])

        record = score_record(4)
        first_core = next(iter(DOMAINS))
        for subcriterion in DOMAINS[first_core]["subcriteria"]:
            record["domains"][first_core]["subcriteria"][subcriterion]["rating"] = 2
        calculate_scores(record)
        self.assertGreaterEqual(record["overall_score"], 90)
        self.assertLess(record["domains"][first_core]["domain_score"], 3)
        self.assertFalse(reference_standard_eligible(record))


class GateAndConfidenceTests(unittest.TestCase):
    def test_certification_is_separate_from_score(self) -> None:
        gates = score_record(4)["gates"]
        self.assertEqual("pass", derive_certification(gates))

        gates["technical_completeness"]["status"] = "conditional"
        self.assertEqual("conditional", derive_certification(gates))

        gates["technical_completeness"]["status"] = "pass"
        gates["ethics_reader_autonomy"]["status"] = "fail"
        self.assertEqual("fail", derive_certification(gates))

        gates["ethics_reader_autonomy"]["status"] = "pass"
        gates["purpose_audience_declaration"]["status"] = "unevaluable"
        self.assertEqual("unevaluable", derive_certification(gates))

    def test_confidence_thresholds_are_inclusive_and_quality_independent(self) -> None:
        common = {
            "unresolved_gate_conflict": False,
            "evidence_sufficient": True,
            "adjudication_complete": True,
        }
        self.assertEqual(
            "high",
            confidence_from_inputs(
                chapter_completeness_ratio=1.0,
                package_ambiguity="none",
                mean_difference=0.35,
                unresolved_maximum=1,
                **common,
            ),
        )
        self.assertEqual(
            "medium",
            confidence_from_inputs(
                chapter_completeness_ratio=0.9,
                package_ambiguity="minor",
                mean_difference=0.75,
                unresolved_maximum=4,
                **common,
            ),
        )
        self.assertEqual(
            "low",
            confidence_from_inputs(
                chapter_completeness_ratio=0.899,
                package_ambiguity="none",
                mean_difference=0.1,
                unresolved_maximum=0,
                **common,
            ),
        )

    def test_rater_agreement_uses_all_36_ratings_and_records_gate_conflicts(self) -> None:
        primary = score_record(3)
        verification = score_record(3)
        domain_key = next(iter(DOMAINS))
        subcriterion_key = next(iter(DOMAINS[domain_key]["subcriteria"]))
        verification["domains"][domain_key]["subcriteria"][subcriterion_key]["rating"] = 1
        verification["gates"]["purpose_audience_declaration"]["status"] = "conditional"
        calculate_scores(verification)

        agreement = agreement_statistics(primary, verification)

        self.assertAlmostEqual(2 / 36, agreement["mean_absolute_subcriterion_difference"])
        self.assertEqual(2, agreement["maximum_subcriterion_difference"])
        self.assertAlmostEqual(1.875, agreement["overall_score_difference"])
        self.assertEqual(1, len(agreement["disagreements"]))
        self.assertEqual(
            f"domains.{domain_key}.subcriteria.{subcriterion_key}",
            agreement["disagreements"][0]["path"],
        )
        self.assertEqual("purpose_audience_declaration", agreement["gate_conflicts"][0]["gate"])
        self.assertEqual(
            "low",
            confidence_from_inputs(
                chapter_completeness_ratio=1.0,
                package_ambiguity="none",
                mean_difference=0.1,
                unresolved_maximum=0,
                unresolved_gate_conflict=True,
                evidence_sufficient=True,
                adjudication_complete=True,
            ),
        )


class DeterministicUtilityTests(unittest.TestCase):
    def test_slug_is_stable_ascii_bounded_and_has_fallback(self) -> None:
        self.assertEqual("deja-vu-a-test", slugify("  Déjà Vu: A Test!  "))
        self.assertEqual("fixture", slugify("***", fallback="fixture"))
        self.assertLessEqual(len(slugify("word " * 100)), 80)
        self.assertEqual(slugify("Repeatable Title"), slugify("Repeatable Title"))

    def test_file_and_directory_hashes_are_stable_and_content_sensitive(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            left = root / "left"
            right = root / "right"
            left.mkdir()
            right.mkdir()
            (left / "chapter.txt").write_text("same synthetic chapter", encoding="utf-8")
            (right / "chapter.txt").write_text("same synthetic chapter", encoding="utf-8")
            self.assertEqual(source_hash(left), source_hash(right))
            expected = source_hash(left)
            self.assertEqual(expected, source_hash(left))
            (right / "chapter.txt").write_text("changed synthetic chapter", encoding="utf-8")
            self.assertNotEqual(expected, source_hash(right))
            self.assertEqual(sha256_bytes(b"abc"), sha256_bytes(b"abc"))

    def test_csv_writer_uses_rfc_compatible_quoting_utf8_and_crlf(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            output = Path(temp_name) / "data.csv"
            rows = [
                {
                    "title": 'Comma, quote " and newline\nplus café',
                    "details": {"z": 1, "a": "two"},
                }
            ]
            write_csv(output, ("title", "details"), rows)
            payload = output.read_bytes()
            self.assertIn(b"\r\n", payload)
            with output.open("r", encoding="utf-8", newline="") as handle:
                parsed = list(csv.DictReader(handle))
            self.assertEqual(rows[0]["title"], parsed[0]["title"])
            self.assertEqual({"a": "two", "z": 1}, json.loads(parsed[0]["details"]))

    def test_atomic_directory_replacement_removes_stale_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            source = root / "complete-run"
            latest = root / "latest"
            source.mkdir()
            latest.mkdir()
            (source / "report.html").write_text("new report", encoding="utf-8")
            (latest / "stale.txt").write_text("old", encoding="utf-8")

            atomic_replace_directory(source, latest)

            self.assertEqual("new report", (latest / "report.html").read_text(encoding="utf-8"))
            self.assertFalse((latest / "stale.txt").exists())
            self.assertEqual([], list(root.glob(".latest.*-*")))


if __name__ == "__main__":
    unittest.main()
