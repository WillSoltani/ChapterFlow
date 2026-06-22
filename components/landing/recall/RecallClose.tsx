/**
 * RecallClose — STEP 6 · § "Final CTA + footer".
 *
 * The quiet, confident close. ONE focal idea: a single-line promise + the one
 * accent CTA, on the same deep canvas with enormous whitespace. Then a minimal
 * footer colophon beneath a hairline — wordmark, the in-page section links, the
 * legal pages (Terms/Privacy/Refunds/Cookies), and a single legal line. NO
 * chart/curve (that lives in the hero, exactly once), NO second hue, NO social
 * proof, NO clutter.
 *
 * The CTA repeats the hero's exact accent button so the page opens and closes on
 * the same gesture. The footer count is DERIVED from CATALOG_BOOK_COUNT_DISPLAY
 * so it can never overstate the real catalog. Token-only DOM color; Tailwind v4
 * parenthetical token syntax; fast cf-fade-up entrances; prefers-reduced-motion
 * → static. Server Component (static brand/pricing/catalog constants only).
 */

import { ArrowRight } from "lucide-react";
import { AUTH_LOGIN_BOOK_URL, CHAPTERFLOW_NAME } from "@/app/_lib/chapterflow-brand";
import { FREE_OFFER_LABEL } from "@/lib/pricing";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";

/* The in-page section anchors, named plainly. No fabricated About/Blog/Careers
   tree — just the real sections of this page. */
const SECTION_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#why-it-works", label: "Why it works" },
  { href: "#library", label: "Library" },
  { href: "#pricing", label: "Pricing" },
] as const;

/* The real legal pages (app/legal/*). Required on a paid Stripe product —
   labels/paths mirror the canonical site footer (components/sections/Footer). */
const LEGAL_LINKS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/refund", label: "Refunds" },
  { href: "/legal/cookies", label: "Cookies" },
] as const;

