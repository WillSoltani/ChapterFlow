# v26 lesson-first chapter tool

Turns one book's source text into ChapterFlow chapters, one lesson per chapter, and checks each chapter before anyone reads it. It calls `claude` (subscription auth, no tools) for the writer, the fact checker and the solvers. All state is files, so a run can stop and resume.

Design and why: [`docs/design.md`](docs/design.md). The eval the chapters are judged by: [`docs/eval/eval-items.md`](docs/eval/eval-items.md). Book briefs: [`briefs/`](briefs/README.md).

This tool does **not** publish. The real `ship` (the step that puts a book into the app) is the owner's, and it is not in this tool yet. Nothing here writes to `book-packages/`, S3 or production. When `assemble` and `ship` arrive, never write a package into a checkout's `book-packages/`: the publish bridge refuses an untracked or dirty file there, and a dry run would not show it.

## Layout

| Path | What |
|---|---|
| `cli.ts` | the command line |
| `src/` | `pipeline.ts` (write, check, fix, run, eval), `checks.ts` (code checks, no model), `call.ts` (the `claude` wrapper, ledger, budget), `source.ts`, `config.ts`, `render.ts` and the small helpers |
| `prompts/` | `write`, `factcheck`, `keysolve`, `coldreader`, `nochapter`, `fix`, `review` templates (`@@KEY@@` slots) |
| `briefs/` | the generic lesson-first rules live in `prompts/write.md`; each book has a short section here |
| `books/` | one config per book |
| `tests/` | hermetic tests with a fake `claude` |

## Book config

`books/<bookId>.json`. Relative paths are resolved from the config's own directory; a leading `~/` is the home directory. Source files may live outside the repo.

