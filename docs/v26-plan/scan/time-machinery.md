# Scan lens: where time and calls go; machinery that only recovers from other machinery

Investigator report, 2026-09-27. Repo `/home/user/ChapterFlow` at `22e021d84` (origin/main). Read-only apart from this file.
`PIPE` = `scripts/book/prompts/chapterflow-v24-author-pipeline`. `REP` = `docs/v25/execution/assessment/reports`.
Scratch (0 model calls): `/tmp/claude-0/-home-user-ChapterFlow/48916df7-45f9-50d8-ad9d-e43b21e61800/scratchpad/scan/time-machinery/`:
`closure.py` (import closure of the book-run), `buckets.py` (closure LOC by function), `classify3.py` + `classified3.json` +
`diffstat-by-class.txt` (commit classes since 07-20), `costmodel.py` (cost model; rates backed out of the probe envelopes).
The local clone is shallow (50 commits), so the history came from a blobless bare clone of `origin/main` in the scratch dir (`hist.git`, 2,070 commits).
Tags: **VERIFIED** means I opened the file:line or ran the command here. **VERIFIED-report** means a 09-23 report says it and I read that
report line; its primary evidence (events, transcripts) is on the Mac. **INFERRED** means my own reasoning. **HANDOFF** means the owner's handoff.

## keyFacts

- VERIFIED-report: from 09-04 to 09-23, wall time was 452.1 h. Model calls were in flight for only 153.4 h (34%), and **77% of those busy hours went to runs that were later thrown away**. Stopped time was 298.7 h: 191.6 h an infrastructure hang or unattended machine, 56.0 h the weekly limit, 45.1 h waiting for pipeline-bug fixes and 5.9 h owner pause. Output: 11 runs and 0 books (`REP/live-history.md:14-16,155-166`).
- VERIFIED-report: **the money goes to grading, not writing.** Run C4 (`39a37d06`) spent 1,639 calls and about $593 API-eq to reach its wedge. Reader seats took 58%, compile 20%, repair 16%, baseline 4% and research 2% (`REP/quota-defect.md:117-127`). The compile attempt that produced the candidate cost about $11 (27 calls); the other roughly $109 of compile was 13 more rounds of retries and gates.
- VERIFIED: **effort is inverted.** Writers run at medium, and the graders that judge them run at xhigh (`PIPE/config/model-routing.json:6-11`). The writer went down to medium because "at high the section writer spent its whole 64k output budget on thinking" (`:3`). The Opus probe wrote a *whole* chapter at high with 5.6k thinking tokens (`docs/v26-plan/evidence/probe/envelope-call1-writer-opus5.json`).
- VERIFIED: **the v25 book-run touches only 49% of PIPE/src** (87,867 of 179,761 lines; `closure.py`). That 49% breaks down as: run control, recovery and persistence 30%; deterministic gates 25.5%; writer-input machinery (research, blueprint, dealing, prompts, scars) 22%; model graders 10%; source text and chapter map 3% (`buckets.py`). `orchestrator/` (27.8k lines, including the v24 writer that last shipped books), `bakeoff/` (15.9k) and `scratch/` (3.7k) are not on the path at all.
- VERIFIED: `bookRunApplicationService.ts` (3,890 lines) runs a 9-phase state machine (`:63-79`). It holds **11 retry, successor or ordinal ceilings** (`:295,309,340,379,424,438,459,510,1243,1248,1311`) and reads 6 of the pipeline's `CHAPTERFLOW_*` operator knobs (`:301,322,346,395,595,617`). Its `run()` method alone is 1,295 lines (`:2595-3889`). Counting the compiler, panel, QC, editor and research lanes, the book-run path carries **24 retry and successor budgets**.
- VERIFIED: **recovery machinery exists to recover from other recovery machinery.** Deterministic run ids plus immutable terminal records (`run-state/fileRunStore.ts:396,448,562`) mean every failure needs a successor walk. The walks need ceilings, the ceilings get burned by infrastructure, and that led to forgiveness counters: `MAX_FORGIVEN_INFRA_ORDINALS=2` (`:424`) and `MAX_PROVIDER_BLOCKED_SUCCESSOR_ORDINALS=3` (`:1311`). The second one exists because the successor walk burned its own successors on a 429 (`:1305-1311`).
- VERIFIED: **gate machinery recovers from gate collisions.** The code says so itself: a writer "had no legal move" because "SEC120 measures derivability against the STANDALONE tiers while SEC56 compels a specific and SEC129 caps how often one specific may repeat" (`PIPE/src/app/compilerApplicationPort.ts:95-102`). The fix was a new gate (SEC136) plus a livelock breaker (`:119`), on top of eviction (`:826`) and a pack cache.
- VERIFIED: **engineering since 07-20.** Of the 250 non-docs pipeline commits, 59 are run-control recovery and 60 are gate-convergence fixes (48% together). Only 26 (10%) touch the writer, content or review signal, and most of those arrived in the 09-25 quality wave. Recovery plus gate-convergence commits inserted about 47k lines (17.7k src, 26k tests). Writer/content commits inserted 23.4k (`classify3.py`, `diffstat-by-class.txt`).
- VERIFIED-report: **fixing the machine cost as much quota as running it.** In the exhausted week the pipeline used $826 API-eq, and the orchestration sessions (Opus 5 subagents plus the Fable orchestrator) used $766 (`REP/quota-defect.md:131-137`).
- INFERRED (`costmodel.py`, probe envelopes): a whole-chapter design (write, check, fix, re-check) costs about **$34 and ~77 calls for 19 chapters (≈2.3 h sequential, ≈50 min at 3 concurrent)**, or **about $22 and ~37 calls for 9 chapters**. Today's plan is $700–1,100 and 1.5–3 days "if nothing wedges" (`docs/v25/execution/README.md:89-90`). The whole-chapter design is roughly 25–40× cheaper and 20–40× less machine time. The owner's reading time becomes the bottleneck.
- INFERRED (§7): **18 of the 22 numbered defects and wedges that stopped runs since 09-04 come from machinery a whole-chapter script does not have.** The other 4 (JSON format, titles, a grader hallucination, the 429) have analogues, but none of them can wedge a script whose only state is "does the chapter file exist".

