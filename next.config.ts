import type { NextConfig } from "next";

// Book covers are served from the content S3 bucket as
//   https://<BOOK_CONTENT_BUCKET>.s3.<AWS_REGION>.amazonaws.com/book-content/library/covers/<file>.svg
// (see app/app/api/book/_lib/library-catalog.ts → buildPublicS3Url).
const COVER_PATHNAME = "/book-content/library/covers/**";
const S3_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const CONTENT_BUCKET = process.env.BOOK_CONTENT_BUCKET;
// Pin the exact content bucket when it's known at build time (prod/deploy);
// fall back to a covers-path-scoped wildcard only when the env var is absent
// (local dev / generic CI build) so we never proxy an arbitrary account's bucket
// in the environment that actually serves users.
const coverRemoteHosts = CONTENT_BUCKET
  ? [
      `${CONTENT_BUCKET}.s3.${S3_REGION}.amazonaws.com`,
      `${CONTENT_BUCKET}.s3.amazonaws.com`,
    ]
  : ["*.s3.*.amazonaws.com", "*.s3.amazonaws.com"];

const coverRemotePatterns = coverRemoteHosts.map((hostname) => ({
  protocol: "https" as const,
  hostname,
  pathname: COVER_PATHNAME,
}));

// Document-level Content-Security-Policy (H28). This complements the existing
// X-Frame-Options / nosniff / HSTS / Permissions-Policy headers below with a
// real script/connect/frame source restriction for a payments + PII product.
//
// Sources were derived from an actual sweep of the app (2026-06-14):
//   • Inline <script>: theme bootstrap in app/layout.tsx <head> + JSON-LD via
//     dangerouslySetInnerHTML (app/page.tsx, app/books/page.tsx), plus Next's
//     own inline bootstrap. None of these carry a nonce today and the files
//     that emit them are outside this task's editable set, so script-src/
//     style-src keep 'unsafe-inline' in the ENFORCING policy. The stricter
//     nonce migration (strict-dynamic + per-request nonce wired through the
//     layout) is tracked as a follow-up and is exercised here only via the
//     Report-Only policy.
//   • Fonts: next/font self-hosts Google + local fonts (same-origin); the only
//     remote font is OpenDyslexic from cdn.jsdelivr.net (app/globals.css).
//   • Images: same-origin + data:/blob: + the S3 cover host(s) above.
//   • Audio: <audio> + MediaSource use blob: URLs (chapter AudioPlayer).
//   • Stripe Checkout / Cognito Hosted UI are TOP-LEVEL navigations (server
//     returns session.url / hosted-UI URL), not iframes or embedded scripts —
//     no frame-src/script-src entry is required for them, so frame-src 'none'.
//   • API + push are same-origin (connect-src 'self').
const FONT_CDN = "https://cdn.jsdelivr.net";
// CSP host-source syntax allows at most a single leading "*" wildcard label, so
// the image-remote-pattern hosts can't be reused verbatim (the dev/CI fallback
// "*.s3.*.amazonaws.com" has two wildcards and would be an invalid, silently
// dropped token). Pin the exact cover host when the bucket is known; otherwise
// fall back to the broadest VALID single-wildcard S3 host so dev/CI still
// renders covers.
const cspCoverHosts = CONTENT_BUCKET
  ? [
      `https://${CONTENT_BUCKET}.s3.${S3_REGION}.amazonaws.com`,
      `https://${CONTENT_BUCKET}.s3.amazonaws.com`,
    ]
  : ["https://*.amazonaws.com"];
const cspImgSrc = ["'self'", "data:", "blob:", ...cspCoverHosts].join(" ");

// Directives shared by the enforcing and report-only policies.
const cspBaseDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  `img-src ${cspImgSrc}`,
  "style-src 'self' 'unsafe-inline'",
  `font-src 'self' data: ${FONT_CDN}`,
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
];

// Enforcing policy: keeps 'unsafe-inline' for scripts because the inline
// bootstrap/JSON-LD scripts are not nonce-tagged yet (their files are not
// editable here). It still hardens frame-ancestors/object-src/base-uri/
// form-action/connect-src/frame-src — the directives that actually contain a
// reflected/stored-XSS blast radius and clickjacking for this product.
//
// DEV ONLY: Next's dev runtime (HMR / React Refresh) uses eval(), which trips
// the enforcing CSP and logs an 'unsafe-eval' console error during local dev.
// We add 'unsafe-eval' to script-src ONLY when NODE_ENV !== 'production', so the
// production policy is byte-for-byte unchanged.
const cspScriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
const contentSecurityPolicy = [...cspBaseDirectives, cspScriptSrc].join("; ");

// Report-Only policy: the stricter target. 'strict-dynamic' + 'unsafe-inline'
// (ignored by strict-dynamic-aware browsers) lets us collect violation reports
// for the nonce migration without breaking anyone. Promote to enforcing only
// after the layout wires a per-request nonce and reports come back clean.
const contentSecurityPolicyReportOnly = [
  ...cspBaseDirectives,
  "script-src 'self' 'strict-dynamic' 'unsafe-inline' https:",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  ...(process.env.NEXT_DIST_DIR
    ? { distDir: process.env.NEXT_DIST_DIR }
    : {}),
  images: {
    remotePatterns: coverRemotePatterns,
    // Covers (and local /book-covers/*.svg) are SVG; next/image refuses SVG by
    // default. These are first-party assets, but we still harden the optimizer
    // response (force download disposition + sandbox CSP) against SVG XSS.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
          // Enforced baseline CSP (H28) — see cspBaseDirectives above.
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // Stricter target staged in Report-Only to drive the nonce migration
          // without breaking inline scripts that aren't nonce-tagged yet.
          {
            key: "Content-Security-Policy-Report-Only",
            value: contentSecurityPolicyReportOnly,
          },
        ],
      },
    ];
  },
  async redirects() {
    // L88: legacy post-UI-overhaul redirects use 307 (Temporary), NOT 308
    // (Permanent). Browsers/CloudFront cache 308 indefinitely, so if any of
    // these paths is repurposed or /dashboard moves, returning users keep the
    // stale redirect with no server recourse. Promote permanent → true only
    // once /dashboard is confirmed permanent and these legacy paths are dead
    // forever.
    return [
      {
        source: "/book/workspace",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/book/workspace/:path*",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/book/home",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
