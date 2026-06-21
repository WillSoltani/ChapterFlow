import { SectionReveal } from "@/components/ui/SectionReveal";
import { FinalCTALinks } from "@/components/landing/FinalCTALinks";
import { CATALOG_MEDIAN_CHAPTER_MINUTES } from "@/lib/catalog-stats";

/**
 * The closing band. On the all-dark page this is a slightly-raised panel (page-alt
 * surface + a single calm cyan glow + a top hairline) so it reads as a distinct
 * "close," not another stretch of the same near-black. Echoes the loop motif one
 * last time as three connected nodes — Read → Prove → Keep — the same verbs from
 * the hero and the signature's phase rail.
 *
 * Stays a SERVER component; FinalCTALinks (tracked, auth-target CTA) is the only
 * client island, and the connector is static markup (reduced-motion safe).
 */

const LOOP_NODES = ["Read", "Prove", "Keep"];

export function FinalCTA() {
  return (
    <section
      className="relative isolate overflow-hidden px-4 py-20 lg:py-28"
      style={{
        background: "var(--cf-page-bg-alt)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      {/* single soft glow (calm — the dramatic moment belongs to the signature) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 70% at 50% 0%, color-mix(in srgb, var(--accent-cyan) 12%, transparent), transparent 70%)",
        }}
      />

      <SectionReveal>
        <div className="mx-auto max-w-[680px] text-center">
          <p className="cf-folio" style={{ color: "var(--accent-cyan)" }}>
            Start with one chapter
          </p>

          <h2
            className="mt-4 font-bold leading-[1.05] text-balance"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
              letterSpacing: "-0.035em",
              color: "var(--text-heading)",
            }}
          >
            Read it. Prove it.{" "}
            <span style={{ color: "var(--accent-cyan)" }}>Keep it.</span>
          </h2>

          {/* loop-node connector — the motif's final echo */}
          <div className="mt-8 flex items-center justify-center gap-3" aria-hidden>
            {LOOP_NODES.map((n, i) => (
              <div key={n} className="flex items-center gap-3">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: "var(--accent-cyan)",
                      boxShadow: "0 0 8px color-mix(in srgb, var(--accent-cyan) 55%, transparent)",
                    }}
                  />
                  <span className="cf-folio" style={{ color: "var(--text-secondary)" }}>{n}</span>
                </span>
                {i < LOOP_NODES.length - 1 && (
                  <span className="h-px w-10" style={{ background: "var(--border-medium)" }} />
                )}
              </div>
            ))}
          </div>

          <p
            className="mx-auto mt-7 max-w-[44ch] text-[16px] leading-[1.7] md:text-[18px]"
            style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
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
