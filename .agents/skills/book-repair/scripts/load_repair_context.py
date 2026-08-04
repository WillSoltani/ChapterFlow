#!/usr/bin/env python3
"""Load one exact remediation prompt and freeze a reproducible repair run context."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from repair_common import (
    RepairError,
    atomic_write_json,
    atomic_write_text,
    history_entry_sha256,
    exact_book,
    mapping,
    read_json,
    report_data_from_html,
    resolve_local_path,
    sequence,
    sha256_file,
    sha256_text,
)


PIPELINE_RELATIVE = Path("scripts/book/prompts/chapterflow-v24-author-pipeline")
AUTHORITY_RELATIVE = (
    Path("AGENTS.md"),
    Path("CLAUDE.md"),
    PIPELINE_RELATIVE / "AGENTS.md",
    PIPELINE_RELATIVE / "agent-prompts/STEP-2-WRITE-CHAPTERS.md",
    PIPELINE_RELATIVE / "src/qc/orchestrator/repairBrief.ts",
    PIPELINE_RELATIVE / "src/lib/readerContent.ts",
    PIPELINE_RELATIVE / "src/critics/machineryPhrases.ts",
    PIPELINE_RELATIVE / "src/critics/qcAttestation.ts",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _git(repo: Path, *arguments: str) -> str | None:
    result = subprocess.run(
        ["git", "-C", str(repo), *arguments],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=False,
    )
    if result.returncode:
        return None
    return result.stdout.rstrip("\n")


def _prompt_payload(book: Mapping[str, Any], *, source: str) -> dict[str, Any]:
    remediation = mapping(book.get("remediation"))
    prompt = remediation.get("prompt_markdown")
    if not isinstance(prompt, str) or not prompt.strip():
        raise RepairError(f"book in {source} has no non-empty remediation.prompt_markdown")
    conditions = sequence(remediation.get("conditions"))
    declared = remediation.get("condition_count")
    if not isinstance(declared, int) or isinstance(declared, bool) or declared != len(conditions):
        raise RepairError(f"condition_count does not match conditions in {source}")
    ids = []
    for condition in conditions:
        if not isinstance(condition, Mapping) or not str(condition.get("id") or ""):
            raise RepairError(f"every remediation condition in {source} must have an id")
        ids.append(str(condition["id"]))
    if len(ids) != len(set(ids)):
        raise RepairError(f"duplicate remediation condition ids in {source}")
    return {
        "book": dict(book),
        "remediation": dict(remediation),
        "prompt": prompt,
        "condition_ids": ids,
    }


def _canonical_companion(report_path: Path) -> Path:
    name = report_path.name
    suffix = "-evaluation-report.html"
    if name.endswith(suffix):
        return report_path.with_name(name[: -len(suffix)] + "-remediation-prompts.json")
    return report_path.with_name(report_path.stem + "-remediation-prompts.json")


def _report_data_companion(report_path: Path) -> Path:
    return report_path.with_name(report_path.stem + "-data.json")


def _baseline_report_data(report_path: Path) -> Mapping[str, Any]:
    if report_path.suffix.casefold() in {".html", ".htm"}:
        embedded = report_data_from_html(report_path)
        companion = _report_data_companion(report_path)
        if companion.is_file():
            external = read_json(companion)
            if external != embedded:
                raise RepairError("report HTML embedded data differs from its adjacent report-data JSON")
        return embedded
    value = read_json(report_path)
    if not isinstance(value, Mapping):
        raise RepairError("baseline report data must be a JSON object")
    return value


def _qa_text(value: Any) -> str:
    if isinstance(value, str):
        return " ".join(value.split())
    if isinstance(value, Mapping):
        for key in ("description", "finding", "text", "message"):
            if str(value.get(key) or "").strip():
                return " ".join(str(value[key]).split())
    return ""


def _mapped_defects(baseline: Mapping[str, Any], remediation: Mapping[str, Any]) -> list[dict[str, Any]]:
    defects: list[dict[str, Any]] = []
    gates = mapping(baseline.get("gates"))
    for key in ("technical", "epistemic", "ethics", "purpose_audience"):
        if key not in gates:
            continue
        status = str(gates.get(key) or "").strip().replace("_", " ")
        if status.casefold() == "pass":
            continue
        note = str(gates.get("note") or "").strip()
        text = f"{key.replace('_', ' ').title()} gate: {status or 'missing status'}"
        if note:
            text += f". {note}"
        defects.append({
            "id": f"G-{key.replace('_', '-').upper()}",
            "type": "gate",
            "gate": key,
            "status": status,
            "text": text,
        })

    qa_sources: list[tuple[str, Any]] = [("baseline.qa", value) for value in sequence(baseline.get("qa"))]
    for workstream in sequence(remediation.get("workstreams")):
        if not isinstance(workstream, Mapping):
            continue
        qa_sources.extend(("remediation.workstream.qa_findings", value) for value in sequence(workstream.get("qa_findings")))
    unique: dict[str, dict[str, Any]] = {}
    for source, raw in qa_sources:
        text = _qa_text(raw)
        if not text:
            continue
        normalized = text.casefold()
        if normalized not in unique:
            digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12].upper()
            unique[normalized] = {"id": f"Q-{digest}", "type": "qa", "text": text, "sources": [source]}
        elif source not in unique[normalized]["sources"]:
            unique[normalized]["sources"].append(source)
    defects.extend(unique[key] for key in sorted(unique))
    return defects


def _load_prompt(
    report_path: Path,
    book_id: str,
    explicit_prompt_data: Path | None,
) -> tuple[dict[str, Any], str, Path | None]:
    if explicit_prompt_data is not None:
        value = read_json(explicit_prompt_data)
        if not isinstance(value, Mapping):
            raise RepairError("prompt data must be a JSON object")
        return _prompt_payload(exact_book(value, book_id), source=str(explicit_prompt_data)), "companion_json", explicit_prompt_data

    if report_path.suffix.casefold() not in {".html", ".htm"}:
        value = read_json(report_path)
        if not isinstance(value, Mapping):
            raise RepairError("prompt/report data must be a JSON object")
        return _prompt_payload(exact_book(value, book_id), source=str(report_path)), "json", report_path

    canonical = _canonical_companion(report_path).resolve()
    if canonical.is_file():
        value = read_json(canonical)
        if not isinstance(value, Mapping):
            raise RepairError(f"canonical remediation companion must be a JSON object: {canonical}")
        payload = _prompt_payload(exact_book(value, book_id), source=str(canonical))
        return payload, "companion_json", canonical

    candidates = []
    candidates.extend(sorted(report_path.parent.glob("*remediation-prompts.json")))
    seen: set[Path] = set()
    matching: list[tuple[Path, dict[str, Any]]] = []
    for candidate in candidates:
        candidate = candidate.resolve()
        if candidate in seen or not candidate.is_file():
            continue
        seen.add(candidate)
        value = read_json(candidate)
        if not isinstance(value, Mapping):
            continue
        try:
            payload = _prompt_payload(exact_book(value, book_id), source=str(candidate))
        except RepairError:
            continue
        matching.append((candidate, payload))
    if matching:
        chosen = matching[0]
        fingerprints = {
            sha256_text(json.dumps(item[1]["remediation"], ensure_ascii=False, sort_keys=True, separators=(",", ":")))
            for item in matching
        }
        if len(fingerprints) != 1:
            names = ", ".join(str(item[0]) for item in matching)
            raise RepairError(f"conflicting remediation companions contain {book_id!r}: {names}")
        return chosen[1], "companion_json", chosen[0]

    embedded = report_data_from_html(report_path)
    return _prompt_payload(exact_book(embedded, book_id), source=f"{report_path}#report-data"), "embedded_html", None


def _validate_book_id(value: str) -> str:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
        raise RepairError("book id must be an exact lowercase hyphenated id")
    return value


def _validate_publication_ref(repo: Path, value: str) -> str:
    candidate = value.strip()
    if not candidate.startswith("refs/heads/") or _git(repo, "check-ref-format", candidate) is None:
        raise RepairError("--publication-ref must be a valid full refs/heads/<branch> ref")
    return candidate


def create_context(args: argparse.Namespace) -> tuple[Path, dict[str, Any], dict[str, Any]]:
    book_id = _validate_book_id(args.book_id)
    repo = resolve_local_path(args.repo_root)
    report_path = resolve_local_path(args.report)
    prompt_path = resolve_local_path(args.prompt_data) if args.prompt_data else None
    if not repo.is_dir():
        raise RepairError(f"repository root is not a directory: {repo}")
    if not report_path.is_file():
        raise RepairError(f"report does not exist: {report_path}")

    missing_authorities = [str(repo / relative) for relative in AUTHORITY_RELATIVE if not (repo / relative).is_file()]
    if missing_authorities:
        raise RepairError("required pipeline authorities are missing: " + ", ".join(missing_authorities))

    payload, prompt_mode, selected_prompt_path = _load_prompt(report_path, book_id, prompt_path)
    baseline_report = _baseline_report_data(report_path)
    baseline_books = [item for item in sequence(baseline_report.get("books")) if isinstance(item, Mapping)]
    baseline_ids = [str(item.get("id") or item.get("book_id") or "") for item in baseline_books]
    if len(baseline_books) != 140 or len(set(baseline_ids)) != 140 or any(not item for item in baseline_ids):
        raise RepairError("baseline portfolio must contain exactly 140 uniquely identified books")
    baseline_book = exact_book(baseline_report, book_id)
    baseline_remediation = mapping(baseline_book.get("remediation"))
    if baseline_remediation != payload["remediation"]:
        raise RepairError("baseline report remediation differs from the selected prompt-pack remediation")
    book = payload["book"]
    source_file = str(book.get("source_file") or book.get("file") or f"{book_id}.v21.json")
    if Path(source_file).name != source_file:
        raise RepairError(f"unsafe source_file in report: {source_file!r}")
    baseline_package_path = (repo / "book-packages" / source_file).resolve()
    candidate_package_path = (repo / PIPELINE_RELATIVE / "book-packages" / source_file).resolve()
    if not baseline_package_path.is_file():
        raise RepairError(f"shipped baseline package does not exist: {baseline_package_path}")
    package = read_json(baseline_package_path)
    if not isinstance(package, Mapping):
        raise RepairError("source package must be a JSON object")
    package_id = str(mapping(package.get("book")).get("bookId") or package.get("book_id") or "")
    if package_id != book_id:
        raise RepairError(f"source package book id mismatch: expected {book_id!r}, got {package_id!r}")
    chapters = sequence(package.get("chapters"))
    if not chapters or any(not isinstance(item, Mapping) for item in chapters):
        raise RepairError("source package must contain a non-empty object chapter list")

    now = utc_now()
    run_id = args.run_id or f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", run_id):
        raise RepairError("run id contains unsupported characters")
    output_root = resolve_local_path(args.output_root) if args.output_root else repo / "artifacts/book-repair"
    run_dir = output_root / book_id / run_id
    try:
        run_dir.resolve().relative_to(repo.resolve())
    except ValueError as exc:
        raise RepairError("repair run artifacts must remain inside the repository so the immutable seal can be anchored in Git") from exc
    if run_dir.exists():
        raise RepairError(f"repair run already exists: {run_dir}")

    prompt = payload["prompt"]
    context_path = run_dir / "repair-context.json"
    state_path = run_dir / "state.json"
    prompt_output = run_dir / "repair-prompt.md"
    baseline_report_output = run_dir / "baseline-report-data.json"
    context_seal_path = run_dir / "context-seal.json"
    git_status = _git(repo, "status", "--porcelain=v1")
    mapped_defects = _mapped_defects(baseline_book, payload["remediation"])
    branch = _git(repo, "branch", "--show-current")
    if not branch:
        raise RepairError("repository must have a checked-out branch before a repair run is frozen")
    upstream = _git(repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
    upstream_tracking_ref = _git(repo, "rev-parse", "--symbolic-full-name", "@{upstream}")
    explicit_remote = str(args.publication_remote or "").strip()
    explicit_ref_raw = str(args.publication_ref or "").strip()
    if bool(explicit_remote) != bool(explicit_ref_raw):
        raise RepairError("--publication-remote and --publication-ref must be supplied together")
    if explicit_remote and not args.push_authorized_by_user:
        raise RepairError("an explicit publication target requires current --push-authorized-by-user authority")
    if upstream or upstream_tracking_ref:
        if explicit_remote:
            raise RepairError("tracked branches must use their existing upstream; explicit publication overrides are only for untracked branches")
        publication_tracking_mode = "tracked_upstream"
        tracking_remote = _git(repo, "config", "--get", f"branch.{branch}.remote")
        remote_ref = _git(repo, "config", "--get", f"branch.{branch}.merge")
        remote_url = _git(repo, "remote", "get-url", tracking_remote) if tracking_remote else None
        remote_row = _git(repo, "ls-remote", "--exit-code", tracking_remote, remote_ref) if tracking_remote and remote_ref else None
        remote_commit = remote_row.split()[0] if remote_row and remote_row.split() else None
        if any(not value for value in (upstream, upstream_tracking_ref, tracking_remote, remote_ref, remote_url, remote_commit)):
            raise RepairError("tracked branch upstream is incomplete or its exact remote ref is unreachable")
    else:
        if not explicit_remote:
            raise RepairError("untracked branch requires explicit --publication-remote and --publication-ref with current push authority")
        if explicit_remote == ".":
            raise RepairError("--publication-remote must name a configured non-local remote, not '.'")
        remote_ref = _validate_publication_ref(repo, explicit_ref_raw)
        remote_url = _git(repo, "remote", "get-url", explicit_remote)
        if not remote_url:
            raise RepairError("--publication-remote must name a configured remote with a URL")
        if _git(repo, "ls-remote", explicit_remote) is None:
            raise RepairError("explicit publication remote is not reachable")
        configured_remote = _git(repo, "config", "--get", f"branch.{branch}.remote")
        configured_ref = _git(repo, "config", "--get", f"branch.{branch}.merge")
        if (configured_remote is None) != (configured_ref is None):
            raise RepairError("untracked branch has a partial upstream configuration")
        if configured_remote is not None and (configured_remote != explicit_remote or configured_ref != remote_ref):
            raise RepairError("explicit publication target conflicts with the branch's configured remote/ref")
        remote_row = _git(repo, "ls-remote", explicit_remote, remote_ref)
        if remote_row is None:
            raise RepairError("could not inspect the explicit publication ref")
        remote_parts = remote_row.split()
        if remote_parts and (len(remote_parts) != 2 or remote_parts[1] != remote_ref):
            raise RepairError("explicit publication ref lookup returned an ambiguous or wrong ref")
        publication_tracking_mode = "explicit_untracked"
        tracking_remote = explicit_remote
        remote_commit = remote_parts[0] if remote_parts else None
        if remote_commit and _git(repo, "cat-file", "-e", f"{remote_commit}^{{commit}}") is None:
            raise RepairError("existing explicit publication ref must be fetched locally before the repair run is frozen")
    context = {
        "schema_version": "1.0.0",
        "run_id": run_id,
        "created_at_utc": now,
        "book_id": book_id,
        "title": str(book.get("title") or mapping(package.get("book")).get("title") or ""),
        "repository": {
            "root": str(repo),
            "head": _git(repo, "rev-parse", "HEAD"),
            "branch": branch,
            "upstream": upstream,
            "upstream_tracking_ref": upstream_tracking_ref,
            "tracking_remote": tracking_remote,
            "remote_ref": remote_ref,
            "remote_url": remote_url,
            "remote_commit_at_freeze": remote_commit,
            "publication_tracking_mode": publication_tracking_mode,
            "remote_ref_existed_at_freeze": remote_commit is not None,
            "initial_status_porcelain": git_status.splitlines() if git_status else [],
        },
        "source": {
            "baseline_package_path": str(baseline_package_path),
            "baseline_package_sha256": sha256_file(baseline_package_path),
            "baseline_chapter_count": len(chapters),
            "candidate_package_path": str(candidate_package_path),
            "candidate_initial_sha256": sha256_file(candidate_package_path) if candidate_package_path.is_file() else None,
        },
        "report": {
            "path": str(report_path),
            "sha256": sha256_file(report_path),
            "prompt_source_mode": prompt_mode,
            "prompt_source_path": str(selected_prompt_path) if selected_prompt_path else f"{report_path}#report-data",
            "prompt_source_sha256": sha256_file(selected_prompt_path) if selected_prompt_path else sha256_file(report_path),
            "baseline_data_path": str(baseline_report_output),
            "baseline_data_sha256": None,
        },
        "repair": {
            "prompt_path": str(prompt_output),
            "prompt_sha256": sha256_text(prompt),
            "condition_count": len(payload["condition_ids"]),
            "condition_ids": payload["condition_ids"],
            "conditions": payload["remediation"]["conditions"],
            "mapped_defect_count": len(mapped_defects),
            "mapped_defects": mapped_defects,
        },
        "pipeline": {
            "working_directory": str(repo / PIPELINE_RELATIVE),
            "authority_files": [
                {"path": str(repo / relative), "sha256": sha256_file(repo / relative)}
                for relative in AUTHORITY_RELATIVE
            ],
        },
        "context_seal_path": str(context_seal_path),
        "authorizations": {
            "new_evaluator_thread": bool(args.new_thread_authorized_by_user),
            "git_push": bool(args.push_authorized_by_user),
        },
    }
    genesis = {"phase": "context_loaded", "at_utc": now, "previous_entry_sha256": None}
    genesis["entry_sha256"] = history_entry_sha256(genesis)
    state = {
        "schema_version": "1.0.0",
        "run_id": run_id,
        "book_id": book_id,
        "phase": "context_loaded",
        "created_at_utc": now,
        "updated_at_utc": now,
        "context_path": str(context_path),
        "context_sha256": None,
        "context_seal_path": str(context_seal_path),
        "context_seal_sha256": None,
        "repair_prompt_path": str(prompt_output),
        "repair_prompt_sha256": sha256_text(prompt),
        "authorizations": {
            "new_evaluator_thread": bool(args.new_thread_authorized_by_user),
            "git_push": bool(args.push_authorized_by_user),
        },
        "history": [genesis],
    }
    atomic_write_text(prompt_output, prompt)
    atomic_write_json(baseline_report_output, baseline_report)
    context["report"]["baseline_data_sha256"] = sha256_file(baseline_report_output)
    atomic_write_json(context_path, context)
    state["context_sha256"] = sha256_file(context_path)
    context_seal = {
        "schema_version": "1.0.0",
        "run_id": run_id,
        "book_id": book_id,
        "created_at_utc": now,
        "context_path": str(context_path),
        "context_sha256": state["context_sha256"],
        "repair_prompt_path": str(prompt_output),
        "repair_prompt_sha256": sha256_file(prompt_output),
        "baseline_report_data_path": str(baseline_report_output),
        "baseline_report_data_sha256": context["report"]["baseline_data_sha256"],
        "state_genesis_entry_sha256": genesis["entry_sha256"],
        "repository_binding": {
            "root": str(repo),
            "branch": branch,
            "upstream": upstream,
            "upstream_tracking_ref": upstream_tracking_ref,
            "tracking_remote": tracking_remote,
            "remote_ref": remote_ref,
            "remote_url": remote_url,
            "remote_commit_at_freeze": remote_commit,
            "publication_tracking_mode": publication_tracking_mode,
            "remote_ref_existed_at_freeze": remote_commit is not None,
        },
        "authorizations": dict(context["authorizations"]),
        "git_anchor_ref": f"refs/chapterflow/book-repair-seals/{book_id}/{run_id}",
    }
    atomic_write_json(context_seal_path, context_seal)
    seal_blob_oid = _git(repo, "hash-object", "-w", str(context_seal_path))
    tree_result = subprocess.run(
        ["git", "-C", str(repo), "mktree"],
        input=f"100644 blob {seal_blob_oid}\tcontext-seal.json\n" if seal_blob_oid else "",
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, check=False,
    )
    tree_oid = tree_result.stdout.strip() if tree_result.returncode == 0 else ""
    commit_result = subprocess.run(
        ["git", "-C", str(repo), "commit-tree", tree_oid],
        input=f"Anchor ChapterFlow book-repair context {book_id}/{run_id}\n",
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, check=False,
    ) if tree_oid else None
    seal_oid = commit_result.stdout.strip() if commit_result is not None and commit_result.returncode == 0 else ""
    seal_ref = str(context_seal["git_anchor_ref"])
    anchored = _git(repo, "update-ref", "--create-reflog", seal_ref, seal_oid, "0" * 40) if seal_oid else None
    if not seal_blob_oid or not seal_oid or anchored is None:
        raise RepairError("could not create the immutable content-addressed Git seal anchor")
    state["context_seal_sha256"] = sha256_file(context_seal_path)
    state["context_seal_git_ref"] = seal_ref
    state["context_seal_git_oid"] = seal_oid
    state["context_seal_blob_oid"] = seal_blob_oid
    atomic_write_json(state_path, state)
    return run_dir, context, state


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True, help="Local report HTML, report JSON, or file:// URL")
    parser.add_argument("--book-id", required=True)
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--prompt-data", help="Explicit remediation-prompts JSON; bypasses companion discovery")
    parser.add_argument("--output-root", help="Defaults to <repo>/artifacts/book-repair")
    parser.add_argument("--run-id")
    parser.add_argument("--new-thread-authorized-by-user", action="store_true")
    parser.add_argument("--push-authorized-by-user", action="store_true")
    parser.add_argument("--publication-remote", help="Configured remote name for an untracked branch; requires --publication-ref and current push authority")
    parser.add_argument("--publication-ref", help="Full refs/heads/<branch> target for an untracked branch; requires --publication-remote")
    return parser.parse_args()


def main() -> int:
    try:
        run_dir, context, state = create_context(parse_args())
    except (RepairError, OSError) as exc:
        print(f"book-repair context error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({
        "run_dir": str(run_dir),
        "book_id": context["book_id"],
        "conditions": context["repair"]["condition_count"],
        "mapped_defects": context["repair"]["mapped_defect_count"],
        "baseline_chapters": context["source"]["baseline_chapter_count"],
        "candidate_package": context["source"]["candidate_package_path"],
        "new_evaluator_thread_authorized": state["authorizations"]["new_evaluator_thread"],
        "git_push_authorized": state["authorizations"]["git_push"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
