---
name: run-book
description: Use when the owner wants a book written with the ChapterFlow v26 chapter tool from nothing to a scored, published book (a new title, "run <book> from 0 to 100", "make the next book"), or when resuming a book run that stopped on auth, budget, a usage limit or a crash.
---

# Run a book from zero to a published book

## Overview

The v26 tool (`scripts/book/v26` in the worktree `~/cf-wt/v26-lesson-first`, branch `v26/variants`) writes one
book in the form of a chapter the owner approved, scores it, and publishes it through a gate the owner set. Code
gates are facts, quiz keys and render; the owner's reading decides the calibration chapter and any band that asks.
With the house exemplar (`exemplarFrom` in the config, the default for new books: `scripts/book/v26/house`, the
owner's approved 48 Laws chapter 1 revised to the reader bar) the run has no owner wait at all unless the score
lands in the manual band or fails. The exemplar sets the bar; a per-chapter plan, computed from the chapter
number and the book id, sets each chapter's order, so no two neighbours share a shape. Only a book that is
to set a new form goes through the pick page (two waits: picks, then approval of the assembled chapter). Everything
else runs unattended and resumes from files.

**REQUIRED READING:** `reference.md` in this skill's folder holds every step with its command, the config and
brief templates, what each check prints, the hand-off and the failure table. Follow it in order; the README is
background, not the procedure.

## What the owner sees (owner's instruction, 2026-11-12)

The session writes the book itself and shows the owner ONE thing: each chapter's score and the average, then one
line saying where the book stands. No pack, no sample read, no list of flags, no cost, unless the owner asks.

```
| Chapter | Score |
| 1 | 97.6 |
| ... |
| Average | 96.1 |
LIVE in the app, version 7. Cover: new (daylight-photo).
```

The numbers are the `chapter scores:` line `auto` prints just before its outcome (also `chapterScores` in
`<runDir>/auto.json`). Then, by outcome:

- **PUBLISHED** (band auto, 80 and up): it published itself. The owner's standing instruction is "if good enough
  it automatically pushes and makes it live", so run `auto` without `--no-publish` and ask nothing. If the app's
  permission check stops the publish step, ask one yes-or-no question ("Publish <title>? Average 96.1.") and on a
  yes run the identical command again. Status line: `LIVE in the app, version N.` Then do the public-site step
  (reference.md section 1B: `site` in a fresh worktree of main, its checks, a pull request) and add to the status
  line: `Public site: pull request <url>. Merge it BEFORE any deploy, then deploy.` This holds for a replaced
  title too: main must hold the live package, or the next deploy puts the old one back. The order is the whole
  point: a deploy approved while that pull request is still open uploads main's older package over the live one
  (it happened to The Power of Habit on 2026-11-12). If the owner starts a deploy first, say so at once, in plain
  words, and tell them not to approve the waiting run.
- **NEEDS-OWNER, band manual**: show the table and the reason in one line (for example "ch06 is under 70" or
  "TRY fails in 5 of 8 chapters"), and ask: "Publish anyway?" Yes: `auto --approve`. No: leave it and stop.
- **NEEDS-OWNER, keys could not be checked**: run the identical command once more. If it holds again, ask: "The
  chapter notes could not be checked on the web. Write the book from them as they are?" Yes: `auto --keys-ok`. When
  the reason also lists `chNN: both checkers say ...` or `came back headed ...` lines, handle those first as below.
- **NEEDS-OWNER, chapter list or empty note** (`chNN: both checkers say ...`, `came back headed ...`, `the note has
  no lesson ...`): check the book's table of contents on the web first. If the config's list is wrong, fix it and
  the notes under it, delete `<runDir>/keys/checked.json` and `check-progress.json`, and run again; tell the owner
  in one line. If the list is right, ask: "The checkers doubt chapter N's title (they say "..."). Keep the list as
  it is?" Yes: `auto --keys-ok`. An empty note is never passed with `--keys-ok`: write its advice in, or delete it
  so it is drafted again.
- **FAILED, band fail**: show the table and ask: "Rewrite chapters X, Y?" Yes: `auto --redo`, then show the new
  table. Once; a second fail is reported as it stands.
- **FAILED on an error, usage limit, budget**: say which in one line and what happens next (the identical command
  resumes it); no table until there is a score.

Ask with the app's question buttons, one question, two answers. Everything else the steps below call for (the
housekeeping commit, the status line in the kit, the memory line) is done without telling the owner. The sample
read of step 8 is not done unless the owner asks for it.

