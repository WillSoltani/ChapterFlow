# panel-analytics

## keyFacts
- VERIFIED: The verdict rule is a union across seats. Any single seat's blocking finding becomes a BLOCKER (semanticPanelReviewEvaluator.ts:361-364). The outcome is ERROR if any seat failed, else FAIL if any BLOCKER exists, else PASS (:389-393). A baseline that returns anything but PASS short-circuits and no reader seat runs (:218-222).
- VERIFIED: The median-composite floor is AUTHOR_CHAPTER_BAR=70 (readerReview.ts:163), which raises READER.PANEL.BELOW_FLOOR (semanticPanelReviewEvaluator.ts:328-336). It never fired in run 39a37d06: the lowest chapter median in any panel was 70.7 (P2) and every panel's chapter-median median was 75.8-77.7. Every FAIL came from categorical blockers.
- VERIFIED: The seat prompt makes 'a section that fails its stand-alone promise' a BLOCKING structurally_invalid (src/review/readerExperienceReview.ts:87,99). 65 of 228 reader blockers (28.5%) are this standalone class.
- VERIFIED: The quiz-key BLOCKER already requires a strict majority of seats at high confidence (panelQuizAdjudication.ts:111,118). That is an in-code precedent for 2-of-3 corroboration. No quiz BLOCKER fired in this run.
- VERIFIED: Run 39a37d06 produced 22 canonical reviews: 14 reader panels (13 FAIL, 1 ERROR), 4 baseline-only FAILs (120c5985, ba931fdd, 3406164e, 6ac3f48f) and 4 baseline ERRORs (99059488 MODEL_OUTPUT_INVALID; b1066b7e, adc6eeef, 735da811 weekly-limit 429). Reviews 4625510a, 12251929 and 6eb55d51 belong to run 755fb671.
- VERIFIED: Blockers per panel: 34, 27, 21, 17, 13, 19, 15, 9, 18, 9, 10, 15, 16, then 5 in the partial ERROR panel. Total 228 reader blockers: skeptic 141 (62%), practitioner 44, cold 43. In P12 the skeptic filed 14 of 15.
- VERIFIED: review-35abdd05 read only ch01-ch15. ch16 and ch17 failed with 429 and ch18/ch19 were never dispatched. The '74.3' quoted in the brief is ch01's chapter median. The median across the 15 chapters read is 75.8. The review json stores no book-level composite.
- VERIFIED: The weekly-limit message in the ERROR reviews reads 'resets Sep 22 at 7pm (America/Toronto)'.
- VERIFIED: Chapter-file sha256 changes between candidates match each repair's target list exactly, 15 repairs in all (scratchpad assess/noise.py output).
- VERIFIED: A byte-identical chapter re-read by a later panel drew at least 1 blocker on 43 of 104 re-reads (41%). 43 of 49 byte-identical versions read 2 or more times got a blocker once and none another time. ch08 a32d84b5 was read 7 times and scored 0,0,0,0,0,0,2. Restricted to panels on the same code version the rate is still 41.4% (36/87).
- INFERRED from my classification of the P2-P14 blockers: of 194, 59 (30%) were on unchanged chapter bytes (exact count), 106 (55%) new on repaired chapters, 18 (9%) re-raised, 11 (6%) resurrected. About 90% of targeted blockers never came back in the next panel. The loop is stationary, not converging.
- VERIFIED: ch10 had reader blockers in all 14 panels (25 blockers) and was rewritten in 13 of 15 repairs. Every chapter drew a blocker at some point.
- VERIFIED: Chapter composites and factor medians are flat across the 14 panels. Median chapter composite was about 76 in every panel. The weakest factors were always density and limits (about 69-72), then quizzes (about 72-75).
- INFERRED from measured per-read rates (0.41 on unchanged text, 0.64 on freshly repaired text): P(all 19 chapters clean in one panel) is about 4e-5 to 3e-7. Observed: 0 of 14 panels passed, and no panel had fewer than 6 flagged chapters or 9 blockers. Reaching PASS under the current rule within the remaining 19 of 40 ordinals is effectively impossible.
- INFERRED from semantic matching of all 228 blockers: 17 corroborated issues (2 or more seats, same problem, both BLOCKER) cover 39 blockers; 189 (83%) are single-seat. Corroborated issues per panel: 6,3,1,1,1,2,1,0,1,0,0,0,1,0.
- VERIFIED: The orchestrator log's earlier corroboration counts for P4-P9 were 0,1,0,0,0,0 by exact unit string and 2,1,2,1,2,3 by chapter plus category. My semantic counts are 1,1,2,1,0,1. Exact unit strings undercount because seats spell units differently.
- INFERRED from the recount: under strict option A, 3 of the last 6 panels pass (P10, P11, P12); P9 and P13 fail; P14 stays ERROR because of the 429. P8 would also pass, so the run would have left the review loop at 2026-09-19 21:24.
- INFERRED from a heuristic plus manual scan: under lenient option A (another seat's WARN counts as agreement), only P11 of the last 6 passes. P10 is matched by a cold escalation on ch06 and a practitioner advisory on ch10; P12 by a practitioner pacing advisory on ch12; P8 by two quiz_cue advisories on ch09 Q8.
- VERIFIED: Ground-truth sample of 17 blockers (12 from P12/P13, all 5 from P14): 10 REAL, 5 DEBATABLE, 2 FALSE (P12 ch06 Denham 'cash' misread; P13 ch09 twelve/thirteen virtues). Only 1 of the 10 REAL ones was corroborated (P13 ch10 Card 6 synod).
- VERIFIED: A REAL source distortion was introduced by a repair. ch10 says 'The natural disease carried almost as much risk of death as inoculation did' from review-repair-10 onward and in no earlier candidate. The source (Gutenberg lines 3858-3864) says 'the regret may be the same either way ... therefore, the safer should be chosen'. Panels P9-P13 missed it; one seat flagged it in P14. Option A would downgrade it to WARN.
- VERIFIED: Other REAL single-seat items option A would downgrade: P13 ch17 Card 2 'the fix was ... check that the powder was still dry' vs the Full read 'No amount of careful measuring ... can dry out a rain cloud'; P13 ch07 omits Franklin's return to Keimer before Burlington (source lines 2132-2140); P14 ch12 Example 5 action step about a 'state licensing board' unrelated to its story.
- VERIFIED: Corroborated blockers I checked were real: P1 ch01 Q4/Card 4 counts Abiah (Franklin's mother, source line 197) among the children; P9 ch19 sea-stores (source line 6236 puts the loss during the Philadelphia delay; the Deep read says New York).
- VERIFIED: Baseline review-3406164e's QUIZ_DEFECT BLOCKER is a hallucination. It says ch14 q03 asks about the May 19th 1731 notes and the Free and Easy, but ch14 q03 in review-repair-11 is about the Board of Trade and the Albany plan. That is consistent with repairs 12 and 15 returning REPAIR_OUTPUT_NO_CHANGE.
- VERIFIED: Baseline reviews ba931fdd (ch03 copper coin, Q1 vs Fast read) and 6ac3f48f (ch12 'lottery cash that bought the guns' vs Card rc07 'never bought out of lottery or pledge money') are REAL on-page contradictions.
- VERIFIED: Many 'new' blockers target old text. Flagged passages in P12/P13 ('our little wharf', 'check that the powder was still dry', 'a paid trial for the street', 'refused Sir William Keith's offer', the licensing-board step) were present in the previous candidate, which a panel had read without flagging them.
- VERIFIED: Repair churn creates defects. ch10 'synod' appears 2 times in review-repair-19, 1 time in review-repair-20 (only Card 6, which left it unexplained) and 0 times in review-repair-21.
- VERIFIED: The driver runs with CHAPTERFLOW_REVIEW_REPAIR_ROUNDS=4 (drive-franklin-v7.sh:46; code default MAX_REVIEW_REPAIR_ROUNDS=2 at bookRunApplicationService.ts:436) and CHAPTERFLOW_REVIEW_REPAIR_ORDINALS=40 (driver marker 2026-09-20T03:16; code default 20 at :457). MAX_REVIEW_SUCCESSOR_ORDINALS=3 (:1236) is not a knob.
- VERIFIED: All review seats use one route: claude-cli, claude-sonnet-5, effort xhigh (config/model-routing.json roles.review). The 3 seats differ only in the lens header (laneOrchestrator.ts:142-155; fidelity caveat at :15-25).

## openQuestions
- What does option A mean by 'corroborate'? Must the second seat also file a BLOCKER (strict: 3 of the last 6 panels pass), or does another seat's WARN on the same problem count (lenient: 1 of 6)? It also needs a matching rule. Exact unit strings undercount and chapter+category overcounts, so an implementation would need a semantic or unit-normalised matcher, or a tie-break judge. The owner has to pick the rule before it is coded.
- If single-seat findings become WARNs, does any later lane actually repair them? The QC lane re-emits review WARNs as REVIEW.<code> WARNs (candidateQcEvaluator.ts:417-427), but I did not verify whether fresh-QC repair or the rubric stage acts on them. This decides whether real single-seat defects (the smallpox distortion, the ch17 card, ch12 Example 5) would ship. It could be settled by reading the QC repair-brief builder and CandidateQcEvaluator's source-fidelity routing for READER.ESCALATION.
- Would the source-fidelity judge in fresh-QC catch the repair-introduced ch10 smallpox distortion? It would only if an escalation or claim hint points at that sentence. Not checked. Settle it by inspecting the source-fidelity judge input and the escalations recorded on ch10 in the latest panels.
- After a counterfactual option-A PASS, the next gates are fresh-QC and a whole-book rubric with CHAPTERFLOW_RUBRIC_BAR=80 (drive-franklin-v7.sh:46). Reader-panel chapter medians sit at about 76. I did not verify whether the rubric uses the same scale, which would make the rubric the next wedge. Settle it with src/app/catalogRubricPanelEvaluator.ts and past rubric results.
- Should the seat prompt's 'each standalone' summary rule (readerExperienceReview.ts:87,99) stay a blocking category? It drives 28.5% of blockers. That is a product decision, not a code bug. I did not find a product spec saying fast/deep/full must each stand alone.
- My a/r/c/d classification (re-raised, resurrected, new on repaired text, new on unchanged text) and the corroboration matching are single-analyst semantic judgments. A second independent pass over scratchpad/assess/blockers-all.txt would give an error bar.
- Per-seat composites are not stored in the review json (only medians), so I could not test whether the skeptic seat also scores systematically lower. The reader-lane run attempts or CLI session transcripts under ~/.claude/projects/-Users-radinsoltani-cf-canary-att-* would show it.

## report

## Reader panel and review analytics for run book-run-39a37d06-59c8-430a-87fe-3ad3b19a1c14

All times are UTC. The analysis was read-only. Scratch scripts and extracts are in `/private/tmp/claude-501/-Users-radinsoltani-ChapterFlow/c062400c-9b46-482f-921c-b35b71796a3e/scratchpad/assess/`: `blockers-all.txt` (every panel blocker, grouped by chapter), `noise.py`, `conv.py`, `lenient.py`, `ch.py` (renders a candidate chapter), `events-39a.txt`, and `c*-chNN.txt` (rendered chapters).

### Bottom line
1. **The loop is not converging, and it cannot reach PASS under the current rule.** Repairs do fix what they target: about 90% of targeted blockers never come back in the next panel. But every panel finds a fresh set of 9 to 18 blockers. The flagged text is identical bytes about 30% of the time. The same chapter bytes, read again by the same panel, draw at least one blocker on 41% of re-reads. Chapter composites have not moved, staying at about 76 across all 14 panels. No chapter median ever dropped below the 70 floor, so every FAIL in this run came from categorical blockers. None came from the score floor.
2. **About 83% of blockers are single-seat**: 189 of 228. The skeptic seat filed 141 of 228 blockers (62%), and 73% in the last six complete panels.
3. **Single-seat blockers are mostly real but minor.** They are not mostly hallucinated. In a 17-blocker ground-truth sample: 10 REAL, 5 DEBATABLE, 2 FALSE. Only one of the 10 REAL ones was corroborated by a second seat.
4. **Option A would have let the run move on.** Under a strict reading (a blocker counts only when at least 2 seats raise the same problem as a BLOCKER), 3 of the last 6 panels would have passed. The first would have been P8, around 2026-09-19 21:24. Under a lenient reading (a WARN from another seat also counts as agreement), only 1 of the 6 passes.
5. **What option A would downgrade to WARN includes real defects.** From the sample, 9 of the 10 REAL findings would become WARNs. Among them: a source distortion that a repair introduced ("natural smallpox carried almost as much risk as inoculation"), a review card that teaches a false fix, and a narrative gap about Keimer.

### 1. How the verdict is computed (run checkout 9f0117cb7)
- **Baseline runs first**, as one model call over every chapter plus the pattern audit (`src/app/modelGatewayReviewEvaluator.ts:220-245`). The model itself returns PASS, FAIL or ERROR. Codes are drawn from a closed list (`:28-36`): CONTENT_DEFECT, INTERNAL_CONTRADICTION, STRUCTURAL_DEFECT, QUIZ_DEFECT, PATTERN_AUDIT_DEFECT, PROMPT_INJECTION, OTHER. A PASS that carries a BLOCKER is rejected (`:204`).
- **Anything other than a baseline PASS short-circuits**, and no reader seat runs (`src/app/semanticPanelReviewEvaluator.ts:218-222`). That is why reviews 120c5985, ba931fdd, 3406164e and 6ac3f48f contain only 1 to 3 baseline issues.
- **Panel**: each chapter is read by 3 blind seats (cold, skeptic, practitioner), all on the same route: claude-sonnet-5 at effort xhigh (`config/model-routing.json` roles.review). The seats are defined at `src/review/laneOrchestrator.ts:142-155`.
  - The composite is the median of the three seat composites (`laneOrchestrator.ts:421,439`).
  - Findings are a union across seats (`laneOrchestrator.ts:425-429`).
- **Rules that produce a BLOCKER**:
  - Median composite below `AUTHOR_CHAPTER_BAR = 70` (`src/review/readerReview.ts:163`) produces READER.PANEL.BELOW_FLOOR (`semanticPanelReviewEvaluator.ts:328-336`). This never fired in this run.
  - Any single seat's blocking finding, from any seat, produces `READER.BLOCKING.<category>` at severity BLOCKER (`:361-364`). The comment on that line reads "ANY seat's ... blocking finding blocks (union, fail-closed)".
  - The blocking categories are unsafe, internal_contradiction, structurally_invalid, schema_or_app_breaking and unusable (`src/contracts/readerExperienceReview.ts:32`). The seat prompt makes "a section that fails its stand-alone promise" a blocker, and says the "summaries: fast/deep/full reads ... each standalone" (`src/review/readerExperienceReview.ts:87,99`). That rule alone accounts for 65 of 228 blockers (28.5%).
  - Quiz key: a BLOCKER only when a strict majority of seats derive the same non-key answer and every one of them is at high confidence (`src/review/panelQuizAdjudication.ts:111,118`). Any weaker disagreement is a WARN (QUIZ_DERIVATION_SPLIT). No quiz BLOCKER fired in this run. This rule is already a 2-of-3 corroboration rule, so the code base has a precedent for option A.
  - Advisories, escalations and FACTOR_SCORES are WARNs (`:360,365-378`).
- **Outcome**: ERROR if any seat failed. Otherwise FAIL if any BLOCKER exists. Otherwise PASS (`:389-393`, doc comment `:56-59`). A seat that fails on quota makes the whole review ERROR, with a SEMANTIC_PANEL_READER_FAILED BLOCKER (`:314-321`).
- **Loop limits**: the review-repair loop runs only while the outcome is FAIL (`src/app/bookRunApplicationService.ts:2999`). The per-invocation cap is `CHAPTERFLOW_REVIEW_REPAIR_ROUNDS`, default 2 (`:436`); the driver sets it to 4 (`drive-franklin-v7.sh:46`). The ordinal budget is `CHAPTERFLOW_REVIEW_REPAIR_ORDINALS`, default 20 (`:457`); the run set 40 (driver marker at 2026-09-20 03:16). `MAX_REVIEW_SUCCESSOR_ORDINALS = 3` (`:1236`).

### 2. Every canonical review of this run
The first three Franklin reviews dated 09-18 (4625510a, 12251929, 6eb55d51) belong to the earlier run book-run-755fb671, going by events-log runIds. They are excluded.

| # | Review | When | Outcome | Candidate | Blockers (cold/skeptic/practitioner), or baseline code | Chapters hit | Chapter composite min/median/max |
|---|---|---|---|---|---|---|---|
| P1 | 06d7596a | 09-19 05:59 | FAIL | compiler-operator-retry-13 | 34 (8/18/8); IC22 SI12 | 16 | 72.2/76.4/79.3 |
| P2 | 87c9dc3c | 07:56 | FAIL | review-repair-1 | 27 (8/11/8); IC15 SI10 unsafe2 | 12 | 70.7/76.5/80.9 |
| P3 | 37df51a2 | 09:43 | FAIL | review-repair-2 | 21 (2/13/6) | 14 | 71.2/76.7/82.1 |
| – | 99059488 | 10:30 | ERROR | review-repair-3 | baseline MODEL_OUTPUT_INVALID | – | – |
| P4 | ec0e30a8 | 11:21 | FAIL | review-repair-3 | 17 (4/11/2); includes schema_or_app_breaking (card-back indentation) | 11 | 72.1/75.9/82.1 |
| P5 | 4a2acca7 | 12:58 | FAIL, cap 4/4 | review-repair-4 | 13 (2/10/1) | 9 | 74.4/76.3/81.2 |
| P6 | 8aeae974 | 14:31 | FAIL | review-repair-5 | 19 (4/11/4) | 13 | 74.3/76.9/81.6 |
| – | 120c5985 | 15:23 | FAIL | review-repair-6 | baseline PATTERN_AUDIT_DEFECT (planSpec metadata); repair refused it as UNSCOPED 4 times | – | – |
| P7 | 5ebfffd3 | 19:42 | FAIL | review-repair-6 | 15 (3/9/3) | 10 | 73.1/76.4/81.0 |
| P8 | 1720d489 | 21:24 | FAIL | review-repair-7 | 9 (2/6/1) | 6 | 72.2/77.7/81.6 |
| – | ba931fdd | 09-20 00:14 | FAIL | review-repair-10 | baseline INTERNAL_CONTRADICTION ch03 (copper coin) | 1 | – |
| – | 3406164e | 00:22 | FAIL | review-repair-11 | baseline QUIZ_DEFECT ch14 q03 | 1 | – |
| – | 6ac3f48f | 03:23 | FAIL | review-repair-11 (disputed successor) | baseline INTERNAL_CONTRADICTION ch12 (lottery vs cannon) | 1 | – |
| P9 | 9827ee52 | 04:27 | FAIL | review-repair-16 | 18 (2/11/5) | 10 | 74.1/77.1/79.7 |
| P10 | 585058c1 | 06:05 | FAIL | review-repair-17 | 9 (0/8/1) | 7 | 72.6/76.0/79.5 |
| P11 | 1ca523b6 | 07:30 | FAIL, cap 4/4 | review-repair-18 | 10 (2/7/1) | 9 | 73.2/76.5/80.2 |
| P12 | 052e2b67 | 11:33 | FAIL | review-repair-19 | 15 (1/14/0) | 12 | 73.2/76.8/79.7 |
| P13 | ba9e7444 | 13:24 | FAIL | review-repair-20 | 16 (3/10/3) | 10 | 73.7/76.5/82.5 |
| P14 | 35abdd05 | 14:57 | ERROR | review-repair-21 | 5 (2/2/1) plus 2 SEMANTIC_PANEL_READER_FAILED (ch16, ch17, weekly-limit 429); ch18 and ch19 never dispatched | 7 | 73.2/75.8/81.0 (15 chapters) |
| – | b1066b7e, adc6eeef, 735da811 | 14:57:39, :47, :53 | ERROR | review-repair-21, successors 1-3 | REVIEW_EVALUATOR_ERROR, 429 "weekly limit · resets Sep 22 at 7pm (America/Toronto)" | – | – |

Totals across the 14 panels: 228 reader blockers. By category: internal_contradiction 136, structurally_invalid 84, unsafe 5, schema_or_app_breaking 2, unusable 1. By seat: skeptic 141, practitioner 44, cold 43.

**Factor medians** (mean across chapters of each chapter's factor medians) are flat in every panel. The weakest factors are always density and limits (about 69 to 72), then quizzes (about 72 to 75). The strongest is transfer or insight (about 82 to 83).

**The "74.3" number.** The run brief quotes 74.3 as the median composite for review-35abdd05. That is ch01's chapter median. The median across the 15 chapters that were read is 75.8. The review json holds no book-level composite.

### 3. Corroboration (semantic matching, same chapter and same underlying problem)
| Panel | Blockers | Corroborated issues (at least 2 seats as BLOCKER) | Blockers covered | Single-seat blockers |
|---|---|---|---|---|
| P1 | 34 | 6: ch01 Abiah counted as a child (cold+prac, **REAL**, checked against the source); ch10 Q8; ch17 rum attribution; ch18 "never replied to Nollet"; ch18 Nollet authorship (all 3 seats); ch19 "Denny's offer" in the Full read | 14 | 20 |
| P2 | 27 | 3: ch10 Full read not standalone; ch16 Ex6 silent fix; ch18 "two other men" vs Fothergill (all 3 seats) | 8 | 19 |
| P3 | 21 | 1: ch01 "two grandparents" | 2 | 19 |
| P4 | 17 | 1: ch04 Q3 Vernon. One more only on a loose reading: ch06 Basket letter | 2 | 15 |
| P5 | 13 | 1: ch19 Q3 "dated follow-up" | 2 | 11 |
| P6 | 19 | 2: ch05 Fast read omits threads; ch18 Full read "late confirmation" / Canton (borderline match) | 4 | 15 |
| P7 | 15 | 1: ch10 "one-third of expenses". The reviewers called this term invented, but it is in the source: "paying one-third of the expense" | 2 | 13 |
| P8 | 9 | 0 | 0 | 9 |
| P9 | 18 | 1: ch19 sea-stores Philadelphia vs New York (all 3 seats; REAL: the source puts the loss in Philadelphia) | 3 | 15 |
| P10 | 9 | 0 | 0 | 9 |
| P11 | 10 | 0 | 0 | 10 |
| P12 | 15 | 0 | 0 | 15 |
| P13 | 16 | 1: ch10 Card 6 "1734's synod fight" (skep+prac, REAL) | 2 | 14 |
| P14 | 5 | 0 | 0 | 5 |

Across all panels: 17 corroborated issues covering 39 blockers, and 189 single-seat blockers (83%).

The orchestrator's earlier counts for P4 to P9 differ from mine because they used a different method:
- Exact unit-string matching gave 0,1,0,0,0,0. That undercounts, because seats spell units differently ("Quiz Q3 vs Fast read" against "quiz Q3 vs. Fast read").
- Chapter-plus-category matching gave 2,1,2,1,2,3. That overcounts, because it pairs different problems that share a category.
- My semantic judgment gives 1,1,2,1,0,1.

### 4. Reviewer variance on identical text
I hashed all 19 chapter files for every candidate.
- The chapters that changed between candidates match each repair's target list exactly.
- There were 262 chapter-reads, and 144 of them (55%) drew at least one blocker.
- **First read of a new byte version**: 101 of 158 drew a blocker (64%).
- **Re-read of a byte version that an earlier panel had already read**: 43 of 104 drew a blocker (41%). Every earlier read of those versions had drawn zero blockers, because a flagged version is always repaired.
- Of the 49 byte-identical versions read at least twice, 43 got a blocker on one read and none on another.
  - Examples: ch08 a32d84b5 was read 7 times (P6 to P12) and scored 0,0,0,0,0,0 then 2. The same 6-zeros-then-a-blocker pattern holds for ch11 bf71c655, ch13 3413c85a, ch15 04a2c3aa and ch16 d346f9b4.
- The card-back renderer changed between P8 and P9 (PR #573). Restricting the comparison to panels that ran on the same code version gives the same re-read rate: 36 of 87, or 41.4%.

### 5. Convergence model, one row per round
Each blocker in panel N+1 is classified as one of:
- **a**: re-raised. Same problem as in panel N.
- **r**: resurrected. Same problem as in an earlier panel, but not panel N.
- **c**: new, on a chapter that was just repaired.
- **d**: new, on a chapter whose bytes did not change.

| Round | Blockers in N | Re-raised next round | Fixed | Blockers in N+1 | a | r | c | d |
|---|---|---|---|---|---|---|---|---|
| P1→P2 | 34 | 3 | 31 | 27 | 6 | 0 | 20 | 1 |
| P2→P3 | 27 | 2 | 25 | 21 | 2 | 2 | 9 | 8 |
| P3→P4 | 21 | 1 | 20 | 17 | 1 | 0 | 10 | 6 |
| P4→P5 | 17 | 0 | 17 | 13 | 0 | 1 | 7 | 5 |
| P5→P6 | 13 | 0 | 13 | 19 | 0 | 2 | 10 | 7 |
| P6→P7 | 19 | 3 | 16 | 15 | 2 | 1 | 11 | 1 |
| P7→P8 | 15 | 0 | 15 | 9 | 0 | 1 | 8 | 0 |
| P8→P9 | 9 | 2 | 7 | 18 | 5 | 1 | 5 | 7 |
| P9→P10 | 18 | 1 | 17 | 9 | 1 | 0 | 4 | 4 |
| P10→P11 | 9 | 0 | 9 | 10 | 0 | 0 | 2 | 8 |
| P11→P12 | 10 | 0 | 10 | 15 | 0 | 1 | 8 | 6 |
| P12→P13 | 15 | 1 | 14 | 16 | 1 | 2 | 10 | 3 |
| P13→P14 | 16 | 0 | 13 (3 on ch16/17, not read) | 5 (partial) | 0 | 0 | 2 | 3 |

**Sum over P2 to P14**: 194 blockers. Re-raised 18 (9%), resurrected 11 (6%), new on repaired chapters 106 (55%), new on unchanged text 59 (30%). The last two columns (d and the chapter-level counts in `conv.py`) are exact. The a, r and c split is my judgment.

**Many "new on a repaired chapter" blockers are old text.** I spot-checked flagged passages from P12 and P13 against the candidate before. These passages were already present and had been read without being flagged: "our little wharf" (repair-18/19), the Card 2 "check that the powder was still dry" (repair-18/19), the ch12 licensing-board step (repair-20), "a paid trial for the street" and "refused Sir William Keith's offer" (repair-18). The per-read recall is low, so each panel samples a different part of a large pool of defects.

**Repairs also introduce defects**:
- ch10 "The natural disease carried almost as much risk of death as inoculation did" first appears in review-repair-10. It is absent from every earlier candidate. It survived five panels (P9 to P13) before one seat flagged it in P14.
- ch10 "synod": repair-20 dropped the synod context from the Deep read, which left Card 6 unexplained.

**Recurring issues**:
- ch10 has blockers in 14 of 14 panels (25 blockers in total) and was repaired in 13 of 15 repairs.
- Every chapter drew a blocker at some point. ch19 had 20 blockers, ch05 18, ch01 17, ch18 16.
- Issues that were resurrected after an earlier repair:
  - ch03 copper coin: P1, P3, then baseline ba931fdd
  - ch18 Nollet authorship: P1, P3
  - ch09 Free and Easy: P1, P12
  - ch09 twelve vs thirteen virtues: P1, P11, P13
  - ch05 Miss Read as a "test": P4, P7, P11
  - ch19 Denny's dinner in the Full read: P1, P6, P12
  - ch17 wet powder described as preventable: P7, P13
  - ch06 debt-revival safety: P7, P10
  - card-back indentation: P4, P8. Repair-8 failed on it with REPAIR_OUTPUT_NO_CHANGE ch6, because the defect is in the renderer, not the content.

**Outlook under the current rule.** Assume a 41% blocker chance per re-read and 64% per freshly repaired chapter. Then the chance that all 19 chapters come back clean in one panel is about 0.59^19 ≈ 4e-5 if nothing were repaired. With about 10 chapters freshly repaired per round it is about 3e-7. The observed record is 0 passes in 14 panels, and never fewer than 6 flagged chapters or 9 blockers in a panel. **A PASS within the remaining 19 ordinals is effectively impossible under the current rule.** Blocker totals ran 34, 27, 21, 17, 13, then held around a mean of 13.9 for P6 to P13 without trending down.

### 6. Ground-truth sample
- **P12** (052e2b67) judged review-repair-19.
- **P13** (ba9e7444) judged review-repair-20.
- **P14** (35abdd05) judged review-repair-21.

| # | Blocker | Verdict | Evidence |
|---|---|---|---|
| 1 | P12 ch04 skep: Ex4 says the father refused Keith's self-funding offer | REAL (minor) | Ex4 WHY: "Franklin's father refused Sir William Keith's offer to bankroll a print shop ... one hundred pounds ... outfitting the shop himself". Deep read: "After Franklin's father said no, Keith made a bigger claim". Source line 1288: "will not set you up ... I will do it myself" |
| 2 | P12 ch06 skep: Denham paid "cash under the plate" vs a banker's order | **FALSE** | The Full read says "slipping the payment under each man's plate", not cash. Source lines 1899-1900: "found under his plate an order on a banker". The two passages are consistent |
| 3 | P12 ch08 skep: Full read not standalone ("currency fight", Junto undefined) | DEBATABLE | The Full read narrates the fight itself. Only the club name goes undefined. This is a product-design rule, not a defect a reader would stumble on |
| 4 | P12 ch09 skep: Hook says the May 19 1731 notes named the "Free and Easy"; Full read says "United Party for Virtue" | REAL (minor) | Source lines 3423-3451: the May 19 paper describes the United Party. The "Free and Easy" name comes later (line 3497). The Hook conflates the two |
| 5 | P12 ch10 skep: Key-takeaway list of four vs the Full read's closing list of four | DEBATABLE | Full read: "An almanac, a chess set, a club roster, and a borrowed book". Loose wording, not a contradiction |
| 6 | P12 ch13 skep: "a paid trial for the street" called a funding method | REAL (minor) | In the body, the trial only produced a cost number for a London proposal. The Philadelphia street was funded by subscription, then a tax |
| 7 | P13 ch01 cold: "our little wharf" inside third-person narration | REAL (cosmetic) | Appears in tryThisNow and the core skill. Source line 289: "our little wharf" is Franklin's own first person. A copy-edit slip, not a contradiction |
| 8 | P13 ch07 skep: quit Keimer, then did the Burlington job "for him" | REAL | The chapter omits Keimer's plea and Franklin's return (source lines 2132-2140). The same bytes were read 3 times clean (P10 to P12). P9 had flagged the same gap |
| 9 | P13 ch09 skep: twelve virtues vs a notebook of thirteen | **FALSE** | The Fast read says twelve at first, then Humility makes thirteen. The Deep read describes the finished notebook. Consistent with source line 3362 |
| 10 | P13 ch10 skep+prac (corroborated): Card 6 "1734's synod fight" is unexplained | REAL | "synod" appears only in Card 6 of repair-20. Repair-20 removed the Deep-read context that repair-19 still had |
| 11 | P13 ch16 skep: Q5 is not forced by the prose | DEBATABLE | No QUIZ_DERIVATION_SPLIT was emitted for ch16 q05, so all 3 seats, the flagging seat included, derived the stored key (`panelQuizAdjudication.ts:99`) |
| 12 | P13 ch17 cold: Card 2 gives a fix; the Full read says the loss could not be prevented | REAL | Card 2: "the fix was ... check that the powder was still dry". Full read: "No amount of careful measuring ... can dry out a rain cloud". Source lines 5740-5742 |
| 13 | P14 ch04 cold: Hook blames the display of silver; Deep read blames the "piece of eight" peace offering | DEBATABLE | In the source (lines 1118-1139) both happened in the same visit. The Deep read's "peace offering" motive is not in the source |
| 14 | P14 ch08 cold: Fast read omits the library thread that the Key takeaway centers on | REAL (by the seat prompt's own standalone rule) | The Fast read has no library, Brockden or book pool. Key takeaway: "...let the library outlast the Junto's failed book pool" |
| 15 | P14 ch10 skep: smallpox reasoning undermines itself | **REAL, and a source distortion** | Chapter: "The natural disease carried almost as much risk of death as inoculation did". Source lines 3858-3864: "the regret may be the same either way ... therefore, the safer should be chosen". Introduced by repair-10 |
| 16 | P14 ch12 prac: Example 5's action step is unrelated | REAL | Story: speaking up at a microphone. WHATTODO: "name the state licensing board" |
| 17 | P14 ch15 skep: "Franklin skipped the fight" vs combative replies | DEBATABLE | The Key takeaway is about one veto that he got around with Loan-Office orders. The Deep read covers the wider quarrel |

**Sample tally**: 10 REAL, 5 DEBATABLE, 2 FALSE. Among the single-seat blockers alone: 9 REAL, 5 DEBATABLE, 2 FALSE out of 16. Most REAL items are minor to moderate. One is a meaningful factual distortion (#15).

**Baseline-only FAILs**:
- ba931fdd (ch03 copper coin) is **REAL**.
- 6ac3f48f (ch12: the Full read says "lottery cash that bought the guns"; Card rc07 says cannon were "never bought out of lottery or pledge money") is **REAL**.
- 3406164e is **FALSE**, a hallucination. ch14 q03 in review-repair-11 is about the Board of Trade and the Albany plan and never mentions 1731 or the Free and Easy. That explains why repairs 12 and 15 returned REPAIR_OUTPUT_NO_CHANGE.
- 120c5985 flagged only planSpec metadata that readers never see (`modelGatewayReviewEvaluator.ts:91-115`, R-287).

### 7. Option A recount
Option A, as the orchestrator log put it: a blocker counts only when at least 2 of 3 seats corroborate it; a single-seat finding becomes a WARN; baseline, median floor, QC, judges and rubric stay unchanged.

**Last 6 panels (P9 to P14), strict reading** (the second seat must also have filed a BLOCKER on the same problem):

| Panel | Result | Reason |
|---|---|---|
| P9 | FAIL | ch19 sea-stores |
| P10 | **PASS** | no corroborated blocker |
| P11 | **PASS** | no corroborated blocker |
| P12 | **PASS** | no corroborated blocker |
| P13 | FAIL | ch10 Card 6 synod |
| P14 | ERROR | the 429 still makes it ERROR; 0 corroborated blockers in the 15 chapters that were read |

That is **3 of 6 passing**. Across the whole run, P8 would also pass, so 4 of 14. Chronologically the run would have left the review loop at P8 (2026-09-19 21:24) for fresh-QC. Every earlier panel fails under option A too (P1 has 6 corroborated issues, P2 has 3).

**Lenient reading** (another seat's WARN on the same problem also counts):
- P10 fails. The ch06 debt-revival unsafe blocker is matched by a seat-cold escalation, and the ch10 "three related moves" blocker is matched by a practitioner advisory.
- P12 fails. The ch12 Full-read standalone blocker is matched by a practitioner pacing advisory.
- P8 fails. The ch09 Q8 blocker is matched by quiz_cue advisories from two seats.
- Only P11 passes, so **1 of 6**. I checked this with token-overlap search plus manual reading, not exhaustively.

**What option A would downgrade to WARN that is REAL**, taken from the sample: items 1, 4, 6, 7, 8, 12, 14, 15 and 16. That includes the smallpox source distortion (#15), a Card that teaches a fix the chapter says is impossible (#12), the missing re-engagement with Keimer (#8), and an unrelated action step (#16). Of the corroborated blockers I checked, all were REAL: ch01 Abiah, ch19 sea-stores, ch10 synod. The P7 ch10 case is corroborated and the on-page inconsistency is real, but its "invented" claim is wrong. The code does keep review WARNs: the QC lane re-emits them as `REVIEW.<code>` WARNs (`src/app/candidateQcEvaluator.ts:417-427`). Whether any later lane repairs such a WARN is UNVERIFIED.

### 8. Caveats
- The a, r and c classification and the corroboration matching are my own semantic judgment.
- The lenient-corroboration check was heuristic.
- The PASS-probability numbers assume chapters are independent.
- Seat-level composites are not stored; only medians are.