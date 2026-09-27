# W1 — Side-by-side prototype: two whole Franklin chapters, then the owner reads

- **Model:** Opus 5.5 (Claude Code session)
- **Start directory:** `~/cf-wt` (a fresh Claude Code session)
- **Depends on:** nothing. It starts per DECISIONS N1: after the weekly reset (Tue 2026-09-29 23:00Z) by default.
- **Estimate:** 5–8 hours wall time. Pipeline model calls about $5–10 API-equivalent (hard cap $25). At most 12 subagents.
- **Ends with:** `RESULT: NEEDS-OWNER` and a reading pack (reading checkpoint R1)

---PROMPT---
You are running Wave 1 of the v26 ChapterFlow book campaign on the owner's Mac. Work autonomously and do not ask the owner questions. You stop only by writing your status file: at the reading checkpoint (the normal end), when the quota cap below would be exceeded, or on a usage-limit stop.

## Why this wave exists
For three months the v25 pipeline assembled each chapter from four separate "section writers" (Sonnet 5 at medium effort, 150–190k-character rulebooks, 137 section checks, a reader panel, repair loops), and it produced no book the owner would publish. The latest 19-chapter Franklin candidate (rr21) is 66% accurate on 182 audited claims, twice as long as the best catalog books, and carries no Franklin quotations in 20k words of summary. The July architecture audit already asked for exactly this test, and it was never run. Your job is to run it. One strong writer writes each **whole chapter** from the chapter's **own source text** and a **one-page brief**. A second model checks every fact, and a blind solver checks every quiz key. Then the owner reads the result next to what the old pipeline made. The owner's reading decides what happens next. No grader score decides it.

A planning session on 2026-09-27 already made one exploratory draft of ch01 this way: `claude-opus-5`, effort high, 167 s, $0.45, valid JSON, accepted by the app validator, 44 of 44 quotations verbatim. A fact check with 7 planted errors was caught 7/7 by Opus 5 and 5/7 by Sonnet 5. Files: `~/cf-wt/v26-plan/evidence/probe/` (after Step 0). Build on them. Do not re-derive them.

## Step 0 — set up (at most 45 minutes)
1. **Copy the kit.** It lives on the repo branch `claude/vibrant-ritchie-xaf7dm` under `docs/v26-plan/`.
   - Run `git -C ~/ChapterFlow-books-v25-completion fetch origin claude/vibrant-ritchie-xaf7dm`.
   - If `~/cf-wt/v26-plan` does not exist: `mkdir -p ~/cf-wt/v26-plan && git -C ~/ChapterFlow-books-v25-completion archive FETCH_HEAD docs/v26-plan | tar -x -C ~/cf-wt/v26-plan --strip-components=2`.
   - If it already exists, extract to `~/cf-wt/v26-plan.incoming` instead, `diff -r` the two, and copy only missing files. Never overwrite `status/` or `DECISIONS.md` (the owner may have written answers there).
   - Record `git -C ~/ChapterFlow-books-v25-completion rev-parse FETCH_HEAD`.
