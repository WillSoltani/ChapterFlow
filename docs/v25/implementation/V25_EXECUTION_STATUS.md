# V25 S-Tier Program — Execution Status

**Program state:** **PHASE 6 OPEN** — owner D-3 AUTHORIZED 2026-07-17 (L-37): ceiling 150 codex sessions total (probe + corpus freeze + bakeoff + repairs), D-8 bar ratified, D-7 = compile-chain freeze, D-10 = old-line halt (owner-side), D-12 = halt-at-ready (booked into WP-802). Phases 1–5 COMPLETE (G1–G5). 28/42 WPs integrated. Live-call custody: only designated probe/freeze/bakeoff steps run live verbs; every call ledgered; cumulative count checked against the ceiling. In flight: WP-801 + WP-701-mf (model-free, wf_3c695a3b-192), WP-502 build.

## Branch / worktree registry

| Path | Branch | Base SHA | Purpose | Owner | State |
|---|---|---|---|---|---|
| /private/tmp/cf-v25-s-tier-plan | plan/v25-s-tier-implementation | 97b78bf71 | Planning artifacts; primary recovery worktree after approval | orchestrator | ACTIVE (planning) |
| /private/tmp/ChapterFlow-books-v25-live | feat/v25-pipeline-live | (moving) | Other session's active campaign worktree | other session | DO NOT TOUCH |
| /private/tmp/ChapterFlow-books-v25-recovery | recovery/v25-pipeline-repair | 97b78bf71 | Other session | other session | DO NOT TOUCH |
| ~/ChapterFlow-books | feat/v25-pipeline | 96ba28179 | Owner's active checkout | owner | DO NOT TOUCH |
| /private/tmp/cf-wp-801 | wp/801-failure-injection | 11e0362ac | WP-801 failure-injection suite | impl sonnet-5@xhigh, rt opus@xhigh | ACTIVE |
| /private/tmp/cf-wp-701 | wp/701-bakeoff-corpus | 11e0362ac | WP-701 model-free corpus packet (authoringSource UNRESOLVED until D-7 freeze runs) | impl sonnet-5@xhigh, rt opus@xhigh | ACTIVE |
| /private/tmp/cf-wp-502 | wp/502-capability-probe | 11e0362ac | WP-502 probe build (live execution deferred to orchestrator post-integration) | impl opus-4.8@xhigh, rt opus@xhigh | ACTIVE |
| /private/tmp/cf-wp-702 | wp/702-bakeoff-d7-judge | 416a73385 | WP-702 bakeoff harness re-point (D7 primary judge, floor veto, no 5.5 judge) | impl opus-4.8@xhigh, rt opus@xhigh | ACTIVE |
| /private/tmp/cf-wp-701b | wp/701b-auto-research-verb | 498266021 | WP-701b (L-40) research-only stage verb reusing autopilot doResearch | impl opus-4.8@xhigh, rt opus@xhigh | ACTIVE |
| /private/tmp/cf-wp-703 | wp/703-screening-build | 5b9e5f3ba | WP-703 BUILD half: registered screening plan + corpus intake + real D7WorkerDispatch + plan tests (execution live-gated, separate) | impl opus-4.8@xhigh, rt opus@xhigh | ACTIVE |

Integration SHAs will be appended per gate (G1–G8) after approval.

| Gate | SHA | Result | Evidence |
|---|---|---|---|
| G1 | f3b83a4fe | **PASS** — suite 3032/0/12xenv/39skip (detached); root typecheck+build green; contract-validate PASS | g1-gate-final.log, ledger L-20 |
| G5 | c7746bab5 | **PASS** — suite 3323/0/12xenv/39skip (detached); root green; Phase 5 CLOSED; all build phases done | g5-gate.log, L-36 |
| G4 | 116f214d7 | **PASS** — suite 3176/0/12xenv/39skip (detached); root green; Phase 4 CLOSED (D7 gate live) | g4-final.log, L-30 |
| G3 | f8c74a760 | **PASS** — suite 3107/0/12xenv/39skip (detached); root green; Phase 3 CLOSED | g3-gate2.log, L-27 |
| G2 | ef41abe57 | **PASS** — suite 3058/0/12xenv/39skip (detached); root typecheck+build green; contract-validate PASS; Phase 2 CLOSED | g2-gate-final.log, ledger L-25 |

