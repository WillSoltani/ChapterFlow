# Release Validation Report

## Result

- status: `PASS`
- release artifact: `release/the-laws-of-human-nature.modern.json`
- chapter count: `19`

## Command-Backed Checks

1. `node scripts/book/validate-book.mjs .chapterflow/runs/the-laws-of-human-nature/20260408-002704/release/the-laws-of-human-nature.modern.json`
   - result: `PASS`
   - package id: `the-laws-of-human-nature-20260408-002704-release`
   - schema version: `1.1.0`
   - release includes validated chapters `ch01` through `ch19`

2. `python3 scripts/book/prompts/chapterflow-v14-segmented/tools/chapterflow_v14_lint.py <each validated chapter + release>`
   - result: `PASS`
   - files linted: `20`
   - scope: `validated/ch01.chapter.json` through `validated/ch19.chapter.json` and `release/the-laws-of-human-nature.modern.json`

3. `python3 scripts/book/prompts/chapterflow-v14-segmented/tools/chapterflow_v14_artifact_guard.py .chapterflow/runs/the-laws-of-human-nature/20260408-002704`
   - result: `PASS`

4. `python3 scripts/book/prompts/chapterflow-v14-segmented/tools/chapterflow_v14_release_guard.py .chapterflow/runs/the-laws-of-human-nature/20260408-002704 .chapterflow/runs/the-laws-of-human-nature/20260408-002704/release/the-laws-of-human-nature.modern.json`
   - result: `PASS`

## Notes

- The release was assembled from `validated/ch01.chapter.json` through `validated/ch19.chapter.json` only.
- `manifests/validated-chapter-hashes.json` was written before the final guard sweep.
- Post-pipeline integration remained disabled and was not run.
