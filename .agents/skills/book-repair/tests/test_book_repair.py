from __future__ import annotations

import hashlib
import base64
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SKILL = Path(__file__).resolve().parents[1]
EVALUATOR = SKILL.parent / "chapterflow-book-evaluator"
sys.path.insert(0, str(EVALUATOR / "scripts"))
sys.path.insert(0, str(EVALUATOR / "tests"))
from common import DOMAINS, agreement_statistics, calculate_scores  # noqa: E402
from generate_remediation_prompts import markdown_pack, remediation_pack  # noqa: E402
import update_portfolio_report as portfolio_updater  # noqa: E402
from test_validation import valid_receipt_chain, valid_result  # noqa: E402
from worker_receipts import artifact_sha256  # noqa: E402
sys.path.insert(0, str(SKILL / "scripts"))
from verify_repair_outcome import _chapter_content_hash_v2  # noqa: E402
from repair_common import history_entry_sha256  # noqa: E402

LOAD = SKILL / "scripts/load_repair_context.py"
ADVANCE = SKILL / "scripts/advance_repair_state.py"
VERIFY = SKILL / "scripts/verify_repair_outcome.py"
BOOTSTRAP = SKILL / "scripts/bootstrap_v24_state_from_history.py"
PIPELINE = Path("scripts/book/prompts/chapterflow-v24-author-pipeline")
HTML_NAME = "chapterflow-140-evaluation-report.html"
DATA_NAME = "chapterflow-140-evaluation-report-data.json"
PROMPTS_JSON = "chapterflow-140-remediation-prompts.json"
PROMPTS_MD = "chapterflow-140-remediation-prompts.md"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def package(book_id: str = "alpha-book") -> dict:
    return {
        "packageId": f"{book_id}-v21-test",
        "book": {"bookId": book_id, "title": "Alpha Book", "author": "A. Writer"},
        "chapters": [
            {"chapterId": f"{book_id}-ch01", "number": 1, "title": "One", "hook": "First"},
            {"chapterId": f"{book_id}-ch02", "number": 2, "title": "Two", "hook": "Second"},
        ],
    }


def remediation() -> dict:
    return {
        "condition_count": 2,
        "conditions": [
            {"id": "D-01", "scope": "domain", "label": "Domain 1"},
            {"id": "S-01-01", "scope": "subcriterion", "label": "Criterion 1-1"},
        ],
        "workstreams": [
            {"qa_findings": ["Quiz answer-length cue.", "Repeated staging signal."]},
            {"qa_findings": ["Quiz answer-length cue."]},
        ],
        "prompt_markdown": "# Exact repair prompt\n\nFix only confirmed defects.\n",
    }


