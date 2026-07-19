import { BookApiError } from "./errors";

// Pure, server-only-free request-guard helpers (#6 CSRF/same-origin, #8 size
// caps + daily-limit decision). Kept in a `-core` module — with NO `server-only`
// import and NO AWS deps — so they are directly unit-testable under `tsx --test`
// (importing http.ts itself pulls `server-only` via auth.ts/env.ts). http.ts
// re-exports these and adds the thin server-side wrappers (`requireSameOrigin`
// resolves the app origin; `enforceDailyUserLimit` talks to DynamoDB).

// ─── Same-origin / CSRF guard (#6) ───────────────────────────────────────────

export const UNSAFE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const CSRF_OBSERVE_ONLY_VALUES = new Set(["0", "false", "off", "no"]);

export type CsrfEnforcementInput = {
  nodeEnvironment: string | undefined;
  deploymentEnvironment: string | undefined;
  enforcementFlag: string | undefined;
};

/**
 * Pure production-safe decision for the CSRF origin guard.
 *
 * Deployed Lambdas use `NODE_ENV=production` in every environment, while
 * `CHAPTERFLOW_ENV` carries the canonical `dev | staging | prod` identity.
 * Explicit dev/staging deployments may therefore opt into observation; every
 * other explicit deployment identity fails closed. When that identity is
 * absent (local/legacy runtime), NODE_ENV=production is the safe fallback.
 */
export function shouldEnforceCsrfOrigin(params: CsrfEnforcementInput): boolean {
  const deploymentEnvironment = params.deploymentEnvironment?.trim().toLowerCase();
  const explicitlyNonProduction =
    deploymentEnvironment === "dev" || deploymentEnvironment === "staging";
  const productionRuntime = deploymentEnvironment
    ? !explicitlyNonProduction
    : params.nodeEnvironment?.trim().toLowerCase() === "production";

  if (productionRuntime) return true;

  const raw = params.enforcementFlag?.trim().toLowerCase();
  return !raw || !CSRF_OBSERVE_ONLY_VALUES.has(raw);
}

/** Runtime adapter retained for callers that need the current process config. */
export function isCsrfEnforcementOn(): boolean {
  return shouldEnforceCsrfOrigin({
    nodeEnvironment: process.env.NODE_ENV,
    deploymentEnvironment: process.env.CHAPTERFLOW_ENV,
    enforcementFlag: process.env.CSRF_ORIGIN_ENFORCE,
  });
}

/** Lowercased scheme+host(+port) of a URL/origin string, or null if unparseable. */
export function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

export type SameOriginDecision =
  | { rejected: false }
  | { rejected: true; reason: string };

/**
 * Naive registrable domain = the last two dot-labels. Good enough for our
 * `*.chapterflow.ca` apex (apex / www / app all collapse to `chapterflow.ca`);
 * NOT a full Public-Suffix-List parse, so it would be too permissive on a
 * multi-label TLD (e.g. `co.uk`). Only used on the archaic-client fallback path
 * below to recognise first-party sibling hosts.
 */
function registrableDomain(host: string): string {
  const labels = host.split(".");
  return labels.length <= 2 ? host : labels.slice(-2).join(".");
}

