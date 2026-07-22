"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

interface BookRequestSuccessProps {
  title: string;
  author?: string;
  email: string;
}

export function BookRequestSuccess({ title, author, email }: BookRequestSuccessProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      className="flex flex-col items-center text-center"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.3 }}
    >
      {/* Checkmark circle */}
      <motion.div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "var(--accent-cyan)" }}
        initial={reducedMotion ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 12 }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </motion.div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex flex-col items-center"
      >
        {/* Heading */}
        <p
          className="text-lg font-semibold mt-4"
          style={{
            color: "var(--accent-cyan)",
            fontFamily: "var(--font-display)",
          }}
        >
          Request received
        </p>

        {/* Confirmation message — honest: we log it and email only if we build it */}
        <p
          className="text-cf-body-sm mt-2 max-w-[340px]"
          style={{ color: "var(--text-secondary)" }}
        >
          We have logged &lsquo;{title}&rsquo;{author ? ` by ${author}` : ""}. If we
          add it to the library, we will email you at {email}.
        </p>
      </div>

      {/* CTA — start reading what's already available (matches the site's primary CTA) */}
      <Link
        href="/auth/login?returnTo=%2Fbook"
        className="cta-shine mt-5 inline-flex min-h-11 items-center gap-1 rounded-full px-6 py-2.5 text-cf-body-sm font-semibold transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
        style={{
          backgroundColor: "var(--accent-cyan)",
          color: "var(--primary-foreground)",
          fontFamily: "var(--font-body)",
        }}
      >
        Start reading free &rarr;
      </Link>

      {/* Secondary — browse what's available now */}
      <Link
        href="/books"
        className="mt-3 text-cf-label-sm hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2 rounded"
        style={{ color: "var(--text-muted)" }}
      >
        Browse the books we already have &rarr;
      </Link>
    </motion.div>
  );
}
