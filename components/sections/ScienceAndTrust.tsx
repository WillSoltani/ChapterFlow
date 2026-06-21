"use client";

import Link from "next/link";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { useAuthStatus } from "@/components/auth/useAuthStatus";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";

/**
 * The honest-candor trust beat, reframed as a CITATION LEDGER. The signature
 * already animates the science; here it reads as evidence — each claim paired with
 * its source — next to plain candor. Pre-launch, we have no testimonials / ratings
 * / user counts, and we say so. ZERO people, metrics, or social proof; trust here
 * is transparency + cited authority. Flat panel + hairline rules (no glass) to
 * match the editorial Ledger texture.
 */

const CITATIONS = [
  {
    claim: "Memory decays predictably without review.",
    detail: "Most of what you read is lost within days of finishing.",
    source: "Ebbinghaus, 1885",
  },
  {
    claim: "Retrieving an idea beats rereading it — by a wide margin.",
    detail: "Testing yourself roughly doubled long-term recall versus rereading.",
    source: "Karpicke & Roediger, Science, 2008",
  },
  {
    claim: "Spacing review to the edge of forgetting maximizes retention.",
    detail: "FSRS times each review to land on a 90% recall target.",
    source: "FSRS · Anki 23.10 default scheduler",
  },
];

export function ScienceAndTrust() {
  const { loggedIn } = useAuthStatus();
  const ctaHref = loggedIn ? "/book" : AUTH_LOGIN_BOOK_URL;

  return (
    <section id="why-it-works" className="mx-auto max-w-5xl px-5 pt-(--section-pad-sm) pb-(--section-pad-lg) md:pt-(--section-pad-md)">
      <SectionReveal>
        <div
          className="overflow-hidden rounded-3xl border"
          style={{ background: "var(--cf-surface)", borderColor: "var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
        >
          <div className="grid gap-10 p-8 md:grid-cols-[1fr_0.9fr] md:gap-12 md:p-12">
            {/* candor */}
            <div>
              <SectionLabel>STRAIGHT TALK</SectionLabel>
              <h2
                className="mt-4 font-bold leading-[1.1] text-balance"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.8rem, 3.2vw, 2.5rem)",
                  letterSpacing: "-0.03em",
                  color: "var(--text-heading)",
                }}
              >
                We just launched, so we won&apos;t show you reviews we haven&apos;t earned.
              </h2>
              <p
                className="mt-5 max-w-[46ch] text-[15.5px] leading-[1.7]"
                style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
              >
                No five-star walls, no &ldquo;10,000 happy readers,&rdquo; no founder
                headshots. We kept buying great books and forgetting them, so we built
                the loop the research points to and left out everything it doesn&apos;t.
                The method below is the same one behind{" "}
                <span style={{ color: "var(--text-heading)", fontWeight: 600 }}>Anki</span> and{" "}
                <span style={{ color: "var(--text-heading)", fontWeight: 600 }}>Duolingo</span>.
                Two free books to judge it for yourself — that&apos;s the whole pitch.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <MagneticButton className="rounded-full">
                  <Link
                    href={ctaHref}
                    onClick={() => track("cta_click", { source: "science_trust" })}
                    className="cta-shine inline-flex items-center rounded-full px-7 py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
                    style={{ backgroundColor: "var(--accent-cyan)", color: "var(--primary-foreground)" }}
                  >
                    Read your first chapter &rarr;
                  </Link>
                </MagneticButton>
                <p className="cf-folio">Two free books · no card · cancel anytime</p>
              </div>
            </div>

            {/* the citation ledger */}
            <div
              className="flex flex-col justify-center rounded-2xl border p-6"
              style={{ borderColor: "var(--border-subtle)", background: "var(--cf-page-bg)" }}
            >
              <div
                className="flex items-center justify-between border-b pb-3"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span className="cf-folio" style={{ color: "var(--text-tertiary)" }}>The receipts</span>
                <span className="cf-folio" style={{ color: "var(--text-tertiary)" }}>Source</span>
              </div>
              <ul>
                {CITATIONS.map((c, i) => (
                  <li
                    key={c.source}
                    className="py-4"
                    style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)" }}
                  >
                    <p className="text-[14.5px] font-semibold leading-[1.45]" style={{ color: "var(--text-heading)" }}>
                      {c.claim}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
                      {c.detail}
                    </p>
                    <p className="cf-folio mt-2.5" style={{ color: "var(--accent-cyan)" }}>
                      {c.source}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}
