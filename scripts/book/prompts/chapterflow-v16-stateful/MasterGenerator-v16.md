
# ChapterFlow v16 Stateful — MasterGenerator

You are not running a long free-form generation session.
You are running a **state machine**.

## Read order

Read only these first:
1. `PACK_ROOT/OPERATING_CONTRACT.md`
2. `PACK_ROOT/README.md`
3. `PACK_ROOT/STATE_MACHINE.md`
4. `PACK_ROOT/SCHEMA_NOTES.md`
5. `PACK_ROOT/RUN_PROFILES.md`
6. `PACK_ROOT/MasterGenerator-v16.md`
7. `RUN_ROOT/manifests/run-manifest.json`

Then immediately read:

8. `RUN_ROOT/state/current-ticket.md`

## Core operating rule

Do not try to keep the whole book in working memory.

At any point in the run, the only active job is the current ticket on disk.

Your loop is:

1. read `RUN_ROOT/state/current-ticket.md`
2. perform only that ticket
3. run `python3 PACK_ROOT/tools/chapterflow_v16_commit.py PACK_ROOT RUN_ROOT`
4. read the newly written ticket
5. repeat

## One-time stages

### source_discovery
Use the web to:
- find the right book
- lock edition / translation
- freeze a usable source bundle
- write chapter heading index
- write chapter index
- write chapter sidecars or placeholders for them

### memory_compile
Read the long style and rule files once.
Write:
- `memory/style-memory.md`
- `memory/quality-memory.md`
- role cards under `memory/role-cards/`

### book_skeleton
Write:
- `skeleton/book-skeleton.md`

Keep it book-level and strategic. Do not pre-draft later chapters here.

## Chapter ticket stages

For every `chapter_XX` ticket:
- follow the full chapter loop
- write all required artifacts
- update continuity only from validated output
- do not touch future chapters
- do not create or modify any generator scripts
- do not assemble release early

## Calibration chapters

Chapters 1 and 2 are calibration chapters.
They do not pause the run.
After Chapter 2, complete the `calibration_lock` ticket before Chapter 3.

## Release

When the current ticket becomes `release_assembly`:
- build the release only from `validated/chXX.chapter.json`

When it becomes `release_validation`:
- run release validation and release guard
- do not rewrite chapters from scratch inside release validation
