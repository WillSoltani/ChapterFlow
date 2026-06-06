export class BookApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "BookApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isBookApiError(value: unknown): value is BookApiError {
  return value instanceof BookApiError;
}

/**
 * A failed DynamoDB TransactWrite surfaces as a `TransactionCanceledException`
 * whose `CancellationReasons` array aligns by index with the `TransactItems`.
 * Each entry's `Code` is `"None"` for items that did not cause the cancellation
 * and `"ConditionalCheckFailed"` for the item whose `ConditionExpression` failed.
 *
 * Returns the reasons array when `error` is a transaction-cancellation (possibly
 * empty if the SDK did not populate reasons), otherwise `null`. Use this to map a
 * single cancelled transaction to the correct per-item error instead of guessing.
 */
export function transactionCancellationReasons(
  error: unknown
): Array<{ Code?: string }> | null {
  if (!error || typeof error !== "object") return null;
  const rec = error as Record<string, unknown>;
  const isCancel =
    rec.name === "TransactionCanceledException" ||
    rec.__type === "TransactionCanceledException";
  if (!isCancel) return null;
  const reasons = rec.CancellationReasons;
  return Array.isArray(reasons) ? (reasons as Array<{ Code?: string }>) : [];
}

/** True when a cancelled TransactWrite failed specifically at the given item index. */
export function isTransactionConditionFailedAt(error: unknown, index: number): boolean {
  const reasons = transactionCancellationReasons(error);
  return reasons?.[index]?.Code === "ConditionalCheckFailed";
}
