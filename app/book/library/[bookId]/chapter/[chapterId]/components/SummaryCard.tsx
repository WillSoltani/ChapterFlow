"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bookmark, BookmarkPlus, ChevronDown, ChevronUp } from "lucide-react";
import type { ChapterSummaryBlock } from "@/app/book/data/mockChapters";
import type { LearningMode } from "@/app/book/settings/types/settings";

function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*/g, "");
}

/**
 * Break a long paragraph into shorter ones at sentence boundaries.
 * Reading research suggests ~5 lines (≈ 450 chars at our column width)
 * is the comfort ceiling — past that, scanning falls off a cliff.
 * Sentences are kept intact; we only chunk when adding the next sentence
 * would push the current chunk past `maxChars`.
 */
function splitLongParagraph(text: string, maxChars = 450): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  // Split on sentence terminators while preserving them.
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return [trimmed];

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current.length === 0) {
      current = sentence;
      continue;
    }
    if ((current + " " + sentence).length > maxChars) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current + " " + sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

type SummaryCardProps = {
  blocks: ChapterSummaryBlock[];
  takeaways: string[];
  keyQuote?: string;
  recap?: string[];
  showRecap: boolean;
  onToggleRecap: () => void;
  onSaveTakeaways: () => void;
  bookmarkedTakeaways: Set<number>;
  onToggleBookmarkTakeaway: (index: number) => void;
  fontScaleClass: string;
  learningMode?: LearningMode;
  activationPrompt?: string;
  selfCheckPrompts?: string[];
  /** Optional slot rendered in the summary header next to the Save button */
  headerAction?: React.ReactNode;
};

