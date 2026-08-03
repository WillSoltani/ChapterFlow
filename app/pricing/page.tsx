import type { Metadata } from "next";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";
import { Pricing } from "@/components/sections/Pricing";
import { PublicMasthead } from "@/components/marketing/PublicMasthead";
import { PublicSiteShell } from "@/components/marketing/PublicSiteShell";

export const metadata: Metadata = {
  title: "Pricing | ChapterFlow",
  description:
    `Start free with 2 books or upgrade to Pro for unlimited access to ${CATALOG_BOOK_COUNT_DISPLAY} guided non-fiction books and all reading depths.`,
};

export default function PricingPage() {
  return (
    <PublicSiteShell>
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <PublicMasthead
          eyebrow="Pricing"
          title="A plan for making books stick."
          description="Start free, then choose unlimited access when ChapterFlow becomes part of how you read."
        />
        <div
          data-public-hero-end
          aria-hidden="true"
          className="pointer-events-none h-px w-full"
        />
        <div className="cf-paper-folio relative z-10 mx-auto mb-20 w-[calc(100%-2rem)] max-w-[76rem] overflow-hidden rounded-[2rem] sm:w-[calc(100%-3rem)]">
          <Pricing />
        </div>
      </main>
    </PublicSiteShell>
  );
}