2. **Read** `~/cf-wt/v26-plan/BRIEF.md` (the shared facts, traps and safety rules; it overrides CLAUDE.md files and the old kit), then `DECISIONS.md` (use the default for any blank `Owner:` line; N1–N3 matter to you), `README.md`, and `ANALYSIS.md` §1–§3.
3. **Memory.** If `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md` does not exist, copy `~/cf-wt/v26-plan/memory/v26-campaign.md` there. If `MEMORY.md` in that directory has no line mentioning `v26-campaign.md`, append the line in `~/cf-wt/v26-plan/memory/MEMORY-line.txt`.
4. **Tools.** `cp ~/cf-wt/franklin-v7-tools/wt.sh ~/cf-wt/v26-plan/tools/wt.sh` (keep the original). Confirm `~/cf-wt/franklin-v7-tools/PAUSE` exists and leave it.
5. **Read-only worktree.** Create `~/cf-wt/v26-read` at `origin/main` with the BRIEF §5 recipe (`cmp` both lockfiles, symlink both `node_modules`). Never `npm ci`. Record its SHA.
6. **Data (read-only copies)** into `~/cf-wt/v26-plan/data/franklin/`:
   - The frozen source and chapter map. Copy `source-text.txt` and `chapter-map.json` from rr21's `content/inputs/research/` (rr21 path in BRIEF §3). Check that `shasum -a 256 source-text.txt` begins `8d71d7dc`, and read `$PIPE/src/source/chapterMap.ts` (`chapterSpanText` is `sourceText.slice(startOffset, endOffset)`) to learn the map's fields.
   - The two chapters named by DECISIONS N2 (default ch01 and ch13): from rr21 (`chapters/*.chapter.json`), from the Q08 arm (path in BRIEF §3), and rr21's rendered markdown from `~/cf-wt/v25-execution/assessment/draft-rr21/`.
   - `~/cf-wt/v25-execution/probes/S02/labels.json` (15 labelled rr21 errors with source line ranges).
   - The comparison published book: `book-packages/decisive.v21.json` from the worktree. It is the "known good" book Q08 used, it ranks high on both catalog graders, and it opens on scenes with the author's own cases. Also copy `book-packages/how-to-win-friends-and-influence-people.v21.json` if it exists (`ls` it first): the owner held it up as the quality bar in May. Neither carries its author's voice the way Franklin should (`scan/existence-proof.md` §3).
7. **Known traps (0 calls).** Build `~/cf-wt/v26-plan/data/franklin/known-traps.json`, which maps each FACT PIN and NAMED ACTOR entry in the scar file (`$PIPE/config/book-scars/the-autobiography-of-benjamin-franklin.json`, keyed to the old 4-part numbering) to its 19-chapter number.
   - Locate each pin's quoted source words in the frozen spans. The expected mapping is in `docs/v25/execution/prompts/S09b-franklin-scar-rekey.md` in the worktree.
   - List any pin you cannot place.
   - **Do not edit the scar file.** These are hints for the fact checker ("facts this book has been wrong about before"), not rules for the writer. Five of them fall in ch13, including the Clifton lamp credit that rr21 inverted.
8. **Which Opus.**
   - `ls -d ~/.vscode/extensions/anthropic.claude-code-2.1.2*` and pick the newest one at 2.1.280 or later. Set `B=<that dir>/resources/native-binary/claude` and run `"$B" --version`.
   - Then one tiny call: `echo 'Reply with the single word OK.' | env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY "$B" -p --output-format json --model claude-opus-5-5 --effort low --disallowedTools '*'`.
   - If the envelope has `is_error:false` and the result says OK: set `WRITER_BIN="$B"` and `WRITER_MODEL=claude-opus-5-5`. Otherwise set `WRITER_BIN=claude` and `WRITER_MODEL=claude-opus-5`, and paste the refusal text.
   - The checker uses the same bin and model. The blind quiz solver uses `claude-sonnet-5` at effort medium.
   - Never change the global PATH, and never point the v25 driver at the new binary.

## Step 1 — a small harness, outside the repo (at most 90 minutes)
Write it in `~/cf-wt/v26-plan/tools/proto/`. Python 3 or `npx tsx` from the worktree are both fine. Keep it small; Wave 2 turns it into real code.
- `span`: given a chapter number, print its exact source text from `data/franklin/source-text.txt` plus `chapter-map.json`, and the chapter's title as the map gives it.
- `call`: run one model call with exactly these flags, prompt on stdin:
  `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000 "$BIN" -p --output-format json --model "$MODEL" --effort "$EFFORT" --restricted --disallowedTools '*'`. Keep `--restricted`, which isolates the call from the operator's `~/.claude` plugins. If a binary rejects the flag, record the error, drop only that flag for that binary, and say so.
  - Save the envelope and extract `.result`, stripping a surrounding code fence.
  - Append a line (step, chapter, model, `total_cost_usd`, output tokens, `stop_reason`, seconds) to `~/cf-wt/v26-plan/scratch/W1/ledger.tsv`.
  - If `is_error` is true and the message mentions a usage or rate limit (e.g. "limit", "429"), stop the wave and write `RESULT: WAITING-FOR-RESET`.
  - Before every call, sum the ledger. If the next call could take the total past **$25**, stop and write `RESULT: NEEDS-OWNER — quota cap`.