| Field | Meaning |
|---|---|
| `bookId`, `title`, `author` | identity; `bookId` also labels ledger rows |
| `bookType` | `memoir`, `how-to` or `argument`; the brief differs by type (see `briefs/README.md`), the code does not branch on it yet |
| `categories` | from `lib/category-taxonomy.ts` (the publish gate rejects anything else); `tags` are free text |
| `source` | `textPath` and `chapterMapPath` of the frozen source text and its chapter spans (the map must carry the text's SHA-256) |
| `knownTrapsPath` | optional; facts this book has been wrong about before, given to the fact checker as hints |
| `briefPath` | the book's section of the brief |
| `shape` | counts (`examples`, `quizQuestions`, `choices`, `reviewCards`, `memorableLines`, `ifThenPlans`) and word bands (`fastRead`, `deepRead`, `fullRead`) |
| `exemplarFrom` | optional `{runDir, chapter}`: write every chapter of this book against an approved chapter of another book (the house exemplar), so this book needs no pick page; new configs point at `../house` (`scripts/book/v26/house`: the owner-approved 48 Laws chapter 1, revised to the reader bar on 2026-11-10 and kept in the repo) |
| `writer`, `checker`, `solver`, `fixer` (optional) | each `{bin, model, effort}`; `bin` is the `claude` binary. `fixer` is the model for fix rounds and the keys draft; default the checker, so a cheap writer never fixes its own work. The configs here use Sonnet 5.5 as the writer with Opus 5.5 as checker and fixer: in a blind A/B on four laws (2026-11-05) the owner preferred Sonnet's summaries, at about 60 percent of the writing cost; Sonnet's one weakness, recalling which story a book tells in which chapter, is covered by the story line in `keys`. Since 2026-11-11 new books are written by Opus 5.5 (owner decision after a blind reader test under the reader bar: Opus chapters preferred 6 of 6, overall 8.0 against 6.8, at about $1.2 a chapter against $0.8); the committed configs keep the writer that wrote their books. |
| `concurrency` | chapters in parallel for `run` (default 3) |
| `budgetUsd` | spending cap for the ledger |
| `runDir` | where the run's files go |
| `ledgerPath` | optional; default `<runDir>/ledger.jsonl`. Books that point at one file share one budget |

## Commands

```
npx tsx scripts/book/v26/cli.ts <verb> --book scripts/book/v26/books/<bookId>.json [--chapters 1,13] [--force] [--review] [--issues <file.json>]
```

`--chapters` defaults to every chapter. Under a long `run`, use `caffeinate -dimsu npx tsx ...` so the machine does not sleep.

| Verb | What it does |
|---|---|
| `write` | Writes the draft (`r0`) of each chapter. A chapter that already has a draft is skipped; `--force` keeps the old run as `chNN.prev-<time>` and writes again. |
| `check` | Code checks, then fact check, blind quiz solve, cold reader and no-chapter solver, on the chapter's latest draft. Lists the issues; `!` marks a blocking one. |
| `fix` | One fix round on the latest check (edits for what the check flagged), then a re-check. Stops at 2 fix rounds. `--issues <file.json> --chapters N` (reader findings, `[{"field","text"}]`) adds one reader round after the 2 fix rounds and makes it the chapter's `final.json` and `status.json`; once per chapter. `--finish [--issues <file.json>] --chapters N` runs the finish round, once per chapter and only after the reader round: it sends only the blocking issues the reader round left (and the findings of the optional file), not the reported ones, and the result becomes `final.json` and `status.json`. |
| `run` | Everything for the chapters, with the concurrency and budget caps: write, check, one rewrite if the lesson is wrong, up to 2 fix rounds, then `final.json` and `status.json`. It picks up from the files that exist, and skips a chapter whose status is `clean` or `open-issues` unless `--force`. `--review` adds the editor review and sends its failed items to the fix call. |
| `status` | A table per chapter: stage, open issues, spend, lesson. No model call. |
| `eval` | Judges one chapter with the calibrated judge and the no-chapter solver (see `docs/eval/`). `--chapters N` is required; `--file` defaults to `<runDir>/chNN/final.json`, `--tag` to `chNN`, `--out` to `<runDir>/eval`. Writes `<out>/<tag>.eval.json` (it records `chapter` and `file`) and the judge and solver answers beside it as `<tag>.judge.*` and `<tag>.nochapter-K.*`. With the defaults each chapter has its own `chNN.*` files; give two evals the same `--tag` and `--out` and the second overwrites the first. |
| `render` | Writes `<runDir>/reading/chNN.html` for each chapter that has a `final.json`: a self-contained page (no external files) for reading the chapter the way a reader would, on a phone. |
| `variants` | Five versions of each component (summary, examples, quiz, cards, practice) for the owner to pick from, and the pick page `<runDir>/chNN/variants/pack.html`. See "Variants" below. `--only summary,quiz` redoes those components; `--force` redoes what exists; `--lesson 3` drives every component from the third candidate lesson; `--reference <chapter.json>` folds that chapter at the bottom of the page for comparison. |

Examples:

```
# what is done
npx tsx scripts/book/v26/cli.ts status --book scripts/book/v26/books/the-autobiography-of-benjamin-franklin.json
# two chapters, start to finish
npx tsx scripts/book/v26/cli.ts run --book scripts/book/v26/books/the-autobiography-of-benjamin-franklin.json --chapters 1,13
# step by step on one chapter
npx tsx scripts/book/v26/cli.ts write --book scripts/book/v26/books/how-to-live-on-24-hours-a-day.json --chapters 3
npx tsx scripts/book/v26/cli.ts check --book scripts/book/v26/books/how-to-live-on-24-hours-a-day.json --chapters 3
npx tsx scripts/book/v26/cli.ts fix   --book scripts/book/v26/books/how-to-live-on-24-hours-a-day.json --chapters 3
# judge a chapter file and read the pack
npx tsx scripts/book/v26/cli.ts eval --book scripts/book/v26/books/the-autobiography-of-benjamin-franklin.json --chapters 1 --file some/chapter.json --tag round1 --out /tmp/evals
npx tsx scripts/book/v26/cli.ts render --book scripts/book/v26/books/the-autobiography-of-benjamin-franklin.json
```

After `write`, `check` or `fix`, `run` carries on from the files and writes `final.json` and `status.json`.

### One command for a whole book: `auto`

```
npx tsx scripts/book/v26/cli.ts auto --book scripts/book/v26/books/<bookId>.json [--no-publish | --dry-run] [--out <dir>]
npx tsx scripts/book/v26/cli.ts auto --queue books.txt
```

`auto` (`src/auto.ts`) takes a book whose config has `exemplarFrom` from its config to the publish its band allows: keys drafted and then checked against the book (`src/keysCheck.ts`: two checker calls with web search and fetch, the only calls that get any tool, and an editor call), the missing chapters, two fix passes, one round of repairs code can see, the reading pack, the score, one round on the judge's failed items in the manual band, then `publish`. Every stage reads what is on disk, and the one-off rounds are recorded per chapter in `<runDir>/auto.json`, so the same command carries on after a stop and never gives a chapter a round twice.

What stays the owner's: `--approve` (yes to the pack that was read: taken only while the book waits and its chapters are unchanged since that pack, and such a run edits nothing), `--keys-ok` (the owner vouches for the notes; no web check), `--redo` (rewrite a failed book's redo list, once per score), `--force` (run a published book again). None of the four goes with `--queue`. Keys that could not be checked stop the book before a chapter is written.

`--queue <file>` runs a list of configs (one path per line, or a JSON array) one after another and appends one line per book to `<file>.report.jsonl`. Exit codes for `auto`: 0 published, dry run or ready; 1 waiting for the owner; 2 failed; 3 usage limit; 4 budget.

The procedure for running a book is the `run-book` skill (`skills/run-book/`), not this file.

### Exit codes

