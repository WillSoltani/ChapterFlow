"""Full deterministic fixture pipeline: discover, validate, aggregate, render, audit."""

from __future__ import annotations

import copy
import csv
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path


TESTS_DIR = Path(__file__).resolve().parent
SKILL_ROOT = TESTS_DIR.parent
REPO_ROOT = SKILL_ROOT.parents[2]
SCRIPTS_DIR = SKILL_ROOT / "scripts"
FIXTURES = TESTS_DIR / "fixtures"
for import_path in (SCRIPTS_DIR, TESTS_DIR):
    if str(import_path) not in sys.path:
        sys.path.insert(0, str(import_path))

from common import DOMAINS, calculate_scores, inspect_package  # noqa: E402
from test_validation import valid_receipt_chain, valid_result  # noqa: E402
from validate_report import AuditParser as ValidationAuditParser  # noqa: E402


class ReportParser(HTMLParser):
    """Collect IDs, local links, static text, and the embedded canonical JSON."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.local_hrefs: list[str] = []
        self.static_text: list[str] = []
        self.data_chunks: list[str] = []
        self._data_script_depth = 0
        self._suppressed_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        identifier = attributes.get("id")
        if identifier:
            self.ids.append(identifier)
        href = attributes.get("href")
        if href and href.startswith("#"):
            self.local_hrefs.append(href)
        if tag == "script" and identifier == "chapterflow-report-data":
            self._data_script_depth += 1
        elif tag in {"script", "style"}:
            self._suppressed_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._data_script_depth:
            self._data_script_depth -= 1
        elif tag in {"script", "style"} and self._suppressed_depth:
            self._suppressed_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._data_script_depth:
            self.data_chunks.append(data)
        elif not self._suppressed_depth:
            self.static_text.append(data)


def copy_fixture(name: str, destination: Path) -> Path:
    shutil.copytree(FIXTURES / name, destination)
    return destination


def adapt_result_to_job(job: dict[str, str]) -> dict:
    package_path = Path(job["package_path"])
    package_file = package_path if package_path.is_file() else package_path / "package.json"
    package = json.loads(package_file.read_text(encoding="utf-8"))
    chapters = package["chapters"]
    book_meta = package.get("book") or {}
    result = valid_result(role=job["rater_role"], rating=3)
    result["run_id"] = job["run_id"]
    result["job_id"] = job["job_id"]
    result["source_hash"] = job["source_hash"]
    result["book"].update(
        {
            "book_id": job["book_id"],
            "slug": job["book_id"],
            "title": str(book_meta.get("title") or package.get("title") or package_file.stem),
            "subtitle": book_meta.get("subtitle"),
            "package_path": job["package_path"],
            "chapter_count_expected": len(chapters),
            "chapter_count_read_full": len(chapters),
            "chapter_count_partial": 0,
            "chapter_count_inaccessible": 0,
            "all_accessible_chapters_read": True,
        }
    )
    chapter_records = []
    for index, source in enumerate(chapters, start=1):
        template = copy.deepcopy(valid_result()["chapter_evidence"][0])
        template.update(
            {
                "chapter_index": index,
                "chapter_id": source.get("chapterId"),
                "title": str(source.get("title") or f"Chapter {index}"),
                "central_ideas": ["A synthetic fixture idea used only to exercise the pipeline."],
                "evidence": [
                    {
                        "package_path": job["package_path"],
                        "chapter": f"Chapter {index}: {source.get('title') or index}",
                        "section": "fullRead",
                        "item_id": source.get("chapterId"),
                        "paraphrase": "The local fixture supplies a concise observable teaching point.",
                    }
                ],
            }
        )
        chapter_records.append(template)
    chapter_records[0]["trust_qa_safety_issues"] = [
        "A test-only keyed answer mismatch requires correction."
    ]
    result["chapter_evidence"] = chapter_records
    first_locator = str(chapters[0].get("chapterId") or f"Chapter 1: {chapters[0].get('title') or 1}")
    last_locator = str(chapters[-1].get("chapterId") or f"Chapter {len(chapters)}: {chapters[-1].get('title') or len(chapters)}")
    for domain in result["domains"].values():
        for subcriterion in domain["subcriteria"].values():
            for field, locator in (("strength_evidence", first_locator), ("limitation_evidence", last_locator)):
                for evidence in subcriterion[field]:
                    evidence["package_path"] = job["package_path"]
                    evidence["chapter"] = locator
    result["technical_findings"] = [
        {
            "severity": "error",
            "type": "ambiguous",
            "locator": "chapter 1 / quiz q01",
            "description": "The test-only keyed answer conflicts with the prompt.",
            "reader_facing": True,
            "scoring_treatment": "Used only to verify structured chapter filtering.",
        }
    ]
    calculate_scores(result)
    return result


def adjudicated_from(primary: dict) -> dict:
    result = copy.deepcopy(primary)
    result.pop("worker_dispatch_receipt_sha256", None)
    result["job_id"] = f"{result['book']['book_id']}--adjudicated"
    result["rater_role"] = "adjudicated"
    result["rater_agreement"] = {
        "mean_absolute_subcriterion_difference": 0.0,
        "maximum_subcriterion_difference": 0.0,
        "overall_score_difference": 0.0,
        "gate_conflicts": [],
        "disagreements": [],
    }
    result["confidence"] = {
        "level": "high",
        "rationale": "Both synthetic blind records agree and every fixture chapter is present.",
        "chapter_completeness_ratio": 1.0,
        "package_ambiguity": "none",
        "unresolved_issues": [],
    }
    result["calibration_changes"] = []
    calculate_scores(result)
    return result


class DeterministicPipelineTests(unittest.TestCase):
    maxDiff = None

    def run_cli(self, *arguments: str, cwd: Path = REPO_ROOT) -> subprocess.CompletedProcess[str]:
        completed = subprocess.run(
            [sys.executable, *arguments],
            cwd=cwd,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(
            0,
            completed.returncode,
            f"command failed: {arguments}\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}",
        )
        return completed

    def test_complete_fixture_pipeline_and_offline_report(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            packages = root / "book-packages"
            run_dir = root / "fixture-run"
            copy_fixture("well_formed_two_chapter", packages / "well-formed")
            copy_fixture("embedded_html_script", packages / "hostile-markup")

            self.run_cli(
                str(SCRIPTS_DIR / "discover_packages.py"),
                "--packages-dir",
                str(packages),
                "--run-dir",
                str(run_dir),
                "--repo-root",
                str(REPO_ROOT),
            )
            with (run_dir / "jobs" / "book-rater-jobs.csv").open("r", encoding="utf-8", newline="") as handle:
                jobs = list(csv.DictReader(handle))
            self.assertEqual(4, len(jobs))
            self.assertEqual(2, sum(row["rater_role"] == "primary" for row in jobs))
            self.assertEqual(2, sum(row["rater_role"] == "verification" for row in jobs))

            by_book: dict[str, dict[str, dict]] = {}
            blind_schema = SKILL_ROOT / "references" / "book-evaluation.schema.json"
            for job in jobs:
                record = adapt_result_to_job(job)
                output = Path(job["output_path"])
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
                by_book.setdefault(job["book_id"], {})[job["rater_role"]] = record
                self.run_cli(
                    str(SCRIPTS_DIR / "validate_book_result.py"),
                    "--schema",
                    str(blind_schema),
                    "--input",
                    str(output),
                    "--expected-source-hash",
                    job["source_hash"],
                )

            adjudicated_schema = SKILL_ROOT / "references" / "adjudicated-book.schema.json"
            for book_id, records in by_book.items():
                self.assertEqual({"primary", "verification"}, set(records))
                package_path = Path(records["primary"]["book"]["package_path"])
                inspection = inspect_package(package_path, run_dir / "tmp" / "receipt-inspection")
                primary_dispatch, verification_dispatch, pair_seal = valid_receipt_chain(
                    records["primary"], records["verification"], inspection
                )
                receipt_root = run_dir / "jobs" / "worker-receipts" / book_id
                receipt_root.mkdir(parents=True, exist_ok=True)
                receipt_paths = {
                    "primary": receipt_root / "primary.dispatch.json",
                    "verification": receipt_root / "verification.dispatch.json",
                    "pair": receipt_root / "pair.seal.json",
                }
                for path, value in (
                    (receipt_paths["primary"], primary_dispatch),
                    (receipt_paths["verification"], verification_dispatch),
                    (receipt_paths["pair"], pair_seal),
                    (run_dir / "raw" / "primary" / f"{book_id}.json", records["primary"]),
                    (run_dir / "raw" / "verification" / f"{book_id}.json", records["verification"]),
                ):
                    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
                for role in ("primary", "verification"):
                    self.run_cli(
                        str(SCRIPTS_DIR / "validate_book_result.py"),
                        "--schema", str(blind_schema),
                        "--input", str(run_dir / "raw" / role / f"{book_id}.json"),
                        "--source-package", str(package_path),
                        "--expected-role", role,
                        "--worker-dispatch-receipt", str(receipt_paths[role]),
                        "--blind-pair-seal", str(receipt_paths["pair"]),
                        "--require-full-content",
                    )
                final = adjudicated_from(records["primary"])
                final_path = run_dir / "raw" / "adjudicated" / f"{book_id}.json"
                final_path.write_text(json.dumps(final, ensure_ascii=False, indent=2), encoding="utf-8")
                self.run_cli(
                    str(SCRIPTS_DIR / "validate_book_result.py"),
                    "--schema",
                    str(adjudicated_schema),
                    "--input",
                    str(final_path),
                    "--expected-source-hash",
                    final["source_hash"],
                    "--adjudicated",
                )

            aggregation = self.run_cli(
                str(SCRIPTS_DIR / "aggregate_results.py"),
                "--run-dir",
                str(run_dir),
                "--skill-dir",
                str(SKILL_ROOT),
            )
            aggregate_summary = json.loads(aggregation.stdout)
            self.assertEqual(2, aggregate_summary["books"])
            self.assertEqual(3, aggregate_summary["chapters"])

            report_data_path = run_dir / "data" / "report-data.json"
            report_data = json.loads(report_data_path.read_text(encoding="utf-8"))
            self.assertEqual(2, len(report_data["books"]))
            self.assertEqual(36, sum(len(item["subcriteria"]) for item in DOMAINS.values()))
            self.assertTrue(all(book["tie_group"] for book in report_data["books"]))
            chapter_index = report_data["chapter_filter_index"]
            self.assertEqual("1.0.0", chapter_index["index_version"])
            self.assertEqual(3, len(chapter_index["chapters"]))
            self.assertTrue(any(item["domain_keys"] for item in chapter_index["chapters"]))
            self.assertTrue(any(item["max_issue_severity"] == "error" for item in chapter_index["chapters"]))
            self.assertIsInstance(chapter_index["unresolved_domain_evidence"], list)
            self.assertIsInstance(chapter_index["unresolved_technical_findings"], list)
            self.assertEqual(
                sorted((book["book"]["title"] for book in report_data["books"]), key=str.casefold),
                [book["book"]["title"] for book in report_data["books"]],
            )

            required_csvs = {
                "scorecard.csv",
                "domain-scores.csv",
                "subcriteria.csv",
                "chapter-evidence.csv",
                "gates.csv",
                "technical-findings.csv",
                "rater-agreement.csv",
                "calibration-log.csv",
                "package-manifest.csv",
                "chapter-domain-index.csv",
                "chapter-issue-index.csv",
            }
            self.assertTrue(required_csvs.issubset({path.name for path in (run_dir / "data").glob("*.csv")}))
            with (run_dir / "data" / "subcriteria.csv").open("r", encoding="utf-8", newline="") as handle:
                self.assertEqual(72, len(list(csv.DictReader(handle))))
            with (run_dir / "data" / "chapter-evidence.csv").open("r", encoding="utf-8", newline="") as handle:
                self.assertEqual(3, len(list(csv.DictReader(handle))))
            with (run_dir / "data" / "chapter-domain-index.csv").open("r", encoding="utf-8", newline="") as handle:
                self.assertGreater(len(list(csv.DictReader(handle))), 0)
            with (run_dir / "data" / "chapter-issue-index.csv").open("r", encoding="utf-8", newline="") as handle:
                self.assertGreater(len(list(csv.DictReader(handle))), 0)

            report_path = run_dir / "report.html"
            self.run_cli(
                str(SCRIPTS_DIR / "render_report.py"),
                "--data",
                str(report_data_path),
                "--output",
                str(report_path),
            )
            self.assertTrue(report_path.exists())
            self.assertGreater(report_path.stat().st_size, 10_000)

            html = report_path.read_text(encoding="utf-8")
            parser = ReportParser()
            parser.feed(html)
            self.assertEqual(len(parser.ids), len(set(parser.ids)))
            for href in parser.local_hrefs:
                target = href[1:].split("?", 1)[0]
                if target:
                    self.assertIn(target, parser.ids, f"unresolved local anchor: {href}")
            embedded = json.loads("".join(parser.data_chunks))
            self.assertEqual(report_data, embedded)

            node = shutil.which("node")
            if node:
                runtime_data = copy.deepcopy(report_data)
                runtime_books = {book["book"]["book_id"]: book for book in runtime_data["books"]}
                runtime_chapters = {
                    f"{book_id}/{chapter['chapter_id']}": chapter
                    for book_id, book in runtime_books.items()
                    for chapter in book["chapter_evidence"]
                }
                runtime_index = {
                    f"{item['book_id']}/{item['chapter_id']}": item
                    for item in runtime_data["chapter_filter_index"]["chapters"]
                }
                key_a = "fixture-well-formed/observe"
                key_b = "fixture-well-formed/review"
                key_c = "fixture-hostile-markup/markup"
                self.assertEqual({key_a, key_b, key_c}, set(runtime_chapters))
                self.assertEqual(set(runtime_chapters), set(runtime_index))

                runtime_chapters[key_a]["title"] = "TitleNeedle Alpha"
                runtime_chapters[key_a]["evidence"][0]["paraphrase"] = "EvidenceNeedle Alpha retention retrieval"
                runtime_chapters[key_a]["trust_qa_safety_issues"] = ["IssueNeedle Alpha"]
                runtime_chapters[key_a]["read_status"] = "full"
                runtime_index[key_a]["domain_keys"] = ["epistemic_integrity"]
                runtime_index[key_a]["max_issue_severity"] = "error"

                runtime_chapters[key_b]["evidence"][0]["paraphrase"] = "EvidenceNeedle Beta"
                runtime_chapters[key_b]["trust_qa_safety_issues"] = ["IssueNeedle Beta"]
                runtime_chapters[key_b]["read_status"] = "partial"
                runtime_index[key_b]["domain_keys"] = ["retention_retrieval"]
                runtime_index[key_b]["max_issue_severity"] = "info"

                runtime_chapters[key_c]["read_status"] = "inaccessible"
                runtime_index[key_c]["domain_keys"] = ["audience_fit"]
                runtime_index[key_c]["max_issue_severity"] = "none"
                runtime_books["fixture-well-formed"]["analysis"]["highest_impact_improvements"][0] = "RecommendationNeedle Orbit"

                audit_parser = ValidationAuditParser()
                audit_parser.feed(html)
                app_javascript = next(
                    body for attrs, body in audit_parser.scripts
                    if attrs.get("type") != "application/json"
                )
                cases = [
                    ({"q": "titleneedle alpha"}, [key_a]),
                    ({"q": "evidenceneedle beta"}, [key_b]),
                    ({"q": "issueneedle alpha"}, [key_a]),
                    ({"q": "recommendationneedle orbit"}, [key_a, key_b]),
                    ({"book": "fixture-hostile-markup"}, [key_c]),
                    ({"domain": "retention_retrieval"}, [key_b]),
                    ({"severity": "error"}, [key_a]),
                    ({"severity": "info"}, [key_b]),
                    ({"severity": "none"}, [key_c]),
                    ({"status": "full"}, [key_a]),
                    ({"status": "partial"}, [key_b]),
                    ({"status": "inaccessible"}, [key_c]),
                    ({"q": "evidenceneedle beta", "book": "fixture-well-formed", "domain": "retention_retrieval", "severity": "info", "status": "partial"}, [key_b]),
                    ({"q": "never-present"}, []),
                ]
                node_harness = r"""
