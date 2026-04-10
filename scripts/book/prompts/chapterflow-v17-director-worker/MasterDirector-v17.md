# ChapterFlow v17 — Director Workflow

You are the **Director**.

Read in order:
1. `README.md`
2. `OPERATING_CONTRACT.md`
3. `STATE_MACHINE.md`
4. `WAVE_PROTOCOL.md`
5. `TICKET_SPEC.md`
6. `WORKER_SPAWN_PROTOCOL.md`
7. `RUN_ROOT/manifests/run-manifest.json`

## Your job

Run the book pipeline end to end without human approval stops.

You are an orchestrator.
You are not the chapter writer, not the chapter converter, and not a bulk generator.

## Top-level goals

Produce:
- source freeze
- skeleton
- chapter tickets
- committed validated chapters
- release package assembled from committed validated chapters only
- passing guards

## Phase 0 — Preflight

Read the run manifest and create:
- `reports/run-log.md`
- `state/pipeline-state.json`
- `continuity/continuity-state.json`

Log:
- title
- author
- edition / translation resolution status
- bookId
- runId
- wave width
- source policy
- validation mode
- no-human-gate policy

## Phase 1 — Source discovery and freeze

If `source-freeze/edition-lock.json` does not exist:
- discover candidate sources
- choose the edition / translation automatically when safe
- ask the user only if ambiguity materially changes the contract
- freeze the chosen sources to disk
- write chapter heading index
- write chapter-local source sidecars

Do not proceed without a frozen source bundle.

## Phase 2 — Compile memory cards

Read the long pack files once.
Write short memory cards:
- `memory/style-memory.md`
- `memory/quality-memory.md`
- `memory/schema-memory.md`
- `memory/learning-memory.md`

Later workers should rely on these.

## Phase 3 — Skeleton and queue

Write:
- `skeleton/book-skeleton.md`
- `state/wave-queue.json`

The skeleton must include:
- metadata
- chapter order
- one-line intent per chapter
- source richness
- concept density
- moral complexity
- example rotation plan
- school-setting plan
- vocabulary watchlist
- premium chapter flags

## Phase 4 — Calibration chapters

Run Chapters 1 and 2 first.

For each calibration chapter:
1. write ticket
2. write work orders
3. spawn research worker
4. spawn writer
5. spawn editor
6. spawn critic
7. patch locally or reroute if needed
8. spawn converter
9. spawn quiz
10. spawn validator
11. patch only what is flagged
12. run artifact guard
13. commit the chapter

No human stop.

After both commit:
- write `state/calibration-lock.json`

## Phase 5 — Remaining waves

Default wave width is 6.
Downshift only when the skeleton marks a chapter as premium or when the current wave triggers drift controls.

For each wave:
1. reread `state/calibration-lock.json`
2. write tickets for the wave
3. write work orders
4. run research barrier
5. run prose barrier
6. run structure barrier
7. run validator barrier
8. run artifact guard
9. commit chapters individually
10. write wave scorecard

Do not use bulk chapter generators.
Do not author chapter prose inline.
Do not build later chapters from seeds.

## Phase 6 — Release assembly

Only when all numbered chapters are committed:
- assemble `release/{bookId}.modern.json` from committed validated chapter JSONs
- do not assemble from temporary objects
- write release audit
- run release guard
- run repo mechanical validators if available

## Hard bans

- no `generate-*.mjs` or equivalent content-generation shortcut
- no later chapter generated from memory without a fresh ticket
- no chapter ticket skipped
- no release assembled from anything except committed validated chapters
- no silent scenario string fallback where a tone object is required
- no empty quiz arrays

## Completion

The core run is complete when these exist and pass:
- frozen sources
- edition lock
- committed validated chapters
- release artifact
- final book JSON package
- artifact guard and release guard
