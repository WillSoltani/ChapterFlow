import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CHAPTERFLOW_NAME,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";
import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { InteractiveDemo } from "@/components/sections/InteractiveDemo";
import { Library } from "@/components/sections/Library";
import { SocialProof } from "@/components/sections/SocialProof";
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
    <div className="relative min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Noise texture overlay */}
      <div className="noise-overlay pointer-events-none fixed inset-0 z-0" aria-hidden />

      {/* Background gradient mesh — tokenized via color-mix so it adapts to
          light / dark / high-contrast (the old rgba(34,211,238,…) literals were
          theme-blind: a bright-cyan wash that ignored the active palette).
          Single accent (cyan) for restraint; strengthened from the prior 6%/3%. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background: [
            "radial-gradient(ellipse 60vw 50vw at 28% -5%, color-mix(in srgb, var(--accent-cyan) 9%, transparent), transparent 62%)",
            "radial-gradient(ellipse 52vw 46vw at 82% 52%, color-mix(in srgb, var(--accent-cyan) 5%, transparent), transparent 62%)",
            "var(--bg-base)",
          ].join(", "),
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

        <main id="main" tabIndex={-1} className="focus:outline-none">
          <Hero />
          <Problem />
          <HowItWorks />
          <InteractiveDemo />
          <Library />
          <SocialProof />
          <Pricing />
          <FinalCTA />
        </main>

        <Footer />
        <MobileStickyBar />
      </LandingMotionProvider>
    </div>
  );
}
