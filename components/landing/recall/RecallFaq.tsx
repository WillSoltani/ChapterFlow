"use client";

/**
 * RecallFaq — STEP 5.5 · § "Questions, answered" (objection handling, above pricing).
 *
 * A quiet, hairline-ruled accordion in the recall language: ONE row open at a
 * time, the question in the display face, a single periwinkle focus ring, the
 * answer revealed with a reduced-motion-safe grid-rows expand. Collapsed answers
 * are `inert` so their content stays out of the tab order + a11y tree. Copy +
 * FAQPage schema both come from recall-faq-data (single source of truth).
 *
 * Token-only DOM color; client component (accordion open-state). Wrapped in
 * <RecallReveal> by app/page.tsx for the scroll-in, exactly like the siblings.
 */

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { RECALL_FAQ } from "./recall-faq-data";

export function RecallFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();

  return (
    <section
      id="faq"
      aria-labelledby="recall-faq-headline"
      className="relative w-full px-6 py-28 sm:px-10 sm:py-32 lg:px-16 lg:py-40"
      style={{ background: "transparent" }}
    >
      <div className="mx-auto w-full max-w-[48rem]">
        {/* ── Editorial header, centered (mirrors the other recall sections) ── */}
        <header className="mx-auto max-w-[40rem] text-center">
          <p
            className="cf-fade-up font-(family-name:--font-mono) text-cf-caption uppercase tracking-[0.34em]"
            style={{ color: "var(--cf-recall-ink-faint)", animationDelay: "0ms" }}
          >
            Before you start
          </p>
          <h2
            id="recall-faq-headline"
            className="cf-fade-up mt-6 font-(family-name:--font-display) font-bold leading-[0.98] tracking-[-0.04em] text-balance"
            style={{
              color: "var(--cf-recall-ink)",
              fontSize: "clamp(2.25rem, 4.2vw, 3.5rem)",
              animationDelay: "55ms",
            }}
          >
            Questions, answered.
          </h2>
        </header>

        {/* ── The accordion: hairline-ruled rows, one open at a time ── */}
        <ul
          className="cf-fade-up mt-14 sm:mt-16"
          style={{
            borderTop: "1px solid var(--cf-recall-frame)",
            animationDelay: "110ms",
          }}
        >
          {RECALL_FAQ.map((item, i) => {
            const open = openIndex === i;
            const qId = `${baseId}-q-${i}`;
            const aId = `${baseId}-a-${i}`;
            return (
              <li
                key={item.q}
                style={{ borderBottom: "1px solid var(--cf-recall-frame)" }}
              >
                {/* h3 wrapper gives each trigger heading semantics so SR users can
                    jump between questions (WAI-ARIA accordion pattern); the visual
                    styling lives on the inner span, and the h3 is layout-neutral
                    (Tailwind preflight resets its size/weight/margin). */}
                <h3 className="m-0">
                  <button
                    type="button"
                    id={qId}
                    aria-expanded={open}
                    aria-controls={aId}
                    onClick={() => setOpenIndex(open ? null : i)}
                    className="flex w-full items-center justify-between gap-5 rounded py-5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:py-6"
                    style={{
                      // @ts-expect-error -- CSS custom property for the focus ring color
                      "--tw-ring-color": "var(--cf-recall-accent-line)",
                    }}
                  >
                    <span
                      className="font-(family-name:--font-display) text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] sm:text-[1.1875rem]"
                      style={{ color: "var(--cf-recall-ink)" }}
                    >
                      {item.q}
                    </span>
                    <ChevronDown
                      size={20}
                      strokeWidth={2}
                      aria-hidden
                      className={`rl-faq-chevron shrink-0 ${open ? "rl-faq-chevron-open" : ""}`}
                      style={{ color: "var(--cf-recall-ink-faint)" }}
                    />
                  </button>
                </h3>
                {/* grid-rows 0fr→1fr expand (reduced-motion snaps); inner clips.
                    The panel is a named region tied back to its question, and
                    `inert` keeps it out of tab order + a11y tree while closed. */}
                <div className="rl-faq-answer" data-open={open}>
                  <div
                    id={aId}
                    role="region"
                    aria-labelledby={qId}
                    inert={!open}
                    className="overflow-hidden"
                  >
                    <p
                      className="max-w-[60ch] pb-6 text-[0.9375rem] leading-relaxed sm:text-[1rem]"
                      style={{ color: "var(--cf-recall-ink-soft)" }}
                    >
                      {item.a}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
