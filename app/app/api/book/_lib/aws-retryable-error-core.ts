/**
 * Detects AWS SDK throttling errors that should surface as a retryable 503
 * (with a Retry-After hint) instead of a generic 500 `server_error`.
 *
 * No `server-only` import — this is duck-typed against the shape the AWS SDK
 * v3 attaches to thrown errors, the same style as `errors.ts`'s
 * `transactionCancellationReasons` (`rec.name === ... || rec.__type === ...`),
 * so it stays plain-object-testable without pulling in real SDK clients.
 *
 * DynamoDB throttling (`ProvisionedThroughputExceededException`,
 * `RequestLimitExceeded`) surfaces with `$metadata.httpStatusCode === 400`,
 * NOT 429/503 — the HTTP status alone is not a reliable throttle signal for
 * those services, so the error name / `__type` and `$retryable.throttling`
 * checks are load-bearing and must run before (or independent of) the
 * `$metadata` status-code check.
 */

const THROTTLE_ERROR_NAMES = new Set([
  "ThrottlingException",
  "ProvisionedThroughputExceededException",
  "TooManyRequestsException",
  "RequestLimitExceeded",
  "SlowDown",
  "ServiceUnavailable",
  "RequestThrottled",
  "RequestThrottledException",
  "LimitExceededException",
]);

const THROTTLE_HTTP_STATUS_CODES = new Set([429, 503]);

/**
 * Returns `{ retryAfterSeconds }` when `error` is a recognized AWS SDK
 * throttling error, otherwise `null`. The retry hint is a fixed, conservative
 * value — AWS SDK throttle errors do not carry a standard Retry-After
 * duration, so we do not invent per-error precision.
 */
export function classifyRetryableAwsError(error: unknown): { retryAfterSeconds: number } | null {
  if (!error || typeof error !== "object") return null;
  const rec = error as Record<string, unknown>;

  const name = typeof rec.name === "string" ? rec.name : undefined;
  const type = typeof rec.__type === "string" ? rec.__type : undefined;
  if ((name && THROTTLE_ERROR_NAMES.has(name)) || (type && THROTTLE_ERROR_NAMES.has(type))) {
    return { retryAfterSeconds: 1 };
  }

  const retryable = rec.$retryable;
  if (
    retryable &&
    typeof retryable === "object" &&
    (retryable as Record<string, unknown>).throttling === true
  ) {
    return { retryAfterSeconds: 1 };
  }

  // Only trust an HTTP status code when it arrives on an actual `$metadata`
  // object (the AWS SDK v3 response-metadata shape) — a bare `httpStatusCode`
  // property elsewhere on an unrelated object is not a throttle signal.
  const metadata = rec.$metadata;
  if (metadata && typeof metadata === "object") {
    const status = (metadata as Record<string, unknown>).httpStatusCode;
    if (typeof status === "number" && THROTTLE_HTTP_STATUS_CODES.has(status)) {
      return { retryAfterSeconds: 1 };
    }
  }

  return null;
}
