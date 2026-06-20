import { SectionReveal } from "@/components/ui/SectionReveal";
import { FinalCTALinks } from "@/components/landing/FinalCTALinks";
import { LEARNING_LOOP_STEPS } from "@/lib/learning-loop";
import { CATALOG_MEDIAN_CHAPTER_MINUTES } from "@/lib/catalog-stats";

/**
 * The closing CTA. A full-bleed dark CONTRAST band (theme-invariant dark-anchor
 * tokens, var(--cf-anchor-bg) etc. → dark on a light page) that lifts the final
 * action off the near-white page. Kept calm and simple (one soft glow, no aurora)
 * so the signature scroll section stays the one DRAMATIC dark moment.
 *
 * Stays a SERVER component; FinalCTALinks (the tracked, auth-target CTA) is the
 * only client island.
 */
export function FinalCTA() {
  return (
    <section
      className="relative isolate overflow-hidden px-4 py-20 lg:py-28"
      style={{ background: "var(--cf-anchor-bg)" }}
    >
      {/* single soft glow (calm — the dramatic aurora belongs to the signature) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 0%, color-mix(in srgb, var(--cf-anchor-accent) 12%, transparent), transparent 70%)",
        }}
      />

      <SectionReveal>
        <div className="mx-auto max-w-[640px] text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-anchor-text-muted)">
            Start with one chapter
          </p>

          <h2
            className="mt-4 font-bold leading-[1.1] tracking-[-0.02em] text-(--cf-anchor-text)"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 5vw, 2.75rem)",
            }}
          >
            Read like it actually sticks.
          </h2>

          <p
            className="mt-2 text-[24px] font-bold text-(--cf-anchor-accent) md:text-[28px]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            No skimming. No shortcuts. Real retention.
          </p>

          <p
            className="mt-4 text-[16px] leading-[1.7] text-(--cf-anchor-text-muted) md:text-[18px]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Every chapter is a ~{CATALOG_MEDIAN_CHAPTER_MINUTES}-minute loop:{" "}
            {LEARNING_LOOP_STEPS.join(", ")}.
          </p>

          <FinalCTALinks />
        </div>
      </SectionReveal>
    </section>
  );
}
