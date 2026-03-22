"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { PhoneScreenContent } from "@/components/landing/PhoneScreenContent";

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

function PulseCTA({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false });
  const [shouldPulse, setShouldPulse] = useState(false);

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => setShouldPulse(true), 3000);
      return () => clearTimeout(timer);
    } else {
      setShouldPulse(false);
    }
  }, [isInView]);

  return (
    <motion.div
      ref={ref}
      className={className}
      animate={
        shouldPulse
          ? {
              boxShadow: [
                "0 0 0 0 rgba(45, 212, 191, 0)",
                "0 0 0 8px rgba(45, 212, 191, 0.15)",
                "0 0 0 0 rgba(45, 212, 191, 0)",
              ],
            }
          : {}
      }
      transition={
        shouldPulse
          ? { duration: 2.5, repeat: Infinity, repeatDelay: 1 }
          : {}
      }
      style={{ borderRadius: 9999 }}
    >
      {children}
    </motion.div>
  );
}

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
            "radial-gradient(ellipse at 30% 50%, rgba(45,212,191,0.08), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-12 lg:gap-8 items-center">
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
                  color: "var(--accent-teal)",
                  backgroundColor: "rgba(45,212,191,0.08)",
                  borderColor: "rgba(45,212,191,0.2)",
                }}
              >
                <span className="text-[14px]">&#10022;</span>
                Trusted by early readers worldwide
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
                    "linear-gradient(135deg, var(--accent-teal), #5eead4)",
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
              ChapterFlow turns every chapter into a 20-minute learning loop.
              Read the key ideas, see them applied, prove you retained them
              &mdash; then move on.
            </motion.p>

            {/* Primary CTA */}
            <motion.div className="mt-6" variants={fadeUp}>
              <PulseCTA className="inline-block">
                <Link
                  href="/auth/login?returnTo=%2Fbook"
                  className="cta-shine inline-flex items-center rounded-full px-8 py-4 font-semibold text-[16px] transition-transform hover:scale-[1.03] active:scale-[0.98]"
                  style={{
                    backgroundColor: "var(--accent-teal)",
                    color: "#0a0f1a",
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
              No credit card &middot; 2 full books free &middot; Cancel anytime
            </motion.p>

            {/* Micro testimonial */}
            <motion.div
              className="mt-4 flex items-center gap-2.5"
              variants={fadeUp}
            >
              {/* Avatar placeholder */}
              <div
                className="w-6 h-6 rounded-full flex-shrink-0"
                style={{ backgroundColor: "var(--bg-elevated)" }}
              />
              <p
                className="text-[13px] italic"
                style={{ color: "var(--text-muted)" }}
              >
                &ldquo;I actually remember what I read now.&rdquo; &mdash;
                Sarah&nbsp;K., early reader
              </p>
            </motion.div>
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
                  "radial-gradient(circle, rgba(45,212,191,0.10) 0%, transparent 70%)",
                filter: "blur(60px)",
              }}
            />

            <PhoneMockup>
              <PhoneScreenContent />
            </PhoneMockup>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
