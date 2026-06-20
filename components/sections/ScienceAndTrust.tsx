"use client";

import Link from "next/link";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { useAuthStatus } from "@/components/auth/useAuthStatus";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";

/**
 * The evidence-led trust layer (replaces the old SocialProof band).
 *
 * Credibility comes from SCIENCE and TRANSPARENCY, never personas. Deliberately
 * contains ZERO people (no founder/person name, headshot, signature), ZERO
 * testimonials or attributed user quotes, and ZERO fabricated metrics / ratings
 * / user counts / waitlist numbers / press logos — none exist pre-launch, so we
 * render none and say so honestly. The cited figures here are PUBLISHED memory
 * science (Ebbinghaus / Karpicke & Roediger / Dunlosky / FSRS), not user data.
 */

type Pillar = {
  term: string;
  body: string;
  cite: string;
};

const PILLARS: Pillar[] = [
  {
    term: "The forgetting curve",
    body: "Without review, memory of new material decays sharply within days. Ebbinghaus first mapped this curve in 1885 — and a century of studies keeps confirming it.",
    cite: "Ebbinghaus, 1885",
  },
  {
    term: "Active recall",
    body: "Pulling an idea back out of memory strengthens it far more than reading it again. The chapter quiz is that retrieval — passing it is how you continue.",
    cite: "Karpicke & Roediger, Science, 2008",
  },
  {
    term: "Spaced repetition · FSRS",
    body: "Each idea comes back for review right before you'd forget it. We schedule that with FSRS — the open-source algorithm that became Anki's default scheduler.",
    cite: "Open-Spaced-Repetition · Anki 23.10",
  },
];

type MethodStep = {
  step: string;
  body: string;
  science: string;
};

const METHOD: MethodStep[] = [
  {
    step: "Read",
    body: "Take the idea in — a structured summary, then a real-world example.",
    science: "before it fades",
  },
  {
    step: "Prove",
    body: "Recall it in a short scenario quiz. Passing is the only way forward.",
    science: "active recall",
  },
  {
    step: "Unlock",
    body: "The next chapter opens, and the idea enters spaced review.",
    science: "spaced repetition",
  },
];

function PillarCard({ pillar }: { pillar: Pillar }) {
  return (
    <div className="rounded-xl border border-(--border-subtle) bg-(--bg-glass) p-6 backdrop-blur-[16px]">
      <h3
        className="text-[16px] font-semibold text-(--text-heading)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {pillar.term}
      </h3>
      <p className="mt-2 text-[14px] leading-[1.6] text-(--text-secondary) font-(family-name:--font-body)">
        {pillar.body}
      </p>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-wide text-(--text-muted)">
        {pillar.cite}
      </p>
    </div>
  );
}

