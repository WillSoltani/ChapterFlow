"use client";

import { ArrowRight } from "lucide-react";

type ContinueButtonProps = {
  ready: boolean;
  onClick: () => void;
  readyText: string;
  lockedText?: string;
  /**
   * Progress/threshold props are still accepted from the caller (which spreads
   * `getPhaseThresholds(...)` plus live progress) but are intentionally no
   * longer rendered — the locked label is comprehension-framed and hides the
   * raw time/scroll quota. The gate logic that uses these lives upstream.
   */
  scrollPercent?: number;
  timeOnPhase?: number;
  minTime?: number;
  minScroll?: number;
};

export function ContinueButton({
  ready,
  onClick,
  readyText,
  lockedText = "Take a moment with this section…",
}: ContinueButtonProps) {
  // Comprehension-framed locked copy: we intentionally hide the raw time/scroll
  // quota so the gate reads as "spend a moment with this section" rather than a
  // number to game. The gate logic itself (which uses the threshold props) is
  // unchanged and lives upstream.
  const label = ready ? readyText : lockedText;

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
