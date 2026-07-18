// Pure, `server-only`-free boot-time env validator (WS3-012).
//
// Today env access is lazy: `mustServerEnv()` (server-env.ts) only throws
// "Missing env var: X" the first time some request path actually awaits it —
// a misconfigured deploy can serve traffic for a while before the first
// request that happens to touch the missing var 500s. This module gives
// instrumentation.ts (repo root) something to check ONCE, at process boot, in
// production, so a bad deploy fails loudly and immediately instead of lazily
// per-request.
//
// Kept free of `server-only`, `next/*`, and any AWS SDK import so it stays
// importable (and unit-testable under plain `tsx --test`) from anywhere,
// including instrumentation.ts, which Next may load outside the Node.js
// runtime — see instrumentation.ts's own runtime/phase guards for why that
// matters.
//
// ─── What belongs in REQUIRED_SERVER_ENV ────────────────────────────────────
// A name goes in the list below ONLY when its absence is CERTAIN to break a
// core, already-broadly-used route with NO fallback — i.e. it is read via
// `mustServerEnv()` (not the optional `getServerEnv()`) somewhere on a path
// that a large share of requests exercise. A false-positive boot failure
// (the process refusing to start over a var a legitimate deployment doesn't
// need) is worse than today's status quo of a lazy per-request throw, so this
// list is deliberately conservative and under-inclusive rather than
// over-inclusive. Every var below was also cross-checked against
// `infra/lib/chapterflow-frontend-stack.ts` / `infra/bin/app.ts` to confirm
// it is injected as a literal Lambda environment variable in every deployed
// env (never resolved only via the SSM fallback in server-env.ts) — so
// checking `process.env` alone at boot cannot false-positive against a
// deploy that legitimately relies on the SSM path for some OTHER var.
//
// mustServerEnv()-backed vars considered and deliberately left OUT, with why:
//   - BOOK_INGEST_BUCKET (env.ts getBookIngestBucket) — mustServerEnv-backed,
//     but only read by the admin ingest/upload-request routes
//     (app/app/api/book/admin/ingest/run, .../books/upload-request), not by
//     any reader-facing or broadly-authenticated route. Missing it breaks
//     the admin content pipeline, not core serving.
//   - COGNITO_DOMAIN (auth/_lib/cognito-domain.ts resolveCognitoDomain) —
//     mustServerEnv-backed, but only as the FALLBACK when
//     COGNITO_CUSTOM_DOMAIN is unset; it is an either/or pair, not a single
//     unconditionally-required name, and this validator only checks flat
//     presence of individual keys.
//   - COGNITO_REDIRECT_URI / COGNITO_LOGOUT_REDIRECT_URI (auth/login,
//     auth/callback, auth/logout, auth/refresh) — mustServerEnv-backed, but
//     narrow blast radius: only the login/callback/logout/refresh routes
//     read them. An already-authenticated session reading a book, taking a
//     quiz, or hitting billing does not depend on them, so they don't meet
//     the "core route" bar the way the JWT-verification vars below do.
//   - Everything else touched by `mustServerEnv`/`getServerEnv` elsewhere
//     (BOOK_ANALYTICS_TABLE_NAME, BOOK_STRIPE_*, BOOK_ADMIN_GROUP,
//     BOOK_FREE_SLOTS_DEFAULT, BOOK_PAYWALL_PRICE, ANTHROPIC_API_KEY,
//     ELEVENLABS_API_KEY, APPLE_*, APNS_*, VAPID_*, IPAPI_KEY, IOS_*, SES_*,
//     EMAIL_*, AUTH_STATE_SECRET, CHAPTERFLOW_ORIGIN_VERIFY_SECRET, ...) is
//     read via the OPTIONAL `getServerEnv()` with an in-code fallback or a
//     feature-scoped throw, never `mustServerEnv()` on a core path — by
//     construction none of those can be "certain to break core serving".

export type RequiredServerEnvVar = {
  name: string;
  /** Why this var is unconditionally required for core serving. */
  reason: string;
};

export const REQUIRED_SERVER_ENV: readonly RequiredServerEnvVar[] = [
  {
    name: "BOOK_TABLE_NAME",
    reason:
      "The single DynamoDB table backing nearly every book/library/me/admin " +
      "route (getBookTableName(), app/app/api/book/_lib/env.ts). Injected as " +
      "a literal Lambda env var in every CDK env (baseInfraEnv in " +
      "infra/lib/chapterflow-frontend-stack.ts) — never SSM-only.",
  },
  {
    name: "BOOK_CONTENT_BUCKET",
    reason:
      "The S3 bucket serving book/chapter content and cover images " +
      "(getBookContentBucket()); read by nearly every book-detail/chapter/" +
      "quiz route and by next.config.ts's image remote patterns. Same " +
      "direct-Lambda-env-var guarantee as BOOK_TABLE_NAME.",
  },
  {
    name: "COGNITO_REGION",
    reason:
      "Builds the Cognito issuer URL that verifies every id_token " +
      "(getAuthConfig() in app/app/api/_lib/auth.ts, used by requireUser()). " +
      "Its absence throws on every authenticated route in the app (all " +
      "/me/*, all /book/admin/*) outside the hard-gated " +
      "NODE_ENV!==production dev-bypass path. infra/bin/app.ts asserts this " +
      "in its prod-synth requiredConfiguration list and injects it as a " +
      "literal serverEnv value — never SSM-only.",
  },
  {
    name: "COGNITO_USER_POOL_ID",
    reason:
      "Same JWKS-issuer-URL call site and same blast radius as " +
      "COGNITO_REGION — both are required to verify any token requireUser() " +
      "sees. Same infra guarantee (literal env var, asserted at prod synth).",
  },
  {
    name: "COGNITO_CLIENT_ID",
    reason:
      "The expected `aud` claim requireUser() checks on every verified " +
      "token (same getAuthConfig() call site); also required directly by " +
      "the login/callback/logout/refresh routes. Same infra guarantee.",
  },
];

/**
 * Check `env` for every {@link REQUIRED_SERVER_ENV} name. A value that is
 * `undefined` or empty/whitespace-only counts as missing — an accidentally
 * blank Lambda env var is exactly the misconfiguration this guards against.
 */
export function validateRequiredServerEnv(
  env: Record<string, string | undefined>,
): { missing: string[] } {
  const missing = REQUIRED_SERVER_ENV.filter(({ name }) => {
    const value = env[name];
    return value === undefined || value.trim() === "";
  }).map(({ name }) => name);
  return { missing };
}
