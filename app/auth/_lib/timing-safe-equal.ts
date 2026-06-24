import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string equality (#15). Used by the OAuth callback fallback nonce
 * check, which compares an attacker-influenced value (the `state` query param)
 * against our stored nonce; a `===` short-circuits on the first differing byte
 * and leaks a timing oracle on the secret.
 *
 * `node:crypto.timingSafeEqual` requires equal-length buffers (it THROWS on a
 * mismatch), so we length-guard first — a length difference is itself a
 * definitive non-match. We UTF-8 encode both sides before comparing.
 *
 * Pure (no `server-only`) so it is directly unit-testable.
 */
export function timingSafeStrEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
