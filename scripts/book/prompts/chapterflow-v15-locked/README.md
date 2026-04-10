# ChapterFlow v15 Locked

ChapterFlow v15 Locked is the sealed, no-drift prompt pack.

It keeps the strong v11 chapter-writing path and removes the two regressions that caused bad later chapters:
1. manual approval stops
2. content-generation shortcuts after early good chapters

## What this pack is for

Use this pack when you want:
- title + author startup
- web-first source discovery and source freeze
- no human approval gates during the run
- strong ChapterFlow chapter quality across the whole book
- repo wiring after the final package exists
- no book cover generation or cover wiring

## What this pack forbids

- bulk generator scripts that author reader-facing content
- release assembly from non-validated artifacts
- mid-run human approval pauses
- cover generation
- legacy pack reuse outside PACK_ROOT

## Entry order

Read these files in order:
1. `prompt-starter.txt`
2. `OPERATING_CONTRACT.md`
3. `SCHEMA_NOTES.md`
4. `MasterGenerator-v15.md`
5. `RUN_ROOT/manifests/run-manifest.json`

## High-level architecture

1. Source discovery and freeze
2. Whole-book skeleton
3. Chapter 1 solo full loop
4. Chapter 2 solo full loop
5. Calibration lock
6. Remaining chapters in waves
7. Release assembly from validated chapters only
8. Repo integration without cover work
9. Cleanup

## Core rule

The pipeline may automate orchestration, validation, file writing, and repo integration.

It may not automate away the chapter loop.

Every reader-facing chapter must pass through:
- dossier / brief
- outline
- writer
- editor
- critic
- converter
- quiz
- validator
- patch/repair if needed
