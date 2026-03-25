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

          {/* App store badges */}
          <div className="flex flex-row gap-3 justify-center mt-8">
            {/* Apple App Store */}
            <a
              href="/coming-soon"
              className="group flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background:
                  "var(--bg-glass)",
                border: "1px solid var(--border-subtle)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <svg
                width="20"
                height="24"
                viewBox="0 0 20 24"
                fill="none"
                className="shrink-0"
              >
                <path
                  d="M16.52 12.76c-.03-2.86 2.34-4.24 2.44-4.3-1.33-1.94-3.4-2.21-4.13-2.24-1.76-.18-3.43 1.04-4.32 1.04-.9 0-2.28-1.01-3.74-.99-1.93.03-3.7 1.12-4.7 2.85-2 3.47-.51 8.62 1.44 11.44.96 1.38 2.1 2.93 3.6 2.88 1.44-.06 1.99-.93 3.73-.93 1.74 0 2.24.93 3.76.9 1.55-.02 2.53-1.41 3.47-2.8 1.1-1.6 1.55-3.15 1.57-3.23-.03-.01-3.02-1.16-3.05-4.6l-.07-.02z"
                  fill="var(--text-heading)"
                />
                <path
                  d="M13.65 4.26c.79-.96 1.33-2.3 1.18-3.63-1.14.05-2.52.76-3.34 1.71-.73.85-1.37 2.2-1.2 3.5 1.28.1 2.58-.65 3.36-1.58z"
                  fill="var(--text-heading)"
                />
              </svg>
              <div className="flex flex-col leading-none">
                <span className="text-[9px] text-[--text-muted] font-medium">
                  Download on the
                </span>
                <span className="text-[14px] text-[--text-heading] font-semibold tracking-tight mt-0.5">
                  App Store
                </span>
              </div>
            </a>

            {/* Google Play */}
            <a
              href="/coming-soon"
              className="group flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background:
                  "var(--bg-glass)",
                border: "1px solid var(--border-subtle)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <svg
                width="20"
                height="22"
                viewBox="0 0 20 22"
                fill="none"
                className="shrink-0"
              >
                <path
                  d="M1.22 0.27C0.93 0.57 0.75 1.05 0.75 1.67V20.33C0.75 20.95 0.93 21.43 1.22 21.73L1.3 21.81L11.68 11.43V11V10.57L1.3 0.19L1.22 0.27Z"
                  fill="#4285F4"
                />
                <path
                  d="M15.14 14.89L11.68 11.43V11V10.57L15.14 7.11L15.24 7.17L19.32 9.49C20.49 10.15 20.49 11.24 19.32 11.9L15.24 14.22L15.14 14.89Z"
                  fill="#FBBC04"
                />
                <path
                  d="M15.24 14.83L11.68 11.27L1.22 21.73C1.62 22.16 2.29 22.21 3.05 21.78L15.24 14.83Z"
                  fill="#EA4335"
                />
                <path
                  d="M15.24 7.17L3.05 0.22C2.29-0.21 1.62-0.16 1.22 0.27L11.68 10.73L15.24 7.17Z"
                  fill="#34A853"
                />
              </svg>
              <div className="flex flex-col leading-none">
                <span className="text-[9px] text-[--text-muted] font-medium">
                  Get it on
                </span>
                <span className="text-[14px] text-[--text-heading] font-semibold tracking-tight mt-0.5">
                  Google Play
                </span>
              </div>
            </a>
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}
