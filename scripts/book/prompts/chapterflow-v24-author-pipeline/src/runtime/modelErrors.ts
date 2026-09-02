import type { PortError } from "../contracts/v4Core.js";

export type ModelErrorCode =
  | "MODEL_TASK_INVALID"
  | "MODEL_PROFILE_INVALID"
  | "MODEL_RUN_UNAVAILABLE"
  | "MODEL_RUN_CANCELLED"
  | "MODEL_CAPACITY_EXHAUSTED"
  | "MODEL_ATTEMPT_EXISTS"
  | "MODEL_ADMISSION_DENIED"
  | "MODEL_PROCESS_FAILED"
  | "MODEL_OUTPUT_INVALID"
  | "MODEL_EXECUTION_UNCERTAIN"
  | "MODEL_TERMINAL_RECORD_FAILED"
  | "MODEL_CLI_UNQUALIFIED";

export interface ModelError extends PortError {
  readonly code: ModelErrorCode;
}

/**
 * Task 11af: DURABLE provider quota exhaustion vs a SHORT rate limit.
 *
 * Both surface as HTTP 429, but they need opposite handling: a short
 * rate_limit_error clears in seconds (bounded retry is right), while a weekly /
 * monthly / usage cap persists until the provider's quota window resets — hours
 * to days — so every in-loop retry burns an attempt and buries the real cause.
 * Live 2026-07-24: "You've hit your weekly limit - resets Jul 28 at 8pm" spent
 * 3 attempts x 5 operator rounds while reporting only "a transient model process
 * failure occurred before any output was produced".
 *
 * The discriminator is the provider's own wording — a named cap window or an
 * explicit reset horizon — not the status code, which cannot separate the two.
 * Matched against the message the 11x envelope classifier now surfaces verbatim.
 */
export function isQuotaExhaustedMessage(message: string): boolean {
  return /\b(weekly|monthly|daily|usage)\s+limit\b/i.test(message)
    || /\blimit\b[^\n]{0,40}\bresets\b/i.test(message);
}

/**
 * Task 11aj: provider CREDENTIAL failure. A session that is not logged in
 * cannot be fixed by trying again inside the run — every attempt fails
 * identically until a human re-authenticates — so it belongs with durable quota
 * exhaustion, not with transient process blips.
 *
 * Live 2026-08-11: the CLI session expired mid-canary. The envelope carried
 * "Not logged in \u00b7 Please run /login", which classified as
 * MODEL_PROCESS_FAILED, was treated as transient, and burned 3 attempts x 7
 * operator rounds — every one of them reporting "a transient model process
 * failure occurred before any output was produced" while the actual cause was
 * a one-command fix the operator never saw.
 */
export function isCredentialFailureMessage(message: string): boolean {
  return /\bnot logged ?in\b/i.test(message)
    || /\bplease run \/login\b/i.test(message)
    || /\b(authentication|unauthorized|invalid[_ ]api[_ ]key|credentials?)\b[^\n]{0,40}\b(failed|expired|missing|invalid|required)\b/i.test(message)
    || /\bapi_error_status["\s:]*401\b/i.test(message);
}

/** Which provider-side block a message describes, or null when it describes
 *  none. Named so a fail-fast terminal code can say WHICH wall the run hit —
 *  an exhausted quota window and an expired login need different operator
 *  actions (wait for the reset vs. run one command). */
export type ProviderBlockKind = "quota-exhausted" | "credential-failure";

export function providerBlockKind(message: string): ProviderBlockKind | null {
  if (isQuotaExhaustedMessage(message)) return "quota-exhausted";
  if (isCredentialFailureMessage(message)) return "credential-failure";
  return null;
}

/** Provider-side conditions that cannot clear by retrying inside this run.
 *  Retry loops should fail fast on these and surface the provider's own words. */
export function isUnretryableProviderMessage(message: string): boolean {
  return providerBlockKind(message) !== null;
}

/**
 * R-201: which provider block a MODEL RESULT's error describes, or null.
 *
 * The one place consumers should ask. `PortError.message` stays the source of
 * truth because it is the only place the provider's own words live, and the
 * gateway records the answer alongside it as `retryable: false` (see
 * `modelError`) so the durable attempt record carries the verdict too. Keeping
 * one function means the reader lane, the compiler section loop and the two
 * research lanes cannot drift into three slightly different regexes.
 */
export function providerBlockOfError(error: PortError | undefined): ProviderBlockKind | null {
  return error === undefined ? null : providerBlockKind(error.message);
}

/**
 * `retryable` is TRI-STATE and the absent state is load-bearing.
 *
 * Present-and-false = a classified durable provider block: trying again inside
 * this run cannot help. Present-and-true = a condition a fresh attempt clears.
 * ABSENT = the minting layer does not know, which is what nearly every failure
 * honestly is; the old signature could not express that, defaulted to `false`
 * and then dropped it, so the field was never written at all (R-201: no call
 * site ever passed the third argument). Passing nothing still writes nothing.
 */
export function modelError(code: ModelErrorCode, message: string, retryable?: boolean): ModelError {
  return { code, message, ...(retryable === undefined ? {} : { retryable }) };
}
