"use client";

import { Brain, Lightbulb, Target } from "lucide-react";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

interface PhonePhaseInterstitialProps {
  from: ChapterTab;
  to: ChapterTab;
}

const MESSAGES: Record<
  string,
  { text: string; icon: "lightbulb" | "brain" | "target" }
> = {
  "summary-examples": {
    text: "Now let's see this in action",
    icon: "lightbulb",
  },
  "examples-quiz": {
    text: "Ready to test your understanding?",
    icon: "brain",
  },
  "quiz-practice": {
    text: "Time to put it into practice",
    icon: "target",
  },
};

/**
 * Compact in-screen mirror of the in-app PhaseInterstitial.
 *
 * Renders absolutely-positioned over the phone screen content (NOT
 * fixed to viewport like the real one) so it stays clipped inside
 * the phone bezel. Same `cr-interstitial-in` animation, same `cr-glass-card`
 * styling, same icon set, same message strings.
 *
 * The parent (PhoneReaderShell) handles the show/hide timing.
 */
export function PhonePhaseInterstitial({
  from,
  to,
}: PhonePhaseInterstitialProps) {
  const key = `${from}-${to}`;
  const config = MESSAGES[key];

  if (!config) return null;

  const Icon =
    config.icon === "lightbulb"
      ? Lightbulb
      : config.icon === "brain"
        ? Brain
        : Target;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center"
      role="status"
      aria-live="polite"
      style={{ pointerEvents: "none" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(15, 15, 26, 0.85)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />

      {/* Card */}
      <div
        className="relative cr-glass-card flex flex-col items-center text-center"
        style={{
          padding: "16px 18px",
          borderRadius: 12,
          maxWidth: "75%",
          gap: 6,
          animation: "cr-interstitial-in 400ms ease-out forwards",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 28,
            height: 28,
            background: "var(--cr-accent-muted)",
          }}
        >
          <Icon
            className="h-3.5 w-3.5"
            style={{ color: "var(--cr-accent)" }}
          />
        </div>
        <p
          className="text-[10px] font-semibold"
          style={{
            color: "var(--cr-text-heading)",
            lineHeight: 1.35,
          }}
        >
          {config.text}
        </p>
      </div>
    </div>
  );
}
