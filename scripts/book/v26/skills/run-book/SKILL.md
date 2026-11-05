---
name: run-book
description: Use when the owner wants a book written with the ChapterFlow v26 chapter tool from nothing to a reading pack (a new title, "run <book> from 0 to 100", "make the next book"), or when resuming a book run that stopped on auth, budget, a usage limit or a crash.
---

# Run a book from zero to a reading pack

## Overview

The v26 tool (`scripts/book/v26` in the worktree `~/cf-wt/v26-lesson-first`, branch `v26/variants`) writes one
book in the form of a chapter the owner approved. Code gates are facts, quiz keys and render; the owner's reading is
the only taste gate. Never add a judge, rubric or reader panel in its place. The run has exactly two owner waits:
picks on one chapter's pick page, and approval of the chapter assembled from those picks. Everything else runs
unattended and resumes from files.

**REQUIRED READING:** `reference.md` in this skill's folder holds every step with its command, the config and
brief templates, what each check prints, the hand-off and the failure table. Follow it in order; the README is
background, not the procedure.

## Quick reference

`CLI` = `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY npx tsx scripts/book/v26/cli.ts`, run from the worktree.
`--chapters` takes comma-separated numbers only: `$(seq 2 48 | paste -sd, -)`.

| Step | Command | Owner |
|---|---|---|
| 0 Preflight | `git log -1`; `<binary> auth status`; the test suite once | login only if auth fails |
| 1 Config + brief | copy `books/the-48-laws-of-power-sonnet.json` (knowledge) or `books/the-autobiography-of-benjamin-franklin.json` (text); `CLI status --book <cfg>` loads it | |
| 2 Keys (knowledge mode) | `CLI keys --book <cfg>` (drafted by the fixer, Opus) | skim or edit |
| 3 Variants | `CLI variants --book <cfg> --chapters 1` | **pick** one per part, notes, Copy my picks |
| 4 Assemble | `CLI assemble --book <cfg> --chapters 1 --picks <runDir>/ch01/variants/picks.txt`, then `CLI fix --book <cfg> --chapters 1` (at most twice) | **approve** the exemplar, name the openers |
| 5 Tune exemplar | `<runDir>/exemplars/ch01.json`: `approved.summary`, `bookNames` | |
| 6 Book | `CLI book --book <cfg> --chapters 2,3,...` in the background, log wrapped with `date` and `EXIT $?` | |
| 7 Fix passes | `CLI fix --book <cfg> --chapters 2,3,...` (at most two passes) | |
| 8 Pack | `CLI pack --book <cfg> --chapters 1,...,N --out <runDir>/reading/all.html`; `open` it and, in the Claude app, attach it with SendUserFile | reads a sample |

## Models and cost (owner decision 2026-11-05)

Writer Sonnet 5.5 high; checker and fixer Opus 5.5 high (the fixer defaults to the checker when the field is
absent); solver Sonnet 5.5 medium. Keys are drafted by the fixer. Estimate $5 + chapters x $0.9 + a third of the
chapters x $0.6: a 13-chapter book about $20, a 48-chapter book about $60. Each book gets its own ledger (no
`ledgerPath`) and a `budgetUsd` of twice the estimate.

## Red flags: stop and read reference.md

- Running from `~/ChapterFlow` instead of the worktree, or with an API key in the environment.
- A chapter still open after two fix passes: the checker's inference bar, not a wrong fact. Hand the flags over.
- `names off limits:` on `book`'s first log line showing one of the book's own people or places.
- Every chapter opening the same way (`approved.summary` holds one letter).
- Wanting to regenerate a chapter the owner disliked: it goes through `variants` and `assemble` on that chapter
  and becomes an added exemplar.
- Thinking the tool publishes. Its output is `<runDir>/chNN/final.json` per chapter and the reading pack; putting a
  book into the app (book packages, ship, deploy) is the owner's separate step.

## Done

The owner can open `<runDir>/reading/all.html` and read every chapter; `status` shows every chapter clean or the
open flags are quoted in the hand-off; one dated line is in `~/cf-wt/v26-plan/status/V1-variants.md` and in the
`v26-campaign` memory file; the config (with keys) and brief are committed on `v26/variants`.
