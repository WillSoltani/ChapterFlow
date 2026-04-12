# Release Validation Report

Status: BLOCKED

Release package:
- `release/superforecasting.modern.json` assembled from `validated/ch01.chapter.json` through `validated/ch12.chapter.json` only

Checks run:
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_source_guard.py .chapterflow/runs/superforecasting/20260411-174441`
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py .chapterflow/runs/superforecasting/20260411-174441/release/superforecasting.modern.json release_gate`
- `node scripts/book/validate-book.mjs .chapterflow/runs/superforecasting/20260411-174441/release/superforecasting.modern.json`
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_release_guard.py .chapterflow/runs/superforecasting/20260411-174441 .chapterflow/runs/superforecasting/20260411-174441/release/superforecasting.modern.json`

Passing results:
- source guard: `FAIL=0 WARN=0`
- release-gate lint: `FAIL=0 WARN=0`
- release guard: `FAIL=0 WARN=0`

Repair performed during release gate:
- Resealed `continuity/continuity-state.json` to the release guard's canonical chapter-hash basis so sealed hashes match validated chapter payloads exactly

Blocking result:
- `validate-book.mjs` failed on legacy/v12-style package-profile checks spanning the assembled package
- The failures are not localized to release assembly and include earlier validated chapters
- Representative failures:
  - medium recap shape expectations on Chapters 11 and 12
  - legacy format/ending expectations across multiple earlier chapters
  - legacy word-count expectations across most chapters

Validator decision:
- Release assembly is mechanically clean
- Release gate remains blocked on repo validator failure
- Repo wiring and build were not started because the pre-wiring validator gate did not pass