- `checks` (0 model calls). **Blocking** failures go to the fix step; **advisory** ones are reported.
  - (a) Blocking: the JSON parses and has the v21 chapter fields listed below, with the right types.
  - (b) Blocking: the app validator accepts a 1-chapter package. Copy `~/cf-wt/v26-plan/evidence/probe/validate.mts`, point its import at `~/cf-wt/v26-read/app/app/api/book/_lib/validate-book-package.ts`, and run it with `npx tsx` from the worktree. Build the package's `book` block from rev-6's `book` block.
  - (c) Blocking: every double-quoted span of 8 or more characters in reader text appears verbatim in the chapter's source span after normalization. Normalization drops `[n]` footnote markers and `_`, straightens curly quotes, turns dashes into spaces, lowercases, drops punctuation and collapses whitespace. The probe's inline Python in `evidence/probe/` is the model.
  - (d) Blocking: `correctIndex` is in range.
  - (e) Advisory: paragraphs are separated by blank lines, and none is over 180 words.
  - (f) Advisory: lengths against the brief's bands; meta chatter such as "this chapter", "the source", "the text", "the author writes".
- `render`: turns a v21 chapter JSON into HTML in the app's order (see "Reading pack").

## Step 2 — the brief (at most 60 minutes)
- If the skill `engineering-skills:senior-prompt-engineer` is in your skill list, load it. Otherwise skip it.
- Start from `evidence/probe/brief-ch01.md` and make it one book brief for Franklin, at most about 4,000 characters, plus a short per-chapter header (chapter number and title from the map, the previous and next chapter titles for continuity).
- Write positive guidance: who the reader is, the voice, what each field is for, and the target lengths and counts. **Do not** add lists of banned phrases, rhythm quotas, or rules that answer old tics. The old pipeline's tics came from such rules. The probe draft shows none of them.
- Read the probe draft `evidence/probe/ch01.opus5.chapter.json` critically first. Its fullRead ran to 1,432 words (asked 900–1,300), and its paragraphs reached 204 words. Tighten the brief where the draft missed it.
- **Chapter shape (DECISIONS R1-b default A).** It follows what the app actually shows (`~/cf-wt/v26-plan/scan/app-render.md`). A new user sees the hook, the **fastRead only**, 1 example (the rest sit behind "Show more"), quiz questions **1–5**, and then the practice screen. So:
  - `title`, `hook` (a scene, 1–2 sentences), `counterintuition`, `keyTakeaway`, `tryThisNow`.
  - `breakdown.fastRead`, 150–220 words: a mini-story of the chapter's best scene with 1–2 of Franklin's own lines. For most readers this is the whole chapter.
  - `breakdown.deepRead`, 350–500 words, in 3–5 paragraphs.
  - `breakdown.fullRead`, 900–1,200 words, in 7–10 paragraphs of 60–140 words. This is the full telling, in Franklin's order, with his words.
  - Paragraphs are separated by `\n\n`.
  - 3 `examples` (`exampleId`, `title`, `tags` from "work"/"school"/"personal", `scenario`, `whatToDo`, `whyItMatters`). The first one is the only one shown by default, so it must be the best. No character who has "read about" Franklin, and no retelling of his anecdote inside an example.
  - `quiz` with `passingScorePercent` 70 and **7 questions of 3 choices** (the catalog's house style), each with `questionId`, `prompt`, `choices`, `correctIndex`, `explanation`, `bloomsLevel`.
    - q1–q5 are answerable from what a default reader saw (hook, fastRead, first example) and test the story and its idea.
    - q6–q7 may draw on the deeper tiers or apply the idea.
    - Stems stay under 25 words, and each stem and its choices are about one situation.
    - Choices are similar in length; the key is not the longest.
    - Spread the keys across positions.
  - 5 `reviewCards` (`cardId`, `front`, `back`, `difficulty`): plain question and answer on a Franklin line or idea.
  - `implementationPlan` (`coreSkill`, 2 `ifThenPlans` {`context`, `plan`}, `twentyFourHourChallenge`, `weeklyPractice`).
  - 3 `memorableLines` [{`text`}], each quoted verbatim from Franklin.
  - Your assembler adds `chapterId`, `number` and `readingTimeMinutes`. Keep the probe's field names; the validator accepted them.

## Step 3 — write, check, fix (model calls)
For each chapter (DECISIONS N2):
1. **Write:** writer model, effort `high`. Stdin: brief + chapter header + `<source>` span `</source>`.
2. **Checks** (0 calls).
3. **Fact check:** checker model, effort `high`, with this chapter's entries from `known-traps.json` appended as "facts this book has been wrong about before; check them especially", prompt = `evidence/probe/factcheck-brief.md` generalized to any chapter (keep its five error kinds from `factcheck-brief-v2.md`: WHO, WHY, WHEN/ORDER, HOW MUCH, WORDS). Input: source span plus the chapter rendered as labelled reader text (the probe's `planted-reader` layout).
4. **Blind quiz solve:** `claude-sonnet-5`, effort `medium`. For q1–q5 it sees only what a default reader saw (hook, counterintuition, fastRead, the first example). For q6–q7 it sees all three tiers. It gets the questions with choices (no keys, no explanations) and returns the chosen index and a one-line reason per question. A disagreement with the key is a blocking issue: either the key or the question is wrong or ambiguous.
5. **Fix,** only if anything blocking was found: writer model, effort `high`. Input: the chapter JSON, the issue list and the source span. Output: `{"edits":[{"field":"breakdown.fullRead","find":"<exact text>","replace":"<new text>"}]}`. Apply the edits as exact string replacements. A fix never moves text between quiz choices. A key change must restate the keyed choice's full text, and it is applied only when that text equals `choices[correctIndex]`. If a `find` is missing, ask once more with the error. Then re-run steps 2–4 in full. At most 2 fix rounds. Whatever is still open goes into the reading pack as an **open issue**, in plain words.