export function SummaryCard({
  blocks,
  takeaways,
  keyQuote,
  recap,
  showRecap,
  onToggleRecap,
  onSaveTakeaways,
  bookmarkedTakeaways,
  onToggleBookmarkTakeaway,
  fontScaleClass,
  learningMode = "standard",
  activationPrompt,
  selfCheckPrompts,
  headerAction,
}: SummaryCardProps) {
  // Track manually-expanded vs auto-expanded takeaways separately
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set());
  const [autoExpanded, setAutoExpanded] = useState<Set<string>>(new Set());
  const prevMode = useRef<string | null>(null);

  const paragraphs = blocks.filter((b) => b.type === "paragraph");
  const bullets = blocks.filter(
    (b): b is Extract<ChapterSummaryBlock, { type: "bullet" }> => b.type === "bullet"
  );
  const prefersReducedMotion = useReducedMotion();

  // React to learning mode changes for auto-expand/collapse
  useEffect(() => {
    if (learningMode === prevMode.current) return;

    if (learningMode === "guided") {
      // Auto-expand all takeaways that aren't already manually expanded
      const ids = bullets.filter((b) => b.detail).map((b) => b.id);
      const newAuto = new Set(ids.filter((id) => !manuallyExpanded.has(id)));
      setAutoExpanded(newAuto);
    } else if (prevMode.current === "guided") {
      // Leaving Guided: collapse only auto-expanded ones, keep manual
      setAutoExpanded(new Set());
    }

    prevMode.current = learningMode;
  }, [learningMode, bullets, manuallyExpanded]);

  const isExpanded = useCallback(
    (id: string) => manuallyExpanded.has(id) || autoExpanded.has(id),
    [manuallyExpanded, autoExpanded]
  );

  const handleToggle = useCallback((blockId: string) => {
    setManuallyExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
    // Also remove from auto-expanded if present
    setAutoExpanded((prev) => {
      if (!prev.has(blockId)) return prev;
      const next = new Set(prev);
      next.delete(blockId);
      return next;
    });
  }, []);

  return (
    <div className="cr-reading-content space-y-6">
      {/* ── Challenge mode banner ── */}
      {learningMode === "challenge" && (
        <div
          className="rounded-xl border border-(--cr-warning)/20 bg-(--cr-warning)/8 px-4 py-3 text-sm text-(--cr-text-secondary)"
          style={{ animation: "cr-card-enter 200ms ease-out" }}
        >
          <span className="mr-1.5">{"\uD83C\uDFC6"}</span>
          Challenge mode active — no retries on the quiz
        </div>
      )}

      {/* ── Activation Prompt (Before You Read) ── */}
      {activationPrompt && (
        <section
          className="rounded-xl border border-(--cr-accent)/20 bg-(--cr-accent-muted) px-5 py-4"
          style={{ animation: "cr-card-enter 200ms ease-out" }}
        >
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-(--cr-accent)">
            Before You Read
          </p>
          <p className={`text-(--cr-text-primary) leading-[1.75] ${fontScaleClass}`}>
            {activationPrompt}
          </p>
        </section>
      )}

      {/* ── Main Summary Section ── */}
      <section className="cr-glass-reading p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--cr-text-secondary)">
              Summary
            </p>
            <h2 data-phase-heading className="mt-1 text-2xl font-bold tracking-tight text-(--cr-text-heading)">
              Chapter Breakdown
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {headerAction}
            <button
              type="button"
              onClick={onSaveTakeaways}
              className="inline-flex items-center gap-1.5 rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-3 py-1.5 text-xs font-semibold text-(--cr-accent) transition hover:bg-(--cr-accent-glow) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cr-accent-glow)"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {paragraphs.flatMap((block) =>
            splitLongParagraph(block.text).map((chunk, i) => (
              <p
                key={`${block.id}-${i}`}
                className={[
                  "text-(--cr-text-primary) leading-[1.85] tracking-[0.012em]",
                  fontScaleClass,
                ].join(" ")}
                style={{ fontWeight: 450 }}
              >
                {chunk}
              </p>
            ))
          )}
        </div>
      </section>

      {/* ── Key Takeaways ── */}
      {bullets.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-(--cr-glass-border)" />
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--cr-text-secondary)">
              Key Takeaways
              {bookmarkedTakeaways.size > 0 && (
                <span className="ml-2 text-[11px] font-normal normal-case tracking-normal text-(--cr-text-disabled)">
                  ({bookmarkedTakeaways.size} saved)
                </span>
              )}
            </p>
            <div className="h-px flex-1 bg-(--cr-glass-border)" />
          </div>

          <div className="space-y-4">
            {bullets.map((block, index) => {
              const open = isExpanded(block.id);
              const number = index + 1;
              const bookmarked = bookmarkedTakeaways.has(index);

              return (
                <article
                  key={block.id}
                  className="cr-takeaway-card relative"
                  style={{
                    animation: `cr-card-enter 300ms ease-out ${index * 50}ms both`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onToggleBookmarkTakeaway(index)}
                    className={[
                      "absolute right-4 top-4 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cr-accent-glow) rounded",
                      bookmarked
                        ? "text-(--cr-accent)"
                        : "text-(--cr-text-disabled) hover:text-(--cr-accent)",
                    ].join(" ")}
                    aria-label={bookmarked ? "Remove bookmark" : "Bookmark this takeaway"}
                  >
                    <Bookmark
                      className="h-4 w-4"
                      fill={bookmarked ? "currentColor" : "none"}
                    />
                  </button>

                  <div className="flex gap-4 pr-10">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--cr-accent) text-sm font-bold text-(--cr-text-inverse)">
                      {number}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={[
                          "font-semibold leading-snug text-(--cr-text-heading)",
                          fontScaleClass,
                        ].join(" ")}
                        style={{ fontSize: "1.125rem" }}
                      >
                        {stripMarkdownBold(block.text)}
                      </p>

                      {block.detail && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggle(block.id)}
                            aria-expanded={open}
                            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-(--cr-accent) transition hover:text-(--cr-accent-hover)"
                          >
                            <motion.span
                              animate={{ rotate: open ? 180 : 0 }}
                              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                              className="inline-flex"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </motion.span>
                            {open ? "Hide details" : "Go Deeper"}
                          </button>

                          <div
                            className="overflow-hidden transition-all duration-300 ease-out"
                            style={{
                              maxHeight: open ? "500px" : "0px",
                              opacity: open ? 1 : 0,
                            }}
                          >
                            <div
                              className="mt-3 rounded-xl border border-(--cr-glass-border) px-4 py-3"
                              style={{ background: "var(--cr-accent-muted)" }}
                            >
                              <p
                                className={[
                                  "text-(--cr-text-primary) leading-[1.75] tracking-[0.012em]",
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

      {selfCheckPrompts && selfCheckPrompts.length > 0 && (
        <section className="rounded-2xl border border-(--cr-info)/20 bg-(--cr-info)/5 px-5 py-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-(--cr-info)">
            Check Yourself
          </p>
          <div className="space-y-3">
            {selfCheckPrompts.map((prompt, index) => (
              <p
                key={`${index}-${prompt}`}
                className={`text-(--cr-text-primary) leading-[1.75] ${fontScaleClass}`}
              >
                {prompt}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* ── Key Quote ── */}
      {keyQuote && (
        <section
          className="cr-glass-card relative overflow-hidden px-6 py-6"
          style={{
            borderLeft: "4px solid var(--cr-accent)",
          }}
        >
          <span
            className="absolute top-0 left-3 text-[56px] leading-none pointer-events-none select-none opacity-20"
            style={{
              color: "var(--cr-accent)",
              fontFamily: "var(--font-display)",
            }}
            aria-hidden="true"
          >
            &ldquo;
          </span>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-(--cr-accent)">
            Key Quote
          </p>
          <p
            className="relative text-[1.25em] leading-[1.75] text-(--cr-text-heading)"
            style={{ fontWeight: 450, fontStyle: "italic" }}
          >
            &ldquo;{keyQuote}&rdquo;
          </p>
        </section>
      )}

      {/* ── 1-Minute Recap ── */}
      {recap && recap.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2)">
          <button
            type="button"
            onClick={onToggleRecap}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-(--cr-accent-muted)"
          >
            <div className="flex items-center gap-3">
              <div className="h-px w-5 bg-(--cr-accent) opacity-40" />
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-(--cr-text-secondary)">
                1-Minute Recap
              </span>
            </div>
            {showRecap ? (
              <ChevronUp className="h-4 w-4 text-(--cr-text-disabled)" />
            ) : (
              <ChevronDown className="h-4 w-4 text-(--cr-text-disabled)" />
            )}
          </button>
          <div
            className="overflow-hidden transition-all duration-300 ease-out"
            style={{
              maxHeight: showRecap ? "500px" : "0px",
              opacity: showRecap ? 1 : 0,
            }}
          >
            <div className="border-t border-(--cr-glass-border) px-5 pb-5 pt-4">
              <div className="space-y-3">
                {recap.map((item, index) => (
                  <p
                    key={`${index}-${item}`}
                    className={[
                      "text-(--cr-text-primary) leading-[1.85] tracking-[0.012em]",
                      fontScaleClass,
                    ].join(" ")}
                    style={{ fontWeight: 450 }}
                  >
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Quick Reference ── */}
      {takeaways.length > 0 && (
        <section>
          <h3
            className="mb-3 inline-block pb-1 text-xs font-bold uppercase tracking-[0.16em] text-(--cr-text-heading) border-b-2 border-(--cr-accent)"
          >
            {bookmarkedTakeaways.size > 0 ? "Your Quick Reference" : "Quick Reference"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(bookmarkedTakeaways.size > 0
              ? takeaways.filter((_, i) => bookmarkedTakeaways.has(i))
              : takeaways
            ).map((takeaway) => (
              <span
                key={takeaway}
                className="rounded-full border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2 text-xs font-semibold text-(--cr-accent)"
              >
                {stripMarkdownBold(takeaway)}
              </span>
            ))}
          </div>
          {bookmarkedTakeaways.size === 0 && (
            <p className="mt-2 text-xs text-(--cr-text-disabled)">
              Bookmark takeaways above to personalize this section.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
