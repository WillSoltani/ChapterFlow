/**
 * Pure decision seam for the public search-index read.
 *
 * The route imports `server-only` (S3 client), so this seam carries the
 * observable failure policy where it can be unit-tested: a backend fault
 * (missing env, S3/IAM error) must be logged and emit an ops metric instead
 * of silently degrading into the same 200 empty-array response a genuinely
 * empty index produces. The HTTP shape itself is native-contract-locked
 * (`search-index.get` serves iOS), so failures still degrade to an empty
 * index — but never silently.
 */

export type SearchIndexReadResult =
  | { kind: "ok"; body: string }
  | { kind: "empty" }
  | { kind: "failed" };

export async function readSearchIndex(deps: {
  fetchIndexBody: () => Promise<string | undefined>;
  logError: (error: unknown) => void;
  emitOpsFailure: () => Promise<void>;
}): Promise<SearchIndexReadResult> {
  let body: string | undefined;
  try {
    body = await deps.fetchIndexBody();
  } catch (error) {
    deps.logError(error);
    try {
      await deps.emitOpsFailure();
    } catch {
      // Metric emission must never mask the degrade path.
    }
    return { kind: "failed" };
  }
  if (!body) return { kind: "empty" };
  return { kind: "ok", body };
}
