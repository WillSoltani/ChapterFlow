# v25 execution — shared context pack (read this first, every session)

Written 2026-09-23 from a verified, read-only assessment (9 investigators + 4 adversarial verifiers).
Kit root: `~/cf-wt/v25-execution/` (NOT a git repo; durable; never under /tmp).
This file + `DECISIONS.md` + `status/*.md` + your task prompt are your whole brief.
Where this file and a skill's default behaviour disagree, THIS FILE WINS. It also overrides `~/ChapterFlow/CLAUDE.md` and the memory
note that call `~/ChapterFlow-books` canonical (that was older work): for this campaign the canonical checkout is
`~/ChapterFlow-books-v25-completion`, worktrees live in `~/cf-wt/` (via `wt.sh`), and `~/ChapterFlow-books` and `~/ChapterFlow` are not
edited, tested or branched.

## 1. The goal and the definition of done
Owner mandate (2026-09-02, reaffirmed 2026-09-23): fix the v25 book pipeline so it produces high-quality work —
**enjoyable, easy to understand, easy to read, accurate with the source, clean** — test ONE book (Franklin),
and return the output for evaluation. "By the end, the whole pipeline work is complete" means ALL of:
1. Every pipeline fix is on `origin/main`, and the v25 test suite runs in CI and is green.
2. The run-blocking wedges are fixed (usage-limit 429 burning review budgets; unlocated QC blocker; panel gate unreachable);
   remaining hardening is either done (S08, per D13) or registered as deferred with a trigger (S13).
3. A Franklin run on main code reaches promotion through every gate (panel → fresh QC incl. source-fidelity judge → rubric) —
   or, if a gate outcome is final for the candidate, the owner's fallback D12 is applied and the best candidate is evaluated.
4. The release package exists, a scorecard + plain-language evaluation is delivered, and the owner has the
   `publish-final` command (the owner runs it — never a session).
5. Closeout: branches/worktrees cleaned, deferred items registered, memory and docs updated.

## 2. Non-negotiables (owner rules — violating one is a failed task)
- Never assert what you have not verified. Paste verbatim command output as evidence. Say "unverified" when it is.
- Every behavioural code change goes through an adversarial review whose reviewer reproduces RED itself in a
  pristine worktree at the base (template: `templates/adversarial-fix-workflow.js`).
- Never weaken a gate, threshold, bar, budget or fail-closed path unless `DECISIONS.md` records the owner's choice for it.
  Cite the decision id in the PR body.
- Don't over-engineer: fix only what the task names; minimal diffs; defer non-blocking minors (record them in your status file).
- Look up PR numbers (`gh pr list --head <branch>`); never guess.
- Never `git stash`. Never `git worktree add` under `~/ChapterFlow` or `/tmp` (macOS reaps /tmp after 3 days).
- `~/cf-canary` and `~/cf-canary-att` are READ-ONLY except through the pipeline's own driver. Copy data out before experimenting.
- Strip API keys for every test/pipeline command: `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY`.
- `publish-final` is the owner's step. Surface the exact command and stop.
- Model policy: implementation by **Opus (5.5 or 5) or Sonnet 5 only — never Fable models**. Implementer subagents
  `model: 'opus'`, cheap scouts `model: 'sonnet'`, reviewers `model: 'opus'`.
- Multi-agent orchestration is explicitly authorized by the owner for every task in this kit (Workflow tool OK).
- Do not use Workflow `isolation: 'worktree'` for pipeline work (it creates worktrees under ~/ChapterFlow).

## 3. Verified state on 2026-09-23 (re-verify before relying on it)
- `origin/main` = `be9c44ed8`. Canonical run checkout `~/ChapterFlow-books-v25-completion` is DETACHED at local-only
  `9f0117cb7` = main + cherry-picks of open PRs #566–#575 (three hand-resolved: 24cbe9402 #571 cli.ts, 27f3115c2 #574,
  9f0117cb7 #575). Pipeline subtree hash at 9f0117cb7: `b43cb4be2e345f30129ef6be197f9bd811554489`. Task S01 lands it on main.
