"use client";

/**
 * RecallWhyItWorks — STEP 3 · § "Why it works" (science / trust).
 *
 * The trust layer is RECEIPTS, not testimonials: four real findings from the
 * memory-science literature, each stated plainly and credited to its source.
 * Restrained typography only — NO chart (the retention curve lives in the hero
 * and appears exactly once), NO fabricated social proof, NO logos.
 *
 * Layout is a calm two-column editorial column-set on desktop: a short sticky-feel
 * header on the left, the citation receipts stacked as a hairline-ruled ledger on
 * the right. Near-monochrome over the same deep canvas; the single periwinkle
 * recall accent is the only hue. Fast cf-fade-up entrances; prefers-reduced-motion
 * renders the final state statically.
 */

const RECEIPTS: { finding: string; source: string; year: string; href?: string }[] = [
  {
    finding:
      "Memory decays on a predictable curve. Most of what you read is gone within days, unless something interrupts the forgetting.",
    source: "Hermann Ebbinghaus, Über das Gedächtnis",
    year: "1885",
    href: "https://archive.org/details/memorycontributi00ebbiuoft",
  },
  {
    finding:
      "Recalling an idea from memory locks it in far better than rereading it. The act of retrieval is what makes knowledge last: the testing effect.",
    source: "Karpicke & Roediger, Science",
    year: "2008",
    href: "https://doi.org/10.1126/science.1152408",
  },
  {
    finding:
      "The same study, spread out over time, beats the same study crammed together. Spacing reviews is one of the most reliable findings in learning.",
    source: "Cepeda et al., Psychological Bulletin",
    year: "2006",
    href: "https://doi.org/10.1037/0033-2909.132.3.354",
  },
  {
    finding:
      "A modern scheduling algorithm predicts the moment you're about to forget and brings each idea back right then, so you never review more than you need.",
    source: "FSRS · open-source spaced-repetition scheduler",
    year: "FSRS-5",
    href: "https://github.com/open-spaced-repetition/fsrs4anki",
  },
];

export function RecallWhyItWorks() {
  return (
    <section
      id="why-it-works"
      aria-labelledby="recall-science-headline"
      className="relative w-full px-6 py-28 sm:px-10 sm:py-32 lg:px-16 lg:py-40"
      style={{ background: "transparent" }}
    >
      <div className="mx-auto grid w-full max-w-[78rem] grid-cols-1 gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        {/* ── LEFT: the editorial header, lots of air ── */}
        <header className="max-w-[26rem]">
          <p
            className="cf-fade-up font-(family-name:--font-mono) text-cf-caption uppercase tracking-[0.34em]"
            style={{
              color: "var(--cf-recall-ink-faint)",
              animationDelay: "0ms",
            }}
          >
            Why it works
          </p>
          <h2
            id="recall-science-headline"
            className="cf-fade-up mt-6 font-(family-name:--font-display) font-bold leading-[0.98] tracking-[-0.04em] text-balance"
            style={{
              color: "var(--cf-recall-ink)",
              fontSize: "clamp(2.25rem, 4.2vw, 3.5rem)",
              animationDelay: "55ms",
            }}
          >
            Built on a century of memory research.
          </h2>
          <p
            className="cf-fade-up mt-6 max-w-[34ch] text-[1.0625rem] leading-relaxed sm:text-[1.1875rem]"
            style={{
              color: "var(--cf-recall-ink-soft)",
              animationDelay: "110ms",
            }}
          >
            We didn&apos;t invent how your memory works. We just built the loop
            around a century of research, so you don&apos;t have to think about it.
          </p>
        </header>

        {/* ── RIGHT: the citation receipts — a hairline-ruled ledger ── */}
        <ol className="flex flex-col">
          {RECEIPTS.map((r, i) => (
            <li
              key={r.source}
              className="cf-fade-up cf-hover-nudge flex flex-col gap-5 py-9 first:pt-0 sm:flex-row sm:items-start sm:gap-10"
              style={{
                animationDelay: `${140 + i * 60}ms`,
                borderTop:
                  i === 0 ? "none" : "1px solid var(--cf-recall-frame)",
              }}
            >
              {/* the finding, stated plainly */}
              <p
                className="order-2 max-w-[42ch] text-[1.0625rem] leading-relaxed sm:order-1 sm:flex-1"
                style={{ color: "var(--cf-recall-ink)" }}
              >
                {r.finding}
              </p>
              {/* the receipt: source + year in mono, right-anchored. When a
                  primary-source href exists, the receipt becomes a quiet link
                  (new tab) with a tiny ↗ affordance. */}
              <div className="order-1 shrink-0 sm:order-2 sm:w-[12rem] sm:pt-1 sm:text-right">
                {r.href ? (
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex flex-col rounded underline-offset-4 transition-opacity duration-150 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:items-end"
                    style={{
                      // @ts-expect-error -- CSS custom property for the focus ring color
                      "--tw-ring-color": "var(--cf-recall-accent-line)",
                    }}
                  >
                    <span
                      className="font-(family-name:--font-mono) text-cf-label-sm leading-snug tracking-[0.04em] group-hover:underline"
                      style={{ color: "var(--cf-recall-ink-soft)" }}
                    >
                      {r.source}
                    </span>
                    <span
                      className="mt-1.5 inline-flex items-center gap-1 font-(family-name:--font-mono) text-cf-caption uppercase tracking-[0.2em] group-hover:underline"
                      style={{ color: "var(--cf-recall-accent)" }}
                    >
                      {r.year}
                      <span aria-hidden className="text-[0.85em]">↗</span>
                    </span>
                  </a>
                ) : (
                  <>
                    <p
                      className="font-(family-name:--font-mono) text-cf-label-sm leading-snug tracking-[0.04em]"
                      style={{ color: "var(--cf-recall-ink-soft)" }}
                    >
                      {r.source}
                    </p>
                    <p
                      className="mt-1.5 font-(family-name:--font-mono) text-cf-caption uppercase tracking-[0.2em]"
                      style={{ color: "var(--cf-recall-accent)" }}
                    >
                      {r.year}
                    </p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
