"""Focused transactional tests for one-book portfolio refreshes."""

from __future__ import annotations

import base64
import contextlib
import copy
import csv
import hashlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SKILL_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from common import EvaluationError  # noqa: E402
from generate_remediation_prompts import DOMAIN_SPECS, markdown_pack, remediation_pack  # noqa: E402
from update_portfolio_report import _read_html_payloads, _strip_allowed_non_target_changes, parse_args, update_portfolio_snapshot  # noqa: E402


CSV_HEADERS = {
    "ChapterFlow_140_Scorecard.csv": [
        "title", "author", "chapters", "words", "profile", "target_screening_score", "overall", "confidence",
        "technical_gate", "epistemic_gate", "ethics_gate", "external_accuracy", "gate_note",
        *[item["label"] for item in DOMAIN_SPECS], "rank",
    ],
    "ChapterFlow_140_Diagnostics.csv": [
        "file", "book_id", "title", "author", "categories", "tags", "chapters", "total_words", "mean_chapter_words",
        "examples", "questions", "review_cards", "memorable_lines",
    ],
    "ChapterFlow_140_Weighted_Points.csv": ["title", "domain", "weight", "domain_score_0_4", "weighted_points"],
    "ChapterFlow_140_Subcriterion_Audit.csv": ["title", "domain", "weight", "subcriterion", "rating", "evidence_proxy"],
    "ChapterFlow_140_Chapter_Evidence.csv": [
        "rank", "book", "book_score", "chapter_number", "chapter_title", "hook", "counterintuition", "key_takeaway",
        "try_this_now", "core_skill", "twenty_four_hour_challenge",
    ],
    "ChapterFlow_140_QA_Findings.csv": ["book", "finding"],
}


def _book(index: int, rating: float) -> dict:
    domains = {spec["label"]: rating for spec in DOMAIN_SPECS}
    weighted = {spec["label"]: rating / 4 * spec["weight"] for spec in DOMAIN_SPECS}
    score = sum(weighted.values())
    return {
        "rank": index + 1,
        "title": f"Book {index:03d}",
        "author": "Fixture Author",
        "chapters": 2,
        "words": 2000 + index,
        "score": score,
        "band": "Valuable but uneven" if score < 80 else "Strong",
        "confidence": "Medium",
        "profile": "scalable",
        "profile_description": "Synthetic legacy screening record.",
        "gates": {"technical": "Pass", "epistemic": "Pass", "ethics": "Pass", "external_accuracy": "Not assessed", "note": ""},
        "domains": domains,
        "weighted_points": weighted,
        "subcriteria": [
            {
                "domain": spec["label"],
                "subcriterion": label,
                "rating": rating,
                "evidence_proxy": 2,
            }
            for spec in DOMAIN_SPECS
            for label in spec["subcriteria"]
        ],
        "strengths": [],
        "weaknesses": [],
        "assessment": "Synthetic fixture.",
        "qa": ["No major structural anomaly was detected in this synthetic fixture."],
        "diagnostics": {},
        "diagnostics_full": {
            "chapters": 2, "total_words": 2000 + index, "mean_chapter_words": 1000,
            "examples": 2, "questions": 4, "review_cards": 2, "memorable_lines": 2,
        },
        "chapter_evidence": [
            {"number": 1, "title": "Opening", "hook": "Hook", "counterintuition": "Contrast", "takeaway": "Learn", "try": "Try", "coreSkill": "Skill", "challenge": "Apply"},
            {"number": 2, "title": "Ending", "hook": "Hook", "counterintuition": "Contrast", "takeaway": "Integrate", "try": "Try", "coreSkill": "Skill", "challenge": "Apply"},
        ],
        "id": f"book-{index:03d}",
        "file": f"book-{index:03d}.v21.json",
        "categories": ["Fixture"],
        "tags": ["testing"],
        "target_screening_score": score,
    }


