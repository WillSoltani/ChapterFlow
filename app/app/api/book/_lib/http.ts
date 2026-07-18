import { NextResponse } from "next/server";
import { AuthError } from "@/app/app/api/_lib/auth";
import { isHeaderAuthenticatedRequest } from "@/app/app/api/_lib/auth-credential-core";
import { logger } from "@/lib/logging/logger";
import { runWithRequestContext } from "@/lib/logging/request-context";
import { BookApiError, isBookApiError } from "./errors";
import { getAppBaseUrl } from "./env";
import {
  evaluateSameOrigin,
  isCsrfEnforcementOn,
  originOf,
  UNSAFE_METHODS,
} from "./http-guards-core";

// Re-export the pure request-guard helpers (#8) so call sites keep importing
// from "./http". The pure logic lives in http-guards-core.ts (no `server-only`)
// so it stays unit-testable; see that file.
export {
  assertWithinSizeLimits,
  assertWithinTotalSize,
  dailyLimitDateKey,
  isWithinDailyLimit,
  evaluateSameOrigin,
  isCsrfEnforcementOn,
  SETTINGS_VALUE_MAX_CHARS,
  SETTINGS_TOTAL_MAX_CHARS,
  CHAPTER_NOTES_MAX_CHARS,
} from "./http-guards-core";

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};

function requestIdFromHeaders(req: Request): string {
  return req.headers.get("x-amzn-trace-id") || crypto.randomUUID();
}

// ─── Same-origin / CSRF guard (#6) ───────────────────────────────────────────
//
// Cookie-authed mutating routes are otherwise protected only by SameSite=Lax,
// which a top-level cross-site navigation (a malicious auto-submitting form POST)
// can still ride. We add a defense-in-depth Origin / Sec-Fetch-Site check on
// every unsafe-method route that flows through `withBookApiErrors` (auto-wired;
// opt out per route with `opts.skipOriginCheck`). GET/HEAD/OPTIONS are never
// checked.
//
// CSRF is a COOKIE-auth concern ONLY. A request authenticated by an
// `Authorization: Bearer` token with NO id_token cookie is immune to CSRF by
// construction (a cross-site attacker can auto-send the victim's ambient cookie
// but cannot set an Authorization header cross-origin), and — being a native,
// non-browser client — sends no Origin/Sec-Fetch-Site, which would otherwise
// trip this guard. Such header-authenticated requests are therefore skipped
// (see `isHeaderAuthenticatedRequest`); cookie-authed mutations keep the guard
// exactly as before.
//
// ENFORCEMENT FLAG: set env `CSRF_ORIGIN_ENFORCE=0` (or "false"/"off"/"no") to
// run in OBSERVE-ONLY mode — a would-be rejection is logged (structured
// `csrf_origin_observe_only`, with the offending origin + path) but the request
// proceeds. Any other value
// (or unset) = ENFORCING (the safe default). Use observe-only as a brief
// confirmation window after first deploy to confirm no legitimate host/alias
// trips a 403, then remove the env to re-enforce. See docs/ENVIRONMENT.md.

/**
 * Server-side same-origin/CSRF guard. Resolves the canonical app origin
 * (`getAppBaseUrl`) and runs the pure {@link evaluateSameOrigin} decision over
 * the request's method + `Origin`/`Sec-Fetch-Site` headers. Throws
 * `BookApiError(403, "forbidden_origin")` on rejection. In observe-only mode
 * (`CSRF_ORIGIN_ENFORCE` off) it logs and returns instead of throwing. No-op on
 * safe methods.
 */
export async function requireSameOrigin(req: Request): Promise<void> {
  const method = req.method.toUpperCase();
  if (!UNSAFE_METHODS.has(method)) return; // safe methods are never checked

  // Skip the guard for header (Bearer)-authenticated requests that carry no
  // id_token cookie — they cannot be CSRF (no ambient cookie credential to
  // forge) and, as native clients, legitimately send no Origin. A request that
  // DOES carry an id_token cookie is treated as cookie-authed and keeps the
  // guard, even if a Bearer header is also present. See the header comment above.
  if (
    isHeaderAuthenticatedRequest({
      authorizationHeader: req.headers.get("authorization"),
      cookieHeader: req.headers.get("cookie"),
    })
  ) {
    return;
  }

  const originHeader = req.headers.get("origin");
  const secFetchSite = req.headers.get("sec-fetch-site");

  // The canonical app origin is only consulted on the Sec-Fetch-absent fallback
  // (the Origin compare). When Sec-Fetch-Site is present it is authoritative, so
  // skip the env lookup (and its prod-throw) entirely on the common path.
  const needsAppOrigin = !secFetchSite && originHeader !== null;
  const appOrigin = needsAppOrigin ? originOf(await getAppBaseUrl(req.url)) : null;

  const decision = evaluateSameOrigin({ method, secFetchSite, originHeader, appOrigin });
  if (!decision.rejected) return;

  const path = (() => {
    try {
      return new URL(req.url).pathname;
    } catch {
      return req.url;
    }
  })();

  if (!isCsrfEnforcementOn()) {
    logger.warn("csrf_origin_observe_only", { method, path, reason: decision.reason });
    return;
  }

  logger.warn("csrf_origin_rejected", { method, path, reason: decision.reason });
  throw new BookApiError(
    403,
    "forbidden_origin",
    "This request was blocked because it did not originate from the app."
  );
}

