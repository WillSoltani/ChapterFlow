"use client";

/**
 * RecallRequestSection — STEP · § "Don't see your book?".
 *
 * The always-visible home for the book request. Standard RECALL section shell
 * (transparent over the ambient layer, centered eyebrow/headline/sub triple),
 * with the shared RecallBookRequestForm seated in a single hairline-framed plate.
 * Mirrors RecallPricing's conventions; the form is the one focal element.
 *
 * Anchored #request so the library section's "Request a book" link (and any
 * in-page nav) can smooth-scroll here.
 */

import { RecallBookRequestForm } from "./RecallBookRequestForm";

export function RecallRequestSection() {
  return (
    <section
      id="request"
      aria-labelledby="recall-request-headline"
      className="relative w-full overflow-hidden px-6 py-28 sm:px-10 sm:py-32 lg:px-16 lg:py-40"
      style={{ background: "transparent" }}
    >
      <div className="mx-auto w-full max-w-[72rem]">
        {/* ── Editorial header, centered, lots of air ── */}
        <header className="mx-auto max-w-[40rem] text-center">
          <p
            className="cf-fade-up font-(family-name:--font-mono) text-cf-caption uppercase tracking-[0.34em]"
            style={{ color: "var(--cf-recall-ink-faint)", animationDelay: "0ms" }}
          >
            Requests
          </p>
          <h2
            id="recall-request-headline"
            className="cf-fade-up mt-6 font-(family-name:--font-display) font-bold leading-[0.98] tracking-[-0.04em] text-balance"
            style={{
              color: "var(--cf-recall-ink)",
              fontSize: "clamp(2.25rem, 4.4vw, 3.75rem)",
              animationDelay: "55ms",
            }}
          >
            Don’t see your book?
          </h2>
          <p
            className="cf-fade-up mx-auto mt-6 max-w-[42ch] text-[1.0625rem] leading-relaxed sm:text-[1.1875rem]"
            style={{ color: "var(--cf-recall-ink-soft)", animationDelay: "110ms" }}
          >
            Tell us the title and we’ll email you if it joins the library. Every
            request lands with us directly, and shapes what we build next.
          </p>
        </header>

        {/* ── The form, seated in one hairline-framed plate. The min-height is
            sized to the resting form so the success-state swap (a shorter card)
            doesn't collapse the plate or jump the page. ── */}
        <div
          className="cf-fade-up mx-auto mt-14 flex max-w-[34rem] flex-col justify-center rounded-[1.5rem] p-7 sm:mt-16 sm:p-9"
          style={{
            background: "var(--cf-recall-plate)",
            border: "1px solid var(--cf-recall-frame)",
            animationDelay: "165ms",
            minHeight: "37rem",
          }}
        >
          <RecallBookRequestForm />
        </div>
      </div>
    </section>
  );
}
