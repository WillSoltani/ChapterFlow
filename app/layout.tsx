import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Plus_Jakarta_Sans, JetBrains_Mono, Newsreader } from "next/font/google";
import localFont from "next/font/local";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";
import { MotionProvider } from "@/components/MotionProvider";
import { AuthCacheBoundary } from "@/components/auth/AuthCacheBoundary";
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
  preload: false,
});

// Literary serif reading voice (NS-1). Provides the --font-newsreader variable
// that globals.css's --font-reading token references; reserved EXCLUSIVELY for
// reading prose (.cr-reading-content), never for app chrome. Newsreader is a
// variable font, so loading normal + italic axes covers all reading weights in
// two self-hosted files (leaner than pinning static instances).
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Per-request nonce minted by middleware.ts (WS8-001) and forwarded on the
  // request headers. The theme bootstrap below is EXECUTABLE inline JS, so under
  // the enforcing strict-dynamic CSP it MUST carry this nonce or it is blocked
  // (white-screening the app). Reading headers() opts the whole tree into
  // dynamic rendering — intended.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`${satoshi.variable} ${jakarta.variable} ${jetbrainsMono.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: buildDocumentThemeBootstrapScript(),
          }}
        />
      </head>
      <body className="min-h-screen w-full overflow-x-hidden antialiased font-(--font-body)">
        <AuthCacheBoundary />
        <MotionProvider>{children}</MotionProvider>
        {/* Color-blind support no longer uses an SVG feColorMatrix filter on
            <html>. That global url() filter forced a full-page raster on every
            paint (heavy GPU/jank) and was a color *simulation* that compounded
            confusion for the very users it targeted. globals.css now remaps the
            canonical accent tokens per data-color-blind-mode so semantic colors
            stay distinguishable without rasterizing the page. See M47. */}
      </body>
    </html>
  );
}
