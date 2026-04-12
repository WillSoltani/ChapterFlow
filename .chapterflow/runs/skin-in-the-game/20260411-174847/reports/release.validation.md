# Release Validation Report

Book: skin-in-the-game
Mode: release_gate
Validated at: 2026-04-12T22:33:38.600Z

Release inputs checked:
- validated chapter set present for chapters 1-19
- release assembled from validated chapter JSON only
- source ledger present
- edition lock present
- source-freeze artifacts present
- continuity hash seals present for chapters 1-19

Release checks:
- `chapterflow_v13_source_guard.py RUN_ROOT`: FAIL=0 WARN=0
- `chapterflow_v13_lint.py release/skin-in-the-game.modern.json release_gate`: FAIL=192 WARN=0
- `chapterflow_v13_release_guard.py RUN_ROOT release/skin-in-the-game.modern.json`: FAIL=0 WARN=0
- `chapterflow_v13_artifact_guard.py RUN_ROOT`: FAIL=0 WARN=0

Gate decision:
- fail

Notes:
- Release package contains 19 chapters assembled in chapter-number order.
- Release package chapters match the full validated chapter payloads exactly.
- Release metadata carries canonical title and author, non-empty categories and tags, fuller edition detail, and explicit chapter scope from the source-locked run metadata.
- Continuity seals were repaired to the release guard canonical hash form before final release validation was re-run.
- The remaining blocker is not release assembly drift. It is release lint failure inside already-validated chapter payloads across the run.
