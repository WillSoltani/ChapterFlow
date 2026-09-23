# verify panel-and-wedge

## corrections
- H3: "37 PRs were merged into main from #525 to #564 (#525-#556, #558, #560, #562-#564); #557 does not exist."
- H3: "Defects #1-#11 are fixed on main. #12-#19 are fixed only on the local detached checkout 9f0117cb7, through open PRs #566-#569 and #572-#575. The other two open PRs, #570 and #571, add concurrency and are not defect fixes."
- H3: "Most fixes held on the next run, with four exceptions. The carry-over fix for #9 (#558) was never measured. The fix for #13 exposed #15. The fix for #18 (#574) wedged on the very next relaunch; that wedge is #19, fixed by #575. The wave-0 quota fix #529 failed live, which is #20."
- H3: "Each of the 10 open PRs has its own GitHub branch, and #574 and #575 are stacked on other PR branches. The tested combination exists only as the local detached commit 9f0117cb7, and its cherry-picks differ from the PR heads."
- H3: "There were 20 numbered live defects, plus 2 unnumbered wedges caused by the operator (fixed by #563 and #564)."
- H4/E3: "Journaling the provider message is necessary but not enough. The driver's provider_block() takes a line offset (tail -n +L0) over a concatenation of all 371 runs/*/attempts.jsonl files in glob order. New records land mid-list (successors at positions 341, 357 and 359; the last file is review-run-f33d7485 from 09-07), so it greps old lines. Its regex also has no 429 pattern. The driver has to scan only new or changed files."
- H5a: "With the measured rates, and assuming chapters are independent, P(all 19 chapters clean in one panel) is about 4e-5 with no repairs and about 3e-7 with about 10 freshly repaired chapters."
- H5a: "The 83% single-seat share is a semantic judgment. Mechanical matching bounds it between 69% (matched on chapter and category) and 94% (matched on normalized unit string)."
- H5a: "Blockers fell from 34 to 13 over P1-P5 and then held at a mean of about 14 (P6-P13: 19, 15, 9, 18, 9, 10, 15, 16)."
- H7: "The 191 h breaks down as follows. One reader-seat call admitted at 09-08T23:41Z never finished before the 09-16T06:45Z reboot, which accounts for 175 h; whether the CLI hung or the machine slept cannot be told, because the pmset log starts on 09-16. Another 14 h passed unattended after that reboot, and 2 h after the 09-05 reboot."
- H7: "Of the 45 h waiting for fixes, 5.3 h (09-08) came from the operator killing the driver mid-attempt, not from a pipeline defect."
- H2: "Both full-suite runs also recorded 6 xenv (the gold corpus is absent from those worktrees) and 17 skips."

