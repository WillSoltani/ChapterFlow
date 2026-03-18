"use client";

import { useState } from "react";
import { BookmarkPlus, ChevronDown, ChevronUp, Quote } from "lucide-react";
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

  return (
    <div className="space-y-4">
      {/* Main summary */}
      <section className="cf-panel rounded-[26px] p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">Summary</p>
            <h2 className="mt-0.5 text-xl font-semibold text-(--cf-text-1)">Chapter Breakdown</h2>
          </div>
          <button
            type="button"
            onClick={onSaveTakeaways}
            className="inline-flex items-center gap-1.5 rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1.5 text-xs font-semibold text-(--cf-accent) transition hover:bg-(--cf-accent-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save to notes
          </button>
        </div>

        <div className="space-y-3.5">
          {blocks.map((block, index) => {
            if (block.type === "paragraph") {
              return (
                <p
                  key={block.id}
                  className={[
                    "rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3 text-(--cf-text-2)",
                    fontScaleClass,
                  ].join(" ")}
                >
                  {block.text}
                </p>
              );
            }

            const bulletNumber = blocks
              .slice(0, index + 1)
              .filter((item) => item.type === "bullet").length;
            const open = Boolean(expandedDetails[block.id]);
            return (
              <article
                key={block.id}
                className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3"
              >
                <div className={["group flex gap-3.5", fontScaleClass].join(" ")}>
                  <span className="mt-[0.4em] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) text-[10px] font-bold tabular-nums text-(--cf-accent)">
                    {bulletNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="leading-relaxed text-(--cf-text-2)">{block.text}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedDetails((prev) => ({
                          ...prev,
                          [block.id]: !prev[block.id],
                        }))
                      }
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-(--cf-accent) transition hover:text-(--cf-accent-strong)"
                    >
                      {open ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Hide details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          More details
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {open ? (
                  <p
                    className={[
                      "mt-2 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2 text-(--cf-text-2)",
                      fontScaleClass,
                    ].join(" ")}
                  >
                    {block.detail}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {/* Key quote */}
      {keyQuote ? (
        <section className="relative overflow-hidden rounded-2xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-6 py-5">
          <Quote className="absolute right-4 top-3 h-10 w-10 rotate-180 text-(--cf-accent-border)" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--cf-accent)">Key Quote</p>
          <p className={["relative mt-2 italic text-(--cf-text-1)", fontScaleClass].join(" ")}>
            &ldquo;{keyQuote}&rdquo;
          </p>
        </section>
      ) : null}

      {/* 1-min recap */}
      {recap ? (
        <section className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted)">
          <button
            type="button"
            onClick={onToggleRecap}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-(--cf-accent-muted)"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
              1-minute recap
            </span>
            {showRecap
              ? <ChevronUp className="h-4 w-4 text-(--cf-text-soft)" />
              : <ChevronDown className="h-4 w-4 text-(--cf-text-soft)" />}
          </button>
          {showRecap ? (
            <p className={["border-t border-(--cf-divider) px-4 pb-4 pt-3 text-(--cf-text-2)", fontScaleClass].join(" ")}>
              {recap}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Key takeaways */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
          Key Takeaways
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {takeaways.map((takeaway) => (
            <span
              key={takeaway}
              className="rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1 text-xs font-medium text-(--cf-accent)"
            >
              {takeaway}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
