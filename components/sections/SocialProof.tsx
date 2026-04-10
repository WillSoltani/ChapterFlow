"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";

const testimonials = [
  {
    name: "Sarah K.",
    context: "Senior product manager",
    role: "Reads 2 books a month",
    quote:
      "I've tried Blinkist, I've tried highlighting — nothing stuck. ChapterFlow's quiz step is what changed everything. I actually retained a whole book for the first time.",
    stars: 5,
    initials: "SK",
  },
  {
    name: "Marcus T.",
    context: "PhD candidate, neuroscience",
    role: "Studying spaced repetition",
    quote:
      "One chapter on my commute. Fifteen minutes and I still remember it weeks later. Replaced my entire notes system.",
    stars: 5,
    initials: "MT",
  },
  {
    name: "Priya R.",
    context: "Founder, early-stage startup",
    role: "Reads on the train",
    quote:
      "$8 a month for books I actually retain? My only wish is they had more sci-fi. The non-fiction library is excellent though.",
    stars: 4,
    initials: "PR",
  },
];

function StarIcon() {
  return (
    <svg
      className="w-4 h-4"
      style={{ fill: "var(--accent-teal)" }}
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

interface TestimonialCardProps {
  name: string;
  context: string;
  role: string;
  quote: string;
  stars: number;
  initials: string;
  index: number;
}

function TestimonialCard({
  name,
  context,
  role,
  quote,
  stars,
  initials,
  index,
}: TestimonialCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const prefersReducedMotion = useReducedMotion();

  const initial = prefersReducedMotion
    ? { opacity: 1, y: 0 }
    : { opacity: 0, y: 24 };

  const animate =
    prefersReducedMotion || isInView
      ? { opacity: 1, y: 0 }
      : { opacity: 0, y: 24 };

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={animate}
      transition={{
        duration: 0.7,
        delay: index * 0.15,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="bg-[--bg-glass] backdrop-blur-[16px] border border-[--border-subtle] rounded-xl p-6 md:p-8 text-left"
    >
      {/* Stars */}
      <div className="flex gap-1">
        {Array.from({ length: stars }).map((_, i) => (
          <StarIcon key={i} />
        ))}
      </div>

      {/* Quote */}
      <p className="text-[15px] md:text-[16px] text-[--text-heading] italic leading-[1.6] mt-4 font-[family-name:--font-body]">
        &ldquo;{quote}&rdquo;
      </p>

      {/* Attribution */}
      <div className="flex items-center gap-3 mt-6">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold"
          style={{
            background: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(34,211,238,0.05))",
            border: "1.5px solid rgba(34,211,238,0.3)",
            color: "var(--accent-teal)",
          }}
        >
          {initials}
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[--text-heading]">
            {name}
          </p>
          <p className="text-[12px] text-[--text-muted]">{context}</p>
          <p className="text-[12px] text-[--text-muted]">{role}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function SocialProof() {
  return (
    <section id="social-proof" className="pt-8 pb-14 lg:pt-10 lg:pb-20 max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="text-center">
        <SectionReveal>
          <h2 className="text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[1.1] tracking-[-0.02em] text-[--text-heading] font-[family-name:--font-display] max-w-2xl mx-auto mt-4">
            They started for the summaries. They stayed for the retention.
          </h2>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <SectionLabel>WHAT READERS SAY</SectionLabel>
        </SectionReveal>
      </div>

      {/* Testimonial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        {testimonials.map((t, i) => (
          <TestimonialCard
            key={t.name}
            name={t.name}
            context={t.context}
            role={t.role}
            quote={t.quote}
            stars={t.stars}
            initials={t.initials}
            index={i}
          />
        ))}
      </div>

      {/* Credibility line */}
      <SectionReveal delay={0.5}>
        <p className="text-[14px] text-[--text-muted] italic max-w-lg mx-auto text-center mt-10">
          Built on spaced repetition and active recall — the same science behind
          Anki and Duolingo.
        </p>
      </SectionReveal>
    </section>
  );
}
