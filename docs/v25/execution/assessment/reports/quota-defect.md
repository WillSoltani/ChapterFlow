# quota-defect

## keyFacts
- VERIFIED: The run checkout is detached at 9f0117cb7 and origin/main is be9c44ed8 (git log/rev-parse). Tracked src/ is clean; only untracked docs and artifacts show.
- VERIFIED: The weekly limit already reset at 2026-09-22T23:00Z (quotaLimits.resetsAt=1790118000, rateLimitType seven_day, in the successor-1 transcript). It is now 2026-09-23T00:35Z.
- VERIFIED: The round-3 re-review review-35abdd05 is stored as outcome ERROR (completedAt 14:57:37.268Z). It read 15 chapters (ch01–ch15), holds 5 real reader BLOCKERs plus SEMANTIC_PANEL_READER_FAILED for ch16 and ch17 with the weekly-limit message. ch18 and ch19 were never dispatched.
- VERIFIED: 4 reader seats hit the 429: ch16 seat-cold-a2 at 14:55:25Z and ch17's three seats at 14:55:46Z (reader-lane-run-faea7e76…/attempts.jsonl: 70 admitted, 66 SUCCEEDED, 4 FAILED).
- VERIFIED: Successors 1–3 (reviews b1066b7e, adc6eeef, 735da811) each hold exactly one BLOCKER, REVIEW_EVALUATOR_ERROR 'MODEL_PROCESS_FAILED:You've hit your weekly limit…'. These came from the BASELINE structural reviewer, not from reader seats. The transcripts show 0 tokens used.
- VERIFIED: Successor-1 was minted inside the same invocation that stored the ERROR (STARTED at 14:57:37.281Z; driver R1 exit line reads 'review-successor … ordinal=1/3'). R2 and R3 burned ordinals 2 and 3; R4–R6 hit 'budget exhausted'; WEDGE STOP at 14:58:03Z.
- VERIFIED: reviewIsUncertain (bookRunApplicationService.ts:1262-1264) returns true for ANY stored ERROR regardless of cause. #successorLanding (:1716) skips every stored-ERROR ordinal as spent. MAX_REVIEW_SUCCESSOR_ORDINALS=3 is a constant (:1236), not an environment knob.
- VERIFIED: A stored failed evaluator becomes a durable ERROR record in reviewService.ts:266-283 (REVIEW_EVALUATOR_ERROR at :279), persisted at :295. modelGatewayReviewEvaluator.ts:233-241 makes one call with no provider-block check.
- VERIFIED: #529 (81b4387c6) changed only message preservation (modelGateway.ts:450), the compile section fail-fast path, the panel stop-claiming change (semanticPanelReviewEvaluator.ts:293) and the retryable flag. It did not touch the successor walk. No tests/v25 test covers the successor walk under a provider block.
- VERIFIED: The #529 reviewer (journal wf_fd96f711-477) returned APPROVE with reproducedRed true and a local suite of 2880/0. The same reviewer flagged a 'major' residual: a review-stage block surfaces as 'canonical review outcome=ERROR' with no provider words, so the driver grep stays blind. The message at bookRunApplicationService.ts:3327 is unchanged.
- VERIFIED: The durable attempt journal is now blind to quota errors. terminalDetail stores a raw 400-character stdout head (modelGateway.ts:384,390-396,498-520). On 2026-08-16 the envelope began with type/is_error/result; on 2026-09-20 (CLI 2.1.265) it begins with duration_api_ms/usage, and 'weekly limit' is cut off.
- VERIFIED: drive-franklin-v7.sh provider_block() greps only new attempts.jsonl lines for 'weekly limit|usage limit|session limit|Not logged in', so PROVIDER BLOCK STOP never fired. fv8h-r1.log's terminal line is 'BOOK_RUN_REVIEW_FAILED:canonical review outcome=ERROR'.
- VERIFIED: grep for 'weekly limit'/'session limit'/'hit your' matches 0 of 264 ~/cf-canary/*.log files and 0 lines in franklin-v7b-driver.out.
- VERIFIED: There were 3 limit events since 09-02 (transcript quotaLimits): five_hour session limits on 09-02 ~20Z (2 session + 6 subagent calls) and 09-03 06–07Z (4 session + 77 subagent calls), and the seven_day weekly limit on 09-20 14:55Z (7 pipeline calls).
- INFERRED (from bookRunApplicationService.ts:1784-1800 and :508): a quota 429 during a disputed-review successor would permanently wedge the run. The replay steps past the stored ERROR to an unstored ordinal and fails closed with 'restore that successor review or start a fresh run'.
- INFERRED (from candidateRepairApplicationPort.ts:1492-1494 and bookRunApplicationService.ts:1983-1990,3016-3036): a writer 429 in a review-repair ordinal gives REPAIR_MODEL_FAILED, and the ordinal is SPENT with no forgiveness in that lane. One of the 40 ordinals burns per invocation (21 already used).
- INFERRED (from candidateQcEvaluator.ts:715-723,896-905 and bookRunApplicationService.ts:2255-2268): a QC-judge 429 marks the judge run FAILED, and every resume takes the next of MAX_QC_JUDGE_RUNS=5 without needing consent.
- INFERRED (from catalogRubricPanelEvaluator.ts:279-287 and bookRunApplicationService.ts:2468-2482): a rubric 429 marks the rubric run FAILED, and every resume burns one of MAX_RUBRIC_RUNS=3. The run ids derive from the candidate, so the burn survives into a fresh run on the same candidate.
- INFERRED (from bookRunApplicationService.ts:626-641,2770-2775): a provider-blocked BASE compile makes every later resume fail with BOOK_RUN_COMPILER_RETRY_BLOCKED, which needs a fresh run. Retry and operator slots burn one per flagged resume; 14 were burned on 2026-08-16 in 4 minutes before #529.
- INFERRED: The run cannot resume even though the reset has passed. #successorLanding reads only stored reviews, and all 3 are ERROR; events 4336/4373/4410 show the same answer on every resume.
- INFERRED: An autoresume relaunch would run with CHAPTERFLOW_REVIEW_REPAIR_ORDINALS at its default of 20, which is below the 21 already used. autoresume.sh forwards only 3 variables and AUTORESUME.env lacks the ORDINALS knob.
- VERIFIED: The CI job 'v21 Pipeline Typecheck + Tests' (ci.yml:158-183) runs pipeline:typecheck/test, which package.json:32-33 points at @chapterflow/v21-authored. CI green is not evidence for v25 code.
- VERIFIED (transcripts): one full reader panel is about 80 seat calls (57 seats plus 18–27 re-draws, confirmed in reader-lane attempts at 75–84 admitted). It emits about 2.06M output tokens (1.79M of them thinking), about 1.04M cache writes and 0.36M cache reads, over 55–60 minutes.
- VERIFIED (transcripts): the baseline structural review is 1 call with a median of about 21K output tokens (15–39K) and about 232K cache writes (about 348K before #572), taking 4–6 minutes. A multi-chapter repair ordinal has medians of about 10 calls, 291K output tokens and 874K cache writes, over 30–50 minutes.
- VERIFIED (transcripts): all 14 compile attempts together used 311 calls, 5.50M output tokens, 16.15M cache writes and 15.9 hours. The final successful attempt alone used 27 calls and 0.52M output tokens. The whole current run to the wedge used 1,639 calls, 39.1M output tokens and 50.2M cache writes.
- INFERRED (list-price weighting, Sonnet 5 $2/$10/$4 for 1-hour cache writes/$0.20): one review-repair round is about $32.5 API-equivalent (panel $24.9, baseline $1.2, repair $6.4). The last invocation measured $95 for about 3 rounds.
- VERIFIED (transcripts): in the exhausted week (09-15 23:00Z → 09-20 14:55Z) the pipeline cost $826 API-eq (52%), Opus 5 subagents $472 (30%) and the Fable 5.1 orchestrator $294 (18%), for a total of about $1,600.
- INFERRED (estimate; basis is about $1,600 API-eq per week equal to consumption from reset to the 429, with list-price weighting): roughly 22–25 review-repair rounds fit in one week at last week's orchestration load, and about 45–49 if the pipeline had the quota to itself. Wall time allows about 98 rounds a week, so quota is the binding limit.
- VERIFIED (transcripts): since the 09-22 23:00Z reset, this assessment's Opus 5.5 agents have used 0.67M output tokens, 2.65M cache writes and 133M cache reads, about $57 API-eq or about 3.6% of last week's proxy.
- INFERRED: The minimal recovery is F1, which forgives provider-blocked stored-ERROR successor ordinals under a bounded cap of at least 3 (or makes the ceiling an env knob and resumes with 4). A manual resume with CHAPTERFLOW_REVIEW_REPAIR_ORDINALS=40 would then run review-repair-21-successor-4 (about $26 and 1 hour) with no fresh run. Deleting the stored ERROR JSONs would instead cause BOOK_RUN_REVIEW_UNAVAILABLE (bookRunApplicationService.ts:1057-1063).

## openQuestions
- How does the subscription weekly limit weight tokens: output against cache writes against cache reads, and Sonnet 5 against Opus 5, Opus 5.5 and Fable 5.1? The rounds-per-week figure assumes list-price weighting. Reading the account usage percentage (claude.ai settings) before and after one measured panel round would settle it.
- Did usage outside these transcripts count toward the same weekly cap during 09-15 to 09-20 (claude.ai web or mobile, another machine)? If so, the ~$1,600 cap proxy is too low. The account usage page would settle it.
- Which Claude CLI version changed the error-envelope key order (result moved after usage)? And is the in-memory classifier (classifyClaudeStdout parses the full JSON) still safe on every error shape? The fixtures in tests/v25/v4-claude-route.test.ts use the old key order; a fixture built from the 2026-09-20 envelope would confirm.
- Do any tests pin terminalDetail's exact format, so that adding a classified provider message (F2) breaks a security or format test? Running model-gateway.test.ts and v4-claude-route.test.ts on a branch would show it. Running them now was not allowed, because the suite is busy in other worktrees.
- Does the production composition pass a chapterConcurrency other than the default of 3? The in-flight burn bound of 9 calls assumes the default; the bookRunComposition/cli wiring was not traced.
- Research lanes (researcher-chapter and researcher-bibliography rethrow on a provider block): is the failed research run durable, and does it burn a bounded budget on resume? Not examined, since the current run is past research.
- What causes the 18–27 seat re-draws per panel (about 24–32% of seat calls): strict-assembly rejections or MODEL_OUTPUT_INVALID? It is a large quota lever that was outside this scope. The attempt details in reader-lane-run-*/attempts.jsonl for the -a2/-a3 attempts would settle it.
- Owner decision: F1 as a forgiveness predicate (prevents recurrence together with F2) or as the one-line CHAPTERFLOW_REVIEW_SUCCESSOR_ORDINALS knob (unblocks only). And should F2 be the gateway journal change (fixes every lane) or only the terminal-message change plus a driver edit?

