import { getChapterFlowSiteUrl } from "@/app/_lib/chapterflow-brand";

export default function robots() {
  const base = getChapterFlowSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/books", "/pricing", "/contact", "/legal/"],
        // /book and /book/* (login-gated, 302 to /auth/login), /chapterflow
        // (302 to /book), /app/*, /dashboard/*, and /api/* must not be crawled.
        // "/book$" + "/book/" target the exact /book route and its subtree
        // without also blocking the public /books storefront (longest-match wins,
        // but the explicit end-anchor keeps the two intents from overlapping).
        disallow: [
          "/app/",
          "/api/",
          "/book$",
          "/book/",
          "/dashboard/",
          "/chapterflow",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
