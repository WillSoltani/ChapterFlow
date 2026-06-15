"use client";

import dynamic from "next/dynamic";

import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";

/**
 * Lightweight placeholder shown while the heavy reader shell chunk loads.
 * Matches the real shell's dimensions (rounded bordered card + tall content
 * area) so there's no layout shift when the lazy chunk swaps in.
 */
function DesktopReaderShellSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border animate-pulse"
      style={{
        background: "var(--cr-bg-root)",
        borderColor: "var(--cr-glass-border)",
      }}
    >
      {/* Window chrome bar */}
      <div
        className="h-10 border-b"
        style={{
          background: "var(--cr-bg-surface-1)",
          borderColor: "var(--cr-glass-border)",
        }}
      />
      {/* Phase stepper bar */}
      <div
        className="px-6 py-5 border-b"
        style={{
          background: "var(--cr-bg-surface-1)",
          borderColor: "var(--cr-glass-border)",
        }}
      >
        <div
          className="h-6 w-2/3 rounded-full"
          style={{ background: "var(--cr-glass-border)" }}
        />
      </div>
      {/* Content area placeholder (mirrors max-h-[720px] reader body) */}
      <div className="px-6 py-8 md:px-10 md:py-10 min-h-[480px] space-y-4">
        <div
          className="h-7 w-1/2 rounded-md"
          style={{ background: "var(--cr-glass-border)" }}
        />
        <div
          className="h-4 w-full rounded-md"
          style={{ background: "var(--cr-glass-border)" }}
        />
        <div
          className="h-4 w-11/12 rounded-md"
          style={{ background: "var(--cr-glass-border)" }}
        />
        <div
          className="h-4 w-4/5 rounded-md"
          style={{ background: "var(--cr-glass-border)" }}
        />
      </div>
    </div>
  );
}

/**
 * The reader shell statically pulls in the 5 real in-app reader components
 * plus DesktopQuizPanel (~2,500 lines). It lives below the fold, so we load
 * it lazily (client-only, no SSR) to keep it out of the landing first-paint
 * bundle. A dimension-matched skeleton fills the slot until the chunk loads.
 */
const DesktopReaderShell = dynamic(
  () =>
    import("@/components/landing/reader-demo/DesktopReaderShell").then(
      (m) => m.DesktopReaderShell
    ),
  {
    ssr: false,
    loading: () => <DesktopReaderShellSkeleton />,
  }
);

/**
 * The interactive demo section. Renders the actual ChapterFlow reader
 * (not a mock) using imports from app/book/library/.../components.
 * The DesktopReaderShell takes care of all the orchestration and
 * feeds the real components with mocked content from demoChapter.ts.
 */
export function InteractiveDemo() {
  return (
    <section id="demo" className="py-14 lg:py-20">
      <div className="max-w-5xl mx-auto px-4">
        {/* ---- Header ---- */}
        <SectionReveal>
          <div className="text-center mb-12 md:mb-16">
            <SectionLabel>SEE IT IN ACTION</SectionLabel>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-(--text-heading) mt-4 font-(family-name:--font-display)">
              This is what reading looks like on ChapterFlow.
            </h2>

            <p className="text-(--text-secondary) mt-4 text-lg font-(family-name:--font-body)">
              Summary. Examples. Quiz. Practice. Every chapter, every book.
            </p>
          </div>
        </SectionReveal>

        {/* ---- The actual product ---- */}
        <SectionReveal delay={0.15}>
          <DesktopReaderShell />
        </SectionReveal>

        {/* ---- CTA below demo ---- */}
        <SectionReveal delay={0.3}>
          <div className="text-center mt-10">
            <a
              href={AUTH_LOGIN_BOOK_URL}
              onClick={() => track("cta_click", { source: "interactive_demo" })}
              className="cta-shine inline-flex items-center rounded-full px-8 py-4 font-semibold text-[16px] transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
              style={{
                backgroundColor: "var(--accent-cyan)",
                color: "var(--primary-foreground)",
              }}
            >
              Start reading free &rarr;
            </a>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