## Work-package status

All 42 packages: **not started** (see master plan §7 for the index). Status values: not started · in progress · blocked · implementation complete · red-team failed · verification complete · integrated · accepted.

| WP | Status | Branch | Start SHA | End SHA | Evidence |
|---|---|---|---|---|---|
| 001–004 | complete-pending-approval / blocked-on-D1,D4 | plan/v25-s-tier-implementation | 97b78bf71 | — | this directory |
| 102 | integrated | wp-102-contract-freeze | 58a8c84e0 | db3cf1ce7 | red-team PASS-WITH-NOTES; merged @ 1134adfee |
| 103 | integrated | wp-103-runstate-resume | 58a8c84e0 | a1566295e | red-team PASS-WITH-NOTES; hermeticity micro-fix a1566295e; merged @ 1134adfee |
| 104 | integrated | wp-104-boundary-proof | 58a8c84e0 | 037f1efe4 | red-team PASS-WITH-NOTES; merged @ 1134adfee |
| 206 | integrated | wp-206-hygiene-sweep | 58a8c84e0 | 314ab6248 | red-team PASS-WITH-NOTES; merged @ 1134adfee |
| 405 | integrated | wp-405-d10-progressive-render | 58a8c84e0 | 6e8ec4f26 | red-team PASS-WITH-NOTES; merged @ 1134adfee; owner UX sign-off still required before web-app PR merge (D-6) |
| 101 | integrated | wp-101-fresh-emit | 02f936eb2 | e1a37419e | red-team PASS-WITH-NOTES; merged |
| 302 | integrated | wp-302-56-profiles | 02f936eb2 | 478a5212f | merged with 501 @ a0fea3193 |
| 501 | integrated | wp-501-55-purge | 478a5212f | afaa478ea | red-team PASS-WITH-NOTES + rt501 MEDIUM fixed (1bbd27638); merged @ a0fea3193 |
| 208 (NEW, L-16) | integrated | wp-208-seal-lifecycle | bb50d1dcf | 42ac60a9a | implementation-complete; merged first @ 1134adfee; default-suite collision defused |
| 301 | integrated | wp-301-author-route | e8b1ec1ce | 30a184400 | rt PASS-WITH-NOTES; merged |
| 201 | integrated | wp-201-default-flip | ed8cb64cc | b25c8f4fd | rt PASS-WITH-NOTES; merged; V25-04 closed |
| 202 | integrated | wp-202-campaign-quarantine | a79474aeb | 2ae7deefb | rt PASS-WITH-NOTES; merged |
| 203 | integrated | wp-203-materializer-thinning | 6a1533c9f | 0bbc46898 | rt PASS-WITH-NOTES; comment-only supersession map; dedup→WP-804 |
| 204 | integrated | wp-204-instrument-deletion | 6a1533c9f | f8fff9ce5 | rt PASS-WITH-NOTES; 1 hard delete + 2 quarantines |
| 402 | integrated | wp-402-threshold-reconcile | a79474aeb | 1b22290d5 | rt PASS-WITH-NOTES; merged; V25-11 closed |
| 303(+701a) | integrated | wp-303-excellence-anchors | 054ea43ce | 04d08409c | rt PASS |
| 304 | integrated | wp-304-provider-envelope | 054ea43ce | 6b6bcd82e | rt PASS-WITH-NOTES |
| 305 | integrated | wp-305-source-contracts | 054ea43ce | 42db0f5cd | rt PASS-WITH-NOTES; 18th contract |
| 404 | integrated | wp-404-repair-verification | 054ea43ce | 9bff33f4a | rt PASS-WITH-NOTES; cap 2 |
| 401 | integrated | wp-401-d7-ship-gate | 9e118bd66 | e6a330c2d | 3 red-team rounds; V25-02 closed; residuals→D-11 |
| 403 | integrated | wp-403-advisory-review | e27cb5fef | f8238350e | rt PASS-WITH-NOTES; V25-10/16 closed |
| 205 | integrated | wp-205-floor-consolidation | e27cb5fef | 024e7c0cd | rt PASS-WITH-NOTES; floor dedup |
| 503 | integrated | wp-503-unified-ledger | fcf4708a4 | c0ad13e63 | rt PASS-WITH-NOTES; V25-15 closed |
| 504 | integrated | wp-504-fallback-config | fcf4708a4 | 87aa06195 | rt PASS-WITH-NOTES |
| 602 | integrated | wp-602-preflight-doctor | fcf4708a4 | db9aabd91 | rt PASS-WITH-NOTES |
| 601 | integrated | wp-601-generate-book | 14a0833da | (601-end) | rt PASS-WITH-NOTES; effort-symmetry fixed; auto-publish→D-12 |
| 603 | integrated | wp-603-progress-logs | 61508ed88 | e1a7f72ec | rt PASS-WITH-NOTES; doc-claim scoped |
| 604 | integrated | wp-604-cli-tests | 61508ed88 | 4c17a7d15 | rt PASS-WITH-NOTES; found L-33 defect |
| 602b | integrated | wp-602b-fresh-preflight | 96998904 | 681189ac9 | rt PASS-WITH-NOTES; L-33 CLOSED (fresh book starts) |
| 801 | integrated | wp/801-failure-injection | 11e0362ac | 1d3fd38eb | rt PASS (4 mutation probes); merged 650f49450; zero guard gaps found — all 10 scenarios already fail-closed |
| 701-mf | integrated | wp/701-bakeoff-corpus | 11e0362ac | 5b5343800 | rt PASS; 2 rt findings fixed pre-merge (allowlist readiness + record cross-binding); merged e912bf63f; packet not-ready-for-bakeoff pending D-7 freeze |
| 502 | **accepted (built + live-executed)** | wp/502-capability-probe | 11e0362ac | 6187d3bf6 | rt PASS; RT-1 fixed pre-merge; live probe 2026-07-17: ALL 4 configs SUPPORTED (8 calls, 8/150 ceiling); results doc + ledger committed |
| 702 | integrated | wp/702-bakeoff-d7-judge | 416a73385 | 5763b359b | rt PASS; R1 calibration-collision guard fixed pre-merge; merged d7b626418; D7 = primary judge, floor = veto, no 5.5 |
| 701b (NEW, L-40) | integrated | wp/701b-auto-research-verb | 498266021 | 2f50de373 | rt PASS zero new defects; structural stop proven; merged; F1 pre-existing ledger-stage cosmetic noted |
| 703 (build half) | integrated | wp/703-screening-build | 5b9e5f3ba | cd86b1ddf | rt PASS; FINDING-1 finite-bar fixed pre-merge; R3 judge guard closed; screening EXECUTION pending corpus freeze |
| others | not started | — | — | — | — |

