# open-ledger

## keyFacts
- VERIFIED: origin/main = be9c44ed8 on the server (gh api branches/main). The run checkout ~/ChapterFlow-books-v25-completion is detached at 9f0117cb7 = be9c44ed8 + 10 local commits (git log origin/main..HEAD). All changes are inside scripts/book/prompts/chapterflow-v24-author-pipeline, and there are no conflict markers.
- VERIFIED: CI caveat holds with a nuance. The CI job 'v21 Pipeline Typecheck + Tests' runs pipeline:test = `npm run test --workspace @chapterflow/v21-authored` (ci.yml:157-189, package.json). v24/v25 tests are never run in CI; no workflow references pipeline24 or v24-author-pipeline. The job's 'npm run typecheck:book' step does typecheck 927 v24 src/test files (tsc -p tsconfig.book.json --listFilesOnly).
- VERIFIED: All 10 PRs #566-#575 show 'v21 Pipeline Typecheck + Tests pass' and 'E2E Smoke (dev build) fail'. The E2E dev-build failure also happens on main CI at be9c44ed8 (gh run view), and the journals attribute it to web-app spec e2e/no-duplicate-endpoint-requests.spec.ts:20/27.
- VERIFIED: #559 is CONFLICTING/DIRTY, has zero CI checks, and is NOT in the checkout (not an ancestor; 0 hits for ACCEPT_UNCONVERGED_AVOID_DRAFT in the checkout's compilerApplicationPort.ts). It conflicts with main only in tests/v25/v4-compiler-application-port.test.ts (merge-tree).
- VERIFIED: #559 was parked by design. The orchestrator log says 'NOT merged: hardening only; merge after the run'. The workflow wf_1b377279-3a4 ended with prNumber 'BLOCKED — no PR created' because the classifier denied the push, and the PR was then opened by hand. Review rounds: r1 FAIL/FAIL, r2 FAIL/FAIL, r3 PASS/PASS. 3283/0 was measured on base 34a9ec420 only.
- INFERRED (from the fv8 logs showing assembly evictions converging, and compile COMPLETED 2026-09-19T04:58:35Z): #559 is not needed for the current run. It only helps a future fresh compile.
- VERIFIED: 7 of the 10 checkout commits are patch-id identical to their PR heads (#566 is even the same SHA, dfb1f6fb6). #571 (24cbe9402), #574 (27f3115c2) and #575 (9f0117cb7) differ because of hand-resolved conflicts that no PR branch contains.
- VERIFIED (merge-tree simulation, deltas applied in order 566→575): #566-#570, #572 and #573 merge cleanly and each resulting tree equals the matching checkout commit (0 files differ). #571 conflicts in src/cli.ts. #574 conflicts in bookRunApplicationService.ts and v4-book-run-service-resilience.test.ts. #575 conflicts in bookRunApplicationService.ts and tests/v25/bookRunRepairRig.ts.
- VERIFIED: Pairwise conflicts that exist in every merge order: #570×#571 (cli.ts), #572×#574 (service file), #566×#574 (resilience test file), #566×#575 (service file + rig). The two #566 conflicts are NOT in the previously stated known-conflict list.
- VERIFIED: Merging #575 the naive way (merge-base be9c44ed8 after #573 and #574 are in) conflicts in 4 files: the service file, candidateRepairApplicationPort.ts, the rig and the resilience test. #574 and #575 must be retargeted to main and rebased; they cannot be merged as-is.
- VERIFIED: delete_branch_on_merge=false and main is unprotected (gh api returns 404 'Branch not protected'). #574's base is v25/reader-doc-indent-declined and #575's base is v25/disputed-review-successor, so without `gh pr edit --base main` a GitHub merge would land on the stack branch, not main.
- VERIFIED: be9c44ed8 is an ancestor of 9f0117cb7, so origin/main could be fast-forwarded to the checkout exactly. The pipeline subtree hash at 9f0117cb7 is b43cb4be2e345f30129ef6be197f9bd811554489.
- INFERRED (from the orchestrator log and journals, which record only targeted test runs on 24cbe9402, 27f3115c2 and 9f0117cb7): no full-suite run has been recorded on the combined checkout tree 9f0117cb7. One is currently running in ~/cf-wt/replay-cp-dry, which is at 9f0117cb7.
- VERIFIED: Full suite on each PR's own tree, per the journals: #566 3284/0; #567 3284/0; #568 3284/0 (run twice); #569 3287/0 in the journal vs 3286/0 in the orchestrator log (the sources disagree); #570 3286/0 (npm run ci); #571 3284/0; #572 3285/0; #573 3285/0; #574 3285/0; #575 3285/0.
- VERIFIED: An independent reviewer reproduced RED for every PR (redReproduced true, or 'reproduced' true for #568). Final-round verdicts were PASS/PASS for all of them. Earlier FAIL rounds: #569 (2 rounds), #570 (1), #571 (1 lens), #572 (1), #574 (1 lens), #575 (1 lens), #559 (2).
- VERIFIED: Every implementer and reviewer agent transcript in the 10 workflows ran on claude-opus-5; a few agents in wf_00472655 ran on claude-sonnet-5 (message.model in the agent-*.jsonl files). The commit trailers read 'Claude Fable 5.1', which is attribution text only.
- VERIFIED live #566: ~/cf-canary/fv7n-r1.log:19 'action=RECONCILED_UNSETTLED_ON_RESUME' and :20 'label=review-repair-6-successor-1 ... action=REVIEW_SUCCESSOR'.
- VERIFIED live #567 (partial): the fv8a research toc.json has 19 descriptive titles and no bare numerals. No log line shows the placeholder rejection-and-retry path firing (fv8a-r1.log:4 shows a single bibliography call).
- VERIFIED live #568: config/model-routing.json:7 is author effort 'medium'. TIMED_OUT compiler attempts since 09-16: 3, all at 2026-09-17T07-08Z (before the fix), and 0 afterwards.
- VERIFIED live #569: fv8c-r1.log:6-13 shows 'title-reconcile ... action=SOURCE_HEADING' for ch07/08/09/10/15/17/19 and '7 of 19 chapter title(s) taken from the source text's own headings'.
- VERIFIED live #570: max concurrent reader-seat attempts (reader-lane attempts.jsonl) went from 1 in the 09-07 window to 9 in the 09-20 windows. Panel wall time dropped from about 5h42m (09-07) to 56-60 min (09-20).
- VERIFIED live #571: fv8d-r2..r5.log:9 'compiler chapters=19 action=DRAFT_POOL concurrency=3'. Max concurrent compiler attempts in the current run's compiler runs: 3.
- VERIFIED live #572: fv8e-r1.log:23 'predecessorReviewId=review-120c5985...;reason=PATTERN_AUDIT_CONTRADICTION action=REVIEW_SUCCESSOR'. The successor review 5ebfffd3 has no PATTERN_AUDIT_DEFECT blocker.
- VERIFIED live #573: the card-back indentation BLOCKER appears in review-1720d489 (ch06) and in none of the 9 later reviews. REPAIR_CHAPTER_DECLINED fired only in single-chapter ordinals (fv8f-r2.log:33 ord 12; fv8g-r2.log:40 ord 15), so part B's mixed-ordinal carry path has never run live.
- VERIFIED live #574: fv8g-r2.log:41 'ordinal=15/40 action=DISPUTED_REVIEW disputedReviewId=review-3406164e... supersession=1/1', and event 2026-09-20T03:19:19Z 'label=disputed-review-3406164e...-successor-1;reason=DISPUTED_REVIEW'.
- VERIFIED live #575: fv8h-r1.log:40 'ordinal=12/40 action=DISPUTED_REVIEW ... supersession=1/1;replayed=true'. After it: ord 16-18 REVIEW_REPAIR_REPLAY, and fresh repairs 19-21 (ordinal=21/40). The driver marker reads '=== RESUME 2026-09-20T10:07:43Z on 9f0117cb7'.
- VERIFIED: Log side effect of #575 seen live: each resume writes a new 'review STARTED action=REVIEW_SUCCESSOR ... reason=DISPUTED_REVIEW' event with no model call behind it (10:07:46Z, then 14:57:42, 49, 55, 59 and 14:58:02Z). A reviewer had predicted this and marked it non-blocking.
- VERIFIED: Wedge state. The events show 'canonical review successor budget exhausted after 3 ordinals' at 2026-09-20T14:57:56Z and after. The driver marker reads '=== END 2026-09-20T14:58:03Z'. Review 35abdd05 is ERROR, with 2 SEMANTIC_PANEL_READER_FAILED plus 5 reader blockers. That is defect #20, which none of #566-#575 fixes.
- VERIFIED: #574's commit message still says 'Five of the eight fail on the pre-fix source', while the PR body (line 50) says 'Seven of the eight'. This is a cosmetic mismatch.

## openQuestions
- Does the full v25 suite pass on the combined checkout tree 9f0117cb7? Only targeted runs are recorded. It will be settled by the full-suite run now going in ~/cf-wt/replay-cp-dry (at 9f0117cb7): read its final 'pass N fail M' line and the 'v25-subprocess-suite: exit' line.
- Were the orchestrator's three hand resolutions (cli.ts for #571; the service file and resilience test for #574; the service file and rig for #575) reviewed by anyone? No journal shows an independent review of those combined commits. Settled by having a reviewer examine `git diff <PR head>^ <PR head>` against `git diff <checkout commit>^ <checkout commit>` for those three commits.
- #569's full-suite count: the journal records 3287/0, but the orchestrator log says 3286/0. A fresh `wt.sh verify source-heading-titles`, or reading the implementer's verify log if it was kept, would settle it.
- Has #567's placeholder rejection-and-retry path ever fired live? The fv8a bibliography looks like one call with descriptive titles. Settled by the bibliography attempt records or rejected/ files under research-runs/.../20260917T053441815Z-.../rejected.
- Has #573 part B (a declined chapter carried through a multi-chapter ordinal) ever run live? It has not so far; only single-chapter all-declined ordinals were seen. It has hermetic test evidence only.
- Owner decision on merge mechanics: Option A, merging each PR (3 manual rebases/resolutions plus 2 base retargets), or Option B, fast-forwarding main to a branch at 9f0117cb7 and closing #567-#575 as superseded.
- Should #559 be rebased and merged after the run, or closed? It has never had CI, it was verified only against base 34a9ec420, it has a pending MAX_FEEDBACK_BLOCKER_LINES token fix, and it has never been tested together with #571's parallel compile.
- #567 can falsely reject real one-word titles made only of roman-numeral letters (Civil, Mild, Vivid). #569 has no duplicate-title guard and lets a reconciled title skip the 200-character check. Both are flagged as owner decisions and are not relevant to Franklin.

## report

## Ledger of open PRs #559 and #566–#575 (v25 Franklin campaign)

Scope: this is a read-only investigation. Nothing in any checkout was modified. The only writes were `git merge-tree --write-tree`, which creates objects but no refs, plus scratch files under `.../scratchpad/assess/`.

### 0. Ground truth on git and CI

| Fact | Evidence |
|---|---|
| origin/main is `be9c44ed8` (#564), confirmed on the server | `gh api .../branches/main` returns `be9c44ed810909045737c44588655ea0aaa12cba`. `git ls-remote origin refs/heads/main` returns the same. |
| The run checkout is detached at `9f0117cb7`, which is main plus 10 local-only commits | `git -C ~/ChapterFlow-books-v25-completion log --oneline origin/main..HEAD` lists 9f0117cb7, 27f3115c2, a0429724d, 713536c11, 24cbe9402, fb105fd00, 71c19cc1e, 7f3861708, 688ba6c71, dfb1f6fb6 |
| The checkout's changes stay inside the pipeline package, and there are no leftover conflict markers | `git diff --stat be9c44ed8 9f0117cb7 -- . ':(exclude)scripts/book/prompts/chapterflow-v24-author-pipeline'` prints nothing. `git grep` for `<<<<<<<` / `>>>>>>>` in src and tests prints nothing. The pipeline subtree hash at 9f0117cb7 is `b43cb4be2e345f30129ef6be197f9bd811554489`. |
| Every PR head on the remote matches the local `origin/v25/*` ref | `git ls-remote` equals the local ref for all 11 branches |
| main has no branch protection. `delete_branch_on_merge` is false. Squash is the norm for v25 PRs. | `gh api .../branches/main/protection` returns 404 "Branch not protected". The repo settings JSON shows `deleteBranch:false`. The main log shows `(#564)`-style squash titles. |
| **The CI caveat holds, with one nuance.** The CI job "v21 Pipeline Typecheck + Tests" runs `npm run pipeline:test`, which is `npm run test --workspace @chapterflow/v21-authored`, the legacy package. **The v24/v25 pipeline tests are never run in CI.** However, the same job's first step, `npm run typecheck:book` (`tsc -p tsconfig.book.json`, which includes `scripts/book/**/*.ts`), does typecheck the v24 package. | .github/workflows/ci.yml:157-189. package.json scripts: `pipeline:test => ...--workspace @chapterflow/v21-authored`. `pipeline24:test` exists but no workflow references it: `command grep -rn "pipeline24\|v24-author-pipeline" .github/` prints nothing. `tsc -p tsconfig.book.json --listFilesOnly` lists 927 files under chapterflow-v24-author-pipeline/src or tests. |
| "E2E Smoke (dev build)" fails on every PR and also on main itself | `gh run view` for main CI at be9c44ed8 shows `E2E Smoke (dev build) failure`. The journals show the failing specs are web-app `e2e/no-duplicate-endpoint-requests.spec.ts:20/27`, which is unrelated to the pipeline. |

The practical meaning of the CI result: a green "v21 Pipeline Typecheck + Tests" check on PRs #566–#575 proves only that they typecheck under the root tsconfig. It proves nothing about v25 behaviour. The only test evidence for v25 is local: `wt.sh verify` and targeted test files, recorded in the workflow journals.

### 1. Per-PR ledger

In the table, "Journal" means `~/.claude/projects/-Users-radinsoltani-ChapterFlow/c062400c-.../subagents/workflows/<wf>/journal.jsonl`. Every implementer and reviewer agent transcript in these workflows ran on `claude-opus-5`, with a few scouts and the autoresume agent on `claude-sonnet-5`. That was checked from the `message.model` field in each workflow's agent-*.jsonl files. The commit trailers say "Co-Authored-By: Claude Fable 5.1", which is attribution text only.

| PR | Defect it fixes | Diff (gh) | Tests added | Review rounds (lens1/lens2) and RED reproduced | Full suite on the PR tree | CI (v21 job / E2E dev) | Mergeable now | In checkout | Live evidence in the Franklin run |
|---|---|---|---|---|---|---|---|---|---|
| **#559** v25/draft-time-avoid-phrase `74d5179d9` | Hardening, not a numbered defect. A re-draft that still carries a banned cross-chapter phrase (SEC90/SEC119/SEC83/SEC89) is refused at draft time instead of being evicted one compile round later. | +829/-1, 2 files: compilerApplicationPort.ts +312/-1, v4-compiler-application-port.test.ts +517 | R-172a..j,p (10 cases) | wf_1b377279-3a4: r1 FAIL/FAIL, r2 FAIL/FAIL, r3 PASS/PASS. Reviewers reproduced RED against base 34a9ec420: `summary pass=60 fail=4`. | 3283/0 on base 34a9ec420, from both the implementer and the r3 reviewer | **No checks at all** ("no checks reported") | **CONFLICTING / DIRTY** | **No.** It is not an ancestor, and there are 0 hits for `ACCEPT_UNCONVERGED_AVOID_DRAFT` in the checkout's port. | None. It was never deployed. |
| **#566** v25/interrupted-panel-reconcile `dfb1f6fb6` | Defect #12: a reader panel interrupted mid-flight (reboot) left the review run RUNNING with no stored review, producing `BOOK_RUN_REVIEW_FAILED:settled review call lacks durable review; replay refused` | +279/-2, 3 files | R-219 ×3 in v4-book-run-service-resilience.test.ts, plus the repair rig | wf_4e6f3ae2-413: r1 PASS/PASS, redReproduced true on both. The reviewer's RED: `FAIL [required] R-219 ... replay refused`. | 3284/0 | pass / fail | MERGEABLE / UNSTABLE | Yes. Same SHA dfb1f6fb6. | `~/cf-canary/fv7n-r1.log:19` `action=RECONCILED_UNSETTLED_ON_RESUME`; `:20` `label=review-repair-6-successor-1 ... action=REVIEW_SUCCESSOR` |
| **#567** v25/bibliography-placeholder-titles `c71fb2850` | Defect #13: 8 of 19 chapter titles were bare roman numerals ("X"), and title is frozen chapter identity | +140/-1, 2 files | Tests 9, 10, 11 in researcher-bibliography-retry.test.ts (11/11) | wf_53cc8abc-ed9: r1 PASS/PASS, RED reproduced | 3284/0 (the reviewer's first run was 3283/2 under CPU contention; the re-run was clean) | pass / fail | MERGEABLE / UNSTABLE | Yes. 688ba6c71 is patch-identical. | Partial. The fv8a research toc (`research-runs/.../20260917T053441815Z.../source-freeze/toc.json`) has 19 descriptive titles and no numerals. There is no log evidence that the rejection and retry path fired (`fv8a-r1.log:4` shows one bibliography call of about 55 s). |
| **#568** v25/author-effort-medium `892641c1b` | Defect #14: at effort high the author role used all 64k output tokens on thinking, and ch02 learning-pack timed out 3 times at 1800 s | +9/-7, 5 files (routing config, a tripwire assertion, 3 prose fixes) | One tripwire assertion in v4-model-routing.test.ts (17/17). It was shown to fail with author=high: `pass=16 fail=1`. | wf_6a94cccd-037: r1 PASS/PASS, reproduced true. One mustFix was about write-up wording only; the PR body has no fingerprint claim. | 3284/0, run twice | pass / fail | MERGEABLE / UNSTABLE | Yes. 7f3861708 is patch-identical. config/model-routing.json:7 is `"effort": "medium"`. | TIMED_OUT compiler attempts since 09-16: 3, all at 2026-09-17T07–08Z, before the fix. Zero afterwards. |
| **#569** v25/source-heading-titles `4739a0b83` | Defect #15: the bibliography LLM invented titles, and 7 of 19 differed from the edition headings in the frozen source. This was the root cause of the ch15 frozen-title wall. | +664/-2, 3 files (new src/source/chapterHeadingTitle.ts) | tests/source-heading-titles.test.ts (3 cases) | wf_29990bf6-7a0: r1 FAIL/FAIL (a label line such as "CHAPTER II." was taken as the title), r2 FAIL/PASS, r3 PASS/PASS. RED reproduced in every round. | The journal says 3287/0 (implementer, round-3 tree). The orchestrator log says 3286/0. **The two sources disagree.** | pass / fail | MERGEABLE / UNSTABLE | Yes. 71c19cc1e is patch-identical. | `fv8c-r1.log:6-13`: `title-reconcile ch07 ... action=SOURCE_HEADING` through ch19, then `7 of 19 chapter title(s) taken from the source text's own headings`. The fv8c toc shows ch15 as "Quarrels with the Proprietary Governors". |
| **#570** v25/parallel-reader-panel `074ce1d70` | Throughput (owner-chosen Plan B, 09-18). Reader-panel chapters and seats run concurrently: default 3 × 3 = 9 `claude -p` processes, with a `--reader-concurrency N` flag. | +1130/-155, 9 files | New v4-reader-panel-concurrency.test.ts, plus 4 modified tests and cli tests | wf_00472655-aa2: r1 FAIL/FAIL (the dial could not be reached from the CLI; the determinism claim was too broad), r2 PASS/PASS. RED reproduced. | 3286/0 via `npm run ci` (includes contract-validate) | pass / fail | MERGEABLE / UNSTABLE | Yes. fb105fd00 is patch-identical. | Max concurrent reader-seat attempts, computed from reader-lane-run-*/attempts.jsonl: **1** in the 09-07 window versus **9** in the 09-20 windows. Panel wall time went from about 5h42m (09-07 repair COMPLETED 17:42:28Z to verdict 23:24Z) to 56–60 min (for example, repair COMPLETED 03:26:56Z to review 9827ee52 completedAt 04:27:03Z). |
| **#571** v25/parallel-compile `e2af3eddc` | Throughput. Chapters compile concurrently (default 3), with a `--compile-concurrency N` flag. | +979/-12, 6 files | New v4-compiler-chapter-concurrency.test.ts (CONC-a..g) | Same workflow: r1 FAIL/PASS (the reported failure depended on timing rather than chapter order), r2 PASS/PASS. RED reproduced. | 3284/0 | pass / fail | MERGEABLE / UNSTABLE vs main. **It conflicts with #570 once #570 is merged.** | Yes, as 24cbe9402. **The patch differs** because cli.ts was hand-resolved. | `fv8d-r2..r5.log:9` `compiler chapters=19 action=DRAFT_POOL concurrency=3`. Max concurrent compiler attempts in compiler-*06d7596a*: 3. Compile COMPLETED at 2026-09-19T04:58:35Z. |
| **#572** v25/reviewer-reader-content `b5cf0ec62` | Defect #16: the structural reviewer flagged authoring-internal `planSpec` metadata as PATTERN_AUDIT_DEFECT, and the repair lane then refused it as REVIEW_REPAIR_FINDING_UNSCOPED | +405/-14, 5 files | R-287 cases, including a repair-lane case added in r2, plus model-gateway-review-evaluator tests | wf_d8504083-a32: r1 FAIL/FAIL (no test on the repair lane; comments contradicted the code), r2 PASS/PASS. RED reproduced. | 3285/0 | pass / fail | MERGEABLE / UNSTABLE vs main. **It conflicts with #574.** | Yes. 713536c11 is patch-identical. | `fv8e-r1.log:23` `label=review-repair-6-successor-1 predecessorReviewId=review-120c5985...;reason=PATTERN_AUDIT_CONTRADICTION`. The successor review 5ebfffd3 has no PATTERN_AUDIT_DEFECT (blockers: internal_contradiction 9, structurally_invalid 5, unsafe 1). |
| **#573** v25/reader-doc-indent-declined `37cbe9c89` | Defect #17. (A) The renderer indented card backs by 10 spaces, and the panel blocked on that. (B) One unchanged chapter failed the whole repair ordinal; it is now carried as REPAIR_CHAPTER_DECLINED. | +267/-15, 7 files | One renderer case, 2 repair-lane cases, and re-pins of the phase1 version | wf_d89d15fd-db6: r1 PASS/PASS. RED reproduced. | 3285/0 | pass / fail | MERGEABLE / UNSTABLE | Yes. a0429724d is patch-identical. | (A) The indentation blocker appears in review-1720d489 (ch06, `READER.BLOCKING.schema_or_app_breaking`). It does not appear as a blocker in any of the 9 later reviews. (B) `REPAIR_CHAPTER_DECLINED` fired only in single-chapter ordinals (`fv8f-r2.log:33` ord 12 ch14; `fv8g-r2.log:40` ord 15 ch14). **The mixed case (some chapters changed, one declined) has never run live.** |
| **#574** v25/disputed-review-successor `7e7da4517`, base **v25/reader-doc-indent-declined** (#573) | Defect #18: a hallucinated one-call structural blocker (ch14 quiz) makes the writer return the chapter unchanged, which burned ordinals. A disputed review gets one fresh successor under consent, and a new knob `CHAPTERFLOW_REVIEW_REPAIR_ORDINALS` (1–50, default 20) was added. | +483/-11, 3 files | R-288 / R-289 (8 cases; the PR body says 7 of 8 are RED on base) | wf_13fb3e1d-1d0: r1 FAIL/PASS (the premise needed #573; the bound across invocations was wrong), r2 PASS/PASS. RED reproduced. | 3285/0. The verify started before two comment-only edits, and the implementer disclosed this. | pass / fail | MERGEABLE / UNSTABLE, but only relative to its stacked base | Yes, as 27f3115c2. **The patch differs** (hand-resolved against #572 and #566). | `fv8g-r2.log:41` `ordinal=15/40 action=DISPUTED_REVIEW disputedReviewId=review-3406164e... supersession=1/1`. Event at 2026-09-20T03:19:19Z: `label=disputed-review-3406164e...-successor-1;reason=DISPUTED_REVIEW`. |
| **#575** v25/disputed-review-replay `8cd5499ce`, base **v25/disputed-review-successor** (#574) | Defect #19: on a later resume, the ordinal walk skipped the disputed ordinal without re-applying the dispute, which caused `REVIEW_REPAIR_COMPLETED_MISMATCH` (`fv8g-r3..r5.log:41`) | +699/-80, 4 files | R-290 cases (resilience file now 29 cases), including the live-shape regression case added in r2 | wf_a9c1e2e1-499: r1 PASS/FAIL (would have fired on live ordinal 8 and bought a panel nobody asked for), r2 PASS/PASS. RED reproduced. | 3285/0 (implementer r2 and reviewer r2) | pass / fail | MERGEABLE / UNSTABLE, but only relative to its stacked base | Yes, as 9f0117cb7. **The patch differs** (hand-resolved against #566). | `fv8h-r1.log:40` `ordinal=12/40 action=DISPUTED_REVIEW ... supersession=1/1;replayed=true`. Then ord 13–15 SKIP, ord 16–18 `REVIEW_REPAIR_REPLAY`, ord 19–21 real repairs. Event at 2026-09-20T10:07:46Z. |

#### Residual risks and non-blocking notes from reviewers (verbatim sources are in the journals)

- **#559:**
  - It was verified only on base 34a9ec420. Main has since gained #558 and #560, and the test file conflicts.
  - `allBlockerLines.slice(0, 8)` should use #558's `MAX_FEEDBACK_BLOCKER_LINES`.
  - Avoid refusals share the attempt budget, so an attempt-1 refusal followed by 2 transient failures is a new terminal path.
  - The third, unconverged draft is still stored with the banned phrase (`ACCEPT_UNCONVERGED_AVOID_DRAFT`).
  - SEC90 is matched as a whole word, while its gate uses a plain substring.
  - Its combination with #571's parallel compile has never been tested. The text merge onto 9f0117cb7 is clean except for the test file.
- **#566:**
  - An interrupted panel on a *successor* ordinal still cannot be recovered.
  - Log wording differs between `phase=canonical-review` and `phase=review`.
- **#567:** the roman-numeral regex flags real one-word titles such as "Civil", "Mild" and "Vivid" as placeholders. That would burn 3 attempts and abort the research. The corpus scan found 0 existing titles affected. The reviewer marked it as an owner decision.
- **#568:**
  - The change applies to the whole author role, which covers 11 callers, not only section packs.
  - A stale comment in executionPolicy.ts:113 still says "Sonnet@high".
- **#569:**
  - A label and title on one line are not split.
  - Any all-caps first line becomes the title, so a running head could give every chapter the same title, and no duplicate-title guard exists.
  - A reconciled title skips the 200-character check.
  - There is a crash window between the bibliography write and the manifest hash update.
- **#570:**
  - 9 concurrent subscription `claude -p` processes, with headroom never measured. This is relevant to defect #20, the weekly-limit 429.
  - Which error issues get recorded on a blocked run depends on timing (harmless).
- **#571:**
  - Determinism has an exception on the legacy-capacity resume path.
  - Rejected-draft carry-over depends on timing.
  - The cache-write lock (250 ms, LOCK_BUSY swallowed) can drop a pack write at concurrency above 1.
  - Reviewer advice: do not raise the default above 3 without a load test.
- **#572:**
  - The predicate matches on the error code, not the content: any FAIL made only of PATTERN_AUDIT_DEFECT, with a passing audit, gets one re-roll under consent. This is a small, consent-gated reduction in coverage by the LLM layer.
  - Each resume replay emits a phase event with no model work behind it.
  - The help text for `--reconcile-unsettled` is out of date.
  - renderReaderDoc still prints `implementationPlan.title`.
- **#573:**
  - The docHash changes for every chapter, so existing review carries go stale and panel reads are paid again.
  - The phase-log field `chapters=` includes declined chapters.
- **#574:**
  - The commit message still says "Five of the eight" fail on the pre-fix source. The reviewer counted 7, and the PR body says Seven.
  - It depends on #573 for its premise: if it were rebased off #573, the "all-declined" meaning would be false.
- **#575:**
  - The replay guard depends on `priorEvents`, which is filled only when `resumeRunId` is set.
  - A resume without consent that walks over an all-declined ordinal now fails closed instead of continuing. This is stricter and pinned by a test, but it is not described in the PR text.
  - A replayed supersession bypasses the bound, and no test exercises that path.
  - The dispute is attributed to ordinal 12, not ordinal 15.
  - **Seen live:** every resume writes another `review STARTED ... reason=DISPUTED_REVIEW` event, with no model call behind it. Events at 10:07:46, 14:57:42, 14:57:49, 14:57:55, 14:57:59 and 14:58:02Z.

### 2. #559: why it was parked, whether it is needed, and whether it is in the checkout

- **Why parked.** The orchestrator log says: "NOT merged: hardening only; merge after the run (or before any relaunch that re-enters compile)". The workflow's final step returned `prNumber: "BLOCKED — no PR created"` because the auto-mode classifier denied the push. The orchestrator opened the PR by hand at 10:12Z on 09-06.
- **Is it needed?** Not for the current run. Its compile finished at 2026-09-19T04:58:35Z. The assembly eviction cycles in fv8b/c/d all converged; the logs show EVICT_ON_ASSEMBLY_BLOCK counts of 47, 13, 2, 1, 43, 7 and 1, with no wedge. It would only reduce assembly rounds in a future fresh compile.
- **Is it in the checkout?** No.
- **To merge it, all of the following are needed:**
  - Rebase onto main, because the test file conflicts.
  - The one-token `MAX_FEEDBACK_BLOCKER_LINES` fix.
  - A local full-suite run, because CI has never run on it.
  - A check against #571's lifted `draftChapter` loop.
- **Recommendation under the "don't over-engineer" rule:** keep it parked until after the Franklin book ships, or close it.

### 3. Conflict map (read-only merge-tree simulations in ~/ChapterFlow-books-v25-completion)

Simulation 1: apply each PR's own delta to main, one at a time in order 566→575. For a conflicting step, continue from the checkout's resolved tree. The command per step was `git merge-tree --write-tree --merge-base=<PR parent> <current> <PR head>`.

```
#566 rc=0 → identical to checkout dfb1f6fb6 (0 files differ)
#567 rc=0 → identical to 688ba6c71
#568 rc=0 → identical to 7f3861708
#569 rc=0 → identical to 71c19cc1e
#570 rc=0 → identical to fb105fd00
#571 rc=1 CONFLICT src/cli.ts (4 hunks: usage string, allow-list, flag parse, validation)
#572 rc=0 → identical to 713536c11
#573 rc=0 → identical to a0429724d
#574 rc=1 CONFLICT src/app/bookRunApplicationService.ts (doc block + #reviewSuccessor eligibility/predecessor hunk)
               + tests/v25/v4-book-run-service-resilience.test.ts
#575 rc=1 CONFLICT src/app/bookRunApplicationService.ts (exactReview call moved by #575 loses #566's `reconcileUnsettled: false`)
               + tests/v25/bookRunRepairRig.ts (#566's `afterReviewRepair` hook vs #575's `completedAgainstReview` + `[REPAIRED_CHAPTER]`)
```

Pairwise conflicts. These are inherent, so no merge order avoids them:
- #570 × #571 conflict in cli.ts.
- #572 × #574 conflict in bookRunApplicationService.ts.
- **#566 × #574** conflict in the resilience test file.
- **#566 × #575** conflict in the service file and the rig.
- #559 conflicts with main itself, in the test file.

The two conflicts involving #566 are **not** in the known-conflicts list (#571/#570, #572/#574).

If #575 is merged the naive GitHub way, after retargeting to main with merge-base be9c44ed8, it conflicts in **4 files**: the service file, candidateRepairApplicationPort.ts, the rig, and the resilience test. So #575 must be rebased onto main, not merged whole.

**Hand-resolved conflicts in the checkout that no PR branch contains.** Patch-ids differ for exactly #571, #574 and #575; the other 7 are patch-identical.

- **24cbe9402 (#571):** a union in cli.ts.
  - Usage string: `[--reader-concurrency N] [--compile-concurrency N]`.
  - Allow-list: `"reader-concurrency", "compile-concurrency"`.
  - Both flag parses (lines 482-487) and both validations (lines 501-503).
- **27f3115c2 (#574):**
  - `if (args.disputed === undefined && !reviewIsUncertain(review) && !contradiction) return review;`
  - Both `;reason=` suffixes are kept.
  - A merged doc comment.
  - The resilience test keeps both the R-219 and R-288 blocks.
- **9f0117cb7 (#575):**
  - `reconcileUnsettled: false` (with #566's comment) is moved into the lifted `exactReview` call.
  - The rig keeps `await options.afterReviewRepair?.(staged);` together with `completedAgainstReview.set(...)` and `[REPAIRED_CHAPTER]`.
- None of these resolutions was reviewed by an independent reviewer.
- The journals and log show only targeted runs on the combined trees:
  - 24cbe9402: "concurrency tests 8/8 + 8/8, cli tests 12/0".
  - 27f3115c2: "resilience 25/25; repair-lane 26/26".
  - 9f0117cb7: "resilience 29/29; repair-lane 26/26".
  - All of them report a clean typecheck.
- **No full-suite run on 9f0117cb7 was found.** One is now running in ~/cf-wt/replay-cp-dry, which is at 9f0117cb7.

### 4. Exact merge sequence to make origin/main equal to 9f0117cb7

**Option A: merge each PR, keeping per-PR history.** Result: tree equals 9f0117cb7, provided the three resolutions match the checkout.
1. Squash-merge #566. It is clean.
2. #567, clean.
3. #568, clean.
4. #569, clean.
5. #570, clean.
6. #571 is now CONFLICTING. Rebase `v25/parallel-compile` onto main. Resolve cli.ts exactly as in 24cbe9402 (the union above). Re-run the typecheck, v4-compiler-chapter-concurrency, v4-reader-panel-concurrency and cli-v4-production-routes. Then squash.
7. #572, clean on top of 1–6.
8. #573, clean.
9. **#574:** run `gh pr edit 574 --base main`. Its base branch stays alive because delete_branch_on_merge is false, so without the retarget GitHub would merge it into v25/reader-doc-indent-declined, not main. Then rebase onto main; git will drop #573's commit as patch-equivalent. Resolve the service file and resilience test as in 27f3115c2, re-verify, and squash.
10. **#575:** `gh pr edit 575 --base main`, rebase onto main, resolve the service file and rig as in 9f0117cb7, re-verify, and squash.
11. Check: `git diff origin/main 9f0117cb7 -- scripts/book/prompts/chapterflow-v24-author-pipeline` must be empty, and `git rev-parse origin/main:scripts/book/prompts/chapterflow-v24-author-pipeline` must equal `b43cb4be2e345f30129ef6be197f9bd811554489`.

**Option B: fastest route, with exact equality guaranteed.** be9c44ed8 is an ancestor of 9f0117cb7, verified with `git merge-base --is-ancestor`. Main is unprotected and has not moved. So a branch at 9f0117cb7 can be fast-forward or rebase-merged, and main then becomes byte-identical to the checkout. After that, close #567–#575 as superseded. Only #566's SHA (dfb1f6fb6) would be recognised as merged. The trade-off: the three hand resolutions go in without per-PR review, the same as in Option A.

Either way, a full-suite run on the final tree is still owed, because CI does not run v25 tests.
