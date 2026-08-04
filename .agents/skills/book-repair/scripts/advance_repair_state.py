#!/usr/bin/env python3
"""Advance a book-repair run through one legal, evidence-backed state transition."""

from __future__ import annotations

import argparse
import copy
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from repair_common import (
    RepairError,
    atomic_write_json,
    history_entry_sha256,
    mapping,
    read_json,
    resolve_local_path,
    sequence,
    sha256_file,
    validate_history_chain,
)


NEXT = {
    "context_loaded": {"repairing"},
    "repairing": {"repair_complete"},
    "repair_complete": {"fresh_qc_passed"},
    "fresh_qc_passed": {"evaluator_thread_created"},
    "evaluator_thread_created": {"evaluation_complete"},
    "evaluation_complete": {"report_updated"},
    "report_updated": set(),  # acceptance is set only by verify_repair_outcome.py
    "acceptance_passed": {"published"},
    "acceptance_failed": set(),
    "published": set(),
}
PHASE_REQUIREMENTS = {
    "repairing": ({"writer_session_id"}, set()),
    "repair_complete": (set(), {"repair_handback", "deterministic_log"}),
    "fresh_qc_passed": ({"round_id", "qc_session_id", "author_session_id"}, {"evidence_matrix"}),
    "evaluator_thread_created": ({"thread_id", "project_id", "forked"}, set()),
    "evaluation_complete": (set(), {"primary", "verification", "primary_dispatch", "verification_dispatch", "blind_pair_seal", "adjudicated", "book_update"}),
    "report_updated": (set(), {"updater_receipt", "report_html"}),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pairs(values: list[str], label: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for value in values:
        if "=" not in value:
            raise RepairError(f"{label} must use key=value: {value!r}")
        key, content = value.split("=", 1)
        key, content = key.strip(), content.strip()
        if not key or not content or key in result:
            raise RepairError(f"invalid or duplicate {label}: {value!r}")
        result[key] = content
    return result


def _validate_frozen_seal(state_path: Path, state: Mapping[str, Any]) -> tuple[Path, Mapping[str, Any]]:
    """Resolve the run seal independently of mutable state and validate its anchor."""
    context_path = (state_path.parent / "repair-context.json").resolve()
    seal_path = (state_path.parent / "context-seal.json").resolve()
    if resolve_local_path(str(state.get("context_path") or "")) != context_path:
        raise RepairError("state context path differs from the canonical sealed run path")
    if resolve_local_path(str(state.get("context_seal_path") or "")) != seal_path:
        raise RepairError("state context-seal path differs from the canonical sealed run path")
    if not seal_path.is_file():
        raise RepairError("immutable context seal is missing")
    if sha256_file(seal_path) != str(state.get("context_seal_sha256") or ""):
        raise RepairError("state context-seal hash is invalid")
    seal = read_json(seal_path)
    if not isinstance(seal, Mapping):
        raise RepairError("context seal must be a JSON object")
    repo_probe = subprocess.run(
        ["git", "-C", str(state_path.parent), "rev-parse", "--show-toplevel"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
    )
    if repo_probe.returncode:
        raise RepairError("repair run is not inside the repository that owns its Git seal")
    repository = Path(repo_probe.stdout.strip()).resolve()
    book_id = state_path.parent.parent.name
    run_id = state_path.parent.name
    seal_ref = f"refs/chapterflow/book-repair-seals/{book_id}/{run_id}"
    if seal.get("git_anchor_ref") != seal_ref:
        raise RepairError("context seal Git ref is not derived from the canonical run path")
    anchored = subprocess.run(
        ["git", "-C", str(repository), "show", f"{seal_ref}:context-seal.json"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    if anchored.returncode or anchored.stdout != seal_path.read_bytes():
        raise RepairError("context seal differs from its immutable content-addressed Git anchor")
    seal_oid = subprocess.run(
        ["git", "-C", str(repository), "rev-parse", seal_ref],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
    )
    if seal_oid.returncode or seal_oid.stdout.strip() != str(state.get("context_seal_git_oid") or ""):
        raise RepairError("state does not match the Git-anchored context seal object")
    blob_oid = subprocess.run(
        ["git", "-C", str(repository), "rev-parse", f"{seal_ref}:context-seal.json"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
    )
    if blob_oid.returncode or blob_oid.stdout.strip() != str(state.get("context_seal_blob_oid") or ""):
        raise RepairError("state does not match the Git-anchored context seal blob")
    reflog = subprocess.run(
        ["git", "-C", str(repository), "reflog", "show", "--format=%H", seal_ref],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
    )
    if reflog.returncode or reflog.stdout.splitlines() != [seal_oid.stdout.strip()]:
        raise RepairError("context seal Git ref was rewritten after its one-time creation")
    if resolve_local_path(str(seal.get("context_path") or "")) != context_path:
        raise RepairError("context seal points at a different repair context")
    if not context_path.is_file() or sha256_file(context_path) != str(seal.get("context_sha256") or ""):
        raise RepairError("repair context differs from the immutable context seal")
    context = read_json(context_path)
    if not isinstance(context, Mapping):
        raise RepairError("sealed repair context must be a JSON object")
    if mapping(state.get("authorizations")) != mapping(context.get("authorizations")) or mapping(state.get("authorizations")) != mapping(seal.get("authorizations")):
        raise RepairError("state authorizations differ from the immutable sealed user-authority record")
    if str(state.get("context_sha256") or "") != str(seal.get("context_sha256") or ""):
        raise RepairError("state tried to re-anchor a different repair context")
    if str(seal.get("run_id") or "") != str(state.get("run_id") or "") or str(seal.get("book_id") or "") != str(state.get("book_id") or ""):
        raise RepairError("context seal does not belong to this repair state")
    history_errors = validate_history_chain(
        sequence(state.get("history")),
        genesis_sha256=str(seal.get("state_genesis_entry_sha256") or ""),
    )
    if history_errors:
        raise RepairError("invalid state history hash chain: " + "; ".join(history_errors))
    for entry in sequence(state.get("history")):
        phase = str(mapping(entry).get("phase") or "unknown")
        for raw_artifact in sequence(mapping(entry).get("artifacts")):
            artifact = mapping(raw_artifact)
            raw_path = str(artifact.get("path") or "")
            path = resolve_local_path(raw_path) if raw_path else Path("/__missing_phase_artifact__")
            if not path.is_file() or sha256_file(path) != str(artifact.get("sha256") or ""):
                raise RepairError(f"typed phase artifact is missing or changed: {phase}/{artifact.get('label')}")
    return context_path, seal


def _publication_checks(
    state: Mapping[str, Any],
    context_path: Path,
    seal: Mapping[str, Any],
    receipt_path: Path,
    commit_sha: str,
) -> dict[str, Any]:
    if mapping(state.get("authorizations")).get("git_push") is not True:
        raise RepairError("state does not record explicit user push authority")
    if not re.fullmatch(r"[0-9a-fA-F]{40}", commit_sha):
        raise RepairError("--commit-sha must be a full 40-character Git commit hash")
    sealed_context = resolve_local_path(str(seal.get("context_path") or ""))
    if context_path.resolve() != sealed_context:
        raise RepairError("supplied repair context is not the immutable sealed context")
    acceptance = mapping(state.get("acceptance"))
    recorded_receipt_raw = str(acceptance.get("receipt_path") or "")
    recorded_receipt = resolve_local_path(recorded_receipt_raw) if recorded_receipt_raw else Path("/__missing_acceptance_receipt__")
    if receipt_path.resolve() != recorded_receipt or not receipt_path.is_file():
        raise RepairError("supplied acceptance receipt is not the exact receipt recorded by the verifier")
    if sha256_file(receipt_path) != str(acceptance.get("receipt_sha256") or ""):
        raise RepairError("acceptance receipt changed after verification")
    acceptance_seal_path = (receipt_path.parent / "acceptance-seal.json").resolve()
    if resolve_local_path(str(acceptance.get("acceptance_seal_path") or "")) != acceptance_seal_path or not acceptance_seal_path.is_file():
        raise RepairError("canonical acceptance seal is missing")
    if sha256_file(acceptance_seal_path) != str(acceptance.get("acceptance_seal_sha256") or ""):
        raise RepairError("acceptance seal changed after verification")
    acceptance_seal = read_json(acceptance_seal_path)
    if not isinstance(acceptance_seal, Mapping):
        raise RepairError("acceptance seal must be a JSON object")
    if acceptance_seal.get("acceptance_receipt_path") != str(receipt_path.resolve()) or acceptance_seal.get("acceptance_receipt_sha256") != sha256_file(receipt_path):
        raise RepairError("acceptance seal is not bound to the exact verifier receipt")
    context = read_json(context_path)
    receipt = read_json(receipt_path)
    if not isinstance(context, Mapping) or not isinstance(receipt, Mapping):
        raise RepairError("repair context and acceptance receipt must be JSON objects")
    repository = resolve_local_path(str(mapping(context.get("repository")).get("root") or ""))
    manifest_path = (receipt_path.parent / "acceptance-manifest.json").resolve()
    expected_acceptance_ref = f"refs/chapterflow/book-repair-acceptance/{context_path.parent.parent.name}/{context_path.parent.name}"
    if resolve_local_path(str(acceptance.get("acceptance_manifest_path") or "")) != manifest_path or not manifest_path.is_file():
        raise RepairError("canonical acceptance manifest is missing")
    if sha256_file(manifest_path) != str(acceptance.get("acceptance_manifest_sha256") or ""):
        raise RepairError("acceptance manifest changed after verification")
    if acceptance.get("acceptance_git_ref") != expected_acceptance_ref:
        raise RepairError("acceptance Git ref is not derived from the canonical run path")
    anchored_files = {
        "acceptance-manifest.json": manifest_path,
        "acceptance-receipt.json": receipt_path.resolve(),
        "acceptance-seal.json": acceptance_seal_path,
    }
    for name, path in anchored_files.items():
        anchored = subprocess.run(
            ["git", "-C", str(repository), "show", f"{expected_acceptance_ref}:{name}"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
        )
        if anchored.returncode or anchored.stdout != path.read_bytes():
            raise RepairError(f"{name} differs from the immutable Git-anchored acceptance proof")
    acceptance_oid = subprocess.run(
        ["git", "-C", str(repository), "rev-parse", expected_acceptance_ref],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
    )
    if acceptance_oid.returncode or acceptance_oid.stdout.strip() != str(acceptance.get("acceptance_git_oid") or ""):
        raise RepairError("state acceptance commit OID differs from the derived Git anchor")
    acceptance_tree = subprocess.run(
        ["git", "-C", str(repository), "rev-parse", f"{expected_acceptance_ref}^{{tree}}"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
    )
    if acceptance_tree.returncode or acceptance_tree.stdout.strip() != str(acceptance.get("acceptance_git_tree_oid") or ""):
        raise RepairError("state acceptance tree OID differs from the derived Git anchor")
    blob_oids = mapping(acceptance.get("acceptance_git_blob_oids"))
    for name in anchored_files:
        blob = subprocess.run(
            ["git", "-C", str(repository), "rev-parse", f"{expected_acceptance_ref}:{name}"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
        )
        if blob.returncode or blob.stdout.strip() != str(blob_oids.get(name) or ""):
            raise RepairError(f"state acceptance blob OID differs for {name}")
    acceptance_reflog = subprocess.run(
        ["git", "-C", str(repository), "reflog", "show", "--format=%H", expected_acceptance_ref],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
    )
    if acceptance_reflog.returncode or acceptance_reflog.stdout.splitlines() != [acceptance_oid.stdout.strip()]:
        raise RepairError("acceptance Git ref was rewritten after its one-time creation")
    manifest = read_json(manifest_path)
    if not isinstance(manifest, Mapping):
        raise RepairError("acceptance manifest must be a JSON object")
    history = sequence(state.get("history"))
    if len(history) < 2 or mapping(history[-1]).get("phase") != "acceptance_passed" or mapping(history[-2]).get("phase") != "report_updated":
        raise RepairError("publication state history does not terminate in report_updated then acceptance_passed")
    if (
        manifest.get("pre_acceptance_phase") != "report_updated"
        or manifest.get("pre_acceptance_history_length") != len(history) - 1
        or manifest.get("pre_acceptance_history_entry_sha256") != mapping(history[-2]).get("entry_sha256")
    ):
        raise RepairError("state pre-acceptance history tail differs from the immutable acceptance manifest")
    expected_history_artifacts = [
        {
            "phase": str(mapping(entry).get("phase") or ""),
            "label": str(mapping(artifact).get("label") or ""),
            "path": str(mapping(artifact).get("path") or ""),
            "sha256": str(mapping(artifact).get("sha256") or ""),
        }
        for entry in history[:-1]
        for artifact in sequence(mapping(entry).get("artifacts"))
    ]
    if manifest.get("history_artifacts") != expected_history_artifacts:
        raise RepairError("state phase-artifact history differs from the immutable acceptance manifest")
    for artifact in sequence(manifest.get("history_artifacts")):
        record = mapping(artifact)
        path = resolve_local_path(str(record.get("path") or ""))
        if not path.is_file() or sha256_file(path) != str(record.get("sha256") or ""):
            raise RepairError(f"acceptance-manifest artifact changed: {record.get('phase')}/{record.get('label')}")
    manifest_bindings = {
        "acceptance_receipt_path": str(receipt_path.resolve()),
        "acceptance_receipt_sha256": sha256_file(receipt_path),
        "acceptance_seal_path": str(acceptance_seal_path.resolve()),
        "acceptance_seal_sha256": sha256_file(acceptance_seal_path),
        "accepted_candidate_path": receipt.get("accepted_candidate_path"),
        "accepted_candidate_sha256": receipt.get("accepted_candidate_sha256"),
        "book_update_path": receipt.get("book_update_path"),
        "book_update_sha256": receipt.get("book_update_sha256"),
        "repair_verification_path": receipt.get("repair_verification_path"),
        "repair_verification_sha256": receipt.get("repair_verification_sha256"),
        "portfolio_updater_receipt_path": receipt.get("portfolio_updater_receipt_path"),
        "portfolio_updater_receipt_sha256": receipt.get("portfolio_updater_receipt_sha256"),
        "portfolio_updater_transaction_id": receipt.get("portfolio_updater_transaction_id"),
        "validated_report_outputs": receipt.get("validated_report_outputs"),
    }
    for key, expected_value in manifest_bindings.items():
        if manifest.get(key) != expected_value:
            raise RepairError(f"acceptance manifest differs from verifier receipt field {key}")
    if receipt.get("accepted") is not True:
        raise RepairError("acceptance receipt did not pass")
    if str(receipt.get("run_id") or "") != str(state.get("run_id") or "") or str(receipt.get("book_id") or "") != str(state.get("book_id") or ""):
        raise RepairError("acceptance receipt does not belong to this run")
    for key in (
        "accepted", "accepted_candidate_path", "accepted_candidate_sha256",
        "context_seal_path", "context_seal_sha256",
        "portfolio_updater_receipt_path", "portfolio_updater_receipt_sha256",
        "portfolio_updater_transaction_id", "portfolio_updater_roots",
        "validated_report_outputs", "evaluator_thread_id", "evaluator_project_id",
    ):
        if acceptance_seal.get(key) != receipt.get(key):
            raise RepairError(f"acceptance seal differs from verifier receipt field {key}")
    source = mapping(context.get("source"))
    candidate = resolve_local_path(str(source.get("candidate_package_path") or ""))
    outer = resolve_local_path(str(source.get("baseline_package_path") or ""))
    accepted_hash = str(receipt.get("accepted_candidate_sha256") or "")
    if resolve_local_path(str(receipt.get("accepted_candidate_path") or "")) != candidate:
        raise RepairError("acceptance receipt candidate path differs from the frozen candidate")
    canonical_seal_path = context_path.parent / "context-seal.json"
    if resolve_local_path(str(receipt.get("context_seal_path") or "")) != canonical_seal_path.resolve() or str(receipt.get("context_seal_sha256") or "") != sha256_file(canonical_seal_path):
        raise RepairError("acceptance receipt is not bound to the immutable context seal")
    if not candidate.is_file() or sha256_file(candidate) != accepted_hash:
        raise RepairError("nested candidate no longer matches the accepted candidate hash")
    if not outer.is_file() or sha256_file(outer) != accepted_hash:
        raise RepairError("publish-final did not copy the accepted candidate byte-for-byte to the outer package")
    try:
        outer_relative = outer.relative_to(repository).as_posix()
    except ValueError as exc:
        raise RepairError("outer package is not inside the frozen repository") from exc

    def git_text(*arguments: str) -> str:
        result = subprocess.run(
            ["git", "-C", str(repository), *arguments],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        if result.returncode:
            raise RepairError(f"git {' '.join(arguments)} failed: {result.stderr.strip()}")
        return result.stdout.strip()

    def git_optional(*arguments: str) -> str | None:
        result = subprocess.run(
            ["git", "-C", str(repository), *arguments],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False,
        )
        return result.stdout.strip() if result.returncode == 0 else None

    try:
        git_text("cat-file", "-e", f"{commit_sha}^{{commit}}")
    except RepairError as exc:
        raise RepairError("publication commit does not exist in the repository") from exc
    current_head = git_text("rev-parse", "HEAD")
    if current_head.lower() != commit_sha.lower():
        raise RepairError("publication commit is not the current HEAD")
    branch = git_text("branch", "--show-current")
    frozen_repository = mapping(seal.get("repository_binding"))
    frozen_branch = str(frozen_repository.get("branch") or "")
    if not branch or branch != frozen_branch:
        raise RepairError("current publication branch is detached or differs from the frozen repair branch")
    tracking_mode = str(frozen_repository.get("publication_tracking_mode") or "")
    frozen_remote = str(frozen_repository.get("tracking_remote") or "")
    frozen_remote_ref = str(frozen_repository.get("remote_ref") or "")
    if tracking_mode == "tracked_upstream":
        upstream = git_text("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
        frozen_upstream = str(frozen_repository.get("upstream") or "")
        if not upstream or upstream != frozen_upstream or "/" not in upstream:
            raise RepairError("current upstream is missing or differs from the frozen repair upstream")
        upstream_commit = git_text("rev-parse", "@{upstream}")
        if upstream_commit.lower() != commit_sha.lower():
            raise RepairError("publication commit is not synchronized to the upstream remote-tracking ref")
        remote = git_text("config", "--get", f"branch.{branch}.remote")
        remote_ref = git_text("config", "--get", f"branch.{branch}.merge")
        tracking_ref = git_text("rev-parse", "--symbolic-full-name", "@{upstream}")
        if remote != frozen_remote or remote_ref != frozen_remote_ref or tracking_ref != str(frozen_repository.get("upstream_tracking_ref") or ""):
            raise RepairError("publication branch does not track the frozen upstream")
    elif tracking_mode == "explicit_untracked":
        remote = frozen_remote
        remote_ref = frozen_remote_ref
        upstream = git_optional("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
        configured_remote = git_optional("config", "--get", f"branch.{branch}.remote")
        configured_ref = git_optional("config", "--get", f"branch.{branch}.merge")
        if (configured_remote is None) != (configured_ref is None):
            raise RepairError("publication created only part of a branch upstream configuration")
        if configured_remote is not None and (configured_remote != remote or configured_ref != remote_ref):
            raise RepairError("publication branch upstream differs from the sealed explicit target")
    else:
        raise RepairError("frozen publication tracking mode is invalid")
    remote_url = git_text("remote", "get-url", remote) if remote else ""
    if not remote or remote == "." or remote_url != str(frozen_repository.get("remote_url") or ""):
        raise RepairError("publication target is not the frozen configured remote URL")
    frozen_remote_commit = str(frozen_repository.get("remote_commit_at_freeze") or "")
    if frozen_remote_commit:
        ancestry = subprocess.run(
            ["git", "-C", str(repository), "merge-base", "--is-ancestor", frozen_remote_commit, commit_sha],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
        )
        if ancestry.returncode:
            raise RepairError("publication commit is not a fast-forward descendant of the frozen remote ref")
    remote_row = git_text("ls-remote", "--exit-code", remote, remote_ref)
    remote_parts = remote_row.split()
    if len(remote_parts) < 2 or remote_parts[0].lower() != commit_sha.lower() or remote_parts[1] != remote_ref:
        raise RepairError("publication commit is not present at the exact frozen remote ref")
    changed = set(git_text("diff-tree", "--root", "--no-commit-id", "--name-only", "-r", commit_sha).splitlines())
    report_dir = repository / "docs/v25/chapterflow-140-evaluation"
    report_names = {
        "chapterflow-140-evaluation-report.html",
        "chapterflow-140-evaluation-report-data.json",
        "chapterflow-140-remediation-prompts.json",
        "chapterflow-140-remediation-prompts.md",
    }
    required_paths = {outer_relative} | {(report_dir / name).relative_to(repository).as_posix() for name in report_names}
    if changed != required_paths:
        raise RepairError(f"publication commit path set must be exactly the outer book plus four report artifacts; got {sorted(changed)}")
    blob = subprocess.run(
        ["git", "-C", str(repository), "show", f"{commit_sha}:{outer_relative}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if blob.returncode or __import__("hashlib").sha256(blob.stdout).hexdigest() != accepted_hash:
        raise RepairError("outer package blob in publication commit differs from accepted candidate hash")
    accepted_outputs = sequence(receipt.get("validated_report_outputs"))
    accepted_by_path = {
        str(mapping(item).get("repo_relative_path") or ""): mapping(item)
        for item in accepted_outputs if isinstance(item, Mapping)
    }
    if set(accepted_by_path) != required_paths - {outer_relative}:
        raise RepairError("acceptance receipt report-output inventory is not the exact publication allowlist")
    updater_receipt_raw = str(receipt.get("portfolio_updater_receipt_path") or "")
    updater_receipt_path = resolve_local_path(updater_receipt_raw) if updater_receipt_raw else Path("/__missing_updater_receipt__")
    if not updater_receipt_path.is_file() or sha256_file(updater_receipt_path) != str(receipt.get("portfolio_updater_receipt_sha256") or ""):
        raise RepairError("transactional updater receipt changed after acceptance")
    updater_receipt = read_json(updater_receipt_path)
    if not isinstance(updater_receipt, Mapping):
        raise RepairError("transactional updater receipt is malformed")
    if updater_receipt.get("transaction_id") != receipt.get("portfolio_updater_transaction_id") or updater_receipt.get("roots") != receipt.get("portfolio_updater_roots"):
        raise RepairError("acceptance receipt updater transaction/output inventory differs from the exact updater receipt")
    for relative in sorted(required_paths - {outer_relative}):
        current = repository / relative
        accepted_output = accepted_by_path[relative]
        if not current.is_file() or sha256_file(current) != str(accepted_output.get("sha256") or ""):
            raise RepairError(f"report artifact changed after acceptance: {relative}")
        committed = subprocess.run(
            ["git", "-C", str(repository), "show", f"{commit_sha}:{relative}"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        if not current.is_file() or committed.returncode or __import__("hashlib").sha256(committed.stdout).hexdigest() != str(accepted_output.get("sha256") or ""):
            raise RepairError(f"publication commit report artifact differs from validated repo snapshot: {relative}")
    return {
        "commit_sha": commit_sha.lower(),
        "acceptance_receipt": str(receipt_path),
        "acceptance_receipt_sha256": sha256_file(receipt_path),
        "accepted_candidate_sha256": accepted_hash,
        "outer_package_path": str(outer),
        "outer_package_sha256": sha256_file(outer),
        "branch": branch,
        "upstream": upstream,
        "remote": remote,
        "remote_url": remote_url,
        "remote_ref": remote_ref,
        "publication_tracking_mode": tracking_mode,
        "push_mode": "normal",
    }


def advance(args: argparse.Namespace) -> dict[str, Any]:
    state_path = resolve_local_path(args.state)
    value = read_json(state_path)
    if not isinstance(value, Mapping):
        raise RepairError("state must be a JSON object")
    state = copy.deepcopy(dict(value))
    sealed_context_path, seal = _validate_frozen_seal(state_path, state)
    current = str(state.get("phase") or "")
    target = args.to
    if current not in NEXT or target not in NEXT[current]:
        raise RepairError(f"illegal state transition {current!r} -> {target!r}")
    history = sequence(state.get("history"))
    if not history or not isinstance(history[-1], Mapping) or str(history[-1].get("phase") or "") != current:
        raise RepairError("state history is missing or not append-only with the current phase last")

    evidence = _pairs(args.evidence, "evidence")
    artifact_inputs = _pairs(args.artifact, "artifact")
    if not evidence and not artifact_inputs:
        raise RepairError("every state transition requires --evidence or --artifact")
    artifacts = []
    for label, raw_path in artifact_inputs.items():
        path = resolve_local_path(raw_path)
        if not path.is_file():
            raise RepairError(f"transition artifact does not exist: {path}")
        artifacts.append({"label": label, "path": str(path), "sha256": sha256_file(path)})
    required_evidence, required_artifacts = PHASE_REQUIREMENTS.get(target, (set(), set()))
    missing_evidence = sorted(required_evidence - set(evidence))
    missing_artifacts = sorted(required_artifacts - set(artifact_inputs))
    if missing_evidence or missing_artifacts:
        raise RepairError(f"typed phase evidence missing for {target}: evidence={missing_evidence}, artifacts={missing_artifacts}")
    if target == "fresh_qc_passed" and evidence.get("qc_session_id") == evidence.get("author_session_id"):
        raise RepairError("fresh_qc_passed requires distinct QC and author session ids")
    if target == "evaluator_thread_created" and evidence.get("forked", "").casefold() != "false":
        raise RepairError("evaluator task provenance must explicitly record forked=false")

    publication = None
    if target == "evaluator_thread_created" and mapping(state.get("authorizations")).get("new_evaluator_thread") is not True:
        raise RepairError("state does not record explicit user authority for a new evaluator task")
    if target == "published":
        if not args.repair_context or not args.acceptance_receipt or not args.commit_sha:
            raise RepairError("published requires --repair-context, --acceptance-receipt, and --commit-sha")
        publication = _publication_checks(
            state,
            resolve_local_path(args.repair_context),
            seal,
            resolve_local_path(args.acceptance_receipt),
            args.commit_sha,
        )
        if args.push_mode != "normal":
            raise RepairError("publication state requires an explicit normal, non-force push mode")

    now = utc_now()
    entry = {
        "phase": target,
        "at_utc": now,
        "evidence": evidence,
        "artifacts": artifacts,
        "previous_entry_sha256": str(mapping(history[-1]).get("entry_sha256") or ""),
    }
    if args.note:
        entry["note"] = args.note
    entry["entry_sha256"] = history_entry_sha256(entry)
    state["phase"] = target
    state["updated_at_utc"] = now
    state["history"] = history + [entry]
    if publication is not None:
        state["publication"] = {**publication, "published": True, "published_at_utc": now, "requires_live_authority_recheck": False}
    atomic_write_json(state_path, state)
    return state


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", required=True)
    parser.add_argument("--to", required=True, choices=sorted(NEXT))
    parser.add_argument("--evidence", action="append", default=[], help="Repeat key=value")
    parser.add_argument("--artifact", action="append", default=[], help="Repeat label=/absolute/path; file must exist")
    parser.add_argument("--note")
    parser.add_argument("--repair-context", help="Required only for the published transition")
    parser.add_argument("--acceptance-receipt", help="Required only for the published transition")
    parser.add_argument("--commit-sha", help="Required only for the published transition")
    parser.add_argument("--push-mode", choices=["normal"], help="Required as 'normal' for the published transition; force pushes are unsupported")
    return parser.parse_args()


def main() -> int:
    try:
        state = advance(parse_args())
    except (RepairError, OSError, json.JSONDecodeError) as exc:
        print(f"book-repair state error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({"run_id": state["run_id"], "book_id": state["book_id"], "phase": state["phase"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
