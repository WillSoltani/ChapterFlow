"use client";

import { useRef } from "react";
import Link from "next/link";
import { m, useScroll, useTransform } from "framer-motion";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { PhoneReaderShell } from "@/components/landing/reader-demo/PhoneReaderShell";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
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
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Subtle scroll parallax — applied ONLY to the non-LCP right column (phone +
  // ambient glow), never the headline (the LCP candidate). transform-only, and
  // disabled entirely under reduced motion.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, -56]);
  const glowY = useTransform(scrollYProgress, [0, 1], [0, -96]);

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="relative min-h-[85vh] pt-24 lg:pt-28 pb-12 lg:pb-16 overflow-hidden"
    >
      {/* Background radial gradient for atmospheric depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 30% 50%, color-mix(in srgb, var(--accent-cyan) 9%, transparent), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[60%_40%] gap-12 lg:gap-8 items-center">
          {/* Left column — text (DOM-first so the headline always leads on mobile) */}
          <m.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.12, delayChildren: 0.08 },
              },
            }}
          >
            {/* Eyebrow badge */}
            <m.div variants={fadeUp}>
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
            </m.div>

            {/* Headline — one oversized, fluid display line (the LCP element) */}
            <m.h1
              className="mt-5 flex flex-col font-bold leading-[1.04]"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.5rem, 7vw, 4.75rem)",
                letterSpacing: "-0.03em",
              }}
              variants={fadeUp}
            >
              <span style={{ color: "var(--text-heading)" }}>
                Stop forgetting
              </span>
              <span
                className="bg-clip-text text-transparent"
                style={{
                  // Light mode: --accent-cyan is a dark teal, so a 35% white mix
                  // pushed the lightest glyph below the 3:1 large-text floor.
                  // 15% lifts it clear (~4:1) while keeping the base on
                  // --accent-cyan (bright cyan in dark) so the dark headline stays
                  // a luminous cyan sweep.
                  backgroundImage:
                    "linear-gradient(135deg, var(--accent-cyan), color-mix(in srgb, var(--accent-cyan), white 15%))",
                  WebkitBackgroundClip: "text",
                }}
              >
                what you read.
              </span>
            </m.h1>

            {/* Subheadline — one-glance value contract: the mechanism, named */}
            <m.p
              className="mt-5 text-[17px] md:text-[18px] font-normal leading-[1.65] max-w-[480px]"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--text-secondary)",
              }}
              variants={fadeUp}
            >
              Most of what you read fades within weeks. ChapterFlow turns every
              chapter into a short loop &mdash; read it, prove it, unlock the
              next &mdash; so the ideas actually stick.
            </m.p>

            {/* Primary CTA — magnetic, tactile, not throbbing */}
            <m.div className="mt-7" variants={fadeUp}>
              <MagneticButton className="rounded-full">
                <Link
                  href={AUTH_LOGIN_BOOK_URL}
                  onClick={() => track("cta_click", { source: "hero_primary" })}
                  className="cta-shine inline-flex items-center rounded-full px-8 py-4 font-semibold text-[16px] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
                  style={{
                    backgroundColor: "var(--accent-cyan)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  Start reading free &rarr;
                </Link>
              </MagneticButton>
            </m.div>

            {/* Risk-reversal trust line */}
            <m.p
              className="mt-4 text-[13px]"
              style={{ color: "var(--text-muted)" }}
              variants={fadeUp}
            >
              No credit card &middot; {FREE_OFFER_LABEL} &middot; cancel anytime
            </m.p>
          </m.div>

          {/* Right column — phone mockup (parallax target; never the LCP) */}
          <m.div
            className="relative"
            style={prefersReducedMotion ? undefined : { y: phoneY }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.8,
              delay: 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {/* Soft ambient teal glow behind the phone (parallaxes a touch
                more). Centered via negative margins — NOT a CSS translate — so
                framer's parallax `y` owns the transform without clobbering it. */}
            <m.div
              className="absolute top-1/2 left-1/2 pointer-events-none"
              aria-hidden
              style={{
                width: 440,
                height: 440,
                marginLeft: -220,
                marginTop: -220,
                y: prefersReducedMotion ? 0 : glowY,
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--accent-cyan) 12%, transparent) 0%, transparent 70%)",
                filter: "blur(64px)",
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
          </m.div>
        </div>
      </div>
    </section>
  );
}
