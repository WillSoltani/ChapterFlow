"use client";

import Link from "next/link";
import { PulseCTA } from "@/components/landing/PulseCTA";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";

/**
 * Interactive CTA links extracted from FinalCTA so the outer section can
 * stay a server component. Only these tracked links need client JS.
 */
export function FinalCTALinks() {
  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <PulseCTA className="inline-block">
        <Link
          href={AUTH_LOGIN_BOOK_URL}
          onClick={() => track("cta_click", { source: "final_cta_primary" })}
          className="cta-shine inline-flex items-center rounded-full px-8 py-4 font-semibold text-[16px] transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
          style={{
            backgroundColor: "var(--accent-cyan)",
            color: "var(--primary-foreground)",
          }}
        >
          Start reading free &rarr;
        </Link>
      </PulseCTA>

      <Link
        href={AUTH_LOGIN_BOOK_URL}
        onClick={() => track("cta_click", { source: "final_cta_signin" })}
        className="text-[14px] font-medium transition-colors duration-200 hover:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 rounded"
        style={{ color: "var(--text-secondary)" }}
      >
        Already have an account? Sign in
      </Link>
    </div>
  );
}
