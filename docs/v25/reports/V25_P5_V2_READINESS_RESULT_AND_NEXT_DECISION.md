# P5 v2 (adjudicated) readiness campaign result + next decision (2026-07-15)

`s16-forward-pilot-role-readiness-v2` terminal state: **BLOCKED_ROLE_READINESS**
at exactly the 84-call base ceiling (reader 1/2 ready, source 0/2, quiz 0/1;
budget gate refused to start what it could not fund — zero overrun, zero
replays, zero API). Cumulative P5 live spend: **120 base calls (36 v1 + 84
v2)** — the recorded "Proceed with A" envelope is fully consumed; no further
live calls without fresh authorization.

## The adjudication worked exactly as predicted

Every tested profile passed its canary gate **2/2** (v1: 11 of 12 died there
on the three adjudicated labels). The corrected instrument then discriminated
on real holdout performance:

| Profile-role | Result | Detail |
|---|---|---|
| reader `gpt-5.6-sol@xhigh` | **READY** — first reader profile ever to qualify | acceptable 4/4 · hard blockers 4/4 · false blockers 0/8 · craft 3/4 · protocol 12/12 |
| reader `gpt-5.5@high` / `@xhigh` | NOT_QUALIFIED | `craftCategoryDetected 2/4` (bar 3/4) — both missed the SAME two cases |
| reader `gpt-5.6-sol@high` | NOT_QUALIFIED | one schema-invalid output on an acceptable-control case → zero-miss bars fail closed |
| source `sol@xhigh` / `5.5@xhigh` | NOT_QUALIFIED | schema-invalid outputs (1 and 2 cases) → underpowered zero-miss bars; sol@xhigh detected 9/9 of its VALID defect cases |
| source `@high` ×2, quiz ×4 | NOT_TESTED_BUDGET_EXHAUSTED | ceiling reached at exactly 84 |

The four protocol failures were schema-invalid completions (not refusals or
timeouts) and were honestly terminal — the ratified no-replay-for-content
rule applied.

## What the result isolates

1. **Reader 2-of-2 is unreachable under the frozen order without an Option B
   ruling.** All four reader candidates are now tested. The two gpt-5.5
   profiles missed the same two craft cases; on the `pacing` case both
   emitted adjacent labels (`other_craft`, `density`) that a widened
   weakness→category map would accept — that single ruling flips both to 3/4
   and completes the reader pair. The `weak_transition` miss was genuine
   under any reasonable map.
2. **Quiz was never tested** (budget), and **source p3/p4 remain untested**;
   source p1/p2 failed via invalid outputs, not judgment quality.
3. The instrument itself is now demonstrably sound end-to-end: canaries,
   holdout scoring, budget gate, evidence retention all behaved exactly as
   designed at the ceiling.

## Decision needed (no live calls until ruled)

- **B (craft map)**: rule on the weakness→category acceptance map
  (prospective-only; e.g., accept `other_craft`/`density` for `pacing`,
  `other_craft` for any weakness). Under the observed v2 outputs this
  completes the reader pair — but it must be ruled BEFORE a fresh identity,
  never applied retroactively.
- **Budget**: authorize an extension campaign (fresh v3 identity) to cover
  quiz (up to 4 profiles × 14 = 56) + source p3/p4 (28) + reader re-test
  under the revised map if B is taken (56). A full fresh campaign is again
  ≤84 happy-path ~70; a targeted extension needs an explicit owner-set
  ceiling.
- Alternative: accept the partial role set and revisit role requirements —
  not recommended; the stopping rule (2/2/1) was ratified for pilot safety.

Evidence: evidence branch `381b95ab0` (PR #406 updated automatically);
retained run under `state/migration-experiments/pilot-role-readiness-v2/`.