## report

## Defect #20 and quota economics: status assessment (read-only)

Checkout: `~/ChapterFlow-books-v25-completion` at detached `9f0117cb7` (origin/main `be9c44ed8`). Tracked `src/` is clean; only untracked docs and artifacts show. Current time is 2026-09-23T00:35Z. The weekly quota already reset at 2026-09-22T23:00Z. The run still cannot resume, because the wedge is durable state in the run, not the quota itself.

### 1. Bottom line
- **#529 stopped the burn inside one panel, but not the burn across the successor walk.** The reader lane classified the 429 correctly and stopped claiming chapters: ch16 and ch17 failed and ch18/ch19 were never dispatched. The panel then returned `outcome: ERROR`, and that ERROR was stored durably.
- **The successor walk treats every stored ERROR as "transient uncertainty".** It minted `review-repair-21-successor-1` in the same invocation, 13 ms after the ERROR review was stored (`completedAt 14:57:37.268Z`, successor STARTED at `14:57:37.281Z`). The successor's baseline reviewer hit the same 429, and that ERROR was stored too. Two driver relaunches burned successors 2 and 3. Every resume after that fails closed.
- **The driver's PROVIDER BLOCK STOP never fired, for two reasons:**
  - The `#529` reviewer flagged this on 2026-09-02 as "major, not blocking": the review-lane terminal message is just `canonical review outcome=ERROR`, with no provider wording in it.
  - The durable attempt journal no longer carries the provider wording. Claude CLI 2.1.265 now emits the `usage` object before `result`, so "weekly limit" falls past the 400-character `stdoutHead` cap.
