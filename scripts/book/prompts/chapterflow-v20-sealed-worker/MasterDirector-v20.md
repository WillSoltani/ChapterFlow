# ChapterFlow MasterDirector v20

Read and obey in this order:
1. `README.md`
2. `OPERATING_CONTRACT.md`
3. `ARCHITECTURE.md`
4. `STATE_MACHINE.md`
5. `SOURCE_SUFFICIENCY.md`
6. `TICKET_SPEC.md`
7. `WORKER_SPAWN_PROTOCOL.md`
8. `COMMIT_PROTOCOL.md`
9. `MasterValidator-v20.md`
10. `RUN_ROOT/manifests/run-manifest.json`

## Mission
Run the real ChapterFlow workflow end-to-end without human approval gates and without generator shortcuts.

## Phase 0 — Preflight
- read manifest
- create missing run directories
- write `reports/run-log.md`
- write `manifests/state.json`
- run pack audit
- if audit fails, block

## Phase 1 — Web-first source discovery and sufficiency
- discover lawful sources
- lock edition/translation
- write `source-freeze/source-lock.json`
- write `source-freeze/source-ledger.md`
- write chapter-local source sidecars
- run source sufficiency tool
- if insufficient, block

## Phase 2 — Memory and skeleton
- compile concise memory files from style/rules
- write role cards
- write `skeleton/book-skeleton.md`
- initialize continuity state

## Phase 3 — Calibration chapters 1 and 2
For each of ch01 and ch02:
- write ticket
- write brief
- write outline
- write quiz blueprint
- write work orders
- spawn writer in a fresh worker session
- spawn editor in a fresh worker session
- spawn critic in a fresh worker session
- if critic requests local fixes, patch only locally
- spawn structure worker
- spawn scenario worker
- spawn assembler
- spawn quiz worker
- spawn validator
- if needed, patch/repair only local flagged areas
- run provenance guard
- run artifact guard
- run commit tool

After both chapters commit, write `continuity/calibration-lock.json`.
No human pause.

## Phase 4 — Remaining chapters in waves of up to 6
For each wave:
- create tickets/briefs/outlines/quiz blueprints
- writer/editor/critic may run chapter-parallel in separate fresh worker sessions
- structure/scenario may run only after critic pass for that chapter
- assembler/quiz/validator may run only after structure+scenario exist for that chapter
- each chapter must commit individually before wave completion
- if later quality falls below calibration lock, stop and repair locally before continuing

## Phase 5 — Release
- assemble `release/{bookId}.modern.json` from committed validated chapter JSONs only
- run release guard
- run repo validator script if available
- if release passes, mark state `release_validated`

## Completion
Core pipeline ends at:
- frozen sources
- validated chapter artifacts
- release artifact
- final book JSON package
- guards passing

No cover generation.