Then, once each:
- **Checker recall test on your ch13** (or your second chapter). Copy the checked chapter, plant 7 errors in it (one per kind: WHO, WHY, WHEN/ORDER, HOW MUCH ×2, WORDS, plus one wrong quiz key), run the fact check once, and report caught/7 with the misses quoted. Never let the planted copy near the reading pack.
- **Checker calibration on real errors (about $1):** run the same fact check on rr21's **ch07 and ch19** (from the rr21 path, rendered with the probe's reader layout) against their source spans. Score its flags against the known errors for those chapters: the `labels.json` entries and the ch07/ch19 lists in `docs/v25/execution/assessment/reports/source-accuracy.md` §4 (in the worktree). Report recall on real errors and the number of false flags, with quotes. If recall on real major errors is below about 80%, try once with the five-kind prompt `evidence/probe/factcheck-brief-v2.md`, report both, and recommend one for Wave 2.
- **Labelled errors:** for each `labels.json` entry that falls in your two chapters, say whether the prototype restates it. Quote the chapter or the absence.
- **Format B sample for DECISIONS R1-b:** write ch01 once more with the brief's examples section changed to "1 short modern example plus 2 of Franklin's own episodes from this chapter, each told from the source with what to do today". Run checks and the fact check on it, and fix per step 5 if needed. It appears in the reading pack only as "ch01, examples in format B".

Expect about 14–20 calls and $6–12 in total.

## Step 4 — read it yourself, then an advisory panel
- Read both prototype chapters in full next to rr21 and the Q08 arm. Write a plain, honest comparison with quotes: what is better, what is worse, and what the owner should look at. No scores.
- Then run one small Workflow (you are authorized): 3 blind reader agents per chapter, 6 agents in total.
  - Each gets the three versions of one chapter, rendered as reader text, labelled X/Y/Z in a different random order per reader (pass the order in the prompt; `Math.random` is unavailable in workflows).
  - Each ranks them for "would I keep reading this app" and "did I learn something I will remember", with 3 quoted reasons, and names any factual doubt.
  - Report the rankings as advisory only. They do not decide anything.