- **The run cannot resume without a code change.** `MAX_REVIEW_SUCCESSOR_ORDINALS = 3` is a constant, not a knob. The landing walk reads only stored reviews, so nothing tied to time or environment can clear it.

### 2. Trace of the 429 through the run checkout (file:line)
| Hop | Code | What happened live |
|---|---|---|
| CLI error envelope | `src/runtime/claudeRoute.ts:166-179` `classifyClaudeStdout` parses the full JSON and returns `MODEL_PROCESS_FAILED:"You've hit your weekly limit · resets Sep 22 at 7pm (America/Toronto) (api_error_status=429)"` | Worked. The provider wording is in every stored review issue. |
| Non-zero exit | `src/runtime/modelGateway.ts:450-455` `providerFailureMessage` (from #529); `:668` call site | Worked. |
| Typed flag | `modelGateway.ts:185-189` `result()` sets `retryable:false` via `providerBlockKind` (`modelErrors.ts:36-39,67-77`) | In memory only. |
| Durable attempt journal | `modelGateway.ts:384` `DIAGNOSTIC_HEAD_CHARS=400`; `:390-396` `sanitizedStreamHead`; `:498-520` `terminalDetail` writes the raw stdout head | **Blind.** On 2026-08-16 the head began `{"type":"result",...,"is_error":true,...,"result":"You've hit your weekly limit…`. On 2026-09-20 it begins `{"duration_api_ms":0,"stop_reason":…,"usage":{…` and is cut at `ephemeral_1h_inp`, so "weekly limit" is absent (`runs/review-run-b1066b7e…/attempts.jsonl`). |
| Reader seat | `src/review/laneOrchestrator.ts:378-389` `isTransientReaderModelResult` returns false on a provider block, so no retry; `:569-580` throws `SEMANTIC_PANEL_READER_FAILED:MODEL_PROCESS_FAILED:…` | 4 seats hit the 429 (ch16 seat-cold-a2 at 14:55:25; ch17 ×3 at 14:55:46), per `reader-lane-run-faea7e76…/attempts.jsonl`. |
| Panel pool | `src/app/semanticPanelReviewEvaluator.ts:268-294` sets `providerBlocked` and stops claiming; `:312-321` records a `SEMANTIC_PANEL_READER_FAILED` BLOCKER and sets `errored=true`; `:389-393` returns `{ok:true, outcome:"ERROR"}` | review-35abdd05: 15 chapters read, 7 BLOCKERs (5 real, 2 infrastructure). |
| Baseline (successors) | `src/app/modelGatewayReviewEvaluator.ts:233-241` makes one call with no provider check and returns `REVIEW_MODEL_FAILED`, dropping `retryable`; `semanticPanelReviewEvaluator.ts:219` passes that through | Successors 1–3 each hold exactly one `REVIEW_EVALUATOR_ERROR "MODEL_PROCESS_FAILED:You've hit your weekly limit…"`. |
| Durable store | `src/review/reviewService.ts:266-283` turns a failed evaluator into a stored `ERROR` record (`:279`); `:295` `#store.create` | Four ERROR reviews stored at 14:57:37, 14:57:39, 14:57:47 and 14:57:53. |
| exactReview | `src/app/bookRunApplicationService.ts:1166` `reviewCanonical`, then the review run is finished COMPLETED; a later resume replays the stored ERROR at `:1057-1064` with zero model calls | |
| Successor gate | `:1262-1264` `reviewIsUncertain` is true for **any** stored ERROR and ignores the cause; `:3306` calls the walk right after each review-repair re-review; `:1617-1690` `#reviewSuccessor` mints one fresh panel per invocation | successor-1 minted in the same invocation (R1); R2 and R3 each minted one. |
| Spent ordinal | `:1706-1720` `#successorLanding`: `if (stored.ok && stored.value.outcome === "ERROR") continue;` (`:1716`); `:1236` `MAX_REVIEW_SUCCESSOR_ORDINALS = 3`; `:1654-1660` returns the exhausted error | R4–R6 each answered "canonical review successor budget exhausted after 3 ordinals"; events 4336/4373/4410 end in WEDGE STOP at 14:58:03Z. |
| Terminal message | `:3321-3328` message = `canonical review outcome=ERROR` with no provider wording | `fv8h-r1.log`: `BOOK_RUN_REVIEW_FAILED:canonical review outcome=ERROR`; 0 "limit" lines in fv8h-r1/r2. |
| Driver | `~/cf-wt/franklin-v7-tools/drive-franklin-v7.sh` `provider_block()` greps new `attempts.jsonl` lines for `weekly limit\|usage limit\|session limit\|Not logged in` | Found nothing (see the journal row), so the driver relaunched until WEDGE STOP. |

The #529 commit (`81b4387c6`) covered only message preservation, fast failure in the compile section loop, the panel stop-claiming change, and the retryable flag. Its reviewer returned APPROVE with `reproducedRed:true` and a local suite of 2880/0 (journal `wf_fd96f711-477`). That reviewer also recorded the review-stage terminal-message gap. No test in `tests/v25` exercises the successor walk under a provider block; the grep for weekly/quota/429 in `v4-book-run-service-resilience.test.ts` returns 0.

CI caveat, confirmed: `.github/workflows/ci.yml:158-183` runs `pipeline:typecheck` and `pipeline:test`, and `package.json:32-33` points both at `@chapterflow/v21-authored`. A green CI run on v25 PRs is therefore not evidence for v25 code.

### 3. Other lanes where a quota 429 is stored durably and burns a bounded budget
| Lane | 429 behaviour inside the run | Durable effect | Budget burned | Evidence |
|---|---|---|---|---|
| Canonical review successor (labels `review`, `review-repair-N`) | Panel stops; baseline makes no retry | ERROR review stored and ordinal counted as spent | 1 of 3 per label per flagged invocation; not a knob | Live: 3 of 3 burned in 16.4 s |
| Disputed-review successor (`disputed-<id>`) | Same | ERROR stored. The next invocation's replay (`ORDINAL_WALK_REPLAY`) steps past it to an unstored ordinal and fails closed with "restore that successor review or start a fresh run" (`:1784-1800`) | **Permanent wedge**; `MAX_DISPUTED_REVIEW_SUPERSESSIONS=1` (`:508`) | Code only; not observed live |
| Review-repair ordinals | Writer 429 gives `REPAIR_MODEL_FAILED` (`candidateRepairApplicationPort.ts:1492-1494`); no provider check, no retry | Repair run FAILED. The walk skips FAILED ordinals as spent; this lane supplies no `forgivableTerminalReason` (`:1983-1990`, `:3016-3036`). Chapters already rewritten in that ordinal are lost. | 1 ordinal per invocation out of `CHAPTERFLOW_REVIEW_REPAIR_ORDINALS` (default 20; this run uses 40, with 21 used) | Code |
| QC repair ordinals | Same `REPAIR_MODEL_FAILED` | Spent. Only `REPAIR_REVIEW_ERROR` is forgiven, up to 2 (`:422`, `:2042`) | 1 of `MAX_QC_REPAIR_RUNS` (3; driver sets 4) | Code |
| Fresh-QC judges (source fidelity, answer key) | One blind retry that is not provider-aware (`SOURCE_FIDELITY_MAX_ATTEMPTS=2`, `QUIZ_JUDGE_MAX_ATTEMPTS=2`), then `CANDIDATE_QC_JUDGE_UNAVAILABLE` (`candidateQcEvaluator.ts:715-723,896-905`) | Judge run FAILED (`bookRunApplicationService.ts:2255-2268`); the next resume takes the next ordinal with **no consent needed** | 1 of `MAX_QC_JUDGE_RUNS=5` (env 1–10) per resume | Code |
| Catalog rubric | Provider-aware; stops without retry (`catalogRubricPanelEvaluator.ts:279-287`) | Rubric run FAILED, no record (`:2468-2482`). Ordinal ids derive from the **candidate**, so burned ordinals persist even into a fresh run on the same candidate. | 1 of `MAX_RUBRIC_RUNS=3` (env 1–10) per resume, no consent | Code |
| Compile (sections, editor pass) | Fails fast on attempt 1 (`COMPILER_SECTION_PROVIDER_BLOCKED`, `CHAPTER_EDIT_PROVIDER_BLOCKED` at `chapterEditorPass.ts:360-366`) | Base compile blocked means resume is refused forever with `BOOK_RUN_COMPILER_RETRY_BLOCKED` (`:2770-2775`, `:626-641`), so a fresh run is needed. A blocked retry or operator-retry run consumes its slot, and each flagged resume grants the next. | 1 operator slot (20 default, up to 50) per flagged resume | Live, pre-#529: 14 operator-retry runs burned on 2026-08-16 between 00:10 and 00:14Z |
| Reader seats inside the run | No retry; pool stops | None | At most 9 in-flight calls (default `chapterConcurrency` 3 × 3 seats, `semanticPanelReviewEvaluator.ts:171`) | Live: 4 seats |

### 4. Proposed minimal fix (not implemented)
This fix obeys "never weaken a gate" (no verdict, bar, severity or consent changes) and "minimal diff".
- **F1: unblocks the run.**
  - Add a pure predicate over the stored record: an ERROR review is *provider-blocked* when any of its infrastructure BLOCKERs (`SEMANTIC_PANEL_READER_FAILED` or `REVIEW_EVALUATOR_ERROR`) has a message that `providerBlockKind()` classifies.
  - In `#successorLanding` (`:1706-1720`), walk past such an ordinal **without counting it against** `MAX_REVIEW_SUCCESSOR_ORDINALS`, under its own small forgiven cap. This mirrors the existing `forgivableTerminalReason` / `MAX_FORGIVEN_INFRA_ORDINALS` pattern at `:1949-1990`.
  - The cap must be at least 3 to recover this run. A genuine ERROR such as `MODEL_OUTPUT_INVALID` still spends an ordinal, `--reconcile-unsettled` is still required, and exhaustion still fails closed. It needs one resilience test: a stored provider-blocked successor is skipped, and a non-provider ERROR is still spent.
  - A smaller alternative that does not prevent recurrence: turn the constant into a `resolveBudgetEnv("CHAPTERFLOW_REVIEW_SUCCESSOR_ORDINALS", 3, 1, 10)` knob, following the #574 precedent, and resume with `=4`.
- **F2: prevents the next wedge.** The loop is burning about 22–25 rounds a week and is not converging, so another quota hit is likely.
  - Journal the route's classified provider message in `terminalDetail` (`modelGateway.ts:498-520`) whenever `classifyRouteStdout` returns one. This is the provider's error text, never model output. It restores what the driver's existing `provider_block()` grep expects, for every lane at once.
  - Optionally, append the provider wording to the `:3321-3327` terminal message. This is the #529 reviewer's residual.
  - Without F2, F1's forgiven cap would be consumed by a looping driver, because terminal lines that differ by ordinal number do not trip WEDGE STOP early.
- **Deferred (not blocking):**
  - Make the review-repair and QC-repair ordinal walks forgive a provider-blocked `REPAIR_MODEL_FAILED`.
  - Make the QC-judge and rubric walks stop on a provider block.
  - The disputed-successor permanent-wedge path.
- **Recovering the live run without a fresh run:**
  1. Put F1 (plus F2) on the checkout the same way as the earlier fixes.
  2. Relaunch manually with `RESUME_RUN_ID=book-run-39a37d06-59c8-430a-87fe-3ad3b19a1c14 CHAPTERFLOW_REVIEW_REPAIR_ORDINALS=40`. `autoresume.sh` does not forward this knob and `AUTORESUME.env` lacks it; the default of 20 is below the 21 ordinals already used.
  3. Expected: ordinals 1–21 replay with zero model calls (as they did at 14:57–14:58), `review-35abdd05` (ERROR) replays, successors 1–3 are skipped as provider-blocked, and `review-repair-21-successor-4` runs a fresh baseline plus a full panel on the unchanged candidate. Estimated cost is about $26 API-equivalent and about 1 hour.
  - Do **not** delete the stored ERROR reviews or run directories. `exactReview` would then find a COMPLETED review run with no review and answer `BOOK_RUN_REVIEW_UNAVAILABLE` (`:1057-1063`).

### 5. Quota economics
Token figures come from the CLI transcripts, de-duplicated by message id and keeping the maximum usage per message. "API-eq" means the tokens priced at list rates: Sonnet 5 at $2 input / $10 output / $4 for 1-hour cache writes / $0.20 cache reads. It is a relative weight only; how the subscription meters usage is not published. The pipeline's cache writes are all `ephemeral_1h`. Reasoning ("thinking") tokens make up 80–87% of reader and baseline output at `xhigh` effort.

| Phase (current run) | Calls | Output (thinking) | Cache write | Cache read | Wall time | API-eq |
|---|---|---|---|---|---|---|
| Research (09-18 12:33–13:02) | 42 | 0.57M (0.24M) | 1.11M | 0.19M | 29 min | ~$10 |
| Compile, all 14 attempts (09-18 13:02 → 09-19 04:58) | 311 | 5.50M (4.11M) | 16.15M | 1.38M | 15.9 h | ~$120 |
| — final COMPLETED attempt (operator retry 13) | 27 | 0.52M | 1.34M | 0.12M | 74 min | ~$11 |
| Reader panel, one round (median of 13 full panels) | ~80 (57 seats + 18–27 re-draws) | 2.06M (1.79M) | 1.04M | 0.36M | 55–60 min | ~$25 |
| Baseline structural review | 1 | ~21K (15–39K) | ~232K (348K before #572) | 4K | 4–6 min | ~$1.2 |
| Repair ordinal, multi-chapter (median of 12) | ~10 | ~291K | ~874K | ~43K | 30–50 min | ~$6.4 |
| **One review-repair round** | ~91 | ~2.38M | ~2.15M | ~0.41M | ~1.7 h | **~$32.5** |
| Whole run to the wedge (09-18 12:33 → 09-20 14:57) | 1,639 | 39.1M (31.2M) | 50.2M | 7.3M | 50 h | ~$593 |

Shares of the current run's API-eq: reader seats 58%, compile 20%, repair 16%, baseline 4%, research 2%. As a cross-check, the last invocation (09-20 10:07–14:56, about 3 rounds) cost $95 API-eq, which is about $32 per round and about $20 per hour.

**The exhausted week (Tuesday 2026-09-15 23:00Z until the 429 at 09-20 14:55Z):**

| Source | API-eq | Share |
|---|---|---|
| Pipeline (Sonnet 5): 52.1M output, 75.6M cache write, 10.5M cache read | $826 | 52% |
| Opus 5 subagents: 2.5M output, 25.5M cache write, 498M cache read | $472 | 30% |
| Fable 5.1 orchestrator: 0.48M output, 11.3M cache write, 174M cache read | $294 | 18% |
| Other | $6 | — |
| **Total (weekly-cap proxy)** | **≈ $1,600** | |

- The orchestrator and its subagents consumed about as much as the pipeline did. Within the current run's window alone, the pipeline was $593 against $596 for sessions.
- Session cost is dominated by cache reads, and how the subscription weights cache reads is unknown.
- Since the 09-22 23:00Z reset, this assessment's own Opus 5.5 agents have already used roughly $57 API-eq (about 3.6% of the proxy) in about 1.6 hours.

**Limit stops since 2026-09-02: three events.**
| # | When (UTC) | Limit | What it stopped |
|---|---|---|---|
| 1 | 09-02 ~20:xx | five-hour session limit (resets 6:40pm Halifax) | Orchestrator plus 6 subagent calls; 5 implementers and 1 reviewer died |
| 2 | 09-03 06:xx–07:xx | five-hour session limit (resets 5:40am Halifax) | 4 session and 77 subagent calls; 4 workflow agents killed. The running log says "~05:30 ADT"; the transcripts put the hits at 03–04 ADT. |
| 3 | 09-20 14:55 | seven-day weekly limit | The pipeline (4 reader seats plus 3 successor baselines); this is the current wedge |

The grep for "weekly limit" / "session limit" returns 0 of 264 files in `~/cf-canary/*.log` and 0 lines in `franklin-v7b-driver.out`. The operator logs cannot see limit events at all; only transcripts, review JSON files and pre-2.1.265 attempt records show them.

**Rounds per week (estimate):**
- **Basis:** the cap is taken as ≈ $1,600 API-eq per week, which is total consumption from the Tuesday 23:00Z reset to the 429. The resets on Aug 18, Sep 1 and Sep 22 are all Tuesdays at 23:00Z, and the limit type is `seven_day`.
- **Pipeline with the whole cap:** about 49 rounds, or about 45 if a fresh research and compile (≈ $130) is needed.
- **At last week's orchestration load:** about 25 rounds. The output-token cross-check agrees: 52.1M ÷ 2.38M ≈ 22.
- **So:** roughly 22–25 rounds a week with orchestration running as it did last week, and about 45–49 for the pipeline alone.
- **Wall time does not bind:** about 1.7 hours per round allows about 98 rounds a week.
- **Time to exhaustion:** continuous looping alone would drain the cap in about 80 hours; alongside last week's session load, in about 40 hours.
- **Convergence caveat:** the 13-panel blocker trend (34→27→21→17→13→19→15→9→18→9→10→15→16; the last five confirmed from the review files) is not converging. The quota buys rounds, not convergence.

Scratch outputs: `/private/tmp/claude-501/-Users-radinsoltani-ChapterFlow/c062400c-9b46-482f-921c-b35b71796a3e/scratchpad/assess/` contains `sessions.json`, `cur_sessions.json`, `window_0915.json`, `window_0922.json`, `w_fv8h.json`, `w_currun.json`, `usage.json`, and the `*.py` scripts.