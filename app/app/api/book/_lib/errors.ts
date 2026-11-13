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

/**
 * Error codes readers can meet through the app (web and iOS). The web client
 * keeps one reader-facing message per code in app/book/_lib/error-messages.ts;
 * its test fails when a code listed here has no message there.
 */
export const ERROR_CODES = {
  unauthenticated: "unauthenticated",
  invalidToken: "invalid_token",
  bookNotStarted: "book_not_started",
  chapterLocked: "chapter_locked",
  attemptCooldown: "attempt_cooldown",
  attemptRateLimited: "attempt_rate_limited",
  paywallBookLimit: "paywall_book_limit",
  emailVerificationRequired: "email_verification_required",
  freeAccessReviewRequired: "free_access_review_required",
  serverError: "server_error",
  dashboardUnavailable: "dashboard_unavailable",
  throttled: "throttled",
  verifierUnavailable: "verifier_unavailable",
  quizStateConflict: "quiz_state_conflict",
  quizSessionStale: "quiz_session_stale",
  progressWriteContended: "progress_write_contended",
  streakWriteContended: "streak_write_contended",
  quizWriteContended: "quiz_write_contended",
  insufficientPoints: "insufficient_points",
  insufficientBalance: "insufficient_balance",
  rewardAlreadyClaimed: "reward_already_claimed",
  alreadyPro: "already_pro",
  alreadyOwned: "already_owned",
  questionLimit: "question_limit",
  proRequired: "pro_required",
  invalidAnswers: "invalid_answers",
  resetIncomplete: "reset_incomplete",
  settingsWriteConflict: "settings_write_conflict",
  rateLimited: "rate_limited",
  invalidJson: "invalid_json",
  invalidCursor: "invalid_cursor",
  chapterStateConflict: "chapter_state_conflict",
  profileWriteConflict: "profile_write_conflict",
} as const;

export type BookErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * 400 `invalid_answers` with a reader-facing message. The specific validation
 * failure stays available to developers in `details.reason`.
 */
export function invalidAnswersError(reason: string): BookApiError {
  return new BookApiError(
    400,
    ERROR_CODES.invalidAnswers,
    "Some answers didn't match this quiz. Refresh and try again.",
    { reason }
  );
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