## confirmations
- Panel verdict is a union: any seat's blocking finding becomes a BLOCKER (semanticPanelReviewEvaluator.ts:361-363).
- Outcome is ERROR if any seat failed, else FAIL on any BLOCKER, else PASS (semanticPanelReviewEvaluator.ts:315, 389-393). A baseline that is not PASS short-circuits the panel (:222).
- The median floor is AUTHOR_CHAPTER_BAR = 70 (readerReview.ts:163; evaluator :328). It never fired in P1-P14.
- A quiz-key BLOCKER needs a strict, all-high-confidence majority of seats (panelQuizAdjudication.ts:82, :111, :118).
- Panel blocker series recomputed from REV: 34, 27, 21, 17, 13, 19, 15, 9, 18, 9, 10, 15, 16, then 35abdd05 ERROR with 5 reader BLOCKERs and 2 SEMANTIC_PANEL_READER_FAILED (15 chapters read).
- 0 PASS: run 39a37d06 has 22 reviews (14 panels, 4 baseline FAILs, 4 baseline ERRORs); since 09-04 there are 34 reviews, 28 FAIL and 6 ERROR.
- The skeptic seat filed 141 of 228 reader blockers (61.8%).
- Re-read noise: identical chapter bytes drew a blocker on 43 of 104 re-reads (41.3%) and on 101 of 158 first reads (63.9%). Within the same renderer version the re-read rate is 37/93 (39.8%). ch08 a32d84b5 scored 0,0,0,0,0,0 then 2.
- MAX_REVIEW_SUCCESSOR_ORDINALS = 3 is a hard constant with no env knob (bookRunApplicationService.ts:1236).
- reviewIsUncertain returns true for any stored ERROR (bookRunApplicationService.ts:1262-1264). #successorLanding skips stored-ERROR ordinals as spent (:1716).
- Successors 1-3 (b1066b7e, adc6eeef, 735da811) are ERROR reviews holding the weekly-limit 429. They were minted as ordinals 1/3, 2/3 and 3/3 in fv8h R1-R3, and R4-R6 then hit 'budget exhausted'.
- The attempt journal head is exactly 400 chars and ends at 'ephemeral_1h_inp'. It has 0 'weekly limit' matches in all three successor journals and in reader-lane-run-faea7e76. The August records (old key order) did contain the wording.
- The weekly limit reset at 1790118000 = 2026-09-22T23:00:00Z. Autoresume still idles on WEDGE STOP at 00:53Z on 09-23, so the reset did not clear the wedge.
- EV holds 0 review:COMPLETED, fresh-qc, rubric, promotion or release events since 09-02. The last are review/fresh-qc 08-28T05:39:34Z and promotion 08-28T06:30:08Z. No rubric event exists in any of the 4,410 lines.
- Wall time is 452.1 h (09-04T04:11:51.791Z to 09-23T00:18Z). Model calls were in flight for 153.4 h (33.9%), or 152.9 h as a strict union.
- The hang is real: the busy gap runs from 09-08T23:41:12Z to 09-16T22:01:05Z (190.3 h), and one attempt admitted at 23:41:14.664Z never finished. Reboots: 09-16 06:45Z and 09-05 16:06Z (last reboot, kern.boottime).
- The weekly-limit stop lasted 56.0 h (09-20 14:58:03Z to 09-22 23:00Z). Runs later abandoned took 118.5 of 153.3 busy hours (77.3%); the current run took 34.8 h.
- Full suites: be9c44ed8 gave 3284 pass / 0 fail and 9f0117cb7 gave 3291 pass / 0 fail. Package typecheck exited 0 on both, 00:14:11Z-00:43:57Z. The worktree HEADs match and their tracked files are clean.
- CI never runs the v24/v25 tests: ci.yml:177-183 runs typecheck:book plus pipeline:typecheck/test, which package.json:32-33 point at @chapterflow/v21-authored. pipeline24:* (:37-38) appears in no workflow.
- #559 is OPEN and CONFLICTING (mergeStateStatus DIRTY).
- Combined commit 9f0117cb7 is on no remote ref. origin/main is be9c44ed8 per ls-remote. `git log origin/main..HEAD` lists exactly the 10 cherry-picks for #566-#575.

## report

## Adversarial verification of H3, H4, H5a and H7 (plus the code, suite and CI checks)

I ran everything read-only. My scratch scripts are in `.../scratchpad/assess/verify/` (revs.js, reread.js, corr.js, busy2.js). Abbreviations used below:
- **RC** = `~/ChapterFlow-books-v25-completion` at 9f0117cb7
- **PKG** = `RC/scripts/book/prompts/chapterflow-v24-author-pipeline`
- **REV** = `~/cf-canary/books/the-autobiography-of-benjamin-franklin/reviews`
- **RS** = `~/cf-canary/run-state/books/the-autobiography-of-benjamin-franklin/runs`
- **EV** = the Franklin events jsonl (4,410 lines)

### Summary
Most of the numbers in H4, H5a and H7 hold when recomputed from primary data. The rest:
- **One count is wrong:** H3 says 36 merged PRs; there are 37.
- **Two claims are overstated:**
  - H3 says every fix held on the next run.
  - H5a gives the pass probability as "~1e-5 or less"; the measured rates give about 4e-5.
