"""Tests for exporting a source-bound full-book adjudication into portfolio data."""

from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SKILL_ROOT / "scripts"
TESTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))
if str(TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(TESTS_DIR))

from common import EvaluationError, calculate_scores, inspect_package, source_hash  # noqa: E402
from export_portfolio_book_update import export_update  # noqa: E402
from generate_remediation_prompts import DOMAIN_SPECS  # noqa: E402
from test_validation import valid_receipt_chain, valid_result  # noqa: E402
from validate_book_result import _jsonschema_errors  # noqa: E402


def compact_report() -> dict:
    domain_names = [spec["label"] for spec in DOMAIN_SPECS]
    subcriteria = [
        {
            "domain": spec["label"],
            "subcriterion": label,
            "rating": 2.0,
            "evidence_proxy": 1,
        }
        for spec in DOMAIN_SPECS
        for label in spec["subcriteria"]
    ]
    return {
        "domain_names": domain_names,
        "books": [
            {
                "id": "fixture-book",
                "title": "Synthetic Evaluation",
                "author": "Fixture Author",
                "rank": 1,
                "chapters": 2,
                "words": 100,
                "score": 50.0,
                "band": "Not ready",
                "domains": {name: 50.0 for name in domain_names},
                "subcriteria": subcriteria,
                "categories": ["Testing"],
                "tags": ["fixture"],
            }
        ],
    }


def package() -> dict:
    return {
        "schemaVersion": "2.1.0",
        "packageId": "fixture-book",
        "book": {
            "bookId": "fixture-book",
            "title": "Synthetic Evaluation",
            "author": "Fixture Author",
            "categories": ["Testing"],
            "tags": ["fixture", "full-book"],
        },
        "chapters": [
            {
                "chapterId": "chapter-1",
                "number": 1,
                "title": "Notice",
                "hook": "Notice the signal.",
                "keyTakeaway": "Observe before acting.",
                "tryThisNow": "Write down one observation.",
                "examples": [{"title": "Example A", "body": "A concrete case."}],
                "quiz": {"questions": [{"choices": ["Guess", "Observe"], "correctIndex": 1, "bloomLevel": "apply"}]},
            },
            {
                "chapterId": "chapter-2",
                "number": 2,
                "title": "Review",
                "hook": "Review the signal.",
                "keyTakeaway": "Use feedback to revise.",
                "tryThisNow": "Revise one observation.",
                "examples": [{"title": "Example B", "body": "A contrasting case."}],
                "quiz": {"questions": [{"choices": ["Ignore", "Revise"], "correctIndex": 1, "bloomLevel": "analyze"}]},
            },
        ],
    }


