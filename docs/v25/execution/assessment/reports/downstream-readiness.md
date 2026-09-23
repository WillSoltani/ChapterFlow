# downstream-readiness

## keyFacts
- VERIFIED: No fresh-qc, QC-lane repair, rubric or promotion event exists after 2026-08-28. The last fresh-qc event is 2026-08-28T05:39:34Z and the last promotion is 2026-08-28T06:30:08Z (run d7e690f9). The 'rubric' phase never appears in either book-run-events file (phase counts via node over ~/cf-canary/book-run-events/*.jsonl).
- VERIFIED: The rubric gate (#542, 73876ddf8, 2026-09-03) and the source-fidelity judge (#544, 374189ede, 2026-09-04) were merged after the last downstream execution, so neither has ever run live. The last pipeline-root judge CLI transcripts are dated Aug 28 (~/.claude/projects/-Users-radinsoltani-ChapterFlow-books-v25-completion-scripts-book-prompts-chapterflow-v24-author-pipeline).
- VERIFIED: A deterministic-only replay of CandidateQcEvaluator (no runner, no writes, on a byte copy) of review-repair-21-candidate-06d7596afd1f14dccd3eb2df99b22db6 gives 'outcome FAIL issues 212 blockers 33': 19 BP15, 4 SC11.2, 3 SC11.7, 3 B1, 2 EI1, 1 EI2, 1 F4 (scratchpad/assess/downstream/detqc.out).
- VERIFIED: The same replay gives FAIL with 22 blockers on the compile candidate (17 BP15) and FAIL with 29 on review-repair-10. The fresh-QC gate stack fails even the unrepaired compile output.
- VERIFIED: F4 ('rather than' 24 times, budget 15) is emitted with no path or chapters (critics/bookGate.ts:828-833), so it gets no location (candidateQcEvaluator.ts:627). The QC-repair preflight refuses any location-less blocker with REPAIR_FINDING_UNSCOPED before creating a run (candidateRepairApplicationPort.ts:342-343, 1122-1123). The test v4-candidate-repair-application-port.test.ts:146 pins this refusal.
- INFERRED (from the immutable round keyed derivedId('qc', runId), bookRunApplicationService.ts:3360): an F4 scoping fix must land before this run commits its fresh-QC round. Otherwise the stored location-less F4 keeps the QC-repair lane wedged.
- VERIFIED: Compile and QC enforce different gates. The compile section gate SEC52 has a prose carve-out for absolute words (sections/sectionGate.ts:3353-3366); the QC BP15 rule (critics/quizQuality.ts:37) does not. In the v25 path, runChapterGateCompositeFromCandidate is called only by candidateQcEvaluator.
- VERIFIED: A QC-repair ordinal needs the successor's full canonical review to PASS on its first verdict. Any FAIL returns REPAIR_REVIEW_FAILED and spends the ordinal (contentRepairWorkflow.ts:259-264). Of the 25 stored reviews completed since 2026-09-18, 20 are FAIL, 5 are ERROR and 0 are PASS.
- VERIFIED: The driver hardcodes CHAPTERFLOW_QC_REPAIR_RUNS=4 and CHAPTERFLOW_REVIEW_REPAIR_ROUNDS=4 inline (drive-franklin-v7.sh:46,54). autoresume.sh forwards only REVIEW_REPAIR_ROUNDS, OPERATOR_COMPILE_RETRIES and CAPTURE_INVALID_OUTPUT (autoresume.sh:33-52,122-125). REVIEW_REPAIR_ORDINALS, QC_JUDGE_RUNS and RUBRIC_RUNS are not forwarded.
- VERIFIED: A fresh-QC judge failure, including a 429, returns an evaluation error with no round committed (candidateQcEvaluator.ts:710-722, 889-904). The judge run is finished FAILED with reason = error code only (bookRunApplicationService.ts:2254-2269), and the next resume walks to a fresh ordinal (2180-2230). The default budget is 5 (MAX_QC_JUDGE_RUNS, :307; CHAPTERFLOW_QC_JUDGE_RUNS 1-10).
- VERIFIED: On a provider block the rubric reader fails fast (catalogRubricPanelEvaluator.ts:282). The rubric run is finished FAILED (bookRunApplicationService.ts:2468-2487) and the next resume takes the next ordinal. The default budget is 3 (MAX_RUBRIC_RUNS, :293; CHAPTERFLOW_RUBRIC_RUNS 1-10). Readers already scored are not persisted.
- VERIFIED: The QC-repair lane's successor QC judge (bookRunComposition.ts:617-690) uses a fixed run id '${roundId}-judge' with no successor walk and no reconcile step. createRun is idempotent (run-state/fileRunStore.ts:393-407), so reused attempt ids collide (runtime/modelGateway.ts:585). No test references REPAIR_QC_JUDGE_UNAVAILABLE.
- VERIFIED: In the QC-repair lane, a 429 during chapter repair gives REPAIR_MODEL_FAILED (candidateRepairApplicationPort.ts:1492-1495). That is not forgivable: only review-ERROR reasons are (contentRepairWorkflow.ts:125-136; MAX_FORGIVEN_INFRA_ORDINALS=2, bookRunApplicationService.ts:422).
- INFERRED (from the driver loop and the budget walks above): under a quota 429, every downstream lane (fresh-QC judge, rubric, QC-repair) burns one bounded ordinal per driver round in seconds. This is the same class as defect #20.
- VERIFIED: The driver's PROVIDER BLOCK detector cannot see current 429s. The durable stdoutHead is capped at 400 chars (modelGateway.ts:384), and the 09-20 successor attempt records (e.g. review-run-b1066b7e…/attempts.jsonl) contain neither 'weekly limit' nor '429' because the current CLI envelope puts 'result' after 'usage'. The Aug-18 records had 'result' early.
- VERIFIED: The round logs fv8h-r1..r3.log contain no provider text. Their only '429' matches are the sha 'a0429724d', and the last line is 'BOOK_RUN_REVIEW_FAILED:canonical review outcome=ERROR'. The 429 text exists only in the stored review JSON (review-35abdd05 ch16/ch17 SEMANTIC_PANEL_READER_FAILED … weekly limit … api_error_status=429).
- VERIFIED: The driver's provider_block function reads the tail of the concatenated runs/*/attempts.jsonl (drive-franklin-v7.sh:38-40,43). New lines in a run directory that sorts early are never examined.
- VERIFIED: The rubric gate requires composite >=80, every factor median >=70, churn not HIGH, and a unanimous correctness-gate PASS; a SPLIT fails closed (review/catalogRubric.ts:627-690). A stored record replays forever for the candidate (bookRunApplicationService.ts:2330-2359). No SPLIT adjudication path or rubric repair lane exists (grep).
- VERIFIED: Over the last 4 panels, the median chapter composite is 75.8-76.8 and the weakest factor medians are limits (66-72) and density (68-71). The 74.3 figure is ch01 in review-35abdd05, not the book median.
- VERIFIED: The rubric's md5-seeded sample for this 19-chapter book is chapters 1, 7, 13 and 19. On the per-chapter panel these score 73.2-78.5, with limits at 61-66 and density at 62-73.
- VERIFIED: Phase A report (docs/v25/S_TIER_PHASE_A_REPORT_2026-09-02.md:7-21): on the same rev-6 bytes the pipeline per-chapter panel gave 75.4-79.7, while the catalog instrument with 6 fresh readers gave composite 64.6, gate FAIL 0/6, churn HIGH. In the catalog baseline (docs/book-score/baseline-2026-06-30.json), 67 of 97 gate-PASS books reach >=80.
- INFERRED (from the four facts above): a rubric PASS at bar 80 is unlikely for the current candidate, and the factor floor (limits, density) is the most likely reason. A FAIL is final for the candidate.
- VERIFIED: The current candidate has 171 quiz questions (9 x 19) and 19 source-fidelity calls (every span is 4,628-33,513 chars, under the 45,000-char chunk size). That is 190 sequential qc-role xhigh calls, with run capacity 380 (bookRunApplicationService.ts:922-964).
- VERIFIED: Timing baselines at xhigh on this book: reader seats p50 226-234 s and p90 324-335 s (reader-lane-run-faea7e76/6c2ad278); baseline whole-book review 285-407 s; chapter repair p50 212-263 s. The only pre-09-02 quiz-judge data is 36 calls with median 11 s, no source span attached (qc-judge-run-88b631ed).
- INFERRED (from the timing baselines): fresh QC takes about 3-7 h sequentially; one QC-repair ordinal takes about 5-9 h (~263 calls); the rubric takes 10-25 min (3 calls); promotion and release make 0 model calls.
- VERIFIED: 1,639 model attempts finished between the run start (2026-09-18T12:33Z) and the weekly-limit 429 on 2026-09-20. By day: 230 on 09-18, 870 on 09-19, 539 on 09-20.
- VERIFIED: The CI job 'v21 Pipeline Typecheck + Tests' (.github/workflows/ci.yml:157-189) runs the root scripts pipeline:typecheck and pipeline:test, which target @chapterflow/v21-authored (root package.json:32-33), not v24-author-pipeline.
- VERIFIED: The downstream tests are hermetic. v4-catalog-rubric-stage has 22 cases and drives BookRunApplicationService with a scripted panel; v4-fresh-qc-promotion-e2e has 8, v4-qc-fail-repair-successor 21, v4-source-fidelity-judge 18 and -qc-wiring 19. None tests a provider block burning ordinals across resumes for the judge, rubric or QC-repair lanes.
- VERIFIED: The candidate release in promote-book refuses only on book-gate blockers (release/candidateReleaseGate.ts) and records the rubric as evidence only (cli.ts:2485-2536). It does not enforce the rubric verdict.
- VERIFIED: cli.ts:564 tells the operator the release 'advances the pointer one more revision'. The printed command actually resumes the pointer-committed journal record at the same revision (bookRunApplicationService.ts:692-742, --expected-book-revision bookRevision-1). It also carries placeholder categories and tags.
- VERIFIED: current.json is at revision 6, and run 39a37d06 recorded expectedBookRevision=6 at intake, so promotion would move the pointer from 6 to 7.
- VERIFIED: score-franklin-v7.js reads 0-based chapters [0,1,2,3] and calls the book a 4-chapter book (lines 36-41, 139). It is a Workflow script that needs the v21 package produced only by the owner's promote-book. No journal shows it has ever run.
- VERIFIED: The driver has never reached '*** SUCCEEDED ***' (0 matches in franklin-v7b-driver.out). The launchd autoresume agent is loaded and idle on the last marker 'WEDGE STOP: three identical terminal lines'; there is no PAUSE file.
- VERIFIED: History: all 5 initial fresh-QC rounds (08-21 to 08-27) FAILed with 22-96 deterministic blockers (B5, SC11, BP15). The QC-repair lane converged twice (repair-qc-467de279 PASS 08-22; repair-r7 PASS 08-28, after operator qc-diagnose), both on 4-chapter books.

## openQuestions
- How fast are the qc-role xhigh quiz-key and source-fidelity calls with the source span attached, and do they spend their output budget on thinking? There is no post-09-02 live data. An owner-approved probe of one chapter (~10 calls) on a candidate copy with a scratch run-state root would settle it.
- What composite would the in-pipeline rubric (sonnet-5, xhigh) actually give this candidate? Only a live 3-call panel settles it. It is also unknown which model class produced the Phase A fresh readers, and so whether the ~11-point gap between the two instruments transfers.
- When the fresh-QC judge or the rubric fails, what exact terminal line does the driver see? That decides whether a 429 episode burns 3 or all 5 judge ordinals (and 3 of 3 rubric runs). A hermetic replay with a fake runner that returns a quota error would settle it.
- Will the candidate that finally PASSes review still trip F4? The count grows with repairs: 15 or fewer on the compile candidate, 19 on repair-10, 24 on repair-21. Re-running detqc.mts on each new candidate settles it at zero cost.
- Are the EI1/EI2 testimonial blockers ('Xenophon', 'Franklin') on a memoir fixable by the repair writer (for example by using full names), or are they a false-positive wall? Only a QC-repair attempt, or reading the EI detector rules, settles it.
- Does the owner want the compile and QC gates aligned by moving the deterministic QC check earlier, or by giving BP15 the same prose carve-out as SEC52 (which loosens the gate)? This is an owner decision under the non-negotiables.
- What should RUBRIC_BELOW_BAR or RUBRIC_GATE_SPLIT mean for the owner's mandate to 'return the output for evaluation'? Deliver the scorecard and the candidate, or keep iterating? Needs an owner decision before the run spends further.
- Would a crash (rather than a 429) during the QC-repair successor judge recover through the a2 retry, or does it always lose the ordinal? This depends on how many questions had already used both attempts. No test covers it; a hermetic crash-injection test would settle it.

## report

## Downstream readiness: from canonical review PASS to promotion, release and scoring

Checkout inspected: `~/ChapterFlow-books-v25-completion` at `9f0117cb7`, detached. Pipeline package: `scripts/book/prompts/chapterflow-v24-author-pipeline`. All file:line references below are in that package unless another path is given. Nothing was modified.

I ran one extra check, with no model calls. It re-ran the deterministic half of fresh QC against byte copies of three candidates. The script and its outputs are in `/private/tmp/claude-501/-Users-radinsoltani-ChapterFlow/c062400c-9b46-482f-921c-b35b71796a3e/scratchpad/assess/downstream/` (`detqc.mts`, `detqc*.out`, `downstream-events.txt`, `durs.js`).

### 1. Bottom line
- **None of the downstream stages has run on post-09-02 code.** From the events log:
  - The last `fresh-qc` event is 2026-08-28T05:39:34Z.
  - The last `promotion` event is 2026-08-28T06:30:08Z (run d7e690f9).
  - The `rubric` phase has never appeared in either events file.
  - The rubric gate (#542, 09-03) and the source-fidelity judge (#544, 09-04) were merged after that last run, so neither has ever executed live.
- **Even if the review PASSes today, fresh QC will FAIL, and the QC-repair lane will refuse at zero cost.**
  - The deterministic replay on the current candidate (`review-repair-21-candidate-06d7…`) gives FAIL with **33 BLOCKERs**:

    | Code | Count |
    |---|---|
    | BP15 | 19 |
    | SC11.2 | 4 |
    | SC11.7 | 3 |
    | B1 | 3 |
    | EI1 | 2 |
    | EI2 | 1 |
    | F4 | 1 |

  - That count is before the two model judges add anything.
  - The F4 finding ("rather than" 24×, budget 15) is book-level and has **no location**.
  - The QC-repair preflight rejects any location-less blocker with `REPAIR_FINDING_UNSCOPED`, before it creates a run. That is a deterministic wedge.
- **The rubric gate at bar 80 is unlikely to pass on this content.** A rubric FAIL is final for a candidate: there is no repair lane after it.

### 2. Stage-by-stage trace (`src/app/bookRunApplicationService.ts`)
Order of stages after a review PASS:
1. review COMPLETED (:3331)
2. advisories are recorded (best-effort)
3. fresh-qc (:3358–3443)
4. on a FAIL, the QC-repair ladder (:3445–3571)
5. rubric (:3573–3621)
6. promotion (:3623–3790)

| Stage | What it does | Role / route / effort | Caps / budgets | Fails closed when | Tests | Ran live on post-09-02 code? | What happens on a 429 | Verdict |
|---|---|---|---|---|---|---|---|---|
| Fresh QC, deterministic part | Chapter gate composite on each of 19 chapters, plus the book gate (`candidateQcEvaluator.ts:547–632`) | none | n/a | Any BLOCKER makes the round FAIL (:931) | v4-candidate-qc-evaluator (11); v4-fresh-qc-promotion-e2e (8) | **Never** | n/a | **Will FAIL: 33 blockers measured** |
| Source-fidelity judge | 1 call per chapter. Every span is ≤33.5k chars, under the 45k chunk size | qc / claude-cli sonnet-5 / **xhigh** / pipeline-read-json-long-v1 (30-minute timeout) | 2 attempts per chunk. Judge-run successor budget 5 (`CHAPTERFLOW_QC_JUDGE_RUNS` 1–10, :307) | An execution failure becomes an evaluation error with no round committed (:710–722). A verdict becomes a BLOCKER | v4-source-fidelity-judge (18), v4-source-fidelity-qc-wiring (19) | **Never** (added 09-04) | Retried once, then the evaluation fails. The judge run is finished FAILED with `reason = error code` only (:2254–2269). The next resume walks to a new `-rN` run (:2180–2230) | Untested live |
| Quiz answer-key judge | 1 call per question: 171 calls (9 × 19) | qc / xhigh / long profile (the span is attached) | Same budget as above. Run capacity 380 (:922–964) | Same | e2e; v4-book-run-application-service (the `-r2` successor, :1554, :1774) | Only before 09-02: 08-27, 36 calls, median 11 s, no span attached, default tier | Same | Untested at xhigh with span |
| QC-repair lane | Repair the chapters that carry QC blockers, then a full canonical review of the successor (baseline + 57 seats), then a successor QC (190 calls), then diagnosis chaining | repair / high; review / xhigh; qc / xhigh | `CHAPTERFLOW_QC_REPAIR_RUNS`, default 3 (:377); **the driver hardcodes 4**. Up to 2 ordinals forgiven, for review ERRORs only (:422, `contentRepairWorkflow.ts:125`). 3 review ids per ordinal | Preflight rejects unscoped or compiler-owned blockers (`candidateRepairApplicationPort.ts:338–355`, 1122). A successor review FAIL gives `REPAIR_REVIEW_FAILED` and the ordinal is spent (`contentRepairWorkflow.ts:259–264`). An unsuccessful QC gives `REPAIR_DIAGNOSIS_REQUIRED`, which is a manual `qc-diagnose` step | v4-qc-fail-repair-successor (21), v4-candidate-repair-application-port (26), e2e | **Never** (last run 08-28) | Chapter repair: `REPAIR_MODEL_FAILED`, spent (port :1492–1495). Review: 3 ERRORs in-process, forgiven at most twice. Successor QC judge: no successor walk, spent (`bookRunComposition.ts:617–690`) | **Blocked by F4** |
| Catalog rubric | 3 readers, run one after another, over the md5-seeded sample of chapters 1, 7, 13 and 19 | review / xhigh / attempt-read-json-v1 | 3 attempts per reader. 3 runs (`CHAPTERFLOW_RUBRIC_RUNS` 1–10, :293) | An ERROR is never a verdict. A SPLIT fails. Below the bar or the floor fails. The durable record replays forever for that candidate (:2330–2359) | v4-catalog-rubric-stage (22, run through the service with a scripted panel), v4-catalog-rubric (16) | **Never** | Provider block stops the panel at once (`catalogRubricPanelEvaluator.ts:282`). Run finished FAILED (:2468–2487). The next resume takes the next ordinal. Readers already scored are lost | Likely `RUBRIC_BELOW_BAR` |
| Promotion (`--promote-local`) | Compare-and-swap of CURRENT from revision 6 to 7, plus a release-journal record (:3712–3759) | none | n/a | Review, QC, candidate and revision checks (`release/promotionService.ts`) | promotion-atomicity, promotion-authorization, promotion-concurrency, e2e | Only before 09-02 (08-22, 08-28) | n/a | Low risk. Current revision is 6 and the intake recorded `expectedBookRevision=6` |
| Reader-package command / candidate release (owner's step) | `promote-book … --resume-unfinished-release` (:714–742) | none | n/a | Refuses only on book-gate blockers (`release/candidateReleaseGate.ts`). The rubric is evidence only (`cli.ts:2485–2536`) | v4-candidate-release-verdict (5), migration tests | Code from after #533 has never run live | n/a | Owner step; see issues 9 and 10 |
| Driver end of run | exit 0 means `*** SUCCEEDED ***`, then `break` | – | 60 rounds; a WEDGE STOP after 3 identical terminal lines | – | none | Never reached SUCCEEDED (0 matches in `franklin-v7b-driver.out`) | Provider-block detection does not work (issue 3) | – |
| `score-franklin-v7.js` | 6 blind readers, adjudicators, 1 churn agent, 1 critic | Session agents (they share the weekly cap) | – | – | none | No evidence it has ever run | – | Reads the wrong chapters (issue 8) |

**Resume and `--reconcile-unsettled` coverage:**
- **Fresh-QC judge:** a crashed run left RUNNING is abandoned without needing consent, with its ACTIVE and STALE attempts settled, and a new ordinal is started (:2181–2222). A committed round short-circuits the resume and settles any orphan run (:2112–2141).
- **ERROR QC round successor** (`MAX_FRESH_QC_SUCCESSOR_ORDINALS=3`, :1241): this path can never trigger here. `CandidateQcEvaluator` only ever returns PASS or FAIL (:931–941).
- **Rubric:** the same abandon-and-walk pattern as the judge (:2370–2431).
- **QC-repair port:** handled by `#reconcileWedgedRepairRun` under consent (#563).
- **Successor QC judge inside the QC-repair lane:** has neither a walk nor a reconcile step. `createRun` is idempotent (`run-state/fileRunStore.ts:393–407`), so reused attempt ids come back as `UNKNOWN MODEL_ATTEMPT_EXISTS` (`runtime/modelGateway.ts:585`). No test references `REPAIR_QC_JUDGE_UNAVAILABLE`.
- **Idempotence gaps:**
  - The QC judge keeps no results per chapter, so an interruption at call 180 throws away all prior work.
  - The rubric keeps no results per reader.
  - A stored rubric record whose instrument version no longer matches becomes CORRUPT, and the gate fails closed (`review/catalogRubricStore.ts:239`).

### 3. How a 429 would hit each stage
Every downstream lane burns a bounded budget when it hits a provider block. This is the same class as defect #20.
- **The driver cannot detect it.** On 09-20 the durable attempt records kept only a 400-char `stdoutHead` (`modelGateway.ts:384`). The current CLI envelope puts `result` after the `usage` block, so none of those records contains "weekly limit" or "429". For example, `review-run-b1066b7e…/attempts.jsonl` shows `has weekly: false, has 429: false`.
- **The round logs don't carry it either.** `fv8h-r1..r3.log` contain no provider text. Their only "429" hits are the sha `a0429724d`. The last line reads `BOOK_RUN_REVIEW_FAILED:canonical review outcome=ERROR`.
- **The detector also reads the wrong lines.** `provider_block` takes the tail of all concatenated `attempts.jsonl` files (`drive-franklin-v7.sh:38–40`). New lines in a run directory that sorts early are never looked at.
- **So each driver round burns one ordinal in seconds**, until a WEDGE STOP after 3 identical terminal lines. The review lane burned 3 of 3 this way.
- **Lanes with tighter caps:**
  - The QC-judge lane (5) and the rubric lane (3) can only be raised through environment knobs, and autoresume does not forward those knobs.
  - The QC-repair lane is capped at 4 by a hardcoded value in the driver.

### 4. Is the rubric bar of 80 realistic?
The gate is: composite ≥80, every factor median ≥70, churn not HIGH, and a unanimous correctness-gate PASS. A SPLIT fails closed (`review/catalogRubric.ts:627–690`).
- **The 74.3 figure is one chapter.** It is ch01 in review-35abdd05. Across the last four panels, the median chapter composite is 75.8–76.8.
- **The chapters the rubric will actually read (1, 7, 13, 19) score 73.2–78.5.** In those chapters, limits is 61–66 and density is 62–73.
- **Phase A measured an offset between instruments.** On the same rev-6 bytes, the pipeline's per-chapter panel gave 75.4–79.7. The catalog instrument, read by six fresh readers, gave **64.6**, with the gate FAILing 0/6 and churn HIGH.
- **Catalog baseline:** 67 of the 97 gate-PASS books reach ≥80.
- **Conclusion (inferred):** a FAIL is likely, and the factor floor is the most likely reason. Any change to the bar or the floor is the owner's decision. A rubric FAIL replays forever for that candidate at zero cost, and there is no remedy lane.

### 5. Model-call volume and wall-clock (19 chapters)
Timing baselines, all measured at xhigh on this book:

| Call type | Measured time |
|---|---|
| Reader seat (one chapter) | p50 226–234 s, p90 ~330 s |
| Baseline whole-book review | 285–407 s |
| Chapter repair | p50 212–263 s |
| Full panel at concurrency 9 | ~57 min |

The run consumed 1,639 attempts between 09-18T12:33 and the 09-20 429.

| Stage | Calls | Concurrency | Wall-clock estimate |
|---|---|---|---|
| Fresh QC | 190 (up to 380 with retries): 10 per chapter | Sequential | 3–7 h (unverified; no live post-09-02 data) |
| One QC-repair ordinal | ~263: about 15 repairs, 1 baseline, 57+ seats, 190 judge calls | Repairs sequential, seats at 9 | 5–9 h, plus a manual `qc-diagnose` if QC is still failing |
| Rubric | 3 (up to 9) | Sequential | 10–25 min |
| Promotion / release | 0 | – | seconds |
| Scoring | 8–14 session agents | Parallel | – |

Realistic path once F4 is fixed and one repair ordinal converges: about 450 calls over 8–16 h. At the driver's cap of 4 ordinals: about 1,250 calls, which is roughly one weekly cap.

### 6. Most likely next wedges, ranked, with a minimal fix for each (nothing implemented)
1. **The F4 unscoped blocker makes the QC-repair lane refuse deterministically, at zero cost.**
   - Cause: `critics/bookGate.ts:828–833` emits F4 with no `path` or `chapters`. `candidateQcEvaluator.ts:627` then gives it no location, and `candidateRepairApplicationPort.ts:342–343` and 1122–1123 refuse it. The refusal is pinned by the test `v4-candidate-repair-application-port.test.ts:146`.
   - The count is growing: under 16 on the compile candidate, 19 on repair-10, 24 on repair-21.
   - Fix: have F4 list the chapters whose text contains the phrase, so the existing multi-chapter scoping (#501) routes it. This does not weaken the gate.
   - Timing matters: the fix has to land **before** this run commits its fresh-QC round, because the round is immutable (keyed `derivedId("qc", runId)`).
2. **Fresh QC fails by construction, and the QC-repair lane then needs a second panel PASS.**
   - Compile never runs the QC gate stack. `runChapterGateCompositeFromCandidate` is called only from `candidateQcEvaluator` on the v25 path.
   - BP15 (`critics/quizQuality.ts:37`) has no prose carve-out. The compile gate's SEC52 does (`sections/sectionGate.ts:3353–3366`). As a result, the compile candidate already carries 22 QC blockers.
   - Each QC-repair ordinal needs the successor to get a full-panel PASS on its first verdict. Since 09-18 there have been 25 stored reviews: 20 FAIL, 5 ERROR, 0 PASS.
   - Fix options:
     - (a) Run the deterministic QC evaluator (no runner) before canonical review and send its chapter-scoped blockers into the existing review-repair brief.
     - (b) Align BP15 with SEC52. This loosens the gate, so it is the owner's call.
3. **A 429 burns ordinals in every downstream lane** (section 3).
   - Fix: have book-run exit with `BOOK_RUN_PROVIDER_BLOCKED:<kind>` whenever the error chain, or the infrastructure blockers on a stored ERROR review, classify through `providerBlockKind`. Record `PROVIDER_BLOCKED` as the terminal reason, and have the successor walks skip such runs without counting them, using the existing forgiveness mechanism.
   - Have the driver grep its round log for that token.
   - Keep the useful part of the envelope (`result`) in the durable detail instead of a raw 400-char head.
   - This is the same fix as #20, extended to four more code sites: `bookRunApplicationService.ts:2266` and `:2481`, `contentRepairWorkflow.ts:241–270`, and `bookRunComposition.ts:661–670`.
4. **A rubric FAIL or SPLIT ends the run for that candidate, and the owner has not decided what that outcome means.**
   - Fix: no code. The owner needs to decide what `RUBRIC_BELOW_BAR` means for "return the output for evaluation".
   - Note that `promote-book` does not enforce the rubric verdict.
5. **The QC-repair lane's successor QC judge has no successor walk** (`bookRunComposition.ts:617–690`, untested). A judge failure costs the whole ordinal: the repair plus a panel.
   - Fix: treat a judge evaluation failure as a forgivable infrastructure loss, bounded by `MAX_FORGIVEN_INFRA_ORDINALS`.
6. **Autoresume and the driver disagree about the budgets.**
   - The driver hardcodes `QC_REPAIR_RUNS=4` and `REVIEW_REPAIR_ROUNDS=4` (`drive-franklin-v7.sh:46`, `:54`).
   - `autoresume.sh:33–52` and 122–125 forward only 3 knobs. `CHAPTERFLOW_REVIEW_REPAIR_ORDINALS`, `QC_JUDGE_RUNS` and `RUBRIC_RUNS` are not among them.
   - Inferred consequence: a round launched by autoresume on this run, which has used 21 ordinals, would fail at the default ceiling of 20.
   - Fix: parse and forward those keys, and change the driver to use `${VAR:-4}`.
7. **Fresh QC is sequential and all-or-nothing** (3–7 h). This slows the run but does not block it. A bounded chapter pool like #570 is the lever if needed.
8. **`score-franklin-v7.js` reads the wrong chapters.** It reads chapters [0,1,2,3] of a book it describes as 4 chapters (lines 36–41 and 139), while the rubric reads chapters 1, 7, 13 and 19. It also needs the v21 package that only the owner's release produces.
   - Fix: pass the sampled indices in as an argument.
9. **Stale operator text at `cli.ts:564`.** It says the release "advances the pointer one more revision". The command actually resumes at the same revision (:692–711).
   - The printed command also contains placeholder categories and tags, and records the local-only sha `9f0117cb7`. After a squash merge, that sha will never exist on origin.
10. **An xhigh call can spend its whole output budget on thinking** (the defect #14 class). The baseline review hit this once on 09-19 (review-99059488, `MODEL_OUTPUT_INVALID`).
    - Fix: lower the qc effort from xhigh to high in `config/model-routing.json`, as #568 did for the author role, if it recurs.

### 7. CI caveat, confirmed
The CI job "v21 Pipeline Typecheck + Tests" (`.github/workflows/ci.yml:157–189`) runs root `pipeline:typecheck` and `pipeline:test`. Those target `@chapterflow/v21-authored` (root `package.json:32–33`). A green CI run is therefore not evidence for v25. All the downstream tests above use hermetic fakes. None of them simulates repeated provider blocks across resumes for the judge, rubric or QC-repair lanes.