def _initial_report() -> tuple[dict, dict]:
    books = [_book(index, 3.5) for index in range(140)]
    books[73] = _book(73, 3.0)
    report = {
        "meta": {"title": "Fixture", "rubric": "v2", "evaluation_mode": "Single-evaluator screening audit"},
        "domain_names": [item["label"] for item in DOMAIN_SPECS],
        "domain_weights": {item["label"]: item["weight"] for item in DOMAIN_SPECS},
        "books": books,
    }
    pack = remediation_pack(report)
    return report, pack


def _download_record(raw: bytes, mime: str) -> dict:
    import hashlib

    return {
        "mime": mime,
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "base64": base64.b64encode(raw).decode("ascii"),
    }


def _snapshot(root: Path) -> dict[str, Path]:
    report, pack = _initial_report()
    data = root / "chapterflow-140-evaluation-report-data.json"
    html = root / "chapterflow-140-evaluation-report.html"
    remediation_json = root / "chapterflow-140-remediation-prompts.json"
    remediation_md = root / "chapterflow-140-remediation-prompts.md"
    data.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    remediation_json.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    remediation_md.write_text(markdown_pack(pack), encoding="utf-8")
    downloads = {}
    for name, header in CSV_HEADERS.items():
        stream = io.StringIO(newline="")
        csv.writer(stream, lineterminator="\r\n").writerow(header)
        downloads[name] = _download_record(stream.getvalue().encode("utf-8"), "text/csv;charset=utf-8")
    downloads["ChapterFlow_140_Summary.md"] = _download_record(b"# Old summary\n", "text/markdown;charset=utf-8")
    for path, mime in (
        (data, "application/json"),
        (remediation_json, "application/json"),
        (remediation_md, "text/markdown;charset=utf-8"),
    ):
        raw = path.read_bytes()
        downloads[path.name] = {"mime": mime, "bytes": len(raw), "sha256": "0" * 64, "kind": "companion-file"}
    html.write_text(
        "<!doctype html><html><body><header class=\"hero\"><h1>140-book content-design screening</h1>"
        "<p class=\"lede\">Old chapter count.</p><p class=\"scope-note\">Single-evaluator screening audit.</p></header>"
        "<section id=\"methods\"><article><h3>Scope</h3><ul><li>Old scope.</li></ul></article>"
        "<article><h3>Interpretation boundary</h3><ul><li>Pure screening.</li></ul></article>"
        "<article><h3>Unavailable in this package</h3><ul><li>No trail.</li></ul></article>"
        "<details class=\"source-summary\"><pre>Old summary.</pre></details></section>"
        "<footer><p>Old footer.</p></footer>"
        f'<script id="report-data" type="application/json">{json.dumps(report, ensure_ascii=False, separators=(",", ":"))}</script>'
        f'<script id="source-downloads" type="application/json">{json.dumps(downloads, ensure_ascii=False, separators=(",", ":"))}</script>'
        "</body></html>\n",
        encoding="utf-8",
    )
    return {"data": data, "html": html, "remediation_json": remediation_json, "remediation_md": remediation_md}