export function bookOk<T>(data: T, init?: number | ResponseInit): NextResponse<T> {
  const resInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

export function bookErr(
  req: Request,
  status: number,
  code: string,
  message: string,
  details?: unknown,
  requestId?: string
): NextResponse<ErrorEnvelope> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId: requestId ?? requestIdFromHeaders(req),
        details,
      },
    },
    { status }
  );
}

/**
 * Fire-and-forget hook to surface unexpected server errors to an external
 * monitor. We reuse the established `ChapterFlow/Ops` CloudWatch metric path
 * (`putOpsMetric`) so the existing OpsFailure alarm fires on unhandled API
 * errors instead of relying on raw CloudWatch log scraping. Imported lazily so
 * the AWS-SDK / `server-only` cost is only paid on the (rare) error path and
 * never blocks the response. Swallows its own failures.
 */
function reportUnhandledError(name: string): void {
  void import("./cloudwatch-metrics")
    .then(({ putOpsMetric }) =>
      putOpsMetric("OpsFailure", 1, { context: "book_api_unhandled_error", error: name })
    )
    .catch(() => {
      /* monitoring must never break the request */
    });
}

/** Options for {@link withBookApiErrors}. */
export type WithBookApiErrorsOptions = {
  /**
   * Skip the automatic same-origin/CSRF guard (#6). Set ONLY on routes that
   * legitimately receive cross-origin or origin-less unsafe-method requests:
   * the Stripe webhook (signature-verified, no browser Origin) and any signed
   * one-click link. Every cookie-authed browser mutation must leave this false.
   */
  skipOriginCheck?: boolean;
};

