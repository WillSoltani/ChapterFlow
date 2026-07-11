"""Focused validator tests using complete synthetic blind-rater records."""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SKILL_ROOT.parents[2]
SCRIPTS_DIR = SKILL_ROOT / "scripts"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from common import DOMAINS, calculate_scores, inspect_package, reference_standard_eligible, source_hash  # noqa: E402
from validate_book_result import validate_result  # noqa: E402
from worker_receipts import artifact_sha256, issue_dispatch_receipt, seal_pair_receipt  # noqa: E402


def evidence(locator: str) -> dict:
    return {
        "package_path": "book-packages/synthetic/package.json",
        "chapter": locator,
        "section": "fixture section",
        "item_id": None,
        "paraphrase": "Synthetic evidence supports this test-only judgment.",
    }


def valid_result(*, role: str = "primary", rating: float = 3) -> dict:
    chapters = []
    for index, title in ((1, "Notice"), (2, "Review")):
        chapters.append(
            {
                "chapter_index": index,
                "chapter_id": f"chapter-{index}",
                "title": title,
                "read_status": "full",
                "central_ideas": [f"Synthetic idea {index}"],
                "mental_model_contribution": "Adds one step to the fixture model.",
                "engagement_and_pacing": "Brief and directly connected to the lesson.",
                "learning_support": "Includes a contrast and an explanation.",
                "retention_support": "Uses a compact retrieval cue.",
                "transfer_support": "Includes a low-risk adaptation prompt.",
                "trust_qa_safety_issues": [],
                "evidence": [evidence(f"Chapter {index}: {title}")],
            }
        )
    domains = {}
    for domain_key, definition in DOMAINS.items():
        subcriteria = {}
        for subcriterion_key in definition["subcriteria"]:
            subcriteria[subcriterion_key] = {
                "rating": rating,
                "rationale": "The synthetic observations match the selected anchor.",
                "strength_evidence": [evidence("Chapter 1: Notice")],
                "limitation_evidence": [evidence("Chapter 2: Review")],
            }
        domains[domain_key] = {
            "weight": definition["weight"],
            "subcriteria": subcriteria,
            "whole_book_pattern": "The two synthetic chapters use the same observe-review loop.",
            "domain_score": 0.0,
            "weighted_points": 0.0,
        }
    result = {
        "schema_version": "2.0.0",
        "run_id": "fixture-run",
        "job_id": f"fixture-book--{role}",
        "rater_role": role,
        "source_hash": "a" * 64,
        "worker_dispatch_receipt_sha256": "b" * 64,
        "book": {
            "book_id": "fixture-book",
            "slug": "fixture-book",
            "title": "Synthetic Evaluation",
            "subtitle": None,
            "package_path": "book-packages/synthetic/package.json",
            "package_format": "json",
            "nonfiction_type": "instructional fixture",
            "declared_or_inferred_audience": "ordinary interested adult",
            "assumed_prior_knowledge": "none",
            "declared_or_inferred_purpose": "exercise the validator",
            "intended_outcomes": ["Understand the synthetic loop"],
            "contexts_and_exclusions": ["Test-only; not reader-study evidence"],
            "chapter_count_expected": 2,
            "chapter_count_read_full": 2,
            "chapter_count_partial": 0,
            "chapter_count_inaccessible": 0,
            "all_accessible_chapters_read": True,
            "word_count_estimate": 200,
            "component_inventory": {
                "examples": 2,
                "quiz_questions": 2,
                "review_cards": 1,
                "implementation_items": 1,
                "exercises": 2,
                "memorable_lines": 1,
                "other": {},
            },
        },
        "technical_findings": [],
        "gates": {
            "technical_completeness": {"status": "pass", "rationale": "Both chapters are readable.", "evidence": []},
            "epistemic_instructional_safety": {"status": "pass", "rationale": "No synthetic safety defect is present.", "evidence": []},
            "ethics_reader_autonomy": {"status": "pass", "rationale": "The fixture preserves choice and boundaries.", "evidence": []},
            "purpose_audience_declaration": {"status": "pass", "rationale": "Purpose and audience are explicit.", "evidence": []},
            "external_accuracy": {
                "status": "not_assessed",
                "rationale": "External factual verification was intentionally out of scope.",
                "evidence": [],
            },
        },
        "chapter_evidence": chapters,
        "domains": domains,
        "overall_score": 0.0,
        "classification": "",
        "certification_status": "pass",
        "analysis": {
            "overall_reader_experience": "The design supports a clear synthetic learning path.",
            "strongest_qualities": ["Clear loop"],
            "weakest_qualities": ["Only two chapters"],
            "engagement_curve": [{"chapter_range": "1-2", "direction": "steady", "explanation": "The fixture is deliberately short."}],
            "comprehension_and_retention_support": "The design includes retrieval cues and review prompts.",
            "practical_use_and_judgment": "The design supports cautious low-risk practice.",
            "best_fit_reader": "A test runner validating the contract.",
            "readers_who_may_struggle": "Anyone expecting a real book.",
            "highest_impact_improvements": [
                "Add a third contrasting case.",
                "Add a delayed retrieval prompt.",
                "Clarify one adaptation boundary."
            ],
            "final_verdict": "This is synthetic data for deterministic tests. It is not a reader outcome claim."
        },
        "qa": {
            "all_36_subcriteria_present": True,
            "evidence_minimums_pass": True,
            "calculation_check_pass": True,
            "semantic_quiz_issues": [],
            "formulaic_pattern_notes": [],
            "unsupported_outcome_claims_found": False,
            "self_validation_notes": ["Generated solely for unit testing."],
        },
    }
    calculate_scores(result)
    return result


