import type { Metadata } from "next";
import { PricingPageClient } from "./PricingPageClient";

export const metadata: Metadata = {
  title: "Pricing | ChapterFlow",
  description:
    "Start free with 2 books or upgrade to Pro for unlimited access to 95+ guided non-fiction books, Challenge mode, and 2x Flow Points.",
};

export default function PricingPage() {
  return <PricingPageClient />;
}
