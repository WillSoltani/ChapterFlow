#!/usr/bin/env python3
"""Issue two source-bound dispatch receipts for distinct blind workers."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from common import EvaluationError, atomic_write_json, inspect_package, source_hash
from worker_receipts import artifact_sha256, issue_dispatch_receipt


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--temp-root", type=Path, default=Path(".chapterflow-receipt-inspection-tmp"))
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--book-id", required=True)
    parser.add_argument("--pair-id", required=True)
    parser.add_argument("--primary-job-id", required=True)
    parser.add_argument("--primary-task-id", required=True)
    parser.add_argument("--primary-session-id", required=True)
    parser.add_argument("--verification-job-id", required=True)
    parser.add_argument("--verification-task-id", required=True)
    parser.add_argument("--verification-session-id", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        inspection = inspect_package(args.package, args.temp_root)
        actual_hash = source_hash(args.package)
        if inspection.get("book_id") != args.book_id:
            raise EvaluationError("--book-id differs from inspected source package")
        primary = issue_dispatch_receipt(
            pair_id=args.pair_id, run_id=args.run_id, book_id=args.book_id,
            source_hash=actual_hash, inspection=inspection, role="primary",
            job_id=args.primary_job_id, worker_task_id=args.primary_task_id,
            worker_session_id=args.primary_session_id,
        )
        verification = issue_dispatch_receipt(
            pair_id=args.pair_id, run_id=args.run_id, book_id=args.book_id,
            source_hash=actual_hash, inspection=inspection, role="verification",
            job_id=args.verification_job_id, worker_task_id=args.verification_task_id,
            worker_session_id=args.verification_session_id,
        )
        if len({args.primary_job_id, args.verification_job_id}) != 2 or len({args.primary_task_id, args.verification_task_id}) != 2 or len({args.primary_session_id, args.verification_session_id}) != 2:
            raise EvaluationError("blind workers require distinct job, task, and session ids")
        args.output_dir.mkdir(parents=True, exist_ok=True)
        atomic_write_json(args.output_dir / "primary.dispatch.json", primary)
        atomic_write_json(args.output_dir / "verification.dispatch.json", verification)
    except (EvaluationError, OSError, json.JSONDecodeError) as exc:
        print(f"worker receipt issuance error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({"primary_sha256": artifact_sha256(primary), "verification_sha256": artifact_sha256(verification)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
