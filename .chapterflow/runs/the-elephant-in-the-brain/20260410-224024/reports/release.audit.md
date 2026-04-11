# Release Audit

## Clean Checks

- All 16 chapters exist as validated chapter artifacts.
- Release assembled from validated chapter JSON only.
- Release guard confirms the release matches validated chapter hashes.
- Source ledger and edition lock are present in `manifests/`.
- Repo build passed.

## Release Steps Executed

- Wrote `release/the-elephant-in-the-brain.modern.json` from sealed validated chapters only.
- Ran `chapterflow_v13_source_guard.py` on the run root.
- Ran `chapterflow_v13_lint.py ... release_gate` on the release artifact.
- Ran `chapterflow_v13_release_guard.py` against the assembled release.
- Copied the sealed release package to `book-packages/the-elephant-in-the-brain.modern.json`.
- Ran repo-level v13 lint on the repo package artifact.
- Ran `npm run build`.

## Residual Risks

- The repo's legacy `validate-book.mjs` contract remains stricter and structurally different from the v13 run gate and reports inherited v12-only package-contract mismatches.
- Those findings are documented in `reports/release.validation.md` and were not introduced by release assembly or repo wiring.
