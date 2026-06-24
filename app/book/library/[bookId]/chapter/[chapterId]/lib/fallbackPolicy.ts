/**
 * Decides whether the reader may fall back to bundled LOCAL package content /
 * quiz data when the production API read fails.
 *
 * Pure + side-effect-free so it can be unit-tested in isolation; the hooks that
 * own the fetch (`useChapterContent`, `useQuizSession`) call it at every catch /
 * unusable-response site and only reach for the local bundle when it returns
 * true.
 *
 * Policy:
 *  - **dev / CI (`isDev === true`): always fall back.** Local dev runs with NO
 *    AWS data plane, so the bundled v21 content/quiz is the ONLY source — dev
 *    behavior must stay byte-identical.
 *  - **prod (`isDev === false`): NEVER fall back — for ANY status.** That
 *    includes connectivity failures / 5xx / `null` (no HTTP status) AND the
 *    access codes 402/403/404. The bundled local quiz grades on a divergent
 *    choiceId scheme and the local content can be stale, so masking a real
 *    outage with it is worse than surfacing the existing retryable error UI.
 *    Access decisions (paywall/locked/not-found) must come from the server, not
 *    a local copy.
 *
 * `status` is the HTTP status of the failed read when it was a
 * `BookClientError` (e.g. 402/403/404/5xx), or `null` for a network error / a
 * 200 that reconstructed to an empty body. It does not change the prod decision
 * today (always false); it is threaded through so callers can pass it and so the
 * contract is explicit if the policy ever needs to branch on it.
 */
export function shouldUseLocalFallback(isDev: boolean, status: number | null): boolean {
  void status; // intentionally not consulted: prod never falls back, dev always does.
  return isDev;
}
