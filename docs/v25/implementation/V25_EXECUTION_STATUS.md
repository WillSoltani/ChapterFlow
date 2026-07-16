# V25 S-Tier Program — Execution Status

**Program state:** EXECUTING — Phase 1 / Wave A dispatched 2026-07-16T08:05-0300 (owner approved; ledger L-14). Live calls remain forbidden until Phase-6 written authorization (D-3).

## Branch / worktree registry

| Path | Branch | Base SHA | Purpose | Owner | State |
|---|---|---|---|---|---|
| /private/tmp/cf-v25-s-tier-plan | plan/v25-s-tier-implementation | 97b78bf71 | Planning artifacts; primary recovery worktree after approval | orchestrator | ACTIVE (planning) |
| /private/tmp/ChapterFlow-books-v25-live | feat/v25-pipeline-live | (moving) | Other session's active campaign worktree | other session | DO NOT TOUCH |
| /private/tmp/ChapterFlow-books-v25-recovery | recovery/v25-pipeline-repair | 97b78bf71 | Other session | other session | DO NOT TOUCH |
| ~/ChapterFlow-books | feat/v25-pipeline | 96ba28179 | Owner's active checkout | owner | DO NOT TOUCH |

Integration SHAs will be appended per gate (G1–G8) after approval.

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
| 101 | in progress | wp-101-fresh-emit | 1134adfee | — | dispatched: sonnet-5@xhigh |
| 302 | in progress | wp-302-56-profiles | 1134adfee | — | dispatched: opus-4.8@xhigh |
| 501 | queued | — | post-302 | — | after 302 |
| 208 (NEW, L-16) | integrated | wp-208-seal-lifecycle | bb50d1dcf | 42ac60a9a | implementation-complete; merged first @ 1134adfee; default-suite collision defused |
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