class Fixture:
    def __init__(self, root: Path, *, with_prompt_companion: bool = True, untracked_branch: bool = False) -> None:
        self.root = root
        self.repo = root / "repo"
        self.outputs = root / "outputs"
        self.repo.mkdir()
        self.outputs.mkdir()
        for relative in (
            Path("AGENTS.md"),
            Path("CLAUDE.md"),
            PIPELINE / "AGENTS.md",
            PIPELINE / "agent-prompts/STEP-2-WRITE-CHAPTERS.md",
            PIPELINE / "src/qc/orchestrator/repairBrief.ts",
            PIPELINE / "src/lib/readerContent.ts",
            PIPELINE / "src/critics/machineryPhrases.ts",
            PIPELINE / "src/critics/qcAttestation.ts",
        ):
            target = self.repo / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(f"authority: {relative}\n", encoding="utf-8")
        write_json(self.repo / "book-packages/alpha-book.v21.json", package())
        write_json(self.repo / PIPELINE / "book-packages/alpha-book.v21.json", package())
        write_json(self.repo / PIPELINE / "state/indexes/alpha-book.json", [
            {"chapterId": "alpha-book-ch01", "chapterNumber": 1, "chapterTitle": "One"},
            {"chapterId": "alpha-book-ch02", "chapterNumber": 2, "chapterTitle": "Two"},
        ])
        for chapter in package()["chapters"]:
            loose = {**chapter, "schemaVersion": "chapterflow-v21-authored", "depthLevel": "authoring-only", "authoring": {"session": "writer-session-1"}}
            write_json(self.repo / PIPELINE / "state/chapters" / f"{chapter['chapterId']}.v21-native.chapter.json", loose)
        self.book = {
            "id": "alpha-book",
            "title": "Alpha Book",
            "file": "alpha-book.v21.json",
            "score": 72.0,
            "gates": {
                "technical": "Pass",
                "epistemic": "Conditional",
                "ethics": "Pass",
                "note": "A central claim needs a boundary.",
            },
            "qa": ["Quiz answer-length cue."],
            "remediation": remediation(),
        }
        filler = [
            {
                "id": f"portfolio-book-{index:03d}", "title": f"Portfolio Book {index}", "author": "Portfolio Author",
                "rank": index + 1, "score": 85.0, "confidence": "High",
                "gates": {"epistemic": "Pass", "ethics": "Pass"},
                "remediation": {"condition_count": 0, "conditions": []},
            }
            for index in range(1, 140)
        ]
        self.baseline_data = {"books": [self.book, *filler]}
        self.report = self.outputs / HTML_NAME
        self.write_report(self.baseline_data)
        if with_prompt_companion:
            write_json(self.outputs / PROMPTS_JSON, {
                "books": [{
                    "book_id": "alpha-book",
                    "title": "Alpha Book",
                    "source_file": "alpha-book.v21.json",
                    "remediation": remediation(),
                }]
            })
        (self.outputs / PROMPTS_MD).write_text("baseline prompts\n", encoding="utf-8")
        self.remote = root / "remote.git"
        subprocess.run(["git", "init", "--bare", str(self.remote)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["git", "-C", str(self.repo), "init", "-b", "main"], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["git", "-C", str(self.repo), "config", "user.name", "Book Repair Test"], check=True)
        subprocess.run(["git", "-C", str(self.repo), "config", "user.email", "book-repair@example.test"], check=True)
        subprocess.run(["git", "-C", str(self.repo), "add", "."], check=True)
        subprocess.run(["git", "-C", str(self.repo), "commit", "-m", "baseline"], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["git", "-C", str(self.repo), "remote", "add", "origin", str(self.remote)], check=True)
        subprocess.run(["git", "-C", str(self.repo), "push", "-u", "origin", "main"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if untracked_branch:
            subprocess.run(["git", "-C", str(self.repo), "switch", "-c", "feat/v25-pipeline"], check=True, stdout=subprocess.DEVNULL)

    def write_report(self, data: dict, downloads: dict | None = None) -> None:
        embedded = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
        source = ""
        if downloads is not None:
            source = f'<script id="source-downloads" type="application/json">{json.dumps(downloads, ensure_ascii=False)}</script>'
        self.report.write_text(f"<!doctype html><script id=\"report-data\" type=\"application/json\">{embedded}</script>{source}\n", encoding="utf-8")
        write_json(self.outputs / DATA_NAME, data)

    def load_process(
        self,
        run_id: str = "test-run",
        *,
        publication_remote: str | None = None,
        publication_ref: str | None = None,
        push_authorized: bool = True,
    ) -> subprocess.CompletedProcess[str]:
        command = [
            sys.executable, str(LOAD),
            "--report", str(self.report),
            "--book-id", "alpha-book",
            "--repo-root", str(self.repo),
            "--run-id", run_id,
            "--new-thread-authorized-by-user",
        ]
        if push_authorized:
            command.append("--push-authorized-by-user")
        if publication_remote is not None:
            command.extend(["--publication-remote", publication_remote])
        if publication_ref is not None:
            command.extend(["--publication-ref", publication_ref])
        return subprocess.run(command, text=True, capture_output=True)

    def load(
        self,
        run_id: str = "test-run",
        *,
        publication_remote: str | None = None,
        publication_ref: str | None = None,
        push_authorized: bool = True,
    ) -> Path:
        result = self.load_process(
            run_id,
            publication_remote=publication_remote,
            publication_ref=publication_ref,
            push_authorized=push_authorized,
        )
        if result.returncode:
            raise AssertionError(result.stderr + result.stdout)
        return self.repo / "artifacts/book-repair/alpha-book" / run_id

    def advance_to_report_updated(self, run_dir: Path) -> None:
        state = run_dir / "state.json"
        evidence_by_phase = {
            "repairing": {"writer_session_id": "writer-session-1"},
            "repair_complete": {},
        }
        artifacts_by_phase = {
            "repair_complete": ("repair_handback", "deterministic_log"),
        }
        for phase in (
            "repairing",
            "repair_complete",
        ):
            command = [sys.executable, str(ADVANCE), "--state", str(state), "--to", phase]
            for key, value in evidence_by_phase[phase].items():
                command.extend(["--evidence", f"{key}={value}"])
            for label in artifacts_by_phase.get(phase, ()):
                artifact = run_dir / f"phase-{phase}-{label}.txt"
                artifact.write_text(f"{phase}:{label}\n", encoding="utf-8")
                command.extend(["--artifact", f"{label}={artifact}"])
            result = subprocess.run(command, text=True, capture_output=True)
            if result.returncode:
                raise AssertionError(result.stderr + result.stdout)

    def evaluation_artifacts(self, run_dir: Path, score: float) -> tuple[Path, Path]:
        candidate = self.repo / PIPELINE / "book-packages/alpha-book.v21.json"
        candidate_payload = json.loads(candidate.read_text(encoding="utf-8"))
        candidate_payload["repairMarker"] = "post-repair-candidate"
        write_json(candidate, candidate_payload)
        source_hash = hashlib.sha256(candidate.read_bytes()).hexdigest()
        ratings = [[3.5 for _ in range(4)] for _ in range(9)]
        if score == 80.0:
            ratings = [[3.0 for _ in range(4)] for _ in range(9)]
            ratings[0] = [3.5] * 4
            ratings[1] = [3.5] * 4
            ratings[4] = [3.5] * 4
            ratings[3][0] = 3.5
        domains = {f"Domain {index}": sum(ratings[index - 1]) / 4 for index in range(1, 10)}
        subcriteria = [
            {"domain": f"Domain {domain}", "subcriterion": f"Criterion {domain}-{sub}", "rating": ratings[domain - 1][sub - 1], "evidence": ["chapter locator"]}
            for domain in range(1, 10) for sub in range(1, 5)
        ]
        weighted_points = {
            f"Domain {index}": domains[f"Domain {index}"] / 4 * weight
            for index, weight in enumerate((15, 12, 15, 12, 10, 15, 8, 8, 5), 1)
        }
        computed_score = sum(weighted_points.values())
        self_test_score = round(computed_score, 8)
        if abs(self_test_score - score) > 1e-8:
            raise AssertionError(f"fixture requested score {score}, constructed {self_test_score}")
        updated_book = {
            "id": "alpha-book",
            "title": "Alpha Book",
            "file": "alpha-book.v21.json",
            "score": score,
            "gates": {
                "technical": "Pass",
                "epistemic": "Pass",
                "ethics": "Pass",
                "purpose_audience": "Pass",
                "external_accuracy": "Not assessed",
                "note": "",
            },
            "domains": domains,
            "subcriteria": subcriteria,
            "weighted_points": weighted_points,
            "evaluation_provenance": {
                "method": "full_book_blind_dual_rater_adjudication",
                "evaluation_mode": "full_content",
                "all_chapters_read": True,
                "chapter_count_expected": 2,
                "chapter_count_read_full": 2,
                "source_hash": source_hash,
                "evaluator_thread_id": "thread-evaluator-1",
                "rater_pair_validated": True,
                "run_id": "fixture-run",
                "job_id": "alpha-book--adjudicated",
                "primary_job_id": "alpha-book--primary",
                "verification_job_id": "alpha-book--verification",
            },
        }
        update = {
            "schema_version": "1.0.0",
            "evaluation_mode": "full_content",
            "book_id": "alpha-book",
            "source_hash": source_hash,
            "book": updated_book,
        }
        update_path = run_dir / "book-update.json"
        write_json(update_path, update)

        def blind_record(role: str, use_upper: bool) -> dict:
            record = valid_result(role=role, rating=3)
            record["job_id"] = f"alpha-book--{role}"
            record["source_hash"] = source_hash
            record["book"]["book_id"] = "alpha-book"
            record["book"]["slug"] = "alpha-book"
            record["book"]["title"] = "Alpha Book"
            record["book"]["package_path"] = str(candidate)
            for chapter_index, chapter in enumerate(record["chapter_evidence"]):
                chapter["chapter_id"] = candidate_payload["chapters"][chapter_index]["chapterId"]
                chapter["title"] = ("One", "Two")[chapter_index]
            for domain_index, domain in enumerate(record["domains"].values()):
                for sub_index, subcriterion in enumerate(domain["subcriteria"].values()):
                    final_rating = ratings[domain_index][sub_index]
                    subcriterion["rating"] = int(final_rating + 0.5) if use_upper else int(final_rating)
            calculate_scores(record)
            return record

        primary = blind_record("primary", False)
        verification_blind = blind_record("verification", True)
        inspection = {
            "book_id": "alpha-book",
            "chapter_count": 2,
            "inventory_complete": True,
            "inventory_errors": [],
            "chapter_inventory": [
                {"chapter_index": index, "chapter_id": chapter["chapterId"], "number": chapter["number"], "title": chapter["title"]}
                for index, chapter in enumerate(candidate_payload["chapters"], 1)
            ],
        }
        primary_dispatch, verification_dispatch, pair_seal = valid_receipt_chain(primary, verification_blind, inspection)
        updated_book["evaluation_provenance"].update({
            "blind_pair_id": pair_seal["pair_id"],
            "blind_pair_inventory_sha256": pair_seal["inventory_sha256"],
            "primary_dispatch_receipt_sha256": artifact_sha256(primary_dispatch),
            "verification_dispatch_receipt_sha256": artifact_sha256(verification_dispatch),
            "blind_pair_seal_sha256": artifact_sha256(pair_seal),
            "primary_worker_task_id": pair_seal["workers"]["primary"]["worker_task_id"],
            "primary_worker_session_id": pair_seal["workers"]["primary"]["worker_session_id"],
            "verification_worker_task_id": pair_seal["workers"]["verification"]["worker_task_id"],
            "verification_worker_session_id": pair_seal["workers"]["verification"]["worker_session_id"],
        })
        write_json(update_path, update)
        primary_path = run_dir / "primary.json"
        verification_blind_path = run_dir / "verification.json"
        receipt_dir = run_dir / "jobs/worker-receipts/alpha-book"
        primary_dispatch_path = receipt_dir / "primary.dispatch.json"
        verification_dispatch_path = receipt_dir / "verification.dispatch.json"
        pair_seal_path = receipt_dir / "pair.seal.json"
        write_json(primary_path, primary)
        write_json(verification_blind_path, verification_blind)
        write_json(primary_dispatch_path, primary_dispatch)
        write_json(verification_dispatch_path, verification_dispatch)
        write_json(pair_seal_path, pair_seal)

        adjudication = valid_result(rating=3)
        adjudication.pop("worker_dispatch_receipt_sha256", None)
        adjudication["rater_role"] = "adjudicated"
        adjudication["job_id"] = "alpha-book--adjudicated"
        adjudication["source_hash"] = source_hash
        adjudication["book"]["book_id"] = "alpha-book"
        adjudication["book"]["slug"] = "alpha-book"
        adjudication["book"]["title"] = "Alpha Book"
        adjudication["book"]["package_path"] = str(candidate)
        for index, chapter in enumerate(adjudication["chapter_evidence"]):
            chapter["chapter_id"] = candidate_payload["chapters"][index]["chapterId"]
            chapter["title"] = ("One", "Two")[index]
        for domain_index, domain in enumerate(adjudication["domains"].values()):
            for sub_index, subcriterion in enumerate(domain["subcriteria"].values()):
                subcriterion["rating"] = ratings[domain_index][sub_index]
        agreement = agreement_statistics(primary, verification_blind)
        enriched = []
        for item in agreement["disagreements"]:
            _, domain_key, _, subcriterion_key = item["path"].split(".")
            final_item = adjudication["domains"][domain_key]["subcriteria"][subcriterion_key]
            enriched.append({
                "path": item["path"],
                "primary": int(item["primary"]),
                "verification": int(item["verification"]),
                "final": final_item["rating"],
                "adjudication_rationale": "The adjudicator rechecked the candidate source and selected the midpoint anchor.",
                "source_rechecked": True,
                "evidence": [final_item["strength_evidence"][0]],
            })
        agreement["disagreements"] = enriched
        adjudication["rater_agreement"] = agreement
        adjudication["confidence"] = {
            "level": "high",
            "rationale": "Both blind records agree and every candidate chapter is present.",
            "chapter_completeness_ratio": 1.0,
            "package_ambiguity": "none",
            "unresolved_issues": [],
        }
        adjudication["calibration_changes"] = []
        calculate_scores(adjudication)
        adjudication_path = run_dir / "adjudicated.json"
        write_json(adjudication_path, adjudication)

        context = json.loads((run_dir / "repair-context.json").read_text(encoding="utf-8"))
        report_book = dict(updated_book)
        report_book["rank"] = 1
        current_report = copy.deepcopy(self.baseline_data)
        current_report["books"][0] = report_book
        prompt_pack = remediation_pack(current_report)
        write_json(self.outputs / PROMPTS_JSON, prompt_pack)
        (self.outputs / PROMPTS_MD).write_text(markdown_pack(prompt_pack), encoding="utf-8")
        write_json(self.outputs / DATA_NAME, current_report)
        downloads = {}
        for name in (
            "ChapterFlow_140_Scorecard.csv",
            "ChapterFlow_140_Diagnostics.csv",
            "ChapterFlow_140_Weighted_Points.csv",
            "ChapterFlow_140_Subcriterion_Audit.csv",
            "ChapterFlow_140_Chapter_Evidence.csv",
            "ChapterFlow_140_QA_Findings.csv",
        ):
            payload = b"id\n"
            downloads[name] = {
                "mime": "text/csv;charset=utf-8",
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "base64": base64.b64encode(payload).decode(),
            }
        for name in ("ChapterFlow_140_Summary.md", "ChapterFlow_140_Evaluation_Report.html"):
            payload = f"synthetic seed: {name}\n".encode()
            downloads[name] = {"mime": "text/plain;charset=utf-8", "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest(), "base64": base64.b64encode(payload).decode()}
        for name in (DATA_NAME, PROMPTS_JSON, PROMPTS_MD):
            payload = (self.outputs / name).read_bytes()
            downloads[name] = {"mime": "application/octet-stream", "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest(), "kind": "companion"}
        downloads = portfolio_updater._refresh_downloads(
            downloads,
            current_report,
            {name: (self.outputs / name).read_bytes() for name in (DATA_NAME, PROMPTS_JSON, PROMPTS_MD)},
        )
        self.write_report(current_report, downloads)
        snapshot = self.repo / "docs/v25/chapterflow-140-evaluation"
        snapshot.mkdir(parents=True, exist_ok=True)
        for name in (HTML_NAME, DATA_NAME, PROMPTS_JSON, PROMPTS_MD):
            shutil.copyfile(self.outputs / name, snapshot / name)

        updater_receipt = {
            "schema_version": "1.1.0",
            "generator": "chapterflow-book-evaluator/scripts/update_portfolio_report.py",
            "transaction_id": "portfolio-update-0123456789abcdef0123456789abcdef",
            "status": "valid",
            "book_id": "alpha-book",
            "source_hash": source_hash,
            "baseline_report_data_sha256": context["report"]["baseline_data_sha256"],
            "book_count": 140,
            "unique_book_count": 140,
            "non_target_preserved": True,
            "remediation_valid": True,
            "source_downloads_valid": True,
            "full_validator_status": "valid",
            "full_validator": {
                "module": "chapterflow-book-evaluator/scripts/validate_report.py",
                "function": "validate_report",
                "status": "valid",
                "error_count": 0,
                "candidate_report_data_sha256": hashlib.sha256((self.outputs / DATA_NAME).read_bytes()).hexdigest(),
                "candidate_report_html_sha256": hashlib.sha256(self.report.read_bytes()).hexdigest(),
            },
            "roots": [
                {
                    "kind": kind,
                    "root": str(root.resolve()),
                    "outputs": [
                        {"name": name, "path": str((root / name).resolve()), "sha256": hashlib.sha256((root / name).read_bytes()).hexdigest()}
                        for name in (HTML_NAME, DATA_NAME, PROMPTS_JSON, PROMPTS_MD)
                    ],
                }
                for kind, root in (("primary", self.outputs), ("mirror", snapshot))
            ],
        }
        updater_receipt_path = run_dir / "portfolio-updater-receipt.json"
        write_json(updater_receipt_path, updater_receipt)

        matrix_path = self.repo / PIPELINE / "state/qc-orchestrator/alpha-book/round-2/evidence-matrix.json"
        matrix_checks = {
            "sourceV2": "PASS", "shipGate": "PASS", "authorCheck": "PASS", "intraBook": "PASS",
            "bookGate": "PASS", "sweep": "PASS", "manualKeyJudge": "PASS", "barRead": "GREEN",
            "confirmRead": "PUBLISHABLE", "repairLedger": "NO_OPEN_BLOCKERS", "majors": "PASS", "planEnforcement": "PASS",
        }
        write_json(matrix_path, {
            "schemaVersion": "qc-evidence-matrix-v1",
            "bookId": "alpha-book",
            "roundId": "round-2",
            "generatedAt": "2026-07-10T12:00:00Z",
            "chapters": [
                {"chapterNumber": chapter["number"], "contentHash": _chapter_content_hash_v2(chapter), "checks": matrix_checks, "finalVerdict": "PUBLISHABLE"}
                for chapter in [json.loads((self.repo / PIPELINE / "state/chapters" / f"{row['chapterId']}.v21-native.chapter.json").read_text()) for row in json.loads((self.repo / PIPELINE / "state/indexes/alpha-book.json").read_text())]
            ],
            "errors": [],
        })

        condition_rows = []
        domain_items = list(adjudication["domains"].items())
        for item in context["repair"]["conditions"]:
            if item["id"].startswith("D-"):
                domain_index = int(item["id"].split("-")[1]) - 1
                domain_key, domain = domain_items[domain_index]
                subcriterion = next(iter(domain["subcriteria"].values()))
                canonical_path = f"domains.{domain_key}.domain_score"
                post_percent = domain["domain_score"] * 25
            else:
                _, raw_domain, raw_sub = item["id"].split("-")
                domain_key, domain = domain_items[int(raw_domain) - 1]
                sub_key, subcriterion = list(domain["subcriteria"].items())[int(raw_sub) - 1]
                canonical_path = f"domains.{domain_key}.subcriteria.{sub_key}.rating"
                post_percent = subcriterion["rating"] * 25
            condition_rows.append({
                "id": item["id"],
                "status": "confirmed_fixed",
                "canonical_rubric_path": canonical_path,
                "post_repair_percent": post_percent,
                "adjudication_evidence": [subcriterion["strength_evidence"][0]],
                "evidence": [{"locator": "Chapter 1 / rubric", "finding": "Re-rated at or above 80%."}],
            })

        verification = {
            "schema_version": "1.0.0",
            "book_id": "alpha-book",
            "blind_raters": {
                "primary_path": str(primary_path),
                "primary_sha256": hashlib.sha256(primary_path.read_bytes()).hexdigest(),
                "verification_path": str(verification_blind_path),
                "verification_sha256": hashlib.sha256(verification_blind_path.read_bytes()).hexdigest(),
                "primary_dispatch_path": str(primary_dispatch_path),
                "primary_dispatch_sha256": hashlib.sha256(primary_dispatch_path.read_bytes()).hexdigest(),
                "verification_dispatch_path": str(verification_dispatch_path),
                "verification_dispatch_sha256": hashlib.sha256(verification_dispatch_path.read_bytes()).hexdigest(),
                "blind_pair_seal_path": str(pair_seal_path),
                "blind_pair_seal_sha256": hashlib.sha256(pair_seal_path.read_bytes()).hexdigest(),
            },
            "verification_provenance": {
                "evaluator_thread_id": "thread-evaluator-1",
                "evaluator_project_id": "project-test",
                "evaluator_task_forked": False,
                "book_update_path": str(update_path),
                "book_update_sha256": hashlib.sha256(update_path.read_bytes()).hexdigest(),
                "adjudication_path": str(adjudication_path),
                "adjudication_sha256": hashlib.sha256(adjudication_path.read_bytes()).hexdigest(),
                "evaluated_after_repair": True,
                "blind_result_sealed_before_baseline_opened": True,
            },
            "conditions": condition_rows,
            "mapped_defects": [
                {"id": item["id"], "status": "fixed", "evidence": [{"locator": "Chapter 1 / QA", "finding": "Independent review no longer finds the defect."}]}
                for item in context["repair"]["mapped_defects"]
            ],
            "new_defects": [],
            "unresolved_defects": [],
            "pipeline": {
                "book_gate": "Pass",
                "major_status": "Pass",
                "qc_converge": "DETERMINISTIC-CLEAN",
                "fresh_qc": {
                    "status": "Pass",
                    "score": 91.0,
                    "minimum_axis": 0.75,
                    "after_last_content_change": True,
                    "session_independent": True,
                    "round_id": "round-2",
                    "evidence_matrix_path": str(matrix_path.resolve()),
                    "evidence_matrix_sha256": hashlib.sha256(matrix_path.read_bytes()).hexdigest(),
                },
            },
            "report_mirror": {
                "transactional": True,
                "validated_before_mirror": True,
                "repo_snapshot_dir": str(snapshot),
                "updater_receipt_path": str(updater_receipt_path),
                "updater_receipt_sha256": hashlib.sha256(updater_receipt_path.read_bytes()).hexdigest(),
            },
        }
        verification_path = run_dir / "repair-verification.json"
        write_json(verification_path, verification)
        state_path = run_dir / "state.json"
        transitions = [
            (
                "fresh_qc_passed",
                ["round_id=round-2", "qc_session_id=qc-session-2", "author_session_id=writer-session-1"],
                {"evidence_matrix": matrix_path},
            ),
            (
                "evaluator_thread_created",
                ["thread_id=thread-evaluator-1", "project_id=project-test", "forked=false"],
                {},
            ),
            (
                "evaluation_complete",
                [],
                {"primary": primary_path, "verification": verification_blind_path, "primary_dispatch": primary_dispatch_path, "verification_dispatch": verification_dispatch_path, "blind_pair_seal": pair_seal_path, "adjudicated": adjudication_path, "book_update": update_path},
            ),
            (
                "report_updated",
                [],
                {"updater_receipt": updater_receipt_path, "report_html": self.report},
            ),
        ]
        for phase, evidence_rows, artifact_rows in transitions:
            command = [sys.executable, str(ADVANCE), "--state", str(state_path), "--to", phase]
            for row in evidence_rows:
                command.extend(["--evidence", row])
            for label, path in artifact_rows.items():
                command.extend(["--artifact", f"{label}={path}"])
            result = subprocess.run(command, text=True, capture_output=True)
            if result.returncode:
                raise AssertionError(result.stderr + result.stdout)
        return update_path, verification_path

    def verify(self, run_dir: Path, score: float) -> subprocess.CompletedProcess[str]:
        self.advance_to_report_updated(run_dir)
        update, verification = self.evaluation_artifacts(run_dir, score)
        return subprocess.run([
            sys.executable, str(VERIFY),
            "--repair-context", str(run_dir / "repair-context.json"),
            "--book-update", str(update),
            "--repair-verification", str(verification),
            "--report", str(self.report),
        ], text=True, capture_output=True)

    def run_verifier(self, run_dir: Path, update: Path, verification: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run([
            sys.executable, str(VERIFY),
            "--repair-context", str(run_dir / "repair-context.json"),
            "--book-update", str(update),
            "--repair-verification", str(verification),
            "--report", str(self.report),
        ], text=True, capture_output=True)


class BookRepairTests(unittest.TestCase):
    def test_loader_prefers_exact_companion_and_freezes_baseline_defects(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            context = json.loads((run_dir / "repair-context.json").read_text(encoding="utf-8"))
            state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
            self.assertEqual((run_dir / "repair-prompt.md").read_text(encoding="utf-8"), remediation()["prompt_markdown"])
            self.assertEqual(context["report"]["prompt_source_mode"], "companion_json")
            self.assertEqual(context["source"]["baseline_package_path"], str((fixture.repo / "book-packages/alpha-book.v21.json").resolve()))
            self.assertEqual(context["source"]["candidate_package_path"], str((fixture.repo / PIPELINE / "book-packages/alpha-book.v21.json").resolve()))
            defect_types = [item["type"] for item in context["repair"]["mapped_defects"]]
            self.assertEqual(defect_types.count("gate"), 1)
            self.assertEqual(defect_types.count("qa"), 2)
            self.assertTrue(state["authorizations"]["new_evaluator_thread"])
            self.assertTrue(state["authorizations"]["git_push"])

    def test_loader_uses_html_parser_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary), with_prompt_companion=False)
            run_dir = fixture.load()
            context = json.loads((run_dir / "repair-context.json").read_text(encoding="utf-8"))
            self.assertEqual(context["report"]["prompt_source_mode"], "embedded_html")

    def test_fresh_context_advances_with_one_time_git_seal_reflog(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            state = json.loads((run_dir / "state.json").read_text())
            ref = state["context_seal_git_ref"]
            reflog = subprocess.check_output(
                ["git", "-C", str(fixture.repo), "reflog", "show", "--format=%H", ref], text=True
            ).splitlines()
            self.assertEqual(reflog, [state["context_seal_git_oid"]])
            advanced = subprocess.run([
                sys.executable, str(ADVANCE), "--state", str(run_dir / "state.json"), "--to", "repairing",
                "--evidence", "writer_session_id=writer-session-1",
            ], text=True, capture_output=True)
            self.assertEqual(advanced.returncode, 0, advanced.stderr + advanced.stdout)

    def test_untracked_branch_accepts_explicit_reachable_publication_target(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary), untracked_branch=True)
            run_dir = fixture.load(
                publication_remote="origin",
                publication_ref="refs/heads/feat/v25-pipeline",
            )
            context = json.loads((run_dir / "repair-context.json").read_text())
            repository = context["repository"]
            self.assertEqual(repository["publication_tracking_mode"], "explicit_untracked")
            self.assertEqual(repository["tracking_remote"], "origin")
            self.assertEqual(repository["remote_ref"], "refs/heads/feat/v25-pipeline")
            self.assertIsNone(repository["upstream"])
            self.assertFalse(repository["remote_ref_existed_at_freeze"])
            advanced = subprocess.run([
                sys.executable, str(ADVANCE), "--state", str(run_dir / "state.json"), "--to", "repairing",
                "--evidence", "writer_session_id=writer-session-1",
            ], text=True, capture_output=True)
            self.assertEqual(advanced.returncode, 0, advanced.stderr + advanced.stdout)

    def test_untracked_publication_override_rejects_partial_unauthorized_and_unsafe_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary), untracked_branch=True)
            cases = [
                ("partial-remote", {"publication_remote": "origin"}, "supplied together"),
                ("partial-ref", {"publication_ref": "refs/heads/feat/v25-pipeline"}, "supplied together"),
                (
                    "no-push-authority",
                    {"publication_remote": "origin", "publication_ref": "refs/heads/feat/v25-pipeline", "push_authorized": False},
                    "push-authorized-by-user",
                ),
                (
                    "dot-remote",
                    {"publication_remote": ".", "publication_ref": "refs/heads/feat/v25-pipeline"},
                    "non-local remote",
                ),
                (
                    "unsafe-ref",
                    {"publication_remote": "origin", "publication_ref": "refs/tags/not-a-branch"},
                    "refs/heads",
                ),
                (
                    "missing-remote",
                    {"publication_remote": "not-configured", "publication_ref": "refs/heads/feat/v25-pipeline"},
                    "configured remote",
                ),
            ]
            for run_id, kwargs, expected in cases:
                with self.subTest(run_id=run_id):
                    result = fixture.load_process(run_id, **kwargs)
                    self.assertEqual(result.returncode, 2, result.stderr + result.stdout)
                    self.assertIn(expected, result.stderr)
            no_override = fixture.load_process("no-override")
            self.assertEqual(no_override.returncode, 2)
            self.assertIn("untracked branch requires explicit", no_override.stderr)

    def test_tracked_branch_rejects_publication_override(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            result = fixture.load_process(
                "tracked-override",
                publication_remote="origin",
                publication_ref="refs/heads/main",
            )
            self.assertEqual(result.returncode, 2)
            self.assertIn("only for untracked branches", result.stderr)

    def test_mutable_state_cannot_escalate_sealed_user_authority(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load(push_authorized=False)
            state_path = run_dir / "state.json"
            state = json.loads(state_path.read_text())
            self.assertFalse(state["authorizations"]["git_push"])
            state["authorizations"]["git_push"] = True
            write_json(state_path, state)
            result = subprocess.run([
                sys.executable, str(ADVANCE), "--state", str(state_path), "--to", "repairing",
                "--evidence", "writer_session_id=writer-session-1",
            ], text=True, capture_output=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn("authorizations differ", result.stderr)

    def test_acceptance_and_publication_are_candidate_hash_bound(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            result = fixture.verify(run_dir, 87.5)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            receipt = json.loads((run_dir / "acceptance-receipt.json").read_text(encoding="utf-8"))
            self.assertTrue(receipt["accepted"])
            candidate = fixture.repo / PIPELINE / "book-packages/alpha-book.v21.json"
            shutil.copyfile(candidate, fixture.repo / "book-packages/alpha-book.v21.json")
            publish_paths = [
                "book-packages/alpha-book.v21.json",
                *[f"docs/v25/chapterflow-140-evaluation/{name}" for name in (HTML_NAME, DATA_NAME, PROMPTS_JSON, PROMPTS_MD)],
            ]
            subprocess.run(["git", "-C", str(fixture.repo), "add", "--", *publish_paths], check=True)
            subprocess.run(["git", "-C", str(fixture.repo), "commit", "-m", "publish repaired alpha book"], check=True, stdout=subprocess.DEVNULL)
            subprocess.run(["git", "-C", str(fixture.repo), "push", "origin", "main"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            commit_sha = subprocess.check_output(["git", "-C", str(fixture.repo), "rev-parse", "HEAD"], text=True).strip()
            published = subprocess.run([
                sys.executable, str(ADVANCE),
                "--state", str(run_dir / "state.json"),
                "--to", "published",
                "--evidence", "push=origin/test",
                "--repair-context", str(run_dir / "repair-context.json"),
                "--acceptance-receipt", str(run_dir / "acceptance-receipt.json"),
                "--commit-sha", commit_sha,
                "--push-mode", "normal",
            ], text=True, capture_output=True)
            self.assertEqual(published.returncode, 0, published.stderr + published.stdout)
            state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
            self.assertEqual(state["phase"], "published")
            self.assertEqual(state["publication"]["outer_package_sha256"], receipt["accepted_candidate_sha256"])

    def test_publication_rejects_unrelated_commit_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            result = fixture.verify(run_dir, 87.5)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            candidate = fixture.repo / PIPELINE / "book-packages/alpha-book.v21.json"
            shutil.copyfile(candidate, fixture.repo / "book-packages/alpha-book.v21.json")
            unrelated = fixture.repo / "unrelated.txt"
            unrelated.write_text("must not publish\n", encoding="utf-8")
            publish_paths = [
                "book-packages/alpha-book.v21.json",
                *[f"docs/v25/chapterflow-140-evaluation/{name}" for name in (HTML_NAME, DATA_NAME, PROMPTS_JSON, PROMPTS_MD)],
                "unrelated.txt",
            ]
            subprocess.run(["git", "-C", str(fixture.repo), "add", "--", *publish_paths], check=True)
            subprocess.run(["git", "-C", str(fixture.repo), "commit", "-m", "bad broad publish"], check=True, stdout=subprocess.DEVNULL)
            subprocess.run(["git", "-C", str(fixture.repo), "push", "origin", "main"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            commit_sha = subprocess.check_output(["git", "-C", str(fixture.repo), "rev-parse", "HEAD"], text=True).strip()
            published = subprocess.run([
                sys.executable, str(ADVANCE), "--state", str(run_dir / "state.json"), "--to", "published",
                "--evidence", "push=origin/main", "--repair-context", str(run_dir / "repair-context.json"),
                "--acceptance-receipt", str(run_dir / "acceptance-receipt.json"), "--commit-sha", commit_sha,
                "--push-mode", "normal",
            ], text=True, capture_output=True)
            self.assertEqual(published.returncode, 2)
            self.assertIn("path set must be exactly", published.stderr)

    def test_untracked_branch_publication_proves_exact_explicit_remote_ref(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary), untracked_branch=True)
            run_dir = fixture.load(
                publication_remote="origin",
                publication_ref="refs/heads/feat/v25-pipeline",
            )
            result = fixture.verify(run_dir, 87.5)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            candidate = fixture.repo / PIPELINE / "book-packages/alpha-book.v21.json"
            shutil.copyfile(candidate, fixture.repo / "book-packages/alpha-book.v21.json")
            paths = [
                "book-packages/alpha-book.v21.json",
                *[f"docs/v25/chapterflow-140-evaluation/{name}" for name in (HTML_NAME, DATA_NAME, PROMPTS_JSON, PROMPTS_MD)],
            ]
            subprocess.run(["git", "-C", str(fixture.repo), "add", "--", *paths], check=True)
            subprocess.run(["git", "-C", str(fixture.repo), "commit", "-m", "publish explicit untracked branch"], check=True, stdout=subprocess.DEVNULL)
            subprocess.run(
                ["git", "-C", str(fixture.repo), "push", "origin", "HEAD:refs/heads/feat/v25-pipeline"],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            commit_sha = subprocess.check_output(["git", "-C", str(fixture.repo), "rev-parse", "HEAD"], text=True).strip()
            published = subprocess.run([
                sys.executable, str(ADVANCE), "--state", str(run_dir / "state.json"), "--to", "published",
                "--evidence", "push=origin/feat/v25-pipeline", "--repair-context", str(run_dir / "repair-context.json"),
                "--acceptance-receipt", str(run_dir / "acceptance-receipt.json"), "--commit-sha", commit_sha,
                "--push-mode", "normal",
            ], text=True, capture_output=True)
            self.assertEqual(published.returncode, 0, published.stderr + published.stdout)
            state = json.loads((run_dir / "state.json").read_text())
            self.assertEqual(state["publication"]["publication_tracking_mode"], "explicit_untracked")
            self.assertEqual(state["publication"]["remote_ref"], "refs/heads/feat/v25-pipeline")

    def test_score_of_exactly_80_fails_but_keeps_truthful_report(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            result = fixture.verify(run_dir, 80.0)
            self.assertEqual(result.returncode, 1, result.stderr + result.stdout)
            receipt = json.loads((run_dir / "acceptance-receipt.json").read_text(encoding="utf-8"))
            self.assertFalse(receipt["accepted"])
            self.assertTrue(any("strictly above 80.0" in item for item in receipt["blocking_errors"]))
            self.assertTrue(fixture.report.is_file())
            state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
            self.assertEqual(state["phase"], "acceptance_failed")

    def test_missing_mapped_defect_and_new_defect_fail_acceptance(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            fixture.advance_to_report_updated(run_dir)
            update, verification_path = fixture.evaluation_artifacts(run_dir, 87.5)
            verification = json.loads(verification_path.read_text(encoding="utf-8"))
            verification["mapped_defects"].pop()
            verification["new_defects"] = [{"description": "New semantic QA defect"}]
            write_json(verification_path, verification)
            result = fixture.run_verifier(run_dir, update, verification_path)
            self.assertEqual(result.returncode, 1, result.stderr + result.stdout)
            receipt = json.loads((run_dir / "acceptance-receipt.json").read_text(encoding="utf-8"))
            self.assertTrue(any("mapped-defect verification inventory" in item for item in receipt["blocking_errors"]))
            self.assertTrue(any("new defects" in item for item in receipt["blocking_errors"]))

    def test_nonexistent_adjudication_fails_acceptance(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            fixture.advance_to_report_updated(run_dir)
            update, verification_path = fixture.evaluation_artifacts(run_dir, 87.5)
            verification = json.loads(verification_path.read_text(encoding="utf-8"))
            verification["verification_provenance"]["adjudication_path"] = str(run_dir / "missing-adjudication.json")
            write_json(verification_path, verification)
            result = fixture.run_verifier(run_dir, update, verification_path)
            self.assertEqual(result.returncode, 1, result.stderr + result.stdout)
            receipt = json.loads((run_dir / "acceptance-receipt.json").read_text(encoding="utf-8"))
            self.assertTrue(any("adjudicated artifact does not exist" in item for item in receipt["blocking_errors"]))

    def test_mismatched_adjudication_and_malformed_verification_schema_fail(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            fixture.advance_to_report_updated(run_dir)
            update, verification_path = fixture.evaluation_artifacts(run_dir, 87.5)
            verification = json.loads(verification_path.read_text(encoding="utf-8"))
            adjudication_path = Path(verification["verification_provenance"]["adjudication_path"])
            adjudication = json.loads(adjudication_path.read_text(encoding="utf-8"))
            adjudication["source_hash"] = "f" * 64
            write_json(adjudication_path, adjudication)
            verification.pop("pipeline")
            write_json(verification_path, verification)
            result = fixture.run_verifier(run_dir, update, verification_path)
            self.assertEqual(result.returncode, 1, result.stderr + result.stdout)
            receipt = json.loads((run_dir / "acceptance-receipt.json").read_text(encoding="utf-8"))
            self.assertTrue(any("missing required property 'pipeline'" in item for item in receipt["blocking_errors"]))
            self.assertTrue(any("source_hash mismatch" in item for item in receipt["blocking_errors"]))

    def test_stale_qc_content_hash_and_failed_check_fail_acceptance(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            fixture.advance_to_report_updated(run_dir)
            update, verification_path = fixture.evaluation_artifacts(run_dir, 87.5)
            verification = json.loads(verification_path.read_text(encoding="utf-8"))
            matrix_path = Path(verification["pipeline"]["fresh_qc"]["evidence_matrix_path"])
            matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
            matrix["chapters"][0]["contentHash"] = "0" * 16
            matrix["chapters"][0]["checks"]["confirmRead"] = "CORRUPTION"
            write_json(matrix_path, matrix)
            verification["pipeline"]["fresh_qc"]["evidence_matrix_sha256"] = hashlib.sha256(matrix_path.read_bytes()).hexdigest()
            write_json(verification_path, verification)
            result = fixture.run_verifier(run_dir, update, verification_path)
            self.assertEqual(result.returncode, 1, result.stderr + result.stdout)
            receipt = json.loads((run_dir / "acceptance-receipt.json").read_text(encoding="utf-8"))
            self.assertTrue(any("contentHash is stale" in item for item in receipt["blocking_errors"]))
            self.assertTrue(any("corruption/failure veto" in item for item in receipt["blocking_errors"]))

    def test_forged_receipt_cannot_hide_junk_remediation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            fixture.advance_to_report_updated(run_dir)
            update, verification_path = fixture.evaluation_artifacts(run_dir, 87.5)
            (fixture.outputs / PROMPTS_MD).write_text("forged junk\n", encoding="utf-8")
            verification = json.loads(verification_path.read_text(encoding="utf-8"))
            result = fixture.run_verifier(run_dir, update, verification_path)
            self.assertEqual(result.returncode, 1, result.stderr + result.stdout)
            receipt = json.loads((run_dir / "acceptance-receipt.json").read_text(encoding="utf-8"))
            self.assertTrue(any("not deterministically regenerated" in item for item in receipt["blocking_errors"]))

    def test_updater_receipt_requires_transaction_full_validator_and_exact_mirror_roots(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            fixture.advance_to_report_updated(run_dir)
            update, verification_path = fixture.evaluation_artifacts(run_dir, 87.5)
            verification = json.loads(verification_path.read_text())
            updater_path = Path(verification["report_mirror"]["updater_receipt_path"])
            updater = json.loads(updater_path.read_text())
            updater["transaction_id"] = "forged"
            updater["full_validator"]["candidate_report_html_sha256"] = "0" * 64
            updater["roots"][1]["outputs"][0]["sha256"] = "1" * 64
            write_json(updater_path, updater)
            verification["report_mirror"]["updater_receipt_sha256"] = hashlib.sha256(updater_path.read_bytes()).hexdigest()
            write_json(verification_path, verification)

            # Recompute mutable history so the receipt's own semantic proof, not a stale state hash, rejects it.
            state_path = run_dir / "state.json"
            state = json.loads(state_path.read_text())
            for entry in state["history"]:
                if entry["phase"] == "report_updated":
                    for artifact in entry["artifacts"]:
                        if artifact["label"] == "updater_receipt":
                            artifact["sha256"] = hashlib.sha256(updater_path.read_bytes()).hexdigest()
            previous = None
            for entry in state["history"]:
                entry["previous_entry_sha256"] = previous
                entry["entry_sha256"] = history_entry_sha256(entry)
                previous = entry["entry_sha256"]
            write_json(state_path, state)

            result = fixture.run_verifier(run_dir, update, verification_path)
            self.assertEqual(result.returncode, 1, result.stderr + result.stdout)
            receipt = json.loads((run_dir / "acceptance-receipt.json").read_text())
            joined = "\n".join(receipt["blocking_errors"])
            self.assertIn("transaction_id", joined)
            self.assertIn("full-validator HTML hash", joined)
            self.assertIn("mirror output hash mismatch", joined)

    def test_changed_raw_rater_breaks_recomputed_agreement(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            fixture.advance_to_report_updated(run_dir)
            update, verification_path = fixture.evaluation_artifacts(run_dir, 87.5)
            verification = json.loads(verification_path.read_text(encoding="utf-8"))
            primary_path = Path(verification["blind_raters"]["primary_path"])
            primary = json.loads(primary_path.read_text(encoding="utf-8"))
            first_domain = next(iter(primary["domains"].values()))
            next(iter(first_domain["subcriteria"].values()))["rating"] = 2
            calculate_scores(primary)
            write_json(primary_path, primary)
            verification["blind_raters"]["primary_sha256"] = hashlib.sha256(primary_path.read_bytes()).hexdigest()
            write_json(verification_path, verification)
            result = fixture.run_verifier(run_dir, update, verification_path)
            self.assertEqual(result.returncode, 1, result.stderr + result.stdout)
            receipt = json.loads((run_dir / "acceptance-receipt.json").read_text(encoding="utf-8"))
            self.assertTrue(any("rater_agreement" in item or "disagreement inventory" in item for item in receipt["blocking_errors"]))

    def test_primary_renamed_as_verification_is_rejected_by_worker_pair_seal(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            fixture.advance_to_report_updated(run_dir)
            update, verification_path = fixture.evaluation_artifacts(run_dir, 87.5)
            verification = json.loads(verification_path.read_text())
            primary_path = Path(verification["blind_raters"]["primary_path"])
            renamed_path = Path(verification["blind_raters"]["verification_path"])
            renamed = json.loads(primary_path.read_text())
            renamed["rater_role"] = "verification"
            renamed["job_id"] = "alpha-book--verification"
            dispatch = json.loads(Path(verification["blind_raters"]["verification_dispatch_path"]).read_text())
            renamed["worker_dispatch_receipt_sha256"] = artifact_sha256(dispatch)
            write_json(renamed_path, renamed)
            verification["blind_raters"]["verification_sha256"] = hashlib.sha256(renamed_path.read_bytes()).hexdigest()
            write_json(verification_path, verification)
            state_path = run_dir / "state.json"
            state = json.loads(state_path.read_text())
            for entry in state["history"]:
                if entry["phase"] == "evaluation_complete":
                    for artifact in entry["artifacts"]:
                        if artifact["label"] == "verification":
                            artifact["sha256"] = hashlib.sha256(renamed_path.read_bytes()).hexdigest()
            previous = None
            for entry in state["history"]:
                entry["previous_entry_sha256"] = previous
                entry["entry_sha256"] = history_entry_sha256(entry)
                previous = entry["entry_sha256"]
            write_json(state_path, state)
            result = fixture.run_verifier(run_dir, update, verification_path)
            self.assertEqual(result.returncode, 1, result.stderr + result.stdout)
            receipt = json.loads((run_dir / "acceptance-receipt.json").read_text())
            self.assertTrue(any("pair seal" in item or "worker" in item for item in receipt["blocking_errors"]))

    def test_context_state_and_fork_provenance_cotamper_cannot_reanchor_run(self) -> None:
        """Reproduce the audit exploit, including recomputing every mutable state hash."""
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            fixture.advance_to_report_updated(run_dir)
            update, verification_path = fixture.evaluation_artifacts(run_dir, 87.5)

            context_path = run_dir / "repair-context.json"
            context = json.loads(context_path.read_text(encoding="utf-8"))
            context["repair"]["conditions"] = []
            context["repair"]["condition_ids"] = []
            context["repair"]["condition_count"] = 0
            context["repair"]["mapped_defects"] = []
            context["repair"]["mapped_defect_count"] = 0
            write_json(context_path, context)

            verification = json.loads(verification_path.read_text(encoding="utf-8"))
            verification["conditions"] = []
            verification["mapped_defects"] = []
            write_json(verification_path, verification)

            state_path = run_dir / "state.json"
            state = json.loads(state_path.read_text(encoding="utf-8"))
            state["context_sha256"] = hashlib.sha256(context_path.read_bytes()).hexdigest()
            for entry in state["history"]:
                if entry["phase"] == "evaluator_thread_created":
                    entry["evidence"]["forked"] = "true"
                if entry["phase"] == "evaluation_complete":
                    for artifact in entry["artifacts"]:
                        if artifact["label"] == "book_update":
                            artifact["sha256"] = hashlib.sha256(update.read_bytes()).hexdigest()
            previous = None
            for entry in state["history"]:
                entry["previous_entry_sha256"] = previous
                entry["entry_sha256"] = history_entry_sha256(entry)
                previous = entry["entry_sha256"]
            write_json(state_path, state)

            result = fixture.run_verifier(run_dir, update, verification_path)
            self.assertEqual(result.returncode, 1, result.stderr + result.stdout)
            receipt = json.loads((run_dir / "acceptance-receipt.json").read_text(encoding="utf-8"))
            joined = "\n".join(receipt["blocking_errors"])
            self.assertIn("immutable", joined)
            self.assertIn("forked=false", joined)

    def test_qc_hashes_loose_state_while_candidate_is_stripped_reader_content(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            result = fixture.verify(run_dir, 87.5)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            loose = json.loads((fixture.repo / PIPELINE / "state/chapters/alpha-book-ch01.v21-native.chapter.json").read_text())
            candidate = json.loads((fixture.repo / PIPELINE / "book-packages/alpha-book.v21.json").read_text())["chapters"][0]
            self.assertNotEqual(_chapter_content_hash_v2(loose), _chapter_content_hash_v2(candidate))
            matrix = json.loads((fixture.repo / PIPELINE / "state/qc-orchestrator/alpha-book/round-2/evidence-matrix.json").read_text())
            self.assertEqual(matrix["chapters"][0]["contentHash"], _chapter_content_hash_v2(loose))

    def test_publication_rejects_alternate_receipt_and_post_acceptance_candidate(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            result = fixture.verify(run_dir, 87.5)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            candidate = fixture.repo / PIPELINE / "book-packages/alpha-book.v21.json"
            payload = json.loads(candidate.read_text())
            payload["postAcceptanceTamper"] = True
            write_json(candidate, payload)
            shutil.copyfile(candidate, fixture.repo / "book-packages/alpha-book.v21.json")
            alternate = run_dir / "alternate-acceptance-receipt.json"
            forged = json.loads((run_dir / "acceptance-receipt.json").read_text())
            forged["accepted_candidate_sha256"] = hashlib.sha256(candidate.read_bytes()).hexdigest()
            write_json(alternate, forged)
            paths = [
                "book-packages/alpha-book.v21.json",
                *[f"docs/v25/chapterflow-140-evaluation/{name}" for name in (HTML_NAME, DATA_NAME, PROMPTS_JSON, PROMPTS_MD)],
            ]
            subprocess.run(["git", "-C", str(fixture.repo), "add", "--", *paths], check=True)
            subprocess.run(["git", "-C", str(fixture.repo), "commit", "-m", "forged alternate publication"], check=True, stdout=subprocess.DEVNULL)
            subprocess.run(["git", "-C", str(fixture.repo), "push", "origin", "main"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            commit_sha = subprocess.check_output(["git", "-C", str(fixture.repo), "rev-parse", "HEAD"], text=True).strip()
            published = subprocess.run([
                sys.executable, str(ADVANCE), "--state", str(run_dir / "state.json"), "--to", "published",
                "--evidence", "push=origin/main", "--repair-context", str(run_dir / "repair-context.json"),
                "--acceptance-receipt", str(alternate), "--commit-sha", commit_sha, "--push-mode", "normal",
            ], text=True, capture_output=True)
            self.assertEqual(published.returncode, 2)
            self.assertIn("exact receipt recorded", published.stderr)

    def test_publication_rejects_candidate_tamper_with_original_recorded_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            result = fixture.verify(run_dir, 87.5)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            candidate = fixture.repo / PIPELINE / "book-packages/alpha-book.v21.json"
            payload = json.loads(candidate.read_text())
            payload["postAcceptanceTamper"] = "same forged bytes copied to both locations"
            write_json(candidate, payload)
            shutil.copyfile(candidate, fixture.repo / "book-packages/alpha-book.v21.json")
            current_head = subprocess.check_output(["git", "-C", str(fixture.repo), "rev-parse", "HEAD"], text=True).strip()
            published = subprocess.run([
                sys.executable, str(ADVANCE), "--state", str(run_dir / "state.json"), "--to", "published",
                "--evidence", "push=origin/main", "--repair-context", str(run_dir / "repair-context.json"),
                "--acceptance-receipt", str(run_dir / "acceptance-receipt.json"), "--commit-sha", current_head, "--push-mode", "normal",
            ], text=True, capture_output=True)
            self.assertEqual(published.returncode, 2)
            self.assertIn("nested candidate no longer matches", published.stderr)

    def test_publication_rejects_full_acceptance_state_cotamper_via_git_anchor(self) -> None:
        """Reproduce the auditor exploit after recomputing every mutable terminal proof."""
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            result = fixture.verify(run_dir, 87.5)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            candidate = fixture.repo / PIPELINE / "book-packages/alpha-book.v21.json"
            payload = json.loads(candidate.read_text())
            payload["postAcceptanceTamper"] = "co-tampered terminal proof"
            write_json(candidate, payload)
            shutil.copyfile(candidate, fixture.repo / "book-packages/alpha-book.v21.json")
            forged_hash = hashlib.sha256(candidate.read_bytes()).hexdigest()

            receipt_path = run_dir / "acceptance-receipt.json"
            seal_path = run_dir / "acceptance-seal.json"
            manifest_path = run_dir / "acceptance-manifest.json"
            receipt = json.loads(receipt_path.read_text())
            receipt["accepted_candidate_sha256"] = forged_hash
            write_json(receipt_path, receipt)
            seal = json.loads(seal_path.read_text())
            seal["accepted_candidate_sha256"] = forged_hash
            seal["acceptance_receipt_sha256"] = hashlib.sha256(receipt_path.read_bytes()).hexdigest()
            write_json(seal_path, seal)
            manifest = json.loads(manifest_path.read_text())
            manifest["accepted_candidate_sha256"] = forged_hash
            manifest["acceptance_receipt_sha256"] = hashlib.sha256(receipt_path.read_bytes()).hexdigest()
            manifest["acceptance_seal_sha256"] = hashlib.sha256(seal_path.read_bytes()).hexdigest()
            write_json(manifest_path, manifest)

            state_path = run_dir / "state.json"
            state = json.loads(state_path.read_text())
            state["acceptance"]["receipt_sha256"] = hashlib.sha256(receipt_path.read_bytes()).hexdigest()
            state["acceptance"]["acceptance_seal_sha256"] = hashlib.sha256(seal_path.read_bytes()).hexdigest()
            state["acceptance"]["acceptance_manifest_sha256"] = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
            terminal_hashes = {
                "acceptance_receipt": state["acceptance"]["receipt_sha256"],
                "acceptance_seal": state["acceptance"]["acceptance_seal_sha256"],
                "acceptance_manifest": state["acceptance"]["acceptance_manifest_sha256"],
            }
            for artifact in state["history"][-1]["artifacts"]:
                artifact["sha256"] = terminal_hashes[artifact["label"]]
            previous = None
            for entry in state["history"]:
                entry["previous_entry_sha256"] = previous
                entry["entry_sha256"] = history_entry_sha256(entry)
                previous = entry["entry_sha256"]
            write_json(state_path, state)

            paths = [
                "book-packages/alpha-book.v21.json",
                *[f"docs/v25/chapterflow-140-evaluation/{name}" for name in (HTML_NAME, DATA_NAME, PROMPTS_JSON, PROMPTS_MD)],
            ]
            subprocess.run(["git", "-C", str(fixture.repo), "add", "--", *paths], check=True)
            subprocess.run(["git", "-C", str(fixture.repo), "commit", "-m", "co-tampered terminal publication"], check=True, stdout=subprocess.DEVNULL)
            subprocess.run(["git", "-C", str(fixture.repo), "push", "origin", "main"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            commit_sha = subprocess.check_output(["git", "-C", str(fixture.repo), "rev-parse", "HEAD"], text=True).strip()
            published = subprocess.run([
                sys.executable, str(ADVANCE), "--state", str(state_path), "--to", "published",
                "--evidence", "push=origin/main", "--repair-context", str(run_dir / "repair-context.json"),
                "--acceptance-receipt", str(receipt_path), "--commit-sha", commit_sha, "--push-mode", "normal",
            ], text=True, capture_output=True)
            self.assertEqual(published.returncode, 2)
            self.assertIn("Git-anchored acceptance proof", published.stderr)

    def test_publication_rejects_post_acceptance_report_tamper(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            result = fixture.verify(run_dir, 87.5)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            candidate = fixture.repo / PIPELINE / "book-packages/alpha-book.v21.json"
            shutil.copyfile(candidate, fixture.repo / "book-packages/alpha-book.v21.json")
            snapshot_html = fixture.repo / "docs/v25/chapterflow-140-evaluation" / HTML_NAME
            snapshot_html.write_text(snapshot_html.read_text() + "<!-- post-acceptance tamper -->\n")
            paths = [
                "book-packages/alpha-book.v21.json",
                *[f"docs/v25/chapterflow-140-evaluation/{name}" for name in (HTML_NAME, DATA_NAME, PROMPTS_JSON, PROMPTS_MD)],
            ]
            subprocess.run(["git", "-C", str(fixture.repo), "add", "--", *paths], check=True)
            subprocess.run(["git", "-C", str(fixture.repo), "commit", "-m", "tampered report publication"], check=True, stdout=subprocess.DEVNULL)
            subprocess.run(["git", "-C", str(fixture.repo), "push", "origin", "main"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            commit_sha = subprocess.check_output(["git", "-C", str(fixture.repo), "rev-parse", "HEAD"], text=True).strip()
            published = subprocess.run([
                sys.executable, str(ADVANCE), "--state", str(run_dir / "state.json"), "--to", "published",
                "--evidence", "push=origin/main", "--repair-context", str(run_dir / "repair-context.json"),
                "--acceptance-receipt", str(run_dir / "acceptance-receipt.json"), "--commit-sha", commit_sha, "--push-mode", "normal",
            ], text=True, capture_output=True)
            self.assertEqual(published.returncode, 2)
            self.assertIn("changed after acceptance", published.stderr)


    def test_publication_rejects_retargeted_tracking_remote(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            result = fixture.verify(run_dir, 87.5)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            candidate = fixture.repo / PIPELINE / "book-packages/alpha-book.v21.json"
            shutil.copyfile(candidate, fixture.repo / "book-packages/alpha-book.v21.json")
            paths = [
                "book-packages/alpha-book.v21.json",
                *[f"docs/v25/chapterflow-140-evaluation/{name}" for name in (HTML_NAME, DATA_NAME, PROMPTS_JSON, PROMPTS_MD)],
            ]
            subprocess.run(["git", "-C", str(fixture.repo), "add", "--", *paths], check=True)
            subprocess.run(["git", "-C", str(fixture.repo), "commit", "-m", "valid publication before remote retarget"], check=True, stdout=subprocess.DEVNULL)
            subprocess.run(["git", "-C", str(fixture.repo), "push", "origin", "main"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            commit_sha = subprocess.check_output(["git", "-C", str(fixture.repo), "rev-parse", "HEAD"], text=True).strip()
            fake_remote = Path(temporary) / "fake.git"
            subprocess.run(["git", "init", "--bare", str(fake_remote)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(["git", "-C", str(fixture.repo), "remote", "set-url", "origin", str(fake_remote)], check=True)
            remote_rejected = subprocess.run([
                sys.executable, str(ADVANCE), "--state", str(run_dir / "state.json"), "--to", "published",
                "--evidence", "push=origin/main", "--repair-context", str(run_dir / "repair-context.json"),
                "--acceptance-receipt", str(run_dir / "acceptance-receipt.json"), "--commit-sha", commit_sha, "--push-mode", "normal",
            ], text=True, capture_output=True)
            self.assertEqual(remote_rejected.returncode, 2)
            self.assertIn("frozen configured remote URL", remote_rejected.stderr)

    def test_state_helper_rejects_skipped_transition(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Fixture(Path(temporary))
            run_dir = fixture.load()
            result = subprocess.run([
                sys.executable, str(ADVANCE),
                "--state", str(run_dir / "state.json"),
                "--to", "fresh_qc_passed",
                "--evidence", "qc=pass",
            ], text=True, capture_output=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn("illegal state transition", result.stderr)

    def test_history_bootstrap_requires_exact_rich_roundtrip_and_refuses_collisions(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repo = root / "history-repo"
            repo.mkdir()
            subprocess.run(["git", "-C", str(repo), "init", "-b", "main"], check=True, stdout=subprocess.DEVNULL)
            subprocess.run(["git", "-C", str(repo), "config", "user.name", "Bootstrap Test"], check=True)
            subprocess.run(["git", "-C", str(repo), "config", "user.email", "bootstrap@example.test"], check=True)
            reader = repo / PIPELINE / "src/lib/readerContent.ts"
            reader.parent.mkdir(parents=True, exist_ok=True)
            write_json(repo / PIPELINE / "package.json", {"type": "module"})
            reader.write_text(
                "export function stripInternalFields(chapter:any){const value=JSON.parse(JSON.stringify(chapter));delete value.schemaVersion;delete value.authoring;return value;}\n",
                encoding="utf-8",
            )
            rich_chapters = [
                {"schemaVersion": "chapterflow-v21-authored", "chapterId": f"history-book-ch{index:02d}", "number": index, "title": f"Chapter {index}", "hook": f"Hook {index}", "authoring": {"session": "rich"}}
                for index in (1, 2)
            ]
            rich = {"book": {"bookId": "history-book", "title": "History Book"}, "chapters": rich_chapters}
            outer = repo / "book-packages/history-book.v21.json"
            write_json(outer, rich)
            subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-m", "rich author state"], check=True, stdout=subprocess.DEVNULL)
            rich_commit = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
            slim = {"book": rich["book"], "chapters": [{key: value for key, value in chapter.items() if key not in {"schemaVersion", "authoring"}} for chapter in rich_chapters]}
            write_json(outer, slim)
            subprocess.run(["git", "-C", str(repo), "add", str(outer)], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-m", "ship slim package"], check=True, stdout=subprocess.DEVNULL)
            outer_hash = hashlib.sha256(outer.read_bytes()).hexdigest()

            preflight = root / "preflight.json"
            command = [
                sys.executable, str(BOOTSTRAP), "--repo-root", str(repo), "--book-id", "history-book",
                "--recovered-commit", rich_commit, "--manifest", str(preflight),
            ]
            bootstrap_env = {**os.environ, "CHAPTERFLOW_TSX_BIN": "/Users/radinsoltani/ChapterFlow-books/node_modules/.bin/tsx"}
            planned = subprocess.run(command, text=True, capture_output=True, env=bootstrap_env)
            self.assertEqual(planned.returncode, 0, planned.stderr + planned.stdout)
            self.assertFalse((repo / PIPELINE / "state/indexes/history-book.json").exists())
            applied_manifest = root / "applied.json"
            applied = subprocess.run([*command[:-1], str(applied_manifest), "--apply"], text=True, capture_output=True, env=bootstrap_env)
            self.assertEqual(applied.returncode, 0, applied.stderr + applied.stdout)
            loose = json.loads((repo / PIPELINE / "state/chapters/history-book-ch01.v21-native.chapter.json").read_text())
            self.assertEqual(loose["schemaVersion"], "chapterflow-v21-authored")
            self.assertIn("authoring", loose)
            self.assertEqual(hashlib.sha256(outer.read_bytes()).hexdigest(), outer_hash)
            manifest = json.loads(applied_manifest.read_text())
            self.assertFalse(manifest["source_evidence_imported"])
            self.assertFalse(manifest["qc_imported"])
            collision = subprocess.run([*command[:-1], str(root / "collision.json"), "--apply"], text=True, capture_output=True, env=bootstrap_env)
            self.assertEqual(collision.returncode, 2)
            self.assertIn("collision", collision.stderr)


if __name__ == "__main__":
    unittest.main()
