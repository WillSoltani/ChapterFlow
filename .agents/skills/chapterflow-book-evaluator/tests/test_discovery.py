"""Fixture tests for deterministic discovery, inspection, and archive safety."""

from __future__ import annotations

import csv
import json
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SKILL_ROOT.parents[2]
SCRIPTS_DIR = SKILL_ROOT / "scripts"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from common import EvaluationError, normalized_content_hash, safe_extract_zip  # noqa: E402
from discover_packages import discover  # noqa: E402
from inspect_package import inspect, json_diagnostics  # noqa: E402


def copy_fixture(name: str, destination: Path) -> Path:
    source = FIXTURES / name
    if source.is_dir():
        shutil.copytree(source, destination)
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    return destination


class InspectionFixtureTests(unittest.TestCase):
    def test_well_formed_package_inventory(self) -> None:
        result = inspect(
            FIXTURES / "well_formed_two_chapter" / "package.json",
            Path(tempfile.gettempdir()) / "chapterflow-test-inspection",
        )
        package = result["inspection"]
        self.assertEqual("fixture-well-formed", package["book_id"])
        self.assertEqual(2, package["chapter_count"])
        self.assertGreater(package["word_count_estimate"], 50)
        self.assertEqual(2, package["component_inventory"]["quiz_questions"])
        self.assertEqual([1, 2], [chapter["number"] for chapter in package["chapter_inventory"]])

    def test_missing_chapter_gap_is_preserved_not_silently_invented(self) -> None:
        result = inspect(
            FIXTURES / "missing_chapter" / "package.json",
            Path(tempfile.gettempdir()) / "chapterflow-test-missing",
        )
        package = result["inspection"]
        self.assertEqual(2, package["chapter_count"])
        self.assertEqual([1, 3], [chapter["number"] for chapter in package["chapter_inventory"]])
        self.assertIn("Missing chapter numbers: 2", package["warnings"])

    def test_duplicate_chapter_identifiers_are_reported(self) -> None:
        result = inspect(
            FIXTURES / "duplicate_chapter" / "package.json",
            Path(tempfile.gettempdir()) / "chapterflow-test-duplicate",
        )
        warnings = "\n".join(result["inspection"]["warnings"])
        self.assertIn("Duplicate chapter identifiers or numbers", warnings)
        self.assertIn("same-id", warnings)

    def test_wrong_answer_index_is_detected_and_semantic_mismatch_remains_diagnostic(self) -> None:
        wrong = json_diagnostics(FIXTURES / "wrong_answer_index" / "package.json")
        self.assertEqual(1, wrong["quiz"]["question_count"])
        self.assertEqual(1, len(wrong["quiz"]["invalid_correct_indices"]))

        mismatch = json_diagnostics(FIXTURES / "mismatched_quiz" / "package.json")
        self.assertEqual(1, mismatch["quiz"]["question_count"])
        self.assertEqual([], mismatch["quiz"]["invalid_correct_indices"])
        self.assertTrue(mismatch["signals_are_diagnostic_not_scores"])

    def test_framework_load_and_embedded_markup_are_exposed_as_signals(self) -> None:
        framework = json_diagnostics(FIXTURES / "excessive_framework_labels" / "package.json")
        self.assertGreaterEqual(len(framework["acronym_frequency"]), 9)
        self.assertGreaterEqual(framework["acronym_frequency"]["ABC"], 2)

        markup = json_diagnostics(FIXTURES / "embedded_html_script" / "package.json")
        self.assertTrue(markup["embedded_markup_strings"])
        self.assertTrue(any("chapters" in locator for locator in markup["embedded_markup_strings"]))


