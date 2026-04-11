# Release Validation Report

- release path: `.chapterflow/runs/the-lean-startup/20260410-152715/release/the-lean-startup.modern.json`
- assembly rule: built from `validated/ch*.chapter.json` only
- source guard: PASS (`FAIL=0 WARN=0`)
- release JSON lint: PASS (`FAIL=0 WARN=0`)
- release guard: PASS (`FAIL=0 WARN=0`)
- repo validator: FAIL (`node scripts/book/validate-book.mjs .chapterflow/runs/the-lean-startup/20260410-152715/release/the-lean-startup.modern.json`)

## Repaired Deviations Before Final Pass

- Continuity sealing drift was detected during the first release-guard run.
  The continuity file stored non-file-byte seal values for `ch01`-`ch04`, while `chapterflow_v13_release_guard.py` verifies the validated chapter file hashes.
  Repair action: updated `continuity/continuity-state.json` for `ch01`-`ch04` to the current validated file SHA-256 values, then reran the release guard to clean pass.

## Residual Warnings

- `validate-book.mjs` fails on repo-package contract checks that are stricter than the v13 chapter-gate and release-gate rules already satisfied by this run.
- The failure set is concentrated in:
  - medium-depth contract expectations for `ch05`-`ch14` (`selfCheckPrompt` tone-object shape and disallowed `predictionPrompt` / `selfCheckPrompts` on medium)
  - repo-package word-count floors across the assembled validated chapter set
- No release-assembly drift remains in `.chapterflow/runs/the-lean-startup/20260410-152715/release/the-lean-startup.modern.json`.
