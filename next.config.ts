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

// The document-level Content-Security-Policy is owned SOLELY by middleware.ts
// (WS8-001): it mints a per-request nonce and stamps the enforcing policy
// (script-src 'self' 'nonce-…' 'strict-dynamic') on both the forwarded request
// headers and the response. The directive source of truth lives in lib/csp.ts.
// Emitting a second, static CSP here (as before) would intersect with the
// nonce'd one and could silently drop the nonce, so the two document CSP header
// entries were removed. The request-independent security headers below
// (X-Frame-Options / nosniff / Referrer-Policy / HSTS / Permissions-Policy) and
// the images.contentSecurityPolicy (a separate optimizer-only sandbox policy)
// remain here.

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
          // Content-Security-Policy is owned by middleware.ts (WS8-001) — it is
          // per-request (nonce-bearing) and must NOT be duplicated here.
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
