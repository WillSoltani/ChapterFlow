"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import {
  CATALOG_BOOK_COUNT_DISPLAY,
  CATALOG_CATEGORY_COUNT_DISPLAY,
} from "@/lib/catalog-stats";

/**
 * Proof band. Deliberately NOT testimonials — we don't have verifiable user
 * quotes, and inventing personas would violate the truth rule. Instead this
 * surfaces things we can stand behind: the method, the real catalog size
 * (from catalog-stats), and the honest free tier.
 */

type Proof = {
  icon: React.ReactNode;
  stat: string;
  title: string;
  body: string;
};

const PROOFS: Proof[] = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
    stat: "Prove it, then progress",
    title: "Active recall, not highlighting",
    body: "Every chapter ends with a quiz you have to pass to unlock the next one — the retrieval practice that actually moves ideas into long-term memory.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 5h16M4 12h16M4 19h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    stat: `${CATALOG_BOOK_COUNT_DISPLAY} books · ${CATALOG_CATEGORY_COUNT_DISPLAY} categories`,
    title: "One structure across the whole library",
    body: "Every title is rebuilt into the same four-step loop — summary, real-world scenario, quiz, unlock — so you always know how to read it.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 21l-4.9-2.6.9-5.5-4-3.9L9.5 8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
    stat: "2 full books free",
    title: "Try it before you pay anything",
    body: "Read two complete books end-to-end with no credit card. Upgrade to Pro only if the method works for you. Cancel anytime.",
  },
];

interface ProofCardProps {
  proof: Proof;
  index: number;
}

function ProofCard({ proof, index }: ProofCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const prefersReducedMotion = useReducedMotion();

  const initial = prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 };
  const animate =
    prefersReducedMotion || isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 };

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={animate}
      transition={{ duration: 0.7, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="bg-(--bg-glass) backdrop-blur-[16px] border border-(--border-subtle) rounded-xl p-6 md:p-8 text-left"
    >
      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-(--accent-teal)"
        style={{
          background: "color-mix(in srgb, var(--accent-cyan) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent-cyan) 25%, transparent)",
        }}
        aria-hidden="true"
      >
        {proof.icon}
      </div>

      {/* Stat */}
      <p
        className="text-[15px] font-bold mt-4 text-(--accent-teal)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {proof.stat}
      </p>

      {/* Title */}
      <h3 className="text-[16px] font-semibold mt-2 text-(--text-heading) font-(family-name:--font-display)">
        {proof.title}
      </h3>

      {/* Body */}
      <p className="text-[14px] text-(--text-secondary) leading-[1.6] mt-2 font-(family-name:--font-body)">
        {proof.body}
      </p>
    </motion.div>
  );
}

export function SocialProof() {
  return (
    <section id="why-it-works" className="py-14 lg:py-20 max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="text-center">
        <SectionReveal>
          <SectionLabel>WHY IT WORKS</SectionLabel>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <h2 className="text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[1.1] tracking-[-0.02em] text-(--text-heading) font-(family-name:--font-display) max-w-2xl mx-auto mt-4">
            No magic. Just the method that makes ideas stick.
          </h2>
        </SectionReveal>
      </div>

      {/* Proof Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        {PROOFS.map((proof, i) => (
          <ProofCard key={proof.title} proof={proof} index={i} />
        ))}
      </div>

      {/* Credibility line */}
      <SectionReveal delay={0.4}>
        <p className="text-[14px] text-(--text-muted) max-w-lg mx-auto text-center mt-10">
          Built on spaced repetition and active recall — the same retrieval-practice
          science behind tools like Anki and Duolingo.
        </p>
      </SectionReveal>
    </section>
  );
}
