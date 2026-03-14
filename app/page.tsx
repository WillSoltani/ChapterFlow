import { headers } from "next/headers";
import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { HomeClient } from "@/components/HomeClient";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  getChapterFlowAppUrl,
  getChapterFlowAuthUrl,
  getChapterFlowSiteUrl,
  isChapterFlowAppHost,
  isChapterFlowAuthHost,
  isChapterFlowSiteHost,
} from "@/app/_lib/chapterflow-brand";
import { ChapterFlowHostHome } from "@/app/book/components/ChapterFlowHostHome";
import { ChapterFlowSiteHome } from "@/app/book/components/ChapterFlowSiteHome";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");

  if (isChapterFlowAuthHost(host)) {
    return {
      title: `Sign in | ${CHAPTERFLOW_NAME}`,
      description: `Authentication and account access for ${CHAPTERFLOW_NAME}.`,
      metadataBase: new URL(getChapterFlowAuthUrl()),
    };
  }

  if (isChapterFlowSiteHost(host)) {
    return {
      title: CHAPTERFLOW_NAME,
      description: CHAPTERFLOW_TAGLINE,
      metadataBase: new URL(getChapterFlowSiteUrl()),
    };
  }

  if (isChapterFlowAppHost(host)) {
    return {
      title: CHAPTERFLOW_NAME,
      description: CHAPTERFLOW_TAGLINE,
      metadataBase: new URL(getChapterFlowAppUrl()),
    };
  }

  return {};
}

export default async function Home() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");

  if (isChapterFlowAuthHost(host)) {
    return <ChapterFlowHostHome mode="auth" />;
  }

  if (isChapterFlowSiteHost(host)) {
    return <ChapterFlowSiteHome />;
  }

  if (isChapterFlowAppHost(host)) {
    return <ChapterFlowHostHome mode="app" />;
  }

  return (
    <PageShell>
      <HomeClient />
    </PageShell>
  );
}