const fs = require("node:fs");
const vm = require("node:vm");
const payload = JSON.parse(fs.readFileSync(0, "utf8"));
let api;
const context = {
  URLSearchParams,
  window: { location: { hash: "" }, history: { replaceState() {} } },
  document: {
    getElementById(id) {
      return id === "chapterflow-report-data" ? { textContent: JSON.stringify(payload.data) } : null;
    },
    querySelectorAll() { return []; }
  },
  __chapterflowFilterTestHook(value) { api = value; }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(payload.javascript, context, { timeout: 1000 });
if (!api) throw new Error("chapter filter test hook was not called");
process.stdout.write(JSON.stringify(payload.cases.map(item => api.filterChapterKeys(item.filters).sort())));
"""
                runtime_cases = [{"filters": filters} for filters, _ in cases]
                completed = subprocess.run(
                    [node, "-e", node_harness],
                    input=json.dumps({"data": runtime_data, "javascript": app_javascript, "cases": runtime_cases}),
                    text=True,
                    capture_output=True,
                    check=False,
                )
                self.assertEqual(0, completed.returncode, completed.stderr)
                self.assertEqual([sorted(expected) for _, expected in cases], json.loads(completed.stdout))

            static_text = " ".join(parser.static_text)
            for book in report_data["books"]:
                self.assertIn(book["book"]["title"], static_text)
                self.assertIn(f"{book['overall_score']:.1f}", static_text)
                for chapter in book["chapter_evidence"]:
                    self.assertIn(chapter["title"], static_text)
            for domain_key, definition in DOMAINS.items():
                self.assertIn(definition["name"], static_text)
                for subcriterion_name in definition["subcriteria"].values():
                    self.assertIn(subcriterion_name, static_text)

            self.assertNotIn("</script><script>globalThis.__chapterflowPwned", html)
            self.assertNotIn("<img src=x onerror=globalThis.__chapterflowPwned", html)
            self.assertIn("\\u003c/script\\u003e", html.lower())
            self.assertIn("noscript", html.lower())

            self.assertEqual(required_csvs, required_csvs.intersection(report_data["csv_downloads"]))
            for filename, payload in report_data["csv_downloads"].items():
                with self.subTest(download=filename):
                    rows = list(csv.reader(io.StringIO(payload, newline="")))
                    self.assertTrue(rows)
                    self.assertTrue(rows[0])

            validation = self.run_cli(
                str(SCRIPTS_DIR / "validate_report.py"),
                "--report",
                str(report_path),
                "--data",
                str(report_data_path),
            )
            validation_summary = json.loads(validation.stdout)
            self.assertIn(validation_summary["status"], {"passed", "valid"})
            self.assertEqual(2, validation_summary["books"])

            run_manifest_path = run_dir / "data" / "run-manifest.json"
            completed_manifest = json.loads(run_manifest_path.read_text(encoding="utf-8"))
            completed_manifest["status"] = "completed"
            run_manifest_path.write_text(json.dumps(completed_manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            self.run_cli(
                str(SCRIPTS_DIR / "aggregate_results.py"),
                "--run-dir",
                str(run_dir),
                "--skill-dir",
                str(SKILL_ROOT),
            )
            preserved_manifest = json.loads(run_manifest_path.read_text(encoding="utf-8"))
            self.assertEqual("completed", preserved_manifest["status"])


if __name__ == "__main__":
    unittest.main()
