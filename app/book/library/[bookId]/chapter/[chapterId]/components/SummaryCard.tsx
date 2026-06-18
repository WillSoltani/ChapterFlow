"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import { Bookmark, BookmarkPlus } from "lucide-react";
import type { ChapterSummaryBlock } from "@/app/book/data/bookChapters";
import type { LearningMode } from "@/app/book/settings/types/settings";

function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*/g, "");
}

type SummaryCardProps = {
  blocks: ChapterSummaryBlock[];
  takeaways: string[];
  recap?: string[];
  onSaveTakeaways: () => void;
  bookmarkedTakeaways: Set<number>;
  onToggleBookmarkTakeaway: (index: number) => void;
  fontScaleClass: string;
  learningMode?: LearningMode;
  activationPrompt?: string;
  selfCheckPrompts?: string[];
  reflectionPrompts?: string[];
  closingPrompt?: string;
  /** Rendered inside the footer action cluster alongside Save — e.g. AudioPlayer launcher. */
  footerAction?: React.ReactNode;
  /** Called once after mount when the recap is rendered. Lets the host preserve
   *  "user has seen the recap" signals (badges, analytics) now that the recap
   *  is always visible rather than behind a toggle. */
  onRecapVisible?: () => void;
};

export function SummaryCard({
  blocks,
  takeaways,
  recap,
  onSaveTakeaways,
  bookmarkedTakeaways,
  onToggleBookmarkTakeaway,
  fontScaleClass,
  learningMode = "standard",
  activationPrompt,
  selfCheckPrompts,
  reflectionPrompts,
  closingPrompt,
  footerAction,
  onRecapVisible,
}: SummaryCardProps) {
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set());
  const [autoExpanded, setAutoExpanded] = useState<Set<string>>(new Set());
  const prevMode = useRef<string | null>(null);

  const paragraphs = blocks.filter((b) => b.type === "paragraph");
  const bullets = blocks.filter(
    (b): b is Extract<ChapterSummaryBlock, { type: "bullet" }> => b.type === "bullet"
  );
  const prefersReducedMotion = useReducedMotion();

  // Signal to the host that the recap is visible (it's always-on now, no toggle).
  // Fires once when the card mounts with recap content — preserves the legacy
  // `showRecap` flag that badges/analytics rely on.
  const recapHasContent = (recap?.length ?? 0) > 0;
  useEffect(() => {
    if (recapHasContent && onRecapVisible) {
      onRecapVisible();
    }
  }, [recapHasContent, onRecapVisible]);

  useEffect(() => {
    if (learningMode === prevMode.current) return;

    if (learningMode === "guided") {
      const ids = bullets.filter((b) => b.detail).map((b) => b.id);
      const newAuto = new Set(ids.filter((id) => !manuallyExpanded.has(id)));
      setAutoExpanded(newAuto);
    } else if (prevMode.current === "guided") {
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
    setAutoExpanded((prev) => {
      if (!prev.has(blockId)) return prev;
      const next = new Set(prev);
      next.delete(blockId);
      return next;
    });
  }, []);

  const eyebrow =
    "text-[11px] font-medium uppercase tracking-[0.18em] text-(--cr-text-secondary) mb-3";

  return (
    <div className="cr-reading-content space-y-10">
      {/* Challenge mode banner — functional indicator, kept minimal */}
      {learningMode === "challenge" && (
        <div
          className="text-xs text-(--cr-text-secondary)"
          style={{ animation: "cr-card-enter 200ms ease-out" }}
        >
          <span className="mr-1.5">{"\uD83C\uDFC6"}</span>
          Challenge mode — no retries on the quiz
        </div>
      )}

      {/* A. Activation Prompt — quiet italic line above the prose */}
      {activationPrompt && (
        <p className="italic text-sm text-(--cr-text-secondary)">
          <span className="not-italic font-medium text-(--cr-accent) mr-1.5">
            Before you read —
          </span>
          {activationPrompt}
        </p>
      )}

      {/* B. Chapter prose — the hero. No card chrome, no heading. */}
      {paragraphs.length > 0 && (
        <section data-phase-heading aria-label="Chapter breakdown" className="space-y-5">
          {paragraphs.map((block) => (
            <p
              key={block.id}
              className={`text-(--cr-text-primary) ${fontScaleClass}`}
            >
              {block.text}
            </p>
          ))}
        </section>
      )}

      {/* C. Key Takeaways — quiet numbered list */}
      {bullets.length > 0 && (
        <section>
          <p className={eyebrow}>
            Key Takeaways
            {bookmarkedTakeaways.size > 0 && (
              <span className="ml-2 text-[11px] font-normal normal-case tracking-normal text-(--cr-text-disabled)">
                · {bookmarkedTakeaways.size} saved
              </span>
            )}
          </p>

          <ol className="list-none space-y-5 p-0">
            {bullets.map((block, index) => {
              const open = isExpanded(block.id);
              const number = index + 1;
              const bookmarked = bookmarkedTakeaways.has(index);

              return (
                <li
                  key={block.id}
                  className="flex gap-4"
                >
                  <span
                    aria-hidden="true"
                    className="shrink-0 pt-0.5 text-sm font-medium text-(--cr-accent) tabular-nums"
                  >
                    {number}.
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <p
                        className={[
                          "flex-1",
                          bookmarked
                            ? "font-medium text-(--cr-text-heading)"
                            : "text-(--cr-text-primary)",
                          fontScaleClass,
                        ].join(" ")}
                      >
                        {stripMarkdownBold(block.text)}
                      </p>
                      <button
                        type="button"
                        onClick={() => onToggleBookmarkTakeaway(index)}
                        className={[
                          "shrink-0 mt-0.5 rounded p-0.5 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cr-accent-glow)",
                          bookmarked
                            ? "opacity-100 text-(--cr-accent)"
                            // Subtle discoverable affordance on all devices; fades in on hover/focus.
                            : "opacity-40 hover:opacity-100 focus:opacity-100 text-(--cr-text-disabled) hover:text-(--cr-text-secondary)",
                        ].join(" ")}
                        aria-label={bookmarked ? "Remove bookmark" : "Bookmark this takeaway"}
                      >
                        <Bookmark
                          className="h-4 w-4"
                          fill={bookmarked ? "currentColor" : "none"}
                        />
                      </button>
                    </div>

                    {block.detail && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggle(block.id)}
                          aria-expanded={open}
                          className="mt-1.5 text-sm text-(--cr-text-secondary) underline-offset-4 hover:text-(--cr-text-heading) hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cr-accent-glow) rounded"
                        >
                          {open ? "Show less" : "Show more"}
                        </button>

                        <motion.div
                          initial={false}
                          animate={{
                            height: open ? "auto" : 0,
                            opacity: open ? 1 : 0,
                          }}
                          transition={{ duration: prefersReducedMotion ? 0 : DUR.fast, ease: EASE.standard }}
                          className="overflow-hidden"
                        >
                          <p className={`mt-3 text-(--cr-text-secondary) ${fontScaleClass}`}>
                            {block.detail}
                          </p>
                        </motion.div>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* D. Reflect — comprehension self-checks + deeper reflection questions, merged */}
      {((selfCheckPrompts?.length ?? 0) > 0 || (reflectionPrompts?.length ?? 0) > 0) && (
        <section>
          <p className={eyebrow}>Reflect</p>
          <div className="border-l-[3px] border-(--cr-glass-border) pl-5 ml-1 space-y-3">
            {[...(selfCheckPrompts ?? []), ...(reflectionPrompts ?? [])].map((prompt, index) => (
              <p
                key={`${index}-${prompt}`}
                className={`text-(--cr-text-secondary) ${fontScaleClass}`}
              >
                {prompt}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* E. 1-Minute Recap — always visible, quiet */}
      {recap && recap.length > 0 && (
        <section>
          <p className={eyebrow}>In one minute</p>
          <div className="space-y-3">
            {recap.map((item, index) => (
              <p
                key={`${index}-${item}`}
                className={`text-sm text-(--cr-text-secondary) ${fontScaleClass}`}
              >
                {item}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* F. Closing Prompt — a single parting thought, quiet and italic */}
      {closingPrompt && (
        <section>
          <p className={eyebrow}>A closing thought</p>
          <p className={`italic text-(--cr-text-heading) ${fontScaleClass}`}>
            {closingPrompt}
          </p>
        </section>
      )}

      {/* G. Quick Reference — only rendered when user has bookmarked takeaways */}
      {takeaways.length > 0 && bookmarkedTakeaways.size > 0 && (
        <section>
          <p className={eyebrow}>Your Quick Reference</p>
          <div className="flex flex-wrap gap-2">
            {takeaways
              .filter((_, i) => bookmarkedTakeaways.has(i))
              .map((takeaway) => (
                <span
                  key={takeaway}
                  className="rounded-full border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2 text-xs font-semibold text-(--cr-accent)"
                >
                  {stripMarkdownBold(takeaway)}
                </span>
              ))}
          </div>
        </section>
      )}

      {/* H. Footer action cluster — Save + AudioPlayer + bookmark state. Quiet, consistent. */}
      {/* (Rendered last regardless of which content sections are present above.) */}
      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-(--cr-glass-border)">
        <button
          type="button"
          onClick={onSaveTakeaways}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cr-accent-glow)"
        >
          <BookmarkPlus className="h-4 w-4" />
          {bookmarkedTakeaways.size > 0 ? "Save bookmarked to notes" : "Save takeaways to notes"}
        </button>
        {footerAction}
        {bookmarkedTakeaways.size > 0 && (
          <span className="ml-auto text-xs text-(--cr-text-disabled)">
            {bookmarkedTakeaways.size} bookmarked
          </span>
        )}
      </div>
    </div>
  );
}
