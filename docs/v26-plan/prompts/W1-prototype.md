# W1 — Side-by-side prototype: two whole Franklin chapters, then the owner reads

- **Model:** Opus 5.5 (Claude Code session, started as `caffeinate -dimsu claude` in `~/cf-wt`. If `claude --version` is below 2.1.280, start it with the VS Code extension's binary instead, `caffeinate -dimsu "$(ls -d ~/.vscode/extensions/anthropic.claude-code-* | tail -1)/resources/native-binary/claude"`, or run the session on Opus 5)
- **Start directory:** `~/cf-wt`
- **Depends on:** nothing. The owner pastes it when there is quota, by default after the weekly reset on Tue 2026-09-29 23:00Z. If you are running, start, whatever the date.
- **Estimate:** 5–8 hours wall time. About 14–20 pipeline model calls, $6–12 API-equivalent (hard cap $25). At most 4 subagents.
- **Ends with:** `RESULT: NEEDS-OWNER` and a reading pack (reading checkpoint R1)

---PROMPT---
You are running Wave 1 of the v26 ChapterFlow book campaign on the owner's Mac. Work autonomously and do not ask the owner questions. You stop only by writing your status file:
- at the reading checkpoint (the normal end);
- when the quota cap below would be exceeded;
- on a usage-limit stop.

## Why this wave exists
For three months the v25 pipeline assembled each chapter from four separate "section writers": Sonnet 5 at medium effort, working from 64–80k-character cards, checked by 138 section rules, a reader panel and repair loops. It produced no book the owner would publish. The latest 19-chapter Franklin candidate (rr21):
- is 66% accurate on 182 audited claims;
- is twice as long as the best catalog books;
- carries no Franklin quotation in 20k words of summary.

The July architecture audit already asked for this test, and it was never run. Your job is to run it. One strong writer writes each **whole chapter** from the chapter's **own source text** and a **one-page brief**. A second model checks every fact, and a blind solver checks the quiz keys. Then the owner reads the result next to what the old pipeline made. The owner's reading decides what happens next. No grader score decides it.

On 2026-09-27 a planning session made one exploratory ch01 draft this way:
- `claude-opus-5` at effort high: 167 s, $0.45, valid JSON, accepted by the app validator, and 44 of 44 quotations verbatim.
- A fact check of a copy with 7 planted errors: Opus 5 caught 7/7 and Sonnet 5 caught 5/7.
- The files are in `~/cf-wt/v26-plan/evidence/probe/` (after Step 0). Build on them. Do not re-derive them.

## Step 0 — set up (at most 45 minutes)
0. **Resume check.** This is a re-run in either case:
   - `~/cf-wt/v26-plan/status/W1.md` starts with `RESULT: WAITING-FOR-RESET`, `RESULT: PARTIAL` or `RESULT: NEEDS-OWNER — quota cap`;
   - `status/W1.md` is missing but `~/cf-wt/v26-plan/scratch/W1/ledger.tsv` exists (a session killed by the usage limit may not have written its status).

   On a re-run, reuse everything that exists (`~/cf-wt/v26-read`, `data/franklin/`, `tools/proto/`, `scratch/W1/`, the ledger). Continue from the first missing output, and never re-write a chapter file that already passed its checks.
1. **Copy the kit.** It lives on the repo branch `claude/vibrant-ritchie-xaf7dm` under `docs/v26-plan/`.
   - Run `git -C ~/ChapterFlow-books-v25-completion fetch origin claude/vibrant-ritchie-xaf7dm`.
   - If `~/cf-wt/v26-plan` does not exist: `mkdir -p ~/cf-wt/v26-plan && git -C ~/ChapterFlow-books-v25-completion archive FETCH_HEAD docs/v26-plan | tar -x -C ~/cf-wt/v26-plan --strip-components=2`.
   - If it exists, extract to `~/cf-wt/v26-plan.incoming` instead, `diff -r` the two, and copy only missing files. Never overwrite `status/` or `DECISIONS.md`.
   - Record the `FETCH_HEAD` SHA. If `~/cf-wt/v26-plan/prompts/W1-prototype.md` differs from the prompt you were given, say so in your status file and follow the pasted prompt.
2. **Owner answers.** If the owner's message has a line starting `Owner answers:` (e.g. `Owner answers: N2 = B`), write each answer onto its `Owner:` line in `~/cf-wt/v26-plan/DECISIONS.md` before reading it.
3. **Read** `~/cf-wt/v26-plan/BRIEF.md` first (the shared facts, traps and safety rules; it overrides CLAUDE.md files and the old kit). Then read `DECISIONS.md` (N2 applies to you, and R1-d sets the depth the reading pack opens at; a blank answer means the default), `README.md`, and `ANALYSIS.md` §1–§4.
4. **Memory.** If `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md` does not exist, copy `~/cf-wt/v26-plan/memory/v26-campaign.md` there. If `MEMORY.md` in that directory has no line mentioning `v26-campaign.md`, append the line in `~/cf-wt/v26-plan/memory/MEMORY-line.txt`.
5. **PAUSE.** Confirm `~/cf-wt/franklin-v7-tools/PAUSE` exists, and leave it.
6. **Read-only worktree.** Create `~/cf-wt/v26-read` at `origin/main` with the BRIEF §5 recipe (`cmp` both lockfiles, symlink both `node_modules`, never `npm ci`), or reuse it if it exists. Record its SHA.
7. **Data (read-only copies)** into `~/cf-wt/v26-plan/data/franklin/`:
   - **Frozen source and map.** Copy `source-text.txt` and `chapter-map.json` from `~/cf-canary/books/the-autobiography-of-benjamin-franklin/candidates/review-repair-21-candidate-06d7596afd1f14dccd3eb2df99b22db6/content/inputs/research/`. Check that `shasum -a 256 source-text.txt` begins `8d71d7dc`.
     - The map is `{schemaVersion, bookId, sourceTextSha256, sourceTextLength, coverageFraction, spans:[{chapterNumber, chapterTitle, startOffset, endOffset, …}]}`.
     - A chapter's text is `sourceText.slice(startOffset, endOffset)` (`$PIPE/src/source/chapterMap.ts` `chapterSpanText`). Confirm the field names by opening the file.
   - **Old chapters.** The two chapters named by DECISIONS N2 (default ch01 and ch13), plus ch07 and ch19 for the checker calibration:
     - from rr21's `content/content/chapters/` directory (`ls` it first; pick the files for those chapter numbers);
     - from the Q08 arm (path in BRIEF §3; only ch01/07/13/19 are new text);
     - rr21's rendered markdown `cand-chNN.md` from `~/cf-wt/v25-execution/assessment/draft-rr21/`.
   - **Labels.** `~/cf-wt/v25-execution/probes/S02/labels.json` (15 labelled rr21 errors with source line ranges).
   - **Comparison books.** `book-packages/decisive.v21.json` from `~/cf-wt/v26-read`: the "known good" book Q08 used, which opens on scenes with the author's own cases. Also `book-packages/how-to-win-friends-and-influence-people.v21.json`, which the owner held up as the quality bar in May.
8. **Known traps (0 calls).** Build `~/cf-wt/v26-plan/data/franklin/known-traps.json`, mapping each FACT PIN and NAMED ACTOR entry in `$PIPE/config/book-scars/the-autobiography-of-benjamin-franklin.json` to its 19-chapter number.
   - Those entries are keyed to the old 4-part numbering. Place each by locating its quoted source words in the frozen spans. The expected mapping is in `docs/v25/execution/prompts/S09b-franklin-scar-rekey.md` (in `~/cf-wt/v26-read`).
   - Four fall in ch13: the sixpence paving subscription; Bond's stalled drive and the £2,000 grant; the 1749 academy; and the NAMED ACTOR Bond/Clifton credits (rr21 inverted the Clifton credit). Five fall in ch19. List any entry you cannot place.
   - **Do not edit the scar file.** These are hints for the fact checker ("facts this book has been wrong about before"), not rules for the writer.
9. **Which Opus.**
   - `ls -d ~/.vscode/extensions/anthropic.claude-code-*` and take the newest version at 2.1.280 or later. Set `B=<that dir>/resources/native-binary/claude` and run `"$B" --version`.
   - Run one tiny call with the exact harness flags: `cd ~/cf-wt/v26-plan/scratch/W1/cwd && echo 'Reply with the single word OK.' | env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000 "$B" -p --output-format json --model claude-opus-5-5 --effort low --restricted --disallowedTools '*'` (create the empty `cwd` directory first).
   - Use `$B` only if the call **with** `--restricted` returns `is_error:false` and OK. The writer is then `$B` with `claude-opus-5-5`.
   - If `$B` rejects `--restricted` or refuses the model, record the refusal and fall back to `/opt/homebrew/bin/claude` with `claude-opus-5`, keeping `--restricted`. Paste the refusal text.
   - The checker uses the same binary and model. The blind quiz solver uses the same binary with `claude-sonnet-5`.
   - Write the choice to `~/cf-wt/v26-plan/tools/proto/models.json` as `{writerBin, writerModel, checkerBin, checkerModel, solverBin, solverModel, restricted: true|false}`, because shell variables do not survive between Bash calls. Never change the global PATH.

## Step 1 — a small harness, outside the repo (at most 90 minutes)
Write it in `~/cf-wt/v26-plan/tools/proto/`, in Python 3. Start from `~/cf-wt/v26-plan/evidence/probe/probe_tools.py`, which has the reader-text layout and the quotation matcher. Keep the harness small; Wave 2 turns it into real code.

- **`span N`** prints two things:
  - the exact source text of chapter N, with its title from the map;
  - the writer's form of that span. This drops `[n]` footnote markers and moves indented footnote bodies and `[Illustration…]` lines into a trailing block labelled `EDITOR'S NOTES (not Franklin; do not quote as Franklin)`.

  The writer and checker always get the writer's form.
- **`call`** runs one model call.
  - It reads bin, model and restricted from `models.json` and takes the step's effort as an argument. It also takes `--ledger <path>` (default `scratch/W1/ledger.tsv`), `--cwd <dir>` (default `scratch/W1/cwd`) and `--cap <usd>` (default 25), and the budget check sums only that ledger.
  - It runs `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000 <bin> -p --output-format json --model <model> --effort <effort> [--restricted] --disallowedTools '*'` as a subprocess, with the prompt on stdin.
  - The subprocess runs with `cwd` set to the empty `~/cf-wt/v26-plan/scratch/W1/cwd/`, under `caffeinate -i`, with a harness-enforced timeout (`subprocess.run(..., timeout=1200)`). Run each `call` with the Bash tool timeout at 600000 ms, or in the background with a log.
  - It saves the envelope, extracts `.result` (stripping a surrounding code fence), and appends a line to `~/cf-wt/v26-plan/scratch/W1/ledger.tsv`: step, chapter, model, `total_cost_usd`, output tokens, `stop_reason`, seconds.
  - If `is_error` is true and the message or `api_error_status` shows a usage or rate limit, stop the wave and write `RESULT: WAITING-FOR-RESET`.
  - If `stop_reason` is `max_tokens`, retry once at one effort level lower and log it.
  - **Budget:** before every call, add up the ledger. If the total plus $2.00 (a writer or fix call) or $1.00 (any other call) would pass **$25**, stop and write `RESULT: NEEDS-OWNER — quota cap`.
- **`checks`** (0 model calls). Blocking failures go to the fix step; advisory ones are only reported.
  - (a) **Blocking:** the JSON parses and has the chapter fields listed in Step 2, with the right types.
  - (b) **Blocking:** the app validator accepts a 1-chapter package.
    - Copy `~/cf-wt/v26-plan/evidence/probe/validate.mts.txt` to `tools/proto/validate.mts`, point its import at `~/cf-wt/v26-read/app/app/api/book/_lib/validate-book-package.ts`, and run it with `~/cf-wt/v26-read/node_modules/.bin/tsx`.
    - Build the package from rev-6 (`$PIPE/book-packages/the-autobiography-of-benjamin-franklin.v21.json` in the worktree). Keep its root fields `schemaVersion`, `packageId`, `createdAt`, `contentOwner` and `book`, and replace `chapters` with this one chapter, adding `chapterId` `ch-NN`, `number` NN and `readingTimeMinutes` = round(fullRead words / 230).
    - Any output other than `APP_VALIDATOR_OK` is a failure.
  - (c) **Blocking: quotations are Franklin's real words.** The check covers every span in straight or curly double quotes ("…" or “…”) of 8 or more characters in:
    - the three tiers, `hook`, `counterintuition`, `keyTakeaway` and `tryThisNow`;
    - quiz explanations, review-card backs and `memorableLines` (the fields `probe_tools.py` `quote_spans` covers);
    - in format B, the Franklin episodes in the examples.

    Each such span must appear verbatim in the Franklin part of the span. The match normalizes both sides as `norm()` does.
    - Quoted speech inside modern examples is invented by design, so report it but do not block on it.
    - Print the number of quotations found. A fullRead with 0 quotations is a failure, not a pass.
  - (d) **Blocking:** `correctIndex` is in range. No summary tier over 180 words is a single paragraph. No model or meta chatter appears (e.g. "as an AI", "here is the JSON", "the author writes").
  - (e) **Advisory:** lengths against the brief's bands; paragraphs over 140 words; the key-is-the-uniquely-longest-choice count; repeated stem openers.
- **`render`** turns a v21 chapter JSON into HTML in the app's order (see Step 5).

## Step 2 — the brief (at most 60 minutes)
- Start from `evidence/probe/brief-ch01.md` and make it one book brief for Franklin, at most about 4,000 characters, plus a short per-chapter header: chapter number and title from the map, and the previous and next chapter titles for continuity.
- Write positive guidance: who the reader is, the voice, what each field is for, and the target lengths and counts. **Do not** add lists of banned phrases, rhythm quotas, or rules that answer old tics. The old pipeline's tics came from such rules, and the probe draft shows none of them.
- Read the probe draft `evidence/probe/ch01.opus5.chapter.json` critically first. Its fullRead ran to 1,432 words (asked 900–1,300) with a 204-word paragraph. Its quiz key was the longest choice in 5 of 6 questions. Tighten the brief where the draft missed it.
- **What a new reader sees in the app:** the hook, counterintuition, fastRead, memorable lines and tryThisNow on the first screen, then the first example (the rest sit behind "Show more"), then quiz questions **1–5**, then the practice screen (`~/cf-wt/v26-plan/scan/app-render.md` §3).
- **Chapter shape.** This is format A; the format-B sample in Step 3 changes only the examples. Fields:
  - `title`, `hook` (a scene, 1–2 sentences), `counterintuition`, `keyTakeaway`, `tryThisNow`.
  - `breakdown.fastRead`: 150–220 words. A mini-story of the chapter's best scene with 1–2 of Franklin's own lines. For most readers this is the whole chapter.
  - `breakdown.deepRead`: 350–500 words in 3–5 paragraphs.
  - `breakdown.fullRead`: 900–1,200 words in 7–10 paragraphs of 60–140 words. The full telling, in Franklin's order, with his words.
  - Paragraphs are separated by `\n\n`.
  - 3 `examples` (`exampleId`, `title`, `tags` from "work"/"school"/"personal", `scenario`, `whatToDo`, `whyItMatters`). Each is a short modern situation where the chapter's idea helps. The first is the only one shown by default, so it must be the best. No character who has "read about" Franklin, and no retelling of his anecdote inside a modern example.
  - `quiz`: `passingScorePercent` 70 and **7 questions of 3 choices** (the catalog's house style). Each has `questionId`, `prompt`, `choices`, `correctIndex`, `explanation`, `bloomsLevel`.
    - q1–q5 are answerable from what a new reader saw (the list above) and test the story and its idea.
    - q6–q7 may draw on the deeper tiers or apply the idea.
    - Stems stay under 25 words, and each stem and its choices are about one situation.
    - Choices are similar in length; the key is not the longest. Spread the keys across positions.
  - 5 `reviewCards` (`cardId`, `front`, `back`, `difficulty`): plain question and answer on a Franklin line or idea.
  - `implementationPlan` (`coreSkill`, 2 `ifThenPlans` {`context`, `plan`}, `twentyFourHourChallenge`, `weeklyPractice`).
  - 3 `memorableLines` [{`text`}], quoted verbatim from Franklin.

## Step 3 — calibrate the checker, then write, check, fix (model calls)
**First, calibrate the fact checker on real errors (about $1).**
- **Setup.**
  - Render rr21's ch07 and ch19 as labelled reader text (`probe_tools.py reader`).
  - Deduplicate `labels.json` and the ch07/ch19 error lists in `docs/v25/execution/assessment/reports/source-accuracy.md` §4 (in the worktree) into one list of major errors per chapter.
- **Run.** Run the checker with `evidence/probe/factcheck-brief-v2.md`, which hunts five error kinds: WHO, WHY, WHEN/ORDER, HOW MUCH and WORDS. Give it:
  - the chapter's writer-form span;
  - the chapter's `known-traps.json` entries, appended as "facts this book has been wrong about before".
- **Score.** Report recall on the major errors (with and without the known-traps hints) and the number of false flags, with quotes.
- **Fallback.** If recall is below about 80%, run once more with `evidence/probe/factcheck-brief.md`, the prompt that caught 7/7 in the probe. Use the better prompt for everything below, and name it in the status.

**Then, for each chapter named by N2:**
1. **Write:** writer model, effort `high`. Stdin: brief + chapter header + `<source>` writer-form span `</source>`.
2. **Checks** (0 calls).
3. **Fact check:** checker model, effort `high`, with the calibrated prompt and this chapter's known-traps entries. Input: the writer-form span plus the chapter as labelled reader text.
4. **Blind quiz solve:** solver model, effort `medium`.
   - For q1–q5 it sees only what a new reader saw (the Step 2 list). For q6–q7 it sees all three tiers.
   - It gets the questions and choices with no keys and no explanations, and returns the chosen index and a one-line reason per question.
   - A disagreement on q1–q5 is a blocking issue. On q6–q7, read the question yourself: fix it if the key is really wrong or ambiguous, otherwise record it as a solver miss.
   - Report the disagreement rate for q1–q5 and q6–q7 separately.
5. **Fix,** only if anything blocking was found.
   - Call the writer model at effort `high` with the chapter JSON, the issue list and the span. It returns: `{"edits":[{"field":"<field id as in the reader text, e.g. breakdown.fullRead, quiz.q3.explanation, examples.ex01.scenario>","find":"<exact text>","replace":"<new text>"}],"keyChanges":[{"questionId":"q3","newIndex":1,"keyedChoiceText":"<full text of choices[1]>"}]}`.
   - Apply edits as exact string replacements. Apply a key change only when `keyedChoiceText` equals `choices[newIndex]`. A fix never moves text between quiz choices. If a `find` is missing, ask once more with the error.
   - Then re-run steps 2–4 in full. At most 2 fix rounds. Whatever is still open goes into the reading pack as an **open issue**, in plain words.

**Then, once each:**
- **Checker recall on planted errors.** On a copy of your second chapter, plant 7 errors: one each of WHO, WHY, WHEN/ORDER and WORDS, two of HOW MUCH, and one wrong quiz key. Run the fact check once and report caught/7, quoting the misses. Never let the planted copy near the reading pack.
- **Labelled errors.** For each `labels.json` entry that falls in your two chapters, say whether the prototype restates it. Quote the chapter, or state the absence.
- **Format B sample (for DECISIONS R1-b).**
  - Write ch01 once more, with the examples section of the brief changed to: "Example 1 is Franklin's strongest episode from this chapter, told from the source, with what to do today. Example 2 is a second Franklin episode told the same way. Example 3 is one short modern situation." For this run, drop the "no retelling of his anecdote" line.
  - Run the checks, the fact check and the blind solve on it, and fix per step 5 if needed.

Expect about 14–20 calls and $6–12 in total.

## Step 4 — read it yourself
Read both prototype chapters (and the format-B ch01) in full next to rr21 and the Q08 arm. Write a plain, honest comparison with quotes: what is better, what is worse, and what the owner should look at. No scores, and no AI reader panel. The owner reads.

## Step 5 — the reading pack (the deliverable)
Build `~/cf-wt/v26-plan/reading/W1/index.html` plus one page per chapter. It must be self-contained (inline CSS, `<meta charset="utf-8">`), open locally in a browser, and fit a phone.
- **Per chapter,** three versions labelled **X / Y / Z**: the prototype, rr21 and the Q08 arm, in a fixed shuffled order. The key is in a collapsed "Reveal which is which" block at the bottom.
- **Each version renders in the app's order and form:**
  - the chapter header (title, reading time);
  - the hook and counterintuition;
  - the Summary step, opened at the depth R1-d in `DECISIONS.md` gives a new user (`fullRead` for B, `deepRead` for C, `fastRead` for A or blank), with buttons to switch to the other two;
  - the memorable lines and tryThisNow;
  - Examples (first one open, the rest behind "Show more");
  - Quiz (choices shown; the answer revealed on click, with its explanation);
  - review cards, and Practice (`implementationPlan`).

  Confirm this against the real reader:
  - `'app/book/library/[bookId]/chapter/[chapterId]/components/ReaderPhaseContent.tsx'`;
  - `'app/book/library/[bookId]/chapter/[chapterId]/lib/reader-flow-core.ts'` (phase order `summary → examples → quiz → practice`);
  - `~/cf-wt/v26-plan/scan/app-render.md` §3.

  Single-quote these paths in zsh, or use the Read tool. Split paragraphs exactly as the server adapter `app/app/api/book/_lib/v21-adapter.ts` does (blank lines only).
- **A "what the app's books feel like today" page:** chapter 1 of `decisive` (and of How to Win Friends) in the same form, marked as a different book.
- **The ch01 format-B sample,** under its own heading: "ch01, examples in format B (Franklin's stories)".
- **An "After you have read (reveals the versions)" section** at the bottom of the index, linking a "What was checked" page. Per prototype chapter, that page has:
  - the checker's flags;
  - what each fix changed (before → after);
  - open issues;
  - the blind-solver disagreements;
  - the calibration and planted-error results;
  - the labelled-error result;
  - the ledger totals;
  - your comparison.
- **`~/cf-wt/v26-plan/reading/W1/NOTES.md`,** with a "General" heading and one heading per chapter. Link it from the index.
- **A "How to read this" box at the top of the index:** about 60–90 minutes. Read each chapter at the depth it opens at (what a new user will see), then glance at the short summary (`fastRead`). Then answer R1-a and R1-b in `DECISIONS.md`, and R1-d too if its `Owner:` line is blank. If R1-d already has an answer (B was given on 2026-09-28), say so in the box: it can still be changed there before W2. Copy the questions still open onto the index verbatim.
- **No in-app preview in this wave.** The chapter route loads the book from the published manifest in DynamoDB and S3, and calls `notFound()` without it (`app/book/library/[bookId]/chapter/[chapterId]/page.tsx:12-60`).

## Boundaries
- No repo PRs in this wave. No changes to the v25 pipeline. Do not run the v25 driver. `PAUSE` stays.
- `~/cf-canary`, `~/cf-canary-att` and `~/cf-wt/v25-execution` are read-only.
- Do not invoke `superpowers:brainstorming`, `superpowers:writing-plans` or `superpowers:executing-plans`.
- Do not claim anything you did not verify. Paste envelope fields and validator output as evidence.

## Definition of done
- **Final files.**
  - Prompts in `~/cf-wt/v26-plan/tools/proto/prompts/{brief-franklin,write,factcheck,keysolve,fix}.md`.
  - Chapters in `~/cf-wt/v26-plan/scratch/W1/final/chNN.chapter.json` and `ch01-formatB.chapter.json`.
  - Each chapter passes the blocking checks or has its open issues listed, and is fact-checked and blind-solved with a fix history.
- **The reading pack exists and opens.** Open `index.html` with `open`, and `ls` every link target.
- **`status/W1.md` is written.** Its first line is `RESULT: NEEDS-OWNER — W1 prototype ready: read ~/cf-wt/v26-plan/reading/W1/index.html (R1)`. It then contains:
  - the kit `FETCH_HEAD` SHA and the `v26-read` SHA;
  - the decisions used (N2, and whether it was a default);
  - the Opus check result (verbatim envelope fields) and `models.json`;
  - the harness and final-file paths;
  - the ledger totals (calls and $);
  - per chapter: flags found, fixed and open;
  - the calibration result (real rr21 errors) and the planted-error result;
  - the blind-solver disagreement rates for q1–q5 and q6–q7, and whether any q6–q7 disagreement was a real key error;
  - the labelled-error result;
  - your comparison (10–20 lines);
  - anything Wave 2 must know (brief changes, harness defects, validator surprises).
- **Memory.** One line appended to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`.
- Then stop. The owner reads.
---END---
