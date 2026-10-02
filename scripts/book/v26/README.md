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
| `writer`, `checker`, `solver` | each `{bin, model, effort}`; `bin` is the `claude` binary |
| `concurrency` | chapters in parallel for `run` (default 3) |
| `budgetUsd` | spending cap for the ledger |
| `runDir` | where the run's files go |
| `ledgerPath` | optional; default `<runDir>/ledger.jsonl`. Books that point at one file share one budget |

## Commands

```
npx tsx scripts/book/v26/cli.ts <verb> --book scripts/book/v26/books/<bookId>.json [--chapters 1,13] [--force] [--review]
```

`--chapters` defaults to every chapter. Under a long `run`, use `caffeinate -dimsu npx tsx ...` so the machine does not sleep.

| Verb | What it does |
|---|---|
| `write` | Writes the draft (`r0`) of each chapter. A chapter that already has a draft is skipped; `--force` keeps the old run as `chNN.prev-<time>` and writes again. |
| `check` | Code checks, then fact check, blind quiz solve, cold reader and no-chapter solver, on the chapter's latest draft. Lists the issues; `!` marks a blocking one. |
| `fix` | One fix round on the latest check (edits for what the check flagged), then a re-check. Stops at 2 fix rounds. |
| `run` | Everything for the chapters, with the concurrency and budget caps: write, check, one rewrite if the lesson is wrong, up to 2 fix rounds, then `final.json` and `status.json`. It picks up from the files that exist, and skips a chapter whose status is `clean` or `open-issues` unless `--force`. `--review` adds the editor review and sends its failed items to the fix call. |
| `status` | A table per chapter: stage, open issues, spend, lesson. No model call. |
| `eval` | Judges one chapter with the calibrated judge and the no-chapter solver (see `docs/eval/`). `--chapters N` is required; `--file` defaults to `<runDir>/chNN/final.json`, `--tag` to `chNN`, `--out` to `<runDir>/eval`. Writes `<out>/<tag>.eval.json` (it records `chapter` and `file`) and the judge and solver answers beside it as `<tag>.judge.*` and `<tag>.nochapter-K.*`. With the defaults each chapter has its own `chNN.*` files; give two evals the same `--tag` and `--out` and the second overwrites the first. |
| `render` | Writes `<runDir>/reading/chNN.html` for each chapter that has a `final.json`: a self-contained page (no external files) for reading the chapter the way a reader would, on a phone. |

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
- `final.json` (the chapter, without `_lesson`) and `status.json`: `clean` or `open-issues`, the open issues, the spend.

Open issues are for the owner: a chapter that still has blocking issues after 2 fix rounds and one rewrite is never changed by hand here.

`<ledgerPath>` is one JSON line per model call attempt: `{ts, chapter, step, model, effort, cost, outTokens, stopReason, seconds, isError}`. Before every call the tool adds the cost of one call ($2 for a write or fix, $1 otherwise) to the ledger total and stops if that passes `budgetUsd`.

## Tests

```
npx tsx --test scripts/book/v26/tests/*.test.ts
npm run typecheck:book
```

The tests are hermetic: a fake `claude` (`tests/fixtures/fake-claude.mjs`) answers from a script, and they use temp-dir configs. `npm test` at the repo root also runs them (the `find` roots include `scripts/book/v26`). Nothing under `app/`, `lib/`, `components/` or `tests/` may import `scripts/book/**`.

## Making the next book

Add `books/<bookId>.json` and `briefs/<bookId>.md` (4 to 6 lines; see `briefs/README.md`), and freeze the source text and its chapter map outside the repo. Do not add a rule to the brief to fix one chapter: fix it through `fix`.