| Code | Meaning | What to do |
|---|---|---|
| 0 | ok (for `run`: every chapter is clean; for `eval`: every aggregate meets its bar) | |
| 1 | open issues, a failed eval, or a usage or config error | read the listed issues or the message |
| 3 | `USAGE_LIMIT`: the subscription's usage limit was hit; no new model call starts after it (calls already running finish), and nothing is retried | wait for the reset, run the same command again |
| 4 | `BUDGET_STOP`: the ledger plus the next call would pass `budgetUsd`; the same stop rule as exit 3 | raise `budgetUsd` in the config, or stop |

## Run dir and ledger

`<runDir>/chNN/` holds, per chapter:

- `lesson.json`: the writer's lesson card (readers never see it);
- `r0.chapter.json`: the draft; `r1.chapter.json`, `r2.chapter.json`: after fix rounds 1 and 2;
- `rK.checks.json`: the code checks; `rK.factcheck.json`, `rK.keysolve.json`, `rK.coldreader.json`, `rK.nochapter-0..2.json` (and `rK.review.json` with `--review`): the model checks, each with `.result.txt` and `.envelope.json` beside it;
- `rK.result.json`: the round's verdict: lesson rating, blocking issues, what goes to the fix call;
- `rK.fix.json`, `rK.fix-applied.json`: the fix call and what was applied;
- `r0-pre-rerun.*`: the first draft and its verdict, kept when the lesson was rewritten;
- `final.json` (the chapter, without `_lesson`) and `status.json`: `clean` or `open-issues`, the open issues, the spend;
- `variants/`: the pick page and its parts (see "Variants" below).

Open issues are for the owner: a chapter that still has blocking issues after 2 fix rounds and one rewrite is never changed by hand here.

`<ledgerPath>` is one JSON line per model call attempt: `{ts, chapter, step, model, effort, cost, outTokens, stopReason, seconds, isError}`. Before every call the tool adds the cost of one call ($2 for a write or fix, $1 otherwise) to the ledger total and stops if that passes `budgetUsd`.

## Variants (the owner's pick loop)

`variants` is how the owner's taste becomes data. For one chapter it makes:

1. **Five candidate lessons** (one writer call, best first). The first drives everything below unless `--lesson k` says otherwise.
2. **Five versions of each component**, one writer call per component, in parallel. Each version is labelled A to E and takes a named approach (for the summary: problem scene, question or puzzle, two people two choices, surprising claim first, concrete analogy; the other components have their own five, listed in `prompts/variants-*.md`), so a pick says what kind of thing the owner wants, not only which one.
3. **A fact check of the five summaries** against the source (one checker call), plus 0-call checks (quotations verbatim, summary length). Flags show under the summary they belong to.
4. **The pick page**: `<runDir>/chNN/variants/pack.html`, self-contained. A Pick button per version, a notes box per component, and a "Copy my picks" button that puts a short text block on the clipboard for the owner to paste into chat. Picks and notes survive a reload (localStorage).

Files under `<runDir>/chNN/variants/`: `lessons.json`, `summary.json`, `examples.json`, `quiz.json`, `cards.json`, `practice.json`, `factcheck.json`, `run.json` (everything the page shows), `pack.html`, and `calls/` (every model call's envelope, raw answer and parsed JSON). A run picks up what exists: a stopped run resumes, and `--only` or `--force` redoes a part. A new lesson (`--lesson`) clears every component.

Cost per chapter: 7 calls, about $5 to $8, about 15 minutes.

**After the pick: `assemble`.** `assemble --book <cfg> --chapters N --picks <file>` takes the "Copy my picks" text (or JSON `{picks, notes}`) and makes one writer call that copies the picked parts into a full chapter: three lengths of the picked summary (same opener, path and ending), the picked examples, cards and plan unchanged, the picked quiz extended to the shape's count in the same form, and the fact-check fixes on the picked summary applied. Then the 0-call checks and a fact check of the three lengths run. The chapter lands as `<runDir>/chNN/final.json` with `status.json` (so `status` and `render` work), a reading page `<runDir>/reading/chNN.html`, and `<runDir>/exemplars/chNN.json` (the picks, the chosen and rejected versions and the owner's notes, for the writer prompt of later chapters). Nothing is fixed automatically: open issues are listed for the owner. Exit 0 when clean, 1 with open issues.

