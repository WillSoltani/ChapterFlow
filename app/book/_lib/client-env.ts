"use client";

/**
 * Client-side build-environment flag.
 *
 * `process.env.NODE_ENV` is statically inlined by Next at build time, so in a
 * production bundle this resolves to a literal `false` and any branch guarded by
 * `IS_DEV` is dead-code-eliminated. Mirrors the server-side
 * `app/app/_lib/dev-auth-bypass.ts` gate (precedent for a client
 * `process.env.NODE_ENV` read: `AskBookDrawer.tsx`).
 *
 * Used to gate the reader's bundled local-content / local-quiz fallbacks to
 * dev/CI only (where there is no AWS data plane). In production we never fall
 * back to bundled content; the reader surfaces its existing retryable error UI
 * instead, so a real content/quiz outage is honest rather than masked.
 */
export const IS_DEV = process.env.NODE_ENV !== "production";
