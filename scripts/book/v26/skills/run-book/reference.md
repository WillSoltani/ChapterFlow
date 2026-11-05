# run-book reference: the steps, in order

Conventions: `WT` = `/Users/radinsoltani/cf-wt/v26-lesson-first` (branch `v26/variants`; Bash cwd resets between
calls, so every command starts with `cd $WT &&`). `CLI` = `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY npx tsx
scripts/book/v26/cli.ts`. Model calls go through the `claude` binary on subscription auth; never an API key. Any
command that makes model calls runs in a background Bash with its own log, wrapped so the exit code survives:
`(date; CLI ...; echo "EXIT $?"; date) > <log> 2>&1`. Wait for the exit notification; the one allowed early read is
`head -2 <log>` right after `book` starts (step 6). Exit 1 means open issues, not a crash.

Paths: configs `scripts/book/v26/books/<bookId>.json` (file name = `bookId`), briefs
`scripts/book/v26/briefs/<bookId>.md` (`briefPath` in the config is relative to `books/`: `../briefs/<bookId>.md`); the kit
`~/cf-wt/v26-plan`: `runs/<bookId>/` (the run dir the config names), `status/V1-variants.md` (the progress file for
every book of this campaign), `data/<book>/` (frozen source texts for text mode). Memory: the `v26-campaign` file in
the project memory folder gets one dated line per session.

## 0. Preflight (no calls)

1. `git status --short && git branch --show-current && git log --oneline -1`: branch `v26/variants`; no modified
   tracked files (untracked folders such as `artifacts/` are fine). A modified tracked file: ask the owner first.
