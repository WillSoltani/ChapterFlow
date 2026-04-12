# Release Validation Report

Book: competing-against-luck
Mode: release_gate
Validated at: 2026-04-12T01:11:37Z

Release inputs checked:
- validated chapter set present for chapters 1-10
- release assembled from validated chapter JSON only
- source ledger present
- edition lock present
- source-freeze artifacts present
- continuity hash seals present for chapters 1-10

Release checks:
- `chapterflow_v13_source_guard.py RUN_ROOT`: FAIL=0 WARN=0
- `chapterflow_v13_lint.py release/competing-against-luck.modern.json release_gate`: FAIL=0 WARN=0
- `chapterflow_v13_release_guard.py RUN_ROOT release/competing-against-luck.modern.json`: FAIL=0 WARN=0
- `chapterflow_v13_artifact_guard.py RUN_ROOT`: FAIL=0 WARN=0

Gate decision:
- pass

Notes:
- Release package contains 10 chapters assembled in chapter-number order.
- Release package chapters match the full validated chapter payloads exactly.
- Continuity seals were repaired to the release guard canonical hash form before final release validation passed.