export function RecallClose() {
  const year = new Date().getFullYear();

  return (
    <footer
      aria-labelledby="recall-close-headline"
      className="relative w-full overflow-hidden"
      style={{ background: "transparent" }}
    >
      {/* ── The quiet close: one promise line + the one accent CTA ── */}
      <section className="relative px-6 py-32 sm:px-10 sm:py-40 lg:px-16 lg:py-48">
        {/* a single soft bloom seated behind the close, for depth — no glass */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, var(--cf-recall-bloom), transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-[46rem] text-center">
          <h2
            id="recall-close-headline"
            className="cf-fade-up font-(family-name:--font-display) font-bold leading-[0.95] tracking-[-0.045em] text-balance"
            style={{
              color: "var(--cf-recall-ink)",
              fontSize: "clamp(2.5rem, 5.6vw, 4.75rem)",
              animationDelay: "0ms",
            }}
          >
            Read it once. Keep it for good.
          </h2>

          <p
            className="cf-fade-up mx-auto mt-7 max-w-[40ch] text-[1.0625rem] leading-relaxed sm:text-[1.1875rem]"
            style={{ color: "var(--cf-recall-ink-soft)", animationDelay: "55ms" }}
          >
            Start with {FREE_OFFER_LABEL}, no card. From here on, what you read
            stays with you.
          </p>

          <div
            className="cf-fade-up mt-11 flex justify-center"
            style={{ animationDelay: "110ms" }}
          >
            <a
              href={AUTH_LOGIN_BOOK_URL}
              className="inline-flex items-center justify-center gap-2 rounded-full px-9 py-4 text-[0.9375rem] font-semibold transition-[transform,filter,box-shadow] duration-150 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                background: "var(--cf-recall-accent)",
                color: "var(--cf-recall-bg)",
                boxShadow: "0 14px 40px -12px var(--cf-recall-glow)",
                // @ts-expect-error -- CSS custom property for the focus ring color
                "--tw-ring-color": "var(--cf-recall-accent)",
              }}
            >
              Start reading free
              <ArrowRight size={17} strokeWidth={2.25} aria-hidden />
            </a>
          </div>
        </div>
      </section>

      {/* ── The minimal colophon, beneath one hairline ── */}
      <div
        className="px-6 sm:px-10 lg:px-16"
        style={{ borderTop: "1px solid var(--cf-recall-frame)" }}
      >
        <div className="mx-auto flex max-w-[72rem] flex-col gap-8 py-12 sm:flex-row sm:items-center sm:justify-between sm:py-10">
          {/* wordmark + one-line descriptor */}
          <div className="flex flex-col gap-2">
            <span
              className="font-(family-name:--font-display) text-[16px] font-semibold"
              style={{ color: "var(--cf-recall-ink)" }}
            >
              {CHAPTERFLOW_NAME}
            </span>
            <span
              className="text-[13px] leading-relaxed"
              style={{ color: "var(--cf-recall-ink-faint)" }}
            >
              Guided reading that makes {CATALOG_BOOK_COUNT_DISPLAY} books you love
              stick.
            </span>
          </div>

          {/* the real in-page section links */}
          <nav aria-label="Sections">
            <ul className="flex flex-wrap gap-x-7 gap-y-3">
              {SECTION_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="rounded text-[13px] font-medium underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      color: "var(--cf-recall-ink-soft)",
                      // @ts-expect-error -- CSS custom property for the focus ring color
                      "--tw-ring-color": "var(--cf-recall-accent-line)",
                    }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* one quiet legal line: copyright + the legal-page links, with the
            Proudly Canadian badge opposite */}
        <div className="mx-auto flex max-w-[72rem] flex-wrap items-center justify-between gap-x-6 gap-y-4 pb-10">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p
              className="text-[12px]"
              style={{ color: "var(--cf-recall-ink-faint)" }}
            >
              © {year} {CHAPTERFLOW_NAME}. All rights reserved.
            </p>
            <nav aria-label="Legal">
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="rounded text-[12px] font-medium underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      style={{
                        color: "var(--cf-recall-ink-soft)",
                        // @ts-expect-error -- CSS custom property for the focus ring color
                        "--tw-ring-color": "var(--cf-recall-accent-line)",
                      }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          {/* the Proudly Canadian flag badge: a small SVG flag (token-filled) */}
          <span
            className="cf-recall-canadian inline-flex items-center gap-2 text-[12px]"
            style={{ color: "var(--cf-recall-ink-soft)" }}
          >
            <svg width="26" height="14" viewBox="0 0 48 24" aria-hidden="true">
              <rect width="48" height="24" fill="var(--cf-recall-flag-white)" />
              <rect width="12" height="24" fill="var(--cf-recall-flag-red)" />
              <rect x="36" width="12" height="24" fill="var(--cf-recall-flag-red)" />
              <g
                transform="translate(24,12.5) scale(0.026) translate(-256,-300)"
                fill="var(--cf-recall-flag-red)"
              >
                <path d="M383.8 351.7c1-1 105-90.7 105-90.7l-23.2-9.1c-9.1-3.6-6.4-9.1-4.5-18.2l13.6-49.9-46.3 9.1c-4.5.9-7.6-1.8-8.5-5.4l-6.4-20-35.4 39.9c-5.4 6.4-15.4 6.4-12.7-7.3l15.4-81.6-24.5 13.6c-6.4 3.6-12.7 4.5-16.3-3.6L256 70l-37.2 71.5c-2.7 5.4-7.3 5.4-12.7 2.7l-23.6-12.7 15.4 80.7c1.8 10-3.6 14.5-12.7 5.4l-34.5-38.1-7.3 21.8c-1.8 4.5-5.4 5.4-9.1 4.5l-44.5-9.1 13.6 49.9c1.8 7.3 3.6 13.6-4.5 17.2L62 320s103.1 89.8 105 90.7c4.5 2.7 6.4 6.4 4.5 12.7l-9.1 30 87.1-7.3c2.7 0 7.3 1.8 7.3 5.4l-3.6 89.8h25.4l-2.7-89.8c0-3.6 3.6-5.4 7.3-5.4l86.2 7.3-9.1-30c-1.8-6.4 0-10 5.4-12.7z" />
              </g>
            </svg>
            Proudly Canadian
          </span>
        </div>
      </div>
    </footer>
  );
}
