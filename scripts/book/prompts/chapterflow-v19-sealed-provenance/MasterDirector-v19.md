# ChapterFlow MasterDirector v19

Read and obey in this order:
1. `README.md`
2. `OPERATING_CONTRACT.md`
3. `ARCHITECTURE.md`
4. `STATE_MACHINE.md`
5. `SOURCE_SUFFICIENCY.md`
6. `MasterValidator-v19.md`
7. `RUN_ROOT/manifests/run-manifest.json`

## Mission
Produce a final book JSON package through the real ChapterFlow pipeline without human approval gates and without generator shortcuts.

## Absolute prohibition
Do not generate the run tree from chapter metadata.
Do not synthesize chapters from seeds.
Do not write reader-facing chapter content in this Director session.
Do not create Python/Node scripts that author chapter prose, chapter JSON, examples, quizzes, or release content.

## Phase 0 — Preflight
- create missing run directories
- read the manifest
- write `reports/run-log.md`
- write `manifests/state.json`

## Phase 1 — Web-first source discovery and sufficiency gate
- discover candidate lawful sources online
- lock edition / translation
- write `source-freeze/source-lock.json`
- write `source-freeze/source-ledger.md`
- write `sidecars/source-heading-index.json` when possible
- write chapter-local source sidecars
- run the sufficiency test
- if insufficient, write `reports/source-blocker.md` and stop as `blocked`

## Phase 2 — Memory and skeleton
- compile concise memory cards from the style/rules files
- write `memory/style-memory.md`
- write role cards
- write `skeleton/book-skeleton.md`
- initialize `continuity/continuity-state.json`

## Phase 3 — Calibration chapters 1 and 2
For each of ch01 and ch02:
- write ticket
- write brief
- write outline
- write quiz blueprint
- write work orders for all stages
- run workers in order
- write stage receipts
- run provenance guard
- run artifact guard
- run commit tool

After both pass, write `continuity/calibration-lock.json`.
No human pause.

## Phase 4 — Remaining chapters in waves of up to 6
For each wave:
- create tickets / briefs / outlines / quiz blueprints for every chapter in the wave
- writer/editor/critic may run chapter-parallel
- structure/scenario may run chapter-parallel only after critic approval
- assembler/quiz/validator run after structure+scenario outputs exist
- every chapter must be committed individually before the wave is considered complete
- if quality drops below the calibration lock, stop and patch locally before moving on

## Per-chapter stage order
1. writer -> `drafts/canonical/chXX.md`
2. editor -> `drafts/edited/chXX.md`
3. critic -> `reports/chXX.critic.md`
4. structure worker -> `partials/chXX.structure.json`
5. scenario worker -> `partials/chXX.examples.json`
6. assembler -> `structured/chXX.chapter.json`
7. quiz worker -> `quizzes/chXX.quiz.json`
8. validator -> `validated/chXX.chapter.json`, `reports/chXX.validation.md`, `validated/chXX.review-package.json`
9. patch/repair only if required
10. commit tool

## Phase 5 — Release
- assemble `release/{bookId}.modern.json` from committed validated chapter JSONs only
- run release guard
- run repo validator script if available
- if release passes, mark state `release_validated`

## Completion
The core pipeline ends at:
- frozen sources
- validated chapter artifacts
- release artifact
- final book JSON package
- guards passing

No cover generation. Repo integration is outside core.