def valid_receipt_chain(primary: dict, verification: dict, inspection: dict) -> tuple[dict, dict, dict]:
    """Bind two test records to distinct synthetic orchestrator task/session receipts."""

    verification["analysis"]["weakest_qualities"] = ["Verification independently noted the short fixture."]
    common = {
        "pair_id": "pair-fixture-book",
        "run_id": primary["run_id"],
        "book_id": primary["book"]["book_id"],
        "source_hash": primary["source_hash"],
        "inspection": inspection,
        "issued_at_utc": "2026-07-10T12:00:00Z",
    }
    primary_dispatch = issue_dispatch_receipt(
        **common, role="primary", job_id=primary["job_id"],
        worker_task_id="task-primary", worker_session_id="session-primary",
    )
    verification_dispatch = issue_dispatch_receipt(
        **common, role="verification", job_id=verification["job_id"],
        worker_task_id="task-verification", worker_session_id="session-verification",
    )
    primary["worker_dispatch_receipt_sha256"] = artifact_sha256(primary_dispatch)
    verification["worker_dispatch_receipt_sha256"] = artifact_sha256(verification_dispatch)
    pair_seal = seal_pair_receipt(
        primary=primary, verification=verification,
        primary_dispatch=primary_dispatch, verification_dispatch=verification_dispatch,
        inspection=inspection, sealed_at_utc="2026-07-10T12:10:00Z",
    )
    return primary_dispatch, verification_dispatch, pair_seal


