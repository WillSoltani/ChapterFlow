"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion, animate } from "framer-motion";
import { DUR } from "@/lib/motion";
import {
  Share2,
  Check,
  X,
  Trophy,
  Flame,
  Sparkles,
  BookOpen,
  Medal,
  Star,
  RotateCcw,
  Hand,
  ChevronDown,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Confetti } from "@/components/ui/Confetti";
import type { LoopPipelineResult } from "@/app/book/_lib/flow-points-economy";
import type { ChapterApplicationState } from "@/app/app/api/book/_lib/types";
import { getApplicationAxisView } from "@/app/book/_lib/application-axis";

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
  /** Two-axis completion (feedback #4): the chapter's DERIVED application state.
   *  Display/celebration only — gates nothing, awards no IP. Defaults to "none". */
  applicationState?: ChapterApplicationState | null;
  /** Whether a CommitmentPrompt will actually render below (children). The "none"
   *  invitation points at that prompt, so it's suppressed when none exists (a chapter
   *  without if-then plans) to avoid copy that dangles. Defaults to true. */
  commitmentAvailable?: boolean;
  children?: React.ReactNode;
}

type IconCmp = typeof Check;

type IPLine = {
  key: string;
  label: string;
  amount: number;
  Icon: IconCmp;
  highlight?: boolean;
};

/** Build the non-achievement IP breakdown lines. Achievements are shown
 *  separately as a badge row, so they're excluded here to avoid double-listing,
 *  but their IP is still part of the grand total. Each line carries a crafted
 *  lucide mark (not an OS emoji) so the vocabulary matches the brand. */