2. `ls -d ~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude`: take the newest version
   (the tool resolves the config's glob the same way, newest existing install, at every call).
   `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY <binary> auth status` must show `"loggedIn": true`. If not, the owner
   runs `<binary> auth login` in the app's terminal tab and finishes in the browser; only the owner can. Wait.
3. `npx tsx --test scripts/book/v26/tests/*.test.ts` passes (hermetic, about 30 s). One flaky failure under load
   passes on rerun; a repeatable failure means the checkout is broken: stop.

## 1. Config and brief (no calls)

Copy the template and change the fields. Two modes:

- **Knowledge mode** (copyrighted or unavailable text; written from the model's knowledge). Template:
  `books/the-48-laws-of-power-sonnet.json` (the one whose roles match this skill). `chapters: [{number, title}]`
  with the chapter titles readers know; no `source`.
- **Text mode** (a frozen public-domain text). Template: `books/the-autobiography-of-benjamin-franklin.json`.
  If the book is public domain and the owner asked for knowledge mode, say once that text mode would give a real
  source check, and that it needs a chapter map first; then do what the owner says.
  `source: {textPath, chapterMapPath}` over `~/cf-wt/v26-plan/data/<book>/source-text.txt` and a chapter map
  `{schemaVersion, bookId, sourceTextSha256, spans: [{chapterNumber, chapterTitle, startOffset, endOffset,
  startAnchor, endAnchor}]}`; optional `knownTrapsPath`. There is no tool here that builds a chapter map for a
  new text; that is separate work to agree with the owner before choosing text mode.

Fields to set, every one of them (the template's values for the book are the template's, not placeholders to
keep): `bookId`, `title`, `author`; `bookType`: memoir for a life told in episodes, how-to for procedures the
author teaches, argument for claims with reasons (numbered laws, maxims); the table in
`scripts/book/v26/briefs/README.md` says what each means for lesson, story and quoting; `categories` from the
app's canonical list (Productivity, Self Improvement, Psychology, Business, Leadership, Communication, Strategy,
Management, Decision Making, Relationships, Philosophy, Behavioral Economics, Entrepreneurship, Innovation,
Learning, Mental Toughness, Negotiation, Memoir, Classics, Personal Finance, Investing); `tags`; `briefPath`;
`chapters` with the titles of the standard translation (name it to the owner); `runDir:
~/cf-wt/v26-plan/runs/<bookId>`; `budgetUsd` (twice the estimate below). No `ledgerPath`: the book gets its own
ledger at `<runDir>/ledger.jsonl` (a shared ledger carries other books' spend and would stop the first call).
Keep `shape` and `concurrency: 3` as the template; `knownTrapsPath` (text mode, optional) is a top-level field.
Roles: writer `claude-sonnet-5-5` high, checker `claude-opus-5-5` high, fixer `claude-opus-5-5` high (may be
omitted; it then defaults to the checker), solver `claude-sonnet-5-5` medium; `bin` the glob above. While writing
the config, ask the owner which chapter they know best; that is the calibration chapter (default 1). `mkdir -p` the
run dir so the logs below have a home (the tool creates it too).

The brief: 4 to 6 lines in the shape of `briefs/the-48-laws-of-power.md`, following the type table in
`briefs/README.md`: what the book is; where the lesson comes from; what the evidence is and what must not be invented
(for a book that tells no stories, say so: the chapter's reasoning and cases are the evidence); the quoting rule
(knowledge mode: no quotations at all); "tell the author's advice as given, then say straight to the reader where
you go softer". Never edit a brief to fix one chapter; that is a `--issues` fix round.

Check: `CLI status --book <cfg>` prints `<bookId>: N chapters`, every chapter with stage `not-started`, and
`ledger $0.00 of $<budget>`. `CONFIG_INVALID: <field>` names what to fix.

## 2. Keys, knowledge mode only (1 call, under $1)

`CLI keys --book <cfg>` writes `chapters[].keys` into the config: the author's blunt advice, a `Reversal:` sentence,
and `Story the author tells:` (or `none recalled with confidence`; for a book without stories expect that and keep
it). Drafted by the fixer, since the keys are the fact backbone every later call reads. Read all of them: each
belongs to its chapter, no quotation marks, no borrowed story or invented battle; keep a `Reversal:` only when it is
the chapter's own limit and delete a forced one. Edit by hand where wrong. Show the owner and carry on (not a
wait); their edits must land before step 6, since variants, assemble and the book all read the keys. A rerun drafts
only chapters still without keys; `--force` redoes all.

## 3. Variants on the calibration chapter (7 calls, $2 to $3, about 10 min)

The calibration chapter is the one the owner knows best and that shows the book's typical shape; chapter 1 unless
the owner names another. `CLI variants --book <cfg> --chapters 1` (optional `--reference <chapter.json>` folds an
existing chapter at the bottom for comparison). Before the owner wait, read `<runDir>/ch01/variants/lessons.json`:
candidate 1 must be the chapter's real point, 8 to 20 words; if a later candidate is better, rerun with
`--lesson k --force` (the five parts are written again on candidate k). `--only summary,quiz --force` reruns
single parts. In knowledge mode the fact flags under the summaries are
a consistency check against the checker's own knowledge of the book, not a source check; say so to the owner.

**Owner wait.** `open <runDir>/ch01/variants/pack.html`; in the Claude app also attach it with the SendUserFile
tool, elsewhere give the path. The owner picks one version per part (summary,
examples, quiz, cards, practice), writes notes (which other summary versions are also good matters: they become the
opener rotation), taps Copy my picks and pastes the text. Save it verbatim to `<runDir>/ch01/variants/picks.txt`.
Its shape, if it must be typed by hand:

```
PICKS <bookId> ch01
summary: A
examples: C
quiz: E
cards: B
practice: D
notes summary: A excellent, B and D also good
notes general: keep it plain
```

## 4. Assemble and approve the exemplar (2 to 4 calls, $1 to $2)

`CLI assemble --book <cfg> --chapters 1 --picks <runDir>/ch01/variants/picks.txt` lands `ch01/final.json`,
`status.json`, `lesson.json`, `reading/ch01.html` and `exemplars/ch01.json`; exit 1 with flags is normal.

Order: (1) read `<runDir>/reading/ch01.html` end to end yourself, because every tic in the exemplar is multiplied by
the book: invented people named on every mention instead of pronouns; a sentence about "the lesson" or "the rule"
being gentler; prompt words such as "wrong belief" or "acts out"; a key that is the longest choice or a second
defensible choice; a borrowed fact (a named person, battle or date the chapter does not give); any text in quotation
marks. (2) `CLI fix --book <cfg> --chapters 1 [--issues <file.json>]`: one call sends the chapter's blocking
flags plus the findings in the file, `[{"field": "breakdown.fullRead", "text": "..."}]` (field ids as the reading
page shows them: hook, breakdown.deepRead, quiz.q3.explanation, examples.ex01.scenario, reviewCards.rc2.back,
implementationPlan.ifThenPlans.0.plan). The rule for every chapter in this skill: at most two rounds driven by the
checker's flags alone; a round that carries findings (yours or the owner's) is allowed on top, once per set of
findings. `--finish` and `--review` read text-mode round files and are not used here.

**Owner wait.** Send `reading/ch01.html` and quote any open flags. Needed back: approval (or findings, each one
`--issues` line and one more round), and which summary letters may rotate as openers, in order of preference.

## 5. Tune the exemplar record (no calls)

`assemble` wrote `<runDir>/exemplars/ch01.json` with `picks`, `notes`, `chosen`, `rejected`, `lesson`,
`bookNames` (the book's own people and places, taken from the five candidate lessons) and no `approved` yet.
Set `"approved": {"summary": ["A", "B", "D"]}` with the owner's letters, picked one first (chapter n opens as letter
`(n-1) mod k`; one letter means every chapter opens the same way). Then check `bookNames`: it must hold every name
or place from the book that appears in ch01's summaries (a term missing here, such as a palace or a city, blocks
every later chapter that mentions it as "exemplar copy"), and it must not hold the invented people of the examples
(those are exactly what later chapters may not reuse).