class FocusedValidationTests(unittest.TestCase):
    def test_complete_blind_result_is_valid(self) -> None:
        self.assertEqual([], validate_result(valid_result()))

    def test_verification_role_is_valid_and_unknown_role_is_not(self) -> None:
        self.assertEqual([], validate_result(valid_result(role="verification")))
        record = valid_result()
        record["rater_role"] = "adjudicator"
        self.assertIn("rater_role must be primary or verification", validate_result(record))

    def test_blind_ratings_are_integers_and_adjudicated_ratings_may_be_half_points(self) -> None:
        record = valid_result()
        domain_key = next(iter(DOMAINS))
        subcriterion_key = next(iter(DOMAINS[domain_key]["subcriteria"]))
        record["domains"][domain_key]["subcriteria"][subcriterion_key]["rating"] = 2.5
        calculate_scores(record)

        blind_errors = validate_result(record, adjudicated=False)
        self.assertTrue(any("integer for blind raters" in error for error in blind_errors))
        record["rater_role"] = "adjudicated"
        self.assertEqual([], validate_result(record, adjudicated=True))

    def test_rating_range_missing_subcriterion_and_arithmetic_are_rejected(self) -> None:
        record = valid_result()
        domain_key = next(iter(DOMAINS))
        subcriterion_key = next(iter(DOMAINS[domain_key]["subcriteria"]))
        record["domains"][domain_key]["subcriteria"][subcriterion_key]["rating"] = 5
        errors = validate_result(record)
        self.assertTrue(any("between 0 and 4" in error for error in errors))

        record = valid_result()
        del record["domains"][domain_key]["subcriteria"][subcriterion_key]
        errors = validate_result(record)
        self.assertTrue(any("exactly four defined keys" in error for error in errors))

        record = valid_result()
        record["overall_score"] += 0.1
        errors = validate_result(record)
        self.assertIn("overall_score arithmetic mismatch", errors)

    def test_chapter_counts_statuses_and_evidence_minimums_are_enforced(self) -> None:
        record = valid_result()
        record["book"]["chapter_count_read_full"] = 1
        errors = validate_result(record)
        self.assertTrue(any("chapter counts must sum" in error for error in errors))
        self.assertTrue(any("read statuses conflict" in error for error in errors))

        record = valid_result()
        record["chapter_evidence"][0]["evidence"] = []
        errors = validate_result(record)
        self.assertTrue(any("lacks locator evidence" in error for error in errors))

        record = valid_result()
        domain_key = next(iter(DOMAINS))
        for item in record["domains"][domain_key]["subcriteria"].values():
            item["strength_evidence"] = []
            item["limitation_evidence"] = []
        errors = validate_result(record)
        self.assertTrue(any("at least two chapter-level strengths" in error for error in errors))
        self.assertTrue(any("at least one chapter-level limitation" in error for error in errors))

    def test_full_content_validation_is_bound_to_the_exact_source_inventory(self) -> None:
        inspection = {
            "book_id": "fixture-book",
            "chapter_count": 2,
            "inventory_complete": True,
            "inventory_errors": [],
            "chapter_inventory": [
                {"chapter_index": 1, "chapter_id": "chapter-1", "number": 1, "title": "Notice"},
                {"chapter_index": 2, "chapter_id": "chapter-2", "number": 2, "title": "Review"},
            ],
        }
        primary = valid_result()
        verification = valid_result(role="verification")
        primary_dispatch, _, pair_seal = valid_receipt_chain(primary, verification, inspection)
        self.assertEqual(
            [],
            validate_result(
                primary,
                expected_source_hash="a" * 64,
                source_inspection=inspection,
                worker_dispatch_receipt=primary_dispatch,
                blind_pair_seal=pair_seal,
                require_full_content=True,
            ),
        )

        missing_inspection = validate_result(valid_result(), expected_source_hash="a" * 64, require_full_content=True)
        self.assertIn(
            "full-content validation requires a source package or source inspection inventory",
            missing_inspection,
        )

        missing_hash = validate_result(valid_result(), source_inspection=inspection, require_full_content=True)
        self.assertIn("full-content validation requires the exact current source hash", missing_hash)

        inconsistent_inspection = copy.deepcopy(inspection)
        inconsistent_inspection["chapter_count"] = 3
        errors = validate_result(
            primary,
            expected_source_hash="a" * 64,
            source_inspection=inconsistent_inspection,
            worker_dispatch_receipt=primary_dispatch,
            blind_pair_seal=pair_seal,
            require_full_content=True,
        )
        self.assertTrue(any("chapter_count conflicts with inventory" in error for error in errors))

        truncated = valid_result()
        twelve_chapters = copy.deepcopy(inspection)
        twelve_chapters["chapter_count"] = 12
        twelve_chapters["chapter_inventory"] = [
            {"chapter_index": index, "chapter_id": f"chapter-{index}", "number": index, "title": f"Chapter {index}"}
            for index in range(1, 13)
        ]
        errors = validate_result(
            truncated,
            expected_source_hash="a" * 64,
            source_inspection=twelve_chapters,
            worker_dispatch_receipt=primary_dispatch,
            blind_pair_seal=pair_seal,
            require_full_content=True,
        )
        self.assertTrue(any("does not match source inventory" in error for error in errors))
        self.assertTrue(any("does not cover the full source inventory" in error for error in errors))

        wrong_order = valid_result()
        wrong_order["chapter_evidence"].reverse()
        errors = validate_result(
            wrong_order,
            expected_source_hash="a" * 64,
            source_inspection=inspection,
            worker_dispatch_receipt=primary_dispatch,
            blind_pair_seal=pair_seal,
            require_full_content=True,
        )
        self.assertTrue(any("chapter_index does not match source inventory" in error for error in errors))

    def test_numbering_gap_inventory_is_unevaluable_in_full_content_mode(self) -> None:
        inspection = {
            "book_id": "fixture-book",
            "chapter_count": 2,
            "inventory_complete": False,
            "inventory_errors": ["Missing chapter numbers: 2"],
            "chapter_inventory": [
                {"chapter_index": 1, "chapter_id": "chapter-1", "number": 1, "title": "Notice"},
                {"chapter_index": 2, "chapter_id": "chapter-3", "number": 3, "title": "Review"},
            ],
        }

        errors = validate_result(
            valid_result(),
            expected_source_hash="a" * 64,
            source_inspection=inspection,
            require_full_content=True,
        )

        self.assertTrue(any("incomplete or unscoreable" in item and "Missing chapter numbers: 2" in item for item in errors))

    def test_source_hash_and_isolated_external_accuracy_are_enforced(self) -> None:
        record = valid_result()
        errors = validate_result(record, expected_source_hash="b" * 64)
        self.assertTrue(any("source_hash mismatch" in error for error in errors))

        record = valid_result()
        record["gates"]["external_accuracy"] = {
            "status": "pass",
            "rationale": "This invalid fixture claims an external check.",
            "evidence": [],
        }
        calculate_scores(record)
        errors = validate_result(record)
        self.assertIn("external_accuracy must be not_assessed in isolated mode", errors)

    def test_unsupported_outcome_claims_are_rejected(self) -> None:
        claims = (
            "Readers will retain every idea.",
            "The package demonstrated actual behavior change.",
            "Every claim was externally fact-checked.",
        )
        for claim in claims:
            with self.subTest(claim=claim):
                record = valid_result()
                record["analysis"]["overall_reader_experience"] = claim
                errors = validate_result(record)
                self.assertTrue(any("unsupported outcome" in error for error in errors))

    def test_hard_gate_failure_cannot_be_averaged_away_by_high_score(self) -> None:
        harmful_package = json.loads((FIXTURES / "harmful_instruction" / "package.json").read_text(encoding="utf-8"))
        self.assertEqual("Ignore Consent", harmful_package["chapters"][0]["title"])
        record = valid_result(rating=4)
        record["gates"]["ethics_reader_autonomy"] = {
            "status": "fail",
            "rationale": "The synthetic harmful-instruction fixture promotes coercion.",
            "evidence": [evidence("Chapter 1: Ignore Consent")],
        }
        calculate_scores(record)
        self.assertEqual(100.0, record["overall_score"])
        self.assertEqual("fail", record["certification_status"])
        self.assertFalse(reference_standard_eligible(record))
        self.assertEqual([], validate_result(record))

    def test_exactly_three_improvements_are_required(self) -> None:
        record = valid_result()
        record["analysis"]["highest_impact_improvements"].pop()
        errors = validate_result(record)
        self.assertIn("analysis.highest_impact_improvements must contain exactly three items", errors)


