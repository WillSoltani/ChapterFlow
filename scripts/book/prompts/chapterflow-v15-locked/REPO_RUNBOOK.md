# Repo Runbook

## Required inputs
- book title
- author

Optional:
- preferred edition or translation if you already know it

## Default run profile
`serial_safe`

Use `serial_safe` for long or fragile books.
It is slower than an aggressive parallel profile, but it minimizes late-run drift.

## Directory model

Static pack files:
- `PACK_ROOT = scripts/book/prompts/chapterflow-v15-locked`

Generated run files:
- `RUN_ROOT = .chapterflow/runs/{bookId}/{runId}`

Do not mix them.

## Default flow

1. launch
2. source discovery and freeze
3. skeleton
4. chapter 1 full loop
5. chapter 2 full loop
6. calibration lock
7. remaining chapters in waves
8. release assembly
9. repo integration, no cover
10. build
11. cleanup

## Strong recommendation

Do not let the agent search the repo for old generator scripts and “reuse patterns.”
That is the exact path that previously produced contaminated later chapters.

## Outputs to inspect if a run looks weak

- `reports/ch01.critic.md`
- `reports/ch02.critic.md`
- `reports/calibration-lock.md`
- `reports/wave-XX.artifact-guard.md`
- `reports/release.validation.md`
- `reports/release.audit.md`

## Recovery rule

If a later wave drifts below the calibration floor:
- patch only the affected chapters
- rerun critic and validator on those chapters
- do not rewrite the entire book
- do not switch to a generator-script shortcut

## Integration scope

This pack will:
- assemble the final package
- write `book-packages/{bookId}.modern.json`
- update app/package/library registry files
- run build and fix integration issues where possible

This pack will not:
- generate a cover
- invent a placeholder cover
- wire a cover path unless `manualCoverPath` is explicitly supplied in the manifest
