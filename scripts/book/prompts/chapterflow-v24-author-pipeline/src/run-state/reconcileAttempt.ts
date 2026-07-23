import type { AttemptId, BookId, Result, RunId, UtcIso } from "../contracts/v4Core.js";
import { RunStateFault, runStoreFailure, type RunStore } from "./runStore.js";
import type { AttemptSnapshot } from "./runTypes.js";

/** Terminal marker written to a reconciled attempt's finish detail so an
 *  operator reading the attempt journal sees exactly which attempts crash
 *  recovery settled (and that it was recovery, not a real model outcome). */
export const RECONCILED_UNSETTLED_ON_RESUME = "RECONCILED_UNSETTLED_ON_RESUME";

export interface ReconcileAttemptInput {
  readonly bookId: BookId;
  readonly runId: RunId;
  readonly attemptId: AttemptId;
  readonly outcome: "UNKNOWN" | "ABANDONED";
  readonly finishedAt: UtcIso;
  readonly detail?: string;
}

export async function reconcileAttempt(
  store: RunStore,
  input: ReconcileAttemptInput,
): Promise<Result<AttemptSnapshot>> {
  if (input.outcome !== "UNKNOWN" && input.outcome !== "ABANDONED") {
    return runStoreFailure(new RunStateFault("INVALID_INPUT", "reconciliation outcome must be UNKNOWN or ABANDONED"));
  }
  return store.finishAttempt(input);
}
