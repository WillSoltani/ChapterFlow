#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SKILL_SCRIPTS = Path(__file__).resolve().parents[3] / ".agents/skills/chapterflow-book-evaluator/scripts"
sys.path.insert(0, str(SKILL_SCRIPTS))
from common import atomic_write_json  # noqa: E402
from worker_receipts import artifact_sha256, seal_pair_receipt, validate_pair_chain  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--primary", type=Path, required=True)
    parser.add_argument("--verification", type=Path, required=True)
    parser.add_argument("--primary-dispatch", type=Path, required=True)
    parser.add_argument("--verification-dispatch", type=Path, required=True)
    parser.add_argument("--inspection", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    primary = json.loads(args.primary.read_text())
    verification = json.loads(args.verification.read_text())
    primary_dispatch = json.loads(args.primary_dispatch.read_text())
    verification_dispatch = json.loads(args.verification_dispatch.read_text())
    inspection = json.loads(args.inspection.read_text())
    seal = seal_pair_receipt(
        primary=primary,
        verification=verification,
        primary_dispatch=primary_dispatch,
        verification_dispatch=verification_dispatch,
        inspection=inspection,
    )
    errors = validate_pair_chain(
        primary=primary,
        verification=verification,
        primary_dispatch=primary_dispatch,
        verification_dispatch=verification_dispatch,
        pair_seal=seal,
        inspection=inspection,
    )
    if errors:
        for error in errors:
            print(error)
        return 2
    atomic_write_json(args.output, seal)
    print(json.dumps({"status": "sealed", "pair_seal_sha256": artifact_sha256(seal)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
