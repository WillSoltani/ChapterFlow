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
  `books/the-48-laws-of-power-sonnet.json`. `chapters: [{number, title}]`
  with the chapter titles readers know; no `source`. Take the chapter count, their order and their titles from the
  book's table of contents on the web (the publisher's page, a library record, an online preview), never from
  memory: a wrong chapter list is the one error the notes check cannot repair. On The Charisma Myth (2026-11-13) a
  list written from memory invented a chapter 10, pushed the next three down a place and dropped the last one, and
  three chapters were written from notes filed under the wrong titles.
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
`chapters` with the titles of the standard translation (name it to the owner), the list taken from the book's table
of contents on the web (publisher page, library record, preview), never from memory; `runDir:
~/cf-wt/v26-plan/runs/<bookId>`; `budgetUsd` (twice the estimate below). No `ledgerPath`: the book gets its own
ledger at `<runDir>/ledger.jsonl` (a shared ledger carries other books' spend and would stop the first call).
Keep `shape` and `concurrency: 3` as the template; `knownTrapsPath` (text mode, optional) is a top-level field.
Roles: writer `claude-opus-5-5` high (owner decision 2026-11-11; the templates name `claude-sonnet-5-5`, the
writer of the books they describe, so change the field), checker `claude-opus-5-5` high, fixer `claude-opus-5-5`
high (may be omitted; it then defaults to the checker), solver `claude-sonnet-5-5` medium; `bin` the glob above.
With Opus writing, the fact checker and the judge are the writer's own model: the code checks, the Sonnet solver
and the web keys check are the readings that stay independent of it.
`exemplarFrom: {"runDir": "../house", "chapter": 1}` (relative to `books/`, so `scripts/book/v26/house`): the house
exemplar, the owner's approved 48 Laws chapter 1 revised to the reader bar on 2026-11-10. It sets the bar and the
JSON shape for every chapter of the new book; the per-chapter plan sets the order (owner decision 2026-11-06: no
pick page per book; the Carnegie picks matched the 48 Laws picks in four parts of five). Leave it out only when the owner
wants to set a new form on this book; then ask which chapter they know best as the calibration chapter and run steps
3 to 5. `mkdir -p` the run dir so the logs below have a home (the tool creates it too).

The brief: 4 to 6 lines in the shape of `briefs/the-48-laws-of-power.md`, following the type table in
`briefs/README.md`: what the book is; where the lesson comes from; what the evidence is and what must not be invented
(for a book that tells no stories, say so: the chapter's reasoning and cases are the evidence); the quoting rule
(knowledge mode: no quotations at all); and the limit rule: "tell the author's advice as he gives it; add no limit
of your own". Only a book whose advice is harsher than the lesson a fair reader would use (the 48 Laws) says
instead "then say in one sentence where the lesson goes softer". The author's own exceptions stay out of the
chapter either way: the judge reads an exception at the end as a second, opposite lesson.
A brief that tells the writer to go softer on a how-to book puts an aside in every chapter. Never edit a brief to
fix one chapter; that is a `--issues` fix round.

Check: `CLI status --book <cfg>` prints `<bookId>: N chapters`, every chapter with stage `not-started`, and
`ledger $0.00 of $<budget>`. `CONFIG_INVALID: <field>` names what to fix.

## 1A. The one command: `auto` (steps 2 and 6 to 10 in one resumable run)

For a book whose config has `exemplarFrom` (or whose chapter 1 is already its own approved exemplar):

`(date; CLI auto --book <cfg>; echo "EXIT $?"; date) > <log> 2>&1` in a background Bash. It does, in order, each
stage reading what is on disk so that the identical command carries on after any stop:

1. **Keys** (knowledge mode): drafts the missing ones, then checks all of them against the book before a chapter
   is written (a chapter that has even begun, a `chNN/book/` folder, counts as written: then no check can vouch for
   it and the book waits for the owner at the end): two checker calls per six chapters, the only calls of this tool with tools at all (web search and
   fetch, nothing else), working apart; an editor call rewrites each note with what they leave standing. New
   words (a correction, a story) go in only when both checkers give them; one checker alone can only take words out.
   Each checker lists up to three stories per chapter (the people the author names and follows first), and a story
   enters the note only when it is on both lists; a lone doubt marked unsure changes nothing. The log line says how
   many notes were edited and how many now carry a story from the book; a note still at `none recalled` gets a
   chapter whose evidence is the author's method in one everyday case, which is allowed. The edited notes are written into the config. If a checker or the editor
   does not answer, the book stops `NEEDS-OWNER` and **no chapter is written**; finished groups are kept
   (`<runDir>/keys/check-progress.json`) and the next run starts at the group that failed.
   The checkers also say, per chapter, whether the chapter the config names at place N of its list is a real chapter
   that sits at that place in the book's order (they see the whole list; an introduction counts when the list has one,
   and the number the book prints does not matter); the
   check records a problem when both say no (and neither is unsure) or when the editor's note comes back headed with
   another chapter's title, and a note left with no advice once its doubted sentences are cut. Either stops the book
   `NEEDS-OWNER` before a chapter is written (failure table). One checker alone doubting a title is a note in the log
   line, not a stop.
2. **Chapters** that are not there yet (step 6), then **two fix passes** (step 7), then one round of **repairs**
   code can see: two hooks built on the same object, a quiz whose right choice is the longest or shortest in most
   questions.
3. **Pack** at `<runDir>/reading/all.html` and the **score** (step 9).
4. In the **manual** band with nothing open: one round per chapter on the judge's failed items that a small edit
   can answer (hook, counterintuition, try-this, the line, practice, single quiz questions, cards, single examples; not `VARY-quiz` or `VARY-examples`), then the score again.
   Once per book, never a loop.
5. **By band**: auto publishes (step 10's `publish`); manual ends `NEEDS-OWNER` with the pack; fail ends `FAILED`
   with the redo list.

Each one-off round, and the chapters it has handled, is recorded in `<runDir>/auto.json`, so a rerun never gives a
chapter a second round. Do not delete that file to get a book moving: it is what keeps the rounds honest.

Outcomes (last line of the log, and `auto.json`): `PUBLISHED`, `DRY-RUN`, `READY` exit 0; `NEEDS-OWNER` exit 1;
`FAILED` exit 2; a usage limit exit 3 and the budget exit 4, both resumed by the identical command.

Flags:
- `--no-publish` stops after the score (`READY`); `--dry-run` builds and validates the package only; `--out <dir>`
  puts the package there with no git.
- `--approve`: the owner read the pack and said yes. Taken only when the book ended `NEEDS-OWNER` with its pack
  written and no chapter has changed since; then the run edits nothing and publishes. If a chapter changed, the run
  says so, goes on as usual and waits again: the owner reads the new pack. A `--dry-run` first does not use the yes up.
- `--keys-ok`: the owner read the notes in the config and vouches for them; no web check. Also lifts the hold on a
  book whose chapters were written before any check (keys state `unchecked`), but only while the notes are as they
  were when that hold began: once a note was edited, the written chapters no longer follow the notes, so the owner
  reads the pack and gives `--approve`, or the folders of the chapters whose notes changed are removed and written
  again. It covers the notes as they stand: not notes drafted in the same run (those are checked on the web as
  usual), and not notes that change afterwards.
- `--redo`: the owner allows a **failed** book's redo list to be written again. Once per score; a redo that stopped
  carries on without the flag; the book's own exemplar chapter is never rewritten (the owner mends it). The rounds
  that follow touch only the rewritten chapters.
- `--force`: run again a book `auto` already published.
- `--chapters` does not go with `auto`.

**A queue.** `CLI auto --queue <file>`: the file is one config path per line (`#` comments; relative paths are
taken from the file's folder) or a JSON array. Books run one after another; a book that fails or waits does not stop
the next; a usage limit stops the queue (exit 3) and the identical command carries on, skipping published books.
Each book adds one line to `<file>.report.jsonl` (outcome, score, band, spend, reasons, pack). `--approve`,
`--keys-ok`, `--redo` and `--force` are refused with `--queue`: each is one book's ruling. Exit: the worst book
(0, 1, 2, or 4 for a budget).
Covers with a queue: as soon as the queue is running, make the cover (section 1C) for every book in the file, in
the file's order. A cover takes about two minutes and a book far longer, so each is in place before its book
publishes. A book that published without one has `no cover made in this run` in its reasons, on its outcome line
and in the report.

After `auto`: show the owner the score table and the one status line or question that SKILL.md's "What the owner
sees" gives for the outcome, and nothing else (owner's instruction, 2026-11-12: no pack, no sample read, no flag
list unless asked). `auto` prints `chapter scores: ch01 97.6, ch02 95.2, ...; average 96.1` just before its
outcome line. Then, without reporting it, do the housekeeping commit and the status line (step 10). For a title
the app did not list before, the status line adds that the public site needs the catalog entry and a deploy
(step 10 says what).

## 1B. The public site: `site` (after every publish, new title or replaced)

Why every time: a production deploy re-uploads all of main's `book-packages/` to the live store whenever that
folder changes. A title published at runtime leaves main holding an older copy (or none), and the next such deploy
would put old quiz questions, answer keys and narration text back live. So main must hold the live bytes. A new
title also needs its registry lines and catalog row before the public grid shows it.

`site` makes the file edits in a checkout of main; the session commits them and opens the pull request. It never
commits, pushes, merges or deploys.

1. A fresh worktree of main on its own branch:
   `git -C $WT fetch origin main && git -C $WT worktree add -b books/site-<bookId> ~/cf-wt/site-<bookId> origin/main`
2. It needs `node_modules/.bin/tsx` for the two generators. Link the `node_modules` of an existing checkout of this
   repo (`ln -s <that folder>/node_modules ~/cf-wt/site-<bookId>/node_modules`), or run `npm ci` in the new worktree.
   Never `npm ci` through a link: it empties the shared folder.
3. `CLI site --book <cfg> --repo ~/cf-wt/site-<bookId> --dry-run`, read what it would change, then the same
   without `--dry-run`. For a NEW title add `--synopsis "<text>"`: one or two plain sentences on what the reader
   learns, 130 to 240 characters, in the manner of the rows in `lib/books-catalog.metadata.json`; no competitor
   names. Without it the catalog shows a generic line. What the step does:
   - copies the live package in, byte for byte (its md5 must equal the store's);
   - the revert guard: every other package on main that differs from the live store comes along, for the reason above;
   - NEW title: the import and the auto-registered block in `app/book/data/bookPackages.ts`, the presentation entry
     when a synopsis is given, the id in the fallback-cover set when there is no cover file, and the approval record
     that CI requires for that shared file (`scripts/ci/ws7-shared-repair-approvals.json`, owners copied from the
     record it supersedes);
   - REPLACED title: no registry edit and no approval record;
   - regenerates `lib/books-catalog.metadata.json` and `app/book/data/book-chapter-meta.json` (and fixes the
     catalog generator's output path the first time). The regeneration can bring unrelated drift; the pull request
     body lists it.
4. Run the commands under `next:` in its output, in order: the `git add` and `git commit` with the explicit paths
   (never `git add -A`), the shared-closure check (`shared TypeScript closure: PASS`), the listed tests (0 failed),
   the cover check, `git push -u origin HEAD`, and `gh pr create` with `<runDir>/site-pr.md` as the body. Skip
   `npm run verify` when `node_modules` is borrowed from another checkout (missing modules fail it for reasons that
   are not this change); CI runs it on the pull request.
5. The status line the owner sees gains: `Public site: pull request <url>. Merge it BEFORE any deploy, then
   deploy.` Never merge it and never start the deploy. The order matters: a prod deploy that runs from main while
   this pull request is still open uploads main's older package over the live one (the quiz, ask and narration
   text go back a version; the chapter text does not). If that has happened: merge the pull request, then deploy
   main again; that puts the published package back. `site` refuses with `SITE_LIVE_STALE` while the live store
   holds a package other than the one this run published, and it never brings main down to an older live package
   of another title (it reports that title as ahead).

A refusal (`SITE_...`, exit 2) leaves the checkout as it was; fix what it names and run the same command again.
Two site pull requests open at once both supersede the same approval record: merge one, then rebase and rerun the
step for the other.

## 1C. The cover (every book, while `auto` runs)

Every book gets a cover of its own, generated by the session with the Higgsfield CLI (`higgsfield`, signed in on the owner's account) in the minutes
`auto` spends writing. Done before `auto` reaches its publish, the cover goes up with the package, and the site
pull request (1B) carries it too: one merge and one deploy ship the whole book. The tool supplies the fixed prompt
and turns the image into the app's files; the picture and the look at the result are yours.

1. `CLI cover --book <cfg>`: the six art directions with how many books use each, and the pictures already taken
   (the ledger `scripts/book/v26/covers.json`).
2. Choose the picture. This is what makes the cover, so take a minute over it:
   - ONE concrete object or small scene a person takes in at a glance, standing for the book's central idea. Take
     it from the book's own lessons or stories (the keys in the config once `auto` has drafted them, or what you know
     of the book): a thing someone uses, a place, a gesture. For The Power of Habit: a footpath worn bare across a
     lawn. A picture drawn from the book is never the stock one (a light bulb, a brain, a summit).
   - Not the image on the book's well-known cover. No real person's face, no brand, nothing with words on it.
   - Not a picture already in the ledger.
   - Something that exists and could be photographed: every art direction renders the picture realistically (a
     photograph, or a painting true to life). Not a diagram, an icon or an impossible scene.
   - No face. A person appears at most from behind, far off or cropped (hands, feet).
   - One sentence, 60 words at most, saying only what is seen: the subject, where, from what viewpoint. No style
     words, no time of day and no lighting (the art direction supplies them) and no meaning ("a symbol of ...").
   - Pick the art direction that suits the picture from the least used ones (`--style <name>`); with no `--style`
     the tool takes the least used, which may not fit. `studio-object` and `painted-still-life` suit a single object
     with no setting; `daylight-photo`, `dusk-scene` and `miniature-scene` suit a place or a small scene; `mono-photo`
     suits either, where colour carries nothing.
3. `CLI cover --book <cfg> --concept "<the picture>" [--style <name>]` writes `<runDir>/cover/prompt.txt` (the last
   line it prints) and records the choice in the ledger.
4. Generate. Run the `generate:` line step 3 printed, as it stands (model `gpt_image_2_6`, aspect ratio `2:3`,
   resolution `2k`, quality `low`, one image). It waits for the job and prints JSON; the image address is
   `result_url`. Every try spends the owner's Higgsfield credits: 0.5 a try as measured 2026-11-12, since the plan's
   unlimited allowance does not apply through the CLI. Three tries cost about 2 credits a book at most. Never move to
   a costlier model or setting without the owner's yes (`gpt_image_2` at quality high costs 6.5 a try).
   If `higgsfield` is not installed, or `higgsfield account status` fails (not signed in, session expired, no
   workspace selected): do not sign in for the owner and do not improvise another route. The status line says
   `Cover: not generated (the Higgsfield CLI is not signed in; the owner runs higgsfield auth login)`, and the book
   ships with its existing cover or the placeholder tile. The Higgsfield connector in the app is read-only (model
   list, balance, past generations) and cannot generate.
5. Download the result into the run dir (`curl -sL -o <runDir>/cover/generated-1.png "<result url>"`) and LOOK at it
   (Read the image). Accept it only when all of these hold:
   - the title and the author's name are spelled exactly, and there is no other lettering anywhere in the image;
   - it is the flat cover itself, portrait, with nothing cut off at the edges;
   - the picture is the one asked for and reads at a glance, and the title would still be legible as a thumbnail;
   - it looks real (a photograph or a true-to-life painting), with nothing malformed (hands, laces, objects);
   - no watermark, no border or frame, no brand, and no recognisable face (an invented figure from behind, far
     off or cropped is fine).
   Otherwise generate again with the same prompt; after two failures on the lettering, the third try uses
   `--quality medium` (1 credit).
   Three tries at most. Never install an image with wrong or extra words. If none passes: `Cover: not generated
   (3 tries failed: <why>)`.
6. `CLI cover --book <cfg> --image <runDir>/cover/generated-N.png` converts it to the two files the app needs
   (600x900 WebP and AVIF), in the run dir and in the worktree's `public/book-covers/`. It refuses an image that is
   not portrait 2:3 or is too small (`COVER_ASPECT`, `COVER_TOO_SMALL`).
7. Nothing more for the cover itself: the publish uploads it with the package when the live store has no cover for
   the title yet (a new title), and `site` carries both files into the pull request and takes the title off the
   placeholder list. The housekeeping commit adds `public/book-covers/<bookId>.webp`, `.avif` and
   `scripts/book/v26/covers.json`. Send the owner the cover with SendUserFile (one card, no commentary), and add to
   the status line: `Cover: new (<art direction>).`

A cover made after the book published still reaches the public site through the site pull request. For a new
title the live store's own copy is only uploaded by the publish, so it stays without one until the registration
runs again: say so and ask the owner.

For a replaced title there are two copies of the cover, and the site pull request replaces only one (checked
2026-11-13):
- the web pages (public site and logged-in library) show `public/book-covers/<bookId>.webp` from the deployed
  build: the site pull request, merged and deployed, replaces it;
- the API hands every other client (the iOS app, and the web as a last resort) the live store's copy,
  `book-content/library/covers/<bookId>.webp`, named in `book-content/library/catalog.json`. The publish writes
  it only for a title that has none, and it is served with a one-year immutable cache. Replacing it is a write to
  the live store (put the new WebP at the same key with content type `image/webp` and the same cache header, then
  a CloudFront invalidation of that path): do it only on the owner's yes, and say that devices which already
  cached the old cover may keep it. The bucket keeps old versions, so it can be put back.

## 2. Keys, knowledge mode only (1 call, under $1)

`CLI keys --book <cfg>` writes `chapters[].keys` into the config: the author's advice, his own names for the tools
and steps in his order, his reasons where he gives them, a `Reversal:` sentence (`Reversal: none` when the author
gives no limit; it is there for the fact checker, the writer keeps it out of the chapter),
and `Story the author tells:` (or `none recalled with confidence`; for a book without stories expect that and keep
it). Drafted by the fixer, since the keys are the fact backbone every later call reads. Read all of them: each
belongs to its chapter, no quotation marks, no borrowed story or invented battle; keep a `Reversal:` only when it is
the chapter's own limit and delete a forced one. Edit by hand where wrong. For a knowledge-mode book, have the keys checked before the book is written (`auto`
does this itself, section 1A; by hand): two or
three independent subagents with web search, each asked to mark every sentence that is wrong, belongs to another
chapter or gives a reason the book does not give, and to name one story or case the chapter itself tells (who, what
they did, how it ended) with where they confirmed it. Merge what at least two agree on, and take the reasons out of
the stories. On Tiny Habits this caught an idea in the wrong chapter, three loose definitions and an invented
reason, and replaced "none recalled" with a real story in all eight chapters; every chapter is built on its key, so
this is the cheapest fidelity check there is. Show the owner and carry on (not a
wait); their edits must land before step 6, since variants, assemble and the book all read the keys. A rerun drafts
only chapters still without keys; `--force` redoes all.

## 3. Variants on the calibration chapter (7 calls, $2 to $3, about 10 min; skip with `exemplarFrom`)

Steps 3, 4 and 5 are only for a book that sets its own form. With `exemplarFrom` in the config, go to step 6 and
include chapter 1 in `--chapters`.

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

Background: `(date; CLI book --book <cfg> --chapters $(seq 1 N | paste -sd, -); echo "EXIT $?"; date) >
<runDir>/book-run-<date>.log 2>&1` (from 2 when chapter 1 is this book's own exemplar; a house exemplar is never a
chapter of this book, so chapter 1 is written like the rest). One early `head -2` of the log: the first tool line is `exemplar: ch01 (...);
openers rotate A/B/D; names off limits: <names>`; the names must be the invented people of ch01 only. If a book
term is there, stop the run (safe; chapters resume from files), fix `bookNames`, relaunch the identical command.

Per chapter: lessons call (lessons already taught, and the exemplar's own people, are off limits), one writer call
with the house exemplar as the bar and the chapter's plan as the order (the opener and its path, the
counterintuition frame, the form of the summary's last sentence, the tag and the setting of each example, what
makes the third example harder, the order of quiz and card forms, the key positions, the one piece of outside
advice the quiz may use as a wrong choice and the kinds of practice cue all come from the chapter number, so
chapters written side by side cannot land on one shape), 0-call checks (shape, exemplar copy, variety), Opus fact check and Sonnet key solver, one fix
round, land. At the end the log lists chapters clean or open, then `names used in more than one chapter` (chapters
written side by side never see each other's names; step 7 renames), `hooks that share words` (two first screens on
the same object, such as a yoga mat in chapters 2 and 3: give the later chapter a new hook with one `fix
--chapters N --issues` round; a hook may not hold quotation marks), then `k of N chapters clean; ledger $x of $y`.
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

Then read as the default reader does (or a wide sample for a long book): the hook and the counterintuition, the
short summary (fastRead), the first example, questions 1 to 5 and the practice plan. That is what most readers
meet, in that order. The bar, in the owner's words: does the first screen pull you in; is it easy to read; is it
interesting enough to keep going; is it complete enough to learn the lesson; are the examples and the other parts
relatable. A chapter that misses gets its findings as one `fix --chapters N --issues` round. Optional, only if
the pronoun tic or an aside about the author shows in two or more chapters (both are writer rules now): `CLI fix
--style --book <cfg> --chapters 1,...,N` (no checker re-roll, about $0.18 a chapter). Optional defect sweep for a long book: one reader
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

## 9. Score (one judge call and three solver runs per chapter, about $0.27 each)

`CLI score --book <cfg>` (reuses `<runDir>/eval/chNN.eval.json` when the same judge wrote it; `--force` re-judges). Per chapter: the share of
the judge's items passed, 0 to 100; the book: the mean. Prints a row per chapter (open flags, "quiz guessable" when
the no-chapter solver answers 4 or 5 of the first five keys without reading, the failed item ids), then
`band AUTO|MANUAL|FAIL` with the reasons and the chapters to redo; writes `<runDir>/score.json`. Exit 0, 1, 2.
The judge's items include one `TEMPT-<q>` per quiz question: at least one wrong choice is something a sensible
person who has not read the chapter might really pick. Since 2026-11-13 they also include, per quiz question,
`KEY-<q>` (the keyed choice is the only sound answer: no wrong choice can still be argued for) and `TELL-<q>` (the
right choice cannot be spotted by its wording or its length), and, per chapter, `VARY-examples` and `VARY-quiz`
(the examples, and the questions, show different sides of the lesson, not one move in new settings). The quiz
carries four items per question (`QUIZ`, `TEMPT`, `KEY`, `TELL`) plus one for the set (`VARY-quiz`), about half of
a chapter's items. Every saved
eval carries the judge's version; one from an older judge is asked again, so `score` on a book published before
2026-11-13 re-judges every chapter (about $0.27 each) and its band can change. `score.json` names its judge too:
`publish` refuses a score an older judge gave, so score the book again first. The repeat rule (books of four chapters and up): a kind of
item that is weak in at least half the chapters (a single item that fails, or a family such as QUIZ or TEMPT with
half its items failing) puts the book in the manual band with the reason named, for example `TRY fails in 6 of 8
chapters`, however high the mean: a reader meets that flaw in every chapter. The evidence for each failed item is
in `<runDir>/eval/chNN.eval.json`.
Thresholds are the config's `gate` (`{"auto": 80, "manual": 70}` by default). A chapter edited after the score
makes the score stale; run `score` again.
How to read the new scale: a chapter of the published quality scores about 83 where the old judge gave about 94. On
the 18 reader-rated chapters, chapters strict LLM readers gave 6 of 10 average about 78, 7 about 84, 8 about 86 (averages; the groups overlap widely).
The writer has carried these rules since 2026-11-13 (no forecast questions, one sound answer per question, three
different example instructions). In the proof on six chapters answer-key (`KEY`) fails fell from 22 of 42 to 6 and
same-move examples from 5 of 6 chapters to 1, while wrong choices a reader can strike out unread rose clearly and
give-away wording rose a little, so still expect a book to land in the manual band with `VARY-quiz` or
`PLAIN-summary fails in k of N chapters` (often `TELL` too) even when its mean is over 80; the judge's round of an
`auto` run then answers what a small edit can.

## 10. Publish, by band (the owner's gate, 2026-11-05)

- **auto** (mean at or above `auto`, every chapter at or above `manual`, no open fact or key flag): run
  `CLI publish --book <cfg>` at once, no question asked.
- **manual** (otherwise, mean at or above `manual`): when the only reasons are repeated kinds that a small edit
  fixes (a hook, a `tryThisNow`, a quiz choice), one pass is allowed first: per chapter, the judge's evidence for
  those items as `--issues` findings, `CLI fix --book <cfg> --chapters N --issues <file>`, then `score` again. Once,
  never a loop. Otherwise, or if the reason is still there: hand the owner the pack, the score and the reasons; on a
  yes, `CLI publish --book <cfg> --approve`. On a no, treat their notes as findings (step 7) and score again.
- **fail** (mean under `manual`): hand over the score and the `redo` list and ask permission to redo those chapters;
  only on a yes run `CLI book --book <cfg> --chapters <redo> --force`, then steps 7, 8 and 9 again. Two redo loops at
  most; after that it is the owner's call.

What `publish` does, in order, and stops at the first failure: builds `book-packages/<bookId>.v21.json` from the
landed chapters (chapterId `<bookId>-chNN`, number, readingTimeMinutes from the full read at 230 words a minute,
packageId `<bookId>-v26-<time>`, book metadata from the config, and the practice plan in the app's form: each
if-then plan's cue and action joined into one sentence in `plan`, and `context` set to work, school or personal,
because the reader app prints `context` in a small chip and prints `plan` alone in two places) and runs the app's own validator and category
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
next deploy or cold start; until then warm server instances can hold the old package while cold ones hold the new
one, so a quiz can be graded against the other version). Either way main must then be brought level with the live
store: section 1B.

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
| a reader says the chapters feel stamped from one mould | mostly the app's fixed chapter format (a myth-and-correction line under the hook, scene then author then fix, an example that stops before the move, the same quiz forms) | tell the owner it is the format, not the run. Three proofs on Tiny Habits (2026-11-12) tried more varied frames, example endings, quiz forms and a quiz cast: what readers noticed as variety also read as forced, and the safe subset scored no fresher than the live book. Kept from that work: the plan's `ENDINGS` and `OUTSIDE_FIXES` lists in `src/book.ts` |
| the author or a person from the book's stories is called "they" | the writer guessed a pronoun | one `--issues` round naming the person and the pronoun the keys use; check the keys say "he" or "she" somewhere |
| `score`: `<KIND> fails in k of N chapters` | a flaw repeated across the book (the repeat rule) | read the evidence in `eval/chNN.eval.json`; one `fix --issues` pass if a small edit fixes it, score again; else hand it to the owner |
| `score`: `KEY fails in k of N chapters` or `TELL fails in k of N chapters` | quiz answers can be argued for (a wrong choice is still sound, or the keyed outcome is not forced) or spotted by their wording | in an `auto` run the judge's round fixes what a small edit can; otherwise, or after it, read the evidence in `eval/chNN.eval.json` and run one `fix --issues` pass on the chapters named |
| `score`: `VARY-quiz fails in k of N chapters` or `VARY-examples fails in k of N chapters` | most questions key one move, or every example ends in the same move | not a small edit: the judge's round leaves it and the one `fix --issues` pass of step 10 is not for it; the owner reads the pack and decides (approve it as it is, or allow the chapters named to be written again) |
| an aside about the author or a "softer" note in several chapters | the brief tells the writer to go softer | fix the brief's limit line (step 1), `fix --style` on those chapters |
| `rename landed on "X"` | the rename picked a used name | `fix` once more on that chapter |
| lesson over 20 words refused twice | the lessons cap | rerun; the retry carries the error |
| `NO_FINAL_CHAPTER` from `fix` | a chapter never landed | drop it, rerun `book` for it |
| `publish`: `no score yet` / `changed after the score` | score missing or stale | run `score`, then `publish` |
| `publish`: `the score covers only some chapters` | `score` was run with `--chapters` | run `score` on the whole book, then `publish` |
| `auto`: `chNN: the note has no lesson to write a chapter from` | every advice sentence of that note was cut as doubtful (or drafted empty); only its Reversal and Story lines are left. A hard stop: `--keys-ok` does not pass it | write the chapter's advice into its note in the config (ask the owner, or check the book on the web), or delete that note so the next `auto` drafts and checks it again; then the identical command |
| `auto`: `chNN: both checkers say "..." is not the book's chapter at place N of the list` or `the checked note came back headed "...", but the config calls chapter N "..."` | the config's chapter list is wrong (written from memory), or the checkers are | check the table of contents on the web. Wrong list: correct the numbers, titles and the notes under them in the config, delete `<runDir>/keys/checked.json` and `<runDir>/keys/check-progress.json` (without that the old record is used again), and run the identical command. List right: ask the owner, and on their word run it with `--keys-ok` |
| `book`: `KEYS_EMPTY` | the same empty note, on a chapter written by hand | as for `the note has no lesson` above |
| `publish`: `written from keys that were never checked` | `auto` holds this book for unchecked keys (`auto.json`) | the owner reads the pack and the notes; `--approve` only on their yes |
| `publish`: `app validator:` or `category ... is not canonical` | the package would be rejected at ingest | fix the config's categories or the chapter it names; score and publish again |
| `publish`: `register:api failed` | AWS names or credentials | check `AWS_PROFILE=chapterflow` works (`aws sts get-caller-identity --profile chapterflow`) and the SSM names; rerun `publish` (idempotent by packageId) |
| `publish`: `not verified ... CDN caches` | the list is cached up to an hour | fine; check again later |
| trailing comma in `--chapters` | `seq -s,` | `seq a b \| paste -sd, -` |
| `cover`: `COVER_ASPECT` / `COVER_TOO_SMALL` | the image is not portrait 2:3, or under 600x900 | generate again at aspect ratio 2:3; never crop by hand |
| `cover`: `COVER_CONCEPT_INVALID` | the picture sentence is empty, over 60 words or has a line break | one plain sentence |
| `site`: `SITE_COVER_INCOMPLETE` | only one of the two cover files is in the worktree's `public/book-covers/` | run `cover --image` again |
| `site`: `SITE_REPO_DIRTY` | the checkout of main has changes to tracked files | use a fresh worktree of `origin/main` |
| `site`: `SITE_REPO_INVALID ... node_modules/.bin/tsx` | the worktree has no `node_modules` | link one or `npm ci` there (section 1B, step 2) |
| `site`: `SITE_STORE_FAILED` | the aws CLI, the profile or the SSM names | `aws sts get-caller-identity --profile chapterflow`; rerun |
| `site`: `SITE_LIVE_STALE` | the live store holds another package than this run published: a deploy ran from an older main, or the book was published from another run dir | merge the open site pull request if there is one, deploy main (the owner), then run `site` again; or publish again |
| `site`: `main is ahead of the live store for <id>` | main holds a newer package of another title than the live store | nothing to do here; the next prod deploy of main puts it live. Tell the owner |
| `site`: `SITE_HALF_WIRED` | the title is in the registry or in the catalog rows, not both | stop; tell the owner which, do not patch it by hand |
| `site`: `SITE_NOT_PUBLISHED` / `SITE_NOT_LIVE` | the book was not published by this tool, or is not in the live store | publish first |
| `auto`: `NEEDS-OWNER ... keys could not be checked` | a checker or the editor did not answer (web down, a refusal) | run the identical command later; or the owner reads the notes in the config and you pass `--keys-ok` |
| `auto`: `chapters were written before the keys were checked` | chapters exist and nothing records a check | the book waits on every run: the owner reads the pack and the notes, then `--approve` or `--keys-ok` |
| `auto`: `--keys-ok is not taken: the notes changed after the chapters were written` | a note was edited while the book was held as `unchecked` | the owner reads the pack, then `--approve`; or remove `chNN/` for the chapters whose notes changed and rerun |
| `auto`: `--keys-ok is not taken: keys were drafted in this run` | the config had no notes yet | nothing to do: the web check runs; pass `--keys-ok` only after the owner read the notes |
| `auto`: `--approve is not taken: the chapters changed` | a chapter was edited after the pack the owner read | the owner reads the new pack; then `--approve` again |
| `auto`: `--approve is not taken: this book was not waiting` | no pack was waiting for a yes (first run, or a keys hold) | run without it; pass it only after a `NEEDS-OWNER` with a pack |
| `auto`: `FAILED: stopped by an error: ...` | something outside the model calls broke | read the reason, mend it, run the identical command |
| `auto`: `RUN_DIR_MISMATCH` | two configs name one `runDir` | give each book its own run dir |
| `auto`: `AUTO_STATE_UNREADABLE` | `auto.json` is cut off | restore it; deleting it gives the book its one-off rounds again, so say so to the owner |

