# Release Validation

- Timestamp: 2026-04-10
- Run: `the-great-mental-models-vol-2/20260410-153611`
- Release artifact: `release/the-great-mental-models-vol-2.modern.json`
- Repo package artifact: `book-packages/the-great-mental-models-vol-2.modern.json`

## Result

- `chapterflow_v13_release_guard.py`: `FAIL=0 WARN=0`
- `chapterflow_v13_lint.py ... release_gate`: `FAIL=0 WARN=0`
- `npm run build`: passed
- `node scripts/book/validate-book.mjs book-packages/the-great-mental-models-vol-2.modern.json`: failed under the legacy v12 sealed-package validator

## Assembly Basis

- Release package rebuilt from `validated/ch01.chapter.json` through `validated/ch20.chapter.json` only.
- Chapters sorted by `number`.
- No chapter content was regenerated during release assembly.
- Release artifact and repo package artifact were written from the same rebuilt package object.

## Legacy Validator Residuals

The repo validator currently reports residual package-contract defects that are not blockers in the v13 release gate used by this run:

- 151 word-count contract failures across chapter-package surfaces.
- 9 review-card difficulty distribution failures in `ch12` through `ch20` (`easy=1, medium=2, hard=2` instead of `2/2/1`).
- 1 repeated-sentence warning in `ch14.medium.oneMinuteRecap.retrieve.competitive` overlapping `ch14.reviewCards[0].front.competitive`.

These residuals were surfaced, not ignored. The v13 release gate is clean after the release-gate repair loop on Chapters 2, 3, and 7.

## Build Notes

- Next.js build completed successfully.
- Build output included a non-blocking deprecation warning that the `middleware` file convention is deprecated in favor of `proxy`.
