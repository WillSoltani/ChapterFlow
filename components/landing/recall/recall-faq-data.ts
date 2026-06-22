import { PRICING } from "@/lib/pricing";

/**
 * The landing FAQ — the SINGLE source of truth for both the rendered accordion
 * (RecallFaq) and the FAQPage JSON-LD in app/page.tsx, so the two can never
 * drift. Answers are PLAIN strings (the schema's answer `text` must be plain
 * text), with the free-book count + trial length derived from PRICING so the
 * copy can't go stale if those change.
 */
export type RecallFaqItem = { q: string; a: string };

export const RECALL_FAQ: RecallFaqItem[] = [
  {
    q: "Can I cancel anytime?",
    a: `Yes — cancel anytime from your settings, no penalties, no lock-in. Cancel during the ${PRICING.trialDays}-day trial and you're never charged. Cancel after and Pro runs until the end of the period you've paid for.`,
  },
  {
    q: `What happens after my ${PRICING.freeBookLimit} free books?`,
    a: "Nothing disappears — you keep your finished books and their summaries, examples, and reviews. To start new books, you upgrade to Pro.",
  },
  {
    q: "Do you keep adding books?",
    a: "Always. We add titles regularly, and you can request the ones you want — Pro requests get priority.",
  },
  {
    q: "Is there a mobile app?",
    a: "ChapterFlow runs in any browser, on any device — nothing to install. A native app is on the roadmap.",
  },
  {
    q: "What happens to my data?",
    a: "It's yours. Export everything — progress, notes, the lot — as JSON, CSV, or Markdown anytime, and delete your account whenever you want. Deleting also cancels any active subscription.",
  },
];

/**
 * The schema.org FAQPage object appended to the landing's JSON-LD array. Built
 * from RECALL_FAQ so the rich-result markup always matches the visible copy.
 */
export function recallFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: RECALL_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