- Full v25 suite (run 2026-09-23): main 3284 pass/0 fail; 9f0117cb7 3291 pass/0 fail; typecheck clean (xenv 6, skip 17).
- **CI does NOT run the v25 tests.** Job "v21 Pipeline Typecheck + Tests" runs `pipeline:test` → legacy `@chapterflow/v21-authored`.
  v25 is only type-checked (`typecheck:book`). Until S10 lands, local full-suite runs are the only test evidence.
  "E2E Smoke (dev build)" fails on main too (web-app spec `e2e/no-duplicate-endpoint-requests.spec.ts`) — pre-existing, unrelated.
- 37 PRs merged (#525–#564). Open: #566–#575 (live fixes #12–#19 + parallel panel #570 / compile #571), #559 (parked, CONFLICTING).
- No Franklin run since 09-02 has passed review; fresh-qc, source-fidelity judge, rubric, promotion, release have NEVER run on
  post-09-02 code. Last pipeline books reached the app 2026-07-10 (v24).
- Current run `book-run-39a37d06-59c8-430a-87fe-3ad3b19a1c14` is WEDGED (defect #20). Latest candidate
  `review-repair-21-candidate-06d7596afd1f14dccd3eb2df99b22db6` ("rr21"). Driver stopped (WEDGE STOP 2026-09-20T14:58:03Z).
  launchd autoresume agent `com.chapterflow.franklin-autoresume` is loaded and idle; `AUTORESUME.env` is stale (LOG_PREFIX=fv8d, no ORDINALS).

## 4. Why the pipeline cannot finish today (the blockers this kit removes)
| Blocker | Evidence (line numbers at 9f0117cb7 — re-locate by symbol after S01) | Task |
|---|---|---|
| #20: weekly-limit 429 stored as ERROR review; 3 successor ordinals burned in 16 s; `MAX_REVIEW_SUCCESSOR_ORDINALS=3` constant | `bookRunApplicationService.ts` 1236, `reviewIsUncertain` 1262-1264, `#reviewSuccessor` 1617-1690, `#successorLanding` 1706-1720 (skip :1716), terminal msg 3321-3328; `reviewService.ts` 266-283; `modelGatewayReviewEvaluator.ts` 233-241 | S03 |
| Driver cannot see 429: `stdoutHead` 400 chars no longer holds the text (CLI 2.1.265 puts `usage` before `result`); `provider_block()` greps a line offset over 371 concatenated files; no 429 pattern | `modelGateway.ts` 384, 390-396, 498-520; `claudeRoute.ts` 166-179; `drive-franklin-v7.sh` 38-40 | S03 + S04 |
| Panel gate: union of ANY seat's BLOCKER; 0/14 panels passed; identical bytes re-read draw a blocker 41%; ~83% single-seat by same-problem matching (69%, 157 of 228, under a chapter+category matcher); P(all 19 clean) ≈ 4e-5 | `semanticPanelReviewEvaluator.ts` 361-364 (union), 389-393 (outcome), 328-336 (floor 70); `laneOrchestrator.ts` 425-429; precedent: `panelQuizAdjudication.ts` 111,118 (strict majority) | S06 |
| Fresh QC fails by construction: deterministic replay on rr21 = FAIL 33 blockers; F4 ("rather than" 24x, budget 15) has NO location → QC-repair preflight `REPAIR_FINDING_UNSCOPED` refuses the WHOLE repair; QC round write-once per run | `critics/bookGate.ts` 827-832; `candidateQcEvaluator.ts` 627; `candidateRepairApplicationPort.ts` 341-343, 413-423, 1122; `qcStore.ts` 403-416; round id `derivedId("qc", runId)` 3360 | S05 |
| QC-repair needs a full panel PASS on the successor's FIRST verdict; each link ~263 calls, 5-9 h; `REPAIR_DIAGNOSIS_REQUIRED` between links needs a manual `qc-diagnose` | `contentRepairWorkflow.ts` 242-264; service 3553-3556 | S06 (rule) + S11 (runbook) |
| Rubric: composite ≥ bar 80 (knob `CHAPTERFLOW_RUBRIC_BAR` 60-95, re-judged per run), every factor median ≥ 70 (constant), churn not HIGH, unanimous correctness, SPLIT fails closed, no rubric repair lane; samples chapters [0,6,12,18]; panel proxy composite 75.9-77.5 | `catalogRubric.ts` 178, 185, 547, 630-690; service 2330-2359, 3585-3611 | S02 probe → D4 |
| Downstream 429s burn bounded budgets (QC judge 5, rubric 3, QC-repair 3/4); QC-repair successor judge has no successor walk; QC-repair successor re-review retries a provider-blocked ERROR in-invocation (MAX_REPAIR_REVIEW_ATTEMPTS=3) and then uses a forgiveness slot | service 2180-2269, 2370-2487; `bookRunComposition.ts` 617-690; `contentRepairWorkflow.ts` 240-270; port 1492-1495 | S08 (scope per D13) |
| Accuracy invisible to the loop: panel has no source lane; source-fidelity judge runs only in fresh QC after a panel PASS; audit of rr21 ch01/07/13/19 → 66% of 182 claims correct, 19 major errors (14 of 16 re-checked confirmed), 2 quiz keys wrong | `semanticPanelReviewEvaluator.ts` 61-67; `aggregateChapterReview.ts` 44-48; `candidateQcEvaluator.ts` 677-700; `sourceFidelityJudge.ts` 66-75 | S02 → S07 |
| Readability: 8/19 full reads and 11/19 deep reads are one unbroken paragraph (up to 774 words); web adapter splits on `\n\n` | `app/app/api/book/_lib/v21-adapter.ts` 57/76 (web repo) | S09a |
| Memorable-line splitter breaks after "Mr." (ch18 fragment) | `src/optimizers/memorableLines.ts` 335-341 | S09a |
| Franklin scar pins keyed to the old 4-part layout: ch01-04 get wrong pins, ch05-19 get none | `config/book-scars/the-autobiography-of-benjamin-franklin.json`; `src/lib/bookScars.ts` 106-125 | S09b |
| Resumed run 39a37d06 has its dispute budget spent: any new all-declined ordinal → "start a fresh run"; `MAX_DISPUTED_REVIEW_SUPERSESSIONS=1` is a constant, so a SECOND dispute in any run does the same | service 508, 1784-1809, 3115 | D6 (fresh run) + D13 |

## 5. Paths
- Canonical repo / run checkout: `~/ChapterFlow-books-v25-completion` (the driver `cd`s here; `src/` and `config/` must be clean).
  Pipeline package: `scripts/book/prompts/chapterflow-v24-author-pipeline` (call it `$PIPE`). Tests: `$PIPE/tests/v25/*.test.ts` and a few root
  tests such as `$PIPE/tests/franklin-scars-structure.test.ts` (all run by `tests/run.ts`).
  After S01 no task moves the canonical checkout except S11 (and S13); other tasks only merge on origin.
- Worktrees: `~/cf-wt/<name>` on branch `v25/<name>`, created ONLY with `~/cf-wt/franklin-v7-tools/wt.sh new <name>` (branches from origin/main).
  `wt.sh verify <name>` = typecheck + full suite (~15 min); `wt.sh push <name>`; `wt.sh pr <name> "<title>" <bodyfile>` (prints PR number).
  `wt.sh` has no detached mode; for a detached test tree use `git -C ~/ChapterFlow-books-v25-completion worktree add --detach ~/cf-wt/<name> <ref>`
  and symlink root + `$PIPE` `node_modules` from the canonical checkout after `cmp` of both package-lock.json files.
  If `npm ci` fails (sandbox network): `cmp package-lock.json` against the canonical one, then symlink `node_modules` from the canonical
  checkout (root and `$PIPE`), and say so.
- Driver + tools (NOT a git repo): `~/cf-wt/franklin-v7-tools/` — `drive-franklin-v7.sh`, `autoresume.sh`, `AUTORESUME.env`,
  `com.chapterflow.franklin-autoresume.plist`, `PAUSE` (file: presence keeps autoresume down), `franklin-v7b-driver.out`
  (markers `=== RESUME|FRESH|STOP|END|R<N> …`), `score-franklin-v7.js`, `wt.sh`.
- Live data (read-only): `~/cf-canary/` — events `book-run-events/the-autobiography-of-benjamin-franklin.jsonl`; run state
  `run-state/books/the-autobiography-of-benjamin-franklin/runs/<runId>/{run.json,attempts.jsonl}`; reviews
  `books/the-autobiography-of-benjamin-franklin/reviews/<reviewId>.json`; candidates `books/.../candidates/<id>/content/content/chapters`;
  round logs `~/cf-canary/<LOG_PREFIX>-r<N>.log`; source text `~/cf-canary/sources/the-autobiography-of-benjamin-franklin.txt`.
- Pipeline model-call transcripts (usage, stop_reason): `~/.claude/projects/-Users-radinsoltani-cf-canary-att-*/<session>.jsonl`.
- Assessment (evidence for everything above): `~/cf-wt/v25-execution/assessment/reports/*.md`; rendered draft of rr21 and rev-6:
  `assessment/draft-rr21/`; all 228 panel blockers: `assessment/data/blockers-all.txt`.
- Tools: `tools/detqc.mts` (model-free fresh-QC replay; usage in its header), `tools/corrob.py` (seat-corroboration recount over the
  14 stored panels of run 39a37d06).
- Memory (read the index; update your topic at the end): `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/MEMORY.md`,
  `v25-status-assessment-2026-09-23.md`. The older `v25-s-tier-phase-b-2026-09-02.md` is 546 KB with an ~18x duplicated line —
  do not read it whole; `grep` it.

## 6. Mechanics that worked (reuse them)
- **Adversarial fix workflow**: copy `templates/adversarial-fix-workflow.js` to your session dir, fill the CONSTANTS block, run it with the
  Workflow tool (`scriptPath`). Shape: Opus implementer writes RED first (must fail, pasted) → minimal fix → GREEN → `wt.sh verify` →
  commit; two Opus reviewers (correctness; gate-safety + minimality) each reproduce RED in a pristine detached worktree at the base and
  GREEN in the branch; up to 3 rounds feeding MUST-FIX back; then a ship agent pushes and opens the PR. Workflow scripts: `meta` must be a
  pure literal; no `Date.now()`.
- Filling the template's TASK: copy ONLY your prompt's goal sentence, facts paragraph, "Required change" and "RED first" text; replace every
  backtick with ' and every dollar-sign-brace with '$ {' (TASK is a template literal: a pasted `${x}` is evaluated and throws). Never paste
  Step 0–3 (subagents must not load skills, write status, or merge).
- If the workflow returns `passed: false` (implementer BLOCKED, or 3 rounds without two PASSes), do NOT fix or ship it yourself: write your
  status as BLOCKED with `lastFeedback` verbatim and the worktree path, and stop. If a run dies mid-way, relaunch it with
  `Workflow({scriptPath, resumeFromRunId})`.
- If your PR conflicts with a PR merged after you branched (S05/S08/S09a share the repair port and its tests; S07/S08 share
  `candidateQcEvaluator.ts`), rebase onto origin/main (never merge main in), re-run the full suite, and have one Opus reviewer re-check the
  resolved hunks and re-run RED/GREEN before merging. Paste that evidence in your status file.
- At most 2 adversarial-fix workflows should be in their review phase at the same time on this Mac (reviewers run suites; the v25 suite flakes
  under heavy parallel load).
- Targeted test: `cd $PIPE && CHAPTERFLOW_NO_API_CODEX_QC=1 env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY npx tsx tests/v25/<file>.test.ts`
  (prints a `V25_RESULT {...}` line). Full suite: `wt.sh verify <name>` (look for `pass N fail 0` and `v25-subprocess-suite: exit=0`).
  Never run two full suites in the same worktree at once (a guard makes both fail).
  The full suite takes ~15 min, longer than the Bash tool's 10-minute foreground cap: run it with `run_in_background` into a log outside the
  worktree (`wt.sh verify <name> > ~/cf-wt/<name>.verify.log 2>&1`), wait (Monitor or an until-loop), then paste the lines matched by
  `command grep -E 'pass [0-9]+ +fail|v25-subprocess-suite'` — the runner prints `pass N  fail M` with TWO spaces. Same for `npm test`
  and for waiting on `gh pr checks` (repeated calls each under 10 min; foreground `sleep` is blocked).
- Commits end with the `Co-Authored-By:` line your own session's system prompt specifies. PR bodies end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Merging: per `DECISIONS.md` D10. If a merge/push is refused by the permission classifier, stop and print the exact commands for the owner.

## 7. Traps (each has cost hours before)
- zsh: `grep` is a shell function that can print nothing — use `command grep`. Unmatched globs abort the whole command line — quote them.
  `kill $LIST` with a multi-pid variable breaks — kill pids one by one. macOS has no `timeout` binary. Background shells start at the repo root.
- The section-pack cache key omits effort but includes blueprint/packet/scars/taskCard digests: prompt, task-card or scar changes force a
  recompile of the affected packs (a FRESH run ~3 h / ~$120 API-eq with compile concurrency 3).
- The weekly Claude limit is SHARED by the pipeline and every Claude Code session (last week: pipeline 52%, orchestration 48%, ~$1,600
  API-eq total). It resets Tuesdays 23:00Z (7pm America/Toronto). One review-repair round ≈ $32 and 1.7 h.
- Killing the driver mid-attempt leaves RUNNING runs → the next resume needs `--reconcile-unsettled` (the driver's resume rounds pass it).
- `touch ~/cf-wt/franklin-v7-tools/PAUSE` before any manual driver work; a manual run replaces the WEDGE STOP marker and autoresume
  would otherwise relaunch with a stale env.
- The superpowers skills may suggest interviews, other worktree locations or interactive merge menus: the task prompt is the approved
  design; worktrees go through `wt.sh`; merges follow D10.

## 8. Status protocol (how sessions hand off)
- At start: read `DECISIONS.md`, then list `~/cf-wt/v25-execution/status/` with `ls` (it may be empty — an unmatched zsh glob aborts the
  command) and read every file in it. Check your task's preconditions against them.
- If D1 = B, only S01, S02, S04 (scoring fix only), S12 (CANDIDATE mode) and S13 run; every other task writes `RESULT: NOT NEEDED (D1 = B)` and stops.
- At end (success or stop): write `status/<TaskId>.md` whose FIRST line is
  `RESULT: <DONE | NOT NEEDED | BLOCKED | NEEDS-OWNER | WAITING-FOR-RESET | PARTIAL>`, then: PR numbers + URLs (looked up),
  head SHAs, verbatim evidence lines (RED, GREEN, suite counts), decisions used, what the next task must know, deferred minors.
- If a needed decision is missing and `ACCEPT_RECOMMENDED_DEFAULTS` is not `yes`, write BLOCKED with the exact question and stop.
- Update memory: add a one-line pointer in MEMORY.md only for durable facts (not per-task noise); prefer updating
  `v25-status-assessment-2026-09-23.md`'s "Progress" section.
