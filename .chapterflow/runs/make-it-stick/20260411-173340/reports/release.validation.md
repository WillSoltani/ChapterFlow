# Release Validation Report

- Status: PARTIAL PASS
- Release path: `.chapterflow/runs/make-it-stick/20260411-173340/release/make-it-stick.modern.json`
- Repo package path: `book-packages/make-it-stick.modern.json`

## Release checks

- Assembled from `validated/ch01.chapter.json` through `validated/ch08.chapter.json` only
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_release_guard.py .chapterflow/runs/make-it-stick/20260411-173340 .chapterflow/runs/make-it-stick/20260411-173340/release/make-it-stick.modern.json`: `FAIL=0 WARN=0`
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py book-packages/make-it-stick.modern.json release_gate`: `FAIL=0 WARN=0`
- `npm run build`: `PASS`
- `node scripts/book/validate-book.mjs book-packages/make-it-stick.modern.json`: `FAIL`

## Notes

- Release chapters match the validated chapter payloads.
- Continuity seals were repaired to the release-guard canonical hash contract before the final release guard rerun.
- Repo wiring used the assembled release package without regenerating chapter content.
- The remaining blocker is the repo's legacy `validate-book.mjs` contract, which expects v12 sealed-package depth and word-band rules that conflict with these already validated v13 chapter payloads.
