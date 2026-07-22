import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import {
  CHAPTERFLOW_NAME,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";
import { RecallAmbient } from "@/components/landing/recall/RecallAmbient";
import { RecallReveal } from "@/components/landing/recall/RecallReveal";
import { RecallHeroSplit } from "@/components/landing/recall/RecallHeroSplit";
import { RecallHowItWorks } from "@/components/landing/recall/RecallHowItWorks";
import { RecallWhyItWorks } from "@/components/landing/recall/RecallWhyItWorks";
import { RecallLibrary } from "@/components/landing/recall/RecallLibrary";
import { RecallRequestSection } from "@/components/landing/recall/RecallRequestSection";
import { RecallFaq } from "@/components/landing/recall/RecallFaq";
import { recallFaqJsonLd } from "@/components/landing/recall/recall-faq-data";
import { RecallPricing } from "@/components/landing/recall/RecallPricing";
import { RecallClose } from "@/components/landing/recall/RecallClose";
import { LandingMotionProvider } from "@/components/landing/LandingMotionProvider";
import { PublicSiteShell } from "@/components/marketing/PublicSiteShell";

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
export default async function Home() {
  // Per-request nonce from middleware.ts (WS8-001). The JSON-LD below is a
  // non-executable data block that browsers do NOT gate under script-src, so
  // this is belt-and-suspenders — but the nonce keeps it consistent with the
  // enforcing policy (and reading headers() makes the page dynamic anyway).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
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
    // FAQ rich-result markup, built from the same data the visible accordion renders.
    recallFaqJsonLd(),
  ];

  return (
    <LandingMotionProvider>
      <PublicSiteShell>
        <script
          type="application/ld+json"
          nonce={nonce}
          // Escape `<` so a literal "</script>" inside any JSON-LD string (e.g. a
          // future FAQ answer) can't close this inline tag early. < is valid
          // JSON and renders identically in the parsed structured data.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />

        {/* The page's depth field — a fixed, parallaxing ambient layer the
            transparent sections read through. Sits behind all content. */}
        <RecallAmbient />

        {/* Failed Cognito sign-ins bounce back to /?auth=… — surface a dismissible
            retry banner. Reads useSearchParams, so it needs its own Suspense
            boundary to keep the page statically renderable. */}
        <Suspense fallback={null}>
          <AuthErrorBanner />
        </Suspense>

        {/* Hero animates on first paint (above the fold); every section below it
            reveals on scroll-in (RecallReveal) so the page stays alive as you go.
            RecallLibrary owns its sticky choreography and stays unwrapped. */}
        <main id="main" tabIndex={-1} className="relative z-10 focus:outline-none">
          <RecallHeroSplit />
          <div
            data-public-hero-end
            aria-hidden="true"
            className="pointer-events-none h-px w-full"
          />
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
            <RecallFaq />
          </RecallReveal>
          <RecallReveal>
            <RecallPricing />
          </RecallReveal>
          <RecallReveal>
            <RecallClose />
          </RecallReveal>
        </main>
      </PublicSiteShell>
    </LandingMotionProvider>
  );
}
