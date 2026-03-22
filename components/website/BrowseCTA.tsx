import { GreenCTA } from "@/components/ui/GreenCTA";
import { SectionLabel } from "@/components/ui/SectionLabel";

export function BrowseCTA() {
  return (
    <section className="mt-20 mb-20 max-w-[800px] mx-auto px-4">
      <div
        className="text-center rounded-2xl p-12 md:p-16"
        style={{
          background: "var(--bg-glass)",
          border: "1px solid var(--border-medium)",
          boxShadow: "0 0 40px rgba(52,211,153,0.04)",
          backgroundImage:
            "linear-gradient(135deg, rgba(52,211,153,0.03) 0%, transparent 60%)",
        }}
      >
        <SectionLabel>START WITH ONE CHAPTER</SectionLabel>

        <h2
          className="mt-3 text-[28px] font-bold leading-[1.1] tracking-tight"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--text-heading)",
          }}
        >
          Every book follows the same proven loop.
        </h2>

        <p
          className="text-[15px] max-w-[480px] mx-auto mt-2"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--text-secondary)",
          }}
        >
          Read the summary. See it applied in real life. Prove you understood it.
          Unlock the next chapter.
        </p>

        <div className="mt-6 flex justify-center">
          <GreenCTA href="/auth/login?returnTo=%2Fbook">
            Start reading free
          </GreenCTA>
        </div>

        <p className="text-[12px] mt-3" style={{ color: "var(--text-muted)" }}>
          No credit card · 2 books free · Cancel anytime
        </p>
      </div>
    </section>
  );
}
