#!/usr/bin/env python3
"""Create and verify fail-closed blind-worker dispatch and pair-seal receipts."""

from __future__ import annotations

import copy
import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any, Mapping

from common import EvaluationError


SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
ROLES = ("primary", "verification")


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def artifact_sha256(value: Mapping[str, Any]) -> str:
    return canonical_sha256(value)


def _bound_hash(value: Mapping[str, Any]) -> str:
    payload = {key: item for key, item in value.items() if key != "binding_sha256"}
    return canonical_sha256(payload)


def inventory_sha256(inspection: Mapping[str, Any]) -> str:
    inventory = inspection.get("chapter_inventory")
    if inspection.get("inventory_complete") is not True or not isinstance(inventory, list) or not inventory:
        raise EvaluationError("worker receipts require a complete, positive source chapter inventory")
    if inspection.get("chapter_count") != len(inventory):
        raise EvaluationError("worker receipt inventory count does not match chapter_inventory")
    indices = [item.get("chapter_index") if isinstance(item, Mapping) else None for item in inventory]
    if indices != list(range(1, len(inventory) + 1)):
        raise EvaluationError("worker receipt inventory indices must be exactly 1..chapter_count")
    payload = {
        "book_id": inspection.get("book_id"),
        "chapter_count": len(inventory),
        "chapter_inventory": [
            {
                "chapter_index": item.get("chapter_index"),
                "chapter_id": item.get("chapter_id"),
                "number": item.get("number"),
                "title": item.get("title"),
            }
            for item in inventory
            if isinstance(item, Mapping)
        ],
    }
    if len(payload["chapter_inventory"]) != len(inventory):
        raise EvaluationError("worker receipt inventory entries must all be objects")
    return canonical_sha256(payload)


def issue_dispatch_receipt(
    *,
    pair_id: str,
    run_id: str,
    book_id: str,
    source_hash: str,
    inspection: Mapping[str, Any],
    role: str,
    job_id: str,
    worker_task_id: str,
    worker_session_id: str,
    issued_at_utc: str | None = None,
) -> dict[str, Any]:
    for label, value in (
        ("pair_id", pair_id),
        ("run_id", run_id),
        ("book_id", book_id),
        ("job_id", job_id),
        ("worker_task_id", worker_task_id),
        ("worker_session_id", worker_session_id),
    ):
        if not str(value).strip():
            raise EvaluationError(f"dispatch receipt {label} must be nonempty")
    if role not in ROLES:
        raise EvaluationError("dispatch receipt role must be primary or verification")
    if not SHA256_RE.fullmatch(source_hash):
        raise EvaluationError("dispatch receipt source_hash must be a lowercase SHA-256 digest")
    if str(inspection.get("book_id") or "") != book_id:
        raise EvaluationError("dispatch receipt book_id differs from the source inspection")
    receipt: dict[str, Any] = {
        "schema_version": "1.0.0",
        "artifact_type": "chapterflow_worker_dispatch_receipt",
        "issuer": "chapterflow_evaluation_orchestrator",
        "pair_id": pair_id,
        "issued_at_utc": issued_at_utc or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "run_id": run_id,
        "book_id": book_id,
        "source_hash": source_hash,
        "inventory_sha256": inventory_sha256(inspection),
        "role": role,
        "job_id": job_id,
        "worker_task_id": worker_task_id,
        "worker_session_id": worker_session_id,
    }
    receipt["binding_sha256"] = _bound_hash(receipt)
    return receipt


