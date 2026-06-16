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
import { PRICING } from "@/lib/pricing";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";

export const metadata: Metadata = {
  title: `${CHAPTERFLOW_NAME} | Stop forgetting what you read`,
  description:
    `ChapterFlow turns every non-fiction book into a guided learning loop. Read summaries, see real-world scenarios, prove retention with quizzes, and unlock the next chapter. ${CATALOG_BOOK_COUNT_DISPLAY} books, free to start.`,
  metadataBase: new URL(getChapterFlowSiteUrl()),
  openGraph: {
    title: `${CHAPTERFLOW_NAME} | Stop forgetting what you read`,
    description:
      `Guided reading that turns every chapter into a 20-minute learning loop. Summaries, scenarios, quizzes, and real progress. ${CATALOG_BOOK_COUNT_DISPLAY} non-fiction books.`,
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
      `Guided reading that turns every chapter into a 20-minute learning loop. ${CATALOG_BOOK_COUNT_DISPLAY} non-fiction books, free to start.`,
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
        "ChapterFlow turns every non-fiction book into a guided learning loop with summaries, scenarios, and quizzes.",
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
        "Unlimited access to a structured non-fiction reading library with summaries, scenarios, quizzes, and spaced-repetition retention.",
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

      {/* Background gradient mesh */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background: [
            "radial-gradient(ellipse 60vw 50vw at 30% 0%, rgba(34, 211, 238, 0.06), transparent)",
            "radial-gradient(ellipse 40vw 40vw at 80% 60%, rgba(34, 211, 238, 0.03), transparent)",
            "var(--bg-base)",
          ].join(", "),
        }}
      />

      {/* Skip to main content (WCAG 2.4.1) */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
        style={{
          background: "var(--accent-cyan)",
          color: "var(--primary-foreground)",
        }}
      >
        Skip to main content
      </a>

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
    </div>
  );
}
