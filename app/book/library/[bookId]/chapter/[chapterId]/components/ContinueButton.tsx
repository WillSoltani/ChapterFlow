"use client";

import { ArrowRight } from "lucide-react";

type ContinueButtonProps = {
  ready: boolean;
  onClick: () => void;
  readyText: string;
  lockedText?: string;
  /** Scroll percent 0-100 */
  scrollPercent?: number;
  /** Time on phase in seconds */
  timeOnPhase?: number;
  /** Minimum seconds required */
  minTime?: number;
  /** Minimum scroll percent (0-1) required */
  minScroll?: number;
};

function buildLockedLabel(
  fallback: string,
  scrollPercent?: number,
  timeOnPhase?: number,
  minTime?: number,
  minScroll?: number
): string {
  const minScrollPct = typeof minScroll === "number" ? Math.round(minScroll * 100) : 0;
  const haveTime = typeof timeOnPhase === "number" && typeof minTime === "number" && minTime > 0;
  const haveScroll = typeof scrollPercent === "number" && minScrollPct > 0;

  const timeRatio = haveTime ? (timeOnPhase as number) / (minTime as number) : 0;
  const scrollRatio = haveScroll ? (scrollPercent as number) / minScrollPct : 0;

  // Prefer the metric that's closer to (or above) completion
  const preferScroll = haveScroll && scrollRatio >= timeRatio && scrollRatio > 0.5;

  if (preferScroll) {
    return `Reading… ${Math.min(100, Math.round(scrollPercent as number))}% scrolled`;
  }
  if (haveTime) {
    return `Reading… ${Math.min(minTime as number, Math.floor(timeOnPhase as number))}s / ${minTime}s`;
  }
  if (haveScroll) {
    return `Reading… ${Math.min(100, Math.round(scrollPercent as number))}% scrolled`;
  }
  return fallback;
}

export function ContinueButton({
  ready,
  onClick,
  readyText,
  lockedText = "Keep reading to continue...",
  scrollPercent,
  timeOnPhase,
  minTime,
  minScroll,
}: ContinueButtonProps) {
  const label = ready
    ? readyText
    : buildLockedLabel(lockedText, scrollPercent, timeOnPhase, minTime, minScroll);

  const button = (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        disabled={!ready}
        onClick={onClick}
        className={[
          "flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)]",
          ready
            ? "bg-(--cr-accent) text-(--cr-text-inverse) shadow-[0_0_0_0_rgba(77,182,172,0.4)] hover:shadow-[0_4px_20px_rgba(77,182,172,0.3)] hover:opacity-90"
            : "cursor-not-allowed bg-(--cr-bg-surface-3) text-(--cr-text-disabled)",
        ].join(" ")}
        style={
          ready
            ? { animation: "cr-pulse-glow 2s ease-in-out infinite" }
            : undefined
        }
      >
        {ready ? (
          <>
            {label}
            <ArrowRight className="h-5 w-5" />
          </>
        ) : (
          label
        )}
      </button>
    </div>
  );

  return button;
}
