import { getChapterFlowSiteUrl } from "@/app/_lib/chapterflow-brand";

export default function sitemap() {
  const base = getChapterFlowSiteUrl();

  return [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/books`, lastModified: new Date() },
    { url: `${base}/pricing`, lastModified: new Date() },
    { url: `${base}/contact`, lastModified: new Date() },
    { url: `${base}/legal/terms`, lastModified: new Date() },
    { url: `${base}/legal/privacy`, lastModified: new Date() },
    { url: `${base}/legal/cookies`, lastModified: new Date() },
    { url: `${base}/legal/refund`, lastModified: new Date() },
    { url: `${base}/legal/copyright`, lastModified: new Date() },
    { url: `${base}/legal/data-rights`, lastModified: new Date() },
  ];
}
