# Scan lens: the rule inventory

Investigator: rule-inventory lens, 2026-09-27, repo at origin/main 22e021d84. Read-only. I made no model calls.
Scratch scripts (python3, 0 model calls) are in `/tmp/claude-0/-home-user-ChapterFlow/48916df7-45f9-50d8-ad9d-e43b21e61800/scratchpad/scan/rule-inventory/`:
`sev.py` (severity per check id), `groups.py` (purpose groups), `secport.py` (a port of the portable per-chapter SEC rules), `summarize.py`, `softban.py`.
PIPE = `scripts/book/prompts/chapterflow-v24-author-pipeline`. `sG` = `PIPE/src/sections/sectionGate.ts`.

## keyFacts

- VERIFIED: `sG` (4,289 lines) holds **138 check ids under 130 live SEC codes** (SEC0..SEC137; SEC56 and SEC58 are retired; there are no codes SEC19 or SEC75-79). **135 of the 138 can block.** Only SEC4, SEC29 and SEC134 are advisory-only; SEC12, SEC117, SEC125, SEC129 and SEC130 are advisory or blocker depending on the case (`sev.py`).
- VERIFIED: Rules that block or reshape text also exist outside `sG`:
  - 22 BPV blueprint-gate ids (`src/compiler/blueprintGate.ts`);
  - 19 cross-chapter eviction policies plus 3 documented exemptions (`src/app/compilerApplicationPort.ts:935-1068`);
  - 131 ship-gate catalog ids: 59 blocker, 43 major, 29 minor (`critics/finalGate.ts` SEVERITY_FROM_CATALOG);
  - book-gate F/BP/AS/ARCH/CM/RDRP ids;
  - 9 EDIT editor-guard codes (`sections/chapterEditGuard.ts:17-33`);
  - 4 source-fidelity codes SF1-SF4 and a quiz-key judge;
  - 5 reader-panel blocking categories;
  - a rubric with a correctness veto, composite ≥80, 10 factor floors ≥70 and a churn veto;
  - 82 hard-banned phrases and 9 soft-banned budgets (`config/banned-phrases.json`).
  In total, **more than 330 distinct checks** can stop or reshape a chapter.
- VERIFIED: Gate, critic, review and QC code is about **50k of the 179.8k source lines (28%)**:
  - critics/: 23,189 lines in 69 files
  - review/: 7,193 lines
  - qc/: 13,479 lines
  - `sG` plus its helpers: 5,984 lines
  - Tests: 167 test files (68k lines, about half of all test code) import critics/ or sectionGate.
  - For comparison, the writer rulebook, `sectionTasks.ts`, is 1,043 lines.
- VERIFIED: **Not one of the 138 SEC checks can tell whether a fact is true or a quiz key is right.** Every quiz rule checks shape: index range, the blueprint-pinned index, lengths, absolute words, cue words. Every grounding rule counts tokens or ids. The code says this itself at `sG:3051-3053`: SEC14 "never caught a wrong fact: every one of the eight factual distortions Phase A verified … sailed through".
- VERIFIED (my port, `summarize.py`): **78 of 78 chapters of the six best catalog books fail at least one portable, non-count SEC blocker.** Those books are Difficult Conversations 85.6, Getting Things Done 85.1, Atomic Habits 85.1, Meditations 85.0, Good to Great 85.0 and Decisive 83.3.
  - SEC117 (transfer cue words) fails 78/78.
  - SEC116 (key is the longest choice) fails 76/78.
  - SEC12 (readability) fails 34/78.
  - The Opus-5 probe ch01, the best Franklin text in the repo, fails 12 portable rules. It also fails the count and shape rules.
