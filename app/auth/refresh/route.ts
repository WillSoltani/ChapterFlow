import { NextRequest, NextResponse } from "next/server";
import { mustServerEnv } from "@/app/app/api/_lib/server-env";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getAccountStatus } from "@/app/app/api/book/_lib/repo";
import { BOOK_DEVICE_COOKIE } from "@/app/app/api/book/_lib/abuse";
import { resolveCognitoDomain } from "../_lib/cognito-domain";
import { getAuthCookieBase } from "../_lib/auth-cookie";

export const runtime = "nodejs";

// Mirrors the refresh-token validity persisted by the callback. This 30-day
// lifetime is disclosed in app/legal/cookies/page.tsx — keep that policy in sync.
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

// Lightweight per-instance throttle so a looping/misbehaving first-party client
// can't hammer Cognito's token endpoint (cookies are SameSite=lax, so a true
// cross-site amplification isn't possible, but a same-origin loop is). The cap
// is intentionally generous: TokenExpiryGuard self-throttles with a 30s retry
// cooldown, so legitimate renewals stay far under this. This is best-effort
// in-memory state (per server instance, cleared on restart) — Cognito's own
// throttling remains the hard backstop.
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

// Trusted proxy hops (CloudFront, plus any edge layer) in front of this app.
// The real client IP is the X-Forwarded-For entry this many positions from the
// RIGHT — the one our own edge appended. The leftmost entries are supplied by
// the client and MUST NOT be trusted for throttling: an attacker could rotate a
// fake leftmost token to mint a fresh limiter bucket per request. Override via
// env if the deployment adds/removes a hop (too low → clients collapse into one
// bucket and over-throttle; too high → re-introduces the spoofable left side).
const TRUSTED_PROXY_HOPS = Number(process.env.RATE_LIMIT_TRUSTED_PROXY_HOPS) || 1;

function readClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (chain.length > 0) {
      // Trust the Nth entry from the right (appended by our edge), never the
      // leftmost client-controlled token.
      const idx = Math.max(0, chain.length - TRUSTED_PROXY_HOPS);
      return chain[idx] ?? chain[chain.length - 1];
    }
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cloudfrontViewer = req.headers.get("cloudfront-viewer-address")?.trim();
  if (cloudfrontViewer) {
    const host = cloudfrontViewer.split(":")[0]?.trim();
    if (host) return host;
  }
  return null;
}

/**
 * Returns true when this caller has exceeded the per-window attempt cap. Keyed by
 * the EXISTING cf_device cookie, falling back to client IP (then a shared bucket)
 * so a single runaway client is contained without blocking unrelated callers
 * behind the same NAT. Also opportunistically prunes expired buckets to bound
 * memory.
 */
