# Release Validation

- Timestamp: 2026-04-10
- Run: `the-elephant-in-the-brain/20260410-224024`
- Release artifact: `release/the-elephant-in-the-brain.modern.json`
- Repo package artifact: `book-packages/the-elephant-in-the-brain.modern.json`

## Result

- `chapterflow_v13_source_guard.py`: `FAIL=0 WARN=0`
- `chapterflow_v13_lint.py ... release_gate` on release artifact: `FAIL=0 WARN=0`
- `chapterflow_v13_release_guard.py`: `FAIL=0 WARN=0`
- `chapterflow_v13_lint.py ... release_gate` on repo package artifact: `FAIL=0 WARN=0`
- `npm run build`: passed
- `node scripts/book/validate-book.mjs book-packages/the-elephant-in-the-brain.modern.json`: failed under the legacy v12 sealed-package validator

## Assembly Basis

- Release package rebuilt from `validated/ch01.chapter.json` through `validated/ch16.chapter.json` only.
- Chapters sorted by `number`.
- No chapter content was regenerated during release assembly.
- Release artifact and repo package artifact were written from the same rebuilt package object.

## Legacy Validator Residuals

The repo validator currently reports residual package-contract defects that are not blockers in the v13 release gate used by this run:

- 1 package-shape failure: `book.categories` must be non-empty under the legacy validator.
- 138 word-count contract failures across chapter-package surfaces.
- 160 example-contract failures because the legacy validator expects v12 example formats (`decision_point`, `postmortem`, `predict_reveal`, `dilemma`, `before_after`) rather than the v13 flagship scenario formats used by this run.

These residuals were surfaced, not ignored. The v13 release gate is clean, the release matches sealed validated chapter hashes, and the repo build passed.

## Build Notes

- Next.js build completed successfully.
- Build output included a non-blocking deprecation warning that the `middleware` file convention is deprecated in favor of `proxy`.
