# Release Validation Report

- book: Never Split the Difference: Negotiating as if Your Life Depended on It
- run: 20260409-003831
- release artifact: .chapterflow/runs/never-split-the-difference/20260409-003831/release/never-split-the-difference.modern.json
- repo package: book-packages/never-split-the-difference.modern.json
- status: pass

## Release Gate Checks

- all numbered chapters validated: pass
- release assembled from validated chapters only: pass
- release guard: pass (`FAIL=0 WARN=0`)
- artifact guard: pass (`FAIL=0 WARN=0`)
- repo package validator: pass
- release-gate lint: pass (`FAIL=0 WARN=0`)
- build: pass

## Repair Record

- deviation detected: continuity seals were stored as raw file-byte hashes while the release guard checks canonical JSON chapter hashes
- repair applied: resealed continuity hashes canonically for `ch01` through `ch10`
- dependent artifacts updated: reading metrics, chapter validation reports, run log, release artifact, and repo package
- additional repair applied: expanded under-minimum structured breakdown variants in `ch08`, `ch09`, and `ch10`, then resealed and revalidated those chapters

## Remaining Warnings

- `validate-book.mjs` reported 69 prose warnings for thesis-first opening sentences across multiple chapter variants
- warning disposition: documented only; validator result remained `PASS`

## Final Decision

- release gate: passed
- repo wiring and build gate: passed
