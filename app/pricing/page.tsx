import type { Metadata } from "next";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";
import { PricingPageClient } from "./PricingPageClient";

export const metadata: Metadata = {
  title: "Pricing | ChapterFlow",
  description:
    `Start free with 2 books or upgrade to Pro for unlimited access to ${CATALOG_BOOK_COUNT_DISPLAY} guided non-fiction books and all reading depths.`,
};

export default function PricingPage() {
  return <PricingPageClient />;
}
