# Release Validation Report

- release path: `.chapterflow/runs/pitch-anything/20260409-001452/release/pitch-anything.modern.json`
- assembly rule: built from `validated/ch*.chapter.json` only
- source guard: PASS (`FAIL=0 WARN=0`)
- release-gate lint: PASS (`FAIL=0 WARN=0`)
- release guard: PASS (`FAIL=0 WARN=0`)
- repo validator: PASS (`node scripts/book/validate-book.mjs .chapterflow/runs/pitch-anything/20260409-001452/release/pitch-anything.modern.json`)

## Repaired Deviations Before Final Pass

- Continuity sealing drift was detected during the first release-guard run.
  The continuity file stored text-based chapter hashes for most chapters, while the release guard verifies canonical chapter-object hashes.
  Repair action: resealed `continuity/continuity-state.json` from canonical validated chapter objects and reran the guard to clean pass.

- Release-path drift was detected during first release assembly.
  A temporary file was written to `release/pitch-anything.release.json` before the pack-required `release/{bookId}.modern.json` target was restored.
  Repair action: rewrote the authoritative release artifact to `release/pitch-anything.modern.json`, then reran lint and release guard against that path.

- Repo validator drift was detected on the first package validation pass.
  `ch09`-`ch11` were valid for the v13 pack gates but too thin for the repo package contract, and a small set of earlier chapters missed stricter word floors by 1-6 words.
  Repair action: repaired the structured source of truth for `ch09`-`ch11`, normalized their takeaway / recap / prompt / review-card shapes to the repo validator contract, patched the small earlier count misses in `ch02`-`ch06`, regenerated validated bundles and review wrappers, resealed continuity, rebuilt the release artifact from validated chapters only, and reran the repo validator to clean pass.

## Residual Warnings

- `validate-book.mjs` reports 4 prose warnings only:
  - `ch09.hard.chapterBreakdown.gentle` opens thesis-first
  - `ch10.easy.chapterBreakdown.gentle` opens thesis-first
  - `ch10.hard.chapterBreakdown.gentle` opens thesis-first
  - `ch11.easy.chapterBreakdown.competitive` opens thesis-first
- These are warnings, not release blockers.