## 1. Where the time went (09-04 → 09-23; VERIFIED-report, `REP/live-history.md`)

| Bucket | Hours | Share of wall | Would a whole-chapter script have it? (INFERRED) |
|---|---|---|---|
| Model calls in flight (any run) | 153.4 | 34% | Yes, but about 1–3 h per book instead of 50+ h |
| …of which runs later abandoned | 118.5 | 26% | Largely no. A failed chapter costs one call, not a run |
| Infrastructure hang (seat call never answered; no watchdog; 09-08 23:41Z → reboot 09-16) plus unattended | 191.6 | 42% | The hang is possible, but a per-call `timeout` bounds it to minutes |
| Weekly limit (09-20 14:55Z → reset) and wedge #20 | 56.0 | 12% | The limit is still possible, but a book uses about 2% of the weekly cap instead of 40–70% |
| Waiting for pipeline-bug fixes (20 stops) | 45.1 | 10% | Mostly no (§7) |
| Owner pause or hold | 5.9 | 1% | — |

Current run C4, per stage (VERIFIED-report, `REP/quota-defect.md:115-125`, `REP/downstream-readiness.md:26-28`):
- Research: 29 min.
- Compile: 14 attempts over 15.9 h. That span includes a 4.6 h owner pause; the final attempt took 74 min.
- Review-repair loop: 14 panels and 21 ordinals over about 34 h, at about 1.7 h per round.
- Downstream stages have never run on this design. Estimates: fresh QC 3–7 h (190 sequential xhigh calls); each QC-repair link 5–9 h (about 263 calls); rubric 10–25 min.
- The sum to promotion, if nothing breaks, is about 40 busy hours. That matches the plan's "1.5–3 days" (`docs/v25/execution/README.md:63`).

## 2. Where the calls and dollars go today (per 19-chapter book)

| Stage | Calls | Calls per chapter | API-eq | Model / effort | Source |
|---|---|---|---|---|---|
| Research (chapter plus bibliography) | 42 | 2.2 | ~$10 | Sonnet 5 medium | quota-defect:118 |
| Compile, 4 packs, editor and retries (14 attempts) | 311 | 16.4 (minimum 5) | ~$120 | Sonnet 5 medium | :119 |
| One review-repair round (panel ~80, baseline 1, repair ~10) | ~91 | ~4.8 | ~$32.5 | Sonnet 5 xhigh (panel) / high (repair) | :121-124 |
| C4's 14 panels and 21 ordinals (to the wedge) | ~1,286 | ~68 | ~$460 | — | :125 minus the rows above |
| Fresh QC (171 quiz keys plus 19 fidelity) | 190 | 10 | never measured | Sonnet 5 xhigh / high | downstream-readiness:26 |
| QC-repair link, each | ~263 | ~14 | $60–90 | — | README:89 |
| Rubric (3 whole-book readers) | 3 | — | small | Sonnet 5 xhigh | downstream-readiness:28 |
| **C4 total to the wedge** | **1,639** | **~86** | **~$593** | | quota-defect:125 |

