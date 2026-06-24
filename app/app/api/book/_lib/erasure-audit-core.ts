/**
 * Erasure-audit subject hashing (#4b).
 *
 * The permanent erasure audit log proves an erasure HAPPENED, but it must not
 * retain the plaintext Cognito sub of an erased user (that would defeat the
 * erasure — a durable identifier for someone who exercised their right to be
 * forgotten). Instead we store a one-way hash of the sub:
 *
 *   - KEYED HMAC-SHA-256 when a secret is available (preferred): an attacker who
 *     reads the audit table cannot brute-force the (low-entropy-ish) sub space
 *     without also having the secret.
 *   - UNKEYED SHA-256 fallback when no secret is configured, plus a residual
 *     warning — we never lose the audit just because a secret is missing.
 *
 * The hash is deterministic for a given (sub, secret) so two audits of the same
 * sub collide intentionally (an operator can correlate "was THIS sub erased?"
 * given the sub, without the table leaking the sub).
 *
 * Only `node:crypto` — no AWS, no server-only — so it is unit testable. The
 * secret is resolved by the caller (server-only) and passed in.
 */
import { createHash, createHmac } from "node:crypto";

export type ErasureSubjectHash = {
  /** Hex digest stored in place of the raw sub. */
  hash: string;
  /** "hmac-sha256" (keyed) or "sha256" (unkeyed fallback). */
  algorithm: "hmac-sha256" | "sha256";
  /** True when the keyed HMAC path was used. */
  keyed: boolean;
};

/**
 * Hash a Cognito sub for the erasure audit. Prefer a keyed HMAC; fall back to a
 * plain SHA-256 when no usable secret is provided. A whitespace-only secret is
 * treated as absent.
 */
export function hashErasureSubject(
  userId: string,
  secret: string | null | undefined,
): ErasureSubjectHash {
  const usableSecret = typeof secret === "string" ? secret.trim() : "";
  if (usableSecret) {
    return {
      hash: createHmac("sha256", usableSecret).update(userId).digest("hex"),
      algorithm: "hmac-sha256",
      keyed: true,
    };
  }
  return {
    hash: createHash("sha256").update(userId).digest("hex"),
    algorithm: "sha256",
    keyed: false,
  };
}