- **One defect was missed**, and it matters for fix E3. Even if the attempt journal kept the "weekly limit" wording, the driver's `provider_block()` would still not see it. It takes a line offset over a concatenation of all 371 journals in glob order, so the lines it greps are old lines from the alphabetically last file, not the new records.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1a | Panel verdict: a BLOCKER from any seat blocks (union) | CONFIRMED | PKG/src/app/semanticPanelReviewEvaluator.ts:361 comment "ANY seat's … blocking finding blocks (union, fail-closed)"; :363 pushes `READER.BLOCKING.*` as BLOCKER |
| 1b | Outcome is ERROR if any seat failed, else FAIL on any BLOCKER, else PASS | CONFIRMED | same file :315 `errored = true`; :389-393 `errored ? "ERROR" : issues.some(BLOCKER) ? "FAIL" : "PASS"`. A baseline that is not PASS short-circuits at :222 |
| 1c | Median floor is 70 | CONFIRMED | :328 `panel.medianComposite < AUTHOR_CHAPTER_BAR`; PKG/src/review/readerReview.ts:163 `AUTHOR_CHAPTER_BAR = 70`. There is 0 BELOW_FLOOR in any P1-P14 review |
| 1d | A quiz-key BLOCKER needs a strict majority | CONFIRMED | panelQuizAdjudication.ts:82 `seatCount = derivations.length`; :111 `group.length * 2 > seatCount && every(confidence==="high")`; :118 BLOCKER |
| 2a | Blocker series 34,27,21,17,13,19,15,9,18,9,10,15,16, then a partial ERROR | CONFIRMED | revs.js over REV: 06d7596a 34, 87c9dc3c 27, 37df51a2 21, ec0e30a8 17, 4a2acca7 13, 8aeae974 19, 5ebfffd3 15, 1720d489 9, 9827ee52 18, 585058c1 9, 1ca523b6 10, 052e2b67 15, ba9e7444 16. Then 35abdd05 ERROR: 7 BLOCKERs = 5 reader + 2 SEMANTIC_PANEL_READER_FAILED (ch16, ch17); only 15 FACTOR_SCORES chapters were read |
| 2b | 0 PASS; 22 canonical reviews in run 39a37d06 | CONFIRMED | 14 panels (13 FAIL + 1 ERROR), 4 baseline-only FAILs, 4 baseline ERRORs. All 34 reviews since 09-04: 28 FAIL, 6 ERROR, 0 PASS. EV maps 4625510a/12251929/6eb55d51 to run 755fb671 and 06d7596a…ba9e7444/35abdd05 to 39a37d06 |
| 2c | Skeptic seat about 62% | CONFIRMED | skeptic 141 of 228 reader blockers (61.8%); over the 13 FAIL panels, 139/223 (62.3%) |
| 2d | "Stationary ~14" | CONFIRMED, with nuance | P6-P13 mean = 111/8 = 13.9. P1→P5 did fall 34→13 before the plateau |
| 2e | 83% of blockers are single-seat | UNVERIFIABLE (semantic), consistent with bounds | corr.js mechanical bounds: 68.9% single-seat if matched on chapter+category (overcounts agreement); 93.9% if matched on chapter + normalized unit string (undercounts). 83% lies inside that range |
| 2f | P(all 19 chapters clean) "~1e-5 or less" | PARTLY TRUE | Measured clean rate on re-read = 61/104 = 0.587, and 0.587^19 = 3.9e-5. With 10 freshly repaired chapters (clean rate 0.36): about 3e-7. The upper end is ~4e-5, not ≤1e-5, and the model assumes chapters are independent |
| 3 | Identical chapter bytes re-read by a later panel draw ≥1 blocker about 41% of the time | CONFIRMED | reread.js hashed all 19 chapter files for each of the 14 panel candidates (P14 only the 15 chapters it read). 262 reads, 144 with a blocker. First reads 101/158 (63.9%); re-reads 43/104 (41.3%). 49 versions were read 2 or more times and 43 of them are mixed. ch08 a32d84b5 got 0,0,0,0,0,0 then 2 (P6-P12). Within the same renderer version (P1-8 vs P9-14, #573): 37/93 = 39.8% |
| 4a | MAX_REVIEW_SUCCESSOR_ORDINALS is a constant 3 | CONFIRMED | bookRunApplicationService.ts:1236. `grep -rn REVIEW_SUCCESSOR_ORDINALS src` finds only this file (lines 1236/1657/1672/1712); no env knob |
| 4b | reviewIsUncertain is true for any stored ERROR | CONFIRMED | :1262-1264 `review.ok ? review.value.outcome === "ERROR" : …RUN_TERMINAL`; the cause is ignored |
| 4c | #successorLanding treats every stored-ERROR ordinal as spent | CONFIRMED | :1716 `if (stored.ok && stored.value.outcome === "ERROR") continue;` returns undefined, which gives the :1657 "budget exhausted" |
| 4d | All 3 successors hold the weekly-limit 429 | CONFIRMED | REV b1066b7e 14:57:39.609Z, adc6eeef 14:57:47.485Z, 735da811 14:57:53.668Z: each ERROR with one REVIEW_EVALUATOR_ERROR "MODEL_PROCESS_FAILED:You've hit your weekly limit · resets Sep 22 at 7pm (America/Toronto) (api_error_status=429)". ~/cf-canary/fv8h-r1/r2/r3.log show `ordinal=1/3`, `2/3`, `3/3 label=review-repair-21-successor-N` |
| 4e | The attempt journal's 400-char head no longer contains the provider wording | CONFIRMED | RS/review-run-b1066b7e…/attempts.jsonl line 2: `stdoutHead={"duration_api_ms":0,"stop_reason":…,"usage":{…"cache_creation":{"ephemeral_1h_inp;route=claude-subscription-v1;…`; the head is exactly 400 chars (modelGateway.ts:384 `DIAGNOSTIC_HEAD_CHARS = 400`). grep for "weekly limit\|hit your" finds 0 in all 3 successor journals and 0 in reader-lane-run-faea7e76. For contrast, the August record in compiler-operator-retry-1-run-9722fb9d…/attempts.jsonl has `"result":"You've hit your weekly limit · resets Aug 18…` inside its head |
| 4f | So the driver's provider_block grep cannot fire | CONFIRMED, and there is a second cause | drive-franklin-v7.sh:38-40 greps `tail -n +$((1+L0))` of `cat runs/*/attempts.jsonl`. **Missed defect:** that tail is a line offset over a concatenation of 371 files in glob order. New successor records landed in file #359 (b1066b7e), #357 (adc6eeef) and #341 (735da811); the last file is #371, review-run-f33d7485 (mtime 09-07). The inspected tail is therefore old lines. The regex also covers `api_error_status…401` but not 429. "PROVIDER BLOCK" appears 0 times in franklin-v7b-driver.out and fv8h-r1..r3 |
| 4g | The reset does not clear the wedge | CONFIRMED | resetsAt 1790118000 = Tue Sep 22 23:00:00 UTC (`date -r`). The walk reads stored reviews only. autoresume.log still says "WEDGE STOP … doing nothing" at 09-23T00:53:23Z, after the reset. EV lines 4336/4373/4410 all read "successor budget exhausted" |
| 5a | No review COMPLETED, fresh-qc, rubric or promotion event since 09-02 | CONFIRMED | EV tally since 09-02 finds 0 such events. The phases seen are intake, research, seed, compile, review, repair. Last review:COMPLETED 08-28T05:39:34.066Z; fresh-qc 08-28T05:39:34.068Z; promotion 08-28T06:30:08.880Z. No `rubric` event exists in any of the 4,410 lines. 11 runs since 09-02, first event 09-04T04:11:51.791Z |
| 5b | 452 h wall since 09-04 | CONFIRMED | 09-04T04:11:51.791Z → 09-23T00:18Z = 452.1 h (now 01:05Z, so about 452.9) |
| 5c | About 153 h with a model call in flight (34%) | CONFIRMED | busy2.js is an independent union of RS attempt intervals (ABANDONED/unfinished excluded) plus 15 research-phase intervals from EV: 152.9 h strict, 153.4 h with a 5-min merge; 33.9% |
| 5d | Hang from 09-08 23:41Z to 09-16 | CONFIRMED (the cause cannot be verified) | Largest busy gap: 09-08T23:41:12Z → 09-16T22:01:05Z = 190.3 h. Unfinished attempt reader-lane-run-1c9ede96 admitted 09-08T23:41:14.664Z. `last reboot` shows Wed Sep 16 02:45 EDT (06:45Z) and Sat Sep 5 12:06 EDT; `kern.boottime` = Sep 16 02:44:59. `pmset -g log` starts 09-16, so a CLI hang cannot be told apart from machine sleep |
| 5e | 191 h hang+reboot / 56 h weekly limit / 45 h waiting for fixes / 77% on abandoned runs | CONFIRMED except 45 h, which is PARTLY verified | 175.1 + 14.4 + 2.2 = 191.6 h. 14:58:03Z 09-20 → 23:00Z 09-22 = 56.0 h. The fix-wait gaps are real (6.3, 5.3, 4.5, 4.4, 3.6, 3.5 h …), but the 5.3 h on 09-08 came from the operator killing the driver. The class labels are the investigator's. perrun.js rerun: current run 34.8 h; abandoned runs 118.5/153.3 = 77.3%. The classes sum to 452.0 h |
| 6a | Suite on origin/main be9c44ed8 = 3284/0; on 9f0117cb7 = 3291/0; typecheck clean; 00:14-00:44Z | CONFIRMED | suites-status.txt: typecheck exit=0 and test exit=0 for both, 00:14:11Z → 00:43:57Z. Final lines: "pass 3284 fail 0 … xenv 6 skip 17" (68 V25 files) and "pass 3291 fail 0 … xenv 6 skip 17" (70 V25 files). The worktrees are at be9c44ed8 and 9f0117cb7 with tracked files clean. Runner: package `npm run typecheck` (tsc -p . --noEmit) and `npm test` (tsx tests/run.ts) |
| 6b | CI does not run the v24/v25 tests | CONFIRMED | ci.yml:158 job "v21 Pipeline Typecheck + Tests" runs typecheck:book (:177), pipeline:typecheck (:180) and pipeline:test (:183). package.json:32-33 point those at `--workspace @chapterflow/v21-authored` (the only workspace, :9-10); `pipeline24:typecheck/test` (:37-38) are never invoked. `grep pipeline24\|v24-author .github/` finds nothing. Root `test` only globs app/lib/components/tests. tsconfig.book.json includes `scripts/book/**`, so v24 source is only type-checked |
| H3a | 20 live defects since 09-04 | CONFIRMED | Running log (phaseb-log-dedup.md) numbers #3-#19 plus #20 (line 76); #1/#2 are unnumbered (log line 21). There were also 2 unnumbered operator-induced wedges (#563/#564) |
| H3b | 36 PRs merged (#525-#564) | REFUTED | `gh pr list`: 37 MERGED into main (#525-#556 = 32, plus #558, #560, #562, #563, #564). #557 does not exist; #561/#565 are closed dependabot PRs |
| H3c | #1-#19 fixed | PARTLY TRUE | #1-#11 are fixed on main. #12-#19 are fixed only on local 9f0117cb7 via OPEN PRs #566-#569 and #572-#575 |
| H3d | "each fix held on the next run" | PARTLY TRUE | Verified: #10 (RS reader-lane eb311292 9/69 FAILED vs e7bac9d7 0/74); #14 (4 TIMED_OUT since 09-04, last 09-17T08:51:51Z); #15 (0 title BLOCKERs in reviews after 09-19T04:58); #19 (fv8h R1 elapsed=17396s). Exceptions: #9 (#558) never measured (fv8b/c/d CARRY_OVER_REJECTED_DRAFT 16/8/5 vs SKIPPED 133/79/48); #13's fix exposed #15; #18's fix #574 wedged on the next relaunch (log: "defect #19, follow-up to #574", fixed by #575); the merged quota fix #529 failed live, which is #20 |
| H3e | 10 fix PRs #566-#575 open, only on a local detached commit | PARTLY TRUE | All 10 are OPEN, but #570/#571 are concurrency features. Each PR has its own GitHub branch; #574 and #575 are stacked (bases v25/reader-doc-indent-declined and v25/disputed-review-successor). PR heads differ from the local cherry-picks (for example #567 is c71fb2850 on GitHub, 688ba6c71 locally). The combined 9f0117cb7 is on no remote ref (`git branch -r --contains` returns nothing; ls-remote finds 0). origin/main is be9c44ed8 (ls-remote) |
| H3f | #559 parked and conflicting | CONFIRMED | `gh pr view 559`: CONFLICTING, DIRTY, not draft |
| H4 | Run wedged by #20 | CONFIRMED | rows 4a-4g; driver tail: "BOOK_RUN_REVIEW_FAILED:canonical review successor budget exhausted after 3 ordinals" then WEDGE STOP 14:58:03Z. AUTORESUME.env still has LOG_PREFIX=fv8d and no ORDINALS knob; autoresume.sh forwards only 3 CHAPTERFLOW_* variables (:123-125) |