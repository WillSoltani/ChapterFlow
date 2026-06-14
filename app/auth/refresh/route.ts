import { NextRequest, NextResponse } from "next/server";
import { mustServerEnv } from "@/app/app/api/_lib/server-env";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getAccountStatus } from "@/app/app/api/book/_lib/repo";
import { resolveCognitoDomain } from "../_lib/cognito-domain";
import { getAuthCookieBase } from "../_lib/auth-cookie";

export const runtime = "nodejs";

// Mirrors the refresh-token validity persisted by the callback. This 30-day
// lifetime is disclosed in app/legal/cookies/page.tsx — keep that policy in sync.
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

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

  const tokens = (await tokenRes.json()) as Record<string, unknown>;
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
