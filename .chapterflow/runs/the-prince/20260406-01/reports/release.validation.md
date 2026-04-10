# Release Validation Report

## Verdict

- status: release assembled, guarded, validator-clean, wired into repo, typechecked, and built
- release artifact path: `.chapterflow/runs/the-prince/20260406-01/release/the-prince.modern.json`
- repo package path: `book-packages/the-prince.modern.json`
- release chapter count: `26`

## Command Results

- `python3 scripts/book/prompts/chapterflow-v12-sealed/tools/chapterflow_v12_release_guard.py .chapterflow/runs/the-prince/20260406-01 .chapterflow/runs/the-prince/20260406-01/release/the-prince.modern.json`
  - result: `FAIL=0 WARN=0`
- `python3 scripts/book/prompts/chapterflow-v12-sealed/tools/chapterflow_v12_lint.py book-packages/the-prince.modern.json release_gate`
  - result: `FAIL=0 WARN=0`
- `node scripts/book/validate-book.mjs book-packages/the-prince.modern.json`
  - result: `RESULT: PASS`
  - issues: `0 package shape / 0 depth contract / 0 word-count / 0 examples / 0 quiz-supporting / 0 sealed integrity / 0 prose warnings`
- `npm run typecheck`
  - result: `pass`
- `npm run build`
  - result: `pass`
  - note: Next.js emitted a non-blocking middleware deprecation warning unrelated to the package content

## Decision

The sealed release artifact is assembled from validated chapters only, release guard passes, release lint passes, the repo validator passes cleanly, and the app typecheck/build both succeed with the repo-wired package. The release gate is fully clear.
