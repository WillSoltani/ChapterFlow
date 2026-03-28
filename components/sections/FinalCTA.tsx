"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";

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
                "0 0 0 0 rgba(34, 211, 238, 0)",
                "0 0 0 8px rgba(34, 211, 238, 0.15)",
                "0 0 0 0 rgba(34, 211, 238, 0)",
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

export function FinalCTA() {
  return (
    <section className="pt-6 pb-14 lg:pt-8 lg:pb-20 px-4">
      <SectionReveal>
        <div className="max-w-[640px] mx-auto text-center">
          <SectionLabel>START WITH ONE CHAPTER</SectionLabel>

          <h2
            className="mt-4 text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[1.1] tracking-[-0.02em]"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--text-heading)",
            }}
          >
            Pick a book. Read one chapter. Take the quiz.
          </h2>

          <p
            className="mt-2 text-[24px] md:text-[28px] font-bold"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--accent-teal)",
            }}
          >
            You&apos;ll know in 20 minutes.
          </p>

          <p
            className="mt-4 text-[16px] md:text-[18px] leading-[1.7]"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--text-secondary)",
            }}
          >
            No credit card. No commitment. Just one chapter to see if
            ChapterFlow changes how you read.
          </p>

          {/* CTA button */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <PulseCTA className="inline-block">
              <Link
                href="/auth/login?returnTo=%2Fbook"
                className="cta-shine inline-flex items-center rounded-full px-8 py-4 font-semibold text-[16px] transition-transform hover:scale-[1.03] active:scale-[0.98]"
                style={{
                  backgroundColor: "var(--accent-teal)",
                  color: "var(--primary-foreground)",
                }}
              >
                Start reading free &rarr;
              </Link>
            </PulseCTA>

            <Link
              href="/auth/login?returnTo=%2Fbook"
              className="text-[14px] font-medium transition-colors duration-200 hover:text-[--text-heading]"
              style={{ color: "var(--text-secondary)" }}
            >
              Sign in
            </Link>
          </div>

        </div>
      </SectionReveal>
    </section>
  );
}
