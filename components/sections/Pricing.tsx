"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";
import { useAuthStatus } from "@/components/auth/useAuthStatus";
import { PRICING, ANNUAL_SAVINGS_PCT, formatAmount, TRIAL_CTA_LABEL } from "@/lib/pricing";

/* ------------------------------------------------------------------ */
/*  Inline icons                                                      */
/* ------------------------------------------------------------------ */

function CheckIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--accent-green)/15">
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className="text-(--accent-green)"
      >
        <path
          d="M2.5 6.5L4.5 8.5L9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function DashIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--text-muted)/10">
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        className="text-(--text-muted)"
      >
        <path
          d="M2.5 5H7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <motion.svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className="shrink-0 text-(--text-muted)"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ data                                                          */
/* ------------------------------------------------------------------ */

const faqs = [
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes \u2014 cancel anytime from your account settings, with no penalties or lock-in. Cancel during your 14-day free trial and you won't be charged. Cancel after, and your Pro access continues until the end of the period you've already paid for; the remaining time isn't refunded.",
  },
  {
    question: "What happens after my 2 free books?",
    answer:
      "You can still browse summaries and access your completed books. To unlock new books, upgrade to Pro.",
  },
  {
    question: "Do you add new books?",
    answer:
      "Yes. We add new titles regularly. Pro members can request specific books and get priority additions.",
  },
  {
    question: "Is there a mobile app?",
    answer:
      "ChapterFlow works beautifully on any device through your browser. A dedicated mobile app is on the roadmap.",
  },
];

/* ------------------------------------------------------------------ */
/*  Pricing component                                                 */
/* ------------------------------------------------------------------ */

