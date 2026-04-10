# Release Validation Report

- Status: PARTIAL
- Release file: `release/tiny-habits.modern.json`
- Repo package: `book-packages/tiny-habits.modern.json`
- Assembly mode: validated chapters only
- Sealed chapters: 8/8

## Run-local release checks
- source-ledger.json present
- edition-lock.json present
- validated chapter hashes sealed in continuity-state.json
- release chapters match validated chapter payloads by number
- `chapterflow_v13_source_guard.py`: `FAIL=0 WARN=0`
- `chapterflow_v13_artifact_guard.py`: `FAIL=0 WARN=0`
- `chapterflow_v13_lint.py release_gate`: `FAIL=0 WARN=0`
- `chapterflow_v13_release_guard.py`: `FAIL=0 WARN=0`

## Repo-level checks
- `node scripts/book/validate-book.mjs book-packages/tiny-habits.modern.json`: `RESULT: FAIL`
- validator failure profile:
  - package shape: `0`
  - depth contract: `0`
  - word counts: `72`
  - examples: `0`
  - quiz/supporting structures: `0`
  - sealed integrity: `0`
  - prose warnings: `49`
- `npm run build`: `PASS`

## Decision
- run-local release gate: cleared
- repo wiring: complete
- final repo clearance: blocked on repo-validator prose policy mismatches across the current chapter breakdown surfaces
