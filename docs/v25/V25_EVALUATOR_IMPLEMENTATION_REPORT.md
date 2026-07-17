# V25 Evaluator Implementation Report

**Date:** 2026-07-17 · **Verified base:** `plan/v25-s-tier-implementation @ 64b5d8a04b41b174c8cfde384730a82caeadd346` · **Final head:** `impl/v25-evaluator-selection @ d7eb5a963` (worktree `/private/tmp/cf-v25-impl`; 35 commits over base, 26 non-merge; **local only — nothing pushed**).
**Canonical plan:** `V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md` (+ `.html` parity-checked). Protocol: `implementation/V25_CHAPTER_EXPERIMENT_PROTOCOL.md` (+ byte-frozen `V25_CHAPTER_EXPERIMENT_BUDGET.plan.json`). Runbook: `implementation/V25_READY_FOR_LIVE_TEST.md`. Task ledger: `implementation/V25_EVALUATOR_TASK_LEDGER.json`.

## 1. Compliance statement

- **No Claude-family model rated any book or chapter in this assignment.** Claude agents implemented and reviewed code only. Zero live model calls were made (`CHAPTERFLOW_NO_API_CODEX_QC=1`, `CHAPTERFLOW_ALLOW_MODEL_GEN=0`, empty API keys in every test env; all tests use injected doubles).
- **No whole book was generated.** No candidate chapter was generated either — this session was code/plan only.
- **No push, PR, merge to a protected branch, publish, or deploy occurred.** The production author default is unchanged.
- The evaluator skill (`.agents/skills/chapterflow-book-evaluator/**`) has **zero edits** on this branch (`git diff 64b5d8a04..HEAD -- .agents/` is empty).

## 2. Finding disposition counts

| Category | Count | IDs |
|---|---|---|
| Implemented (resolved on this branch) | **9 audit + 5 policy** | AUD-01 (lane), AUD-02, AUD-03, AUD-06, AUD-07, AUD-08, 15f (role-scoped attempt mechanics), NEW-01, NEW-05, NEW-06 econ contract, NEW-03 (reconciled), NEW-02 (disclosed/labeled), NEW-07 (contained) |
| Structurally contained, disclosed | 1 | NEW-04 (Sol-judging-Sol: P1–P3 pre-registered, D7 downgrade-only, REQUIRED owner blind Stage-2 read; kinship unmeasurable in-house — stated verbatim) |
| Re-designed, live part pending authorization | 1 | AUD-04 (E-anchors + measured W band; D7 high-band drill unit required) |
| Deferred (pre-pilot scope, unchanged) | 4 | AUD-09, AUD-10, AUD-12, AUD-15a (no live run can fire them this session) |
| Owner action | 1 | AUD-05 (push/reconcile) |
| Deferred (post-experiment cleanup) | AUD-13, AUD-14, 15b–15e as per audit §12 | |
| Wave-4 red-team findings | **1 HIGH + 3 MED + 5 LOW — ALL FIXED**; 3 INFO residuals recorded | plan §13 table |
| Plan red-team findings | 5 MAJOR + 8 MINOR + 2 NIT — all dispositioned | plan §12 table |

## 3. Work packages and commits

| WP | Commit | Owner route |
|---|---|---|
| E00 freeze + docs import | `9f13a304c`, `1192ace72`, `399238275` | orchestrator |
| E41 ledger sessionKind | `13ce1d2a4` | Sonnet 5 xhigh |
| E42 price table | `08edebd2f` | Sonnet 5 high |
| E21 ultraSession + route authority | `2d133259b` | Opus 4.8 xhigh |
| E22 dispatch swap (Claude→Sol-ultra) | `1cd539969`¹ | Opus 4.8 xhigh |
| E23 route-proof receipts | `fef6f1aa4` | Sonnet 5 xhigh |
| E24 derive-don't-reject + cap | `37c860bf5` | Opus 4.8 xhigh |
| E26 Claude neutralization | `5876cfa4b` | Sonnet 5 high |
| E11+E12 adapter package + harness | `72cbd5973` | Sonnet 5 xhigh |
| E13+E14 diagnostic runner + boundary | `86450acc9` | Opus 4.8 xhigh |
| E31 measure-only readability | `e56e6bdb3` | Opus 4.8 xhigh |
| E32 terminal selection + eval-primary | `c5a945998` | Sonnet 5 xhigh |
| E33 budget authority + protocol | `40c5687b1` | Sonnet 5 xhigh |
| E34 report truthfulness | `a79d140b6` + `3f132606c` | Sonnet 5 high |
| E51 anchor study / E72 runbook | `e0fae892b` | Sonnet 5 xhigh/high |
| E61+E62 CI repair | `f2d8d701e` | Sonnet 5 high |
| Plan red-team fixes (F1–F8) | `8f5f29c6e`, `6c21ef9da` | orchestrator |
| CLI verb wiring | `0a4891512` | orchestrator (integration writer) |
| E71 red-team fixtures | `a4cd40797` | Opus 4.8 xhigh (fresh) |
| Wave-4 fixes A (HIGH route proof + B/C/D) | `8433e5961`¹ | Opus 4.8 xhigh |
| Wave-4 fixes B (F1–F4 + E71-F1) | `071ca7693` | Opus 4.8 xhigh |