export async function withBookApiErrors<T>(
  req: Request,
  fn: () => Promise<NextResponse<T | ErrorEnvelope>>,
  opts?: WithBookApiErrorsOptions
): Promise<NextResponse<T | ErrorEnvelope>> {
  // Compute the correlation id once so the logged line and the client envelope
  // carry the SAME requestId — needed to tie a user's 500 to its log entry.
  const requestId = requestIdFromHeaders(req);
  // Bind requestId to the ALS request context for the whole handler so any log
  // emitted by the route body — or by requireSameOrigin, which runs inside this
  // scope — resolves the correlation id automatically (WS6-031).
  return runWithRequestContext(requestId, async () => {
    try {
      // CSRF / same-origin guard runs BEFORE the route body so a rejected
      // cross-site mutation never touches auth, DynamoDB, or Stripe. No-op on
      // safe methods and when explicitly opted out.
      if (!opts?.skipOriginCheck) {
        await requireSameOrigin(req);
      }
      return await fn();
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        // A transient JWKS-verifier outage is reported as AuthError
        // "VERIFIER_UNAVAILABLE" — surface it as 503 (not a definitive 401) so
        // clients retry instead of treating a still-valid session as unauthenticated.
        if (error.message === "VERIFIER_UNAVAILABLE") {
          return bookErr(
            req,
            503,
            "verifier_unavailable",
            "Authentication is temporarily unavailable. Please retry.",
            undefined,
            requestId
          );
        }
        // Step-up auth (#5): the token is valid but the authentication is too old
        // for this sensitive action. A DISTINCT 401 code (`reauth_required`) the
        // client detects to force a fresh login then retry — NOT a plain
        // "unauthenticated" (which would log the user out). The `details.reauth`
        // hint tells the client to redirect through a forced re-auth.
        if (error.message === "REAUTH_REQUIRED") {
          return bookErr(
            req,
            401,
            "reauth_required",
            "Please re-authenticate to continue. This action requires a recent sign-in.",
            { reauth: true },
            requestId
          );
        }
        // INVALID_TOKEN: a credential WAS presented but is genuinely bad (bad
        // signature, expired, wrong `token_use`, or no matching JWKS key). Per RFC
        // 6750 §3.1 this is a distinct 401 `invalid_token` — separate from
        // `unauthenticated` (no credential at all) — so a Bearer client can tell
        // "your token is bad, obtain a fresh one" from "you sent nothing". Still a
        // 401 either way; only the machine code differs (the web client keys its
        // redirect off status + `reauth_required`, not this code).
        if (error.message === "INVALID_TOKEN") {
          return bookErr(
            req,
            401,
            "invalid_token",
            "Your session is no longer valid. Please sign in again.",
            undefined,
            requestId
          );
        }
        return bookErr(req, 401, "unauthenticated", "Authentication is required.", undefined, requestId);
      }
      if (isBookApiError(error)) {
        return bookErr(req, error.status, error.code, error.message, error.details, requestId);
      }

      const name = error instanceof Error ? error.name : "UnknownError";
      const message = error instanceof Error ? error.message : String(error);
      // Cap the message so a runaway error string can't bloat the log line, and
      // never log the full stack in production: stacks can incidentally surface
      // identifiers, and CloudWatch is for correlation, not forensic dumps. In
      // non-production we keep the stack to aid local/staging debugging.
      const shortMessage = message.length > 300 ? `${message.slice(0, 300)}…` : message;
      if (process.env.NODE_ENV === "production") {
        logger.error("book_api_unhandled_error", { name, message: shortMessage, requestId });
        reportUnhandledError(name);
      } else {
        logger.error("book_api_unhandled_error", {
          name,
          message: shortMessage,
          requestId,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      return bookErr(req, 500, "server_error", "An unexpected server error occurred.", undefined, requestId);
    }
  });
}

export function requireBodyObject(reqBody: unknown): Record<string, unknown> {
  if (!reqBody || typeof reqBody !== "object" || Array.isArray(reqBody)) {
    throw new BookApiError(400, "invalid_json", "Request body must be a JSON object.");
  }
  return reqBody as Record<string, unknown>;
}

export function requireString(
  value: unknown,
  field: string,
  opts?: { minLength?: number; maxLength?: number }
): string {
  if (typeof value !== "string") {
    throw new BookApiError(400, "invalid_input", `${field} must be a string.`);
  }
  const trimmed = value.trim();
  const minLength = opts?.minLength ?? 1;
  const maxLength = opts?.maxLength ?? 5000;
  if (trimmed.length < minLength) {
    throw new BookApiError(400, "invalid_input", `${field} is required.`);
  }
  if (trimmed.length > maxLength) {
    throw new BookApiError(400, "invalid_input", `${field} is too long.`);
  }
  return trimmed;
}

export function requireInteger(
  value: unknown,
  field: string,
  opts?: { min?: number; max?: number }
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BookApiError(400, "invalid_input", `${field} must be a number.`);
  }
  const intVal = Math.floor(value);
  if (value !== intVal) {
    throw new BookApiError(400, "invalid_input", `${field} must be an integer.`);
  }
  const min = opts?.min ?? Number.MIN_SAFE_INTEGER;
  const max = opts?.max ?? Number.MAX_SAFE_INTEGER;
  if (intVal < min || intVal > max) {
    throw new BookApiError(
      400,
      "invalid_input",
      `${field} must be between ${min} and ${max}.`
    );
  }
  return intVal;
}

// ─── Per-user daily rate limit (#8) ──────────────────────────────────────────
//
// A durable, atomic conditional-increment limiter, mirroring the inline pattern
// already used by the AI ask + scenario-submit routes (a per-user-per-day
// counter item guarded by `attribute_not_exists(#count) OR #count < :limit`, so
// only the writer that brings the count to the cap fails and concurrent calls
// serialize). The counter item carries a short `ttl` so stale day-buckets age
// out. Used for the GDPR export endpoint (a GET, so it does not flow through the
// auto-wired CSRF guard and must call this directly). The pure date-key/decision
// helpers (`dailyLimitDateKey`, `isWithinDailyLimit`) live in http-guards-core.ts.

/**
 * Atomically reserve one unit of a per-user daily allowance. Throws
 * `BookApiError(429, "rate_limited")` when the cap is already reached.
 *
 * `counterSk` is the SK of the per-day counter item (caller builds a stable,
 * date-bucketed key, e.g. `EXPORT_LIMIT#<YYYY-MM-DD>`). AWS deps are imported
 * lazily so this module stays free of a top-level `server-only` import and its
 * pure helpers above remain unit-testable.
 */
export async function enforceDailyUserLimit(params: {
  tableName: string;
  userPk: string;
  counterSk: string;
  limit: number;
  entity: string;
  /** Days the counter item lives before TTL cleanup (default 3). */
  ttlDays?: number;
  /** Human-readable resource name for the 429 message (default "requests"). */
  resource?: string;
}): Promise<void> {
  const { ddbDoc } = await import("@/app/app/api/_lib/aws");
  const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
  const { ConditionalCheckFailedException } = await import("@aws-sdk/client-dynamodb");

  const ttl = Math.floor(Date.now() / 1000) + (params.ttlDays ?? 3) * 86400;
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: params.tableName,
        Key: { PK: params.userPk, SK: params.counterSk },
        UpdateExpression:
          "SET #count = if_not_exists(#count, :zero) + :one, updatedAt = :now, entity = :entity, #ttl = :ttl",
        ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
        ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":now": new Date().toISOString(),
          ":entity": params.entity,
          ":ttl": ttl,
          ":limit": params.limit,
        },
      })
    );
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) {
      throw new BookApiError(
        429,
        "rate_limited",
        `Daily limit reached for ${params.resource ?? "requests"} (${params.limit}/day). Try again tomorrow.`
      );
    }
    throw e;
  }
}
