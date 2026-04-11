# Release Validation Report — zero-to-one

## Release paths
- run-local release: `.chapterflow/runs/zero-to-one/20260410-152524/release/zero-to-one.modern.json`
- wired repo package: `book-packages/zero-to-one.modern.json`

## Outcome
- release assembled from validated chapters only: `yes`
- release chapter count: `14`
- release gate status: `pass`
- repo wiring status: `partial`
- final repo completion status: `blocked`

## Release-gate checks
- all numbered chapters validated: `yes`
- artifact guard after final wave: `FAIL=0 WARN=0`
- source guard: `FAIL=0 WARN=0`
- release guard: `FAIL=0 WARN=0`
- release-gate lint on run-local release: `FAIL=0 WARN=0`
- release-gate lint on wired repo package: `FAIL=0 WARN=0`

## Verified release facts
- release assembled by loading `validated/ch01.chapter.json` through `validated/ch14.chapter.json`
- chapters sorted by chapter number before assembly
- no chapter content regenerated during release assembly
- release chapter payloads match the validated chapter payloads used for sealing
- source ledger exists at `.chapterflow/runs/zero-to-one/20260410-152524/manifests/source-ledger.json`
- edition lock exists at `.chapterflow/runs/zero-to-one/20260410-152524/manifests/edition-lock.json`

## Repo-level checks
- `node scripts/book/validate-book.mjs book-packages/zero-to-one.modern.json`: `FAIL`
- `npm run build`: `BLOCKED`

## Blockers
1. `validate-book.mjs` is enforcing an older repo contract that conflicts with the v13 autonomous output shape.
   - It requires legacy canonical example formats (`postmortem`, `predict_reveal`, `before_after`) that are not part of the v13 chapterflow pack used for this run.
   - It also requires additional repo-level fields such as non-empty `book.categories` and `implementationPlan.ifThenPlans[*].context`, which the v13 run pack did not require or produce.
   - Repairing the release package to satisfy that older validator would conflict with the MasterGenerator and the sealed validated chapter artifacts.
2. `npm run build` is blocked by a concurrent `next build` lock.
   - The build command returned: `Another next build process is already running.`
   - The sandbox does not permit process inspection via `ps`, so the lock could not be cleared or verified locally from this run.

## Gate decision
- Release gate: `passed`
- Repo wiring: `written to book-packages`
- Repo validator/build phase: `stopped on true blocker`
