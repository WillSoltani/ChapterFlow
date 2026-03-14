import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { getSiteUrl } from "@/app/_lib/site-url";
import {
  isChapterFlowAppHost,
  isChapterFlowAuthHost,
  isChapterFlowSiteHost,
} from "@/app/_lib/chapterflow-brand";

// ✅ Client component is fine to render inside a Server Component layout
import { InteractiveBackground } from "@/components/InteractiveBackground";

export const metadata: Metadata = {
  title: "Will Soltani | Cloud Portfolio",
  description:
    "AWS-focused cloud portfolio featuring production-style projects, architecture, security, and observability.",
  metadataBase: new URL(getSiteUrl()),
  openGraph: {
    title: "Will Soltani | Cloud Portfolio",
    description:
      "AWS-focused cloud portfolio with production-grade projects and case studies.",
    url: getSiteUrl(),
    siteName: "Will Soltani",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const isChapterFlowSurface =
    isChapterFlowSiteHost(host) ||
    isChapterFlowAppHost(host) ||
    isChapterFlowAuthHost(host);

  return (
    <html lang="en" className={`${GeistSans.className} ${GeistMono.variable}`}>
      <body
        className={[
          "min-h-screen w-full overflow-x-hidden text-slate-100 antialiased",
          isChapterFlowSurface ? "bg-[#040812]" : "bg-[#070b16]",
        ].join(" ")}
      >
        {!isChapterFlowSurface ? <InteractiveBackground /> : null}

        {children}
      </body>
    </html>
  );
}