- The reader panel re-draws 18–27 seats per round, which is 24–32% of seat calls and about $6–8 a round. Nobody has root-caused them (`REP/quota-defect.md:26,42`).
- A byte-identical chapter drew a blocker on 41% of re-reads (`REP/panel-analytics.md:13`). So the 58% of spend that went to panels bought a noise floor. P(all chapters clean in one panel) is about 4e-5 at 19 chapters, 9e-3 at 9 chapters and 0.12 at 4 chapters (`costmodel.py`). The two August promotions were on a 4-chapter book.
- The 3 probe calls (one whole-chapter write plus two checks) cost $0.86 together, which is 1.4% of one review-repair round (`docs/v26-plan/ANALYSIS.md:40-50`).

## 3. Subsystems: LOC, what each does, and what a whole-chapter pipeline needs

LOC is `wc -l` over PIPE/src (VERIFIED). "In closure" is the static import closure of `src/app/bookRunComposition.ts`, including dynamic imports (`closure.py`).

| Subsystem (paths) | LOC | In book-run closure | What it does | Whole-chapter pipeline |
|---|---|---|---|---|
| Book-run state machine `app/bookRunApplicationService.ts` | 3,890 | yes | 9 phases; successor, supersession, forgiveness and ordinal walks; 11 ceilings | **Bypass** (freeze). Replace with a ~100-line loop over chapters |
| Run state and persistence: `run-state/`, `runtime/{modelGateway,executionPolicy,processSupervisor,modelErrors}`, `books/` (leases, candidate store, pack/edit caches), `qc/` stores | 13,544 | mostly | Durable runs and attempts, admission, reconcile, leases, caches | **Bypass.** Keep only: skip a chapter if its output file exists, a per-call timeout, and logging of the raw provider error |
| Compiler section loop `app/compilerApplicationPort.ts` | 2,967 | yes | 4 packs per chapter, gate retries (3), summary re-draft, eviction, avoid-rounds, pack cache | **Bypass** |
| Repair lanes (`app/candidateRepair*`, `contentRepairWorkflow`, `repair/`) | 3,424 | yes | Review-repair and QC-repair ordinals, identity guards, NO_CHANGE disputes | **Bypass.** A fix is one writer call given the checker's list |
| Research sidecars (`agents/researcher-*`, `researcher.ts`, `app/researchCandidateApplicationPort.ts`, `lib/researchRunManifest.ts`) | 6,249 | yes | Paraphrased claims, facts, cases and quotations per chapter (97% paraphrase per `scan/writing-path.md:11`) | **Bypass.** The writer reads the span |
| Writer-input machinery (`compiler/`, `librarian/`, `sections/{sectionTasks,dealtCases,chapterProse}`, editor contract, voice card, scars) | 16,078 | yes | Blueprint slot dealing, name/venue/exemplar plans, 64–80k-char task cards | **Bypass.** Replace with a one-page brief (the probe's is 3.4k chars) |
| Deterministic gates (`sections/sectionGate.ts` 4,289 with 132 SEC ids; `critics/*` non-semantic; blueprint gate; edit guard) | 26,560 | 22.4k | Block, retry, evict | **Bypass as gates.** Keep 2–3 as advisory smoke alarms: verbatim-quote check (with the footnote-marker fix), key-position spread, app validator |
| Model graders (`review/`, panel, baseline, rubric, QC evaluators, `critics/semantic/`) | 11,172 | 8.4k | 3-seat panel, baseline review, catalog rubric, quiz-key and source-fidelity judges | **Bypass.** One fact-and-key check call per chapter (Opus caught 7/7 plants). Reuse wording from `sourceFidelityJudge` if it helps |
| Source text, chapter map, quote grounding (`source/`) | 2,774 | 2.6k | Frozen source, 19-span map, heading titles, quote matcher | **Keep** (fix `[N]` footnote folding; `scan/reuse-v24-writer.md`) |
| Claude route (`runtime/claudeRoute.ts`, `promptRenderer.ts`) | 437 | yes | CLI argv and envelope parsing | **Keep** `claudeRoute` only |
| Publish, release, promote, verify (`publish/`, `release/`, `promoteBook.ts`, `verifyProductionPackage.ts`, `productionManifest.ts`) | 9,291 | release only, partly | Package to app | Keep the minimum path to the app; see `scan/publish-path.md` |
| CLI `cli.ts` | 7,505 | its imports reach 95% of src | 121 `case` verbs; `book-run` at `:7292` | **Bypass.** New one-verb script |
| Not on the path: `orchestrator/` (v24 authorRun etc.), `bakeoff/`, `scratch/`, `telemetry/`, `evidence/`, `lifecycle/`, `tools/`, `risk/`, `commands/` | 49,888 | 0 | v24 author-first, migration bake-offs, experiments | **Archive** (a new ~600-line script beats porting authorRun; `scan/reuse-v24-writer.md`) |
| Tests `PIPE/tests` | 137,695 (449 files) | — | v25 suite of 90 files and 43.6k lines. Not run in CI (`.github/workflows/ci.yml:183` → `package.json:33` = v21 workspace) | **Freeze.** New tests only for the script |

INFERRED: a whole-chapter pipeline reuses about 3–4k existing lines (source/map loaders, quote matcher, Claude route, app validator) plus about 600 new ones. The other ~84k lines on today's path are bypassed, not rewritten.

## 4. Machinery that exists only to recover from other machinery (VERIFIED code; live effect VERIFIED-report)

**Chain A: identity and immutability.**
- Root: run ids are derived from the parent run (`bookRunApplicationService.ts:874`, `derivedId`; e.g. `:1031-1033`, `:1593`, `:2193`). A terminal run is immutable and refuses re-entry (`fileRunStore.ts:448` "run … is terminal", `:562` "already has a different terminal outcome"), and a different definition is a CONFLICT (`:396`). So a single failed, killed or ERROR attempt makes that id permanently unusable.
- Successor walks followed, each with its own ceiling:
  - compile operator-retry slots: `#grantOperatorCompileRetry`, `:1570-1676`, 20, knob up to 50
  - review successors: `:1677-1822`, 3
  - fresh-QC successors: 3
  - QC judge runs: 5
  - QC-repair runs: 3
  - rubric runs: 3
  - review-repair ordinals and rounds: 20 and 2, knobs up to 50 and 10
- The ceilings then got burned by infrastructure, and that brought **forgiveness**:
  - `MAX_FORGIVEN_INFRA_ORDINALS=2` (`:407-424`).
  - #517 "forgive the LEGACY collapsed review-ERROR terminal reason".
  - `MAX_PROVIDER_BLOCKED_SUCCESSOR_ORDINALS=3` (`:1305-1311`), whose comment reads "Three is the minimum that recovers run book-run-39a37d06, whose successors 1-3 all hit the weekly limit".
- Forgiveness needs to classify provider errors: `providerBlockOfReview` (`:1283-1300`), #483, #529, #579. The durable journal went blind to them when the CLI envelope changed key order (`REP/quota-defect.md:14`).
- Code sha in the identity caused three wedges and #564 (`fileRunStore.ts:305-334`).
- Killed attempts go UNCERTAIN, which needs `--reconcile-unsettled` and `RECONCILED_UNSETTLED_ON_RESUME` (#563, dfb1f6fb, c4a1c198, 67e16d3c).

**Chain B: gates, cache and livelock.**
- Section gates with 3 bounded retries (`compilerApplicationPort.ts:84`) led to a durable cross-run pack cache "so compile converges monotonically" (c9f3c4a5).
- Cached packs that fail cross-chapter gates would then be reused forever, so eviction was added (21fa66fa, eddef305, 34a9ec42).
- A re-draft then "re-mints the same wording", so `ASSEMBLY_AVOID_MAX_ROUNDS=3` was added (`:811-826`, e9d4a013).
- Gate-vs-gate collisions left "no legal move", which brought SEC136 and `MAX_SUMMARY_REDRAFTS_PER_CHAPTER=1` (`:86-119`).
- Next came carry-over of the rejected draft (#558, its effect never measured; `REP/live-history.md:21,150`) and persistence of every rejected draft for diagnosis (#553).
- Separately, 9 commits patch SEC35 name-stopword false positives and 7 touch SEC120 folding (`git log --since=2026-07-20 --grep`).

**Chain C: review and repair.**
- The union-of-seats blocker rule gives a noise floor (41% of re-reads).
- To get past it, repair ordinals were raised from 20 to 40 by knob.
- Repairs of hallucinated blockers return NO_CHANGE. That led to disputed-review supersession (`:486-510`, `#supersedeDisputedReview` 147 lines at `:1823-1969`), then to re-applying the supersession on replay (9f0117cb), then to #19 `REVIEW_REPAIR_COMPLETED_MISMATCH`.
- A pattern-audit FAIL contradicting a passing deterministic audit got its own supersession path (R-287, `:1255-1270`).
- Unreliable seats led to seat retries (`laneOrchestrator.ts:247`, 4 attempts) and 18–27 re-draws per panel.

**Chain D: operator tooling outside the repo (VERIFIED-report).**
- The pieces: the driver `drive-franklin-v7.sh` with WEDGE STOP, PROVIDER BLOCK grep and PAUSE file; a launchd autoresume agent; and `AUTORESUME.env`, which does not forward the ordinal knob.
- Relaunching with its default of 20 would fall below the 21 ordinals already used (`REP/quota-defect.md:24`).
- The v25 plan's own final-run task tells a riding Opus session to "Number the defect (#21, #22, …)" and fix each one live through a PR workflow (`docs/v25/execution/prompts/S11-final-run.md`, Step 4). The plan budgets new wedges as normal operations.

**Chain E: engineering.**
- 59 run-control recovery commits and 60 gate-convergence commits since 07-20 (§5).
- 7 of the 14 v25 execution sessions (S03, S04, S05, S06, S08, S10, S11) exist to un-wedge or harden the machine rather than improve the text (`docs/v25/execution/README.md:71-84`).

## 5. Engineering effort since 2026-07-20 (VERIFIED: `hist.git`, `classify3.py`, manual overrides listed in the script)

| Class | Commits | Lines inserted (all / PIPE src / PIPE tests) | Examples |
|---|---|---|---|
| Run-control recovery (resume, wedge, successor, replay, ordinal, quota, timeouts, budgets) | 59 | 30.5k / 11.1k / 16.0k | #563, #564, #579, 9f0117c, 27f3115, 91395b2, a14761c |
| Gate convergence (livelock, eviction, retry cards, gate false positives, gate-vs-gate) | 60 | 16.6k / 6.6k / 10.0k | #556, #558, #551, SEC35 ×9, SEC120 ×7 |
| Per-book scars and pins | 25 | 2.4k | Franklin cycle 3–13 pins |
| Architecture, migration, release, test plumbing (mostly the July V4 migration) | 78 | 41.3k / 20.2k / 20.0k | 1d2288c9, a72ce08b, 13e30903 |
| Writer, content, review signal | 26 | 23.4k / 9.2k / 13.9k | #583, #585, #586, #587, #588, WP-1A/1C/2A |
| Throughput (concurrency) | 2 | 2.1k | 24cbe94, fb105fd |
| Web, CI, deps, and docs | 97 | — | — |

- Monthly counts (recovery / gate / writer): July 23/25/10, August 21/21/4, September 15/14/12.
- The writer-facing work arrived last, in the 09-25 quality wave, after 2 months of recovery work.

## 6. Cost model: today vs a whole-chapter design

- **Rates (VERIFIED by arithmetic).**
  - Opus 5 is $5 input, $25 output, $10 for 1-hour cache writes and $0.50 for cache reads. These rates reproduce both Opus envelope costs to the cent ($0.4478 and $0.2654).
  - Sonnet 5 is $2/$10/$4/$0.20 (as stated at `REP/quota-defect.md:114`). These reproduce call 2 ($0.1450). See `costmodel.py`.
- **Per chapter (INFERRED, from the probe).** Four steps, each at Opus 5 high:
  - write: $0.45, 167 s
  - fact-and-key check: $0.27, 42 s
  - fix, assumed on every chapter: about $0.55, about 3 min
  - re-check: $0.27, 42 s
  - Total: about **$1.5 and about 7 minutes** sequential. The 9-chapter layout doubles the source per call: about $2.1 per chapter.

| | Today (v25, 19 ch) | Whole-chapter, 19 ch | Whole-chapter, 9 ch |
|---|---|---|---|
| Calls per chapter | ~86 (C4 to the wedge); minimum 5 writer calls plus panels and QC | 4 (write, check, fix, re-check) | 4 |
| Calls per book | 1,639 to the wedge; plan to promotion ≈ 2,000–2,500 (INFERRED from README:89) | ~77 (plus 1 book-level read, plus 10% retries) | ~37 |
| API-eq per book | $593 to the wedge; $700–1,100 planned | **~$34** | **~$22** |
| Machine time | 50 h to the wedge; 1.5–3 days planned "if nothing wedges" | 2.3 h sequential, ~50 min at 3 concurrent | ~1.1 h sequential, ~25 min at 3 concurrent |
| Share of a ≈$1,600 weekly cap | 37–69% | ~2% | ~1.4% |
| Human time | an Opus session riding for 1.5–3 days, plus fix PRs | owner reads about 70k words (≈4–5 h) | owner reads ~40–60k words |

INFERRED: at these prices the owner can afford to iterate on the brief. For example, 10 variants of 2 chapters costs about $30, less than one v25 review-repair round. The limit becomes how fast the owner can read and judge, not the machine or the quota.

## 7. What ended runs, and whether a whole-chapter script would have it

Defects are those numbered in `REP/live-history.md:84-112` (driver table). "No" means the mechanism does not exist in the small design (INFERRED from §3).

| Defect or stop | Mechanism | Small script? |
|---|---|---|
| #1, #2, #3: research meta-reference validator rejects the prompt's own templates; `--regen` re-research | research sidecar layer | No |
| #4, #5, #6, #7: SEC120/SEC128 livelock, number-word floor, SEC35 "undealt name" | section gates and dealing | No |
| #8: SEC119/SEC90 assembly livelock | cross-chapter gates plus pack cache | No |
| #9: carry-over (unmeasured) | compile rounds | No |
| Retry ceiling of 20 exhausted (fv7d) | operator-slot identity | No |
| sha-in-identity CONFLICT ×3 (fv7c, fv7k) | durable run identity | No |
| Operator kill mid-attempt, then `REVIEW_REPAIR_ATTEMPT_UNCERTAIN` (fv7j) | admitted-attempt ledger | No (a kill loses ≤1 call) |
| #11: repair "changed chapter identity" | repair-lane contract | No |
| #12: settled review lacks durable review; replay refused | exact-review replay | No |
| #13: frozen placeholder title "X" leads to NO_CHANGE | bibliography titles plus repair | No (titles are a checked-in map table) |
| #14: author@high thinks to the 64k cap, 3× 1800 s timeouts | 64–80k-char cards | No at probe scale (5.6k thinking at high); INFERRED, different model |
| #16: `REVIEW_REPAIR_FINDING_UNSCOPED` | pattern audit vs repair lane | No |
| #17: renderReaderDoc indent artefact | reviewer rendering | No |
| #19: `REVIEW_REPAIR_COMPLETED_MISMATCH` | ordinal bookkeeping | No |
| #10: 9/69 seat calls refused or decorated their JSON | model output format | **Analogue.** Parse, then retry once; the probe was valid first time |
| #15: 7/19 chapter titles invented | chapter map titles | **Analogue.** A one-time input table the owner checks |
| #18: hallucinated baseline blocker burned ordinals | grader error vs budget | **Analogue.** A false flag costs one fix call or a human "ignore" |
| #20: weekly-limit 429 stored as ERROR; burned 3 successors | quota vs successor walk | **Analogue.** The 429 can happen, but there is no durable state to burn; rerun skips finished chapters |
| 175 h hang (seat call never answered, no watchdog) | long unattended run | **Present.** Needs `timeout` per call; exposure is 1–3 h per book |
| 09-05 machine reboot (driver ran as a Claude background task) | host | **Present.** The loss is at most one chapter |

Totals: 18 of the 22 numbered defects and wedges are "No"; 4 have analogues; the 2 infrastructure events remain but are bounded.

- **Downstream walls ahead of H-B (VERIFIED-report).** None of these would exist in a small script. They are the next wedges for H-B:
  - The rubric gate and the source-fidelity judge have never run live (`REP/downstream-readiness.md:5`).
  - The deterministic fresh-QC stack fails even the unrepaired compile output (22 blockers, `:7`).
  - F4 is emitted with no location, and the QC-repair preflight refuses it (`:8`).
- **The defect rate is not falling.** C4 alone hit #16–#20: 5 new run-stopping defects in 34.8 busy hours, about one every 7 busy hours. Reaching promotion takes about 40 more busy hours, over stages that have never run on this code. INFERRED: H-B should expect several more defects (#21+), not a clean run.

## 8. Verdict on the diagnosis (through this lens)

1. **Assembled, not written: CONFIRMED and refined.**
   - Each chapter took 16.4 writer calls at medium effort; the minimum is 5.
   - Graders got 3× the writers' spend, at xhigh.
   - The single-writer probe cost less than one compile retry.
2. **The rules create the problems they fix: CONFIRMED, and it extends to the recovery code.**
   - 60 gate-convergence commits.
   - The code documents gate-vs-gate "no legal move" (`compilerApplicationPort.ts:95-102`).
   - Recovery counters were added to recover other recovery counters (§4 A).
3. **The format fights a memoir: outside this lens.** The cost model shows length and shape barely change cost; call count and grading dominate.
4. **Broken compass: CONFIRMED in money.**
   - 58% of C4's spend went to a panel whose byte-identical re-reads flag 41% of the time.
   - P(pass) is about 4e-5, and the loop is stationary.
5. **Accuracy baked in upstream: outside this lens.** Research is only 2% of spend: cheap, but its errors propagate.
6. **Over-engineered around the writing: STRONGLY CONFIRMED.**
   - Of the path's LOC: 30% run control, 25.5% gates, 22% writer-input machinery, 10% graders, 3% source.
   - Of commits since 07-20: 48% recovery or gate-convergence, 10% writer/content.
   - Fixing sessions used as much quota as the pipeline.

## 9. Implications for the plan

- **P1 is cheap enough to iterate, so do not gate it on machinery.** Two chapters cost about $3–4 per full attempt, so several brief variants are affordable. Measure the owner's reading time per chapter; it is the real throughput limit.
- **The P2 script needs only these durability features.** Each one answers a real run-ender in §7:
  - Per-call `timeout` (for example 15 min) and a kill.
  - Resume means "skip chapters whose output file exists". No run ids, ordinals or successors.
  - Stop on the first 429 or login error, and write the provider's raw message to the log.
  - Parse the JSON and retry once.
  - Run under `caffeinate` or on a host that does not sleep.
  - Titles and spans come from a checked-in table the owner has read.
- **Keep checks advisory.** A checker produces a list for one fix call and for the owner. No blocker is allowed to end a run, and no budget exists to exhaust.
- **H-B (keep v25 and run once) is the expensive bet.** It costs $700–1,100, 1.5–3 days of riding, an expected several new defects (§7), and orchestration quota about equal to the pipeline's (§4 E). Its graders cannot tell good text from bad (HANDOFF, Q08). Choose it only to measure v25, not to ship.
- **Freeze, do not delete, during P1.** Archiving `orchestrator/`, `bakeoff/` and `scratch/` (0 lines on the live path) and the v25 lanes is P2 cleanup once the script ships a book.
- **Quota hygiene.** Run the pipeline apart from orchestration sessions, which matched the pipeline's spend last week.

## 10. Open questions

- Output size and time on a long span. The 33.5k-char span, or a 9-chapter span of about 40k chars, has not been tested. One writer call would settle whether output stays under about 20k tokens and 5 minutes.
- Does the fix step converge in one pass? The probe tested write and check, not check-then-fix. One more call on `ch01.planted.chapter.json` with the Opus finding list would show it.
- How does the subscription weight Opus 5 against Sonnet 5 against the weekly cap? The model above uses list-price weighting (`REP/quota-defect.md:114`).
- The cause of the 175 h hang (sleep vs CLI hang) is unresolved (`REP/live-history.md:29`). A per-call timeout covers both.
- The commit classes are one analyst's regex-plus-manual split. The hashes are in `classified3.json` for a second pass.

## Adversarial verification

Verifier pass, 2026-09-27, read-only, 0 model calls. Re-runs are in `scratchpad/scan/verify-time-machinery/`: `closure.py` and `buckets.py` copied and re-run; the commit list regenerated from `hist.git` and `classify3.py` re-run; `costmodel.py` re-run against the envelope JSON.

| id | verdict | evidence (one line) |
|---|---|---|
| TM1 | PARTIAL | The phase table and shares match `REP/quota-defect.md:117-127`, and the routing matches `model-routing.json:3,6-11` (fidelity is high, not xhigh). But "the attempt that produced the candidate cost ~$11 and the other ~$109 was retries and gates" is wrong. The durable pack cache (`compilerApplicationPort.ts:298-305,721-723`, c9f3c4a5) reuses gate-passed packs, and 27 calls cannot draft 19×4 packs plus the editor. So most of the candidate's text was drafted and paid for in the earlier attempts. Deterministic gates cost no calls. |
| TM2 | CONFIRMED (report-level) | `REP/live-history.md:14-16` and `:155-166` give 452.1 h, 153.4 h (33.9%), 118.5 h (77%), 191.6/56.0/45.1/5.9 h, 11 runs, #1-#20 plus 2 unnumbered wedges (#563, #564). The window is 09-04 to 09-23 00:18Z, not to today. The primary evidence (RS, EV, DRV) is on the Mac. |
| TM3 | CONFIRMED | Re-run: 236 files, 87,867 of 179,761 lines (49%). Buckets are 30.0 / 25.5 / 22.3 / 9.6 / 3.0%; the remainder is the compiler loop (3.4%) and types/schemas/assembly (6.3%). orchestrator, bakeoff and scratch are 0. The entry is right: `cli.ts:7292` → `runV4BookProduction` → dynamic import of `bookRunComposition.js` (`cli.ts:508`), and no computed dynamic imports exist in src. |
| TM6 | PARTIAL | The counts reproduce (59/60/25/26 and 77 vs 78 for architecture; monthly split identical), and $472+$294=$766 vs $826 is at `quota-defect.md:131-137`. But classes 1 and 2 are hand-picked hash lists (`RC`/`GC` in `classify3.py`), and about 20 of the 119 are arguably writer, prompt or content work. Examples: 7f386170 (author effort), 1de1dcc1 (prompt trust framing), de8d66fb (repair card), a0429724 (card-back rendering), 71c19cc1 and 688ba6c7 (chapter titles), and about 12 task-card or contract pre-statements (16daae36, f885bd9d, 0f870295, 4eda25b7…). A gate-driven writer-prompt share of 10-20% is definition-dependent. |
| TM7 | PARTIAL | The rates reproduce $0.4478, $0.1450 and $0.2654 exactly, and the model gives $1.54/ch, $34/77 calls (19 ch) and $22/37 calls (9 ch). However: the fix step ($0.55, converging in one pass) and the 9-chapter scaling are assumptions. "If nothing wedges" is ANALYSIS.md:212 wording, not README:63/89-90. 37% is C4-to-wedge; the plan's $700-1,100 is 44-69% of the cap. Opus-vs-Sonnet subscription weighting is unknown. |
| TM8 | PARTIAL | The 18/4 split is internally consistent (the §7 "retry ceiling of 20" row is not one of the 22). But #14 (thinking to the 64k cap) should be an analogue, not "No". The never-fixed repair-role thinking-to-cap failure (`REP/live-history.md:20`: review-repair-7/-2/-13) is exactly the whole-chapter fix-call shape, and the probe measured Opus, not Sonnet. So the split is 17 No / 5 analogues. "Bounded by a per-call timeout" is also contradicted (see missed). |

**Missed (most important within this lens).** The largest time bucket, the 175.1 h hang (42% of wall time), happened with a per-call timeout already in place. Every model call runs under `processSupervisor.ts:116` `setTimeout(() => requestStop("TIMED_OUT"), spec.timeoutMs)`, with profiles of 300 s to 1,800 s (`runtime/executionPolicy.ts:15,25,61,96,106`). The same line is present at the 09-08 run revision `be9c44ed`, and it did fire elsewhere (the 3× 1,800 s TIMED_OUT of #14). So the report's remedy, "a per-call `timeout` bounds it to minutes" (§1, §7, TM8), is not established. The hang most likely came from the host (machine sleep suspending the process) or from something outside the supervised child. `REP/live-history.md:29` leaves it open. The P2 script's durability for this bucket rests on the host, which needs caffeinate or a no-sleep host plus an external wall-clock watchdog, not on an in-process timer.
