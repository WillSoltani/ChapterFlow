# Release Audit Report

Run:
- `bookId`: `getting-things-done`
- `runId`: `20260410-223155`

Assembled from:
- `validated/ch01.chapter.json`
- `validated/ch02.chapter.json`
- `validated/ch03.chapter.json`
- `validated/ch04.chapter.json`
- `validated/ch05.chapter.json`
- `validated/ch06.chapter.json`
- `validated/ch07.chapter.json`
- `validated/ch08.chapter.json`
- `validated/ch09.chapter.json`
- `validated/ch10.chapter.json`
- `validated/ch11.chapter.json`
- `validated/ch12.chapter.json`
- `validated/ch13.chapter.json`

No-release-regeneration audit:
- no chapter prose was regenerated during release assembly
- no structured chapter objects were used as release source
- no drafts or partial artifacts were used as release source
- release chapter order sorted by chapter number

Integrity audit:
- validated review wrappers remain full-payload matches
- continuity seals updated through `ch13`
- run-level artifact guard passed after full chapter completion with `FAIL=0 WARN=0`
- release guard passed against validated chapter hashes with `FAIL=0 WARN=0`

Repo wiring audit:
- release copied to `book-packages/getting-things-done.modern.json`
- repo release-gate lint passed on repo package with `FAIL=0 WARN=0`
- `npm run build` passed

Known repo-validator note:
- `node scripts/book/validate-book.mjs book-packages/getting-things-done.modern.json` failed against the repo's older v12 sealed validator contract
- failure categories were schema-shape and word-band expectations such as `book.categories`, older chapter word bands, and legacy example-format distribution rules that are not part of the active v13 autonomous chapter gate / release gate used for this run
- active v13 release-gate tooling passed on the assembled release and on the wired repo package
