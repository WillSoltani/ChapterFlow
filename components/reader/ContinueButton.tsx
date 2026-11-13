"use client";

// Canonical shared reader control (WS3-001).

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

  // Calm primary: one solid accent button when ready, a quiet disabled one
  // (with the reason as its label) until the step has been read.
  const button = (
    <div className="mt-10 flex justify-center">
      <button
        type="button"
        disabled={!ready}
        onClick={onClick}
        className={[
          "cf-pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold transition-colors duration-200 sm:w-auto sm:min-w-72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-(--cr-bg-root) focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)]",
          ready
            ? "bg-(--cr-accent) text-(--cr-text-inverse) hover:bg-(--cr-accent-hover)"
            : "cursor-not-allowed bg-(--cr-bg-surface-3) text-(--cr-text-secondary)",
        ].join(" ")}
      >
        {label}
        {ready ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
      </button>
    </div>
  );

  return button;
}