## 6. The book (4 to 6 calls per chapter, $0.7 to $1.1 each, about 2 min per chapter at concurrency 3)

Background: `(date; CLI book --book <cfg> --chapters $(seq 2 N | paste -sd, -); echo "EXIT $?"; date) >
<runDir>/book-run-<date>.log 2>&1`. One early `head -2` of the log: the first tool line is `exemplar: ch01 (...);
openers rotate A/B/D; names off limits: <names>`; the names must be the invented people of ch01 only. If a book
term is there, stop the run (safe; chapters resume from files), fix `bookNames`, relaunch the identical command.

Per chapter: lessons call (lessons already taught, and the exemplar's own people, are off limits), one writer call
against the exemplar, 0-call checks (shape, exemplar copy, variety), Opus fact check and Sonnet key solver, one fix
round, land. At the end the log lists chapters clean or open, then `names used in more than one chapter` (chapters
written side by side never see each other's names; step 7 renames), then `k of N chapters clean; ledger $x of $y`.
A stop (exit 3 usage limit, exit 4 budget, a crash) is rerun with the identical command; finished chapters are
skipped. Budget mechanics: each call reserves $2 (write, fix) or $1 (other) against the ledger before it starts, so
a stop can come a dollar or two under the cap.

## 7. Fix passes (one call per chapter that needs it)

`CLI fix --book <cfg> --chapters $(seq 2 N | paste -sd, -)`: sequential; a clean chapter with no name collision
returns at once. It sends blocking flags, renames a name an earlier chapter used first (from a menu of unused
names), re-rolls the fact checker only if a summary tier changed and the solver only if the quiz changed. Two passes
at most for the checker's own flags; a round that carries findings is allowed on top, as in step 4. Flags left
after two passes are nearly always `WHY (UNSUPPORTED)` on an inference sentence: the checker's bar, not a wrong fact.
Quote them in the hand-off; do not loop. `rename landed on a used name` in the log: run `fix` once more on that
chapter only. `NO_FINAL_CHAPTER`: that chapter never landed; drop it from the list and rerun `book` for it.

Then read every chapter's reading page yourself (or a wide sample for a long book). Optional, only if the pronoun
or gentler-lesson tic shows in two or more chapters (both are writer rules now): `CLI fix --style --book <cfg>
--chapters 1,...,N` (no checker re-roll, about $0.18 a chapter). Optional defect sweep for a long book: one reader
agent per chapter looking for FACT, KEY, LESSON_FIT, SOFTENED, LEAK and CLARITY defects with the quoted text and
field id, two skeptics per finding (is it real; is it a defect rather than taste), confirmed findings applied with
`fix --chapters N --issues`; plus a sameness read over all chapters (settings, cast, sentence moulds) that is a
report for the owner, never a fix.

## 8. Pack and hand-off (no calls)

`CLI pack --book <cfg> --chapters $(seq 1 N | paste -sd, -) --out <runDir>/reading/all.html`, then `CLI status
--book <cfg>`. `open` the page; in the Claude app also attach it with the SendUserFile tool, elsewhere give the
path. The hand-off
says: chapters clean out of N; each open flag quoted with a one-line opinion (inference bar, or real); the ledger
total; a sample to read first (the exemplar, two chapters the owner knows, one at random); and what the run leaves
behind (`<runDir>/chNN/final.json` per chapter plus the pack), since putting a book into the app is the owner's
separate step. A chapter the owner dislikes is not regenerated: `variants --chapters N`, then `assemble`, and it
becomes an added exemplar (`book --exemplar N` for later rewrites).

## 9. Score (one judge call and three solver runs per chapter, about $0.17 each)

`CLI score --book <cfg>` (reuses `<runDir>/eval/chNN.eval.json`; `--force` re-judges). Per chapter: the share of
the judge's items passed, 0 to 100; the book: the mean. Prints a row per chapter (open flags, "quiz guessable" when
the no-chapter solver answers 4 or 5 of the first five keys without reading, the failed item ids), then
`band AUTO|MANUAL|FAIL` with the reasons and the chapters to redo; writes `<runDir>/score.json`. Exit 0, 1, 2.
Thresholds are the config's `gate` (`{"auto": 80, "manual": 70}` by default). A chapter edited after the score
makes the score stale; run `score` again.

## 10. Publish, by band (the owner's gate, 2026-11-05)

- **auto** (mean at or above `auto`, every chapter at or above `manual`, no open fact or key flag): run
  `CLI publish --book <cfg>` at once, no question asked.
- **manual** (otherwise, mean at or above `manual`): hand the owner the pack, the score and the reasons; on a yes,
  `CLI publish --book <cfg> --approve`. On a no, treat their notes as findings (step 7) and score again.
- **fail** (mean under `manual`): hand over the score and the `redo` list and ask permission to redo those chapters;
  only on a yes run `CLI book --book <cfg> --chapters <redo> --force`, then steps 7, 8 and 9 again. Two redo loops at
  most; after that it is the owner's call.

What `publish` does, in order, and stops at the first failure: builds `book-packages/<bookId>.v21.json` from the
landed chapters (chapterId `<bookId>-chNN`, number, readingTimeMinutes from the full read at 230 words a minute,
packageId `<bookId>-v26-<time>`, book metadata from the config) and runs the app's own validator and category
check on it; commits it on the current branch and pushes; uploads it to `book-content/packages/<bookId>.v21.json`
in the content bucket (the server reads it there at runtime); registers it in the API catalog with the repo's
`register-api-books` script (DynamoDB plus versioned artifacts; live at once for the logged-in library and iOS);
checks the live API for the new packageId; writes `<runDir>/publish.json`. Names come from `BOOK_TABLE_NAME`,
`BOOK_CONTENT_BUCKET`, `BOOK_INGEST_BUCKET` in the environment or from SSM `/chapterflow/prod/BOOK_*`; AWS profile
`chapterflow`, region us-east-1. `--dry-run` builds and validates the package only. `--out <dir>` writes the package
elsewhere with no git.

Still the owner's after a publish: a **new** book needs the static catalog wiring (an import and `BOOK_PACKAGES`
entry in `app/book/data/bookPackages.ts`, a row with an authored synopsis in `lib/books-catalog.metadata.json`,
`npx tsx scripts/book/generate-chapter-meta.ts`, `npm run verify`) and a prod web deploy (`deploy.yml`, approved in
GitHub) before the public grid shows it; a **replaced** book is live once the server's warm cache turns over (the
next deploy or cold start). Say which applies in the hand-off.

