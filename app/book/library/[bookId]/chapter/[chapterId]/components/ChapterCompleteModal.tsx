"use client";

import { useMemo, useState } from "react";
import { Share2, Check, X, Trophy } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import type { LoopPipelineResult } from "@/app/book/_lib/flow-points-economy";

interface Props {
  open: boolean;
  onClose: () => void;
  chapterTitle: string;
  chapterNumber: number;
  quizScore: number;
  /** Award pipeline from the quiz pass; drives the IP breakdown, achievements
   *  row, and streak. Null on a provisional/offline pass (no fake IP shown). */
  loopPipeline: LoopPipelineResult | null;
  hasNextChapter: boolean;
  onNext: () => void;
  onLibrary: () => void;
  onShare?: () => Promise<"shared" | "copied" | "unsupported"> | void;
  children?: React.ReactNode;
}

type IPLine = {
  key: string;
  label: string;
  amount: number;
  emoji: string;
  highlight?: boolean;
};

/** Build the non-achievement IP breakdown lines. Achievements are shown
 *  separately as a badge row, so they're excluded here to avoid double-listing,
 *  but their IP is still part of the grand total. */
function buildIPLines(p: LoopPipelineResult | null): IPLine[] {
  if (!p) return [];
  const out: IPLine[] = [];
  if (p.quizPassIP > 0) out.push({ key: "quiz", label: "Quiz pass", amount: p.quizPassIP, emoji: "✅" });
  if (p.perfectBonusIP > 0)
    out.push({ key: "perfect", label: "Perfect score bonus", amount: p.perfectBonusIP, emoji: "💯", highlight: true });
  if (p.loopCompleteIP > 0) out.push({ key: "loop", label: "Loop complete", amount: p.loopCompleteIP, emoji: "🔄" });
  if (p.bookCompleteIP > 0)
    out.push({ key: "book", label: "Book complete", amount: p.bookCompleteIP, emoji: "📖", highlight: true });
  if (p.streak.streakDayIP > 0)
    out.push({ key: "streak-day", label: `Day ${p.streak.currentStreak} streak`, amount: p.streak.streakDayIP, emoji: "🔥" });
  p.streak.milestones.forEach((m) =>
    out.push({ key: `milestone-${m.days}`, label: `${m.days}-day streak milestone`, amount: m.ip, emoji: "🏅", highlight: true }),
  );
  if (p.streak.welcomeBackIP > 0)
    out.push({ key: "welcome-back", label: "Welcome back", amount: p.streak.welcomeBackIP, emoji: "👋" });
  if (p.tier.advanced && p.tier.advancementIP > 0)
    out.push({ key: "tier", label: `New tier: ${p.tier.displayName ?? p.tier.newTier ?? ""}`, amount: p.tier.advancementIP, emoji: "⭐", highlight: true });
  if (p.insightSpark.triggered && p.insightSpark.amount > 0)
    out.push({ key: "spark", label: "Insight Spark", amount: p.insightSpark.amount, emoji: "✨", highlight: true });
  return out;
}

