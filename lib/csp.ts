// Content-Security-Policy source of truth for the app document (WS8-001).
//
// Middleware (middleware.ts) is the SOLE owner of the document CSP: it mints a
// per-request nonce and stamps the enforcing policy on both the forwarded
// request headers (so Next reads the nonce and propagates it to its own
// bootstrap <script> tags) and the response. next.config.ts no longer emits a
// document-level Content-Security-Policy header; keeping the directive logic
// here gives one place to reason about the policy.
//
// This module MUST stay Edge-safe: pure string building over process.env, no
// node:crypto / Buffer / fs, so it bundles cleanly into the Edge middleware.
//
// Sources were derived from an actual sweep of the app (2026-06-14):
//   • Inline <script>: theme bootstrap in app/layout.tsx <head> + JSON-LD via
//     dangerouslySetInnerHTML (app/page.tsx, app/books/page.tsx), plus Next's
//     own inline bootstrap. All now carry the per-request nonce, so script-src
//     drops 'unsafe-inline' and adds 'strict-dynamic'.
//   • Fonts: next/font self-hosts Google + local fonts (same-origin); the only
//     remote font is OpenDyslexic from cdn.jsdelivr.net (app/globals.css).
//   • Images: same-origin + data:/blob: + the S3 cover host(s) below.
//   • Audio: <audio> + MediaSource use blob: URLs (chapter AudioPlayer).
//   • Stripe Checkout / Cognito Hosted UI are TOP-LEVEL navigations (server
//     returns session.url / hosted-UI URL), not iframes or embedded scripts —
//     no frame-src/script-src entry is required for them, so frame-src 'none'.
//   • API + push are same-origin (connect-src 'self').

const FONT_CDN = "https://cdn.jsdelivr.net";

// CSP host-source syntax allows at most a single leading "*" wildcard label, so
// the next/image remote-pattern hosts can't be reused verbatim (the dev/CI
// fallback "*.s3.*.amazonaws.com" has two wildcards and would be an invalid,
// silently dropped token). Pin the exact cover host when the bucket is known;
// otherwise fall back to the broadest VALID single-wildcard S3 host so dev/CI
// still renders covers.
function resolveCspCoverHosts(): string[] {
  const region =
    process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  const bucket = process.env.BOOK_CONTENT_BUCKET;
  return bucket
    ? [
        `https://${bucket}.s3.${region}.amazonaws.com`,
        `https://${bucket}.s3.amazonaws.com`,
      ]
    : ["https://*.amazonaws.com"];
}

export function buildCspImgSrc(): string {
  return ["'self'", "data:", "blob:", ...resolveCspCoverHosts()].join(" ");
}

// Directives shared by every rendered document response. Everything except
// script-src is request-independent; script-src is appended per request with the
// nonce by buildContentSecurityPolicy().
export function buildCspBaseDirectives(): string[] {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    `img-src ${buildCspImgSrc()}`,
    "style-src 'self' 'unsafe-inline'",
    `font-src 'self' data: ${FONT_CDN}`,
    "media-src 'self' blob:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];
}

// Enforcing script-src: nonce + strict-dynamic. strict-dynamic makes browsers
// trust only the nonce'd inline scripts (and whatever those scripts load),
// ignoring host-based allowlists and 'unsafe-inline' — so the theme bootstrap,
// JSON-LD, and Next's own bootstrap tags MUST all carry the same per-request
// nonce (they do). DEV ONLY: Next's dev runtime (HMR / React Refresh) uses
// eval(), so 'unsafe-eval' is added when NODE_ENV !== 'production'; the
// production policy is byte-for-byte 'self' 'nonce-…' 'strict-dynamic'.
export function buildContentSecurityPolicy(nonce: string): string {
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;
  return [...buildCspBaseDirectives(), scriptSrc].join("; ");
}
