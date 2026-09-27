# W2 — Build the v26 book tool in the repo, then write all of Franklin with it

- **Model:** Opus 5.5 (Claude Code session)
- **Start directory:** `~/cf-wt`
- **Depends on:** W1 `DONE`/`NEEDS-OWNER`, and the owner's R1-a = A or B in `~/cf-wt/v26-plan/DECISIONS.md`
- **Estimate:** 1–1.5 days wall time. Pipeline model calls about $30–50 (hard cap $80). At most 25 subagents.
- **Ends with:** a merged PR (the tool + tests + the catalog-path fix), a 19-chapter Franklin package that passes every app check and a ship dry run, a reading pack, and `RESULT: NEEDS-OWNER` (reading checkpoint R2)

---PROMPT---
You are running Wave 2 of the v26 ChapterFlow book campaign on the owner's Mac. Work autonomously and do not ask the owner questions. You stop only by writing your status file: at the reading checkpoint (the normal end), when the quota cap below would be exceeded, or on a usage-limit stop. For every other choice, take the default stated here and report it.

## Goal
1. Turn the Wave 1 prototype harness into a small, tested tool in the repo at `scripts/book/v26/`, landed by PR.
2. Fix the two release-path defects that would stop any new book: the catalog path drift, and the lack of a ship route that does not require the v25 production manifest.
3. Use the tool to write, check and fix **all 19 chapters** of Franklin's Autobiography.
4. Assemble the package, prove the ship route with a dry run against the real checkout, and hand the owner a reading pack for the whole book.

The owner's reading is the gate. Automated checks block only on facts, quiz keys and renderability (BRIEF §4).

