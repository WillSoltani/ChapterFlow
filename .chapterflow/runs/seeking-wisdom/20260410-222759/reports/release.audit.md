# Release Audit Report

Run:
- `bookId`: `seeking-wisdom`
- `runId`: `20260410-222759`

Assembled from:
- `validated/ch01.chapter.json`
- `validated/ch02.chapter.json`
- `validated/ch03.chapter.json`
- `validated/ch04.chapter.json`
- `validated/ch05.chapter.json`
- `validated/ch06.chapter.json`

No-release-regeneration audit:
- no chapter prose was regenerated during release assembly
- no structured chapter objects were used as release source
- no drafts or partial artifacts were used as release source
- release chapter order sorted by chapter number

Integrity audit:
- validated review wrappers remain full-payload matches
- continuity seals updated after the Chapter 1 and Chapter 2 contamination repair
- run-level artifact guard passed after repair with `FAIL=0 WARN=0`

Repo wiring audit:
- release copied to `book-packages/seeking-wisdom.modern.json`
- repo release-gate lint passed on repo package with `FAIL=0 WARN=0`
- `npm run build` passed

Known repo-validator note:
- `node scripts/book/validate-book.mjs book-packages/seeking-wisdom.modern.json` failed against the repo's older v12 sealed validator contract
- failure categories were schema-shape expectations such as `book.categories`, `exampleId`, `contexts`, and word-band contracts that were not part of the active v13 autonomous chapter gate / release gate used for this run
- release-gate tooling for the active pack passed after repair
