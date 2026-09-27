# W2 — Build the v26 book tool in the repo, then write all of Franklin with it

- **Model:** Opus 5.5 (Claude Code session, started as `caffeinate -dimsu claude` in `~/cf-wt`)
- **Start directory:** `~/cf-wt`
- **Depends on:** W1 (and W1b if it ran) finished, and the owner's R1-a line reads A or B in `~/cf-wt/v26-plan/DECISIONS.md`
- **Estimate:** 1–1.5 days wall time. Pipeline model calls about $30–50 (hard cap $80). At most 25 subagents.
- **Ends with:** a merged PR (the tool + tests + the catalog-path fix), a 19-chapter Franklin package that passes every app check and a ship dry run, a reading pack, and `RESULT: NEEDS-OWNER` (reading checkpoint R2)

---PROMPT---
You are running Wave 2 of the v26 ChapterFlow book campaign on the owner's Mac. Work autonomously and do not ask the owner questions. You stop only by writing your status file: at the reading checkpoint (the normal end), when the quota cap below would be exceeded, or on a usage-limit stop. For every other choice, take the default stated here and report it.

## Goal
1. Turn the Wave 1 prototype harness into a small, tested tool in the repo at `scripts/book/v26/`, landed by PR.
2. Fix the two release-path defects that would stop any new book:
   - the catalog path drift;
   - the lack of a ship route that does not require the v25 production manifest.
3. Use the tool to write, check and fix **all 19 chapters** of Franklin's Autobiography.
4. Assemble the package, prove the ship route with a dry run, and hand the owner a reading pack for the whole book.

The owner's reading is the gate. Automated checks block only on facts, quiz keys and renderability (BRIEF §4).

## Resuming
If `~/cf-wt/v26-plan/status/W2.md` exists and starts with `RESULT: WAITING-FOR-RESET` or `RESULT: PARTIAL`, this is a re-run:
- Reuse `~/cf-wt/v26-tool` and do not re-create it.
- Look up the PR with `gh pr list -R WillSoltani/ChapterFlow --head v26/tool --state all`. If it is merged, skip Steps 1–2.
- Run `npx tsx scripts/book/v26/cli.ts status --book <config>` and continue Step 3 with `run`, which skips finished chapters.
- Overwrite `status/W2.md` only at the end.

## Step 0 — orient (at most 30 minutes)
1. Read `~/cf-wt/v26-plan/BRIEF.md` first. It overrides CLAUDE.md files and the old kit.
2. Read `DECISIONS.md` (R1-a, R1-b and R1-d apply; a blank answer means the default), `status/W1.md`, and `reading/W1/NOTES.md` if it exists. Apply every note to the brief before writing anything.
   - If `status/W1b.md` exists, also read it and `reading/W1b/NOTES.md`.
   - The R1-a line names the version that goes forward: `W1`, `F` or `G` (default `F` if a W1b round ran and the line does not say). Use that version's brief and format. The files are listed in the W1/W1b status.
   - If the owner's notes ask for fewer, longer chapters, build a merged chapter map by joining neighbouring spans (1+2, 3+4, …, 19 alone). Re-key `known-traps.json` to it, record the pairing, and read every "19" below as the new count. Otherwise use the 19 edition chapters.
3. Read `ANALYSIS.md` §2 and §6 (the design), then these scan reports:
   - `scan/reuse-v24-writer.md` §4–§6;
   - `scan/publish-path.md` §3–§6 and its verification section;
   - `scan/accuracy-chain.md` §5 and §7;
   - `scan/app-render.md` §6.
4. **Precondition:** the `Owner:` line under R1-a reads A or B (after a W1b round the owner overwrites it). If it reads C, STOP or is blank, write `RESULT: BLOCKED — R1-a is not A/B` and stop.
5. **Change worktree** `~/cf-wt/v26-tool` on branch `v26/tool`: `git -C ~/ChapterFlow-books-v25-completion fetch origin && git -C ~/ChapterFlow-books-v25-completion worktree add -b v26/tool ~/cf-wt/v26-tool origin/main`. Then `cmp` the lockfiles and symlink both `node_modules` (BRIEF §5); never `npm ci`. Reuse the worktree if it exists.
6. Load `superpowers:verification-before-completion` if it is in your skill list. Do not invoke brainstorming, writing-plans or executing-plans.

