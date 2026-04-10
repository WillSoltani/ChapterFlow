# Release Audit

## Assembly Source

- source policy used: validated chapters only
- manifest metadata source: `.chapterflow/runs/the-almanack-of-naval-ravikant/20260408-022212/manifests/run-manifest.json`
- release inputs:
  - `.chapterflow/runs/the-almanack-of-naval-ravikant/20260408-022212/validated/ch01.chapter.json`
  - `.chapterflow/runs/the-almanack-of-naval-ravikant/20260408-022212/validated/ch02.chapter.json`
  - `.chapterflow/runs/the-almanack-of-naval-ravikant/20260408-022212/validated/ch03.chapter.json`
  - `.chapterflow/runs/the-almanack-of-naval-ravikant/20260408-022212/validated/ch04.chapter.json`
  - `.chapterflow/runs/the-almanack-of-naval-ravikant/20260408-022212/validated/ch05.chapter.json`
  - `.chapterflow/runs/the-almanack-of-naval-ravikant/20260408-022212/validated/ch06.chapter.json`
- assembly rule applied: wrap the validated chapter files unchanged under one `schemaVersion: 1.1.0` package

## Release Output

- run-root release: `.chapterflow/runs/the-almanack-of-naval-ravikant/20260408-022212/release/the-almanack-of-naval-ravikant.modern.json`
- package id: `f8484662-e8f1-418e-8075-2a6028df539e`
- created at: `2026-04-08T14:35:21Z`

## Late Mechanical Repair

- repaired missing release-level book metadata in `manifests/run-manifest.json`
  - fields added: `categories`, `tags`, `edition`
  - source used: sealed book metadata already present in the run's validated review package
  - reason: `chapterflow_v16_build_release.py` reads release-level book metadata from the run manifest, and the missing fields caused the repo validator to fail on `book.categories`
  - action: updated the run manifest, rebuilt the release package, and left all chapter payloads unchanged

## Integrity Checks

- release guard: `PASS: release guard clean`
- repo validator: `RESULT: PASS`
- chapter fidelity: release `chapters[]` match validated `ch01` through `ch06` exactly under the release guard

## Residual Note

- `chapterflow_v16_build_release.py` emits a non-blocking Python deprecation warning for `datetime.utcnow()`, but the release artifact itself is valid and sealed
