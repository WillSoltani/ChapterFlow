import { NextResponse, type NextRequest } from "next/server";
import { isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";
import {
  isOrphanBookSlug,
  resolveCanonicalBookSlug,
} from "@/lib/book-slug-aliases";
import { evaluateOriginVerify } from "@/lib/origin-verify-core";

let missingConfigWarned = false;
let originVerifyWarned = false;

// PROD-DUP: redirect a retired book slug to its canonical slug (308). This lives
// in middleware rather than next.config redirects() on purpose: Next compiles
// redirect `source` strings case-INSENSITIVELY (experimental.caseSensitiveRoutes
// defaults off), so a source for the case-only rename `Getting-Things-Done` would
// also match the LIVE lowercase canonical `getting-things-done` and 308 it onto
// itself — an infinite redirect loop that bricks a shipping book. Matching here
// is EXACT-CASE, and we decode the slug first so a percent-encoded inbound path
// (e.g. `%27` for the apostrophe in `you-can't-hurt-me`) still resolves. Only the
// first path segment after /book/library/ is treated as the slug; the chapter
// subtree and query string are preserved.
function orphanSlugRedirect(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const prefix = "/book/library/";
  if (!pathname.startsWith(prefix)) return null;
  const afterPrefix = pathname.slice(prefix.length);
  const slashIndex = afterPrefix.indexOf("/");
  const rawSlug = slashIndex === -1 ? afterPrefix : afterPrefix.slice(0, slashIndex);
  const rest = slashIndex === -1 ? "" : afterPrefix.slice(slashIndex);
  if (rawSlug.length === 0) return null;

  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    // Malformed %-sequence: fall back to the raw segment.
  }
  if (!isOrphanBookSlug(slug)) return null;

  const url = req.nextUrl.clone();
  url.pathname = `${prefix}${resolveCanonicalBookSlug(slug)}${rest}`;
  return NextResponse.redirect(url, 308);
}

function firstForwardedValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function isLocalOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return isLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}

function resolveRequestOrigin(req: NextRequest): string {
  // Prefer an explicitly-configured, trusted base URL over any request header.
  // `x-forwarded-host` is attacker-controllable on a directly-reachable origin
  // (no CloudFront custom-origin-header pin, or a Function URL with authType
  // NONE), so a deploy-provided value must always win over it — otherwise the
  // /auth/login redirect base can be poisoned to an attacker host (open
  // redirect / credential phishing). Mirrors resolvePublicOrigin() in
  // app/app/_lib/server-origin.ts: honour both APP_BASE_URL and
  // CHAPTERFLOW_APP_BASE_URL (the latter is the variable the deploy pipeline
  // injects into the server Lambda).
  const configuredBaseUrl =
    process.env.APP_BASE_URL?.trim() ||
    process.env.CHAPTERFLOW_APP_BASE_URL?.trim();
  if (configuredBaseUrl) {
    const normalizedConfigured = normalizeOrigin(configuredBaseUrl);
    const allowConfiguredInDev = process.env.ALLOW_APP_BASE_URL_IN_DEV === "1";
    const isProd = process.env.NODE_ENV === "production";

    if (isProd) {
      if (!isLocalOrigin(normalizedConfigured)) return normalizedConfigured;
      console.warn(
        "Ignoring APP_BASE_URL loopback value in production:",
        normalizedConfigured,
      );
    } else if (allowConfiguredInDev || isLocalOrigin(normalizedConfigured)) {
      return normalizedConfigured;
    }
  }

  const forwardedHost = firstForwardedValue(
    req.headers.get("x-forwarded-host"),
  );
  const host = forwardedHost || req.headers.get("host");
  const proto =
    firstForwardedValue(req.headers.get("x-forwarded-proto")) ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) {
    return normalizeOrigin(`${proto}://${host}`);
  }

  return req.nextUrl.origin;
}