/** Same scheme AND same registrable domain (a first-party sibling host). */
function isSameSiteOrigin(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return (
      ua.protocol === ub.protocol &&
      registrableDomain(ua.hostname) === registrableDomain(ub.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Pure same-origin decision. Caller supplies the request method, the relevant
 * headers, and the already-resolved canonical app origin (server-side
 * `getAppBaseUrl`). Returns whether the request should be rejected and why.
 *
 * Rules (only for POST/PATCH/PUT/DELETE — safe methods are never rejected):
 *   - `Sec-Fetch-Site: same-origin | none` → ALLOW. Sec-Fetch-Site is a Forbidden
 *     Header (browser-set, unforgeable by web content), so when present it
 *     authoritatively proves the relationship — and it is correct no matter which
 *     first-party host (apex / www / app) the user loaded the app on, because the
 *     browser computes it relative to THAT page's own origin. We therefore trust
 *     it and do NOT compare Origin against a single pinned canonical origin (doing
 *     so 403'd every mutation from users served on a non-canonical host).
 *   - `Sec-Fetch-Site: cross-site | same-site` → REJECT.
 *   - Any other nonblank `Sec-Fetch-Site` value → REJECT. Unknown browser-set
 *     values must not fall through with no canonical app origin and fail open.
 *   - No Sec-Fetch-Site (archaic / non-browser clients): fall back to `Origin` —
 *     allow when it equals the app origin OR is a first-party sibling host (same
 *     scheme + registrable domain); reject a cross-site Origin; and STRICT-DEFAULT
 *     reject when neither `Origin` nor `Sec-Fetch-Site` is present (a real
 *     same-origin browser fetch always sends at least `Origin`). `originOf`
 *     returns null for a missing header AND for the literal "null" origin.
 */
export function evaluateSameOrigin(params: {
  method: string;
  secFetchSite: string | null;
  originHeader: string | null;
  appOrigin: string | null;
}): SameOriginDecision {
  const method = params.method.toUpperCase();
  if (!UNSAFE_METHODS.has(method)) return { rejected: false };

  const secFetchSite = params.secFetchSite?.trim().toLowerCase() || null;

  if (secFetchSite === "same-origin" || secFetchSite === "none") {
    return { rejected: false };
  }
  if (secFetchSite === "cross-site" || secFetchSite === "same-site") {
    return { rejected: true, reason: `sec-fetch-site=${secFetchSite}` };
  }
  if (secFetchSite) {
    return { rejected: true, reason: `unsupported sec-fetch-site=${secFetchSite}` };
  }

  // Sec-Fetch-Site absent → Origin fallback.
  const requestOrigin = originOf(params.originHeader);
  if (requestOrigin) {
    const appOrigin = params.appOrigin ? params.appOrigin.toLowerCase() : null;
    if (!appOrigin) return { rejected: false }; // can't resolve our origin → don't false-reject
    if (requestOrigin === appOrigin || isSameSiteOrigin(requestOrigin, appOrigin)) {
      return { rejected: false };
    }
    return { rejected: true, reason: `origin=${requestOrigin} != app=${appOrigin}` };
  }
  return { rejected: true, reason: "no Origin and no Sec-Fetch-Site header" };
}

// ─── Input byte caps (#8) ────────────────────────────────────────────────────
//
// Some routes Put user-supplied free-text straight into DynamoDB. A single
// DynamoDB item is hard-capped at 400KB; an unbounded write can blow the item
// (500s the user out of their own data) or be abused for cheap storage. These
// are CHARACTER caps (not exact UTF-8 bytes) — generous for prose, well under
// the 400KB item ceiling even at 4 bytes/char.

/** Default per-string-value cap for settings (≈4k chars ≤ 16KB worst case). */
export const SETTINGS_VALUE_MAX_CHARS = 4000;
/** Default cap for chapter-state free-text notes (≈20k chars ≤ 80KB worst case). */
export const CHAPTER_NOTES_MAX_CHARS = 20000;
/**
 * Aggregate cap for the WHOLE settings item (≈32k chars ≤ 128KB worst case,
 * safely under the 400KB DynamoDB ceiling with PK/SK/metadata overhead). Bounds
 * the merged item — see {@link assertWithinTotalSize}.
 */
export const SETTINGS_TOTAL_MAX_CHARS = 32000;

/**
 * Recursively assert that no string anywhere inside `value` exceeds `maxChars`.
 * Walks plain objects and arrays; ignores non-string leaves. Throws
 * `BookApiError(413, "payload_too_large")` naming the offending path on the
 * first violation. Pure + synchronous.
 *
 * `maxDepth` bounds recursion so a deeply-nested adversarial payload can't blow
 * the stack before the cap fires.
 */
export function assertWithinSizeLimits(
  value: unknown,
  maxChars: number,
  field = "value",
  maxDepth = 12
): void {
  const visit = (node: unknown, path: string, depth: number): void => {
    if (typeof node === "string") {
      if (node.length > maxChars) {
        throw new BookApiError(
          413,
          "payload_too_large",
          `${path} is too long (max ${maxChars} characters).`
        );
      }
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (depth >= maxDepth) {
      throw new BookApiError(413, "payload_too_large", `${field} is nested too deeply.`);
    }
    if (Array.isArray(node)) {
      node.forEach((child, i) => visit(child, `${path}[${i}]`, depth + 1));
      return;
    }
    for (const [k, child] of Object.entries(node as Record<string, unknown>)) {
      visit(child, `${path}.${k}`, depth + 1);
    }
  };
  visit(value, field, 0);
}

/**
 * Assert the AGGREGATE serialized size of `value` is within `maxTotalChars`.
 * {@link assertWithinSizeLimits} bounds each individual string but neither the
 * key COUNT nor the total size, so a read-modify-write merge (e.g. the settings
 * PATCH) can grow an item across many requests — every string in-limit — until
 * it blows DynamoDB's 400KB item ceiling and 500s the user out of their own
 * data. We use JSON length as a cheap, monotonic proxy for stored size. Throws
 * `BookApiError(413, "payload_too_large")`. Pure + synchronous.
 *
 * `previousLength` (default 0) makes the cap GROWTH-only: a write is rejected
 * only when it breaches the cap AND is larger than what was already stored, so a
 * user whose item already legitimately exceeds the cap (e.g. legacy accumulation
 * before this guard existed) is never locked out of saving or SHRINKING it.
 * Callers that want a hard cap (no prior state) simply omit the argument.
 */
export function assertWithinTotalSize(
  value: unknown,
  maxTotalChars: number,
  field = "value",
  previousLength = 0
): void {
  let total: number;
  try {
    total = JSON.stringify(value)?.length ?? 0;
  } catch {
    // Circular/unserializable structure → treat as over-limit, never crash.
    throw new BookApiError(413, "payload_too_large", `${field} is too large.`);
  }
  if (total > maxTotalChars && total > previousLength) {
    throw new BookApiError(
      413,
      "payload_too_large",
      `${field} is too large (max ${maxTotalChars} characters total).`
    );
  }
}

// ─── Per-user daily rate limit (#8) — pure parts ─────────────────────────────

/** UTC date bucket `YYYY-MM-DD` for a given epoch-ms (default: now). */
export function dailyLimitDateKey(nowMs: number = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Pure decision helper for the daily limiter — unit-testable without DynamoDB.
 * Given the stored count BEFORE this request and the limit, returns whether the
 * request is allowed (i.e. whether the conditional increment would succeed).
 * `priorCount === undefined` models a first-of-day write (item absent).
 */
export function isWithinDailyLimit(
  priorCount: number | undefined,
  limit: number
): boolean {
  return (priorCount ?? 0) < limit;
}
