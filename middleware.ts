import { NextResponse, type NextRequest } from "next/server";
import { isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";
import {
  isOrphanBookSlug,
  resolveCanonicalBookSlug,
} from "@/lib/book-slug-aliases";
import { evaluateOriginVerify } from "@/lib/origin-verify-core";
import { resolveMiddlewareOrigin } from "@/lib/middleware-origin-core";
import { buildContentSecurityPolicy } from "@/lib/csp";

let missingConfigWarned = false;
let originVerifyWarned = false;

// WS8-001: forward a per-request nonce + enforcing CSP on the pass-through
// response. Setting Content-Security-Policy on the FORWARDED REQUEST headers is
// what makes Next read the nonce and stamp it on its own bootstrap <script>
// tags (required under strict-dynamic, which ignores 'self'); setting it on the
// RESPONSE is what the browser actually enforces. x-nonce is read back by the
// server components (RootLayout / Home / BooksPage) to nonce their inline
// <script> tags. Every terminal NextResponse.next() goes through here so the
// header set is identical on every rendered path.
function nextWithCsp(
  req: NextRequest,
  nonce: string,
  csp: string,
): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

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

function resolveRequestOrigin(req: NextRequest): string | null {
  // Prefer an explicitly-configured, trusted base URL over any request header.
  // `x-forwarded-host` is attacker-controllable on a directly-reachable origin
  // (no CloudFront custom-origin-header pin, or a Function URL with authType
  // NONE), so a deploy-provided value must always win over it — otherwise the
  // /auth/login redirect base can be poisoned to an attacker host (open
  // redirect / credential phishing). The pure resolver enforces the same
  // canonical ChapterFlow host boundary as server-origin resolution while
  // remaining safe to bundle in middleware's runtime.
  return resolveMiddlewareOrigin(
    {
      forwardedHostHeader: req.headers.get("x-forwarded-host"),
      hostHeader: req.headers.get("host"),
      forwardedProtoHeader: req.headers.get("x-forwarded-proto"),
      fallbackOrigin: req.nextUrl.origin,
    },
    {
      appBaseUrl: process.env.APP_BASE_URL,
      chapterFlowAppBaseUrl: process.env.CHAPTERFLOW_APP_BASE_URL,
      allowAppBaseUrlInDev: process.env.ALLOW_APP_BASE_URL_IN_DEV,
      nodeEnv: process.env.NODE_ENV,
    },
  );
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

  // WS8-001: mint a per-request nonce (Edge-safe Web Crypto — no Buffer /
  // node:crypto, so middleware stays on the Edge runtime) and build the
  // enforcing document CSP. Every terminal NextResponse.next() below forwards
  // both via nextWithCsp(); redirects (orphan 308, auth bounce) carry no inline
  // scripts and are left byte-identical.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildContentSecurityPolicy(nonce);

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
    return nextWithCsp(req, nonce, csp);
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
    return nextWithCsp(req, nonce, csp);
  }

  // Dev bypass — allow all in development when enabled or Cognito not configured
  if (isDevAuthBypassEnabled()) {
    return nextWithCsp(req, nonce, csp);
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
    return nextWithCsp(req, nonce, csp);
  }

  // Lightweight cookie-presence + expiry check. Full JWT verification
  // happens in requireUser() at the route/API level.
  const token = req.cookies.get("id_token")?.value;
  const expiresAt = Number(req.cookies.get("auth_expires_at")?.value);
  const isExpired =
    Number.isFinite(expiresAt) && expiresAt <= Math.floor(Date.now() / 1000);

  if (!token || isExpired) {
    const publicOrigin = resolveRequestOrigin(req);
    if (!publicOrigin) {
      return new NextResponse(
        JSON.stringify({ error: "invalid_request_origin" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }
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

  return nextWithCsp(req, nonce, csp);
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
