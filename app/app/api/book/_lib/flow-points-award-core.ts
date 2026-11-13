import { BookApiError, transactionCancellationReasons } from "./errors";

/**
 * Index of the grant-marker Put inside awardFlowPoints' TransactWrite. Keep in
 * lockstep with the TransactItems order in flow-points-repo.ts.
 */
export const AWARD_TX_GRANT_INDEX = 0;

export const AWARD_TX_MAX_ATTEMPTS = 4;

export type AwardTxErrorClass =
  // The grant marker already exists: this (sourceType, sourceId) was paid before.
  | "duplicate"
  // Conflict with a concurrent write, throttling or capacity: nothing was
  // written, so the same award can safely be tried again.
  | "transient"
  // Not a transaction cancellation: rethrow as-is.
  | "rethrow";

/**
 * Classifies a failed award TransactWrite. Only a ConditionalCheckFailed on the
 * grant marker means "already awarded"; every other cancellation reason
 * (TransactionConflict on the shared engagement row, ThrottlingError,
 * ProvisionedThroughputExceeded, missing reasons) is transient.
 */
export function classifyAwardTransactionError(error: unknown): AwardTxErrorClass {
  if (error && typeof error === "object") {
    const rec = error as Record<string, unknown>;
    if (
      rec.name === "ConditionalCheckFailedException" ||
      rec.__type === "ConditionalCheckFailedException"
    ) {
      return "duplicate";
    }
  }
  const reasons = transactionCancellationReasons(error);
  if (reasons === null) return "rethrow";
  if (reasons[AWARD_TX_GRANT_INDEX]?.Code === "ConditionalCheckFailed") return "duplicate";
  return "transient";
}

export function awardContendedError(): BookApiError {
  return new BookApiError(
    503,
    "points_award_contended",
    "We couldn't record your Insight Points just now. Please try again."
  );
}

/**
 * Runs one award write with bounded retries. Resolves "awarded" or "duplicate";
 * throws a retryable 503 once the attempt budget is spent on transient
 * cancellations, and rethrows anything that is not a cancellation.
 */
export async function runAwardTransaction(params: {
  write: (attemptNo: number) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
}): Promise<"awarded" | "duplicate"> {
  const maxAttempts = params.maxAttempts ?? AWARD_TX_MAX_ATTEMPTS;
  const sleep =
    params.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attemptNo = 0; attemptNo < maxAttempts; attemptNo += 1) {
    try {
      await params.write(attemptNo);
      return "awarded";
    } catch (error: unknown) {
      const klass = classifyAwardTransactionError(error);
      if (klass === "duplicate") return "duplicate";
      if (klass === "rethrow") throw error;
      if (attemptNo === maxAttempts - 1) throw awardContendedError();
      await sleep(25 * (attemptNo + 1) + Math.floor(Math.random() * 25));
    }
  }
  throw awardContendedError();
}
