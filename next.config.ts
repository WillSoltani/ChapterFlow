import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR
    ? { distDir: process.env.NEXT_DIST_DIR }
    : {}),
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
