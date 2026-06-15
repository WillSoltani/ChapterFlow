"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { PhoneReaderShell } from "@/components/landing/reader-demo/PhoneReaderShell";
import { PulseCTA } from "@/components/landing/PulseCTA";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { FREE_OFFER_LABEL } from "@/lib/pricing";
import { track } from "@/lib/analytics";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-[85vh] pt-24 lg:pt-28 pb-12 lg:pb-16 overflow-hidden"
    >
      {/* Background radial gradient for atmospheric depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 30% 50%, color-mix(in srgb, var(--accent-cyan) 8%, transparent), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[60%_40%] gap-12 lg:gap-8 items-center">
          {/* Left column — text */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.15, delayChildren: 0.1 },
              },
            }}
          >
            {/* Eyebrow badge */}
            <motion.div variants={fadeUp}>
              <span
                className="inline-flex items-center gap-2 text-[11px] tracking-wider font-medium px-3.5 py-1.5 rounded-full border"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--accent-cyan)",
                  backgroundColor: "color-mix(in srgb, var(--accent-cyan) 8%, transparent)",
                  borderColor: "color-mix(in srgb, var(--accent-cyan) 20%, transparent)",
                }}
              >
                <span className="text-[14px]">&#10022;</span>
                Built on spaced repetition science
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="mt-4 flex flex-col text-[40px] md:text-[52px] lg:text-[64px] font-bold leading-[1.05]"
              style={{
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.025em",
              }}
              variants={fadeUp}
            >
              <span style={{ color: "var(--text-heading)" }}>
                Stop forgetting
              </span>
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, var(--accent-cyan), color-mix(in srgb, var(--accent-cyan), white 35%))",
                  WebkitBackgroundClip: "text",
                }}
              >
                what you read.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              className="mt-4 text-[17px] md:text-[18px] font-normal leading-[1.7] max-w-[500px]"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--text-secondary)",
              }}
              variants={fadeUp}
            >
              Research on the forgetting curve shows most readers lose much of
              a book within weeks. ChapterFlow turns every chapter into a
              structured loop that actually makes ideas stick &mdash; for good.
            </motion.p>

            {/* Primary CTA */}
            <motion.div className="mt-6" variants={fadeUp}>
              <PulseCTA className="inline-block">
                <Link
                  href={AUTH_LOGIN_BOOK_URL}
                  onClick={() => track("cta_click", { source: "hero_primary" })}
                  className="cta-shine inline-flex items-center rounded-full px-8 py-4 font-semibold text-[16px] transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
                  style={{
                    backgroundColor: "var(--accent-cyan)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  Start reading free &rarr;
                </Link>
              </PulseCTA>
            </motion.div>

            {/* Trust line */}
            <motion.p
              className="mt-4 text-[13px]"
              style={{ color: "var(--text-muted)" }}
              variants={fadeUp}
            >
              No credit card &middot; {FREE_OFFER_LABEL}
            </motion.p>
          </motion.div>

          {/* Right column — phone mockup */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.8,
              delay: 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {/* Soft ambient teal glow behind the phone */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                width: 420,
                height: 420,
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--accent-cyan) 10%, transparent) 0%, transparent 70%)",
                filter: "blur(60px)",
              }}
            />

            <figure>
              <figcaption className="sr-only">
                Reader interface preview: a chapter summary, a Lite/Standard/Deeper depth selector, and a quiz step that unlocks the next chapter.
              </figcaption>
              <PhoneMockup>
                <PhoneReaderShell />
              </PhoneMockup>
            </figure>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
