import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR
    ? { distDir: process.env.NEXT_DIST_DIR }
    : {}),
  async redirects() {
    return [
      {
        source: "/book/home",
        destination: "/book/workspace",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
