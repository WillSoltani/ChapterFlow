import { createHash } from "node:crypto";

const CANONICAL_COGNITO_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const APPLE_TESTFLIGHT_SUBJECT_HASH_PATTERN = /^[0-9a-f]{64}$/;

/** One-way deployment representation of a high-entropy Cognito UUID. */
export function hashAppleTestFlightSubject(canonicalUserId: string): string {
  return createHash("sha256").update(canonicalUserId, "utf8").digest("hex");
}

export type AppleTestFlightSubjectHashResult =
  | { valid: true; hashes: string[] }
  | { valid: false; issue: "invalid_testflight_qa_allowlist" };

/**
 * CI-only boundary: validate raw protected input, then emit only SHA-256
 * digests. The raw Cognito subjects must never cross into CDK, CloudFormation,
 * Lambda configuration, artifacts, or logs.
 */
export function deriveAppleTestFlightSubjectHashes(
  rawUserIds: string | undefined,
): AppleTestFlightSubjectHashResult {
  const values = (rawUserIds ?? "").split(",").map((value) => value.trim());
  if (
    values.length === 0 ||
    values.some((value) => !CANONICAL_COGNITO_UUID_PATTERN.test(value)) ||
    new Set(values).size !== values.length
  ) {
    return { valid: false, issue: "invalid_testflight_qa_allowlist" };
  }
  return {
    valid: true,
    hashes: values.map(hashAppleTestFlightSubject),
  };
}
