// Pure, `server-only`-free credential-source helpers shared by the auth reader
// (`requireUser`, which pulls `server-only` + `next/headers` + `jose`) and the
// same-origin/CSRF guard (`requireSameOrigin`). Kept in a `-core` module so the
// selection logic is directly unit-testable under `tsx --test` without dragging
// those server-only deps into the runner.
//
// Two credential transports carry the SAME Cognito **id_token**:
//   - the `id_token` COOKIE — the default for the first-party web app; and
//   - an `Authorization: Bearer <id_token>` HEADER — for native clients (iOS)
//     that cannot send cookies.
// Whichever transport is used, the token is verified IDENTICALLY downstream
// (same JWKS, issuer, audience, `token_use === "id"`). These helpers only decide
// WHICH token to verify and whether a request is header- (vs cookie-)
// authenticated; they never parse or trust claims.

/**
 * Name of the id_token cookie. Single source of truth shared by the cookie
 * reader in `requireUser` and the cookie-presence probe used by the CSRF guard.
 */
export const AUTH_COOKIE_NAME = "id_token";

/**
 * Extract the token from an `Authorization: Bearer <token>` header value, or
 * `null` when the header is absent, uses a different scheme (e.g. `Basic`), or
 * carries no token. The scheme match is case-insensitive (RFC 7235 auth-schemes
 * are case-insensitive) and surrounding whitespace is trimmed. We deliberately
 * accept ONLY the `Bearer` scheme so an `Authorization: Basic ...`/other header
 * never resolves a token.
 */
export function parseBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  // scheme + at least one space/tab + a non-empty token remainder.
  const match = /^Bearer[ \t]+(\S.*)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Does the raw `Cookie` request-header carry a NON-EMPTY `id_token` cookie? Used
 * by the CSRF guard to distinguish a cookie-authenticated request (guard
 * applies) from a header-only one (guard skipped). A single-name presence check
 * over the `name=value; name2=value2` header — no cookie library needed. Only
 * the first `=` splits name from value, so a value containing `=` is preserved
 * (JWTs are base64url with no `=`, but this stays correct regardless).
 */
export function cookieHeaderHasAuthToken(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === AUTH_COOKIE_NAME) {
      const value = part.slice(eq + 1).trim();
      if (value.length > 0) return true;
    }
  }
  return false;
}

/**
 * Select the credential token to verify. The `id_token` COOKIE is the web
 * default; the `Authorization: Bearer` header is the native fallback. The cookie
 * WINS when both are present so a live browser session is authoritative and can
 * never be silently overridden by an injected header. An empty/missing cookie
 * value falls through to the header. Returns `null` when neither is present.
 */
export function resolveCredentialToken(params: {
  cookieToken: string | null | undefined;
  bearerToken: string | null | undefined;
}): string | null {
  return params.cookieToken || params.bearerToken || null;
}

/**
 * Is this request authenticated via the `Authorization: Bearer` header rather
 * than the cookie? True iff a Bearer token is present AND no `id_token` cookie is
 * attached. This is the exact condition under which the same-origin/CSRF guard is
 * safely skipped: CSRF rides an AMBIENT cookie credential the browser attaches
 * automatically, but a cross-site attacker cannot set an `Authorization` header
 * on a cross-origin request (that needs scripted fetch/XHR, which the same-origin
 * policy + our un-broadened CORS block). With no cookie there is no ambient
 * credential to forge, so such a request is immune to CSRF by construction.
 *
 * The `!cookieHeaderHasAuthToken` clause is deliberate and defense-in-depth: if a
 * cookie IS present the request is treated as cookie-authenticated (the cookie
 * wins in {@link resolveCredentialToken}) and MUST keep the guard — a
 * cookie-authed mutation is exactly what CSRF targets.
 */
export function isHeaderAuthenticatedRequest(params: {
  authorizationHeader: string | null | undefined;
  cookieHeader: string | null | undefined;
}): boolean {
  return (
    parseBearerToken(params.authorizationHeader) !== null &&
    !cookieHeaderHasAuthToken(params.cookieHeader)
  );
}
