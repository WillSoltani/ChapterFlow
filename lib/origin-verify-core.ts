// WS6-002 origin-verify core. The public Lambda Function URLs fronting this app
// are authType NONE (an OAC/SigV4 re-lock 403'd every RESPONSE_STREAM route at
// runtime and was reverted — see infra/lib/chapterflow-frontend-stack.ts). The
// interim origin lock is a shared-secret header CloudFront injects
// (x-origin-verify); middleware.ts enforces it on the server path. This module
// holds the pure comparison logic so it is unit-testable in isolation.
//
// Import constraint: this file must stay free of next/* and "server-only" — it
// is imported by middleware.ts (which may be edge-compiled) and by a plain
// node:test file, and "server-only" throws at test import time (repo trap).
// For the same edge-compile reason the compare uses a charCode XOR loop rather
// than node:crypto's timingSafeEqual.

/**
 * Length-safe, data-independent string compare. The loop count depends only on
 * the inputs' lengths (not on where the first differing char sits), and a length
 * mismatch is folded into the accumulator so unequal-length inputs can never
 * return true and never short-circuit on the shorter length.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Decide what to do with an inbound request given the configured secret, the
 * provided header value, and the mode. Secret unset → allow (today's behavior on
 * envs that haven't introduced the secret). Match → allow. Mismatch → "warn" in
 * log mode (two-phase rollout observation window), "deny" otherwise (enforce is
 * the default when mode is anything but exactly "log").
 */
export function evaluateOriginVerify(
  secret: string | undefined,
  provided: string | null,
  mode: string | undefined,
): "allow" | "deny" | "warn" {
  if (!secret) return "allow";
  if (provided !== null && constantTimeEqual(secret, provided)) return "allow";
  return mode === "log" ? "warn" : "deny";
}
