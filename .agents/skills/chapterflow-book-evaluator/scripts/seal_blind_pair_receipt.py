#!/usr/bin/env python3
"""Seal exact blind-worker results to their two orchestrator dispatch receipts."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from common import EvaluationError, atomic_write_json, inspect_package, read_json
from worker_receipts import artifact_sha256, seal_pair_receipt


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--temp-root", type=Path, default=Path(".chapterflow-receipt-inspection-tmp"))
    parser.add_argument("--primary", type=Path, required=True)
    parser.add_argument("--verification", type=Path, required=True)
    parser.add_argument("--primary-dispatch", type=Path, required=True)
    parser.add_argument("--verification-dispatch", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        values = [read_json(path) for path in (args.primary, args.verification, args.primary_dispatch, args.verification_dispatch)]
        if any(not isinstance(value, dict) for value in values):
            raise EvaluationError("results and dispatch receipts must be JSON objects")
        primary, verification, primary_dispatch, verification_dispatch = values
        seal = seal_pair_receipt(
            primary=primary, verification=verification,
            primary_dispatch=primary_dispatch, verification_dispatch=verification_dispatch,
            inspection=inspect_package(args.package, args.temp_root),
        )
        atomic_write_json(args.output, seal)
    except (EvaluationError, OSError, json.JSONDecodeError) as exc:
        print(f"blind pair sealing error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({"pair_seal_sha256": artifact_sha256(seal), "output": str(args.output)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
