# Release Validation Report

Book: smarter-faster-better
Release path: .chapterflow/runs/smarter-faster-better/20260410-223734/release/smarter-faster-better.modern.json
Validated at: 2026-04-11T04:33:00Z

Assembly checks:
- release assembled from validated chapter JSON only: pass
- numbered chapters included: 8
- chapter order sorted by number: pass
- continuity seals preserved on canonical validated chapter JSON hashes: pass

Gate checks:
- source guard: `FAIL=0 WARN=0`
- release guard: `FAIL=0 WARN=0`
- release lint: `FAIL=0 WARN=0`
- package validator: `RESULT: PASS`

Warnings documented:
- `validate-book.mjs` reported 4 non-blocking prose warnings on reusable one-minute-recap stems in Chapters 2-5.

Status:
- pass
