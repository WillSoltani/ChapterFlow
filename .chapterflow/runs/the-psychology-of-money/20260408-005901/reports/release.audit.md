# Release Audit

- Run root: `.chapterflow/runs/the-psychology-of-money/20260408-005901`
- Edition lock: original English 1st edition, published 2020
- Release source: validated chapter artifacts only
- Release path: `release/the-psychology-of-money.modern.json`
- Hash manifest: `manifests/validated-chapter-hashes.json`

## Assembly Summary

- Validated chapter files discovered: 22
- First chapter: `Introduction: The Greatest Show On Earth`
- Last chapter: `Postscript: A Brief History of Why the U.S. Consumer Thinks the Way They Do`
- Package assembled from `validated/ch01.chapter.json` through `validated/ch22.chapter.json`
- No prior invalid-run chapter prose, quizzes, structured artifacts, or release package were used in assembly

## Integrity Summary

- `validated-chapter-hashes.json` was written for the validated chapter set
- `chapterflow_v14_artifact_guard.py` passed without hash drift
- `chapterflow_v14_release_guard.py` passed with no release-to-validated mismatches
- `scripts/book/validate-book.mjs` passed on the final release package