class PortfolioExportTests(unittest.TestCase):
    def _write_package(self, root: Path) -> Path:
        path = root / "fixture-book.v21.json"
        path.write_text(json.dumps(package(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return path

    def _adjudication(self, package_path: Path) -> dict:
        result = valid_result()
        result["rater_role"] = "adjudicated"
        result.pop("worker_dispatch_receipt_sha256", None)
        result["job_id"] = "fixture-book--adjudicated"
        result["source_hash"] = source_hash(package_path)
        result["rater_agreement"] = {
            "mean_absolute_subcriterion_difference": 0,
            "maximum_subcriterion_difference": 0,
            "overall_score_difference": 0,
            "gate_conflicts": [],
            "disagreements": [],
        }
        result["confidence"] = {
            "level": "high",
            "rationale": "Both complete synthetic records agree.",
            "chapter_completeness_ratio": 1,
            "package_ambiguity": "none",
            "unresolved_issues": [],
        }
        result["calibration_changes"] = []
        calculate_scores(result)
        return result

    def _blind_pair(self, package_path: Path) -> tuple[dict, dict, dict, dict, dict]:
        primary = valid_result(role="primary")
        verification = valid_result(role="verification")
        for record in (primary, verification):
            record["source_hash"] = source_hash(package_path)
            calculate_scores(record)
        primary_dispatch, verification_dispatch, pair_seal = valid_receipt_chain(
            primary, verification, inspect_package(package_path, package_path.parent / "inspection-tmp")
        )
        return primary, verification, primary_dispatch, verification_dispatch, pair_seal

    def test_exports_all_chapters_and_full_content_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            package_path = self._write_package(Path(temp_name))
            primary, verification, primary_dispatch, verification_dispatch, pair_seal = self._blind_pair(package_path)
            result = export_update(
                compact_report(),
                primary,
                verification,
                self._adjudication(package_path),
                package(),
                primary_dispatch,
                verification_dispatch,
                pair_seal,
                package_path=package_path,
                evaluator_thread_id="thread-full-book",
            )

        self.assertEqual("full_content", result["evaluation_mode"])
        self.assertEqual("fixture-book", result["book_id"])
        self.assertEqual(2, result["book"]["chapters"])
        self.assertEqual(2, len(result["book"]["chapter_evidence"]))
        self.assertEqual(36, len(result["book"]["subcriteria"]))
        provenance = result["book"]["evaluation_provenance"]
        self.assertTrue(provenance["all_chapters_read"])
        self.assertTrue(provenance["rater_pair_validated"])
        self.assertEqual("fixture-book--primary", provenance["primary_job_id"])
        self.assertEqual("fixture-book--verification", provenance["verification_job_id"])
        self.assertEqual(2, provenance["chapter_count_read_full"])
        self.assertEqual("thread-full-book", provenance["evaluator_thread_id"])
        schema = json.loads((SKILL_ROOT / "references" / "portfolio-book-update.schema.json").read_text(encoding="utf-8"))
        self.assertEqual([], _jsonschema_errors(result, schema))

    def test_rejects_source_hash_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            package_path = self._write_package(Path(temp_name))
            adjudication = self._adjudication(package_path)
            primary, verification, primary_dispatch, verification_dispatch, pair_seal = self._blind_pair(package_path)
            adjudication["source_hash"] = "0" * 64
            with self.assertRaisesRegex(EvaluationError, "source_hash"):
                export_update(compact_report(), primary, verification, adjudication, package(), primary_dispatch, verification_dispatch, pair_seal, package_path=package_path)

    def test_rejects_truncated_or_reordered_coverage(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            package_path = self._write_package(Path(temp_name))
            primary, verification, primary_dispatch, verification_dispatch, pair_seal = self._blind_pair(package_path)
            adjudication = self._adjudication(package_path)
            adjudication["chapter_evidence"] = adjudication["chapter_evidence"][:1]
            adjudication["book"]["chapter_count_expected"] = 1
            adjudication["book"]["chapter_count_read_full"] = 1
            calculate_scores(adjudication)
            with self.assertRaisesRegex(EvaluationError, "package has 2 chapters"):
                export_update(compact_report(), primary, verification, adjudication, package(), primary_dispatch, verification_dispatch, pair_seal, package_path=package_path)

            reordered = self._adjudication(package_path)
            reordered["chapter_evidence"].reverse()
            with self.assertRaisesRegex(EvaluationError, "source inventory"):
                export_update(compact_report(), primary, verification, reordered, package(), primary_dispatch, verification_dispatch, pair_seal, package_path=package_path)

    def test_rejects_ambiguous_portfolio_identity(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            package_path = self._write_package(Path(temp_name))
            primary, verification, primary_dispatch, verification_dispatch, pair_seal = self._blind_pair(package_path)
            report = compact_report()
            report["books"].append(copy.deepcopy(report["books"][0]))
            with self.assertRaisesRegex(EvaluationError, "exactly one"):
                export_update(report, primary, verification, self._adjudication(package_path), package(), primary_dispatch, verification_dispatch, pair_seal, package_path=package_path)

    def test_rejects_a_missing_or_forged_blind_pair(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            package_path = self._write_package(Path(temp_name))
            primary, verification, primary_dispatch, verification_dispatch, pair_seal = self._blind_pair(package_path)
            verification["book"]["chapter_count_expected"] = 1
            verification["book"]["chapter_count_read_full"] = 1
            verification["chapter_evidence"] = verification["chapter_evidence"][:1]
            with self.assertRaisesRegex(EvaluationError, "invalid blind rater pair"):
                export_update(
                    compact_report(),
                    primary,
                    verification,
                    self._adjudication(package_path),
                    package(),
                    primary_dispatch,
                    verification_dispatch,
                    pair_seal,
                    package_path=package_path,
                )

            primary, _verification, primary_dispatch, verification_dispatch, pair_seal = self._blind_pair(package_path)
            with self.assertRaisesRegex(EvaluationError, "invalid blind rater pair"):
                export_update(
                    compact_report(),
                    primary,
                    primary,
                    self._adjudication(package_path),
                    package(),
                    primary_dispatch,
                    verification_dispatch,
                    pair_seal,
                    package_path=package_path,
                )

            primary, verification, primary_dispatch, verification_dispatch, pair_seal = self._blind_pair(package_path)
            primary["result_type"] = "experimental_chapter_sample_evaluation"
            with self.assertRaisesRegex(EvaluationError, "invalid blind rater pair"):
                export_update(
                    compact_report(),
                    primary,
                    verification,
                    self._adjudication(package_path),
                    package(),
                    primary_dispatch,
                    verification_dispatch,
                    pair_seal,
                    package_path=package_path,
                )

            primary, verification, primary_dispatch, verification_dispatch, pair_seal = self._blind_pair(package_path)
            adjudication = self._adjudication(package_path)
            adjudication["rater_agreement"]["overall_score_difference"] = 10
            with self.assertRaisesRegex(EvaluationError, "rater_agreement"):
                export_update(
                    compact_report(),
                    primary,
                    verification,
                    adjudication,
                    package(),
                    primary_dispatch,
                    verification_dispatch,
                    pair_seal,
                    package_path=package_path,
                )

            primary, verification, primary_dispatch, verification_dispatch, pair_seal = self._blind_pair(package_path)
            adjudication = self._adjudication(package_path)
            adjudication["job_id"] = primary["job_id"]
            with self.assertRaisesRegex(EvaluationError, "distinct nonempty job_id"):
                export_update(
                    compact_report(),
                    primary,
                    verification,
                    adjudication,
                    package(),
                    primary_dispatch,
                    verification_dispatch,
                    pair_seal,
                    package_path=package_path,
                )

            primary, verification, primary_dispatch, verification_dispatch, pair_seal = self._blind_pair(package_path)
            cloned = copy.deepcopy(primary)
            cloned["rater_role"] = "verification"
            cloned["job_id"] = verification["job_id"]
            cloned["worker_dispatch_receipt_sha256"] = verification["worker_dispatch_receipt_sha256"]
            with self.assertRaisesRegex(EvaluationError, "worker receipt|pair seal|administrative clone"):
                export_update(
                    compact_report(), primary, cloned, self._adjudication(package_path), package(),
                    primary_dispatch, verification_dispatch, pair_seal, package_path=package_path,
                )


if __name__ == "__main__":
    unittest.main()
