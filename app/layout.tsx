import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";
import { MotionProvider } from "@/components/MotionProvider";
import { buildDocumentThemeBootstrapScript } from "@/app/_lib/document-theme";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#070b16" },
  ],
};

export const metadata: Metadata = {
  title: CHAPTERFLOW_NAME,
  description: CHAPTERFLOW_TAGLINE,
  metadataBase: new URL(getChapterFlowSiteUrl()),
  alternates: {
    canonical: getChapterFlowSiteUrl(),
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: CHAPTERFLOW_NAME,
    description: CHAPTERFLOW_TAGLINE,
    url: getChapterFlowSiteUrl(),
    siteName: CHAPTERFLOW_NAME,
    type: "website",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: CHAPTERFLOW_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: CHAPTERFLOW_NAME,
    description: CHAPTERFLOW_TAGLINE,
    images: ["/og"],
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: buildDocumentThemeBootstrapScript(),
          }}
        />
      </head>
      <body className="min-h-screen w-full overflow-x-hidden antialiased font-(--font-body)">
        <MotionProvider>{children}</MotionProvider>
        {/* Color-blind simulation SVG filters — referenced site-wide by
            html[data-color-blind-mode="…"]{filter:url(#cf-…)} in globals.css.
            Live in the ROOT layout so /dashboard, onboarding, rewards and the
            marketing site get the filter too (not just /book routes). */}
        <svg aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
          <defs>
            <filter id="cf-protanopia">
              <feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0" />
            </filter>
            <filter id="cf-deuteranopia">
              <feColorMatrix type="matrix" values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0" />
            </filter>
            <filter id="cf-tritanopia">
              <feColorMatrix type="matrix" values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0" />
            </filter>
          </defs>
        </svg>
      </body>
    </html>
  );
}