## Step 1 — the tool (`scripts/book/v26/`)
**Placement.**
- Code and tests live in `scripts/book/v26/`, with tests in `scripts/book/v26/tests/*.test.ts`. That keeps them in the book program (`typecheck:book`, whose `tsconfig.book.json` includes `scripts/book/**`) and out of the app program.
- **Nothing under `app/`, `lib/`, `components/` or `tests/` may import `scripts/book/**`.** A root test that does fails `npm run typecheck`: it pulls pipeline files into `tsconfig.app.json`'s strict program (a probe measured about 30 errors for `claudeRoute` + `chapterMap` alone) and trips the boundary check.
- Make CI run the tests by adding `scripts/book/v26` to the roots of the root `test` script in `package.json` (`find app lib components tests scripts/book/v26 …`; keep the floor at 163). Paste the discovery count before and after.

**Imports.**
- Import only pure modules from `$PIPE`: `src/runtime/claudeRoute.ts` (`createClaudeRoute`, `normalizeClaudeStdout`, `classifyClaudeStdout`), `src/source/chapterMap.ts` (`chapterSpanText`) and `src/source/sourceText.ts` if useful. Never import the model gateway, run-state or any v25 compiler module.
- The one exception is `ship`, which imports `$PIPE/src/publish/publishFinal.ts` (the function is at :480; its options type `PublishFinalOptions` is at :276-333).
- From the app, import only modules the book program already reaches: `@/app/app/api/book/_lib/validate-book-package`, `@/lib/category-taxonomy`, `@/app/book/data/bookPackages`. Render the reading pack without app imports.
- Before the PR, run `npm run typecheck:shared-closure -- --base origin/main` and paste its PASS line.

Target 600–1,000 lines of code plus tests, with prompt templates as `.md` files.

**Book config** `scripts/book/v26/books/<bookId>.json` holds:
- `bookId`, `title`, `author`;
- `categories` (validated against `lib/category-taxonomy.ts`) and `tags`;
- `source` {`textPath`, `chapterMapPath`}, `knownTrapsPath` (optional), `briefPath`, `shape` (counts and length bands);
- `writer`, `checker` and `solver`, each {`bin`, `model`, `effort`};
- `concurrency` (default 3), `budgetUsd`, `runDir`.