class DiscoveryFixtureTests(unittest.TestCase):
    def test_numbering_gap_is_unscoreable_and_creates_no_blind_jobs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            packages = root / "book-packages"
            packages.mkdir()
            (packages / "gapped.json").write_text(
                json.dumps(
                    {
                        "packageId": "gapped-book",
                        "book": {"bookId": "gapped-book", "title": "Gapped Book"},
                        "chapters": [
                            {"chapterId": "chapter-1", "number": 1, "title": "One", "body": "First."},
                            {"chapterId": "chapter-3", "number": 3, "title": "Three", "body": "Third."},
                        ],
                    }
                ),
                encoding="utf-8",
            )

            rows, manifest = discover(packages, root / "run-gap", REPO_ROOT)

            self.assertFalse(rows[0]["scoreable"])
            self.assertFalse(rows[0]["inspection"]["inventory_complete"])
            self.assertTrue(any("Missing chapter numbers: 2" in item for item in rows[0]["inspection"]["inventory_errors"]))
            self.assertEqual(0, manifest["canonical_books"])
            with (root / "run-gap" / "jobs" / "book-rater-jobs.csv").open(newline="", encoding="utf-8") as handle:
                self.assertEqual([], list(csv.DictReader(handle)))

    def test_package_directory_readme_is_not_discovered_as_a_book(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            packages = root / "book-packages"
            copy_fixture("well_formed_two_chapter", packages / "book")
            packages.mkdir(parents=True, exist_ok=True)
            (packages / "README.md").write_text(
                "# Book Packages\n\nPut JSON book packages in this folder for ingestion uploads.\n",
                encoding="utf-8",
            )

            rows, manifest = discover(packages, root / "run-readme", REPO_ROOT)

            self.assertEqual(1, manifest["packages_found"])
            self.assertEqual(1, manifest["canonical_books"])
            self.assertEqual(["fixture-well-formed"], [row["package_id"] for row in rows])

    def test_archive_and_extracted_directory_are_counted_once(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            packages = root / "book-packages"
            run_dir = root / "run-duplicate"
            directory = copy_fixture("duplicate_archive_source", packages / "a-extracted")
            archive = packages / "b-archive.zip"
            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as handle:
                handle.write(directory / "package.json", "package.json")

            rows, manifest = discover(packages, run_dir, REPO_ROOT)

            self.assertEqual(2, manifest["packages_found"])
            self.assertEqual(1, manifest["canonical_books"])
            self.assertEqual(1, manifest["duplicates"])
            self.assertEqual(1, sum(bool(row["canonical"]) for row in rows))
            self.assertEqual(1, sum(bool(row["duplicate_of_id"]) for row in rows))
            self.assertEqual(
                normalized_content_hash(directory),
                normalized_content_hash(archive, run_dir / "tmp" / "hash-check"),
            )

            with (run_dir / "jobs" / "book-rater-jobs.csv").open("r", encoding="utf-8", newline="") as handle:
                jobs = list(csv.DictReader(handle))
            self.assertEqual(["primary", "verification"], [row["rater_role"] for row in jobs])
            self.assertEqual(2, len({row["output_path"] for row in jobs}))
            self.assertTrue(all(row["source_hash"] for row in jobs))

    def test_malformed_and_unsupported_packages_are_recorded_without_aborting(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            packages = root / "book-packages"
            copy_fixture("malformed_json", packages / "malformed")
            copy_fixture("unsupported_file", packages / "unsupported")

            rows, manifest = discover(packages, root / "run-invalid", REPO_ROOT)

            self.assertEqual(2, manifest["packages_found"])
            self.assertEqual(0, manifest["canonical_books"])
            self.assertEqual(2, manifest["unscoreable_packages"])
            self.assertTrue(all(not row["scoreable"] for row in rows))
            self.assertTrue(all(row["discovery_warnings"] for row in rows))

    def test_discovery_cli_generates_manifest_and_exactly_two_blind_jobs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            packages = root / "book-packages"
            run_dir = root / "fixture-run"
            copy_fixture("well_formed_two_chapter", packages / "book")
            command = [
                sys.executable,
                str(SCRIPTS_DIR / "discover_packages.py"),
                "--packages-dir",
                str(packages),
                "--run-dir",
                str(run_dir),
                "--repo-root",
                str(REPO_ROOT),
            ]

            completed = subprocess.run(command, cwd=REPO_ROOT, text=True, capture_output=True, check=False)

            self.assertEqual(0, completed.returncode, completed.stderr)
            summary = json.loads(completed.stdout)
            self.assertEqual(1, summary["canonical_books"])
            self.assertEqual(2, summary["chapters_expected"])
            manifest = json.loads((run_dir / "data" / "run-manifest.json").read_text(encoding="utf-8"))
            self.assertEqual("local-packages-only; external accuracy not assessed", manifest["isolation_mode"])
            with (run_dir / "jobs" / "book-rater-jobs.csv").open("r", encoding="utf-8", newline="") as handle:
                jobs = list(csv.DictReader(handle))
            self.assertEqual(2, len(jobs))
            self.assertEqual({"primary", "verification"}, {row["rater_role"] for row in jobs})
            self.assertNotEqual(jobs[0]["output_path"], jobs[1]["output_path"])


class ArchiveSafetyTests(unittest.TestCase):
    def test_zip_slip_is_rejected_without_writing_outside_destination(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            archive = root / "escape.zip"
            destination = root / "extract"
            with zipfile.ZipFile(archive, "w") as handle:
                handle.writestr("../escaped.txt", "must not escape")

            with self.assertRaises(EvaluationError):
                safe_extract_zip(archive, destination)
            self.assertFalse((root / "escaped.txt").exists())

    def test_archive_symlink_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            archive = root / "symlink.zip"
            info = zipfile.ZipInfo("link")
            info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            with zipfile.ZipFile(archive, "w") as handle:
                handle.writestr(info, "../../outside")

            with self.assertRaises(EvaluationError):
                safe_extract_zip(archive, root / "extract")

    def test_archive_expansion_limits_are_enforced(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            archive = root / "large.zip"
            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED) as handle:
                handle.writestr("chapter.txt", "x" * 128)

            with self.assertRaises(EvaluationError):
                safe_extract_zip(archive, root / "extract", max_uncompressed_bytes=64)


if __name__ == "__main__":
    unittest.main()
