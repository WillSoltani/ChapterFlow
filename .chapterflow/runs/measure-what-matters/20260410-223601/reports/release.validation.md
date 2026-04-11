# Release Validation Report: Measure What Matters

- Status: PARTIAL PASS WITH REPO-VALIDATOR BLOCKER
- Release file: release/measure-what-matters.modern.json
- Release assembly rule: PASS
- Source guard: PASS (`FAIL=0 WARN=0`)
- Release lint: PASS (`FAIL=0 WARN=0`)
- Release guard: PASS (`FAIL=0 WARN=0`)
- Repo build: PASS (`npm run build`)
- Repo validator: BLOCKED (`node scripts/book/validate-book.mjs ...`)

## What passed
- All 21 chapters are present in `validated/*.chapter.json`.
- Release package assembled directly from validated chapter JSON files only.
- Release chapter payloads match validated chapter payloads.
- Continuity hash seals were repaired to the canonical hash method required by the v13 release guard.
- Source discovery artifacts remain present and the source guard passes.
- Repo build completed successfully after release assembly.

## Blocker
- `scripts/book/validate-book.mjs` reports a package-shape and depth-contract mismatch across many already-sealed chapters, not only Chapter 21.
- The validator identifies expectations that conflict with the current v13-autonomous chapter corpus, including non-empty top-level `book.categories`, different recap shape expectations, and a stricter older depth contract.
- Rewriting validated chapters to satisfy that validator would mutate already-approved v13 chapter artifacts and violate the sealed-chapter path.

## Gate result
- ChapterFlow release assembly is complete and v13 release guards pass.
- Repo wiring should not continue until the repo validator path is aligned with the v13-autonomous package contract or explicitly replaced.
