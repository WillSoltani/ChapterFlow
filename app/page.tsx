import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CHAPTERFLOW_NAME,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";
import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";
import { ScrollStory } from "@/components/sections/ScrollStory";
import { Ledger } from "@/components/sections/Ledger";
import { ScienceAndTrust } from "@/components/sections/ScienceAndTrust";
import { Pricing } from "@/components/sections/Pricing";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";
import { MobileStickyBar } from "@/components/landing/MobileStickyBar";
import { LandingMotionProvider } from "@/components/landing/LandingMotionProvider";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { PRICING } from "@/lib/pricing";
import {
  CATALOG_BOOK_COUNT_DISPLAY,
  CATALOG_MEDIAN_CHAPTER_MINUTES,
} from "@/lib/catalog-stats";

export const metadata: Metadata = {
  title: `${CHAPTERFLOW_NAME} | Stop forgetting what you read`,
  description:
    `ChapterFlow turns every non-fiction book into a guided learning loop. Read summaries, see real-world examples, prove retention with quizzes, and practice what you learned. ${CATALOG_BOOK_COUNT_DISPLAY} books, free to start.`,
  metadataBase: new URL(getChapterFlowSiteUrl()),
  openGraph: {
    title: `${CHAPTERFLOW_NAME} | Stop forgetting what you read`,
    description:
      `Guided reading that turns every chapter into a ~${CATALOG_MEDIAN_CHAPTER_MINUTES}-minute learning loop. Summaries, examples, quizzes, and real progress. ${CATALOG_BOOK_COUNT_DISPLAY} non-fiction books.`,
    url: getChapterFlowSiteUrl(),
    siteName: CHAPTERFLOW_NAME,
    type: "website",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: `${CHAPTERFLOW_NAME} — Stop forgetting what you read`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${CHAPTERFLOW_NAME} | Stop forgetting what you read`,
    description:
      `Guided reading that turns every chapter into a ~${CATALOG_MEDIAN_CHAPTER_MINUTES}-minute learning loop. ${CATALOG_BOOK_COUNT_DISPLAY} non-fiction books, free to start.`,
    images: ["/og"],
  },
};

export default function Home() {
  const siteUrl = getChapterFlowSiteUrl();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: CHAPTERFLOW_NAME,
      url: siteUrl,
      logo: `${siteUrl}/og`,
      description:
        "ChapterFlow turns every non-fiction book into a guided learning loop with summaries, examples, and quizzes.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: CHAPTERFLOW_NAME,
      url: siteUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/books?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${CHAPTERFLOW_NAME} Pro`,
      description:
        "Unlimited access to a structured non-fiction reading library with summaries, examples, quizzes, and spaced-repetition retention.",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: PRICING.annualMonthlyAmount.toFixed(2),
        highPrice: PRICING.monthlyAmount.toFixed(2),
        priceCurrency: PRICING.currency,
        offerCount: 2,
        availability: "https://schema.org/InStock",
      },
    },
  ];

  return (
    <div className="landing-dark relative min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Noise texture overlay */}
      <div className="noise-overlay pointer-events-none fixed inset-0 z-0" aria-hidden />

      {/* Background gradient mesh — tokenized via color-mix so it adapts to
          light / dark / high-contrast. Single accent (cyan) for restraint. Three
          well-distributed glows (top-left, mid-right, lower-center) so no stretch
          of the page scrolls over truly flat black — the "void/sparse" failure
          mode. Fixed, so every scroll position keeps some atmosphere. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background: [
            "radial-gradient(ellipse 60vw 50vw at 28% -5%, color-mix(in srgb, var(--accent-cyan) 11%, transparent), transparent 62%)",
            "radial-gradient(ellipse 54vw 48vw at 84% 46%, color-mix(in srgb, var(--accent-cyan) 7%, transparent), transparent 60%)",
            "radial-gradient(ellipse 66vw 46vw at 36% 103%, color-mix(in srgb, var(--accent-cyan) 7%, transparent), transparent 58%)",
            "var(--bg-base)",
          ].join(", "),
        }}
      />
      {/* Faint structural grid — gives the eye something to rest on so empty bands
          never read as dead black. Fixed + masked to fade at the very top/bottom. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--cf-grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--cf-grid-line) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(135% 105% at 50% 42%, black 78%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(135% 105% at 50% 42%, black 78%, transparent 100%)",
        }}
      />

      {/* Skip to main content (WCAG 2.4.1) */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
        style={{
          background: "var(--accent-cyan)",
          color: "var(--primary-foreground)",
        }}
      >
        Skip to main content
      </a>

      {/* ONE LazyMotion provider for the whole marketing tree (see
          LandingMotionProvider). Sections inside use the lightweight `m`. */}
      <LandingMotionProvider>
        <ScrollProgressBar />

        <Navbar />
        <Suspense fallback={null}>
          <AuthErrorBanner />
        </Suspense>

        {/* Product-forward narrative — the loop is the spine. The reader appears
            twice in two registers (hero showpiece → scroll-driven signature), never
            repeated: hook (hero) → operate the loop + the science (signature) →
            the toolkit (ledger) → honest trust → price → close. */}
        <main id="main" tabIndex={-1} className="focus:outline-none">
          <Hero />
          <ScrollStory />
          <Ledger />
          <ScienceAndTrust />
          <Pricing />
          <FinalCTA />
        </main>

        <Footer />
        <MobileStickyBar />
      </LandingMotionProvider>
    </div>
  );
}