Paths may point outside the repo (Franklin's source and map stay in `~/cf-wt/v26-plan/data/franklin/`, out of git). The loader expands a leading `~/` with `os.homedir()`. Tests use their own temp-dir configs and never read the Franklin config.

If the version going forward is **G** (GPT-5.5), the `writer` entry is `{"kind":"codex","model":"gpt-5.5","effort":"xhigh"}`. The write step then shells out exactly as W1b did; `status/W1b.md` records the argv and env. The checker and solver stay on Claude.

**CLI:** `npx tsx scripts/book/v26/cli.ts <command> --book <config.json> [--chapters 1,13] [--force]`

| Command | What it does |
|---|---|
| `write` | For each chapter: slice the span and make the writer's form (as in W1: strip `[n]` markers; move footnote bodies and `[Illustration…]` lines into the labelled EDITOR'S NOTES block), render brief + chapter header + `<source>` span, call the writer, and save `draft.json`. |
| `check` | Deterministic checks, then a fact check (checker), then a blind quiz solve (solver). |
| `fix` | Edits for blocking issues only, then a full re-check. At most 2 rounds. Leftovers are recorded as open issues. |
| `run` | `write` + `check` + `fix` for the selected chapters, with the concurrency and budget caps. |
| `status` | A table per chapter: stage, open issues, spend. |
| `assemble` | Build `<runDir>/book-packages/<bookId>.v21.json` (**outside any checkout**) from the final chapters. Top-level fields follow `book-packages/radical-candor.v21.json`; add `chapterId` `<bookId>-chNN`, `number` and `readingTimeMinutes`. Then run the app checks. |
| `report` | The book-level advisory report (below). |
| `render` | The reading pack HTML (from W1's renderer). |
| `ship [--dry-run] [--outer-root <abs path>]` | Explained in Step 2. |

**Never write the package into a checkout's `book-packages/`.** `publishFinal`'s bridge step refuses when `<outerRoot>/book-packages/<bookId>.v21.json` is untracked or dirty, and its dry run returns before that check, so a dry run would pass while the owner's real ship fails.

**Model calls.**
- The argv comes from `createClaudeRoute(model, effort).build(profile).args`, where `profile` is a complete `ExecutionProfile` with `mode: "READ_ONLY"` (see `$PIPE/src/runtime/executionPolicyTypes.ts` for its 8 fields). The command is the config's `bin`, never the route's `"claude"`.
- The child env is `{...process.env, ...route.env()}` with `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` deleted. A test asserts that the argv contains `--restricted` and `--disallowedTools *`, and that neither key is in the child env.
- The working directory is an empty scratch dir. The prompt goes on stdin.
- Parse the envelope with `JSON.parse`. If `is_error` is true and the text or `api_error_status` shows a usage or rate limit, **stop the whole run** with a clear `USAGE_LIMIT` message and exit code 3. Never retry it.
- One retry is allowed only for a non-limit process failure or unparseable JSON. If `stop_reason` is `max_tokens`, retry once at one effort level lower and log it.
- Each call has a wall-clock timeout: 900 s for writes, 600 s for checks. Run long `run` commands under `caffeinate -dimsu`.
- Every call appends `{ts, chapter, step, model, effort, cost: total_cost_usd, outTokens, stopReason, seconds}` to `<runDir>/ledger.jsonl`. Before each call, if the ledger total plus $2 (write or fix) or $1 (other) would pass `budgetUsd`, stop with exit code 4.

**State is files, not a state machine.**
- `<runDir>/chNN/` holds `draft.json`, `checks.json`, `factcheck.json`, `keysolve.json`, `fix-1.json`, `final.json` and `status.json`.
- A rerun skips chapters whose `status.json` says `clean` or `open-issues`, unless `--force`.

**Blocking checks** (BRIEF §4):
- the JSON shape per `shape`, and the app validator on a 1-chapter wrapper;
- verbatim quotations: normalization folds `[n]` markers and `_` on **both** the quote and the span, folds typography, and tolerates edge punctuation and ellipsis splits. It extracts straight and curly quotes. A fullRead with 0 quotations fails for a memoir;
- `correctIndex` in range, no tier over 180 words as a single paragraph, and no model or meta chatter;
- the fact check's CONTRADICTED/UNSUPPORTED items whose `sourceText` verifies against the span with the same matcher. An item whose quote does not verify goes to the owner's list and is not auto-fixed;
- blind-solver disagreements on q1–q5. On q6–q7 they block only if W1's status found real key errors there; otherwise they are advisory.

**Advisory** (in `checks.json` and the report, never a retry): lengths against the bands; paragraphs over 140 words; the key-is-the-uniquely-longest-choice count; stem openers.

**Prompts** `scripts/book/v26/prompts/{write,factcheck,keysolve,fix}.md` start from W1's final versions (`~/cf-wt/v26-plan/tools/proto/prompts/`).
- The fact check uses the prompt W1's calibration chose. It also receives the chapter's entries from `known-traps.json` as "facts this book has been wrong about before": hints for the checker, never rules for the writer.
- The key solve sees only what a new reader saw (hook, counterintuition, fastRead, memorable lines, tryThisNow and the first example) for q1–q5, and all tiers for q6–q7.
- The fix call returns W1's schema: `{"edits":[{"field","find","replace"}],"keyChanges":[{"questionId","newIndex","keyedChoiceText"}]}`. A key change is applied only if `keyedChoiceText` equals `choices[newIndex]`.

**The Franklin brief** is `scripts/book/v26/briefs/the-autobiography-of-benjamin-franklin.md`: W1's final brief, plus the owner's R1 notes, plus the R1-b format (default B: Franklin's own stories as examples 1–2). A short, generic section on book types lives in `scripts/book/v26/briefs/README.md`, so the next book starts from it. It covers memoir, how-to and argument books: what the examples are for, and how much to quote. **Do not add rules to the brief to fix a single chapter.** Fix that chapter's text.

**Book report** (`report`, 0 calls, advisory): per-chapter words and quotations; open issues; 5-word n-grams shared by 3 or more chapters; repeated example titles, names and settings; the first 5 words of hooks and quiz stems across chapters; key-position spread; the key-longest rate.

**Tests** are hermetic, with no model calls. Build a fake `claude` executable (a small script that prints canned envelopes chosen by the prompt's first line), and cover:
1. span slicing and footnote handling;
2. prompt rendering;
3. envelope parsing, including the fence strip, `is_error` and the usage-limit stop (exit 3, no retry);
4. the budget stop (exit 4);
5. resume skipping;
6. the quotation matcher, with good, modernized, ellipsis, curly-quote and missing quotes;
7. the fix application: find present, find missing, and a key change that is accepted and one that is rejected;
8. assemble → app validator + the slim-contract, title-quality and category-taxonomy rules;
9. `ship --dry-run` against a hermetic outer repo (via `--outer-root`), including:
   - a dirty outer package, which must make it exit non-zero;
   - a real hermetic ship, whose pushed branch must contain the provenance commit.

## Step 2 — the release route (same PR, or a second small PR if cleaner)
1. **Catalog path fix.** Point `scripts/book/generate-catalog-metadata.ts:27`, `$PIPE/src/publish/publishToLive.ts:70` and `scripts/book/register-api-books.ts:251` at `lib/books-catalog.metadata.json`.
   - Update the fixture lines that pin the old path: `$PIPE/tests/publish-final.test.ts:52,76` and `$PIPE/tests/publish-final-outcomes.test.ts:36,60` (`command grep -rn booksCatalog.metadata $PIPE/tests` for any others).
   - Prove it: regenerating from `BOOK_PACKAGES` reproduces `lib/books-catalog.metadata.json` byte for byte (135/135).
   - CI does not run the `$PIPE` suite, so run both test files locally and paste their pass lines: `cd $PIPE && CHAPTERFLOW_NO_API_CODEX_QC=1 env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY npx tsx tests/publish-final.test.ts`, then the same for `publish-final-outcomes.test.ts`.
2. **`ship`** is a thin wrapper over `publishFinal()`. It passes:
   - `localPackagePath` = the assembled package in the run dir;
   - `manifestPath` = a path that does not exist (the app never reads the sidecar; never forge one);
   - `verify` = the app validator plus the taxonomy check;
   - `keepDebris: true` (mandatory: cleanup would delete source and brief copies);
   - `outerRoot` from `--outer-root`, defaulting to the checkout running the CLI.

   Behaviour:
   - It refuses on `main`.
   - It refuses when `git -C <outerRoot> status --porcelain -- book-packages/<bookId>.v21.json` is non-empty, in dry runs too, and prints why.
   - On a real run it first writes a short provenance note to `<outerRoot>/book-packages/<bookId>.v26-provenance.md`: writer and checker models, brief sha256, source sha256, and a per-chapter check summary. It commits that note on the current branch (`git -C <outerRoot> commit -- ':(literal)book-packages/<bookId>.v26-provenance.md'`), and only then calls `publishFinal`, whose commit covers only the package, sentinel, registry and catalog.
   - `--dry-run` prints the note, the commit it would make and publishFinal's plan, and mutates nothing.
   - The real `ship` is the owner's command. This session never runs it without `--dry-run`.
3. Leave the tracked rev-6 Franklin package and sidecar under `$PIPE` alone. `ship` does not read them. Mention in the PR that the `publish-final` CLI still would.

**Then open the PR.**
- Title: like `feat(book): v26 whole-chapter book tool and a direct ship route; fix the catalog metadata path`.
- The body lists what the tool bypasses and why (link `docs/v26-plan/ANALYSIS.md` on the kit branch) and pastes the final pass lines: `npm run typecheck`, `npm run lint`, `npm run test` (with the discovery count), `npm run typecheck:book`, `typecheck:shared-closure`, and the two `$PIPE` test files.
- One independent reviewer subagent (Opus) re-runs the tests from a clean checkout of the branch and reviews the diff for correctness, and for anything that could publish without the owner.
- Squash-merge when the review passed and the **required** checks pass (`.github/rulesets/main-branch.json`: App Build + Tests, Lambda Handler Tests, v21 Pipeline Typecheck + Tests, Infra Build + CDK Synth, Secret & Artifact Scan, Style & Token Drift Scan, Lint Ratchet). "E2E Smoke" has been red on main since before this campaign; say so if it is red, but it does not block.
- If the merge is refused, print the command for the owner and continue: Step 3 runs from the branch.

## Step 3 — write Franklin (model calls; cap $80 for the wave)
1. **Data.** Reuse `~/cf-wt/v26-plan/data/franklin/source-text.txt`, `chapter-map.json` and `known-traps.json` from W1, and check the sha256 again.
2. **The two W1 chapters.** Take the two chapters W1 wrote: ch01 plus ch13 (N2 = A) or ch07 (N2 = B). Reuse W1's final versions if the brief did not change, and re-write them if it did. Read them. Then run the other chapters under `caffeinate -dimsu`, at concurrency 3.
3. **Read the whole book yourself before any fixes beyond the tool's.**
   - Use one Workflow (you are authorized): 5 reader agents, each reading about 4 chapters in order next to their source spans.
   - They report, with quotes, what a reader would stumble on: dull stretches, confusion, repetition across chapters, or a missing famous moment (e.g. the Scilly lighthouse, or "St. George on the signs"). They also report any factual doubt.
   - Turn real problems into targeted fix edits, or into a re-write of that chapter with a one-line note appended to its header. Never add a rule to the shared brief because of one chapter.
   - If a problem shows up in 5 or more chapters, change the brief once, re-write only the affected chapters, and record it.
4. **Advisory panel (optional).** A blind 3-reader panel on ch01/07/13/19, comparing the new chapters with rr21 (the owner listed a small advisory panel as part of evaluation). Report it; it decides nothing. Skip it if the budget is tight.
5. **Assemble and dry-run.**
   - Categories: `Memoir`, `Classics`, `Self Improvement`. Tags: `virtue`, `habit formation`, `self-education`, `civic projects`, `American history`, `writing`.
   - Run every app check, and the API ingest dry run: `(cd <runDir> && TSX_TSCONFIG_PATH=~/cf-wt/v26-tool/tsconfig.json ~/cf-wt/v26-tool/node_modules/.bin/tsx ~/cf-wt/v26-tool/scripts/book/register-api-books.ts --dry-run the-autobiography-of-benjamin-franklin)`.
   - Run `ship --dry-run` from a worktree on a branch, never from the canonical checkout (it is on main and must not switch branches): use `~/cf-wt/v26-tool` on `v26/tool`. If that branch was squash-merged, make a fresh change worktree `~/cf-wt/v26-franklin-dry` on branch `books/franklin-v26-dry` from origin/main (remove it afterwards, and never push its branch).
   - Paste the plan output.

## Step 4 — the reading pack for R2
Build `~/cf-wt/v26-plan/reading/W2/index.html` with every chapter rendered in the app's order and form (R1-d decides which tier opens first; the others are toggles). It includes:
- a contents list with one line per chapter;
- a "What was checked" page per chapter (flags, fixes, open issues, blind-solver result);
- the book report;
- a `NOTES.md` template with one heading per chapter.

"How to read this" suggests about 2–3 hours: read ch01, ch02, ch09 (the thirteen virtues and the little book), ch13 and ch16 in full, first at the default depth and then the full telling; skim the rest; and write notes per chapter. Copy the R2 question from DECISIONS onto the index verbatim.

## Boundaries
- Never run the real `ship`, `publish-final`, `register:api`, an S3 upload or a deploy. Print them for the owner.
- Do not modify the v25 compiler, review or QC code. The only `$PIPE` edits allowed are the catalog-path fix in `publishToLive.ts` and the `$PIPE` test fixtures that pin the old path.
- `~/cf-canary`, `~/cf-canary-att` and `~/cf-wt/v25-execution` are read-only. `PAUSE` stays.
- If a usage limit hits: finish writing files for completed chapters, write `RESULT: WAITING-FOR-RESET — <what is done, what to resume>`, and stop.

## Definition of done
- The PR is merged, or its merge command is printed for the owner. The PR has pass lines and an independent review.
- `status` shows every chapter as `clean` or `open-issues`, with every open issue in plain words in the reading pack.
- The Franklin package is assembled in the run dir. It passes the app validator, the slim-contract, title-quality and taxonomy rules and `register-api-books --dry-run`, and `ship --dry-run` printed a plan (pasted).
- The reading pack opens (use `open`, and `ls` every linked file).
- `status/W2.md` starts with `RESULT: NEEDS-OWNER — Franklin book ready for reading (R2): ~/cf-wt/v26-plan/reading/W2/index.html`. It then gives:
  - the PR number, URL and merge SHA (looked up);
  - the test counts;
  - the ledger totals (calls, $, per stage);
  - the chapters with open issues;
  - brief changes and why;
  - the run-dir path and the package sha256;
  - the exact ship command W3 will hand the owner;
  - anything W3 must know.
- One line appended to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`.
---END---