## Step 0 — orient (at most 30 minutes)
1. Read `~/cf-wt/v26-plan/BRIEF.md` first. It overrides CLAUDE.md files and the old kit.
2. Read `DECISIONS.md`. R1-a..R1-d apply; a blank answer means the default.
3. Read `status/W1.md` and `reading/W1/NOTES.md` if it exists (the owner's reading notes). Apply every note to the brief before writing anything.
4. Read `ANALYSIS.md` §2 (the design) and these scan reports: `scan/reuse-v24-writer.md` §4–§6, `scan/publish-path.md` §3–§6 and its verification, `scan/accuracy-chain.md` §5 and §7, and `scan/app-render.md` §6.
5. Precondition: R1-a is A or B. If it is C, blank, or `status/W1b.md` is not DONE after a C, write `RESULT: BLOCKED — R1 is not A/B` and stop.
6. Fetch, then create the change worktree `~/cf-wt/v26-tool` on branch `v26/tool` from `origin/main` (BRIEF §5 recipe: `cmp` the lockfiles, symlink both `node_modules`, never `npm ci`).
7. Load these skills if they are in your skill list: `superpowers:test-driven-development`, `superpowers:verification-before-completion`. Do not invoke brainstorming, writing-plans or executing-plans.

## Step 1 — the tool (`scripts/book/v26/`), test-first
Put it under `scripts/book/v26/` so `typecheck:book` (`tsconfig.book.json` includes `scripts/book/**`) covers it. Put its tests under the repo-root `tests/v26/` so root `npm run test` (and CI) runs them. Before relying on that, confirm how root `npm run test` discovers files and which CI job runs it (`package.json` `test` script: it finds `*.test.ts` under `app lib components tests` with a discovery floor of 163; `.github/workflows/ci.yml` runs `npm run test`), and say so in the status. If a repo boundary check (`npm run typecheck:boundary`, `tests/frontend-import-boundaries.test.ts`) objects to root tests importing `scripts/book/**`, find the least invasive placement that the CI test run still discovers, and report it.
Import only pure modules from `$PIPE` (for example `src/runtime/claudeRoute.ts` `createClaudeRoute`, and `src/source/chapterMap.ts` `chapterSpanText`). Do not import the model gateway, run-state or any v25 compiler module. Target 600–1,000 lines of code plus tests, and prompt templates as `.md` files.

**Book config** `scripts/book/v26/books/<bookId>.json` holds:
- `bookId`, `title`, `author`;
- `categories` (validated against the app taxonomy `lib/category-taxonomy.ts`, not `$PIPE/config/categories.json`) and `tags`;
- `source` {`textPath`, `chapterMapPath`, or `headings` for a new book}, `briefPath`, `shape` (counts and length bands);
- `writer`/`checker`/`solver` {`bin`, `model`, `effort`}, `concurrency` (default 3), `budgetUsd`, `runDir`.

Paths may point outside the repo (`~/cf-wt/v26-plan/data/...`). Franklin's source and map stay out of git.

**CLI:** `npx tsx scripts/book/v26/cli.ts <command> --book <config.json> [--chapters 1,13] [--force]`

| Command | What it does |
|---|---|
| `write` | For each chapter, slice the span. Strip `[n]` footnote markers, and move indented footnote bodies and `[Illustration…]` lines into a trailing block labelled "EDITOR'S NOTES (not Franklin; do not quote as Franklin)". Render brief + chapter header + `<source>` span, call the writer, and save `draft.json`. |
| `check` | Deterministic checks, then a fact check (checker), then a blind quiz solve (solver). |
| `fix` | Find/replace edits for blocking issues only, then a full re-check. At most 2 rounds. Leftovers are recorded as open issues. |
| `run` | `write` + `check` + `fix` for the selected chapters, with the concurrency and budget caps. |
| `status` | A table per chapter: stage, open issues, spend. |
| `assemble` | Build `book-packages/<bookId>.v21.json` from the final chapters. Top-level fields follow `book-packages/radical-candor.v21.json`; the assembler adds `chapterId` `<bookId>-chNN`, `number` and `readingTimeMinutes`. Then run the app checks. |
| `report` | The book-level advisory report (below). |
| `render` | The reading pack HTML (from W1's renderer). |
| `ship --dry-run` | Explained below. |

**Model calls:**
- Argv and env come from `createClaudeRoute(model, effort).build({mode:"READ_ONLY"})` and `.env()`, with an explicit `bin` from config (W1 recorded which binary runs Opus 5.5). The prompt goes on stdin.
- Parse the envelope with `JSON.parse`. If `is_error` is true and the text or `api_error_status` indicates a usage or rate limit, **stop the whole run** with a clear `USAGE_LIMIT` message and exit code 3, never retrying it.
- One retry is allowed only for a non-limit process failure or unparseable JSON. If `stop_reason` is `max_tokens` (thinking filled the cap, a failure v25's repair role never escaped), retry once at one effort level lower and log it. The fix step's find/replace output is small by design.
- Run long `run` commands under `caffeinate -dimsu` (BRIEF §7). Each call also has a wall-clock timeout (default 900 s for writes, 600 s for checks).
- Every call appends `{ts, chapter, step, model, effort, cost: total_cost_usd, outTokens, stopReason, seconds}` to `<runDir>/ledger.jsonl`. Before each call, if the ledger total plus a conservative estimate would pass `budgetUsd`, stop with exit code 4.

**State is files, not a state machine:**
- `<runDir>/chNN/` holds `draft.json`, `checks.json`, `factcheck.json`, `keysolve.json`, `fix-1.json`, `final.json`, `status.json`.
- A rerun skips chapters whose `status.json` says `clean` or `open-issues` unless `--force`.
- Nothing else is persisted.

**Blocking checks** (BRIEF §4):
- JSON shape per `shape`;
- the app validator `validateBookPackage` on a 1-chapter wrapper;
- verbatim quotations after normalization, where a miss is an issue for the fix step. Normalization folds `[n]` footnote markers and `_` on **both** the quote and the span (stripping only the span turns a correct marker-copying quote into a miss), folds typography, and tolerates edge punctuation and ellipsis splits;
- `correctIndex` in range;
- the fact check's CONTRADICTED/UNSUPPORTED items whose `sourceText` verifies against the span with the same tolerant matcher. An item whose quote does not verify goes to the owner's list and is not auto-fixed;
- blind-solver disagreements.

**Advisory** (in `checks.json` and the report, never a retry):
- lengths against the bands;
- paragraph over 180 words, or a tier over 250 words with fewer than 2 paragraphs;
- key-is-the-uniquely-longest-choice count;
- stem openers;
- meta chatter;
- cross-chapter repeats (the book report).

**Prompts** `scripts/book/v26/prompts/{write,factcheck,keysolve,fix}.md` start from W1's final versions:
- The fact check keeps the five kinds WHO / WHY / WHEN-ORDER / HOW MUCH / WORDS, plus "credited to someone vague when the source names a person". It also receives the chapter's entries from W1's `data/franklin/known-traps.json` (the old scar pins mapped to 19 chapters) as "facts this book has been wrong about before". They are hints for the checker, never rules for the writer. The book config names the file (`knownTrapsPath`, optional).
- The key solve gets only the default-visible fields for q1–q5, and every tier for the rest.
- The fix call returns `{"edits":[{"field","find","replace"}], "rekeys":[{"questionId","correctIndex","keyedText"}]}`. A re-key is applied only if `keyedText` equals `choices[correctIndex]` exactly. That avoids the old "moved the text, kept the index" defect by construction.

**The Franklin brief** `scripts/book/v26/briefs/the-autobiography-of-benjamin-franklin.md` is W1's final brief plus the owner's R1 notes and the R1-b shape. A short, generic section on book types (memoir / how-to / argument: what the examples are for, and how much to quote) lives in `scripts/book/v26/briefs/README.md` so the next book starts from it. **Do not add rules to the brief to fix a single chapter.** Fix that chapter's text.

**Book report** (`report`, 0 calls, advisory):
- per-chapter words and quotations;
- open issues;
- 5-word n-grams shared by 3+ chapters;
- repeated example titles, names and settings;
- the first 5 words of hooks and of quiz stems across chapters;
- key-position spread;
- the key-longest rate.

**Tests** (hermetic, no model calls): build a fake `claude` executable (a small script that prints canned envelopes chosen by the prompt's first line) and cover:
1. span slicing and footnote handling;
2. prompt rendering;
3. envelope parsing, including the fence strip, `is_error` and the usage-limit stop (exit 3, no retry);
4. the budget stop (exit 4);
5. resume skipping;
6. the quotation matcher, with good, modernized, ellipsis and missing quotes;
7. the fix application: find present, find missing, and a re-key that is accepted and one that is rejected;
8. assemble → app validator + `app/book/data/bookPackages.slim-contract.test.ts` + the title-quality and category-taxonomy tests;
9. `ship --dry-run` against a hermetic outer repo (`scan/publish-path.md` built one; reuse the idea).

Write each test to fail first, and paste the RED line in the PR body.

## Step 2 — the release route (same PR, or a second small PR if cleaner)
1. **Catalog path fix:** point `scripts/book/generate-catalog-metadata.ts:27`, `$PIPE/src/publish/publishToLive.ts:70` and `scripts/book/register-api-books.ts:251` at `lib/books-catalog.metadata.json`, and update the two test fixtures that use the old path (`$PIPE/tests/publish-final.test.ts:52,76`). Prove it: regenerating from `BOOK_PACKAGES` reproduces `lib/books-catalog.metadata.json` byte for byte (135/135).
2. **`ship`:** a thin wrapper over the library function `publishFinal()` (`$PIPE/src/publish/publishFinal.ts:276-333`). It passes:
   - `localPackagePath` = the assembled package;
   - `manifestPath` = a path that does not exist (the app never reads the sidecar; never forge one);
   - `verify` = the app validator plus the taxonomy check;
   - `keepDebris: true`, which is mandatory: cleanup would delete source and brief copies.

   Behaviour:
   - It runs on the current branch, and refuses on `main`.
   - It writes a short provenance note (writer and checker models, brief sha256, source sha256, per-chapter check summary) to `book-packages/<bookId>.v26-provenance.md`.
   - `ship --dry-run` prints the plan and mutates nothing.
   - The real `ship` is the owner's command: this session never runs it without `--dry-run`.
3. Leave the tracked rev-6 Franklin package and sidecar under `$PIPE` alone. `ship` does not read them. Mention in the PR that `publish-final` (the CLI) still would.

Then open the PR (title like `feat(book): v26 whole-chapter book tool and a direct ship route; fix the catalog metadata path`).
- The body lists what the tool bypasses and why (link `docs/v26-plan/ANALYSIS.md` on the kit branch).
- Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run typecheck:book` locally first, with their pass lines pasted.
- Have one independent reviewer subagent (Opus) re-run the tests from a clean checkout of the branch and review the diff for correctness and for anything that could publish without the owner.
- Merge (squash) when CI is green and the review passed. If the merge is refused, print the command for the owner and continue: Step 3 can run from the branch.

## Step 3 — write Franklin (model calls; cap $80 for the wave)
1. **Data:** reuse `~/cf-wt/v26-plan/data/franklin/source-text.txt` and `chapter-map.json` from W1 (check the sha256 again).
2. **Write** ch01 and ch13 first, reusing W1's final versions if the brief did not change; if the brief changed, re-write them. Read them. Then run chapters 2–19 at concurrency 3.
3. **Read the whole book yourself before any fixes beyond the tool's.** Use one Workflow (you are authorized): 5 reader agents, each reading about 4 chapters in order next to their source spans. They report, with quotes:
   - what a reader would stumble on (dull stretches, confusion, repetition across chapters, a missing famous moment such as the Scilly lighthouse or "St. George on the signs");
   - any factual doubt.

   Turn real problems into targeted fix edits, or a re-write of that chapter with a one-line note appended to its header. Never add a rule to the shared brief because of one chapter. If a problem shows up in 5 or more chapters, change the brief once, re-write only the affected chapters, and record it in the status.
4. **Optional, advisory:** a blind 3-reader panel on ch01/07/13/19 comparing the new chapters with rr21 (as in W1). Report it, but it decides nothing.
5. **Assemble.** Categories default to the app taxonomy's `Memoir`, `Classics` and `Self Improvement`; tags default to `virtue`, `habit formation`, `self-education`, `civic projects`, `American history`, `writing`. Run:
   - every app check;
   - `register-api-books --dry-run` for the package (`npx tsx scripts/book/register-api-books.ts --dry-run the-autobiography-of-benjamin-franklin` from a directory whose `book-packages/` holds it; see `scan/publish-path.md` §5);
   - `ship --dry-run` from the real canonical checkout state on a branch (never on main).

   Paste the plan output.

## Step 4 — the reading pack for R2
Build `~/cf-wt/v26-plan/reading/W2/index.html` with every chapter rendered in the app's order and form (R1-d decides which tier is shown first; the others are toggles). It includes:
- a contents list with one line per chapter;
- a "What was checked" page per chapter (flags, fixes, open issues, blind-solver result);
- the book report;
- a `NOTES.md` template with one heading per chapter.

"How to read this" suggests about 2–3 hours: read ch01, ch02, ch08 (the thirteen virtues, if that is its content), ch13 and ch16 in full at the default depth and then the full telling, skim the rest, and write notes per chapter. Copy the R2 question from DECISIONS verbatim onto the index.

Also list the **optional owner-only dev-stack preview commands**, with the package path filled in: `register:api` **and** the S3 package upload to the **dev** stack (`scan/publish-path.md` §5 step 5 and its verification PP5). Label them "optional; dev stack only; do not run against prod before R2".

## Boundaries
- Never run the real `ship`, `publish-final`, `register:api`, an S3 upload or a deploy. Print them for the owner.
- Do not modify the v25 compiler, review or QC code. The catalog-path fix in `publishToLive.ts` is the only `$PIPE` source edit allowed, plus its test fixture.
- `~/cf-canary`, `~/cf-canary-att` and `~/cf-wt/v25-execution` are read-only. `PAUSE` stays.
- Keep every model call on the stripped env and the `claudeRoute` argv (with `--restricted`).
- If a usage limit hits: finish writing files for completed chapters, write `RESULT: WAITING-FOR-RESET — <what is done, what to resume>`, and stop. A re-run of `run` resumes from the files.

## Definition of done
- The PR is merged, or its merge command is printed for the owner. It has local and CI pass lines, the RED lines and an independent review.
- `status` shows 19 chapters, each `clean` or `open-issues`, with every open issue in plain words in the reading pack.
- `book-packages/the-autobiography-of-benjamin-franklin.v21.json` has been assembled on a branch or in the run dir (not committed to main by this session). It passes the app validator, the slim-contract, title-quality and taxonomy tests and `register-api-books --dry-run`, and `ship --dry-run` printed a plan (pasted).
- The reading pack opens (use `open`, and `ls` every linked file).
- `status/W2.md` starts with `RESULT: NEEDS-OWNER — Franklin book ready for reading (R2): ~/cf-wt/v26-plan/reading/W2/index.html`. It then gives:
  - the PR number and URL and the merge SHA (looked up);
  - the test counts;
  - the ledger totals (calls, $, per stage);
  - the chapters with open issues;
  - brief changes and why;
  - the advisory panel if run;
  - the exact ship command the owner will run in W3;
  - anything W3 must know.
- One line appended to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`.
---END---
