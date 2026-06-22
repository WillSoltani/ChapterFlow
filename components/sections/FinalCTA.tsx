import { Plus } from "lucide-react";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { FinalCTALinks } from "@/components/landing/FinalCTALinks";
import { CATALOG_MEDIAN_CHAPTER_MINUTES } from "@/lib/catalog-stats";

/**
 * The sign-off — the back-page of the manual's spec. An editorial plus-corner
 * frame (four Lucide corner marks + left/right rules + a dashed center hairline)
 * on the inverse anchor band (cf-anchor tokens): blueprint, not a glow blob. Echoes the
 * Read → Prove → Keep verb motif one last time so the page closes its own loop;
 * it does NOT restate Summary/Examples/Quiz/Practice (the loop is specified once
 * in §01).
 *
 * Stays a SERVER component; FinalCTALinks (tracked, auth-target CTA) is the only
 * client island, and the frame is static markup (reduced-motion safe).
 */

const LOOP_NODES = ["Read", "Prove", "Keep"];

/* The plus-corner mark, repeated at each frame corner. Lucide raw, decorative. */
function CornerMark({ className }: { className: string }) {
  return (
    <Plus
      aria-hidden
      size={20}
      strokeWidth={1}
      className={`pointer-events-none absolute z-[1] text-(--cf-anchor-text-muted) ${className}`}
    />
  );
}

export function FinalCTA() {
  return (
    <section
      className="relative isolate overflow-hidden px-4 py-20 lg:py-28"
      style={{
        background: "var(--cf-anchor-bg)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <SectionReveal>
        {/* the plus-corner sign-off frame — sized to hug the content box so the
            four corner marks register as a deliberate blueprint enclosure, not
            stray glyphs floating in empty side bands. Tighter vertical padding +
            a content-width column keep the marks at the actual content corners. */}
        <div className="relative mx-auto flex max-w-[600px] flex-col items-center px-8 py-9 text-center sm:px-12">
          {/* four corner marks */}
          <CornerMark className="-left-[10px] -top-[10px]" />
          <CornerMark className="-right-[10px] -top-[10px]" />
          <CornerMark className="-bottom-[10px] -left-[10px]" />
          <CornerMark className="-bottom-[10px] -right-[10px]" />

          {/* left / right vertical rules */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-px"
            style={{ background: "var(--cf-anchor-border)" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-px"
            style={{ background: "var(--cf-anchor-border)" }}
          />

          {/* dashed center hairline — the blueprint fold */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-px -translate-x-1/2"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, var(--cf-anchor-border) 0 6px, transparent 6px 12px)",
            }}
          />

          <p className="cf-folio" style={{ color: "var(--cf-anchor-accent)" }}>
            Start with one chapter
          </p>

          <h2
            className="mt-4 font-bold leading-[1.05] text-balance"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
              letterSpacing: "-0.035em",
              color: "var(--cf-anchor-text)",
            }}
          >
            Read it. Prove it.{" "}
            <span style={{ color: "var(--cf-anchor-accent)" }}>Keep it.</span>
          </h2>

          {/* loop-node connector — the motif's final echo */}
          <div className="mt-8 flex items-center justify-center gap-3" aria-hidden>
            {LOOP_NODES.map((n, i) => (
              <div key={n} className="flex items-center gap-3">
                <span className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--cf-anchor-accent)" }}
                  />
                  <span
                    className="cf-folio"
                    style={{ color: "var(--cf-anchor-text-muted)" }}
                  >
                    {n}
                  </span>
                </span>
                {i < LOOP_NODES.length - 1 && (
                  <span
                    className="h-px w-10"
                    style={{ background: "var(--cf-anchor-border)" }}
                  />
                )}
              </div>
            ))}
          </div>

          <p
            className="mx-auto mt-7 max-w-[44ch] text-[16px] leading-[1.7] md:text-[18px]"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--cf-anchor-text-muted)",
            }}
          >
            Every chapter is a ~{CATALOG_MEDIAN_CHAPTER_MINUTES}-minute loop — and the
            first two books are free. No skimming, no shortcuts, real retention.
          </p>

          <FinalCTALinks />
        </div>
      </SectionReveal>
    </section>
  );
}
