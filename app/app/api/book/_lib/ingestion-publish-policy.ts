import type { BookVersionItem } from "./types";

/**
 * Should the idempotency/reuse branch of `ingestBookPackageFromS3` publish an
 * already-existing version?
 *
 * The reuse branch returns an existing version (matched by `packageId`) instead
 * of allocating a new one. Without this decision it returned early and ignored
 * `publishNow` entirely, so a draft→publish re-ingest (same package, ingested as
 * DRAFT, then re-run with `publishNow=true`) silently no-op'd: the job reported
 * SUCCEEDED + `published:true` but the version stayed DRAFT and the book never
 * went live.
 *
 * Publish when the operator asked to (`publishNow`) and the version is not
 * already PUBLISHED. Skipping the already-PUBLISHED case avoids a redundant
 * 3-write churn in `publishBookVersion` (idempotent, but pointless).
 *
 * Kept free of `server-only`/AWS imports so the policy can be unit-tested
 * directly (mirrors `account-guard-policy.ts`).
 */
export function shouldPublishReusedVersion(
  publishNow: boolean,
  existingState: BookVersionItem["state"]
): boolean {
  return publishNow && existingState !== "PUBLISHED";
}
