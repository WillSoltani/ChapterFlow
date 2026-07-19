"use client";

import Link from "next/link";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { track } from "@/lib/analytics";
import { FREE_OFFER_LABEL } from "@/lib/pricing";

export function BrowseLibraryBottomCta() {
  return (
    <section className="pt-4 pb-14 lg:pt-6 lg:pb-16 px-4">
      <SectionReveal>
        <div
          className="max-w-[640px] mx-auto text-center rounded-2xl p-8 md:p-10"
          style={{
            background: "var(--bg-glass)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <SectionLabel>START WITH ONE CHAPTER</SectionLabel>

          <h2
            className="mt-3 text-2xl md:text-3xl font-bold leading-[1.15]"
            style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
          >
            Every book follows the same proven loop.
          </h2>

          <p
            className="mt-3 text-cf-body leading-[1.7] max-w-md mx-auto"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
          >
            Read the summary. See it applied in real life. Prove you understood it.
            Practice what you learned.
          </p>

          <div className="mt-6">
            <Link
              href={AUTH_LOGIN_BOOK_URL}
              onClick={() => track("cta_click", { source: "browse_library_bottom_cta" })}
              className="cta-shine inline-flex items-center rounded-full px-7 py-3.5 font-semibold text-cf-body transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
              style={{ backgroundColor: "var(--accent-cyan)", color: "var(--primary-foreground)" }}
            >
              Open my first book →
            </Link>
          </div>

          <p className="mt-3 text-cf-label-sm" style={{ color: "var(--text-muted)" }}>
            No credit card · {FREE_OFFER_LABEL} · Cancel anytime
          </p>
        </div>
      </SectionReveal>
    </section>
  );
}