- VERIFIED: Franklin's own prose fails SEC12 badly. The chapter-I slice scores Flesch 52.8, FK 13.0, 28.7 words per sentence; the proprietaries slice scores 49.6, 14.4, 32.4 (score.py-parity formula). At a syllables-per-word rate of 1.40 (common words), FK ≤7 allows at most about 15.6 words per sentence and Flesch ≥70 at most about 18.1. So **the gate mathematically forbids Franklin's sentence length.** The same rule is ADVISORY at QC because it "fires on every reference book" (`critics/majorPolicy.ts:49`, E1).
- VERIFIED: The code documents **at least 12 cascades in which one rule's tic led to a new rule** (§4). Examples: SEC14 → "three puffy rolls" on 11 surfaces → SEC129; SEC33+SEC34 → recall beat → SEC133 → tie-back closer (88/114) → SEC137; SEC56/SEC58 → stapled stems → retired.
- VERIFIED: 61 of 78 compile rounds since 09-04 ended blocked by a gate (49 section gate, 12 assembly gate; `docs/v25/execution/assessment/reports/live-history.md` keyFacts). 311 compile calls went into 14 attempts, and **the successful attempt used 27** (quota-defect.md). Gate-caused livelocks #4-#8 (SEC120, SEC128, SEC14/136, SEC35, SEC119/SEC90) are 5 of the 20 numbered defects.
- VERIFIED: **No rule anywhere checks paragraphing or total chapter length.**
  - Unbroken walls of text are the #1 reader defect in reader-quality.md: 8/19 full reads and 11/19 deep reads are one paragraph. No SEC, critic or panel blocker covers them.
  - The rules set only floors (SEC6: fastRead ≥350, deepRead ≥1000, fullRead ≥2400 chars) and fixed counts: 6 examples (SEC22), 9 quiz questions (SEC42), 7 cards (SEC48), ≥3 if-thens (SEC66). Most of the ~30k chars per chapter comes from these.
- VERIFIED: Under a whole-chapter design, the checks a reader would miss number about 7 (§6). Two are model checks: facts against the source, and quiz keys. The Opus-high one-pass check caught 7/7 planted errors for $0.27. The rest are deterministic: the app's own validator, machinery/meta leaks, verbatim quotations, paragraph length, and a cast-name leak.

## 1. Where the rules sit in the v25 flow (VERIFIED unless marked)

