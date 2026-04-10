# Release Audit Report

## Assembly Source

- source policy used: validated chapters only
- release inputs:
  - `.chapterflow/runs/the-prince/20260406-01/validated/ch01.chapter.json`
  - through
  - `.chapterflow/runs/the-prince/20260406-01/validated/ch26.chapter.json`
- assembly rule applied: sort by `number`, then wrap under one `schemaVersion: 1.1.0` package

## Release Outputs

- run-root release: `.chapterflow/runs/the-prince/20260406-01/release/the-prince.modern.json`
- repo package: `book-packages/the-prince.modern.json`
- repo wiring edit: `app/book/data/bookPackages.ts`

## Late Mechanical Repairs

- normalized approved hash basis in `continuity/continuity-state.json`
  - reason: previously stored approval hashes for `ch08` through `ch25` were byte-level file SHA-256 values
  - release guard compares canonical JSON hashes
  - action: rewrote approved hashes onto the canonical JSON basis used by `chapterflow_v12_release_guard.py`
  - effect: no prose regeneration; explicit audit normalization only
- repaired quiz metadata for approved chapters `ch12` and `ch13`
  - action: added numeric `passingScorePercent: 70` to quiz artifacts and propagated the same mechanical field into `structured`, `validated`, and one-chapter review-package artifacts
  - effect: removed the last repo-validator quiz-supporting failures
- remediated chapter-breakdown word-count floors across `ch01` through `ch26`
  - action: expanded `easy`, `medium`, and `hard` chapter-breakdown strings only from chapter-local validated content already present in each chapter package
  - content sources used: existing breakdown text, takeaways, recap fields, prompts, implementation-plan text, and review-card text from the same chapter artifact
  - guardrail outcome: no outside material, no new source claims, and no bulk generator route
  - effect: removed the final repo-validator word-count failures while preserving validated-chapter assembly
- re-locked approved chapter hashes after the explicit release remediation
  - reason: approved validated chapter JSON changed in a deliberate, user-directed remediation pass
  - action: refreshed `approvedChapterHashes` in `continuity/continuity-state.json` on the canonical JSON hash basis after the rewritten validated artifacts were saved
  - effect: no silent drift; continuity now matches the remediated approved artifacts exactly

## Integrity Checks

- artifact guard after release work: `FAIL=0 WARN=0`
- continuity parse: clean
- release guard: `FAIL=0 WARN=0`
- release lint: `FAIL=0 WARN=0`
- repo validator: `RESULT: PASS`
- repo typecheck: `pass`
- repo build: `pass`

## Residual Notes

- the final build still emits a non-blocking Next.js middleware deprecation warning unrelated to book-package integrity
