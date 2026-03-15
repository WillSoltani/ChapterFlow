import { getChapterFlowSiteUrl } from "@/app/_lib/chapterflow-brand";

export default function robots() {
  const base = getChapterFlowSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/book", "/book/library", "/chapterflow"],
        disallow: ["/app/", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