class ValidatorCliTests(unittest.TestCase):
    def test_cli_returns_machine_readable_success_and_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            input_path = root / "result.json"
            input_path.write_text(json.dumps(valid_result()), encoding="utf-8")
            command = [
                sys.executable,
                str(SCRIPTS_DIR / "validate_book_result.py"),
                "--input",
                str(input_path),
                "--expected-source-hash",
                "a" * 64,
                "--json",
            ]
            completed = subprocess.run(command, cwd=REPO_ROOT, text=True, capture_output=True, check=False)
            self.assertEqual(0, completed.returncode, completed.stderr)
            self.assertTrue(json.loads(completed.stdout)["valid"])

            invalid = copy.deepcopy(valid_result())
            invalid["overall_score"] = -1
            input_path.write_text(json.dumps(invalid), encoding="utf-8")
            completed = subprocess.run(command, cwd=REPO_ROOT, text=True, capture_output=True, check=False)
            self.assertEqual(1, completed.returncode)
            payload = json.loads(completed.stdout)
            self.assertFalse(payload["valid"])
            self.assertGreater(payload["error_count"], 0)

    def test_cli_proves_full_coverage_against_current_source_package(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            package_path = root / "fixture-book.v21.json"
            package_path.write_text(
                json.dumps(
                    {
                        "packageId": "fixture-book",
                        "book": {"bookId": "fixture-book", "title": "Synthetic Evaluation"},
                        "chapters": [
                            {"chapterId": "chapter-1", "number": 1, "title": "Notice", "body": "Observe."},
                            {"chapterId": "chapter-2", "number": 2, "title": "Review", "body": "Revise."},
                        ],
                    }
                ),
                encoding="utf-8",
            )
            result = valid_result()
            result["source_hash"] = source_hash(package_path)
            verification = valid_result(role="verification")
            verification["source_hash"] = result["source_hash"]
            inspection = inspect_package(package_path, root / "inspection-tmp")
            primary_dispatch, _, pair_seal = valid_receipt_chain(result, verification, inspection)
            dispatch_path = root / "primary.dispatch.json"
            pair_path = root / "pair.seal.json"
            dispatch_path.write_text(json.dumps(primary_dispatch), encoding="utf-8")
            pair_path.write_text(json.dumps(pair_seal), encoding="utf-8")
            input_path = root / "result.json"
            input_path.write_text(json.dumps(result), encoding="utf-8")
            command = [
                sys.executable,
                str(SCRIPTS_DIR / "validate_book_result.py"),
                "--input",
                str(input_path),
                "--source-package",
                str(package_path),
                "--expected-book-id",
                "fixture-book",
                "--expected-role",
                "primary",
                "--worker-dispatch-receipt",
                str(dispatch_path),
                "--blind-pair-seal",
                str(pair_path),
                "--require-full-content",
                "--json",
            ]
            completed = subprocess.run(command, cwd=REPO_ROOT, text=True, capture_output=True, check=False)
            self.assertEqual(0, completed.returncode, completed.stdout + completed.stderr)
            self.assertTrue(json.loads(completed.stdout)["valid"])

            truncated = copy.deepcopy(result)
            truncated["book"]["chapter_count_expected"] = 1
            truncated["book"]["chapter_count_read_full"] = 1
            truncated["chapter_evidence"] = truncated["chapter_evidence"][:1]
            input_path.write_text(json.dumps(truncated), encoding="utf-8")
            completed = subprocess.run(command, cwd=REPO_ROOT, text=True, capture_output=True, check=False)
            self.assertEqual(1, completed.returncode)
            self.assertTrue(any("source inventory" in item for item in json.loads(completed.stdout)["errors"]))

            forged_inspection = {
                "package_path": str(package_path.resolve()),
                "source_hash": source_hash(package_path),
                "inspection": copy.deepcopy(inspection),
            }
            forged_inspection["inspection"]["chapter_count"] = 1
            forged_inspection["inspection"]["chapter_inventory"] = forged_inspection["inspection"]["chapter_inventory"][:1]
            inspection_path = root / "forged-inspection.json"
            inspection_path.write_text(json.dumps(forged_inspection), encoding="utf-8")
            input_path.write_text(json.dumps(result), encoding="utf-8")
            inspection_command = command.copy()
            source_flag = inspection_command.index("--source-package")
            inspection_command[source_flag:source_flag + 2] = ["--inspection", str(inspection_path)]
            completed = subprocess.run(inspection_command, cwd=REPO_ROOT, text=True, capture_output=True, check=False)
            self.assertEqual(1, completed.returncode)
            self.assertTrue(
                any("independent inspection" in item for item in json.loads(completed.stdout)["errors"]),
                completed.stdout,
            )

    def test_schema_files_are_valid_json_and_enumerate_full_rubric(self) -> None:
        blind_schema_path = SKILL_ROOT / "references" / "book-evaluation.schema.json"
        adjudicated_schema_path = SKILL_ROOT / "references" / "adjudicated-book.schema.json"
        for path in (blind_schema_path, adjudicated_schema_path):
            with self.subTest(path=path.name):
                schema = json.loads(path.read_text(encoding="utf-8"))
                self.assertIn("$schema", schema)
                self.assertEqual("object", schema["type"])
                self.assertFalse(schema["additionalProperties"])

        blind_schema = json.loads(blind_schema_path.read_text(encoding="utf-8"))
        domains = blind_schema["$defs"]["domainsInteger"]["properties"]
        self.assertEqual(set(DOMAINS), set(domains))
        subcriterion_count = 0
        for domain_schema in domains.values():
            specialized = domain_schema["allOf"][1]
            reference = specialized["properties"]["subcriteria"]["$ref"]
            definition_name = reference.rsplit("/", 1)[-1]
            subcriterion_count += len(blind_schema["$defs"][definition_name]["properties"])
        self.assertEqual(36, subcriterion_count)
        self.assertEqual([], validate_result(valid_result(), schema=blind_schema))


if __name__ == "__main__":
    unittest.main()