Housekeeping: commit the config (with keys) and the brief on `v26/variants` with a `chore(v26): <book> config
and brief` message (the package commit is made by `publish`); push only if the owner asks. Append one dated line
to `~/cf-wt/v26-plan/status/V1-variants.md` and one to the `v26-campaign` memory file, in their existing shape:
`- <YYYY-MM-DD> <bookId> <PUBLISHED|NEEDS-OWNER> — <chapters clean of N>, score <x> band <auto|manual|fail>, $<cost>, pack <path>; open: <flags or none>; owner's: <deploy or nothing>`.

## Failure table

| Symptom | Cause | Do |
|---|---|---|
| `CallFailedError` twice, cost-0 ledger rows | subscription auth expired | owner runs `<binary> auth login`; rerun the identical command |
| `VARIANTS_OUTPUT_INVALID` after the reshape | shape still wrong after the errors were fed back | rerun the same command; for variants `--only <part> --force` |
| exit 3 | usage limit | wait for the reset, rerun the identical command |
| exit 4 | budget cap | if the per-chapter spend is honest, raise `budgetUsd` by half and rerun; if one chapter burnt it, stop and report |
| a chapter open after two passes | fact-check treadmill on inference sentences | stop; hand the flags over |
| `names off limits:` lists a book term | `bookNames` incomplete | add it, rerun |
| every chapter opens the same way | one letter in `approved.summary` | ask the owner for more letters; never `--force` the book |
| `rename landed on "X"` | the rename picked a used name | `fix` once more on that chapter |
| lesson over 20 words refused twice | the lessons cap | rerun; the retry carries the error |
| `NO_FINAL_CHAPTER` from `fix` | a chapter never landed | drop it, rerun `book` for it |
| `publish`: `no score yet` / `changed after the score` | score missing or stale | run `score`, then `publish` |
| `publish`: `app validator:` or `category ... is not canonical` | the package would be rejected at ingest | fix the config's categories or the chapter it names; score and publish again |
| `publish`: `register:api failed` | AWS names or credentials | check `AWS_PROFILE=chapterflow` works (`aws sts get-caller-identity --profile chapterflow`) and the SSM names; rerun `publish` (idempotent by packageId) |
| `publish`: `not verified ... CDN caches` | the list is cached up to an hour | fine; check again later |
| trailing comma in `--chapters` | `seq -s,` | `seq a b \| paste -sd, -` |

## Cost (from the 48 Laws ledgers, 2026-11-04)

Sonnet writing with Opus checks and fixes: $0.70 to $0.89 per chapter (Opus writing: $1.07). Keys: under $1.
Calibration (variants, assemble, fixes): about $5. Fix passes: about $0.3 per open chapter per pass. Style pass:
$0.18 per chapter. Estimate = $5 + chapters x $0.9 + (chapters / 3) x $0.6, rounded up: 13 chapters about $20,
48 chapters about $60. `budgetUsd` = twice that.