def validate_dispatch_receipt(
    receipt: Mapping[str, Any],
    *,
    result: Mapping[str, Any],
    inspection: Mapping[str, Any],
) -> list[str]:
    errors: list[str] = []
    constants = {
        "schema_version": "1.0.0",
        "artifact_type": "chapterflow_worker_dispatch_receipt",
        "issuer": "chapterflow_evaluation_orchestrator",
    }
    for key, expected in constants.items():
        if receipt.get(key) != expected:
            errors.append(f"worker dispatch receipt {key} must equal {expected!r}")
    if receipt.get("role") not in ROLES:
        errors.append("worker dispatch receipt role is invalid")
    for key in ("pair_id", "run_id", "book_id", "job_id", "worker_task_id", "worker_session_id", "issued_at_utc"):
        if not str(receipt.get(key) or "").strip():
            errors.append(f"worker dispatch receipt {key} must be nonempty")
    if not SHA256_RE.fullmatch(str(receipt.get("source_hash") or "")):
        errors.append("worker dispatch receipt source_hash is malformed")
    try:
        expected_inventory = inventory_sha256(inspection)
    except EvaluationError as exc:
        errors.append(str(exc))
        expected_inventory = ""
    comparisons = {
        "run_id": result.get("run_id"),
        "book_id": (result.get("book") or {}).get("book_id") if isinstance(result.get("book"), Mapping) else None,
        "job_id": result.get("job_id"),
        "role": result.get("rater_role"),
        "source_hash": result.get("source_hash"),
        "inventory_sha256": expected_inventory,
    }
    for key, expected in comparisons.items():
        if receipt.get(key) != expected:
            errors.append(f"worker dispatch receipt {key} does not match the bound result/source")
    if receipt.get("binding_sha256") != _bound_hash(receipt):
        errors.append("worker dispatch receipt binding_sha256 is invalid")
    receipt_hash = artifact_sha256(receipt)
    if result.get("worker_dispatch_receipt_sha256") != receipt_hash:
        errors.append("result worker_dispatch_receipt_sha256 does not match its dispatch receipt")
    return errors


def judgment_sha256(result: Mapping[str, Any]) -> str:
    judgment = copy.deepcopy(dict(result))
    for key in ("run_id", "job_id", "rater_role", "worker_dispatch_receipt_sha256"):
        judgment.pop(key, None)
    return canonical_sha256(judgment)


def seal_pair_receipt(
    *,
    primary: Mapping[str, Any],
    verification: Mapping[str, Any],
    primary_dispatch: Mapping[str, Any],
    verification_dispatch: Mapping[str, Any],
    inspection: Mapping[str, Any],
    sealed_at_utc: str | None = None,
) -> dict[str, Any]:
    errors = validate_dispatch_receipt(primary_dispatch, result=primary, inspection=inspection)
    errors.extend(validate_dispatch_receipt(verification_dispatch, result=verification, inspection=inspection))
    if errors:
        raise EvaluationError("cannot seal invalid worker dispatch chain: " + " | ".join(errors))
    identities = {
        "job": {primary_dispatch.get("job_id"), verification_dispatch.get("job_id")},
        "task": {primary_dispatch.get("worker_task_id"), verification_dispatch.get("worker_task_id")},
        "session": {primary_dispatch.get("worker_session_id"), verification_dispatch.get("worker_session_id")},
    }
    if any(len(values) != 2 for values in identities.values()):
        raise EvaluationError("primary and verification workers require distinct job, task, and session identities")
    pair_fields = ("pair_id", "run_id", "book_id", "source_hash", "inventory_sha256")
    if any(primary_dispatch.get(key) != verification_dispatch.get(key) for key in pair_fields):
        raise EvaluationError("primary and verification dispatch receipts do not share one source-bound pair identity")
    primary_judgment = judgment_sha256(primary)
    verification_judgment = judgment_sha256(verification)
    if primary_judgment == verification_judgment:
        raise EvaluationError("blind pair cannot be an administrative clone of one worker judgment")
    seal: dict[str, Any] = {
        "schema_version": "1.0.0",
        "artifact_type": "chapterflow_blind_pair_seal",
        "issuer": "chapterflow_evaluation_orchestrator",
        "pair_id": primary_dispatch["pair_id"],
        "sealed_at_utc": sealed_at_utc or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "run_id": primary_dispatch["run_id"],
        "book_id": primary_dispatch["book_id"],
        "source_hash": primary_dispatch["source_hash"],
        "inventory_sha256": primary_dispatch["inventory_sha256"],
        "workers": {
            "primary": {
                "job_id": primary_dispatch["job_id"],
                "worker_task_id": primary_dispatch["worker_task_id"],
                "worker_session_id": primary_dispatch["worker_session_id"],
                "dispatch_receipt_sha256": artifact_sha256(primary_dispatch),
                "result_canonical_sha256": canonical_sha256(primary),
                "judgment_sha256": primary_judgment,
            },
            "verification": {
                "job_id": verification_dispatch["job_id"],
                "worker_task_id": verification_dispatch["worker_task_id"],
                "worker_session_id": verification_dispatch["worker_session_id"],
                "dispatch_receipt_sha256": artifact_sha256(verification_dispatch),
                "result_canonical_sha256": canonical_sha256(verification),
                "judgment_sha256": verification_judgment,
            },
        },
    }
    seal["binding_sha256"] = _bound_hash(seal)
    return seal