def _update(path: Path, snapshot: dict[str, Path]) -> dict:
    report = json.loads(snapshot["data"].read_text(encoding="utf-8"))
    target = copy.deepcopy(next(item for item in report["books"] if item["id"] == "book-073"))
    for row in target["subcriteria"]:
        row["rating"] = 4
    target["score"] = 1
    target["domains"] = {name: 0 for name in report["domain_names"]}
    target["weighted_points"] = {name: 0 for name in report["domain_names"]}
    target.pop("remediation", None)
    source_hash = "a" * 64
    target["evaluation_provenance"] = {
        "method": "full_book_blind_dual_rater_adjudication",
        "evaluation_mode": "full_content",
        "run_id": "run-fixture",
        "job_id": "book-073--adjudicated",
        "source_hash": source_hash,
        "chapter_count_expected": 2,
        "chapter_count_read_full": 2,
        "all_chapters_read": True,
        "rater_pair_validated": True,
        "primary_job_id": "book-073--primary",
        "verification_job_id": "book-073--verification",
        "blind_pair_id": "pair-book-073",
        "blind_pair_inventory_sha256": "b" * 64,
        "primary_dispatch_receipt_sha256": "c" * 64,
        "verification_dispatch_receipt_sha256": "d" * 64,
        "blind_pair_seal_sha256": "e" * 64,
        "primary_worker_task_id": "task-primary",
        "primary_worker_session_id": "session-primary",
        "verification_worker_task_id": "task-verification",
        "verification_worker_session_id": "session-verification",
        "evaluator_thread_id": "thread-fixture",
        "evaluated_at_utc": "2026-07-10T12:00:00+00:00",
    }
    envelope = {"schema_version": "1.0.0", "evaluation_mode": "full_content", "book_id": target["id"], "source_hash": source_hash, "book": target}
    path.write_text(json.dumps(envelope, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return envelope


class PortfolioUpdateTests(unittest.TestCase):
    maxDiff = None

    def test_refreshes_report_remediation_downloads_and_mirror(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            primary = root / "primary"
            mirror = root / "mirror"
            primary.mkdir()
            mirror.mkdir()
            snapshot = _snapshot(primary)
            for path in snapshot.values():
                (mirror / path.name).write_bytes(path.read_bytes())
            old_report = json.loads(snapshot["data"].read_text(encoding="utf-8"))
            baseline_report_data_sha256 = hashlib.sha256(snapshot["data"].read_bytes()).hexdigest()
            old_non_target = {
                item["id"]: _strip_allowed_non_target_changes(item)
                for item in old_report["books"]
                if item["id"] != "book-073"
            }
            update_path = root / "book-update.json"
            receipt_path = root / "portfolio-update-receipt.json"
            _update(update_path, snapshot)

            summary = update_portfolio_snapshot(
                report_data_path=snapshot["data"],
                report_html_path=snapshot["html"],
                book_update_path=update_path,
                remediation_json_path=snapshot["remediation_json"],
                remediation_markdown_path=snapshot["remediation_md"],
                receipt_path=receipt_path,
                mirror_dirs=[mirror],
            )

            self.assertEqual(100.0, summary["score"])
            self.assertEqual(1, summary["rank"])
            self.assertEqual(0, summary["new_condition_count"])
            refreshed = json.loads(snapshot["data"].read_text(encoding="utf-8"))
            target = next(item for item in refreshed["books"] if item["id"] == "book-073")
            self.assertEqual(100.0, target["score"])
            self.assertTrue(all(value == 4 for value in target["domains"].values()))
            self.assertEqual(1, refreshed["meta"]["full_content_evaluation_count"])
            self.assertIn("Mixed-method", refreshed["meta"]["evaluation_mode"])
            for item in refreshed["books"]:
                if item["id"] != "book-073":
                    self.assertEqual(old_non_target[item["id"]], _strip_allowed_non_target_changes(item))

            embedded, downloads, _ = _read_html_payloads(snapshot["html"].read_text(encoding="utf-8"))
            self.assertEqual(refreshed, embedded)
            scorecard = base64.b64decode(downloads["ChapterFlow_140_Scorecard.csv"]["base64"]).decode("utf-8")
            rows = list(csv.DictReader(io.StringIO(scorecard)))
            scorecard_target = next(item for item in rows if item["title"] == "Book 073")
            self.assertEqual("100.0", scorecard_target["overall"])
            self.assertEqual("1", scorecard_target["rank"])
            html_text = snapshot["html"].read_text(encoding="utf-8")
            self.assertNotIn("Single-evaluator screening audit", html_text)
            self.assertNotIn("Pure screening.", html_text)
            self.assertIn("140-book mixed-method content-design evaluation", html_text)
            self.assertIn("Evidence availability by record", html_text)
            for path in snapshot.values():
                self.assertEqual(path.read_bytes(), (mirror / path.name).read_bytes())
            self.assertTrue(receipt_path.is_file())
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            self.assertEqual("valid", receipt["status"])
            self.assertEqual("book-073", receipt["book_id"])
            self.assertEqual(baseline_report_data_sha256, receipt["baseline_report_data_sha256"])
            self.assertEqual(140, receipt["book_count"])
            self.assertEqual(140, receipt["unique_book_count"])
            self.assertTrue(receipt["non_target_preserved"])
            self.assertTrue(receipt["remediation_valid"])
            self.assertTrue(receipt["source_downloads_valid"])
            self.assertEqual("valid", receipt["full_validator_status"])
            self.assertRegex(receipt["transaction_id"], r"^portfolio-update-[0-9a-f]{32}$")
            self.assertEqual(receipt["transaction_id"], summary["transaction_id"])
            self.assertEqual("chapterflow-book-evaluator/scripts/validate_report.py", receipt["full_validator"]["module"])
            self.assertEqual("validate_report", receipt["full_validator"]["function"])
            self.assertEqual(0, receipt["full_validator"]["error_count"])
            self.assertEqual({str(primary.resolve()), str(mirror.resolve())}, {item["root"] for item in receipt["roots"]})
            self.assertEqual(["primary", "mirror"], [item["kind"] for item in receipt["roots"]])
            for root_record in receipt["roots"]:
                self.assertEqual({path.name for path in snapshot.values()}, {item["name"] for item in root_record["outputs"]})
                for item in root_record["outputs"]:
                    output = Path(item["path"])
                    self.assertEqual(Path(root_record["root"]), output.parent)
                    self.assertEqual(output.read_bytes(), next(path for path in snapshot.values() if path.name == item["name"]).read_bytes())
                    self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(), item["sha256"])

    def test_full_validate_report_is_invoked_and_failure_prevents_receipt_or_writes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            primary = root / "primary"
            mirror = root / "mirror"
            primary.mkdir()
            mirror.mkdir()
            snapshot = _snapshot(primary)
            for path in snapshot.values():
                (mirror / path.name).write_bytes(path.read_bytes())
            update_path = root / "book-update.json"
            receipt_path = root / "portfolio-update-receipt.json"
            _update(update_path, snapshot)
            watched = list(snapshot.values()) + [mirror / path.name for path in snapshot.values()]
            before = {path: path.read_bytes() for path in watched}

            with patch("update_portfolio_report.full_report_validator", return_value=["forced independent validator failure"]) as validator:
                with self.assertRaisesRegex(EvaluationError, "validate_report.py"):
                    update_portfolio_snapshot(
                        report_data_path=snapshot["data"],
                        report_html_path=snapshot["html"],
                        book_update_path=update_path,
                        remediation_json_path=snapshot["remediation_json"],
                        remediation_markdown_path=snapshot["remediation_md"],
                        receipt_path=receipt_path,
                        mirror_dirs=[mirror],
                    )

            validator.assert_called_once()
            self.assertEqual(before, {path: path.read_bytes() for path in watched})
            self.assertFalse(receipt_path.exists())

    def test_dry_run_validates_without_writing_outputs_or_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            primary = root / "primary"
            mirror = root / "mirror"
            primary.mkdir()
            mirror.mkdir()
            snapshot = _snapshot(primary)
            for path in snapshot.values():
                (mirror / path.name).write_bytes(path.read_bytes())
            update_path = root / "book-update.json"
            receipt_path = root / "portfolio-update-receipt.json"
            _update(update_path, snapshot)
            watched = list(snapshot.values()) + [mirror / path.name for path in snapshot.values()]
            before = {path: path.read_bytes() for path in watched}

            summary = update_portfolio_snapshot(
                report_data_path=snapshot["data"],
                report_html_path=snapshot["html"],
                book_update_path=update_path,
                remediation_json_path=snapshot["remediation_json"],
                remediation_markdown_path=snapshot["remediation_md"],
                receipt_path=receipt_path,
                mirror_dirs=[mirror],
                dry_run=True,
            )

            self.assertTrue(summary["dry_run"])
            self.assertFalse(summary["receipt_written"])
            self.assertFalse(receipt_path.exists())
            self.assertEqual(before, {path: path.read_bytes() for path in watched})

    def test_cli_requires_receipt(self) -> None:
        argv = [
            "update_portfolio_report.py",
            "--report-data", "data.json",
            "--report-html", "report.html",
            "--book-update", "book-update.json",
            "--remediation-json", "remediation.json",
            "--remediation-markdown", "remediation.md",
            "--mirror-dir", "mirror",
        ]
        with patch.object(sys, "argv", argv), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as raised:
                parse_args()
        self.assertEqual(2, raised.exception.code)

    def test_invalid_source_hash_leaves_primary_and_mirror_byte_identical(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            primary = root / "primary"
            mirror = root / "mirror"
            primary.mkdir()
            mirror.mkdir()
            snapshot = _snapshot(primary)
            for path in snapshot.values():
                (mirror / path.name).write_bytes(path.read_bytes())
            update_path = root / "book-update.json"
            receipt_path = root / "portfolio-update-receipt.json"
            envelope = _update(update_path, snapshot)
            envelope["source_hash"] = "b" * 64
            update_path.write_text(json.dumps(envelope), encoding="utf-8")
            watched = list(snapshot.values()) + [mirror / path.name for path in snapshot.values()]
            before = {path: path.read_bytes() for path in watched}

            with self.assertRaises(EvaluationError):
                update_portfolio_snapshot(
                    report_data_path=snapshot["data"],
                    report_html_path=snapshot["html"],
                    book_update_path=update_path,
                    remediation_json_path=snapshot["remediation_json"],
                    remediation_markdown_path=snapshot["remediation_md"],
                    receipt_path=receipt_path,
                    mirror_dirs=[mirror],
                )

            self.assertEqual(before, {path: path.read_bytes() for path in watched})
            self.assertFalse(receipt_path.exists())

    def test_missing_or_forged_rater_pair_provenance_is_rejected_without_writes(self) -> None:
        mutations = {
            "not validated": lambda provenance: provenance.__setitem__("rater_pair_validated", False),
            "missing primary": lambda provenance: provenance.pop("primary_job_id"),
            "missing verification": lambda provenance: provenance.pop("verification_job_id"),
            "same blind job": lambda provenance: provenance.__setitem__("verification_job_id", provenance["primary_job_id"]),
            "blind id equals adjudication": lambda provenance: provenance.__setitem__("primary_job_id", provenance["job_id"]),
        }
        for label, mutate in mutations.items():
            with self.subTest(label=label), tempfile.TemporaryDirectory() as temp_name:
                root = Path(temp_name)
                primary = root / "primary"
                mirror = root / "mirror"
                primary.mkdir()
                mirror.mkdir()
                snapshot = _snapshot(primary)
                for path in snapshot.values():
                    (mirror / path.name).write_bytes(path.read_bytes())
                update_path = root / "book-update.json"
                receipt_path = root / "portfolio-update-receipt.json"
                envelope = _update(update_path, snapshot)
                mutate(envelope["book"]["evaluation_provenance"])
                update_path.write_text(json.dumps(envelope), encoding="utf-8")
                before = {path: path.read_bytes() for path in snapshot.values()}

                with self.assertRaisesRegex(EvaluationError, "rater pair|job_id|job ids"):
                    update_portfolio_snapshot(
                        report_data_path=snapshot["data"],
                        report_html_path=snapshot["html"],
                        book_update_path=update_path,
                        remediation_json_path=snapshot["remediation_json"],
                        remediation_markdown_path=snapshot["remediation_md"],
                        receipt_path=receipt_path,
                        mirror_dirs=[mirror],
                    )

                self.assertEqual(before, {path: path.read_bytes() for path in snapshot.values()})
                self.assertFalse(receipt_path.exists())

    def test_refresh_without_mirror_is_rejected_without_writes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            primary = root / "primary"
            primary.mkdir()
            snapshot = _snapshot(primary)
            update_path = root / "book-update.json"
            receipt_path = root / "portfolio-update-receipt.json"
            _update(update_path, snapshot)
            before = {path: path.read_bytes() for path in snapshot.values()}

            with self.assertRaisesRegex(EvaluationError, "mirror-dir"):
                update_portfolio_snapshot(
                    report_data_path=snapshot["data"],
                    report_html_path=snapshot["html"],
                    book_update_path=update_path,
                    remediation_json_path=snapshot["remediation_json"],
                    remediation_markdown_path=snapshot["remediation_md"],
                    receipt_path=receipt_path,
                )

            self.assertEqual(before, {path: path.read_bytes() for path in snapshot.values()})
            self.assertFalse(receipt_path.exists())

    def test_sample_update_envelope_is_rejected_without_writes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            primary = root / "primary"
            mirror = root / "mirror"
            primary.mkdir()
            mirror.mkdir()
            snapshot = _snapshot(primary)
            for path in snapshot.values():
                (mirror / path.name).write_bytes(path.read_bytes())
            update_path = root / "book-update.json"
            receipt_path = root / "portfolio-update-receipt.json"
            envelope = _update(update_path, snapshot)
            envelope["evaluation_mode"] = "chapter_sample"
            envelope["book"]["evaluation_provenance"]["evaluation_mode"] = "chapter_sample"
            update_path.write_text(json.dumps(envelope), encoding="utf-8")
            watched = list(snapshot.values()) + [mirror / path.name for path in snapshot.values()]
            before = {path: path.read_bytes() for path in watched}

            with self.assertRaisesRegex(EvaluationError, "evaluation_mode=full_content"):
                update_portfolio_snapshot(
                    report_data_path=snapshot["data"],
                    report_html_path=snapshot["html"],
                    book_update_path=update_path,
                    remediation_json_path=snapshot["remediation_json"],
                    remediation_markdown_path=snapshot["remediation_md"],
                    receipt_path=receipt_path,
                    mirror_dirs=[mirror],
                )

            self.assertEqual(before, {path: path.read_bytes() for path in watched})
            self.assertFalse(receipt_path.exists())

    def test_stale_mirror_is_rejected_without_overwriting_either_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            primary = root / "primary"
            mirror = root / "mirror"
            primary.mkdir()
            mirror.mkdir()
            snapshot = _snapshot(primary)
            for path in snapshot.values():
                (mirror / path.name).write_bytes(path.read_bytes())
            (mirror / snapshot["remediation_md"].name).write_text("stale mirror\n", encoding="utf-8")
            update_path = root / "book-update.json"
            receipt_path = root / "portfolio-update-receipt.json"
            _update(update_path, snapshot)
            watched = list(snapshot.values()) + [mirror / path.name for path in snapshot.values()]
            before = {path: path.read_bytes() for path in watched}

            with self.assertRaisesRegex(EvaluationError, "mirror is stale"):
                update_portfolio_snapshot(
                    report_data_path=snapshot["data"],
                    report_html_path=snapshot["html"],
                    book_update_path=update_path,
                    remediation_json_path=snapshot["remediation_json"],
                    remediation_markdown_path=snapshot["remediation_md"],
                    receipt_path=receipt_path,
                    mirror_dirs=[mirror],
                )

            self.assertEqual(before, {path: path.read_bytes() for path in watched})
            self.assertFalse(receipt_path.exists())


if __name__ == "__main__":
    unittest.main()
