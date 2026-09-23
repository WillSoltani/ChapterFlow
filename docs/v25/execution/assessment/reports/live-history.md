# live-history

## keyFacts
- VERIFIED: No run since 2026-09-02 reached review PASS, fresh-qc, promotion, rubric or release. EV has no review:COMPLETED, fresh-qc or promotion event after 08-28, and the 34 reviews completed after 09-04 are 28 FAIL, 6 ERROR, 0 PASS.
- VERIFIED: In August, run f9f250ce promoted (bookRevision=1, 08-22T09:04Z) and run d7e690f9 promoted (bookRevision=5, 08-28T06:30Z); current.json shows revision 6. Both promoted even though fresh-qc returned outcome=FAIL. The rev-6 package has 4 chapters ('Part One'..'Part Four'); v7 runs map the source to 19 chapters.
- VERIFIED: 11 Franklin book runs since 09-04 (EV): d51c92fc, 37fa7f92, f39d4660, 5c032deb, 65c23408, 1775fb28, 1e148494 (intake-only), fd722827, 4dc2a413, 755fb671, 39a37d06. Only 5 finished compile, and none got past the review/repair loop.
- VERIFIED: Current run book-run-39a37d06 is wedged. DRV:442 reads 'BOOK_RUN_REVIEW_FAILED:canonical review successor budget exhausted after 3 ordinals…' at 2026-09-20T14:58:03Z. REV 35abdd05 and successors b1066b7e, adc6eeef and 735da811 all carry 'You've hit your weekly limit · resets Sep 22 at 7pm (America/Toronto) (api_error_status=429)'.
- INFERRED (reset time 7pm EDT = 23:00Z vs `date -u` 00:18Z 09-23): the weekly limit has already reset. Defect #20 (429 stored as an ERROR review, burning all 3 successor ordinals) still blocks any resume without a code fix.
- VERIFIED: Current-run panel blocker series (REV): 34, 27, 21, 17, 13, 19, 15, 9, 18, 9, 10, 15, 16. Not converging; 0 BELOW_FLOOR in all 13 panels.
- VERIFIED: Across those 13 panels the skeptic seat filed 139 of 223 reader blockers (62%). Chapter-and-category groups raised by 2 or more seats ran 0 to 7 per panel, and 0 to 3 in the last 9 panels.
- VERIFIED: Current run used 6 distinct code revisions (71c19cc1e start, then resumes on 24cbe9402, 713536c11, a0429724d, 27f3115c2, 9f0117cb7; DRV:294-415). All are local-only; origin/main is be9c44ed8.
- VERIFIED: Current run counts (RS): 15 compile rounds (1 COMPLETED at 09-19T04:58Z); 14 reader panels (13 FAIL plus 1 ERROR); 22 stored reviews; 21 repair ordinals (15 COMPLETED, 6 FAILED) out of the 40 the knob allows.
- VERIFIED: Since 09-04 in total: 78 compile rounds (5 COMPLETED, 49 section-gate blocked, 12 assembly-gate blocked, 5 NOT_REPLAYABLE, 4 MODEL_INVALID, 1 PROCESS_FAILED timeout, 2 abandoned RUNNING); 24 reader panels started, 22 completed; 38 repair ordinals.
- VERIFIED (union of RS attempt intervals, 5-min merge): wall clock from the first event 09-04T04:11:51Z to 09-23T00:18Z is 452.1 h (456.3 h from 09-04T00:00Z). Model calls were in flight for 153.4 h (33.9%); stopped time is 298.7 h.
- VERIFIED/INFERRED: Stopped time by class: infrastructure hang plus unattended 191.6 h (the 09-08T23:41Z seat call never got a reply until the reboot at 09-16T06:45Z per kern.boottime = 175.1 h, plus 14.4 h before anyone resumed, plus 2.2 h after the 09-05 16:06Z reboot); weekly usage limit 56.0 h; waiting for pipeline-bug fixes 45.1 h over 15 idle gaps; owner pause or hold 5.9 h.
- VERIFIED: 118.5 of the 153.3 busy hours (77%) were spent on runs that were later abandoned. Only 34.8 h went into the current run 39a37d06 (perrun.js).
- VERIFIED: Driver output DRV has 21 invocation series (fv7b..fv7n, fv8a..fv8h) and 111 round blocks. The original driver output for runs A1-A6 (prefix fv7) is lost: the scratchpad was wiped at the 09-05 reboot, and only ~/cf-canary/fv7-r1..r11.log (run A6) survive.
- VERIFIED: 8 WEDGE STOPs in DRV: 09-06 00:36 sha CONFLICT, 09-06 01:06 retry exhausted, 09-08 12:40 REVIEW_REPAIR_ATTEMPT_UNCERTAIN, 09-08 14:34 review-run CONFLICT, 09-16 21:06 #12, 09-19 15:23 #16, 09-20 07:30 #19, 09-20 14:58 #20. Plus 7 operator STOP markers: 09-07 03:53, 09-17 05:03, 09-17 09:08, 09-18 09:40, 09-18 21:17 (owner), 09-19 21:37, 09-20 00:27.
- VERIFIED (gh): fix PRs #547-#556, #558, #560 and #562-#564 are MERGED; #559 and #566-#575 are OPEN. The run checkout 9f0117cb7 is exactly origin/main plus #566-#575 (`git log origin/main..HEAD`); #559 is not applied.
- VERIFIED: Every defect fixed from #1 to #19 did not recur in its own form on the next run. Evidence includes: #10 next panel 0/74 seat failures vs 9/69 before; #14 0 TIMED_OUT attempts after 09-17T08:51Z; #15 0 chapter-title blockers after 09-19; #19 fv8h R1 ran 17,396 s; #11 repair-2@90caa067 COMPLETED including ch10.
- VERIFIED: Caveats on those fixes. #1 needed #2 before research passed. #13 exposed #15 (7 of 19 titles invented). #9 (carry-over, #558) was never measured: CARRY_OVER_REJECTED_DRAFT fired 16, 8 and 5 times in fv8b, fv8c and fv8d, against 133, 79 and 48 SKIPPED.
- VERIFIED: A residual failure class was never fixed: repair-role output failing schema validation (thinking to the cap). It hit review-repair-7@90caa067 (09-17), review-repair-2@4625510a (09-18) and review-repair-13@06d7596a (09-20).
- VERIFIED: Both sha-in-identity wedges and the repair-lane wedge (#563/#564, the 5.3 h gap on 09-08) were triggered by the operator killing the driver mid-attempt ('MY MISTAKE', LOG). The kill at 00:35Z 09-06 also led to the fv7c CONFLICT wedge.
- VERIFIED: CI job 'v21 Pipeline Typecheck + Tests' runs typecheck:book, whose tsconfig.book.json includes scripts/book/**/*.ts, so v24 source IS typechecked. Its pipeline:typecheck and pipeline:test run with --workspace @chapterflow/v21-authored (package.json:32-33). No v24/v25 tests run in CI.
- VERIFIED: No pipeline process is running. The launchd autoresume agent is loaded (900 s interval, no PAUSE file) and idles on WEDGE STOP; last log line is 09-23T00:23Z. AUTORESUME.env still says LOG_PREFIX=fv8d and lacks CHAPTERFLOW_REVIEW_REPAIR_ORDINALS=40.
- VERIFIED: The running log (LOG) contradicts the UTC evidence in places. It puts the v7 launch at '~10:00 ADT' on 09-04; the events show 04:11Z. It dates the owner stop '13:15Z 09-18'; the driver marker shows 21:17:21Z. It calls the 09-05 16:04Z death a 'host Claude process exited'; `last reboot` shows a machine reboot at 16:06Z.

## openQuestions
- Why did the 09-08T23:41:15Z seat call (transcript b5d96192) never get a reply, and why did no gateway timeout fire for 7 days? The candidates are machine sleep and a CLI hang. The macOS power log (`pmset -g log` around 2026-09-08T23:40Z) and the caffeinate status of driver fv7l would settle it.
- Would the launchd autoresume agent relaunch the run with the stale AUTORESUME.env (LOG_PREFIX=fv8d, ordinal ceiling defaulting to 20 while the run is at ordinal 21), and what would that do? Reading autoresume.sh's launch logic would answer it without running anything.
- The per-attempt timings for runs A1-A6 (09-04 to 09-05) come only from the events log and RS, because the original driver output is lost. The exact kill times of the operator stops at ~09:54Z, ~15:28Z and ~21:09Z on 09-04 are taken from LOG, not from primary evidence.
- When exactly was run 1775fb28's successor panel killed on 09-06? The only evidence is a reader-lane attempt admitted at 17:41:59Z that never finished; there is no STOP marker in the driver output.
- The August panels used 4 chapters. No like-for-like comparison exists of blocker rates on the 19-chapter layout versus 4 chapters with the same reviewer code. Rescoring the rev-6 package through the current panel, or modelling P(zero blockers) per chapter, would show whether a PASS is structurally reachable under the any-seat blocker rule.
- Is the 74.3 median composite for review 35abdd05 correct? It comes only from LOG; its per-chapter medians were not recomputed from the review's issues.

## report

## Live test-book history, 2026-09-04 to now (2026-09-23 00:18Z)

Scope: every Franklin book run and driver invocation since the plan-wave-4 live test began. All work was read-only. Scratch scripts are in `.../scratchpad/assess/` (busy.js, perrun.js, progress-uniq.txt).

Sources:
- `~/cf-canary/book-run-events/the-autobiography-of-benjamin-franklin.jsonl`, abbreviated **EV** below
- `~/cf-wt/franklin-v7-tools/franklin-v7b-driver.out`, abbreviated **DRV**, cited as DRV:line
- `~/cf-canary/run-state/.../runs/*/{run.json,attempts.jsonl}`, abbreviated **RS**
- `~/cf-canary/books/.../reviews/*.json`, abbreviated **REV**
- the deduplicated running log `phaseb-log-dedup.md`, abbreviated **LOG**
- `gh pr list`

### 1. Direct answers

- **Has any run since 2026-09-02 reached review PASS, fresh-qc, promotion, rubric or release? No.**
  - EV has no `review:COMPLETED`, `fresh-qc` or `promotion` event after 2026-08-28. The only phases seen after 09-04 are intake, research, seed, compile, review and repair.
  - REV holds 34 reviews completed after 09-04: 28 FAIL, 6 ERROR, 0 PASS.
  - There were no Franklin runs at all between 08-28T06:30Z and 09-04T04:11Z.
  - Rubric and release never ran. Promotion never happened, and the rubric gate comes after it.
- **August contrast:**
  - Run `f9f250ce` reached `promotion COMPLETED bookRevision=1` at 08-22T09:04Z.
  - Run `d7e690f9` reached `promotion COMPLETED bookRevision=5` at 08-28T06:30Z. `current.json` shows revision 6, candidate `repair-r7-candidate-88b631ed…`.
  - Both August runs promoted even though fresh-qc reported `outcome=FAIL`.
  - August books had **4 "Parts"**; the rev-6 package has 4 chapters titled "Part One…Part Four". August panels found 0 to 7 blockers per review and reached PASS 8 times.
  - The v7 runs map the source to **19 chapters**. Current-run panels find 9 to 34 blockers. Per chapter that is 0.5 to 1.8, similar to or lower than August's roughly 0.25 to 1.75. A PASS, however, needs zero blockers across 4.75 times as many chapters.
- **Distinct code revisions for the current run `book-run-39a37d06`:** 6 in total, all local-only, none on origin/main. Started on `71c19cc1e`, then resumed on `24cbe9402`, `713536c11`, `a0429724d`, `27f3115c2` and `9f0117cb7` (DRV:294,326,367,375,389,415). That is 5 resumes onto new code.
- **Across all runs since 09-04:** 20 distinct pipeline shas. The first 5 come from LOG only, because the original driver output was lost.

### 2. Book runs since 09-04 (from EV; busy hours = union of model-call attempts in RS)

| # | runId | first → last event (UTC) | furthest stage / phases COMPLETED | terminal cause | busy h |
|---|---|---|---|---|---|
| A1 | d51c92fc | 09-04 04:11 → 04:23 | research FAILED | defect #1: research meta-reference, 3/3 | 0.2 |
| A2 | 37fa7f92 | 09-04 08:53 → 09:24 (operator stop ~09:54) | research, never completed | #2 hardEdge prompt and #3 `--regen` re-research | 1.0 |
| A3 | f39d4660 | 09-04 13:28 → 15:29 | research ✓, seed ✓, compile | #5 SEC128 livelock (#4 SEC120 cleared by itself); operator stop | 2.0 |
| A4 | 5c032deb | 09-04 19:51 → 21:04 | research ✓ (after an italics failure), compile | #6 number-word floor SEC14/SEC136; operator stop | 1.2 |
| A5 | 65c23408 | 09-04 23:33 → 09-05 01:19 | compile FAILED | #7 `COMPILER_SECTION_BLOCKED…SEC35.example_dealt_name` | 1.8 |
| A6 | 1775fb28 | 09-05 02:39 → 09-06 12:41 | compile ✓ at operator-retry-29 (09-06 08:20); review panel ERROR | #8 assembly livelock, sha-identity wedge, retry ceiling of 20, #10 reviewer refusals; abandoned for a fresh run | 36.7 |
| — | 1e148494 | 09-06 17:43 | intake FAILED | `BOOK_RUN_ALREADY_PROMOTED` (driver flag) | 0 |
| C1 | fd722827 | 09-06 17:44 → 09-07 03:40 | compile ✓ (all cache reused); panel FAIL 60; repair ordinals 1–4 | #11 `REPAIR_OUTPUT_INVALID…changed chapter identity for chapter 10` | 10.1 |
| C2 | 4dc2a413 | 09-07 10:08 → 09-17 04:59 | compile ✓; panels 50→34→29→13 (lost panel)→19; 9 ordinals | operator-kill wedge, sha-identity wedge, 7-day hang, #12, then #13 wall (`REPAIR_OUTPUT_NO_CHANGE` ch10, title "X") | 39.4 |
| C3 | 755fb671 | 09-17 05:33 → 09-18 09:37 | compile ✓ (09-18 01:56Z, 23 rounds); panel FAIL 42; 4 ordinals | #14 author@high timeouts, then #15 `STRUCTURAL_DEFECT` ch15 title | 26.1 |
| C4 | **39a37d06** | 09-18 12:33 → 09-20 14:58 | compile ✓ (09-19 04:58Z, 15 rounds); 14 panels; 21 ordinals | owner pause, then #16, #17, #18, #19, then #20 WEDGE | 34.8 |

Only the "busy" hours for C4 count toward the current candidate. 118.5 of the 153.3 busy hours (77%) went to runs that were later discarded.

### 3. Driver invocations (DRV has 21 series, 111 `=== R` blocks, 100 `exit=` lines)

The original driver output for attempts A1–A6 (prefix fv7, scratchpad `franklin-v7-driver.out`) is **lost**: the scratchpad was wiped at the 09-05 reboot, and `find` locates no copy. Only `~/cf-canary/fv7-r1..r11.log`, which belong to A6, survive.

| series | start (UTC) | sha | R blocks | how it ended (exact DRV line) | root cause | fix | held on next run? |
|---|---|---|---|---|---|---|---|
| fv7 (A6) | 09-05 02:39 | e2e15b113 | r1–r11 | host died 16:04Z; `last reboot` shows **Sep 5 12:06 EDT = 16:06Z** | infrastructure: machine reboot; driver ran as a Claude background task | tools moved to ~/cf-wt, nohup | yes: resumed with 58 packs reused (LOG) |
| fv7b | 09-05 18:17 | e2e15b113 | 12 | R10 `exit=143` (SIGTERM), RELAUNCH after #556 (DRV:31,37) | #8 SEC119/SEC90 assembly livelock (22:15Z) | #556 merged 09-06 00:35Z | yes: fv7e R2 evicted 17 packs; assembly passed R9 06:12Z |
| fv7c | 09-06 00:36 | 34a9ec420 | 3 | `WEDGE STOP` … `COMPILER_RUN_UNAVAILABLE:CONFLICT…already exists with a different definition` (DRV:49–52) | sha in run identity (1st occurrence) | manual reconcile under the old sha; permanent fix #564 | workaround held |
| fv7d | 09-06 00:39 | 34a9ec420 | 5 | `BOOK_RUN_COMPILER_RETRY_EXHAUSTED…after 20 slots` (DRV:73) | operator budget ceiling | env knob raised to 50 (no code change) | yes |
| fv7e | 09-06 01:06 | 34a9ec420 | 9 | no END marker; R9 ran compile ✓, then review ERROR 12:41Z, then successor; abandoned about 17:42Z | #10: 9/69 seat calls were refusals or decorated output | #560 merged 17:25Z; fresh run instead | yes: next panel 74/74 seat attempts succeeded (RS reader-lane e7bac9d7: fail=0, vs eb311292: fail=9) |
| fv7f | 09-06 17:43 | 1de1dcc1c | 1 | `BOOK_RUN_ALREADY_PROMOTED` then `NO RUN ID STOP` (DRV:106–110) | driver flag (`--regen` missing) | relaunched 1 min later | yes |
| fv7g | 09-06 17:44 | 1de1dcc1c | 1 (33,269 s) | `REPAIR_OUTPUT_INVALID:replacement changed chapter identity for chapter 10` plus a driver `NO RUN ID STOP` bug (DRV:117,124) | #11 | — | — |
| fv7h | 09-07 03:00 | 1de1dcc1c | 2 | `STOPPED BY OPERATOR 03:53:51Z` (DRV:132) | #11 again (ordinal 3 failed the same way) | #562 merged 10:08Z; fresh run C2 | yes: RS `review-repair-2@90caa067` COMPLETED including ch10 |
| fv7i | 09-07 10:08 | de8d66fb7 | 2 (R1 = 95,434 s) | R1 hit the review round cap 4/4 (content, auto-relaunch); R2 killed by the operator at 12:39:40Z mid-attempt (LOG calls this "MY MISTAKE") | operator error | — | — |
| fv7j | 09-08 12:40 | de8d66fb7 | 3 | `REVIEW_REPAIR_ATTEMPT_UNCERTAIN…replay refused` WEDGE (DRV:152–159) | repair lane had no reconcile path | #563 merged 14:33Z | yes: fv7l R1 `RECONCILED_UNSETTLED_ON_RESUME` |
| fv7k | 09-08 14:34 | 1d6d3eea8 | 3 | `BOOK_RUN_REVIEW_FAILED:CONFLICT…review-run… different definition` WEDGE (DRV:172–175) | sha in run identity (3rd occurrence) | #564 merged 17:54Z | yes: `REOPENED_UNDER_DIFFERENT_SOURCE_SHA` (DRV:198–199, 437–438) |
| fv7l | 09-08 17:54 | be9c44ed8 | 2 | no END; the last seat call (transcript b5d96192) got its prompt at 23:41:15Z and **never received a reply**. RS attempt admitted, never finished. Reboot at 09-16 06:45Z (`kern.boottime`). | infrastructure hang, cause unverified; no watchdog or auto-restart existed | — | — |
| fv7m | 09-16 21:06 | be9c44ed8 | 3 | `BOOK_RUN_REVIEW_FAILED:settled review call lacks durable review; replay refused` WEDGE (DRV:195–202) | #12 | PR #566 (OPEN), cherry-picked | yes: successor panel 94d7f8eb completed |
| fv7n | 09-16 22:01 | dfb1f6fb6 | 3 | `STOP 05:03:27Z…REPAIR_OUTPUT_NO_CHANGE: frozen placeholder title 'X'` (DRV:213) | #13 | #567 (OPEN); fresh run C3 | partly: titles are descriptive, but 7 of 19 were invented, which exposed #15 |
| fv8a | 09-17 05:33 | 688ba6c71 | 2 | `STOP 09:08:33Z…ch02 learning-pack thinks to the 64k output cap at author@high (3× TIMED_OUT)` (DRV:221) | #14 | #568 (OPEN) | yes: RS has 0 TIMED_OUT attempts after 09-17T08:51:51Z (only 4 since 09-04, 3 of them this one) |
| fv8b | 09-17 10:49 | 7f3861708 | 23 | `STOP 09:40:22Z…ch15 title/content mismatch` (DRV:292) | #15 | #569 (OPEN); fresh run C4 | yes: 0 chapter-title blockers in any review after 09-19T04:58 |
| fv8c | 09-18 12:33 | 71c19cc1e | 10 | `STOP 21:17:21Z: paused by owner request` (DRV:324) | owner stop | #570/#571 parallelism (OPEN) | yes: compile finished in 3h10m and panels took about 57 min (LOG) |
| fv8d | 09-19 01:49 | 24cbe9402 | 10 | `REVIEW_REPAIR_FINDING_UNSCOPED: review blocker PATTERN_AUDIT_DEFECT…` WEDGE (DRV:358–365) | #16 | #572 (OPEN) | yes: successor baseline passed; panel 5ebfffd3 ran |
| fv8e | 09-19 18:52 | 713536c11 | 2 | `STOP 21:37:14Z…renderReaderDoc artifact — 10-space indent before 'Back:'` (DRV:373) | #17 | #573 (OPEN) | yes: RS review-repair-10 COMPLETED |
| fv8f | 09-19 23:43 | a0429724d | 4 | `STOP 00:27:04Z…ordinals 12/13/14 burning…single-chapter QUIZ_DEFECT (ch14)` (DRV:387) | #18: baseline reviewer blocker that LOG and REV both show was hallucinated | #574 (OPEN) | yes: DISPUTED_REVIEW fired live; successor review 6ac3f48f |
| fv8g | 09-20 03:16 | 27f3115c2 | 5 | `REVIEW_REPAIR_COMPLETED_MISMATCH:completed review-repair run attempts do not match exact targeted chapter set` WEDGE (DRV:406–413) | #19 | #575 (OPEN) | yes: fv8h R1 ran 17,396 s |
| fv8h | 09-20 10:07 | 9f0117cb7 | 6 | `BOOK_RUN_REVIEW_FAILED:canonical review successor budget exhausted after 3 ordinals…` WEDGE 14:58:03Z (DRV:435–442) | **#20**: weekly-limit 429 stored as a durable ERROR review | **no fix** | — |

Defects #1 and #2 are not numbered explicitly in LOG: #1 is written "LIVE-FOUND DEFECT" and #2 "ROOT CAUSE #2". #3–#20 are numbered.

Fix PRs by defect:

| defect | fix PR |
|---|---|
| #1 | #547 |
| #2 | #548 |
| #3 | #549 |
| #4 | #550 |
| #5 | #551 |
| #6 | #554 (plus #552 italics and #553 persisting rejected drafts) |
| #7 | #555 |
| #8 | #556 |
| #9 | #558 (carry-over; merged but not measured) |
| #10 | #560 |
| #11 | #562 |
| unnumbered operator-kill wedge | #563 |
| unnumbered sha-identity wedge | #564 |
| #12 | #566 |
| #13 | #567 |
| #14 | #568 |
| #15 | #569 |
| #16 | #572 |
| #17 | #573 |
| #18 | #574 |
| #19 | #575 |
| #20 | none |

PR state from `gh`:
- MERGED: #547–#556, #558, #560, #562–#564 (15 PRs).
- OPEN: #559 and #566–#575 (11 PRs).
- #559 (draft-time avoid phrase) is not in the run checkout. `git log origin/main..HEAD` lists exactly #566–#575.

**Did each fix hold?** Every fixed defect, #1 through #19, did not recur in its own form on the next run. There are caveats:
- #1 needed #2 before research passed.
- #13 led directly to #15.
- The effect of #9 was never measured. `CARRY_OVER_REJECTED_DRAFT` fired 16, 8 and 5 times in fv8b, fv8c and fv8d, against 133, 79 and 48 `CARRY_OVER_SKIPPED`.
- The repair-role thinking-to-cap failure (schema-invalid output) is still happening and was never fixed: `review-repair-7@90caa067` (09-17), `review-repair-2@4625510a` (09-18) and `review-repair-13@06d7596a` (09-20).

### 4. Time accounting

- **Wall clock:** 09-04T00:00Z to now is **456.3 h (19.0 days)**. From the first event (04:11:51Z) it is **452.1 h**.
- **Executing:** at least one model call in flight, measured as the union of RS attempt intervals with gaps under 5 minutes merged and ABANDONED attempts excluded. That is **153.4 h (33.9%)**, in 19 merged spans. DRV's completed `elapsed=` values add up to 114.5 h; that sum leaves out killed or hung rounds and runs A1–A6.
- **Stopped:** **298.7 h (66.1%)**.

| class | stops (count) | idle hours | detail |
|---|---|---|---|
| Pipeline bug or wedge, waiting for a code fix | 20 (defects #1–#19 plus the 2 unnumbered wedges; #4, #8 and #10 were fixed while the run kept going) | **45.1** | gaps of 4.5, 3.6, 4.4, 2.5, 1.3, 6.3, 5.3 (operator-induced, fixed by #563/#564), 0.4, 2.0, 2.9, 3.5, 2.1, 2.8, 2.6 h, plus 0.9 h for #12 |
| Infrastructure (reboot, hang, unattended) | 2 | **191.6** | 2.2 h after the 09-05 reboot; **175.1 h** hung, from 09-08 23:41Z to the 09-16 06:45Z reboot; 14.4 h unattended after that reboot |
| Usage limit (weekly) | 1 | **56.0** | 09-20 14:58Z to the reset at 09-22 23:00Z ("resets Sep 22 at 7pm America/Toronto", REV 35abdd05). This stop is also defect #20, a wedge the reset does not clear. |
| Owner or operator stop | 2 | **5.9** | owner pause 09-18 21:17Z → 09-19 01:49Z (4.6 h, used to build parallelism); owner hold since the reset (1.3 h, "wait for my instructions", LOG) |
| Driver or operator tooling | 3 | ~0 | ALREADY_PROMOTED; NO RUN ID pin bug (twice); retry ceiling raised by knob |
| Content gate FAIL, handled automatically | 61 compile rounds; 34 FAIL/ERROR reviews | 0 idle (all time spent executing) | 49 `COMPILER_SECTION_BLOCKED` plus 12 `COMPILER_ASSEMBLY_BLOCKED` rounds; review verdicts go straight to repair |

The busy-hour gap from 09-08 23:41Z to 09-16 22:01Z is 190.3 h. That gap alone is 42% of all wall-clock time.

### 5. Counts

- **Compile rounds** since 09-04 (RS compiler runs): **78**.
  - By outcome: 5 COMPLETED; 49 section-gate blocked; 12 assembly-gate blocked; 5 `COMPILER_ATTEMPT_NOT_REPLAYABLE` (reconciled after kills); 4 `COMPILER_SECTION_MODEL_INVALID`; 1 `COMPILER_SECTION_PROCESS_FAILED` (#14 timeouts); 2 left RUNNING in abandoned runs.
  - By run: A3 3, A4 3, A5 1, A6 31, C1 1, C2 1, C3 23, **C4 15**.
- **Reader panels:** 24 reader-lane runs started; 22 completed with a stored verdict; 0 PASS. Two were abandoned mid-read: 420f7c2c (A6) and 1c9ede96 (C2, the 7-day hang).
- **Stored reviews:** 34 in total (28 FAIL, 6 ERROR). 22 of them belong to C4.
- **Review-repair ordinals:** **38** in total (C1 4, C2 9, C3 4, **C4 21**).
  - C4: 15 COMPLETED and 6 FAILED. The failures:

| ordinal | reason |
|---|---|
| 8 | NO_CHANGE ch6 |
| 9 | reconciled after a kill |
| 12 | NO_CHANGE ch14 |
| 13 | schema-invalid output |
| 14 | reconciled after a kill |
| 15 | NO_CHANGE ch14 (dispute trigger) |

  - The ordinal ceiling was raised to 40 by the `CHAPTERFLOW_REVIEW_REPAIR_ORDINALS` knob (#574), so C4 has used 21 of 40.

### 6. Current run 39a37d06: every canonical review (REV)

| completed (UTC) | review | kind | outcome | blockers (split) |
|---|---|---|---|---|
| 09-19 05:59 | 06d7596a | panel | FAIL | **34** (22 contradiction, 12 structural) |
| 07:56 | 87c9dc3c | panel | FAIL | **27** |
| 09:43 | 37df51a2 | panel | FAIL | **21** |
| 10:30 | 99059488 | baseline | ERROR | `REVIEW_EVALUATOR_ERROR: MODEL_OUTPUT_INVALID` |
| 11:21 | ec0e30a8 | panel (successor) | FAIL | **17** |
| 12:58 | 4a2acca7 | panel | FAIL | **13** |
| 14:31 | 8aeae974 | panel | FAIL | **19** |
| 15:23 | 120c5985 | baseline | FAIL | 1 PATTERN_AUDIT_DEFECT (#16) |
| 19:42 | 5ebfffd3 | panel | FAIL | **15** |
| 21:24 | 1720d489 | panel | FAIL | **9** |
| 09-20 00:14 | ba931fdd | baseline | FAIL | 1 INTERNAL_CONTRADICTION ch03 |
| 00:22 | 3406164e | baseline | FAIL | 1 QUIZ_DEFECT ch14 (hallucinated, #18) |
| 03:23 | 6ac3f48f | baseline (dispute successor) | FAIL | 1 INTERNAL_CONTRADICTION ch12 |
| 04:27 | 9827ee52 | panel | FAIL | **18** |
| 06:05 | 585058c1 | panel | FAIL | **9** |
| 07:30 | 1ca523b6 | panel | FAIL | **10** |
| 11:33 | 052e2b67 | panel | FAIL | **15** |
| 13:24 | ba9e7444 | panel | FAIL | **16** |
| 14:57 | 35abdd05 | panel | ERROR | 5 reader blockers, plus ch16 and ch17 `SEMANTIC_PANEL_READER_FAILED…weekly limit…(api_error_status=429)` |
| 14:57 | b1066b7e, adc6eeef, 735da811 | successors 1–3 | ERROR | `REVIEW_EVALUATOR_ERROR…weekly limit…429`, all within 16 s |

- **Panel trend:** 34 → 27 → 21 → 17 → 13 → 19 → 15 → 9 → 18 → 9 → 10 → 15 → 16. It is not converging. It matches LOG line 60 exactly.
- No panel reported `READER.PANEL.BELOW_FLOOR`, so every chapter median stayed at or above the bar of 70.
- **Seat split** across the 13 FAIL panels: 223 reader blockers, of which the skeptic seat raised 139 (62%), practitioner 43 and cold 41.
- **Agreement between seats:** chapter-and-category groups raised by 2 or more seats numbered 7, 6, 2, 2, 1, 2, 1, 2, 3, 0, 1, 0, 1 per panel.
- **First 429:** reader-lane faea7e76 attempts failed from 09-20T14:55:25Z.
- **Latest candidate:** `review-repair-21-candidate-06d7596a…` exists with 19 chapter files.

### 7. Current state (verified)

- No pipeline process is running (`pgrep` is empty).
- The launchd agent is loaded, has a 900 s StartInterval, and has no PAUSE file. `autoresume.log` shows it idles on "WEDGE STOP" every 15 minutes; the last check was 09-23T00:23Z.
- **Caveat:** `AUTORESUME.env` still has `LOG_PREFIX=fv8d` and lacks `CHAPTERFLOW_REVIEW_REPAIR_ORDINALS=40`. If it ever relaunches, it would run with the default ceiling of 20 while the run is already at ordinal 21. That outcome is inferred, not tested.
- The canonical checkout is detached at `9f0117cb7`, which is origin/main `be9c44ed8` plus 10 commits (`git log origin/main..HEAD`).
- **CI caveat verified:** the "v21 Pipeline Typecheck + Tests" job runs `typecheck:book` (tsconfig.book.json includes `scripts/book/**/*.ts`, so the v24 source is typechecked). It also runs `pipeline:typecheck` and `pipeline:test`, both scoped to `--workspace @chapterflow/v21-authored`. **No v24/v25 pipeline test runs in CI.** Only local runs are evidence for the tests.

### 8. Contradictions found

- LOG's early local-time labels do not match the UTC evidence:
  - LOG gives the v7 launch as "2026-09-04 ~10:00 ADT"; EV shows the first intake at 04:11:51Z (01:11 ADT).
  - LOG says #546 merged "~09:30 ADT"; `gh` shows 04:10:28Z.
  - LOG says "13:15Z 09-18 OWNER: stop"; DRV:324 shows the pause at 21:17:21Z, and the last model call ended at 21:16:33Z (RS).
- LOG gives the 09-05 driver death as "host Claude process exited". `last reboot` shows a machine reboot at 16:06Z.
- `current.json` shows revision 6, but the last promotion event says `bookRevision=5`.