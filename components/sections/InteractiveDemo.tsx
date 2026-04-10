"use client";

import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { DesktopReaderShell } from "@/components/landing/reader-demo/DesktopReaderShell";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";

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

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[--text-heading] mt-4 font-[family-name:var(--font-display)]">
              This is what reading looks like on ChapterFlow.
            </h2>

            <p className="text-[--text-secondary] mt-4 text-lg font-[family-name:var(--font-body)]">
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
              className="text-[--accent-teal] hover:underline underline-offset-4 text-sm font-medium transition-colors font-[family-name:var(--font-body)] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
            >
              Start reading free &rarr;
            </a>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
