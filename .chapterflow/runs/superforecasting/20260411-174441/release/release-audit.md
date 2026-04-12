# Release Audit Report

Book:
- `superforecasting`
- `Superforecasting: The Art and Science of Prediction`

Release artifact:
- `release/superforecasting.modern.json`

Assembly audit:
- chapter source count: 12 validated chapter JSON files
- chapter order: 1 through 12, sorted numerically during assembly
- release book object copied from validated chapter book metadata
- release chapter payloads assembled without regeneration

Integrity audit:
- source ledger present
- edition lock present
- source freeze directory present
- release guard passed after continuity reseal
- review-package payload checks for Chapters 11 and 12: exact match to validated chapter payloads

Continuity audit:
- `ch11`: `e8aba491199b75f20958540649ce96dd7e58bac4f52dc6ef1f32b0733ac50015`
- `ch12`: `452f448c655438ef5b8cd8f5c569ea71396309b4b8dee4c65d08d80ae5704368`

Outstanding blocker:
- repo validator `validate-book.mjs` does not accept the assembled package under its current profile detection and rule set