export function Pricing() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const { loggedIn } = useAuthStatus();
  const freeHref = loggedIn ? "/book" : AUTH_LOGIN_BOOK_URL;
  const proHref = loggedIn ? "/book/settings" : AUTH_LOGIN_BOOK_URL;
  const perMonthAmount = isAnnual ? PRICING.annualMonthlyAmount : PRICING.monthlyAmount;
  const annualTotal = formatAmount(PRICING.annualMonthlyAmount * 12);

  const toggleFaq = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  /* ---- Free features ---- */
  const freeFeatures = [
    "Access to the full book library",
    "Finish up to 2 books",
    "Lite and Standard depth modes",
    "Chapter summaries and scenarios",
    "Chapter quizzes",
  ];
  const freeMissing = ["Deeper depth mode", "Unlimited books"];

  /* ---- Pro features ---- */
  const proFeatures = [
    "Access to the full book library",
    "Unlimited books",
    "Lite and Standard depth modes",
    "Chapter summaries and scenarios",
    "Chapter quizzes",
    "Deeper depth mode",
    "Priority new title requests",
  ];

  return (
    <section id="pricing" className="pt-14 pb-6 lg:pt-20 lg:pb-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* ---- Intro ---- */}
        <SectionReveal>
          <div className="text-center">
            <SectionLabel>PRICING</SectionLabel>

            <h2
              className="mt-4 text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[1.1] tracking-[-0.02em] text-(--text-heading)"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Start free. Go deeper when you&apos;re ready.
            </h2>

            <p
              className="mt-3 text-(--text-secondary)"
              style={{ fontFamily: "var(--font-body)" }}
            >
              No annual lock-in. No confusing tiers. Two plans, one purpose.
            </p>

            <p
              className="mt-2 text-[14px] text-(--text-muted)"
              style={{ fontFamily: "var(--font-body)" }}
            >
              The average non-fiction book costs $18. ChapterFlow Pro gives you
              unlimited structured access for less.
            </p>
          </div>
        </SectionReveal>

        {/* ---- Billing toggle ---- */}
        <SectionReveal delay={0.05}>
          <div className="mt-8 flex items-center justify-center gap-3">
            <span
              className="text-[14px] transition-colors"
              style={{ color: isAnnual ? "var(--text-muted)" : "var(--text-heading)" }}
            >
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual((v) => !v)}
              role="switch"
              aria-checked={isAnnual}
              aria-label="Toggle annual pricing"
              className="relative w-12 h-6 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
              style={{ background: isAnnual ? "var(--accent-teal)" : "var(--bg-elevated)" }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: isAnnual ? "translateX(26px)" : "translateX(2px)" }}
              />
            </button>
            <span
              className="text-[14px] transition-colors"
              style={{ color: isAnnual ? "var(--text-heading)" : "var(--text-muted)" }}
            >
              Annual
              <span
                className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ color: "var(--accent-teal)", background: "rgba(34,211,238,0.1)" }}
              >
                Save {ANNUAL_SAVINGS_PCT}%
              </span>
            </span>
          </div>
        </SectionReveal>

        {/* ---- Pricing cards ---- */}
        <div className="mt-8 flex flex-col md:flex-row gap-6 justify-center items-center md:items-stretch">
          {/* FREE card */}
          <SectionReveal delay={0.1}>
            <div
              className="relative flex flex-col bg-(--bg-glass) border border-(--border-subtle) rounded-xl p-8 w-full max-w-[380px]"
              style={{ backdropFilter: "blur(12px)" }}
            >
              <span className="text-[12px] uppercase tracking-[0.1em] text-(--text-secondary) font-semibold">
                Free
              </span>

              <span
                className="mt-4 text-[48px] font-bold leading-none text-(--text-heading)"
                style={{ fontFamily: "var(--font-jetbrains)" }}
              >
                $0
              </span>

              <p
                className="mt-3 text-[14px] text-(--text-secondary)"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Try ChapterFlow with two complete books.
              </p>

              <hr className="my-6 border-(--border-subtle)" />

              {/* Features */}
              <ul className="flex flex-col gap-3 flex-1">
                {freeFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-[14px] text-(--text-secondary)"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    <CheckIcon />
                    {f}
                  </li>
                ))}
                {freeMissing.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-[14px] text-(--text-muted)"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    <DashIcon />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={freeHref}
                onClick={() => track("cta_click", { source: "pricing_free" })}
                className="mt-8 block w-full text-center border border-(--border-medium) text-(--text-heading) hover:bg-(--bg-glass) rounded-xl py-3.5 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Get 2 free books
              </Link>
            </div>
          </SectionReveal>

          {/* PRO card */}
          <SectionReveal delay={0.2}>
            <div
              className="relative flex flex-col rounded-xl p-8 w-full max-w-[380px] scale-[1.02]"
              style={{
                backdropFilter: "blur(12px)",
                background: "var(--bg-glass)",
                border: "1px solid rgba(34,211,238,0.35)",
                boxShadow: "0 0 40px rgba(34,211,238,0.12), 0 0 80px rgba(34,211,238,0.04)",
              }}
            >
              {/* Badge */}
              <span
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 text-[11px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-full whitespace-nowrap"
                style={{
                  background: "var(--accent-teal)",
                  color: "var(--primary-foreground)",
                  boxShadow: "0 4px 14px rgba(34,211,238,0.35), 0 0 0 1px rgba(34,211,238,0.5)",
                }}
              >
                Most popular
              </span>

              <span className="text-[12px] uppercase tracking-[0.1em] text-(--accent-teal) font-semibold">
                Pro
              </span>

              <div className="mt-4 flex items-baseline">
                <span
                  className="text-[48px] font-bold leading-none text-(--text-heading)"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  {formatAmount(perMonthAmount)}
                </span>
                <span className="ml-1 text-[16px] text-(--text-muted)">
                  {PRICING.currency} / month{isAnnual ? " · billed annually" : ""}
                </span>
              </div>

              <p className="mt-1 text-[13px] text-(--accent-teal)">
                That&apos;s {formatAmount(perMonthAmount / 30)}/day
                {isAnnual && (
                  <span className="text-(--text-muted)"> &middot; {annualTotal} {PRICING.currency} billed today</span>
                )}
              </p>

              <p
                className="mt-3 text-[14px] text-(--text-secondary)"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Unlimited books and the deepest reading mode.
              </p>

              <hr className="my-6 border-(--border-subtle)" />

              {/* Features */}
              <ul className="flex flex-col gap-3 flex-1">
                {proFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-[14px] text-(--text-secondary)"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>

              <p
                className="mt-6 mb-3 text-[12px] text-(--text-muted) text-center leading-[1.6]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {PRICING.trialDays}-day free trial, then {formatAmount(perMonthAmount)}{" "}
                {PRICING.currency}/month
                {isAnnual ? ` (${annualTotal} ${PRICING.currency} billed annually)` : ""}. A card
                is required; you won&apos;t be charged until the trial ends, and you can cancel
                anytime before then.{" "}
                <Link
                  href="/legal/refund"
                  className="underline hover:text-(--text-secondary)"
                >
                  Refund policy
                </Link>
                .
              </p>

              {/* CTA */}
              <Link
                href={proHref}
                onClick={() => track("cta_click", { source: "pricing_pro" })}
                className="block w-full text-center bg-(--accent-teal) text-primary-foreground rounded-xl py-3.5 font-semibold transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {TRIAL_CTA_LABEL}
              </Link>
            </div>
          </SectionReveal>
        </div>

        {/* ---- FAQ Accordion ---- */}
        <SectionReveal delay={0.3}>
          <div className="max-w-2xl mx-auto mt-10">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-(--border-subtle)">
                <button
                  onClick={() => toggleFaq(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleFaq(index);
                    }
                  }}
                  aria-expanded={openIndex === index}
                  aria-controls={`faq-answer-${index}`}
                  className="flex w-full items-center justify-between py-4 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
                >
                  <span
                    className="text-[16px] text-(--text-heading) font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {faq.question}
                  </span>
                  <ChevronIcon open={openIndex === index} />
                </button>

                <AnimatePresence initial={false}>
                  {openIndex === index && (
                    <motion.div
                      key="answer"
                      id={`faq-answer-${index}`}
                      role="region"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p
                        className="pb-4 text-[14px] text-(--text-secondary) leading-[1.6]"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
