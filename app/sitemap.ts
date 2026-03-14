import { headers } from "next/headers";
import { projects } from "@/content/projects";
import { getSiteUrl } from "@/app/_lib/site-url";
import {
  getChapterFlowAppUrl,
  getChapterFlowAuthUrl,
  getChapterFlowSiteUrl,
  isChapterFlowAppHost,
  isChapterFlowAuthHost,
  isChapterFlowSiteHost,
} from "@/app/_lib/chapterflow-brand";

export default async function sitemap() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");

  if (isChapterFlowAuthHost(host)) {
    return [{ url: `${getChapterFlowAuthUrl()}/`, lastModified: new Date() }];
  }

  if (isChapterFlowSiteHost(host)) {
    const base = getChapterFlowSiteUrl();
    return [{ url: `${base}/`, lastModified: new Date() }];
  }

  if (isChapterFlowAppHost(host)) {
    const base = getChapterFlowAppUrl();
    return [
      { url: `${base}/`, lastModified: new Date() },
      { url: `${base}/book`, lastModified: new Date() },
      { url: `${base}/book/library`, lastModified: new Date() },
      { url: `${base}/book/profile`, lastModified: new Date() },
      { url: `${base}/book/progress`, lastModified: new Date() },
    ];
  }

  const base = getSiteUrl();

  const projectUrls = projects.map((p) => ({
    url: `${base}/projects/${p.slug}`,
    lastModified: new Date(),
  }));

  return [
    { url: `${base}/`, lastModified: new Date() },
    ...projectUrls,
  ];
}