def validate_pair_chain(
    *,
    primary: Mapping[str, Any],
    verification: Mapping[str, Any],
    primary_dispatch: Mapping[str, Any],
    verification_dispatch: Mapping[str, Any],
    pair_seal: Mapping[str, Any],
    inspection: Mapping[str, Any],
) -> list[str]:
    errors = validate_dispatch_receipt(primary_dispatch, result=primary, inspection=inspection)
    errors.extend(validate_dispatch_receipt(verification_dispatch, result=verification, inspection=inspection))
    try:
        expected = seal_pair_receipt(
            primary=primary,
            verification=verification,
            primary_dispatch=primary_dispatch,
            verification_dispatch=verification_dispatch,
            inspection=inspection,
            sealed_at_utc=str(pair_seal.get("sealed_at_utc") or ""),
        )
    except EvaluationError as exc:
        errors.append(str(exc))
        return sorted(set(errors))
    if pair_seal != expected:
        errors.append("blind pair seal does not match the exact dispatch receipts and result payloads")
    return sorted(set(errors))


def validate_result_receipt_membership(
    *,
    result: Mapping[str, Any],
    dispatch: Mapping[str, Any],
    pair_seal: Mapping[str, Any],
    inspection: Mapping[str, Any],
) -> list[str]:
    """Validate one result against its dispatch and an already sealed pair."""

    errors = validate_dispatch_receipt(dispatch, result=result, inspection=inspection)
    constants = {
        "schema_version": "1.0.0",
        "artifact_type": "chapterflow_blind_pair_seal",
        "issuer": "chapterflow_evaluation_orchestrator",
    }
    for key, expected in constants.items():
        if pair_seal.get(key) != expected:
            errors.append(f"blind pair seal {key} must equal {expected!r}")
    if pair_seal.get("binding_sha256") != _bound_hash(pair_seal):
        errors.append("blind pair seal binding_sha256 is invalid")
    for key in ("pair_id", "run_id", "book_id", "source_hash", "inventory_sha256"):
        if pair_seal.get(key) != dispatch.get(key):
            errors.append(f"blind pair seal {key} differs from the worker dispatch receipt")
    workers = pair_seal.get("workers")
    workers = workers if isinstance(workers, Mapping) else {}
    if set(workers) != set(ROLES):
        errors.append("blind pair seal must contain exactly primary and verification workers")
        return sorted(set(errors))
    role = str(result.get("rater_role") or "")
    member = workers.get(role) if isinstance(workers.get(role), Mapping) else {}
    expected_member = {
        "job_id": dispatch.get("job_id"),
        "worker_task_id": dispatch.get("worker_task_id"),
        "worker_session_id": dispatch.get("worker_session_id"),
        "dispatch_receipt_sha256": artifact_sha256(dispatch),
        "result_canonical_sha256": canonical_sha256(result),
        "judgment_sha256": judgment_sha256(result),
    }
    if member != expected_member:
        errors.append("blind pair seal member does not bind this exact worker task/session/result")
    primary = workers.get("primary") if isinstance(workers.get("primary"), Mapping) else {}
    verification = workers.get("verification") if isinstance(workers.get("verification"), Mapping) else {}
    for identity_key in ("job_id", "worker_task_id", "worker_session_id", "dispatch_receipt_sha256", "result_canonical_sha256", "judgment_sha256"):
        if not str(primary.get(identity_key) or "") or not str(verification.get(identity_key) or ""):
            errors.append(f"blind pair seal workers require nonempty {identity_key}")
        elif primary.get(identity_key) == verification.get(identity_key):
            errors.append(f"blind pair seal workers must have distinct {identity_key}")
    return sorted(set(errors))