| stage | rule set | blocks? | file |
|---|---|---|---|
| blueprint deal | BPV0-BPV14 (22 ids): example count, quiz floor, answer-position balance, venue variety, name collisions | yes | `src/compiler/blueprintGate.ts` (301 lines) |
| each of 4 writer calls | SEC rules via `validateSectionPack` (the per-pack subset) plus retries | yes | `sG:3776-3810` |
| assembly (whole book) | cross-chapter SEC80-SEC137 sameness gates, SEC90 budget, SEC119 cast; evict cached packs and redraft | yes | `sG:4230-4263`; `compilerApplicationPort.ts:935-1180` |
| editor pass | EDIT.* (9): facts preserved before and after; all SEC gates re-run | yes | `sections/chapterEditGuard.ts:17-33` |
| reader panel | 5 blocking categories; since #578 a blocker needs 2 of 3 seats on the same chapter and category (schema_or_app_breaking still blocks on one seat) | yes | `review/panelBlockingCorroboration.ts:24-57`; `readerExperienceReview.ts:78-100` |
| fresh QC | ship gate (131 ids) + book gate + SF1-SF4 judge + key judge. The v25 compile path never runs the ship gate (verify-gates-downstream.md #10) | yes | `app/candidateQcEvaluator.ts:577,614` |
| promotion | rubric: unanimous correctness, composite ≥80, factor medians ≥70, churn ≠ HIGH | yes | `review/catalogRubric.ts:178,185,630-690` |

The compile-time and QC rulebooks disagree:
- SEC52 has a prose carve-out and BP15 does not. That produced 19 QC blockers (verify-gates-downstream.md).
- SEC12 blocks at compile, while its QC twin E1 is advisory.
- SEC116 was an advisory "shadow" check in `7cf24e9` and has been a blocker since #541 (`git show 3b82e31:…sectionGate.ts` line 3314). The comment above it still says it "ships ADVISORY" and that "all four >=85 books … already ship at 53-84% … tell" (`sG:3617-3625`).

## 2. SEC rule groups, one row per group (`groups.py` assigns all 138 ids)

Verdict key, under a whole-chapter design: **KB** = keep blocking, **ADV** = report to writer/owner only, **DEL** = delete (the thing it guards no longer exists).

| group (ids) | codes | protects the reader against | evidence of value | evidence of harm | verdict |
|---|---|---|---|---|---|
| G1 schema / identity / counts / blueprint deal (25) | SEC0, 1, 2, 20-22, 40-42, 44-46, 48, 60, 61, 66, 67.shape, 99, 124, 125 | a pack that will not assemble; the 6/9/7/3 template | schema errors do occur (SEC0.malformed) | Counts force length: 6 examples = 35% of rr21 words (reader-quality.md). SEC44 requires exactly 3 choices, but the app accepts 2-8 (`app/app/api/book/_lib/validate-book-package.ts:1015-1018`). SEC46 pins `correctIndex` to the blueprint slot (`sG:3517-3518`; `sectionTasks.ts:133` "MUST match the blueprint slot") | DEL. Replace with the app's own validator (KB) |
| G2 length floors / caps (11) | SEC3, 4, 6, 9, 18, 23, 24, 43, 50, 62, 65 | stub text | catches empty or stub fields | floors add length; no ceiling on total; the Opus ch01 clears every floor anyway | DEL (floors) / ADV (length report) |
| G3 readability (2) | SEC11, SEC12 | hard prose | none found where SEC12 fixed a reader problem | Forces ≤15-18 words per sentence (math above); rr21 averages 12-14 (HANDOFF). Top book Difficult Conversations fails Flesch<70 in 10/12 chapters. Its QC twin E1 is advisory because it fires on every reference book (`majorPolicy.ts:49`). #586 had to add "stop sentence-chopping" wording | ADV (report Flesch and words per sentence; no floor) |
| G4 citation bookkeeping (21) | SEC5, 8, 10, 13, 15, 27, 28, 32, 47, 51, 55, 57, 64, 68-73, 122 | nothing the reader sees; ids and claim-type labels in JSON | keeps the packet machinery self-consistent | SEC122 exists because an unresolved id "dodges … every content gate at once" (`sG:364-376`): rules guarding rules | DEL |
| G5 specifics quotas / derivability / memorable lines (12) | SEC14, 16, 17, 33, 74, 111, 118, 120, 128, 129, 135, 136 | a quiz asking what the page never said; a case cited but never taught | SEC120 addressed "the dominant blind-reader BLOCKER class" (`sG:3356-3362`, finding 45); the app shows ONE tier per mode (`ChapterReaderClient.tsx:144`), so derivability is a real need | Source of token hammering ("three puffy rolls" on 11 ch01 surfaces, `sG:3049-3053`), livelocks #4-#6, an 18-round wedge (`sG:3410-3418`). SEC118 (≤14 words) rejects Franklin's own lines: the Opus draft's 3 verbatim quotes are 19, 24 and 38 words | DEL the quotas; keep derivability as a line in the key checker (ADV) |
| G6 example cast / scene craft (13) | SEC25, 29-31, 34-39, 119, 133, 137 | template scenes, source names worn as fictional actors | SEC37/SEC30 regexes target an observed synthetic-scaffold shape ("stays closed", compass-seal tokens, `sG:150-159`); I found no count of real catches | Together they REQUIRE the invented-modern-character shell: named actor (SEC25), dealt fictional name only (SEC35), no source figure as actor (SEC34), no recalling the case (SEC133), no source name in whyItMatters (SEC137), a decision verb (SEC31). SEC35 killed compile slots on "Whoever", "Years later" (`sG:3206-3216`; live-history A5). SEC137 took 4 heuristic rounds (commit c4893f2). SEC39 livelock (HANDOFF) | DEL (except SEC119 → KB leak check if fictional examples remain) |
| G7 quiz / card / plan craft (12) | SEC49, 52-54, 59, 63, 67.trigger, 116, 117, 121, 132, 134 | strawman distractors, guess-by-length, recall-only quizzes | the panel flagged 5/9 and 8/9 keyed-longest (`sG:3638-3645`); the Opus ch01 keys the longest choice in 3/6 questions (q1 97, q3 88, q5 87 chars) | SEC117 counts only 7 cue strings (`metrics/rubricMetrics.ts:311-327`), floor 6 of 9 (`pedagogyThresholds.ts`). The #1 book's scenario stems ("A manager has exact timestamps…") mostly fail it, and it produced 108/171 "Suppose/Imagine" stems. SEC52 blocked Franklin's own absolutes (`sG:3586-3597`). SEC116/121/53 plus the pinned index: see §5 | ADV |
| G8 sameness / stamps (27) | SEC80-87, 89, 93-98, 100-102, 107-109, 112, 114, 115, 126, 130, 131 | the same scene, opener or phrase across chapters | real in rev-6 (churn HIGH; card backs "The contrast is…" 15/28) | SEC83 wedged a 13-round live run (`sG:2181-2199`); SEC119/SEC90 assembly livelock (#8); 19 eviction policies needed (`compilerApplicationPort.ts:935-1030`); each gate is a regex for one frame family ("pleasant-average-peak-end", "waiting-for-answer") | ADV (one book-level sameness report for the owner) |
| G9 phrase bans / budgets (3) | SEC90 (9 soft budgets), SEC92 (82 hard bans), SEC123 (em dash) | model-voice tics | tics are real | The "rather than" budget is 15 per BOOK regardless of length (`config/banned-phrases.json:357`). The catalog median is 9 per book, and 30/140 books exceed 15, including #1 Difficult Conversations (20) and #3 Atomic Habits (22) (`softban.py`). Substitution → 256 "instead of" (HANDOFF). All 12 Meditations chapters use em dashes | ADV (per-10k-word counts) |
| G10 leak / meta / corruption (11) | SEC7, 26, 88, 91.source_paste, 103-106, 110, 113, 127 | "Fact 2", jammed CamelCase labels, "this chapter", seams, doubled periods, fragments | SEC103 is "zero false positives across the whole committed gold corpus" (`sG:122-129`, line 128); SEC7 caught a real meta line in the Opus draft ("The chapter's sharpest scene is …") | SEC7 is a bare `the book|the author` match in summary tiers (`sG:2933`). SEC26 was narrowed for exactly that collision with Franklin's memorandum book (`sG:3168-3187`), but SEC7 was not. Meta-reference killed the first live run (A1; commit 3f67579): ch01 is Franklin writing a book | KB (narrow SEC7 to the SEC26 discourse-verb form) |
| G11 environmental (1) | SEC91.sidecar_unavailable | a missing input | — | — | DEL with the sidecar |

Outside SEC:

| rule | protects | value | harm | verdict |
|---|---|---|---|---|
| BPV blueprint gate (22 ids) | variety of the dealt template | stops identical deals | it IS the template (6 examples, 9-question floor, positional case cues that produced the analogy graft, Phase A `S_TIER…:60`) | DEL |
| eviction machinery (19 + 3) | clears cross-chapter collisions | un-wedged #8 (fv7e evicted 17 packs) | exists only because packs are cached and gated separately; #556, #559 and #580 each patched it | DEL |
| ship gate (131 ids) + book gate | a last deterministic net | caught B5 em dashes and BP15 absolutes | 33 deterministic blockers on rr21 (19 BP15, 1 F4 unscoped) before any judge; F4 made QC repair refuse outright (REPAIR_FINDING_UNSCOPED) | keep only the G10 equivalents (KB) |
| SF1-SF4 source-fidelity + quiz-key judges | wrong facts, wrong keys | the only checks aimed at accuracy | sit AFTER a panel PASS, so they never ran on any 19-chapter candidate (source-accuracy.md) | **KB, moved to right after the draft** |
| reader panel (five blocking kinds, 2-of-3 seats) | stand-alone tiers, contradictions, broken quizzes | 1 seat's `schema_or_app_breaking` is real | blind to source truth by design (`readerExperienceReview.ts:78`); 32/46 blockers were tier stand-alone; blocked chapters changed every round | ADV (owner reads instead) |
| rubric (correctness veto, ≥80, floors ≥70, churn ≠ HIGH) | promotion quality | none: Q08 control and "decisive" also failed (HANDOFF) | churn is HIGH for 135/140 catalog books (`docs/v24/CATALOG_QUALITY_AUDIT.md:5`), including top 5 → the churn veto alone refuses 96% | ADV |
| EDIT guard (9) | the editor must not change facts or keys | EDIT.quiz_key_text binds the key to its text (`chapterEditGuard.ts:35-47`), the right idea | only covers the editor stage | fold into the key check (KB) |

## 3. Calibration: known-good text run through the portable SEC rules (VERIFIED, `secport.py`)

The port covers the ~45 SEC rules that do not need the blueprint or packet (§2 G1-G3, G7, G9, G10 subsets). The formulas are copied from `rubricMetrics.ts` / `readingLevel.ts` / `sG`. Anchor rules are not ported, so these are floors.

| text | chapters | fail ≥1 portable blocker (count rules excluded) | most frequent |
|---|---|---|---|
| Difficult Conversations (85.6, #1) | 12 | 12 | SEC117 12, SEC116 12, SEC121 12, SEC53 12, SEC12 ease 10, SEC52 9; "rather than" 20 > 15 |
| Getting Things Done (85.1) | 13 | 13 | SEC116/121/117 13, SEC53 12, SEC31 10 |
| Atomic Habits (85.1) | 20 | 20 | SEC116/121/117 20, SEC53 18, SEC118 12; "rather than" 22 > 15 |
| Meditations (85.0) | 12 | 12 | SEC117/116 12, SEC123 12, SEC53 11 |
| Good to Great (85.0) | 9 | 9 | — |
| Decisive (83.3) | 12 | 12 | SEC117 12, SEC31 11, SEC116 10 |
| Franklin rev-6 (4 parts) | 4 | 4 | SEC116 3, SEC117 3, SEC118 2 |
| **Opus-5 probe ch01** | 1 | 1 | SEC7, SEC12 (FK 12.7/11.3/14.0 vs 7/8.5/9.5; Flesch 49.9), SEC117 (0/6 cued), SEC118, SEC53, SEC116, SEC121, SEC31, SEC49, SEC67, SEC123 (30 em dashes); plus count rules SEC22/42/44/48/66 |

Reading: the rulebook would reject every chapter of the books it was calibrated against, and the best Franklin text in the repo. A few hits are real but minor: the Opus meta line, and its key-longest rate of 3/6. Those belong in a note to the writer, not in a blocking retry loop.

## 4. The cascade ledger: rule → tic → new rule (VERIFIED from the code's own history comments)

| # | rule | tic it produced | the next rule | cite |
|---|---|---|---|---|
| 1 | SEC14: 2 specifics per unit | "three puffy rolls" on 11 ch01 surfaces | SEC14 chapter-level + SEC129 rotation cap (>50% blocks) | `sG:3045-3063`, `2528-2550` |
| 2 | SEC33: 2 specifics per example + SEC34 no source figure | characters "read or remember" the case (ch03 5/6) | SEC133 bans the recall beat | `sG:3263-3272`, `2556-2565` |
| 3 | SEC33 at 1 + SEC133 | the token moves to whyItMatters: tie-back closer in 88/114 examples | SEC33 floor 0 + SEC137 bans source names in whyItMatters | `sG:2508-2521`, `460-465` |
| 4 | SEC39: whyItMatters must share fact keywords | tie-back closer (Phase A ch02 6/6) | pool narrowed to mechanism+whyWrong; still livelocks (HANDOFF Q08) | `sG:2480-2507` |
| 5 | SEC56/SEC58: verbatim specific in each stem/card | stapled case clauses; 15/28 card backs "The contrast is…" | retired → SEC120 + SEC14/128 | `sG:3538-3549`, `3710-3714` |
| 6 | SEC120 vs SEC56/58 | jointly unsatisfiable; 18-round wedge | SEC120 stands down when nothing is on the page | `sG:3410-3418` |
| 7 | SEC128: a cited case must be taught | livelock: writer cannot swap a dealt case (#5) | SEC136 + bounded summary redraft | `sG:3088-3101` |
| 8 | SEC16: memorable line carries 2 specifics | 11/12 lines are identifier pairs | SEC16 inverted to ≤1 | `sG:2968-2990` |
| 9 | SEC117 transfer cue | 108/171 stems open "Suppose/Imagine" | Q06 changes the message only | `sG:3681-3685` |
| 10 | SEC52 absolutes | Franklin's own "never" blocked in 5 distractors × 3 drafts | prose carve-out (BP15 at QC still lacks it) | `sG:3586-3597` |
| 11 | SEC26/SEC7 "the book" | Franklin's memorandum book blocked 3 drafts | SEC26 narrowed; SEC7 not | `sG:3168-3187` |
| 12 | SEC83/SEC90/SEC119 cross-chapter | permanent wedges (13 rounds; #8) | eviction registry, budget planner, #556/#559/#580 | `sG:2181-2199`; `compilerApplicationPort.ts:935-1160` |

The pattern (INFERRED from the 12 rows): each rule measures a proxy, such as a token, a cue word, a length or an id. The writer satisfies the proxy in the cheapest way, and that cheap satisfaction is the next tic. A whole-chapter writer that is told the goal instead of the proxy removes the loop at its source.

## 5. Mechanism behind "wrong key after a choice-length check" (VERIFIED structure; the incident is HANDOFF)

- The blueprint deals `correctIndex`, SEC46 blocks any other index (`sG:3517-3518`), and the card says "MUST match the blueprint slot" (`sectionTasks.ts:133`).
- SEC53 (key ≤1.4× words and ≤1.5× chars), SEC116 (≤20% of keys uniquely longest, `pedagogyThresholds.ts:41`) and SEC121 then force a retry to rewrite choice TEXTS while the index cannot move. The "CHOICE PARITY METHOD" asks the writer to write distractors first and cut the key (`sectionTasks.ts:188`).
- No SEC check compares the text at the index with the source. EDIT.quiz_key_text guards only the editor stage (`chapterEditGuard.ts:35-47`). The only correctness check is the key judge at fresh QC, which this run never reached.
- The rule "the key is never the longest choice" (`sectionTasks.ts:187`, `232`) creates an inverse tell: a reader who strikes out the longest of 3 choices rises from 33% to about 50% (INFERRED; I could not measure rr21 here).

## 6. The short list a reader would actually miss (under a whole-chapter writer)

| # | check | how | cost | now |
|---|---|---|---|---|
| 1 | every factual claim matches the source (attribution, sequence, cause, numbers) | one model pass with the chapter's source span; Opus-high caught 7/7 plants (`docs/v26-plan/evidence/probe/factcheck-result-opus.json`) | ~$0.27 and ~42 s per chapter | SF1-SF4 exist but run after a panel PASS; never ran on 19-chapter candidates |
| 2 | every quiz key is right, the stem and choices are about the same situation, and the answer is on the page the reader saw | the same pass (key judge plus the SEC120 idea as an instruction) | included | key judge at fresh QC only |
| 3 | the app can render it | the app's own `validateBookPackage` (1,335 lines, already written) | 0 | used by the probe (`validate.mts`) |
| 4 | no wall of text | deterministic: no paragraph over ~180 words; any tier over ~250 words has ≥2 paragraphs (the adapter splits only on blank lines, `v21-adapter.ts:76`) | 0 | **missing** |
| 5 | quotations are the author's words | deterministic: every quoted span attributed to the author is found verbatim in the source span (normalized); the probe checked 44/44 by hand | 0 | **missing** (judges only verify their own quotes) |
| 6 | no machinery or meta leakage | deterministic G10 regexes (SEC103/104/105/110/113/127; SEC7 narrowed to discourse verbs); SEC119 if fictional examples exist | 0 | exist; keep |
| 7 | the owner reads it | side by side, as the plan proposes | owner time | never done in the loop |

Everything else becomes one advisory "craft report" handed to the writer brief or the owner: readability numbers, cue and length-tell rates, phrase counts per 10k words, and cross-chapter sameness. It is never a retry loop.

## 7. diagnosisVerdict (this lens)

1. **Assembled, not written: CONFIRMED from the rule side.** Groups G1, G4, G5 and G6 (71 ids) exist only to hold four blind packs to a dealt template and to a packet. The template counts alone (6/9/7/3) set most of the length.
2. **Rules create the problems they fix: CONFIRMED and strengthened.** The code itself documents 12 cascades (§4), 5 of 20 live defects were gate livelocks, and 284 of 311 compile calls went to attempts that failed.
3. **The format fights a memoir: CONFIRMED.** SEC25+SEC34+SEC35+SEC133+SEC137+SEC31 make an invented modern character mandatory in every example. SEC117 requires 6 of 9 hypothetical stems. SEC12 forbids Franklin's sentence length, and SEC118 forbids his memorable lines.
4. **Broken compass: CONFIRMED.** The rules are calibrated against catalog books yet fail 78/78 of their chapters. The QC twin of SEC12 is advisory because it fires on every reference book. The rubric's churn veto would refuse 96% of the catalog.
5. **Accuracy baked in upstream: REFINED.** No gate can catch it either way: 0 of 138 SEC checks judge truth, and the only accuracy checks run last and never ran.
6. **Over-engineered around the writing: CONFIRMED in numbers.** About 50k lines of gate, critic, review and QC code against a 1,043-line writer card; 167 test files pin the gates.

## 8. Open questions

- Q08 incident text (SEC39 livelock, key moved) is HANDOFF; the rr21/Q08 packs would let someone measure the key-longest inverse tell and the SEC39 retry counts.
- Per-SEC retry counts are not in the repo (they are in `~/cf-canary` run-state attempts). That tally would rank which rules cost the most.
- The whole-chapter design must still decide whether examples, quiz, cards and plans keep the v21 shape. If they do, keep SEC119 and the app validator; if not, SEC119 goes too.

## Adversarial verification

Verifier: adversarial pass on lens rule-inventory, 2026-09-27, repo at 22e021d. I made no model calls. Scratch: `scratchpad/scan/verify-rule-inventory/rd.mts` (it runs the real `rubricMetrics.ts` functions through tsx).

| id | verdict | one-line evidence |
|---|---|---|
| RI-2 | PARTIAL | Confirmed: no SEC rule compares a claim or a key with the source. SEC46 pins only the blueprint index, and SEC53/116/121/117 check shape (sG:3510-3690). The `sG:3051-3053` quote is SEC14's own comment. Nuance 1: SEC111 (sG:3546-3562) blocks a quiz whose stem, key or explanation imports a hard-specific phrase from a different named case. That is a narrow, token-based guard against misattribution, not a truth check. Nuance 2: SF1-SF4 placement is re-checked in code (`bookRunApplicationService.ts:3404` returns unless the panel says PASS, and fresh-qc starts at `:3454`; the report's :3308/:3387 have drifted). "Never ran on any 19-chapter candidate" rests on the Mac-only data cited in source-accuracy.md. |
| RI-3 | CONFIRMED | Re-ran `summarize.py`: TOTAL 78 fail 78, SEC12 34, SEC117 78, SEC116 76. The port matches the real rules for SEC117 (same cue list, floor floor(6n/9)), SEC116 (uniquely longest by characters, >20%) and SEC12 (same formulas). The finding is stronger than stated: across all 140 v21 catalog books, SEC117 fails 1902 of 1903 chapters and SEC116 fails 1718 of 1903. The catalog stems are real scenarios ("A manager has exact timestamps…") that simply lack the 7 cue strings. Corrections: Decisive is #12 (83.3), not in the top six (Contagious, #6 at 84.7, exists). The probe fails 11 portable codes, not 12. §2 G7 says the probe keys the longest choice in 3/6 questions; it is 5/6 (q1, q2, q3, q5, q6), and it uses 4 choices. |
| RI-4 | CONFIRMED | The real TS functions reproduce the numbers exactly: Franklin's chapter-I slice scores Flesch 52.8, FK 13.0, 28.7 words per sentence; the proprietaries slice 49.6, 14.4, 32.4; the Opus ch01 tiers score FK 12.7/11.3/14.0 with an assembled Flesch of 49.9. It is stronger than stated. Franklin's real syllable rate is 1.47, not 1.40. At that rate, Flesch ≥70 caps sentences at about 12.3 words. Even at 1.0 syllable per word, fastRead's FK ≤7 cannot be met above 27.7 words per sentence. Tier FK findings are `major`, and sG:2939 maps them to blocker; the assembled-ease finding is always a blocker (sG:2963). `majorPolicy.ts:49` E1 is advisory as quoted. |
| RI-5 | PARTIAL | Every cited comment exists and says what the report claims (sG:3045-3063, 2508-2521, 2530-2565, 458-465, 3538-3549, 3710-3714, 3410-3418, 3088-3101, 2966-2990, 3586-3597, 3168-3187, 2181-2199; compilerApplicationPort.ts:935-1075 registry). Only about 7 rows are strict rule → tic → new rule: #1, #2, #3, #5, #7, #8, #12. The others are different: #6 is two rules that cannot both be satisfied; #9 changed only the message; #4, #10 and #11 are false positives fixed by narrowing a rule. Two comments disagree on the tie-back count: 88/114 at sG:2512 and 107/114 at sG:462. |
| RI-6 | PARTIAL | The gates SEC34 (`sourceNameActorPattern` blocks "Franklin decides/," as a scene actor), SEC35, SEC133, SEC137 and SEC31 are real and blocking (sG:3193, 3227, 3239, 3287, 3300). SEC25, however, is only `/\b[A-Z][a-z]+\b/`, so any capitalized word ("The", "Monday") satisfies it. SEC22 checks against the blueprint's count, not a literal 6. The rules "whatToDo = one move" and "whyItMatters ≤2 sentences" come from the writer card (`sectionTasks.ts:122-124`), not from a gate. So the shell is mandated by the card, the blueprint deal and four gates together, not by the gates alone. |
| RI-14 | PARTIAL | This is a design inference, and its evidence is thin. The 7/7 comes from one run on one chapter with errors the same session planted (`plants.txt`). It also raised 1 false flag and cost $0.265 in 41.6 s (envelope-call3). Recall on natural errors (the 19 in source-accuracy.md) has not been measured. Items #4 and #5 do not exist yet. `validateBookPackage` exists as described: 1,335 lines, 2-8 choices (validate-book-package.ts:1015-1018). |

**Missed (most important):** the code states a calibration promise that no longer holds, and no test re-checks it. `pedagogyThresholds.ts:7-9` says the budgets were "chosen so every >=85-composite tracked package passes with zero blockers". sG:3620-3621 says TRANSFER "ships as a blocker (calibrated zero-FP on every >=85 book)". Two later tightenings broke that promise: R-069 made SEC117 count cue words only, and R-070 turned SEC116 into a 20% blocker. Neither was re-run against the catalog. Measured over all 140 catalog books, 1902 of 1903 chapters now fail SEC117 and 1718 fail SEC116. `tests/pedagogy-thresholds.test.ts` never loads `book-packages/`, so the "zero false positives on the reference books" invariant is not enforced anywhere. Any new or tightened rule can silently reject the whole calibration corpus. A fix is a CI test that runs the portable rules over the top catalog books.
