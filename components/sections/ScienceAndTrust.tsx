"use client";

import Link from "next/link";
import { ShieldCheck, FlaskConical, BadgeCheck } from "lucide-react";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { useAuthStatus } from "@/components/auth/useAuthStatus";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";

/**
 * §03 Evidence — the RESOLUTION of the §01 signature.
 *
 * The visitor just hand-scrubbed the FSRS retention curve R(t) = 1 / (1 + t/9S)
 * and watched recall snap back at the ACTIVE RECALL beat. This section closes that
 * loop: it restates the SAME curve and the SAME mechanic as cited fact — the 2008
 * Science paper that says retrieval roughly doubles recall — so "operate the loop"
 * lands as a measured instrument reading off a certified spec, not a sales claim.
 *
 * It reads as an instrument-certification sheet: a candor column (we just launched,
 * no proof we haven't earned) beside a hairline "claim → predicts → source" table
 * with mono source call-outs and Lucide legitimacy glyphs, then a calm edge-faded
 * citation marquee of the real references. ZERO fabricated social proof — no
 * ratings, headshots, logos, or user counts. Trust = transparency + cited authority.
 * Brand voice: cite the SCIENCE (testing effect, spacing effect, FSRS-5), never a
 * competitor product.
 */

// Aligned 1:1 with the §01 ScrollStory beats so the section certifies the exact
// curve the visitor scrubbed. `predicts` is what each finding forces the curve to
// do — the behavior they watched on the instrument.
const CITATIONS = [
  {
    Icon: FlaskConical,
    claim: "Memory decays predictably without review.",
    predicts: "The bare forgetting curve you watched fall off a cliff.",
    source: "Ebbinghaus, 1885",
  },
  {
    Icon: BadgeCheck,
    claim: "Retrieving an idea beats rereading it — by a wide margin.",
    predicts: "Why passing the quiz, not finishing the page, is the gate.",
    source: "Karpicke & Roediger · Science · 2008",
  },
  {
    Icon: ShieldCheck,
    claim: "Spacing review to the edge of forgetting holds retention high.",
    predicts: "The saw-tooth that stays above the 90% target line.",
    source: "FSRS-5 · R(t) = 1 / (1 + t ⁄ 9S)",
  },
];

// Compact attributable references for the drifting marquee — the same sources,
// stated as a running citation footer. Real authors/venues only; never logos.
const MARQUEE_CITATIONS = [
  "Ebbinghaus · Über das Gedächtnis · 1885",
  "Karpicke & Roediger · Science · 2008",
  "Cepeda et al. · the spacing effect · 2006",
  "Sweller & Cooper · worked-example effect · 1985",
  "Dunlosky et al. · Psych. Science in the Public Interest · 2013",
  "FSRS-5 · open spaced-repetition scheduler",
];

function CitationMarquee() {
  return (
    <div
      className="mt-10 border-t pt-6"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <p className="cf-folio mb-4" style={{ color: "var(--text-tertiary)" }}>
        Sources, on the record
      </p>
      <div className="cf-marquee" aria-label="Cited sources">
        <div className="cf-marquee-track">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              className={copy === 1 ? "cf-marquee-dup flex flex-nowrap" : "flex flex-nowrap"}
              aria-hidden={copy === 1 ? true : undefined}
            >
              {MARQUEE_CITATIONS.map((cite) => (
                <li
                  key={`${copy}-${cite}`}
                  className="cf-folio shrink-0 whitespace-nowrap px-5 py-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span aria-hidden style={{ color: "var(--accent-cyan)" }}>
                    ·{" "}
                  </span>
                  {cite}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}

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
          <div className="grid gap-10 p-8 md:grid-cols-[1fr_0.95fr] md:gap-12 md:p-12">
            {/* candor — the resolution of the signature */}
            <div>
              <SectionLabel>§03 · EVIDENCE</SectionLabel>
              <h2
                className="mt-4 font-bold leading-[1.1] text-balance"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.8rem, 3.2vw, 2.5rem)",
                  letterSpacing: "-0.03em",
                  color: "var(--text-heading)",
                }}
              >
                The curve you just scrubbed isn&apos;t ours. It&apos;s the record.
              </h2>
              <p
                className="mt-5 max-w-[46ch] text-[15.5px] leading-[1.7]"
                style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
              >
                That retention curve &mdash;{" "}
                <span className="cf-folio" style={{ color: "var(--accent-cyan)" }}>
                  R(t) = 1 / (1 + t&#8201;/&#8201;9S)
                </span>{" "}
                &mdash; is the FSRS-5 schedule reading off a century of memory
                research: the forgetting curve, the testing effect, the spacing
                effect. We just launched, so we won&apos;t show you reviews we
                haven&apos;t earned &mdash; no five-star walls, no
                &ldquo;10,000&nbsp;happy&nbsp;readers,&rdquo; no founder headshots.
                The certification is below. Two free books to check it yourself
                &mdash; that&apos;s the whole pitch.
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

            {/* the certification sheet — claim → predicts → source */}
            <div
              className="flex flex-col justify-center rounded-2xl border p-6"
              style={{ borderColor: "var(--border-subtle)", background: "var(--cf-page-bg)" }}
            >
              <div
                className="flex items-center justify-between border-b pb-3"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span className="cf-folio" style={{ color: "var(--text-tertiary)" }}>
                  Certification · finding → predicts
                </span>
                <span className="cf-folio" style={{ color: "var(--text-tertiary)" }}>Source</span>
              </div>
              <ul>
                {CITATIONS.map((c, i) => {
                  const { Icon } = c;
                  return (
                    <li
                      key={c.source}
                      className="py-4"
                      style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)" }}
                    >
                      <div className="flex items-start gap-3">
                        <Icon
                          size={16}
                          aria-hidden
                          className="mt-0.5 shrink-0 text-(--accent-cyan)"
                        />
                        <div className="min-w-0">
                          <p className="text-[14.5px] font-semibold leading-[1.45]" style={{ color: "var(--text-heading)" }}>
                            {c.claim}
                          </p>
                          <p className="mt-1.5 text-[13px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
                            <span aria-hidden style={{ color: "var(--accent-cyan)" }}>↳ </span>
                            {c.predicts}
                          </p>
                          <p className="cf-folio mt-2.5" style={{ color: "var(--accent-cyan)" }}>
                            {c.source}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* running citation footer — calm drifting strip of the real references */}
          <div className="px-8 pb-8 md:px-12 md:pb-12">
            <CitationMarquee />
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}
