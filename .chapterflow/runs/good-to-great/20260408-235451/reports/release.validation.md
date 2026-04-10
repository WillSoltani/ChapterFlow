# Release Validation Report

- Status: PASS
- Book: Good to Great
- Book ID: good-to-great
- Run ID: 20260408-235451
- Release package: `release/good-to-great.modern.json`
- Repo package: `book-packages/good-to-great.modern.json`

## Release gate checks

- `chapterflow_v13_source_guard.py` returned `FAIL=0 WARN=0`
- `chapterflow_v13_artifact_guard.py` returned `FAIL=0 WARN=0`
- `chapterflow_v13_lint.py release/good-to-great.modern.json release_gate` returned `FAIL=0 WARN=0`
- `chapterflow_v13_release_guard.py` returned `FAIL=0 WARN=0`
- `node scripts/book/validate-book.mjs release/good-to-great.modern.json` returned `RESULT: PASS`

## Repo wiring checks

- `node scripts/book/validate-book.mjs book-packages/good-to-great.modern.json` returned `RESULT: PASS`
- `chapterflow_v13_lint.py book-packages/good-to-great.modern.json release_gate` returned `FAIL=0 WARN=0`
- `npm run build` returned exit code `0`

## Notes

- `validate-book.mjs` emitted 6 non-blocking prose warnings and 0 mechanical failures.
- Release and repo packages were rebuilt from `validated/ch*.chapter.json` only after the repaired validated layer and canonical continuity seals were rewritten.