export function middleware(req: NextRequest) {
  // WS6-002 origin-verify gate — MUST be the first thing evaluated. The server
  // Function URL is authType NONE (public); CloudFront injects a shared-secret
  // x-origin-verify header (infra/lib/chapterflow-frontend-stack.ts). A request
  // arriving without the matching header hit the raw Function URL directly,
  // bypassing the CloudFront edge (and its WAF), so it must be rejected before it
  // can reach a protected surface, a redirect, or NextResponse.next(). No-op when
  // ORIGIN_VERIFY_SECRET is unset — byte-identical to prior behavior on envs that
  // have not introduced the secret. Log mode warns once per instance then falls
  // through (two-phase rollout observation window before enforce).
  const originVerifySecret = process.env.ORIGIN_VERIFY_SECRET;
  if (originVerifySecret) {
    const verdict = evaluateOriginVerify(
      originVerifySecret,
      req.headers.get("x-origin-verify"),
      process.env.ORIGIN_VERIFY_MODE,
    );
    if (verdict === "deny") {
      return new NextResponse(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    if (verdict === "warn" && !originVerifyWarned) {
      originVerifyWarned = true;
      console.warn(
        "origin_verify_mismatch: x-origin-verify absent or wrong (log mode); request allowed to continue",
      );
    }
  }

  const { pathname } = req.nextUrl;

  // API routes never get cookie-based auth middleware. Routes under /app/api
  // either enforce their own auth at the route level (requireUser /
  // requireActiveBookUser / requireAdminUser), verify a signature (the Stripe
  // billing webhook) or token (email unsubscribe), or are intentionally public
  // reads (the published-catalog storefront endpoints) — none depend on this
  // cookie check for protection. Several are also called by un-cookied
  // server-to-server clients: the Stripe webhook and one-click email
  // unsubscribe (CASL/CAN-SPAM) carry no id_token cookie. Redirecting those to
  // /auth/login (a 302) makes Stripe treat every delivery as failed — it
  // retries, then disables the endpoint, silently breaking all subscription
  // processing (checkout grants, cancellations, disputes, refunds).
  if (pathname.startsWith("/app/api/")) {
    return NextResponse.next();
  }

  // PROD-DUP: send retired book slugs to their canonical slug before the auth
  // check, so crawlers/bookmarks for an old slug land on the real book without a
  // login bounce (and keep working once the orphan record is archived).
  const orphanRedirect = orphanSlugRedirect(req);
  if (orphanRedirect) return orphanRedirect;

  const protectedSurface =
    pathname.startsWith("/app") ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/dashboard");

  if (!protectedSurface) {
    return NextResponse.next();
  }

  // Dev bypass — allow all in development when enabled or Cognito not configured
  if (isDevAuthBypassEnabled()) {
    return NextResponse.next();
  }

  if (
    process.env.NODE_ENV !== "production" &&
    (!process.env.COGNITO_REGION || !process.env.COGNITO_USER_POOL_ID)
  ) {
    if (!missingConfigWarned) {
      missingConfigWarned = true;
      console.warn(
        "middleware_auth_skip: COGNITO env vars not set in dev; skipping auth check",
      );
    }
    return NextResponse.next();
  }

  // Lightweight cookie-presence + expiry check. Full JWT verification
  // happens in requireUser() at the route/API level.
  const token = req.cookies.get("id_token")?.value;
  const expiresAt = Number(req.cookies.get("auth_expires_at")?.value);
  const isExpired =
    Number.isFinite(expiresAt) && expiresAt <= Math.floor(Date.now() / 1000);

  if (!token || isExpired) {
    const publicOrigin = resolveRequestOrigin(req);
    const loginUrl = new URL("/auth/login", publicOrigin);
    // Emit a RELATIVE returnTo (path + query only). sanitizeReturnTo accepts
    // same-origin relative paths unconditionally (isSafeInternalPath), so the
    // original destination survives regardless of which host/alias served the
    // request. An absolute returnTo would be matched against allowedOrigins(),
    // which is built solely from env vars — on any host those don't cover (a
    // new CloudFront alias, a preview/staging domain, a forwarded-host
    // mismatch) the deep link is silently dropped and the user lands on /book.
    loginUrl.searchParams.set(
      "returnTo",
      `${req.nextUrl.pathname}${req.nextUrl.search}`,
    );
    const res = NextResponse.redirect(loginUrl);

    // Clear any stale token fragments
    res.cookies.set("id_token", "", { path: "/", maxAge: 0 });
    res.cookies.set("access_token", "", { path: "/", maxAge: 0 });

    return res;
  }

  return NextResponse.next();
}

export const config = {
  // WS6-002 widened the matcher from the three protected prefixes to a single
  // negative-lookahead catch-all: the origin-verify check above must see EVERY
  // path a direct Function-URL hit can request, and the old prefix list left
  // most paths unmatched (never entering middleware at all). The exclusions are
  // exactly the CloudFront non-server behaviors + Next statics, which are served
  // from S3/the image origin and never reach this server Lambda. The auth logic
  // is unchanged: previously-unmatched paths now enter middleware but fall
  // straight through the existing prefix guards (the /app/api early-return and
  // the `!protectedSurface` guard) to NextResponse.next() exactly as if they had
  // never matched — the widening only adds the origin-verify gate to them.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|robots\\.txt|sitemap\\.xml|fonts/|book-covers/|BUILD_ID).*)",
  ],
};
