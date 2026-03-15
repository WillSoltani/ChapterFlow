import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";

export const metadata: Metadata = {
  title: CHAPTERFLOW_NAME,
  description: CHAPTERFLOW_TAGLINE,
  metadataBase: new URL(getChapterFlowSiteUrl()),
  openGraph: {
    title: CHAPTERFLOW_NAME,
    description: CHAPTERFLOW_TAGLINE,
    url: getChapterFlowSiteUrl(),
    siteName: CHAPTERFLOW_NAME,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.className} ${GeistMono.variable}`}>
      <body className="min-h-screen w-full overflow-x-hidden bg-[#040812] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