**The book: `book`.** `book --book <cfg> --chapters 2,24,48 [--exemplar 1] [--force]` writes every listed chapter (the exemplar itself is skipped) to the standard of the approved chapter: per chapter, the lessons call (every lesson the book already teaches is off limits), one writer call with the exemplar chapter as the bar and the chapter's plan as the order (`formText` in `src/book.ts`: the opener and its path from `src/approaches.ts`, the length ceilings from the config's `shape`, the counterintuition frame, the example tags, the order of quiz and card forms and the key positions, all a function of the chapter number so chapters written in parallel cannot land on one shape), the owner's notes and the variety ledger (`<runDir>/variety.json`: names, settings and analogies already used), then the 0-call checks plus an exemplar-copy check (a name or an eight-word run from the approved chapter blocks) and a variety check, the fact check of the three summary lengths, the blind key solver on questions 1 to 5, at most one fix round on blocking issues, and the chapter lands as `final.json`, `status.json`, `lesson.json` and `reading/chNN.html`. Chapters run `concurrency` at a time and resume from files; the run ends with a report of names used in more than one chapter. `pack --chapters 1,2,24,48 --out <file>` renders chosen chapters into one reading page. `fix --chapters N` on a book without source text runs one more fix round on a landed chapter's open flags (`prompts/fix-knowledge.md`); `fix --style --chapters ...` runs the style pass instead (`prompts/fix-style.md`: pronouns for the invented people, no sentence about "the lesson" being gentler, plus any `--issues` findings) without rolling the checker or the solver again, since it changes no fact and no key.

**The gate: `score` and `publish`.** `score --book <cfg>` runs every landed chapter through `eval` (saved evals are reused; `--force` re-judges) and gives the book its mean as a 0-100 score with a band from the config's `gate` (default `{"auto": 80, "manual": 70}`): `auto` when the mean clears the bar, no chapter is under the manual bar and no fact or key flag is open; `manual` otherwise, with the reasons and a `redo` list; `fail` under the manual bar (exit 0, 1, 2; `<runDir>/score.json`). Two things were added on 2026-11-10 after a blind reader comparison showed a 93-point book reading at about 7 of 10: the judge answers one `TEMPT-<q>` item per quiz question (is a wrong choice something a sensible person who has not read the chapter might really pick), and the repeat rule holds a book of four chapters or more in `manual` when one kind of item is weak in at least half the chapters (`TRY fails in 6 of 8 chapters`), because a flaw in every chapter costs the mean one item in forty while a reader meets it every time. `publish --book <cfg> [--approve] [--dry-run] [--out <dir>]` then builds `book-packages/<bookId>.v21.json` from the landed chapters (the practice plan goes out in the app's form, `appPlan` in `src/publish.ts`: the cue and the action as one sentence in `plan`, and work, school or personal in `context`, which the reader app prints in a chip), runs the app's validator and category check, commits and pushes it, uploads it to `book-content/packages/` in the content bucket, registers it in the API catalog (`register-api-books.ts`) and checks the live API; `auto` publishes, `manual` needs `--approve`, `fail` refuses. Names come from `BOOK_*` env vars or SSM `/chapterflow/prod/BOOK_*`, AWS profile `chapterflow`. Calibration on the owner-approved 48 Laws: mean 91.1, lowest 71.4 (the item set before `TEMPT`). With the reader bar, Tiny Habits scored 96.7 with a lowest chapter of 92.9 and 52 of 56 `TEMPT` items passing; the same book written before the bar scored 92.9 on the old item set while blind readers put it at about 7 of 10, which is why the items and the repeat rule were added.

**Running a whole book.** The `run-book` skill (`skills/run-book/`, also installed at `~/.claude/skills/run-book/` so `/run-book` works from any session) is the procedure from an empty config to the reading pack, with the two owner waits, the checks and the failure table.

**`keys` (knowledge mode).** `keys --book <cfg> [--force]` makes one call that drafts, for every chapter without one, `chapters[].keys`: the author's advice in that chapter in blunt plain words plus its reversal and the story that chapter tells, written into the config file for the owner to edit. The lessons, writer, checker and fix calls read it (the lesson may be gentler than the author; the account of his advice may not), and reading pages show it under the takeaway as "What the author advises".

**Books without source text (knowledge mode).** A config may give `chapters: [{number, title}]` instead of `source`. Then `variants` and `assemble` work from the writer's own knowledge of the book, quotations are forbidden, and the fact check is a consistency check against the model's knowledge of the book (`prompts/variants-factcheck-knowledge.md`). `write`, `check`, `fix` and `eval` refuse in this mode.

## Tests

```
npx tsx --test scripts/book/v26/tests/*.test.ts
npm run typecheck:book
```

The tests are hermetic: a fake `claude` (`tests/fixtures/fake-claude.mjs`) answers from a script, and they use temp-dir configs. `npm test` at the repo root also runs them (the `find` roots include `scripts/book/v26`). Nothing under `app/`, `lib/`, `components/` or `tests/` may import `scripts/book/**`.

## Making the next book

Add `books/<bookId>.json` and `briefs/<bookId>.md` (4 to 6 lines; see `briefs/README.md`), and freeze the source text and its chapter map outside the repo. Do not add a rule to the brief to fix one chapter: fix it through `fix`.