export function ChapterCompleteModal({
  open,
  onClose,
  chapterTitle,
  chapterNumber,
  quizScore,
  loopPipeline,
  hasNextChapter,
  onNext,
  onLibrary,
  onShare,
  children,
}: Props) {
  const [shareFeedback, setShareFeedback] = useState(false);

  const lines = useMemo(() => buildIPLines(loopPipeline), [loopPipeline]);
  const achievements = loopPipeline?.achievements ?? [];
  const totalIP = useMemo(
    () => lines.reduce((sum, l) => sum + l.amount, 0) + achievements.reduce((sum, a) => sum + a.ip, 0),
    [lines, achievements],
  );
  const streak = loopPipeline?.streak.currentStreak ?? 0;

  const phases: Array<{ label: string; score?: number }> = [
    { label: "Summary" },
    { label: "Examples" },
    { label: "Quiz", score: quizScore },
  ];

  return (
    <Dialog open={open} onClose={onClose} size="xl" labelledBy="chapter-complete-title">
      <div className="relative p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close and return to the chapter"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-3) hover:text-(--cr-text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 text-center">
          <div className="mb-2 text-[40px]">{"✅"}</div>
          <h2
            id="chapter-complete-title"
            className="mb-1 text-[22px] font-bold text-(--cr-text-heading)"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Chapter {chapterNumber} Complete
          </h2>
          <p className="text-[14px] text-(--cr-text-disabled)">{chapterTitle}</p>
        </div>

        <div className="mb-5 flex flex-wrap justify-center gap-2">
          {phases.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium text-(--cr-accent)"
              style={{
                background: "color-mix(in srgb, var(--cr-accent) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--cr-accent) 26%, transparent)",
              }}
            >
              {"✓"} {p.label}
              {p.score !== undefined ? ` ${p.score}%` : ""}
            </span>
          ))}
        </div>

        {/* Headline stats — streak + total IP earned (shown once, here). */}
        {(streak > 1 || totalIP > 0) && (
          <div className="mb-5 flex justify-center gap-8 text-center">
            {streak > 1 && (
              <div>
                <p className="text-[22px] font-bold text-(--cr-accent)">{"🔥"} {streak}</p>
                <p className="text-[11px] text-(--cr-text-disabled)">chapter streak</p>
              </div>
            )}
            {totalIP > 0 && (
              <div>
                <p className="text-[22px] font-bold text-(--cr-accent)">+{totalIP}</p>
                <p className="text-[11px] text-(--cr-text-disabled)">insight points</p>
              </div>
            )}
          </div>
        )}

        {/* IP breakdown — how the points were earned. */}
        {lines.length > 0 && (
          <div
            className="mb-5 rounded-xl p-4 text-left"
            style={{
              background: "color-mix(in srgb, var(--cr-accent) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--cr-accent) 20%, transparent)",
            }}
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--cr-text-disabled)">
              How you earned it
            </p>
            <div className="space-y-2">
              {lines.map((line) => (
                <div key={line.key} className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-(--cr-text-secondary)">
                    <span aria-hidden="true">{line.emoji}</span>
                    <span className={line.highlight ? "font-semibold" : ""}>{line.label}</span>
                  </span>
                  <span
                    className={[
                      "font-bold tabular-nums",
                      line.highlight ? "text-(--cr-accent)" : "text-(--cr-text-heading)",
                    ].join(" ")}
                  >
                    +{line.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements unlocked — a calm in-modal row (no detached toasts). */}
        {achievements.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--cr-text-disabled)">
              <Trophy className="h-3.5 w-3.5 text-(--cr-accent)" />
              {achievements.length === 1 ? "Achievement unlocked" : `${achievements.length} achievements unlocked`}
            </p>
            <div className="flex flex-col gap-2">
              {achievements.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-bg-surface-3) p-3"
                >
                  <div className="text-[24px] leading-none" aria-hidden="true">{"🏆"}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-(--cr-text-heading)">{a.name}</p>
                    {a.celebrationCopy && (
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-(--cr-text-secondary)">{a.celebrationCopy}</p>
                    )}
                  </div>
                  {a.ip > 0 && (
                    <span className="shrink-0 text-[12px] font-bold tabular-nums text-(--cr-accent)">+{a.ip} IP</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {children && (
          <div className="mb-6 mt-2 border-t border-(--cr-glass-border) pt-6">{children}</div>
        )}

        <div className="flex flex-col gap-3">
          {hasNextChapter && (
            <button
              type="button"
              onClick={onNext}
              className="w-full rounded-full bg-(--cr-accent) py-3.5 text-[15px] font-semibold text-(--cr-text-inverse) transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)] focus-visible:ring-offset-2"
            >
              Open Next Chapter &rarr;
            </button>
          )}
          {onShare && (
            <button
              type="button"
              onClick={async () => {
                const result = await onShare();
                if (result === "shared" || result === "copied") {
                  setShareFeedback(true);
                  setTimeout(() => setShareFeedback(false), 2000);
                }
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)] focus-visible:ring-offset-2"
              style={{
                borderWidth: "1px",
                borderColor: "color-mix(in srgb, var(--cr-accent) 25%, transparent)",
                background: "var(--cr-accent-muted)",
                color: "var(--cr-accent)",
              }}
            >
              {shareFeedback ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {shareFeedback ? "Copied!" : `Share ${hasNextChapter ? "Chapter" : "Book"} Completion`}
            </button>
          )}
          <button
            type="button"
            onClick={onLibrary}
            className="w-full rounded-full border border-(--cr-glass-border) py-3 text-[14px] font-medium text-(--cr-text-secondary) transition hover:text-(--cr-text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)] focus-visible:ring-offset-2"
          >
            Back to Library
          </button>
        </div>
      </div>
    </Dialog>
  );
}
