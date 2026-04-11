# Release Compatibility Note

Run: the-great-mental-models-vol-1 / 20260410-153503
Date: 2026-04-10

## Status

The strict ChapterFlow v13 autonomous run is complete and internally clean:

- all chapters passed `chapter_gate`
- all validated chapter artifacts exist
- review wrappers match validated chapter payloads
- continuity seals are present
- `chapterflow_v13_artifact_guard.py` passed
- `chapterflow_v13_release_guard.py` passed
- `chapterflow_v13_lint.py ... release_gate` passed

## Additional Validator Mismatch

The separate repo validator:

`node scripts/book/validate-book.mjs .chapterflow/runs/the-great-mental-models-vol-1/20260410-153503/release/the-great-mental-models-vol-1.modern.json`

fails for reasons that are not limited to release assembly.

## Exact Mismatch Class

The validator expects a different package contract than this v13 run produced, including:

- non-empty `book.categories`
- structured `oneMinuteRecap` objects for medium/hard with `retrieve` / `connect` / `preview`
- `activationPrompt` on medium/hard
- `selfCheckPrompt` on medium
- `selfCheckPrompts` on hard
- `predictionPrompt` on hard
- exactly 10 quiz questions for Chapters 10-12
- different chapter-breakdown word-count bands across multiple already sealed chapters

## Why This Is Not a Safe Release-Only Repair

These failures are chapter-payload failures, not just release-wrapper failures.

Repairing them would require changing already validated chapter JSON files, which would also require:

- replacing validated chapter payloads
- rebuilding review-package payloads
- recomputing reading metrics
- resealing continuity hashes
- re-running chapter validation for the affected chapters

That would no longer be a pure release assembly step.

## Conclusion

The v13 run state is internally correct on its own authority.

`validate-book.mjs` is currently a cross-schema compatibility check against a stricter or different package contract than the one enforced by the v13 autonomous workflow.

Any attempt to make this run pass that validator should be treated as a new repair track, not as unfinished v13 execution.
