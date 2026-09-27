# Scan: what produced the good books, and can a Claude model write a whole chapter?

Lens: find out which catalog books scored best, how each one was actually produced, and whether any whole chapter written by Claude exists in the repo. Read-only. No model calls.
Scratch scripts: `/tmp/claude-0/-home-user-ChapterFlow/48916df7-45f9-50d8-ad9d-e43b21e61800/scratchpad/scan/existence-proof/` (`metrics.py` computes the reader-shape table; `lineage.py` compares early package versions with the current ones).
Git history in this container is shallow (50 commits, starting at 7cf24e9 on 2026-09-02). I read the May to July history through the GitHub API (list_commits, get_commit, get_file_contents at old SHAs). Every SHA below can be opened at `github.com/WillSoltani/ChapterFlow/commit/<sha>`.

## keyFacts

- VERIFIED: **In July, no book met the full bar. "5 of 140" is only the count at composite ≥85.** The audit says "High-quality (meets full bar) | **0**" (`docs/v24/CATALOG_QUALITY_AUDIT.md:13`). Every one of the five books at ≥85 (difficult-conversations 85.6, getting-things-done 85.1, atomic-habits 85.1, meditations 85.0, good-to-great 85.0) has churn HIGH, and churn HIGH fails the bar.
- VERIFIED: **Which grader a book got explains the ≥85 set better than how the book was made.**
  - Books with titles A–N were scored by an Opus 3-reader panel; titles O–Z by a Sonnet 2-reader panel (`CATALOG_QUALITY_AUDIT.md:46`).
  - All 15 books at ≥83 were Opus-graded. None of the 83 Sonnet-graded books scored above 82.2.
  - From the June 30 baseline to July, Opus-graded books moved +2.3 points on average (n=51) and Sonnet-graded books moved −1.4 (n=79). That is a gap of about 3.7 points, and the 85 line sits inside it.
