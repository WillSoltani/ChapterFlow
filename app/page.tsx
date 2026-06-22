import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CHAPTERFLOW_NAME,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";
import { RecallNav } from "@/components/landing/recall/RecallNav";
import { RecallAmbient } from "@/components/landing/recall/RecallAmbient";
import { RecallReveal } from "@/components/landing/recall/RecallReveal";
import { RecallHeroSplit } from "@/components/landing/recall/RecallHeroSplit";
import { RecallHowItWorks } from "@/components/landing/recall/RecallHowItWorks";
import { RecallWhyItWorks } from "@/components/landing/recall/RecallWhyItWorks";
import { RecallLibrary } from "@/components/landing/recall/RecallLibrary";
import { RecallRequestSection } from "@/components/landing/recall/RecallRequestSection";
import { RecallPricing } from "@/components/landing/recall/RecallPricing";
import { RecallClose } from "@/components/landing/recall/RecallClose";

export const metadata: Metadata = {
  title: `${CHAPTERFLOW_NAME} | Stop forgetting what you read`,
  description:
    "ChapterFlow turns every non-fiction book into a guided learning loop: read a summary, see real examples, pass a quiz, and let spaced review lock it in. Free to start.",
  metadataBase: new URL(getChapterFlowSiteUrl()),
  openGraph: {
    title: `${CHAPTERFLOW_NAME} | Stop forgetting what you read`,
    description:
      "Most of what you read is gone within days. ChapterFlow turns every book into a guided loop that makes it stick. Free to start.",
    url: getChapterFlowSiteUrl(),
    siteName: CHAPTERFLOW_NAME,
    type: "website",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: `${CHAPTERFLOW_NAME}. Stop forgetting what you read`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${CHAPTERFLOW_NAME} | Stop forgetting what you read`,
    description:
      "Guided reading that makes what you read last. Read it once, keep it for good.",
    images: ["/og"],
  },
};

/**
 * RECALL landing — the hero is the canonical "Editorial Split" (RecallHeroSplit):
 * an oversized headline left, the FSRS retention curve as a framed product plate
 * right. The earlier ?v=a|b|c variant switcher and its alternate heroes are gone.
 * Server Component.
 */
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
        "ChapterFlow turns every non-fiction book into a guided learning loop with summaries, examples, quizzes, and spaced-repetition review.",
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
  ];

  return (
    <div className="landing-dark relative min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Skip to main content (WCAG 2.4.1) */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus-visible:outline-none"
        style={{
          background: "var(--cf-recall-accent)",
          color: "var(--cf-recall-bg)",
        }}
      >
        Skip to main content
      </a>

      {/* The page's depth field — a fixed, parallaxing ambient layer the
          transparent sections read through. Sits behind all content. */}
      <RecallAmbient />

      {/* Failed Cognito sign-ins bounce back to /?auth=… — surface a dismissible
          retry banner. Reads useSearchParams, so it needs its own Suspense
          boundary to keep the page statically renderable. */}
      <Suspense fallback={null}>
        <AuthErrorBanner />
      </Suspense>

      <RecallNav />

      {/* Hero animates on first paint (above the fold); every section below it
          reveals on scroll-in (RecallReveal) so the page stays alive as you go.
          RecallLibrary is the exception: it is scroll-PINNED (an inner
          position:sticky stage), and a RecallReveal wrapper would set a
          transform on the ancestor, which makes that sticky stage stick to the
          wrapper instead of the viewport — killing the pin. It owns its own
          scroll-in choreography, so it is rendered directly. */}
      <main id="main" tabIndex={-1} className="relative z-10 focus:outline-none">
        <RecallHeroSplit />
        <RecallReveal>
          <RecallHowItWorks />
        </RecallReveal>
        <RecallReveal>
          <RecallWhyItWorks />
        </RecallReveal>
        <RecallLibrary />
        <RecallReveal>
          <RecallRequestSection />
        </RecallReveal>
        <RecallReveal>
          <RecallPricing />
        </RecallReveal>
      </main>

      <RecallReveal className="relative z-10">
        <RecallClose />
      </RecallReveal>
    </div>
  );
}
