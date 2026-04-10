# Release Audit

## Assembly

- release file: `release/the-laws-of-human-nature.modern.json`
- source of truth: `validated/ch01.chapter.json` through `validated/ch19.chapter.json`
- assembly rule: release chapters copied from validated chapter payloads only, sorted by chapter number
- hash ledger: `manifests/validated-chapter-hashes.json`

## Integrity Notes

- `chapterflow_v14_artifact_guard.py` passed with no validated-hash drift.
- `chapterflow_v14_release_guard.py` passed, confirming release chapter payloads matched the validated chapter payloads.
- `validate-book.mjs` passed on the final release package with no package-shape, depth, word-count, example, quiz, or sealed-integrity issues.

## Scope Boundary

- Core pipeline ended at the validated release package and guard pass.
- No app registration, cover mapping, build fixing, or UI verification was performed.