function MethodDiagram() {
  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {METHOD.map((m, i) => (
        <li
          key={m.step}
          className="relative rounded-xl border border-(--border-subtle) bg-(--bg-glass) p-5 backdrop-blur-[16px]"
        >
          <div className="flex items-baseline gap-2">
            <span
              className="text-[13px] font-bold text-(--accent-cyan)"
              aria-hidden
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className="text-[18px] font-bold text-(--text-heading)"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {m.step}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-[1.55] text-(--text-secondary)">
            {m.body}
          </p>
          <p className="mt-3 inline-flex rounded-full border border-(--border-subtle) px-2.5 py-1 text-[11px] text-(--accent-cyan)">
            {m.science}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ScienceAndTrust() {
  const { loggedIn } = useAuthStatus();
  const ctaHref = loggedIn ? "/book" : AUTH_LOGIN_BOOK_URL;

  return (
    <section id="why-it-works" className="mx-auto max-w-5xl px-4 py-14 lg:py-20">
      {/* Header */}
      <div className="max-w-2xl">
        <SectionReveal>
          <SectionLabel>WHY IT WORKS</SectionLabel>
        </SectionReveal>
        <SectionReveal delay={0.08}>
          <h2 className="mt-4 text-[28px] font-bold leading-[1.1] tracking-[-0.02em] text-(--text-heading) font-(family-name:--font-display) md:text-[36px] lg:text-[44px]">
            Built on the two study methods that actually work.
          </h2>
        </SectionReveal>
      </div>

      {/* Featured science claim — the section's anchor statement (distinct,
          larger treatment than the cards below) */}
      <SectionReveal delay={0.12}>
        <figure
          className="mt-10 rounded-2xl border border-(--border-subtle) bg-(--bg-glass) p-7 backdrop-blur-[16px] md:p-9"
          style={{ borderLeft: "3px solid var(--accent-cyan)" }}
        >
          <blockquote
            className="text-[20px] leading-[1.5] text-(--text-heading) font-(family-name:--font-display) md:text-[24px]"
          >
            Decades of memory research keep finding the same two winners:{" "}
            <span className="text-(--accent-cyan)">active recall</span> and{" "}
            <span className="text-(--accent-cyan)">spaced repetition</span>.
            ChapterFlow is built entirely around them — the quiz makes you
            retrieve each idea, and FSRS brings it back right before you&apos;d
            forget it.
          </blockquote>
          <figcaption className="mt-5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-(--text-muted)">
            <span>Dunlosky et al., Psych. Science in the Public Interest, 2013</span>
            <span aria-hidden>·</span>
            <span>Karpicke &amp; Roediger, Science, 2008</span>
          </figcaption>
        </figure>
      </SectionReveal>

      {/* Three distinct science pillars (different shape from the featured block) */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {PILLARS.map((pillar, i) => (
          <SectionReveal key={pillar.term} delay={0.15 + i * 0.08}>
            <PillarCard pillar={pillar} />
          </SectionReveal>
        ))}
      </div>

      {/* The named method */}
      <SectionReveal delay={0.2}>
        <div className="mt-14">
          <h3 className="text-[15px] font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
            The Read · Prove · Unlock method
          </h3>
          <p className="mt-2 max-w-2xl text-[15px] leading-[1.6] text-(--text-secondary)">
            Every chapter, every book — the same loop that turns reading into
            remembering.
          </p>
          <div className="mt-5">
            <MethodDiagram />
          </div>
        </div>
      </SectionReveal>

      {/* Honest framing vs known tools (no logos, no endorsement) */}
      <SectionReveal delay={0.24}>
        <p className="mt-12 max-w-2xl text-[15px] leading-[1.6] text-(--text-secondary)">
          It&apos;s the retention science behind{" "}
          <span className="text-(--text-heading)">Anki</span> and{" "}
          <span className="text-(--text-heading)">Duolingo</span> — applied to the
          non-fiction books you already want to read.
        </p>
      </SectionReveal>

      {/* Principles / why this exists — brand voice ("we"), NOT signed by a
          person, NOT a quote. Weaponizes the honest absence of testimonials. */}
      <SectionReveal delay={0.28}>
        <div className="mt-12 rounded-2xl border border-(--border-subtle) bg-(--bg-glass) p-7 backdrop-blur-[16px] md:p-9">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-(--accent-cyan)">
            Why we built this
          </p>
          <p className="mt-3 max-w-3xl text-[16px] leading-[1.7] text-(--text-secondary) font-(family-name:--font-body)">
            We kept buying great books and forgetting them. Highlighting felt like
            progress; months later, almost nothing had stuck. So we built the loop
            the research points to — and left out everything it doesn&apos;t. We
            just launched, so we won&apos;t show you reviews we haven&apos;t earned
            yet. Just the method, the science it&apos;s built on, and two free books
            to judge it for yourself.
          </p>
        </div>
      </SectionReveal>

      {/* Risk-reversal + CTA */}
      <SectionReveal delay={0.32}>
        <div className="mt-12 flex flex-col items-start gap-4">
          <MagneticButton className="rounded-full">
            <Link
              href={ctaHref}
              onClick={() => track("cta_click", { source: "science_trust" })}
              className="cta-shine inline-flex items-center rounded-full px-8 py-4 text-[16px] font-semibold transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
              style={{
                backgroundColor: "var(--accent-cyan)",
                color: "var(--primary-foreground)",
              }}
            >
              Start reading free &rarr;
            </Link>
          </MagneticButton>
          <p className="text-[13px] text-(--text-muted)">
            Two free books &middot; no credit card &middot; cancel anytime
          </p>
        </div>
      </SectionReveal>
    </section>
  );
}