## Conventions (binding)

1. **Result docs commit with their run** — a commit whose subject claims an executed run must contain that run's result doc and state artifacts (prevents V25-06 recurrence).
2. **Unified ledger** — every model call (codex exec AND Claude-side) appends {stage, role, model, effort, latency_ms, outcome} to the per-run ledger; per-book rollup at run end (WP-503 implements; convention applies to ALL program phases including the bakeoff).
3. **Dispatch rows** — no WP is dispatched without a registry row here (branch, base SHA, assigned model); no WP is accepted without independent verification evidence linked here.
4. **Re-fetch before every integration gate**; base-change assessment recorded below.

## Base-change log

| Date | Event | Assessment |
|---|---|---|
| 2026-07-16 | Planning base fixed at 97b78bf71 (v6 ruling). Live branch may advance (v6 execution) during approval window. | Re-fetch at Phase-1 entry; if feat/v25-pipeline-live advanced, rebase plan branch or record divergence rationale before first dispatch. |
| 2026-07-16T08:03 | Live advanced 97b78bf71 → 8224f079a: P5 v6 PILOT_ROLE_SET_READY (freeze artifacts only: docs/v25/reports + state/migration-experiments). | Zero overlap with Phase-1 WP files — Wave A proceeds on base 58a8c84e0; reconcile (merge/rebase onto live head) assessed at gate G1. Ledger L-15. |