## Cost (from the 48 Laws ledgers, 2026-11-04, and the writer test of 2026-11-11)

Opus writing with Opus checks and fixes: $1.05 to $1.42 per chapter (Sonnet writing, the default until
2026-11-11: $0.63 to $0.91). Keys: under $1.
The web keys check in `auto`: about $0.35 a chapter (Tiny Habits, 2026-11-11: eight chapters, $2.82, eight minutes;
six of the eight notes got a story from the book, none of them wrong, against eight of eight when checked by hand).
Writer test under the reader bar (2026-11-11, three Tiny Habits chapters, two blind readers each on the default
reader path): Opus as writer was preferred 6 of 6 times, overall 8.0 against 6.8, at $1.05 to $1.42 a chapter
against $0.63 to $0.91 for Sonnet. On that result the owner made Opus the writer for new books (2026-11-11); books
already written keep their chapters unless the owner asks for a rewrite.
Calibration (variants, assemble, fixes): about $5. Fix passes: about $0.3 per open chapter per pass. Style pass:
$0.18 per chapter. Estimate = $5 + chapters x $1.4 + (chapters / 3) x $0.6, plus chapters x $0.35 for the keys
check when `auto` runs a knowledge-mode book, rounded up: 13 chapters about $30, 48 chapters about $100.
`budgetUsd` = twice that.
