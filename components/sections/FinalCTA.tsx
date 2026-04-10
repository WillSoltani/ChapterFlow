"use client";

import Link from "next/link";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { PulseCTA } from "@/components/landing/PulseCTA";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";

export function FinalCTA() {
  return (
    <section className="pt-6 pb-14 lg:pt-8 lg:pb-20 px-4">
      <SectionReveal>
        <div className="max-w-[640px] mx-auto text-center">
          <SectionLabel>START WITH ONE CHAPTER</SectionLabel>

          <h2
            className="mt-4 text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[1.1] tracking-[-0.02em]"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--text-heading)",
            }}
          >
            Read like it actually sticks.
          </h2>

          <p
            className="mt-2 text-[24px] md:text-[28px] font-bold"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--accent-teal)",
            }}
          >
            No summaries. No shortcuts. Real retention.
          </p>

          <p
            className="mt-4 text-[16px] md:text-[18px] leading-[1.7]"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--text-secondary)",
            }}
          >
            Every chapter is a 20-minute loop: read, apply, prove, unlock.
            Start free &mdash; no credit card, no commitment.
          </p>

          {/* CTA button */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <PulseCTA className="inline-block">
              <Link
                href={AUTH_LOGIN_BOOK_URL}
                onClick={() => track("cta_click", { source: "final_cta_primary" })}
                className="cta-shine inline-flex items-center rounded-full px-8 py-4 font-semibold text-[16px] transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
                style={{
                  backgroundColor: "var(--accent-teal)",
                  color: "var(--primary-foreground)",
                }}
              >
                Start reading free &rarr;
              </Link>
            </PulseCTA>

            <Link
              href={AUTH_LOGIN_BOOK_URL}
              onClick={() => track("cta_click", { source: "final_cta_signin" })}
              className="text-[14px] font-medium transition-colors duration-200 hover:text-[--text-heading] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 rounded"
              style={{ color: "var(--text-secondary)" }}
            >
              Already have an account? Sign in
            </Link>
          </div>

        </div>
      </SectionReveal>
    </section>
  );
}
