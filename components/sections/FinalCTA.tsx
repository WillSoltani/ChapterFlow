import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { FinalCTALinks } from "@/components/landing/FinalCTALinks";
import { LEARNING_LOOP_STEPS } from "@/lib/learning-loop";
import { CATALOG_MEDIAN_CHAPTER_MINUTES } from "@/lib/catalog-stats";

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
            Read like it actually sticks.
          </h2>

          <p
            className="mt-2 text-[24px] md:text-[28px] font-bold"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--accent-cyan)",
            }}
          >
            No skimming. No shortcuts. Real retention.
          </p>

          <p
            className="mt-4 text-[16px] md:text-[18px] leading-[1.7]"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--text-secondary)",
            }}
          >
            Every chapter is a ~{CATALOG_MEDIAN_CHAPTER_MINUTES}-minute loop:{" "}
            {LEARNING_LOOP_STEPS.join(", ")}.
            Start free &mdash; no credit card, no commitment.
          </p>

          <FinalCTALinks />
        </div>
      </SectionReveal>
    </section>
  );
}
