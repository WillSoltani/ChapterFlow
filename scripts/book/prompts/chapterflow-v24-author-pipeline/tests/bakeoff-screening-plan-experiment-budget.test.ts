/**
 * WP-E33 — the chapter-experiment budget authority (frozen plan §5.3): the
 * Stage 0a-4 budget table, the degradation ladder + its deterministic block
 * selector, and the pre-Stage-2 remaining-budget check.
 *
 * A SEPARATE file from `tests/bakeoff-screening-plan.test.ts` on purpose — that
 * file freezes WP-703's `SCREENING_PLAN` (untouched by this WP) and this file
 * freezes the NEW `EXPERIMENT_BUDGET_PLAN` structure this WP adds alongside it
 * (see the design-choice note in `src/bakeoff/screeningPlan.ts` ahead of
 * `EXPERIMENT_BUDGET_PLAN`). Named with the `bakeoff-screening-plan` prefix so
 * it is picked up by the same `run.ts` filter.
 *
 * ZERO live/paid calls — pure data + pure decision functions only. Proves:
 *   (a) the machine-readable companion is byte-identical to
 *       experimentBudgetPlanJson() — the registered numbers cannot drift;
 *   (b) the Stage 0a-4 table matches the frozen plan §5.3 verbatim;
 *   (c) selectSmallestSpreadBlock is deterministic and CANNOT be swayed by
 *       outcome direction (it selects identically regardless of which
 *       candidate is "ahead" on a block, and ties break on block id, not on
 *       any outcome signal — the type it accepts carries no such field);
 *   (d) checkBudgetBeforeStage2's math: the "Stage 1 at cap without
 *       confirmation = STOP" rule, the "no confirmation" refusal, the
 *       insufficient-remaining-budget refusal, and the ok-path arithmetic.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  EXPERIMENT_BUDGET_PLAN,
  EXPERIMENT_BUDGET_PLAN_SCHEMA,
  EXPERIMENT_STAGE_BUDGETS,
  DEGRADATION_LADDER,
  STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE,
  experimentBudgetPlanJson,
  selectSmallestSpreadBlock,
  checkBudgetBeforeStage2,
  LadderSelectionError,
  type BlockSpread,
  // v1 (WP-703) exports must remain importable, unchanged, from the same module.
  SCREENING_PLAN,
  screeningPlanJson,
} from "../src/bakeoff/screeningPlan.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const COMPANION_PATH = resolve(REPOSITORY_ROOT, "docs/v25/implementation/V25_CHAPTER_EXPERIMENT_BUDGET.plan.json");

// ── (a) companion binding ─────────────────────────────────────────────────

test("(a) the on-disk experiment-budget companion is byte-identical to experimentBudgetPlanJson()", () => {
  assert.equal(
    readFileSync(COMPANION_PATH, "utf8"),
    experimentBudgetPlanJson(),
    "the doc's companion must be exactly the code's canonical experiment-budget plan JSON",
  );
});

test("(a) the experiment-budget plan carries its own schema id, distinct from SCREENING_PLAN_SCHEMA", () => {
  assert.equal(EXPERIMENT_BUDGET_PLAN.schema, EXPERIMENT_BUDGET_PLAN_SCHEMA);
  assert.equal(EXPERIMENT_BUDGET_PLAN_SCHEMA, "v25-chapter-experiment-budget-plan-v1");
  assert.notEqual(EXPERIMENT_BUDGET_PLAN.schema as string, SCREENING_PLAN.schema as string);
});

test("(a) SCREENING_PLAN (WP-703, v1) is untouched — its own freeze contract is unaffected by this WP", () => {
  // Not re-testing bakeoff-screening-plan.test.ts's assertions here (that file owns them);
  // this just proves the v1 symbols are still exported unmodified from the shared module.
  assert.equal(SCREENING_PLAN.schema, "v25-bakeoff-stage1-screening-plan-v1");
  assert.equal(SCREENING_PLAN.configs.length, 4);
  assert.equal(typeof screeningPlanJson(), "string");
});

// ── (b) Stage 0a-4 table matches the frozen plan §5.3 verbatim ─────────────

test("(b) the registered stage table has exactly the 7 frozen §5.3 stages in order", () => {
  assert.deepEqual(
    EXPERIMENT_STAGE_BUDGETS.map((s) => s.stage),
    ["0a", "0b", "1", "1b", "2", "3", "4"],
  );
});

test("(b) Stage 0b/1/2 budgets match the frozen planned->cap numbers", () => {
  const byStage = new Map(EXPERIMENT_STAGE_BUDGETS.map((s) => [s.stage, s]));
  assert.deepEqual({ planned: byStage.get("0b")!.planned, cap: byStage.get("0b")!.cap }, { planned: 15, cap: 24 });
  assert.deepEqual({ planned: byStage.get("1")!.planned, cap: byStage.get("1")!.cap }, { planned: 84, cap: 119 });
  assert.deepEqual({ planned: byStage.get("2")!.planned, cap: byStage.get("2")!.cap }, { planned: 32, cap: 46 });
  assert.equal(byStage.get("2")!.capWithD7Lite, 58, "Stage 2's D7-lite-inclusive cap reading is carried, not collapsed");
  assert.equal(byStage.get("1b")!.planned, 0, "Stage 1b is DROPPED by default");
  assert.equal(byStage.get("3")!.planned, 0, "Stage 3 requires NEW owner authorization; not planned spend");
});

test("(b) both D-3 ceiling readings are disclosed ranges, not invented single numbers", () => {
  // D-3 AMENDED 2026-07-17: codex-only reading confirmed, ceiling 170 (owner Q&A;
  // V25_OWNER_DECISIONS.md D-3 amendment). Ranges stay disclosed estimates until
  // the Stage-0a exact recount.
  assert.equal(EXPERIMENT_BUDGET_PLAN.ceilingCodexOnlyReading, 170);
  assert.match(EXPERIMENT_BUDGET_PLAN.remainingCodexOnlyReading, /149-153/);
  assert.match(EXPERIMENT_BUDGET_PLAN.remainingCombinedReading, /superseded by the D-3 amendment/);
  assert.match(EXPERIMENT_BUDGET_PLAN.defaultPathSessions, /141/);
  assert.match(EXPERIMENT_BUDGET_PLAN.defaultPathSessions, /RESCINDED/);
});

// ── (c) ladder block selection: deterministic, never outcome-direction ─────

test("(c) selectSmallestSpreadBlock picks the block with the smallest spread", () => {
  const spreads: BlockSpread[] = [
    { block: "nudge-ch03", replicate1ESpread: 3.4 },
    { block: "made-to-stick-ch04", replicate1ESpread: 1.1 },
    { block: "the-happiness-hypothesis-ch06", replicate1ESpread: 2.7 },
  ];
  const picked = selectSmallestSpreadBlock(spreads);
  assert.equal(picked.block, "made-to-stick-ch04");
});

test("(c) selection is order-independent (same result regardless of input array order)", () => {
  const spreads: BlockSpread[] = [
    { block: "nudge-ch03", replicate1ESpread: 3.4 },
    { block: "made-to-stick-ch04", replicate1ESpread: 1.1 },
    { block: "the-happiness-hypothesis-ch06", replicate1ESpread: 2.7 },
  ];
  const reversed = [...spreads].reverse();
  assert.equal(selectSmallestSpreadBlock(spreads).block, selectSmallestSpreadBlock(reversed).block);
});

test("(c) a tie in spread breaks on block id ascending — deterministic, not first-in-array", () => {
  const spreads: BlockSpread[] = [
    { block: "the-happiness-hypothesis-ch06", replicate1ESpread: 2.0 },
    { block: "made-to-stick-ch04", replicate1ESpread: 2.0 },
  ];
  assert.equal(selectSmallestSpreadBlock(spreads).block, "made-to-stick-ch04");
  // Same tie, opposite input order -> same winner (the tie-break is on the id, not position).
  assert.equal(selectSmallestSpreadBlock([...spreads].reverse()).block, "made-to-stick-ch04");
});

test("(c) selection NEVER varies with outcome direction — the type carries no such field, and " +
  "attaching one out-of-band changes nothing", () => {
  // The BlockSpread type has exactly {block, replicate1ESpread} — no score/delta/winner field.
  // To prove the selector cannot be swayed by outcome direction even if a caller tried to smuggle
  // one in, attach an extra field via a type assertion and flip it between two otherwise-identical
  // calls: the selection must be unchanged, because selectSmallestSpreadBlock never reads it.
  type Smuggled = BlockSpread & { outcomeDirection: "sol-ahead" | "challenger-ahead" };
  const solAhead: Smuggled[] = [
    { block: "nudge-ch03", replicate1ESpread: 3.4, outcomeDirection: "sol-ahead" },
    { block: "made-to-stick-ch04", replicate1ESpread: 1.1, outcomeDirection: "sol-ahead" },
    { block: "the-happiness-hypothesis-ch06", replicate1ESpread: 2.7, outcomeDirection: "sol-ahead" },
  ];
  const challengerAhead: Smuggled[] = solAhead.map((s) => ({ ...s, outcomeDirection: "challenger-ahead" }));
  assert.equal(selectSmallestSpreadBlock(solAhead).block, selectSmallestSpreadBlock(challengerAhead).block);
  assert.equal(selectSmallestSpreadBlock(solAhead).block, "made-to-stick-ch04");
});

test("(c) an empty block list is refused fail-closed", () => {
  assert.throws(() => selectSmallestSpreadBlock([]), LadderSelectionError);
});

test("(c) a non-finite or negative spread is refused fail-closed (never selects on invalid data)", () => {
  assert.throws(
    () => selectSmallestSpreadBlock([{ block: "a", replicate1ESpread: Number.NaN }, { block: "b", replicate1ESpread: 2 }]),
    LadderSelectionError,
  );
  assert.throws(
    () => selectSmallestSpreadBlock([{ block: "a", replicate1ESpread: -0.5 }, { block: "b", replicate1ESpread: 2 }]),
    LadderSelectionError,
  );
});

test("(c) the registered ladder has exactly R1/R2/R3 in order, R1/R2 select via the same deterministic " +
  "mechanism family, and R3 halts rather than degrades further", () => {
  assert.deepEqual(DEGRADATION_LADDER.map((r) => r.id), ["R1", "R2", "R3"]);
  assert.equal(DEGRADATION_LADDER[0].selection, "smallest-replicate1-e-spread-block");
  assert.equal(DEGRADATION_LADDER[1].selection, "same-block-replicate-2");
  assert.equal(DEGRADATION_LADDER[2].selection, "halt-for-reauthorization");
  assert.equal(DEGRADATION_LADDER[0].deltaSessions, -4);
  assert.equal(DEGRADATION_LADDER[1].deltaSessions, -12);
  assert.equal(DEGRADATION_LADDER[2].deltaSessions, 0, "R3 halts; it does not remove sessions");
});

// ── (d) checkBudgetBeforeStage2 math ────────────────────────────────────────

test("(d) Stage 1 at cap WITHOUT a confirmed decision refuses, citing the registered rule", () => {
  const result = checkBudgetBeforeStage2({
    cumulativeSessionsUsed: 119,
    ceiling: 150,
    stage1Confirmed: false,
    stage1AtCap: true,
    stage2PlannedSessions: 32,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /Stage 1 at cap without confirmation = STOP/);
    assert.equal(result.remainingBeforeStage2, 31);
  }
});

test("(d) Stage 1 NOT at cap but also not confirmed refuses (a distinct reason from the at-cap rule)", () => {
  const result = checkBudgetBeforeStage2({
    cumulativeSessionsUsed: 60,
    ceiling: 150,
    stage1Confirmed: false,
    stage1AtCap: false,
    stage2PlannedSessions: 32,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /has not produced a CONFIRMED advancement decision/);
  }
});

test("(d) a confirmed Stage 1 with insufficient remaining budget refuses with the exact shortfall numbers", () => {
  const result = checkBudgetBeforeStage2({
    cumulativeSessionsUsed: 130,
    ceiling: 150,
    stage1Confirmed: true,
    stage1AtCap: false,
    stage2PlannedSessions: 32, // only 20 remain
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /20 session\(s\) remain/);
    assert.match(result.reason, /planned to spend 32/);
    assert.equal(result.remainingBeforeStage2, 20);
  }
});

test("(d) a confirmed Stage 1 with enough headroom clears, with correct before/after arithmetic", () => {
  const result = checkBudgetBeforeStage2({
    cumulativeSessionsUsed: 98,
    ceiling: 150,
    stage1Confirmed: true,
    stage1AtCap: false,
    stage2PlannedSessions: 46,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.remainingBeforeStage2, 52);
    assert.equal(result.remainingAfterStage2, 6);
  }
});

test("(d) the boundary — remaining EXACTLY equal to the Stage-2 plan — clears (not an off-by-one refusal)", () => {
  const result = checkBudgetBeforeStage2({
    cumulativeSessionsUsed: 104,
    ceiling: 150,
    stage1Confirmed: true,
    stage1AtCap: false,
    stage2PlannedSessions: 46,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.remainingBeforeStage2, 46);
    assert.equal(result.remainingAfterStage2, 0);
  }
});

test("(d) the at-cap-without-confirmation refusal takes priority even when remaining budget would " +
  "otherwise be sufficient (confirmation is checked first, never bypassed by spare budget)", () => {
  const result = checkBudgetBeforeStage2({
    cumulativeSessionsUsed: 119,
    ceiling: 150, // 31 remain — MORE than enough for a 32-session Stage 2 is false, but even if it were, cap-without-confirmation must still refuse
    stage1Confirmed: false,
    stage1AtCap: true,
    stage2PlannedSessions: 10,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /Stage 1 at cap without confirmation = STOP/);
  }
});

test("(d) STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE is a single registered sentence both refusal paths quote", () => {
  assert.match(STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE, /Stage 1 at cap without confirmation = STOP/);
  const atCap = checkBudgetBeforeStage2({
    cumulativeSessionsUsed: 119, ceiling: 150, stage1Confirmed: false, stage1AtCap: true, stage2PlannedSessions: 10,
  });
  const shortfall = checkBudgetBeforeStage2({
    cumulativeSessionsUsed: 145, ceiling: 150, stage1Confirmed: true, stage1AtCap: false, stage2PlannedSessions: 32,
  });
  assert.equal(atCap.ok, false);
  assert.equal(shortfall.ok, false);
  if (!atCap.ok) assert.ok(atCap.reason.includes(STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE));
  if (!shortfall.ok) assert.ok(shortfall.reason.includes(STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE));
});
