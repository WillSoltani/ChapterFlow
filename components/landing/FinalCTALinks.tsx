"use client";

import Link from "next/link";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";

/**
 * Interactive CTA links extracted from FinalCTA so the outer section can stay a
 * server component. Only these tracked links need client JS. Uses the page accent
 * tokens (--accent-cyan / --primary-foreground) — V5's FinalCTA is now a raised
 * panel inside the all-dark .landing-dark scope, not the old light-page anchor
 * band, so the section accent and this button must be the SAME cyan.
 */
export function FinalCTALinks() {
  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <MagneticButton className="rounded-full">
        <Link
          href={AUTH_LOGIN_BOOK_URL}
          onClick={() => track("cta_click", { source: "final_cta_primary" })}
          className="cta-shine inline-flex items-center rounded-full px-8 py-4 font-semibold text-[16px] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
          style={{
            backgroundColor: "var(--accent-cyan)",
            color: "var(--primary-foreground)",
          }}
        >
          Start reading free &rarr;
        </Link>
      </MagneticButton>

      <p className="text-[13px] text-(--text-muted)">
        Two free books &middot; no credit card &middot; cancel anytime
      </p>

      <Link
        href={AUTH_LOGIN_BOOK_URL}
        onClick={() => track("cta_click", { source: "final_cta_signin" })}
        className="text-[14px] font-medium transition-colors duration-200 hover:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2 rounded"
        style={{ color: "var(--text-secondary)" }}
      >
        Already have an account? Sign in
      </Link>
    </div>
  );
}
