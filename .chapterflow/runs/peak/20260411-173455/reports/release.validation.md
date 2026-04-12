# Release Validation Report — peak

## Release input
- release path: `.chapterflow/runs/peak/20260411-173455/release/peak.modern.json`
- source of assembly: `validated/ch01.chapter.json` through `validated/ch09.chapter.json` only
- chapter count assembled: `9`

## Release-gate checks
- source guard: `FAIL=0 WARN=0`
- release guard: `FAIL=0 WARN=0`
- release lint (`release_gate`): `FAIL=0 WARN=0`
- artifact guard after full-book completion: `FAIL=0 WARN=0`
- repo package validator (`node scripts/book/validate-book.mjs book-packages/peak.modern.json`): `FAIL`
- repo build (`npm run build`): `PASS`

## Repair note
- One release-state repair was required before final pass: `continuity/continuity-state.json` had been sealed with file-level hashes rather than the canonical JSON hashes expected by `chapterflow_v13_release_guard.py`. The seal values were repaired to canonical chapter hashes and the release guard was rerun to clean pass.

## Outcome
- release gate status: `passed` at the pack level
- release assembled from validated chapters only: `yes`
- release chapter/hash parity with validated chapters: `confirmed`
- repo wiring status: `partial`
- repo-level blocker: `validate-book.mjs` expects additional book-package surfaces not present in the sealed validated chapter schema; build still passed`