## The one command (a book with `exemplarFrom`, the default)

`CLI` = `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY npx tsx scripts/book/v26/cli.ts`, run from the worktree.

After the preflight and the config and brief (steps 0 and 1; the chapter list from the book's table of contents on
the web, never from memory), `CLI auto --book <cfg>` runs the rest in one
resumable run: keys drafted and checked against the book on the web, chapters, two fix passes, repairs, the pack,
the score, one round on what the judge failed in the manual band, and the publish the band allows. Run it in the
background with a log; after any stop (usage limit, budget, crash) run the identical command again. It ends
`PUBLISHED`, `READY` (`--no-publish`), `DRY-RUN`, `NEEDS-OWNER` (exit 1) or `FAILED` (exit 2), with the reasons on
the last line and in `<runDir>/auto.json`. Many books: `CLI auto --queue <file>` (one config path per line), one
line per book in `<file>.report.jsonl`.

While `auto` runs, make the book's cover (reference.md section 1C): choose one picture from the book, `CLI cover
--book <cfg> --concept "..."`, generate it with the Higgsfield CLI (the `generate:` line that command prints), look at
it, `CLI cover --book <cfg> --image <file>`. Installed before the publish, it ships with the package and the site
pull request. With a queue, make the cover for every book in the file, in the file's order, as soon as the queue
is running. `auto` makes no cover itself: when a book's outcome line says `no cover made in this run`, make it then.

Three flags are the owner's rulings and are passed only when the owner gave them, for one book, never with
`--queue`: `--approve` (yes to the pack they read; taken only while the book waits and the chapters are unchanged),
`--keys-ok` (their word for the notes; skips the web check), `--redo` (rewrite a failed book's redo list, once per
score). Each is passed only on the owner's yes to the matching question above. After `auto`: show the score
table, do the housekeeping. reference.md section 1A has the details.

## The steps by hand (what `auto` runs; for a book that sets a new form, or to repair one stage)

`--chapters` takes comma-separated numbers only: `$(seq 2 48 | paste -sd, -)`.

| Step | Command | Owner |
|---|---|---|
| 0 Preflight | `git log -1`; `<binary> auth status`; the test suite once | login only if auth fails |
| 1 Config + brief | copy `books/the-48-laws-of-power-sonnet.json` (knowledge) or `books/the-autobiography-of-benjamin-franklin.json` (text); the chapter list from the book's table of contents on the web (publisher page, library record, preview), never from memory; `CLI status --book <cfg>` loads it | |
| 2 Keys (knowledge mode) | `CLI keys --book <cfg>` (drafted by the fixer, Opus) | skim or edit |
| 3 Variants (only without `exemplarFrom`) | `CLI variants --book <cfg> --chapters 1` | **pick** one per part, notes, Copy my picks |
| 4 Assemble (only without `exemplarFrom`) | `CLI assemble --book <cfg> --chapters 1 --picks <runDir>/ch01/variants/picks.txt`, then `CLI fix --book <cfg> --chapters 1` (at most twice) | **approve** the exemplar, name the openers |
| 5 Tune exemplar (only without `exemplarFrom`) | `<runDir>/exemplars/ch01.json`: `approved.summary`, `bookNames` | |
| 6 Book | `CLI book --book <cfg> --chapters 1,2,...` (from 2 when chapter 1 is this book's own exemplar) in the background, log wrapped with `date` and `EXIT $?` | |
| 7 Fix passes | `CLI fix --book <cfg> --chapters 2,3,...` (at most two passes) | |
| 8 Pack and read | `CLI pack --book <cfg> --chapters 1,...,N --out <runDir>/reading/all.html`; read three chapters as the default reader (hook, short summary, first example, questions 1 to 5, plan); `open` it and, in the Claude app, attach it with SendUserFile | reads a sample |
| 9 Score | `CLI score --book <cfg>` (0 to 100; exit 0 auto, 1 manual, 2 fail) | |
| 10 Publish | auto: `CLI publish --book <cfg>` at once. Manual: one `fix --issues` pass if the reason is a repeated kind a small edit fixes, then score again; else hand over the pack and the reasons, publish with `--approve` on a yes. Fail: hand over the redo list, and only with a yes `book --force` those chapters, then steps 7 to 10 again | **yes** on manual; **permission** to redo on fail |

## Models and cost (owner decisions 2026-11-05 and 2026-11-11)

Writer Opus 5.5 high for every new book (owner decision 2026-11-11: under the reader bar blind readers preferred
Opus chapters 6 of 6, overall 8.0 against 6.8; Sonnet was the writer before that). The template configs still name
Sonnet, the writer of the books they describe: set `writer` to the checker's model in the new config. Checker and
fixer Opus 5.5 high (the fixer defaults to the checker when the field is absent); solver Sonnet 5.5 medium. Keys
are drafted by the fixer and checked by two checker calls with web search (about $0.35 a chapter, knowledge mode
only). Estimate $5 + chapters x $1.75 + a third of the chapters x $0.6: a 13-chapter book about $30, a 48-chapter
book about $100. Each book gets its own ledger (no
`ledgerPath`) and a `budgetUsd` of twice the estimate.

## The gate (owner decision 2026-11-05)

Score = mean over chapters of the share of judge items passed (the judge calibrated on the owner's labels, plus
one item per quiz question since 2026-11-10: is a wrong choice really tempting). Bands from the config's `gate`
(default `auto` 80, `manual` 70): 80 and up publishes unread, provided no chapter is under 70, no fact or key flag
is open, and no kind of item is weak in half the chapters (the repeat rule: a flaw in every chapter costs about one
item in sixty, so the mean hides it; a reader does not); 70 to 79 waits for the owner's yes; under 70 fails and is
redone only with permission. A wrong fact never publishes unread. Calibration: the owner-approved 48 Laws scored 97 and 100 on its
first two chapters.

Since 2026-11-13 the judge also asks, per quiz question, whether the keyed choice is the only sound answer
(`KEY-<q>`) and whether the right choice can be spotted by its wording (`TELL-<q>`), and, per chapter, whether the
examples and the questions show different sides of the lesson (`VARY-examples`, `VARY-quiz`). The quiz carries four
items per question (`QUIZ`, `TEMPT`, `KEY`, `TELL`) plus one for the set (`VARY-quiz`), about half of a chapter's
items. A saved eval from an older judge is asked again, so `score` on a book published before then re-judges every
chapter (about $0.27 each) and its band can change. `score.json` names its judge too: `publish` refuses a score an
older judge gave, so score the book again first.

How to read the new scale: a chapter of the published quality scores about 83 where the old judge gave about 94. On
the 18 reader-rated chapters, chapters strict LLM readers gave 6 of 10 average about 78, 7 about 84, 8 about 86 (averages; the groups overlap widely).
The writer has carried these rules since 2026-11-13 (no forecast questions, one sound answer per question, three
different example instructions). In the proof on six chapters answer-key (`KEY`) fails fell from 22 of 42 to 6 and
same-move examples from 5 of 6 chapters to 1, while wrong choices a reader can strike out unread rose clearly and
give-away wording rose a little, so still expect a book to land in the manual band with `VARY-quiz` or
`PLAIN-summary fails in k of N chapters` (often `TELL` too) even when its mean is over 80; the judge's round of an
`auto` run then answers what a small edit can.

## Red flags: stop and read reference.md

- Running from `~/ChapterFlow` instead of the worktree, or with an API key in the environment.
- A chapter still open after two fix passes: the checker's inference bar, not a wrong fact. Hand the flags over.
- `names off limits:` on `book`'s first log line showing one of the book's own people or places.
- Every chapter opening the same way (`approved.summary` holds one letter).
- A brief that tells the writer to "go softer" on a book whose advice is not harsh: it puts an aside in every chapter.
- A high score with a reason such as `TEMPT fails in 5 of 8 chapters`: the book is not ready; read the evidence.
- Wanting to regenerate a chapter the owner disliked: it goes through `variants` and `assemble` on that chapter
  and becomes an added exemplar.
- Publishing without a fresh score, or passing `--approve`, `--keys-ok` or `--redo` the owner did not give.
- `auto` ending `NEEDS-OWNER` or `FAILED` and wanting to get past it by deleting `auto.json` or editing a chapter:
  hand the owner the pack and the reasons instead.
- A publish with no public-site pull request after it (reference.md section 1B): main then holds an older package
  than the live store, and the next deploy that touches `book-packages/` rolls the book back. The logged-in library
  and iOS are live at once; the public grid needs the pull request merged and a deploy the owner approves.

## Done

The owner has the score table and one status line: the book is live (`<runDir>/publish.json` records the
packageId, band and the live check), or the one question it is waiting on has been asked; one dated line is in `~/cf-wt/v26-plan/status/V1-variants.md` and
in the `v26-campaign` memory file; the config (with keys), the brief and the package are committed on `v26/variants`.