- VERIFIED: **The two catalog graders disagree about which books are good.** The Spearman rank correlation between the July book-score composite and the 140-book evaluation score is **0.18** (140 books). Only one book, difficult-conversations, is in both top-10 lists.
- VERIFIED and INFERRED: **Two of the three top-scored July books are mostly Claude-written. They were assembled field by field, not written as whole chapters.**
  - atomic-habits (85.1): 96% of its current summary 5-grams and all 183 quiz stems already exist in the version created 2026-05-12T01:07.
  - getting-things-done (85.1): 83% of its summary 5-grams date from 2026-05-12T01:16.
  - how-to-win-friends (#8, 84.1): 96% dates from 2026-05-09.
  - All three carry the artifacts of the `claude -p` v21 pipeline: `state/briefs/<id>.brief.json` and one `state/plans/<id>-chNN.plan.json` per chapter, written by `src/generateChapter.ts:206,214`.
  - That pipeline's writer tier defaulted to **claude-opus-4-7** (`src/providers/cli.ts` at fe590c9: `writer: "claude-opus-4-7"`).
  - In May the owner treated HWF as the quality reference: "The goal is HWF-level authored quality" (`PIPE/archive/MIGRATION-CODEX-PROMPT.md:11`).
- INFERRED: **The other top books came from the May Codex migration path.** This covers difficult-conversations (#1), meditations, games-people-play and how-to-talk-to-anyone.
  - In that path one short Codex session wrote one whole `ChapterV21` JSON, working from the old v13 package and source notes.
  - Evidence: each of these books has a `manual-generation-ledger.json` plus a `chapter-core-map.json`. Those are Codex-setup artifacts (`MIGRATION-CODEX-PROMPT.md:41-64`), and each ledger was last updated 1 to 3 hours before the package's `createdAt`.
  - **No file records which GPT version was used.** The v21 `codexAgent.ts` passes no model flag, so codex used whatever model the local config named.
- VERIFIED: **The six v24 books written whole-chapter by GPT-5.5 at xhigh are not among the good books.**
  - The pins are in `authorRun.ts:460-461` and `modelPolicy.ts:33,87`.
  - Their July composites are 71.1 to 81.5, mean 77.6, against a catalog mean of 79.3. None is in the top 30.
- VERIFIED: **No catalog book carries its author's voice, and the graders still rewarded them.**
  - In 9 of the top 10 books the author's surname never appears in the summaries (good-to-great is the exception, about 4 per chapter). The quotation marks are mostly invented dialogue ("I am not asking for a scorecard,").
  - Meditations (85.0) never names Marcus. Man's Search for Meaning (83.3) never uses the word "prisoner" and opens "It took Emily two snowstorms to understand what the gala budget was hiding."
  - So the catalog has **no example** of what the owner now wants.
- VERIFIED: **One whole chapter written by Claude exists in the repo: this session's Opus 5 probe** (`docs/v26-plan/evidence/probe/ch01.opus5.chapter.json`).
  - I re-checked it independently: 41 of 42 quoted spans are verbatim in the chapter I source slice (the exception is inside an invented example). The fullRead is 1,432 words in 10 paragraphs. Franklin's surname appears 25 times per chapter.
  - Everything else labelled "Claude" or "bakeoff" contains no chapter prose:
    - `PIPE/zz-bakeoff-*.chapter.json` are 1.1 KB placeholders ("A fast read for chapter 1. One idea per sentence. w2").
    - `src/bakeoff/types.ts:38` covers codex models only.
    - `docs/v25/reports/CLAUDE_ROUTE_SMOKE_2026-07.md` wrote a one-line JSON and "HELLO".
- VERIFIED: **`book-score-summary.json` has nothing on Franklin.** It is The Culture Code's scorecard: composite 71.1, gate FAIL 0P/3F, rank 97 of 98, committed in 7cf24e9 (#533). Franklin is absent from all three catalog score files. The only Franklin book-scores are Phase A's: 64.6 from six fresh readers and 76.4 on the handoff card, both on rev-6 (`S_TIER_PHASE_A_REPORT_2026-09-02.md:7-15`).

## 1. How each top book was produced

The rows are the top 10 by July book-score composite, plus reference rows. "Summary words" is fast + deep + full. "Quotes/ch" counts double-quoted spans in the summaries. "Surname/ch" counts the author's surname in the summaries. `metrics.py` produced the numbers; rr21 figures come from `docs/v25/execution/assessment/reports/reader-quality.md`.

| # (July) | Book | July comp (grader) | 140-eval | Pipeline / writer (status) | Reader chars/ch | fullRead w | Ex/ch × words | Quiz stem w | Quotes/ch; surname/ch | Author's own stories? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | difficult-conversations | 85.6 (Opus 3r) | 90.1 (#1) | v21 Codex migration, 05-14, whole chapter per session; GPT, version unrecorded (INFERRED) | 16.2k | 530 | 6 × 101 | 26 | 9.1 (invented dialogue); 0 | No. Invented cast ("At 4:18 p.m., Ingrid points to the renewal spreadsheet") |
| 2 | getting-things-done | 85.1 (Opus 3r) | 82.1 (#52) | v21 **claude -p pipeline, writer claude-opus-4-7** (05-12, 83% carried over), later a Codex check and the 06-27 repair (INFERRED) | 23.4k | 627 | 6.5 × 141 | 36 | 3.1; 0 | Mostly not (an air-traffic-controller analogy; "Allen" 0) |
| 3 | atomic-habits | 85.1 (Opus 3r) | 85.6 (#16) | v21 **claude -p pipeline, opus-4-7** (05-12, 96% of prose and 183/183 quiz stems carried over); 49/120 examples replaced 05-13 (INFERRED) | 22.0k | 570 | 6 × 164 | 35 | 0.4; 0 | No ("Brailsford"/"British Cycling" 0) |
| 4 | meditations | 85.0 (Opus 3r) | 80.1 (#81) | v21 Codex migration, 05-18 (INFERRED) | 16.7k | 491 | 6 × 118 | 35 | 0.1; 0 | Paraphrase of Book I with no quotation ("Marcus" 0) |
| 5 | good-to-great | 85.0 (Opus 3r) | 76.9 (#106) | Codex 05-13; **summaries 92% rewritten by the 06-27 repair** (28b3411), model unrecorded | 14.7k | 321 | 6 × 97 | 26 | 1.3; 4 | Yes: Kroger 12, Kimberly-Clark 11, Stockdale 4 |
| 6 | contagious | 84.7 (Opus 3r) | 80.4 (#80) | June Codex; 06-26 repair (8cf3b80) | 15.0k | 436 | 6 × 89 | 17 | 1.8; 0 | Yes: Blendtec 8, Kit Kat 9 |
| 7 | games-people-play | 84.5 (Opus 3r) | 76.1 (#109) | Codex migration 05-14 (INFERRED) | 16.0k | 478 | 6 × 113 | 25 | 4.8 (invented); 0 | No (invented Thomas) |
| 8 | how-to-win-friends | 84.1 (Opus 3r) | 74.9 (#119) | v21 **claude -p pipeline, opus-4-7**, 05-09 (fe590c9; the June regen was reverted, 7066e69) | 22.1k | 572 | 6 × 160 | 36 | 5.2; 0 | Partly: opens with Carnegie's Crowley letter, verbatim |
| 9 | how-to-talk-to-anyone | 83.7 (Opus 3r) | 74.1 (#122) | Codex migration 05-13 (INFERRED) | 15.2k | 565 | 6 × 112 | 23 | 0; 0 | No |
| 10 | mindset | 83.5 (Opus 3r) | 78.9 (#96) | June Codex (INFERRED) | 16.5k | 463 | 6 × 112 | 21 | 0.1; 0 | Yes: Iacocca 12, Enron 9, McEnroe 8 |
| 12 | decisive ("known good" in Q08) | 83.3 (Opus 3r) | 88.0 (#4) | June Codex ("recovered from the codex/publish-* branches", 49d2010); 06-26 repair | 16.1k | 456 | 6 × 109 | 23 | 1.0; 0.1 | Yes: Kodak 32, Quaker 17 |
| 28 | tiny-habits | 82.0 (Sonnet 2r) | 82.1 (#52) | v21 **claude -p pipeline, opus-4-7**, 05-09 | 22.8k | 580 | 6 × 159 | 36 | 1.2; 0 | No |
| 71 | the-power-of-moments | 80.1 FAIL (Sonnet 2r) | 89.0 (#3) | **v24 author-first, codex gpt-5.5 xhigh**, whole chapter (VERIFIED pins) | 15.0k | 469 | 6 × 101 | 20 | 0; 0 | Yes: Magic Castle 17 |
| 38 / 133 | radical-candor / culture-code | 81.5 / 71.1 FAIL (Opus 3r*) | 81.4 / 81.9 | v24 author-first, gpt-5.5 xhigh | 15.9k / 15.6k | 479 / 467 | 5 × 105 | 21 | 0.4; 1.9 / 0.4; 0 | Some |
| — | **Franklin rev-6** (4 Parts) | 64.6 (6 fresh readers) | — | v25 compiler, four section writers | **29.2k** | 564 | 6 × **216** | **50** | **0**; 11.8 | Paraphrased, 0 quotations |
| — | **Franklin rr21** (19 ch) | not scored | — | v25, Sonnet 5 at medium | **~30k** | 486-774, 8/19 in one paragraph | 6 per chapter, examples = 35% of words | 108/171 open with Suppose/Imagine | 0 quotation marks in 20.5k summary words | Some facts wrong (66% of claims correct) |
| — | **Opus 5 probe ch01** | not scored | — | one `claude -p` call, opus-5 high, 23.8k-char prompt | 21.9k | **1,432** | 3 × 155 | 19 | **30**; **25** | Yes: the second-edition opening, stolen stones, the epitaph |

How the attributions were established:

- **Claude pipeline (atomic-habits, GTD, HWF, Tiny Habits).**
  - These are the only books with a `.plan.json` in v21 state: `ls state/plans | grep -v manual` gives 20 / 13 / 25 / 8 files, plus 1 for thinking-fast-and-slow and 1 for war-of-art-smoke. `generateChapter.ts:206,214` writes these files.
  - At fe590c9 the router's default provider is `anthropic-cli` and the writer default is `claude-opus-4-7`, unless `CHAPTERFLOW_WRITER_MODEL` is set (`router.ts` at fe590c9, `resolveModel`).
  - Commit 3e696cb (05-11) told migration sessions to "unset it (and the per-tier model env vars)". The writer being Opus 4.7 is therefore INFERRED, strongly.
  - How much of today's text is the pipeline's: `lineage.py` fetched each package at its earliest SHA (dcf9fe9 or fe590c9) and measured what share of today's summary 5-grams already existed. The results are 0.96 / 0.83 / 0.96. difficult-conversations scored 0.00, because it was rewritten on 05-14.
- **Codex migration path.**
  - The prompt says "Migrate one book from `.modern.json` ... using Codex sessions only" and "Write exactly one chapter per session" (`MIGRATION-CODEX-PROMPT.md:11,59`).
  - Its artifacts are the ledger and core map. Commit de7238e (05-11) calls this path "GPT-in-Codex".
  - BOOK-MIGRATION-PROMPT.md:3 names "Sonnet 4.6 or GPT-5.5". That is the only model version mentioned for May, so "GPT-5.5" is INFERRED, not VERIFIED.
- **June repairs.**
  - On 06-26 and 06-27, 19 commits titled "fix(<book>): repair to content-quality standard (gate PASS, composite >=80)" touched GTD, good-to-great, decisive, contagious and others. None records a model.
  - These commits changed a lot of text in some top books: 92% of good-to-great's summaries are new.
  - So several "top books" were written by more than one hand.

## 2. What the best books share that rev-6 and rr21 lack

1. **Length.**
   - Top books run 14.7k to 23.4k reader characters per chapter, with fullReads of 320 to 630 words and examples of 89 to 164 words.
   - Rev-6 runs 29.2k with 216-word examples. rr21 runs about 30k, and its examples are 35% of all words, longer than the three summary tiers combined (reader-quality.md:4).
2. **One situation per quiz stem, short.**
   - Top stems average 17 to 36 words, and 0 to 9% open with Suppose or Imagine. Rev-6 averages 50 words; rr21 opens 108 of 171 stems with Suppose or Imagine.
   - Good-to-great q1: "A city clinic reports that 91 percent of appointments start within the official window, but the diabetes nurse shows you a list of patients who wait so long they leave before education visits. Which response best applies the good-to-great move?"
   - Rev-6 Part One q1: "At age sixteen, essays signed Silence Dogood are winning praise in the New England Courant while you are still bound to the print shop under a long apprenticeship contract. Which reading of that bond fits the evidence: that the master picked you out of love for the printing trade, or that the contract itself was simply built to run for years so training costs could be recovered?"
3. **Paragraphs and a scene-led opening.**
   - Top fullReads have 7 to 11 paragraphs each and open on one concrete scene or source story. HWF opens: "Two-Gun Crowley shot a police officer over a request to see his license." Atomic Habits opens: "The ambush goes like this. You have been at something for six weeks."
   - In rr21, 8 of 19 fullReads are one unbroken block (reader-quality.md:5).
   - Rev-6 opens with a textbook summary: "Boston was where it began for Franklin, and two things drove him forward: a hunger to read and a wish to work harder than any deal deserved."
4. **One capable writer and a small prompt.**
   - The Claude pipeline's per-agent system prompts were 2.2k to 8.8k characters at fe590c9 (writer-breakdown 8.8k). One breakdown call writes all three tiers (`src/agents/writer-breakdown.ts:20-22,42-57`).
   - The Codex writer read a 6.6k-character prompt, the brief, the plan, the ledger, one 7.4k system prompt and the source notes (`MIGRATION-CODEX-WRITE-PROMPT.md:1-40`).
   - v25 renders 150 to 190k characters per section call (HANDOFF). Its author effort was cut from high to medium because "at high the section writer spent its whole 64k output budget on thinking blocks" (`PIPE/config/model-routing.json:3`).

## 3. What the best books do not have either: the author's voice

- None of the top books quotes its author on any regular basis. In 9 of the 10, the author's surname never appears in the summaries (table above).
- The graders gave these books 84 to 86 on "tone" anyway: Meditations tone 86 with "Marcus" 0 times; HWF tone 85.
- The template has already been applied to memoir and classics:
  - Man's Search for Meaning opens chapter 1 with an invented gala-budget scene. "Frankl" appears 1 time and "prisoner" 0 times.
  - Meditations paraphrases Book I without a single quotation.
- **Consequence:** no catalog book shows what the owner wants, which is Franklin's voice, his stories, accurate and memorable. The graders cannot detect whether a book has it. A rubric score on the Franklin rebuild would not settle it; only the owner's read can.

## 4. Is there any evidence that Claude can write a whole chapter well?

- **Whole chapter, Claude: exactly one, the Opus 5 probe** (VERIFIED; details in `docs/v26-plan/ANALYSIS.md:44`).
  - I confirmed: 41 of 42 quoted spans are verbatim (the one miss, "the year your mother started school.", sits in an invented example). fastRead 164 words; deepRead 492 words in 5 paragraphs; fullRead 1,432 words in 10 paragraphs. 3 examples, 6 quiz questions, 5 cards.
  - The prose reads as Franklin's: "he says he would happily live it over from the beginning, asking only 'the advantages authors have in a second edition to correct some faults of the first' — the printer's mind applied to a human life."
  - It keeps an invented modern example ("Marisol coordinates shifts for four branches of a regional bakery"). Its quiz asks recall questions ("Why did Josiah Franklin take his son out of grammar school after less than a year?"), which the v21 D4 rule would block (`STEP-2-WRITE-CHAPTERS.md:819`).
  - It is one chapter, it has not been scored, and the owner has not read it.
- **Claude-written chapters that were assembled field by field: yes, and they sit near the top of the July catalog.**
  - atomic-habits (#3, 85.1), GTD (#2, 85.1), HWF (#8, 84.1) and Tiny Habits (#28, 82.0) came from the May `claude -p` pipeline with Opus 4.7 at the writer tier.
  - The summary prose was one Opus call per chapter, then voice-pass and line-editor passes. Examples, quiz and cards were separate calls.
  - This was Claude, but it was not whole-chapter.
- **Nothing else.** No chapter came out of the bakeoff (`src/bakeoff/*` pins codex models, and the `zz-bakeoff-*` files are placeholders), and the route smoke wrote no chapter. The `start-with-why` v24 state chapters came from `auto-author` sessions (`state/provenance/start-with-why-ch01.json`), which ran codex gpt-5.5 at xhigh.

## 5. Verdict on "whole-chapter writing produced the good books; shown for GPT-5.5; unknown for Claude"

**Refuted as stated. Refined:**

1. "The good books" is not an established set. None met the full bar. The ≥85 group is explained by the Opus-versus-Sonnet grader split, and the two catalog graders correlate at 0.18.
2. The top-scored books were **not all whole-chapter and not all GPT**. Two of the top three, and HWF (the owner's May "quality reference"), were written by **Claude Opus 4.7 through the per-field v21 pipeline with small prompts**. difficult-conversations (#1) and meditations came from Codex whole-chapter sessions whose model version is not recorded.
3. The one controlled GPT-5.5 whole-chapter line (v24 author-first, xhigh, with verified pins) produced **below-average** July scores (mean 77.6).
4. What the higher-scoring books have in common is **one capable model per unit with a small prompt, a tight length, short single-situation quiz stems, and paragraphed scene-led prose**. They do not share a model family or the whole-chapter shape.
5. For the owner's actual goal (author's voice, a memoir, the real text), **there is no catalog precedent from either family**. The only example is the Claude Opus 5 probe, and it is a single unread chapter. Status: **possible for Claude, one chapter deep; unknown for GPT.**

## 6. The six diagnosis points, seen through this lens

1. **Assembled, not written: REFINED.** Assembly alone did not sink quality. The May Claude pipeline was assembled (11 agent types per chapter) and still produced 2 of the top 3. What v25 changed is the writer tier (Opus 4.7 → Sonnet 5 at medium), the prompt size (about 9k → 150 to 190k), four packs that each carry the full rulebook, and the research paraphrase layer standing in for the source.
2. **The rules create the problems they fix: CONSISTENT** (not tested directly here). New evidence: the rulebook's size forced the author's effort down from high to medium (`model-routing.json:3`).
3. **The format fights a memoir: CONFIRMED and extended.** The template's best-scored outputs contain no author voice. The catalog already turned Man's Search and Meditations into invented-modern-character guides, and the graders rewarded both.
4. **A broken compass: CONFIRMED with new numbers.** The "5 good books" set is itself mostly a grader artifact (Opus 3r versus Sonnet 2r, a 3.7-point swing), and the two catalog instruments agree at ρ = 0.18.
5. **Accuracy is baked in upstream: NOT TESTED** by this lens. One adjacent finding: every top book was written from v13 content plus notes, never from the author's own text, because the books are copyrighted (`MIGRATION-CODEX-PROMPT.md:11`). Franklin is public domain, so the real text can be the input. Only the probe has done that.
6. **Over-engineered around the writing: SUPPORTED.** The small-prompt May setups hold the top July scores. Every later architecture (v23 compiler, v24 author-first, v25) scored lower or shipped nothing.

## 7. Implications for the plan

- **Correct DECISIONS.md N3's premise** (`docs/v26-plan/DECISIONS.md:29`). The line "Every book that met your bar in July was written whole-chapter by GPT-5.5 through Codex" should become:
  > "No book met the full bar. The top-scored books came from one capable model per unit with small prompts: Claude Opus 4.7 (Atomic Habits, Getting Things Done, How to Win Friends) and Codex GPT, version unrecorded (Difficult Conversations, Meditations). The one GPT-5.5 whole-chapter line scored below average."
  
  This favors "Claude only" (option A) at least as strongly as before. A GPT arm is optional, not owed.
- **Do not use the catalog rubric as the benchmark for the Franklin prototype.** It rewards voiceless template books, its scores swing about 4 points with the grader, and it disagrees with the other instrument. Use the owner's side-by-side read. If a grader is used as a smoke alarm, both arms must get the same grader class.
- **Borrow the shape, not the template, from the good books.** Take the length discipline (15 to 23k characters per chapter), paragraphed scene-led prose, and short single-situation quiz stems. Leave out invented-character examples as the default.
  - Open decision: the probe's 1,432-word fullRead is about 2.5 times the top books'. The owner should decide whether Franklin's own stories justify that length or whether the fullRead should be cut.
- **Keep the writer's prompt small and the model strong.** Every setup that scored well used small prompts (2 to 9k characters per agent, or about 30 to 50k for the Codex writer). The probe used 23.8k. A strong writer given a 150 to 190k-character rulebook had to run at low effort.
- **The prototype must answer what the probe does not:**
  - Does Opus hold the voice across the *hard* chapters (ch07, ch13)?
  - What are examples and quizzes *for* in a memoir (recall of Franklin's story, or transfer to modern life)?
  - Is it consistent across chapters? One chapter proves nothing about 19.

## 8. Open questions

- Which GPT model did the May and June Codex sessions use? It is recorded nowhere in the repo. Only the owner's `~/.codex/config.toml` history or memory can answer.
- Was `docs/book-score/baseline-2026-06-30.json` scored before or after the 06-26/27 repairs? GTD went from 80.4 in June to 85.1 in July, and good-to-great from 80.8 to 85.0.
  - If the baseline came after the repairs, the same bytes moved about 4.5 points on grader change alone.
  - If before, the repairs explain it.
- Which model and session did the 06-26/27 "repair to content-quality standard" commits (19 books)? They landed without a co-author line. The behave repair was committed by a Claude Opus 4.8 session "in this checkout" (41e3021).
- Did the owner, as a reader, prefer the Claude-pipeline books (HWF, Atomic Habits) or the Codex books (Difficult Conversations)? In May he held up HWF as the bar. That is his preference, recorded in a prompt, not a grader's.
- Can Opus-class models write 19 Franklin chapters with consistent voice and accuracy? Only ch01 exists. ch07 had the most errors in rr21 (15 contradicted claims), which makes it the hardest test.

## Reproduce (each under 5 minutes)

- Grader split: `grep -n 'Mixed-model' docs/v24/CATALOG_QUALITY_AUDIT.md`, then filter the table rows by the `Model` column. Composite ≥83 → all `Opus·3r`.
- Rubric correlation: the Spearman snippet over `docs/v24/catalog-quality-audit.json` against `docs/v25/chapterflow-140-evaluation/chapterflow-140-evaluation-report-data.json` (ids joined; ρ = 0.178).
- Claude pipeline artifacts: `ls scripts/book/prompts/chapterflow-v21-authored/state/plans | grep -v manual | sed -E 's/-ch[0-9]+\.plan\.json//' | sort | uniq -c`.
- Writer default at ship time: GitHub `scripts/book/prompts/chapterflow-v21-authored/src/providers/cli.ts` at fe590c9, `TIER_DEFAULT_MODELS.writer`.
- Carry-over: `lineage.py` in the scratch dir (it needs the old package versions fetched through get_file_contents at dcf9fe9 / fe590c9 / ba40d73 / 81e620a).
- Reader shape: `python3 .../scan/existence-proof/metrics.py`.
- v24 pins: `grep -n -a 'AUTHOR_WRITER_MODEL\|AUTHOR_WRITER_EFFORT' PIPE/src/orchestrator/authorRun.ts` and `grep -n 'BASELINE_MODEL =' PIPE/src/orchestrator/modelPolicy.ts`.
- Bakeoff placeholders: `head -c 400 PIPE/zz-bakeoff-iso-ch01.v21-native.chapter.json`.

## Adversarial verification

Verifier re-ran every count read-only (scratch: `scratchpad/scan/verify-existence-proof/`). Old package versions were fetched from GitHub raw at the named SHAs.

- **EP1: CONFIRMED.** `catalog-quality-audit.json` has `high_quality` false for all 140 books. The five books at ≥85 are all churn HIGH. All 15 books at ≥83 have `n_readers`=3, and the best 2-reader book scores 82.2. Deltas against `baseline-2026-06-30.json`: 3-reader books +2.30 (n=51), 2-reader books −1.37 (n=79).
  - Small count drift: the JSON has 84 books with 2 readers, 53 with 3, and 3 unlabeled. Noise is labeled `Opus·3r` in the MD but has 2 readers in the JSON.
  - Extra support: in the June baseline the ≥83 group was mostly O–Z books (16 of 26), and the A–N majority appeared only after the Opus panel regraded them.
- **EP2: PARTIAL.** Reproduced: the plan-file counts (20 / 13 / 25 / 8), `generateChapter.ts:206,214`, `TIER_DEFAULT_MODELS.writer = "claude-opus-4-7"` at fe590c9, and lineage.py's 0.96 / 0.83 / 0.96 with 183/183 atomic quiz stems. The 05-12 source commit dcf9fe9 is titled "Faulty V21 pipeline".
  - Omitted: atomic-habits and GTD also carry the Codex-migration artifacts that the report uses to attribute other books to Codex. Those are `manual-plan` ×20 and ×13, a `manual-brief`, `manual-generation-ledger` (updated 05-13T19:38 and 05-14T06:37) and `chapter-core-map`.
  - GTD examples are mostly not carried over: 36 of 84 are identical.
  - So the summaries and quizzes are Claude-pipeline text, but these books were co-produced with a Codex pass. The Opus 4.7 writer is still inferred.
- **EP4: CONFIRMED, with caveats.**
  - The cited pins are HEAD code. `modelPolicy.ts` did not exist at aec0ecd6e (07-02). The July pin (gpt-5.5, xhigh) is attested by `docs/v24/V24_CF_J_COMMIT_AND_MODEL_MIGRATION_REPORT.md:51`, which is the better citation.
  - The six composites and ranks reproduce, with a mean of 77.63.
  - On the other grader (140-eval), the-power-of-moments is #3 (89.0, a close read). The six average 79.1 there, against a catalog mean of 80.0.
- **EP5: CONFIRMED.** ρ = 0.178 uses ordinal ranks without a tie correction; with tie-averaged ranks it is 0.157, and Pearson is 0.173. The top-10 overlap is difficult-conversations only. POM is #71 on book-score and #3 on the 140-eval; HWF is #8 and #119.
- **EP6: PARTIAL.** The surname counts reproduce: 0 in the summaries for 8 of the top 10, HWF "Carnegie" 1 in total, good-to-great 4.0 per chapter. Meditations has "Marcus" 0 times and tone 86 (`CATALOG_QUALITY_AUDIT.md:59`). Man's Search ch1 opens on Emily, with "prisoner" 0 times. The "scorecard" line exists.
  - Overstated: the report's own table credits HWF (the Crowley letter, verbatim), good-to-great, mindset, contagious and decisive with the source's own cases.
  - Man's Search summaries do contain "camp" 3 times and "Auschwitz" 2 times.
  - "Graders cannot detect voice" is inferred from their scores; it was not tested.
- **EP9: CONFIRMED, with a caveat.** On the probe, 41 of 42 quoted spans across the whole chapter are verbatim; the one miss is "the year your mother started school.". In the summaries 30 of 30 are verbatim. fullRead is 1,432 words in 10 paragraphs; there are 3 examples, 6 quiz questions and 5 cards; "Franklin" appears 25 times in the summaries. The bakeoff files are 1.1 KB placeholders.
  - Checked the 06-26 behave repair, which is co-authored by Claude Opus 4.8 (41e3021): it was line edits (151 of 153 quiz stems kept, 76 of 102 examples kept, fullRead 5-grams 1.00 in every chapter).
  - The claim holds only for chapters with recorded provenance. The unattributed 06-27 good-to-great repair (28b3411) rewrote all three summary tiers (0.00–0.24 5-gram carry-over) and replaced 48 of 54 examples across all 9 chapters, keeping the quizzes. It belongs to the same repair campaign as the Claude-co-authored behave commit, and its author is unknown.

**Missed (most important):** the 140-book evaluation is not an independent per-book read.
- Its meta says "Single-evaluator screening audit", with `profile_counts` {prior: 8, scalable: 132}.
- Within each profile the scores cluster: SD 1.5–3.2 against an overall SD of 5.8. The genre profile the book was assigned largely sets its score.
- Only 8 books got a close read ("prior"). Those 8 include difficult-conversations (90.1), POM (89.0), radical-candor, multipliers and execution.
- So the ρ≈0.18 in EP5 mostly measures book-score against a genre-profile prior, not grader against grader.
- The only close-read score for a GPT-5.5 whole-chapter book (POM, #3) cuts against EP4's "below average" framing.
