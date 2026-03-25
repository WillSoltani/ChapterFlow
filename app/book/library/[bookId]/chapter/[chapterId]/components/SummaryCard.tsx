"use client";

import { useState } from "react";
import { BookmarkPlus, ChevronDown, ChevronUp } from "lucide-react";
import type { ChapterSummaryBlock } from "@/app/book/data/mockChapters";

type SummaryCardProps = {
  blocks: ChapterSummaryBlock[];
  takeaways: string[];
  keyQuote?: string;
  recap?: string;
  showRecap: boolean;
  onToggleRecap: () => void;
  onSaveTakeaways: () => void;
  fontScaleClass: string;
};

export function SummaryCard({
  blocks,
  takeaways,
  keyQuote,
  recap,
  showRecap,
  onToggleRecap,
  onSaveTakeaways,
  fontScaleClass,
}: SummaryCardProps) {
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const paragraphs = blocks.filter((b) => b.type === "paragraph");
  const bullets = blocks.filter((b): b is Extract<ChapterSummaryBlock, { type: "bullet" }> => b.type === "bullet");

  return (
    <div className="space-y-6">
      {/* ── Main Summary Section ── */}
      <section className="cr-glass-reading p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--cr-text-secondary)]">
              Summary
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--cr-text-heading)]">
              Chapter Breakdown
            </h2>
          </div>
          <button
            type="button"
            onClick={onSaveTakeaways}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--cr-glass-border-teal)] bg-[var(--cr-accent-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--cr-accent)] transition hover:bg-[var(--cr-accent-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cr-accent-glow)]"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save
          </button>
        </div>

        {/* Primary insight paragraphs */}
        <div className="space-y-4">
          {paragraphs.map((block) => (
            <div
              key={block.id}
              className="rounded-2xl border border-[var(--cr-glass-border)] bg-[var(--cr-bg-surface-2)] px-5 py-4"
            >
              <p
                className={[
                  "text-[var(--cr-text-primary)] leading-[1.75] tracking-[0.015em]",
                  fontScaleClass,
                ].join(" ")}
                style={{ fontWeight: 450 }}
              >
                {block.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Key Takeaways ── */}
      {bullets.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--cr-glass-border)]" />
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--cr-text-secondary)]">
              Key Takeaways
            </p>
            <div className="h-px flex-1 bg-[var(--cr-glass-border)]" />
          </div>

          <div className="space-y-4">
            {bullets.map((block, index) => {
              const open = Boolean(expandedDetails[block.id]);
              const number = index + 1;

              return (
                <article
                  key={block.id}
                  className="cr-takeaway-card"
                  style={{
                    animation: `cr-card-enter 300ms ease-out ${index * 50}ms both`,
                  }}
                >
                  <div className="flex gap-4">
                    {/* Teal number circle */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cr-accent)] text-sm font-bold text-[var(--cr-text-inverse)]">
                      {number}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Takeaway title — use the first sentence or a portion as title */}
                      <p
                        className={[
                          "font-semibold leading-snug text-[var(--cr-text-heading)]",
                          fontScaleClass,
                        ].join(" ")}
                        style={{ fontSize: "1.125rem" }}
                      >
                        {block.text}
                      </p>

                      {/* Go Deeper toggle */}
                      {block.detail && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDetails((prev) => ({
                                ...prev,
                                [block.id]: !prev[block.id],
                              }))
                            }
                            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--cr-accent)] transition hover:text-[var(--cr-accent-hover)]"
                          >
                            {open ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                Hide details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                Go Deeper
                              </>
                            )}
                          </button>

                          {/* Expanded content */}
                          <div
                            className="overflow-hidden transition-all duration-300 ease-out"
                            style={{
                              maxHeight: open ? "500px" : "0px",
                              opacity: open ? 1 : 0,
                            }}
                          >
                            <div className="mt-3 rounded-xl border border-[var(--cr-glass-border)] bg-[var(--cr-bg-surface-3)] px-4 py-3">
                              <p
                                className={[
                                  "text-[var(--cr-text-primary)] leading-[1.75] tracking-[0.015em]",
                                  fontScaleClass,
                                ].join(" ")}
                                style={{ fontWeight: 450 }}
                              >
                                {block.detail}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Key Quote ── */}
      {keyQuote && (
        <section className="cr-glass-card relative overflow-hidden border-[var(--cr-glass-border-teal)] px-8 py-6">
          {/* Large decorative quote mark */}
          <span
            className="absolute left-5 top-4 text-5xl leading-none text-[var(--cr-accent)] opacity-30 select-none"
            aria-hidden="true"
          >
            &ldquo;
          </span>

          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--cr-accent)]">
            Key Quote
          </p>
          <p
            className="relative text-[1.3em] italic leading-[1.75] text-[var(--cr-text-heading)]"
            style={{ fontWeight: 450 }}
          >
            &ldquo;{keyQuote}&rdquo;
          </p>
        </section>
      )}

      {/* ── 1-Minute Recap ── */}
      {recap && (
        <section className="overflow-hidden rounded-2xl border border-[var(--cr-glass-border)] bg-[var(--cr-bg-surface-2)]">
          <button
            type="button"
            onClick={onToggleRecap}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-[var(--cr-accent-muted)]"
          >
            <div className="flex items-center gap-3">
              <div className="h-px w-5 bg-[var(--cr-accent)] opacity-40" />
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cr-text-secondary)]">
                1-Minute Recap
              </span>
            </div>
            {showRecap ? (
              <ChevronUp className="h-4 w-4 text-[var(--cr-text-disabled)]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[var(--cr-text-disabled)]" />
            )}
          </button>
          <div
            className="overflow-hidden transition-all duration-300 ease-out"
            style={{
              maxHeight: showRecap ? "500px" : "0px",
              opacity: showRecap ? 1 : 0,
            }}
          >
            <div className="border-t border-[var(--cr-glass-border)] px-5 pb-5 pt-4">
              <p
                className={[
                  "text-[var(--cr-text-primary)] leading-[1.85] tracking-[0.015em]",
                  fontScaleClass,
                ].join(" ")}
                style={{ fontWeight: 450 }}
              >
                {recap}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Takeaway Pills (quick reference) ── */}
      {takeaways.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--cr-text-secondary)]">
            Quick Reference
          </p>
          <div className="flex flex-wrap gap-2">
            {takeaways.map((takeaway) => (
              <span
                key={takeaway}
                className="rounded-full border border-[var(--cr-glass-border-teal)] bg-[var(--cr-accent-muted)] px-3.5 py-1.5 text-xs font-medium text-[var(--cr-accent)]"
              >
                {takeaway}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
