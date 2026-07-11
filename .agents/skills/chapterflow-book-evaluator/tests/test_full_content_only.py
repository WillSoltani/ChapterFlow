"""Regression tests proving every active evaluation stage rejects chapter samples."""

from __future__ import annotations

import csv
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SKILL_ROOT / "scripts"
TESTS_DIR = Path(__file__).resolve().parent
for path in (SCRIPTS_DIR, TESTS_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from aggregate_results import aggregate  # noqa: E402
from common import EvaluationError  # noqa: E402
from discover_packages import discover  # noqa: E402
from render_report import RenderError, render_report  # noqa: E402
from test_end_to_end import FIXTURES, REPO_ROOT, adapt_result_to_job, adjudicated_from  # noqa: E402
from test_validation import valid_result  # noqa: E402
from validate_book_result import validate_result  # noqa: E402
from validate_report import validate_report  # noqa: E402


class FullContentOnlyTests(unittest.TestCase):
    def test_result_validator_rejects_sample_without_optional_flag(self) -> None:
        result = valid_result()
        result["result_type"] = "experimental_chapter_sample_evaluation"
        errors = validate_result(result)
        self.assertTrue(any("chapter-sample results are disabled" in item for item in errors))

    def test_aggregate_rejects_sample_manifest_before_loading_records(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            run_dir = Path(temp_name) / "run"
            data_dir = run_dir / "data"
            data_dir.mkdir(parents=True)
            (data_dir / "run-manifest.json").write_text(
                json.dumps({"evaluation_mode": "chapter_sample", "sampling": {"mode": "chapter_sample"}}),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(EvaluationError, "chapter-sample aggregation is disabled"):
                aggregate(run_dir, SKILL_ROOT)

    def test_aggregate_rejects_disguised_sample_adjudication(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            run_dir = Path(temp_name) / "run"
            data_dir = run_dir / "data"
            adjudicated_dir = run_dir / "raw" / "adjudicated"
            data_dir.mkdir(parents=True)
            adjudicated_dir.mkdir(parents=True)
            (data_dir / "run-manifest.json").write_text(json.dumps({"evaluation_mode": "full_content"}), encoding="utf-8")
            (adjudicated_dir / "forged.json").write_text(
                json.dumps({"result_type": "experimental_chapter_sample_evaluation"}),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(EvaluationError, "chapter-sample adjudication is disabled"):
                aggregate(run_dir, SKILL_ROOT)

    def test_aggregate_rejects_lone_adjudication_without_verification_rater(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            packages = root / "book-packages"
            run_dir = root / "run"
            shutil.copytree(FIXTURES / "well_formed_two_chapter", packages / "well-formed")
            discover(packages, run_dir, REPO_ROOT)
            with (run_dir / "jobs" / "book-rater-jobs.csv").open("r", encoding="utf-8", newline="") as handle:
                jobs = list(csv.DictReader(handle))
            primary_job = next(item for item in jobs if item["rater_role"] == "primary")
            primary = adapt_result_to_job(primary_job)
            primary_path = Path(primary_job["output_path"])
            primary_path.parent.mkdir(parents=True, exist_ok=True)
            primary_path.write_text(json.dumps(primary), encoding="utf-8")
            adjudicated_path = run_dir / "raw" / "adjudicated" / f"{primary_job['book_id']}.json"
            adjudicated_path.parent.mkdir(parents=True, exist_ok=True)
            adjudicated_path.write_text(json.dumps(adjudicated_from(primary)), encoding="utf-8")

            with self.assertRaisesRegex(EvaluationError, "missing or unreadable verification blind record"):
                aggregate(run_dir, SKILL_ROOT)

    def test_renderer_rejects_sample_before_template_processing(self) -> None:
        with self.assertRaisesRegex(RenderError, "chapter-sample reporting is disabled"):
            render_report({"run": {"evaluation_mode": "chapter_sample"}}, "", "", "")

    def test_report_validator_rejects_sample_before_schema_selection(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            report = root / "report.html"
            data = root / "report-data.json"
            report.write_text("<!doctype html><html><body>sample</body></html>", encoding="utf-8")
            data.write_text(json.dumps({"run": {"evaluation_mode": "chapter_sample"}}), encoding="utf-8")
            self.assertEqual(
                ["chapter-sample reports are disabled; validate full-content evaluations only"],
                validate_report(report, data),
            )

    def test_sample_only_executables_and_contracts_are_absent(self) -> None:
        forbidden = (
            SCRIPTS_DIR / "sample_chapters.py",
            SCRIPTS_DIR / "prepare_sample_jobs.py",
            SCRIPTS_DIR / "build_sample_schemas.py",
            SKILL_ROOT / "references" / "chapter-sample-protocol.md",
            SKILL_ROOT / "references" / "book-rater-sample-prompt.md",
            SKILL_ROOT / "references" / "adjudication-sample-prompt.md",
            SKILL_ROOT / "references" / "book-evaluation-sample.schema.json",
            SKILL_ROOT / "references" / "adjudicated-book-sample.schema.json",
            SKILL_ROOT / "references" / "report-data-sample.schema.json",
        )
        self.assertEqual([], [str(path) for path in forbidden if path.exists()])


if __name__ == "__main__":
    unittest.main()