¹ Two worker sessions (E22, fix-A) ended before their commit step; the orchestrator verified their trees (tsc + suites green) and committed on their behalf — noted in each commit message. The initial fix-A commit was redone once to exclude test-run `state/` droppings my `git add` had swept in (12 clean files committed; no history rewrite beyond the immediate soft-reset before the branch was referenced anywhere).

## 4. Exact-head verification (all at `d7eb5a963`, hermetic env `CHAPTERFLOW_NO_API_CODEX_QC=1 CHAPTERFLOW_ALLOW_MODEL_GEN=0 CHAPTERFLOW_LEAK_GUARD=1`, empty API keys)

| Command | Result |
|---|---|
| `npx tsc -p . --noEmit` (pipeline package) | **exit 0** |
| `npx tsx tests/run.ts` over the audit's 14 suites + all new suites (`rubric-audit-instrument rubric-audit-harness d7-ship-gate bakeoff-screening-plan campaign-quarantine migration-guards generate-book-command deterministic-floor promote-gate no-api-promote run-call-ledger session-ledger pipeline-failure-injection model-capability-probe ultra-session selection chapter-diagnostic red-team price-table claude-rating-neutralization model-bakeoff-conductor`) | **exit 0 — 458 pass / 0 fail / 0 xfail / 0 skip** |
| `contract-validate` | **PASS** (18 frozen contracts untouched) |
| Root `npm run pipeline24:typecheck` (new E62 script; cd's into the package per AGENTS.md) | **exit 0** |
| Evaluator-skill Python suite (`python3 -m unittest discover -s .agents/skills/chapterflow-book-evaluator/tests`) | **74/75 pass — 1 pre-existing error** (`test_schema_files_…enumerate_full_rubric`, `KeyError: 'allOf'`) reproduced identically at pristine `64b5d8a04` in the untouched audit worktree; zero skill files modified on this branch; recorded for the owner (skill files are out of bounds for this assignment) |
| Plan HTML render check (Playwright, light/dark × 320/1200) | **4/4 OK** — no JS errors, no horizontal scroll, filters functional |
| `chapter-diagnostic` verb boundary | canonical id → **exit 2** with NOT-A-BOOK-SCORE refusal; blind `chapterdiag--` id → exit 0 registration |
| No-Claude-rating invariant | red-team-claude-reentry suite + static grep: no rating dispatch resolves to a claude binary/model string |

Deliberately not run: full `npm run test` (state-dropping side effects; known flaky under parallel load per IMP-20 — the targeted union above covers every touched surface), any live verb, any `migration-bakeoff` subverb, anything that could author/judge/promote/publish/call a model.

## 5. Live calls and experiment status

- **Model calls this session: 0** (codex and Claude both).
- **Experiment: NOT RUN — READY_FOR_LIVE_TEST.** All code, fixtures, protocol pre-registration, budget authority, degradation ladder, blinding/leak guards, and dry-run proofs are complete and adversarially verified. Remaining before Stage 0b (per `V25_READY_FOR_LIVE_TEST.md`): owner D-3 ceiling ruling (honest default path ≈141 sessions fits neither reading — start at ladder R1 or grant explicit headroom), Stage-0b authorization (≤24 codex sessions), optional price table + anchor hand-adjudication, and the one-time live ultra-acceptance probe (fail-closed if the installed codex CLI rejects `model_reasoning_effort=ultra`).

## 6. Unresolved owner decisions

1. D-3 ceiling ruling (blocks any live stage).
2. Versioned owner-approved price table (cost half of the decision rule inert until then; everything reads `PRICE NOT VERIFIED`).
3. Optional: hand-adjudicate the 2 evaluator anchor chapters (truth check vs location+noise only).
4. Stage-0b live authorization.
5. Branch push/reconcile (AUD-05): `impl/v25-evaluator-selection` and all evidence remain on this machine only.

## 7. Residual risks

Same-family judging (Sol rates Sol; disclosed, structurally contained — the single largest validity concession of the no-Claude policy); ultra runtime acceptance unproven until the live probe; anchors provide location+noise unless the owner adjudicates; 1 pre-existing evaluator-skill test error (owner's to triage); pre-existing repo-wide items untouched per plan (AUD-09/10/12 pre-pilot; AUD-13/14 cleanup; legacy `author-arch` test state-leak class F-018).

**No unsupported success claim appears in this report: every PASS above was executed against the exact integrated head with its exit status captured in-session.**
