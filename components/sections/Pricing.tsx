"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";

/* ------------------------------------------------------------------ */
/*  Inline icons                                                      */
/* ------------------------------------------------------------------ */

function CheckIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[--accent-green]/15">
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className="text-[--accent-green]"
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
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[--text-muted]/10">
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        className="text-[--text-muted]"
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
      className="shrink-0 text-[--text-muted]"
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
      "Yes. Cancel your Pro subscription anytime from your account settings. If you cancel during your 14-day trial, you won\u2019t be charged at all.",
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
      "Yes. ChapterFlow is available on iOS and Android. Your progress syncs across all devices.",
  },
];

/* ------------------------------------------------------------------ */
/*  Pricing component                                                 */
/* ------------------------------------------------------------------ */

export function Pricing() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  /* ---- Free features ---- */
  const freeFeatures = [
    "Access to the full book library",
    "Finish up to 2 books",
    "Simple and Standard depth modes",
    "Chapter summaries and scenarios",
    "Chapter quizzes",
  ];
  const freeMissing = ["Deeper depth mode", "Unlimited books"];

  /* ---- Pro features ---- */
  const proFeatures = [
    "Access to the full book library",
    "Unlimited books",
    "Simple and Standard depth modes",
    "Chapter summaries and scenarios",
    "Chapter quizzes",
    "Deeper depth mode",
    "Priority new title requests",
  ];

  return (
    <section id="pricing" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4">
        {/* ---- Intro ---- */}
        <SectionReveal>
          <div className="text-center">
            <SectionLabel>PRICING</SectionLabel>

            <h2
              className="mt-4 text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[1.1] tracking-[-0.02em] text-[--text-heading]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Start free. Go deeper when you&apos;re ready.
            </h2>

            <p
              className="mt-3 text-[--text-secondary]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              No annual lock-in. No confusing tiers. Two plans, one purpose.
            </p>

            <p
              className="mt-2 text-[14px] text-[--text-muted]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              The average non-fiction book costs $18. ChapterFlow Pro gives you
              unlimited structured access for less.
            </p>
          </div>
        </SectionReveal>

        {/* ---- Pricing cards ---- */}
        <div className="mt-10 flex flex-col md:flex-row gap-6 justify-center items-center md:items-stretch">
          {/* FREE card */}
          <SectionReveal delay={0.1}>
            <div
              className="relative flex flex-col bg-[--bg-glass] border border-[--border-subtle] rounded-xl p-8 w-full max-w-[380px]"
              style={{ backdropFilter: "blur(12px)" }}
            >
              <span className="text-[12px] uppercase tracking-[0.1em] text-[--text-secondary] font-semibold">
                Free
              </span>

              <span
                className="mt-4 text-[48px] font-bold leading-none text-[--text-heading]"
                style={{ fontFamily: "var(--font-jetbrains)" }}
              >
                $0
              </span>

              <p
                className="mt-3 text-[14px] text-[--text-secondary]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Try ChapterFlow with two complete books.
              </p>

              <hr className="my-6 border-[--border-subtle]" />

              {/* Features */}
              <ul className="flex flex-col gap-3 flex-1">
                {freeFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-[14px] text-[--text-secondary]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    <CheckIcon />
                    {f}
                  </li>
                ))}
                {freeMissing.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-[14px] text-[--text-muted]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    <DashIcon />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href="/auth/login?returnTo=%2Fbook"
                className="mt-8 block w-full text-center border border-[--border-medium] text-[--text-heading] hover:bg-[--bg-glass] rounded-xl py-3.5 font-semibold transition-colors"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Start reading free
              </Link>
            </div>
          </SectionReveal>

          {/* PRO card */}
          <SectionReveal delay={0.2}>
            <div
              className="relative flex flex-col bg-[--bg-glass] border border-[--accent-teal]/25 rounded-xl p-8 w-full max-w-[380px]"
              style={{
                backdropFilter: "blur(12px)",
                boxShadow: "0 0 30px rgba(45,212,191,0.1)",
              }}
            >
              {/* Badge */}
              <span className="absolute -top-3.5 right-5 bg-[--accent-teal] text-[#0a0f1a] text-[12px] font-semibold px-3.5 py-1 rounded-full">
                Most popular
              </span>

              <span className="text-[12px] uppercase tracking-[0.1em] text-[--accent-teal] font-semibold">
                Pro
              </span>

              <div className="mt-4 flex items-baseline">
                <span
                  className="text-[48px] font-bold leading-none text-[--text-heading]"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  $7.99
                </span>
                <span className="ml-1 text-[16px] text-[--text-muted]">
                  CAD / month
                </span>
              </div>

              <p className="mt-1 text-[13px] text-[--accent-teal]">
                That&apos;s $0.26/day
              </p>

              <p
                className="mt-3 text-[14px] text-[--text-secondary]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Unlimited books and the deepest reading mode.
              </p>

              <hr className="my-6 border-[--border-subtle]" />

              {/* Features */}
              <ul className="flex flex-col gap-3 flex-1">
                {proFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-[14px] text-[--text-secondary]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href="/auth/login?returnTo=%2Fbook"
                className="mt-8 block w-full text-center bg-[--accent-teal] text-[#0a0f1a] rounded-xl py-3.5 font-semibold transition-transform hover:scale-[1.02]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Try Pro free for 14 days
              </Link>

              <p
                className="mt-2 text-[12px] text-[--text-muted] text-center"
                style={{ fontFamily: "var(--font-body)" }}
              >
                No credit card required. Cancel before 14 days and you&apos;ll
                never be charged.
              </p>
            </div>
          </SectionReveal>
        </div>

        {/* ---- FAQ Accordion ---- */}
        <SectionReveal delay={0.3}>
          <div className="max-w-2xl mx-auto mt-16">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-[--border-subtle]">
                <button
                  onClick={() => toggleFaq(index)}
                  className="flex w-full items-center justify-between py-4 text-left"
                >
                  <span
                    className="text-[16px] text-[--text-heading] font-medium"
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
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p
                        className="pb-4 text-[14px] text-[--text-secondary] leading-[1.6]"
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
