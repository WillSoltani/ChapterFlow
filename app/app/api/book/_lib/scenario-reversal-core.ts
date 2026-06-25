// Pure decision seam for reversing the Insight-Points award when a previously
// APPROVED scenario submission is re-rejected by an admin.
//
// Server-only modules (the route + flow-points-repo) can't be unit-imported
// (the `server-only` guard throws at import). This file holds the math/policy
// with no I/O so it can be exercised directly by node:test.
//
// Defect (H4): the admin PATCH route awards `pointsAwarded` IP on the
// approved branch (idempotent on submissionId) but the reject branch only
// deletes the approved-scenario record and flips status — it never clawed
// back the points. An approved->rejected transition (mis-approval / abuse)
// left the user holding IP they never earned. This computes the compensating
// deduction; the repo turns it into a guarded, idempotent ledger write.

export type ScenarioReversalDecision =
  | { reverse: false }
  | { reverse: true; amount: number };

/**
 * Should re-rejecting this submission reverse a prior IP award, and how much?
 *
 * Fires ONLY on a genuine approved -> rejected transition with a positive,
 * previously-granted amount. An approve, a re-approve, or a reject of a
 * never-approved submission reverses nothing. The amount is normalized to a
 * non-negative integer (mirrors awardFlowPoints' `Math.max(0, Math.floor(...))`)
 * so the reversal can never deduct more than the award could have granted.
 */
export function decideScenarioReversal(input: {
  wasApprovedAlready: boolean;
  status: "approved" | "rejected";
  pointsAwarded: number;
}): ScenarioReversalDecision {
  if (!input.wasApprovedAlready || input.status !== "rejected") {
    return { reverse: false };
  }
  const amount =
    typeof input.pointsAwarded === "number" && Number.isFinite(input.pointsAwarded)
      ? Math.max(0, Math.floor(input.pointsAwarded))
      : 0;
  if (amount <= 0) {
    return { reverse: false };
  }
  return { reverse: true, amount };
}

/**
 * Clamp a reversal deduction to the points actually available so the balance
 * can never go negative. A user may have spent some of the wrongly-awarded IP
 * before the re-rejection; we claw back only what remains (best-effort), which
 * matches how a real ledger handles a partially-consumed erroneous credit.
 *
 * Returns a non-negative integer <= both `amount` and `currentBalance`.
 */
export function clampReversalDeduction(amount: number, currentBalance: number): number {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const safeBalance = Number.isFinite(currentBalance) ? Math.max(0, Math.floor(currentBalance)) : 0;
  return Math.min(safeAmount, safeBalance);
}