## Step 5 — the reading pack (the deliverable)
Build `~/cf-wt/v26-plan/reading/W1/index.html` plus one page per chapter. It must be self-contained (inline CSS), open locally in a browser, and fit a phone.
- **Per chapter,** three versions labelled **X / Y / Z**: the prototype, rr21 and the Q08 arm, in a fixed shuffled order. The key sits in a collapsed "Reveal which is which" block at the bottom.
- **Each version renders in the app's order and form:**
  - chapter header (title, reading time), hook;
  - the Summary step, showing the depth a new user sees by default (`fastRead`, because `defaultToFastPath` → "simple"; see `app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:144` and `hooks/useReaderSettings.ts:31`), with buttons to switch to `deepRead` and `fullRead`;
  - memorable lines, then Examples, Quiz (choices shown and the answer revealed on click with its explanation), review cards, and Practice (`tryThisNow`, `implementationPlan`).
  - Confirm this order by reading `ReaderPhaseContent.tsx` (phase order is `summary → examples → quiz → practice` in `lib/reader-flow-core.ts`) and `~/cf-wt/v26-plan/scan/app-render.md` §3 (a screen-by-screen walkthrough of the real reader), and follow the app where they differ.
  - Split paragraphs exactly as the server adapter `app/app/api/book/_lib/v21-adapter.ts` does (blank lines only), so a wall of text shows as the owner's readers would see it.
- **A "what the app's books feel like today" page:** chapter 1 of `decisive` in the same form, marked as a different book. Add chapter 1 of How to Win Friends if you copied it.
- **A "What was checked" page:** per prototype chapter, the checker's flags, what the fix changed (before → after), open issues, the blind-solver disagreements, the checker recall result (caught/7), the labelled-error result, the ledger totals, and your own comparison.
- **A "How to read this" box on the index:** about 45–60 minutes. Read each chapter at the default depth first, the way a new user would, then open the full telling. Then answer DECISIONS R1-a to R1-d; copy those four questions onto the index verbatim.
- **No in-app preview in this wave.** The chapter route loads the book from the published manifest in DynamoDB and S3 (`app/book/library/[bookId]/chapter/[chapterId]/page.tsx:12-35`) and calls `notFound()` without it, even under `npm run dev`. Registering a book on any AWS stack is an owner step, so the HTML pack is the deliverable. In the status file, add the optional owner commands for a **dev-stack** preview (from `~/cf-wt/v26-plan/scan/publish-path.md` §5 step 5, with the 2-chapter package path filled in) and label them "optional, owner only, dev stack only".

## Boundaries
- No repo PRs in this wave. No changes to the v25 pipeline. Do not run the v25 driver. `PAUSE` stays.
- `~/cf-canary`, `~/cf-canary-att` and `~/cf-wt/v25-execution` are read-only.
- Do not invoke `superpowers:brainstorming`, `superpowers:writing-plans` or `superpowers:executing-plans`.
- Do not claim anything you did not verify. Paste envelope fields and validator output as evidence.

## Definition of done
- Two prototype chapters (plus the ch01 format-B sample) exist in `~/cf-wt/v26-plan/scratch/W1/`. For each:
  - it passes the blocking checks, or its open issues are listed;
  - it is fact-checked and blind-key-checked;
  - it has a fix history.
- The reading pack exists and opens. Test it by opening `index.html` with `open` and checking every link resolves (`ls` the targets).
- `status/W1.md` is written. Its first line is `RESULT: NEEDS-OWNER — W1 prototype ready: read ~/cf-wt/v26-plan/reading/W1/index.html (R1)`. It then contains:
  - the Opus 5.5 check result (verbatim envelope fields);
  - the harness paths;
  - the ledger totals (calls and $);
  - per chapter: flags found, fixed, and open;
  - the recall result (planted) and the calibration result (real rr21 errors);
  - the labelled-error result;
  - your comparison (10–20 lines);
  - the advisory panel rankings;
  - the optional dev-stack preview commands for the owner;
  - anything Wave 2 must know (brief changes, harness defects, validator surprises).
- One line appended to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`.
- Then stop. The owner reads.
---END---