function buildIPLines(p: LoopPipelineResult | null): IPLine[] {
  if (!p) return [];
  const out: IPLine[] = [];
  if (p.quizPassIP > 0) out.push({ key: "quiz", label: "Quiz pass", amount: p.quizPassIP, Icon: Check });
  if (p.perfectBonusIP > 0)
    out.push({ key: "perfect", label: "Perfect score bonus", amount: p.perfectBonusIP, Icon: Star, highlight: true });
  if (p.loopCompleteIP > 0) out.push({ key: "loop", label: "Loop complete", amount: p.loopCompleteIP, Icon: RotateCcw });
  if (p.bookCompleteIP > 0)
    out.push({ key: "book", label: "Book complete", amount: p.bookCompleteIP, Icon: BookOpen, highlight: true });
  if (p.streak.streakDayIP > 0)
    out.push({ key: "streak-day", label: `Day ${p.streak.currentStreak} streak`, amount: p.streak.streakDayIP, Icon: Flame });
  p.streak.milestones.forEach((m) =>
    out.push({ key: `milestone-${m.days}`, label: `${m.days}-day streak milestone`, amount: m.ip, Icon: Medal, highlight: true }),
  );
  if (p.streak.welcomeBackIP > 0)
    out.push({ key: "welcome-back", label: "Welcome back", amount: p.streak.welcomeBackIP, Icon: Hand });
  if (p.tier.advanced && p.tier.advancementIP > 0)
    out.push({ key: "tier", label: `New tier: ${p.tier.displayName ?? p.tier.newTier ?? ""}`, amount: p.tier.advancementIP, Icon: Star, highlight: true });
  if (p.insightSpark.triggered && p.insightSpark.amount > 0)
    out.push({ key: "spark", label: "Insight Spark", amount: p.insightSpark.amount, Icon: Sparkles, highlight: true });
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
  applicationState,
  commitmentAvailable = true,
  children,
}: Props) {
  // Default-guard: a missing/null prop reads as "none" (the invitation), never undefined.
  const appState: ChapterApplicationState = applicationState ?? "none";
  const appView = getApplicationAxisView(appState);
  const [shareFeedback, setShareFeedback] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  // The one motion guard the receipt never had: reduced motion renders the final
  // celebration instantly (seal at rest, +IP at full value, no burst, no spring).
  const reduced = useReducedMotion();

  const lines = useMemo(() => buildIPLines(loopPipeline), [loopPipeline]);
  const achievements = useMemo(() => loopPipeline?.achievements ?? [], [loopPipeline]);
  const totalIP = useMemo(
    () => lines.reduce((sum, l) => sum + l.amount, 0) + achievements.reduce((sum, a) => sum + a.ip, 0),
    [lines, achievements],
  );
  const streak = loopPipeline?.streak.currentStreak ?? 0;

  // Mount-time IP count-up in the Satoshi display face. CounterAnimation isn't a
  // fit here (it forces JetBrains mono and triggers on scroll-into-view, but this
  // modal is already on screen and the spec wants the display face) — so a small
  // local count-up. Reduced motion → jump straight to the final value.
  const [shownIP, setShownIP] = useState(reduced ? totalIP : 0);
  useEffect(() => {
    if (reduced) {
      setShownIP(totalIP);
      return;
    }
    const controls = animate(0, totalIP, {
      duration: DUR.reveal,
      ease: "easeOut",
      onUpdate: (v) => setShownIP(Math.round(v)),
    });
    return () => controls.stop();
  }, [totalIP, reduced]);

  const phases: Array<{ label: string; score?: number }> = [
    { label: "Summary" },
    { label: "Examples" },
    { label: "Quiz", score: quizScore },
  ];

  return (
    <>
      {/* The one celebration burst that paints OVER the modal: gold-tilted,
       *  fire-once on mount (mounting == the modal opening). Rendered as a sibling
       *  of the Dialog — NOT inside its panel — because the panel keeps a framer
       *  transform even when settled, which would make this fixed canvas a clipped
       *  child of the ~600px panel box. z:130 paints it above the modal's z:100.
       *  Self-no-ops under reduced motion; gated so the canvas never even mounts. */}
      {!reduced && open && (
        <Confetti
          origin="center"
          particleCount={90}
          colors={["--accent-gold", "color-mix(in srgb, var(--accent-gold) 60%, white)"]}
          zIndex={130}
        />
      )}

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

          {/* Crafted gold seal (springs in) + title — replaces the 40px ✅ string. */}
          <div className="mb-6 text-center">
            <motion.div
              initial={reduced ? false : { scale: 0.6, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 18 }}
              className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background: "color-mix(in srgb, var(--accent-gold) 14%, transparent)",
                border: "2px solid color-mix(in srgb, var(--accent-gold) 40%, transparent)",
              }}
            >
              <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" style={{ color: "var(--accent-gold)" }} />
            </motion.div>
            <h2
              id="chapter-complete-title"
              className="mb-1 text-[22px] font-bold text-(--cr-text-heading)"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Chapter {chapterNumber} Complete
            </h2>
            <p className="text-[14px] text-(--cr-text-disabled)">{chapterTitle}</p>
          </div>

          {/* Lead with emotion — the big gold IP count-up and the loud gold streak
           *  are the first thing the eye lands on (the receipt is collapsed below). */}
          {(totalIP > 0 || streak > 1) && (
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              {totalIP > 0 && (
                <div>
                  <p
                    className="text-[40px] font-bold leading-none tabular-nums"
                    style={{ fontFamily: "var(--font-display)", color: "var(--cf-gold-text)" }}
                  >
                    +{shownIP}
                  </p>
                  <p className="mt-1 text-[11px] text-(--cr-text-disabled)">insight points earned</p>
                </div>
              )}
              {streak > 1 && (
                <div>
                  <span
                    className="flex items-center justify-center gap-1.5 text-[34px] font-bold leading-none"
                    style={{ fontFamily: "var(--font-display)", color: "var(--cf-gold-text)" }}
                  >
                    <Flame className="h-7 w-7" aria-hidden="true" style={{ color: "var(--accent-gold)" }} />
                    {streak}
                  </span>
                  <p className="mt-1 text-[11px] text-(--cr-text-disabled)">day streak</p>
                </div>
              )}
            </div>
          )}

          {/* Phases done — these stay CYAN: they're "the work you did", not the win. */}
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
                <Check className="h-3 w-3" aria-hidden="true" />
                {p.label}
                {p.score !== undefined ? ` ${p.score}%` : ""}
              </span>
            ))}
          </div>

          {/* Achievements unlocked — a calm in-modal row (no detached toasts). */}
          {achievements.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--cr-text-disabled)">
                <Trophy className="h-3.5 w-3.5" style={{ color: "var(--accent-gold)" }} aria-hidden="true" />
                {achievements.length === 1 ? "Achievement unlocked" : `${achievements.length} achievements unlocked`}
              </p>
              <div className="flex flex-col gap-2">
                {achievements.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-bg-surface-3) p-3"
                  >
                    <Trophy className="h-5 w-5 shrink-0" style={{ color: "var(--accent-gold)" }} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-(--cr-text-heading)">{a.name}</p>
                      {a.celebrationCopy && (
                        <p className="mt-0.5 line-clamp-2 text-[12px] text-(--cr-text-secondary)">{a.celebrationCopy}</p>
                      )}
                    </div>
                    {a.ip > 0 && (
                      <span className="shrink-0 text-[12px] font-bold tabular-nums" style={{ color: "var(--cf-gold-text)" }}>
                        +{a.ip} IP
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* "How you earned it" — the honest IP ledger, collapsed by default so the
           *  celebration isn't buried under a receipt. All data preserved. */}
          {lines.length > 0 && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setLedgerOpen((o) => !o)}
                aria-expanded={ledgerOpen}
                aria-controls="ip-ledger"
                className="cf-pressable flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--cr-text-disabled) transition hover:text-(--cr-text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)] focus-visible:ring-offset-2"
                style={{
                  background: "color-mix(in srgb, var(--accent-gold) 6%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent-gold) 18%, transparent)",
                }}
              >
                <span>How you earned it (+{totalIP})</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${ledgerOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {ledgerOpen && (
                <div
                  id="ip-ledger"
                  className="mt-2 rounded-xl p-4 text-left"
                  style={{
                    background: "color-mix(in srgb, var(--accent-gold) 6%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--accent-gold) 18%, transparent)",
                  }}
                >
                  <div className="space-y-2">
                    {lines.map((line) => (
                      <div key={line.key} className="flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-2 text-(--cr-text-secondary)">
                          <line.Icon
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                            style={{ color: line.highlight ? "var(--accent-gold)" : "var(--cr-text-disabled)" }}
                          />
                          <span className={line.highlight ? "font-semibold" : ""}>{line.label}</span>
                        </span>
                        <span
                          className="font-bold tabular-nums"
                          style={{ color: line.highlight ? "var(--cf-gold-text)" : "var(--cr-text-heading)" }}
                        >
                          +{line.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Two-axis completion (feedback #4): pair "Learned" (this quiz pass) with
           *  "Applied" (followed-through commitment), so applying the chapter reads as
           *  the real finish line. The application axis is DERIVED / read-only — it
           *  gates nothing and the quiz pass already unlocked what's next. The "none"
           *  invitation points at the CommitmentPrompt rendered just below in children;
           *  it hides once a commitment exists, so it's correct under either ordering. */}
          <div className="mb-5 flex flex-col gap-2" role="group" aria-label="Completion status">
            <div
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13px] text-(--cr-text-heading)"
              style={{
                background: "color-mix(in srgb, var(--accent-emerald) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent-emerald) 24%, transparent)",
              }}
            >
              <Check
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
                style={{ color: "var(--accent-emerald)" }}
              />
              <span>
                <strong className="font-semibold">Learned</strong> — you understood it (quiz passed).
              </span>
            </div>

            {/* The "none" invitation (isInvitation) points at the CommitmentPrompt
             *  rendered below in children; show it only when that prompt will actually
             *  render (commitmentAvailable). committed/applied always show. */}
            {(!appView.isInvitation || commitmentAvailable) &&
              (appView.tone === "applied" ? (
              <div
                className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13px] font-medium"
                style={{
                  background: "color-mix(in srgb, var(--accent-gold) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent-gold) 30%, transparent)",
                  color: "var(--cf-gold-text)",
                }}
                aria-label={`${appView.label} — ${appView.description}`}
              >
                <span className="flex shrink-0" aria-hidden="true">
                  <Check className="h-4 w-4" />
                  <Check className="-ml-2 h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold">{appView.label}</strong> — {appView.description}
                </span>
              </div>
            ) : appView.tone === "committed" ? (
              <div
                className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13px] text-(--cr-text-secondary)"
                style={{
                  background: "color-mix(in srgb, var(--cr-accent) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--cr-accent) 24%, transparent)",
                }}
              >
                <Check
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                  style={{ color: "var(--cr-accent)" }}
                />
                <span>
                  <strong className="font-semibold text-(--cr-text-heading)">{appView.label}</strong>{" "}
                  — {appView.description}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13px] text-(--cr-text-secondary)"
                style={{
                  background: "var(--cr-bg-surface-3)",
                  border: "1px dashed color-mix(in srgb, var(--cr-accent) 30%, transparent)",
                }}
              >
                <ChevronDown
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                  style={{ color: "var(--cr-accent)" }}
                />
                <span>
                  <strong className="font-semibold text-(--cr-text-heading)">{appView.label}</strong>{" "}
                  — {appView.description}
                </span>
              </div>
            ))}
          </div>

          {children && (
            <div className="mb-6 mt-2 border-t border-(--cr-glass-border) pt-6">{children}</div>
          )}

          <div className="flex flex-col gap-3">
            {hasNextChapter && (
              <button
                type="button"
                onClick={onNext}
                className="cf-pressable w-full rounded-full py-3.5 text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)] focus-visible:ring-offset-2"
                style={{
                  // The single gold-gradient CTA — the reward action, visually
                  // distinct from every cyan "work" CTA. Dark gold-ink label clears
                  // ≥4.5:1 across the whole gradient (gold is theme-identical).
                  background: "linear-gradient(135deg, var(--accent-gold), color-mix(in srgb, var(--accent-gold) 80%, black))",
                  color: "color-mix(in srgb, var(--accent-gold) 14%, black)",
                  boxShadow: "var(--cf-shadow-lg)",
                }}
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
    </>
  );
}
