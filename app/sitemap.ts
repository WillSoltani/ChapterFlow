import { getChapterFlowSiteUrl } from "@/app/_lib/chapterflow-brand";

export default function sitemap() {
  const base = getChapterFlowSiteUrl();

  return [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/book`, lastModified: new Date() },
    { url: `${base}/book/library`, lastModified: new Date() },
    { url: `${base}/book/profile`, lastModified: new Date() },
    { url: `${base}/book/progress`, lastModified: new Date() },
    { url: `${base}/chapterflow`, lastModified: new Date() },
  ];
}