function isRateLimited(req: NextRequest): boolean {
  // Read the raw cf_device cookie rather than getOrCreateDeviceId(): the latter
  // MINTS a fresh random id when the cookie is missing/malformed, so keying on it
  // would hand a cookieless caller a new bucket every request (never throttled)
  // and make the IP fallback dead code. Reading the cookie directly makes a
  // stripped-cookie flood collapse onto its shared IP bucket.
  const rawDevice = req.cookies.get(BOOK_DEVICE_COOKIE)?.value?.trim() || null;
  const key = rawDevice || readClientIp(req) || "unknown";
  const now = Date.now();

  const existing = rateLimitBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (rateLimitBuckets.size > 5_000) {
      for (const [bucketKey, bucket] of rateLimitBuckets) {
        if (bucket.resetAt <= now) rateLimitBuckets.delete(bucketKey);
      }
    }
    return false;
  }

  existing.count += 1;
  return existing.count > RATE_LIMIT_MAX_ATTEMPTS;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function unauthorized(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

/**
 * Read the `sub` from a freshly-issued id token. The token came straight from
 * Cognito's token endpoint over TLS in this request, so reading a claim without
 * re-verifying the signature is safe here (we are not trusting client input).
 */
function subFromIdToken(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as Record<string, unknown>;
    return typeof json.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

/**
 * Silent session renewal. TokenExpiryGuard calls this shortly before the access
 * token expires; it exchanges the httpOnly refresh_token cookie for fresh
 * access/id tokens via Cognito's refresh_token grant and rewrites the session
 * cookies. Returns { ok, expiresAt } on success so the client can reschedule
 * its next renewal. A 401 means the refresh token is gone/expired/revoked and
 * the client should fall back to a full login.
 */
export async function POST(req: NextRequest) {
  if (isRateLimited(req)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  const refreshToken = req.cookies.get("refresh_token")?.value;
  if (!refreshToken) {
    return unauthorized("no_refresh_token");
  }

  let domain: string;
  let clientId: string;
  try {
    domain = await resolveCognitoDomain();
    clientId = await mustServerEnv("COGNITO_CLIENT_ID");
  } catch {
    return NextResponse.json({ ok: false, error: "config_error" }, { status: 500 });
  }

  let tokenRes: Response;
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    });
    tokenRes = await fetch(`${domain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "upstream_error" }, { status: 502 });
  }

  if (!tokenRes.ok) {
    // The refresh token is invalid/expired/revoked — clear it so the client
    // stops retrying and re-authenticates cleanly.
    const res = unauthorized("refresh_rejected");
    const cookieBase = getAuthCookieBase();
    res.cookies.set("refresh_token", "", { ...cookieBase, maxAge: 0 });
    return res;
  }

  // Cognito (or an intervening proxy/WAF during a partial outage) can return
  // HTTP 200 with a non-JSON body (e.g. an HTML maintenance page); .json() then
  // rejects. Catch it and return a clean 502 instead of letting the route 500.
  let tokens: Record<string, unknown>;
  try {
    tokens = (await tokenRes.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_upstream_body" }, { status: 502 });
  }
  const idToken = readString(tokens.id_token);
  const accessToken = readString(tokens.access_token);
  // Rotation is off by default, so a new refresh_token is usually absent;
  // keep the existing cookie when Cognito doesn't return one.
  const rotatedRefresh = readString(tokens.refresh_token);

  if (!idToken || !accessToken) {
    return unauthorized("incomplete_tokens");
  }

  // Refuse to re-mint a session for a deleted account. Soft-delete is a
  // DynamoDB status (the Cognito principal stays enabled), so the refresh grant
  // itself keeps succeeding — this is the only place that can stop a revoked
  // account from silently resurrecting its session cookies. Fail open on a
  // status-store error: page-level requireActiveBookUser still gates all data.
  const sub = subFromIdToken(idToken);
  if (sub) {
    try {
      const tableName = await getBookTableName();
      const status = await getAccountStatus(tableName, sub);
      if (status?.status === "deleted") {
        const res = unauthorized("account_deleted");
        const cookieBase = getAuthCookieBase();
        res.cookies.set("refresh_token", "", { ...cookieBase, maxAge: 0 });
        res.cookies.set("id_token", "", { ...cookieBase, maxAge: 0 });
        res.cookies.set("access_token", "", { ...cookieBase, maxAge: 0 });
        res.cookies.set("auth_expires_at", "", { ...cookieBase, httpOnly: false, maxAge: 0 });
        return res;
      }
    } catch {
      // ignore — do not lock out on a transient status-store failure
    }
  }

  const expiresIn = Number(tokens.expires_in) || 3600;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  const res = NextResponse.json({ ok: true, expiresAt });
  const cookieBase = getAuthCookieBase();
  const commonCookie = { ...cookieBase, maxAge: expiresIn };

  res.cookies.set("id_token", idToken, commonCookie);
  res.cookies.set("access_token", accessToken, commonCookie);
  if (rotatedRefresh) {
    res.cookies.set("refresh_token", rotatedRefresh, {
      ...cookieBase,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }
  res.cookies.set("auth_expires_at", String(expiresAt), {
    ...cookieBase,
    httpOnly: false,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  return res;
}
