import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(process.env.NEXT_DIST_DIR
    ? { distDir: process.env.NEXT_DIST_DIR }
    : {}),
  images: {
    // Book covers are served from the content S3 bucket as
    //   https://<BOOK_CONTENT_BUCKET>.s3.<AWS_REGION>.amazonaws.com/book-content/library/covers/<file>.svg
    // (see app/app/api/book/_lib/library-catalog.ts → buildPublicS3Url).
    // Bucket + region are env-driven, so match any S3 bucket's covers path
    // rather than pinning a host that differs between build and runtime.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com", // virtual-hosted, region-qualified
        pathname: "/book-content/library/covers/**",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com", // legacy global endpoint
        pathname: "/book-content/library/covers/**",
      },
    ],
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
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/book/workspace",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/book/workspace/:path*",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/book/home",
        destination: "/dashboard",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
