import type { Metadata } from "next";
import "./globals.css";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";

const satoshi = localFont({
  src: [
    { path: "../public/fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
    { path: "../public/fonts/Satoshi-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
  preload: true,
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

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
    <html
      lang="en"
      className={`${satoshi.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen w-full overflow-x-hidden antialiased font-(--font-body)">
        {children}
      </body>
    </html>
  );
}
