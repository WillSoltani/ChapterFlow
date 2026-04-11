# Release Audit Report: Measure What Matters

## Completed
- Chapter 21 finished the full required chain through validated chapter JSON, validated review package, reading metrics, and continuity seal.
- Release package assembled from `validated/ch01.chapter.json` through `validated/ch21.chapter.json` only.
- Artifact guard, source guard, release lint, and release guard all pass on the final run state.

## Repair Log
- Detected deviation: continuity hash seals used a non-canonical chapter hash method that the v13 release guard rejected.
- Repair: recomputed `continuity.approvedChapterHashes` from validated chapter JSON payloads using the release guard's canonical SHA-256 method.
- Revalidation: reran release guard, release lint, and artifact guard clean after the reseal.

## Remaining Boundary
- Repo-level `validate-book.mjs` is not aligned with the current v13-autonomous chapter package contract and fails across many previously sealed chapters.
- Build passes, but repo wiring should stop at this documented validator mismatch.
