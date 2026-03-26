"use client";

import { useEffect, useState } from "react";
import { Brain, Lightbulb } from "lucide-react";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

type PhaseInterstitialProps = {
  from: ChapterTab;
  to: ChapterTab;
  onComplete: () => void;
};

const MESSAGES: Record<string, { text: string; icon: "lightbulb" | "brain" }> = {
  "summary-examples": {
    text: "Now let's see this in action",
    icon: "lightbulb",
  },
  "examples-quiz": {
    text: "Ready to test your understanding?",
    icon: "brain",
  },
};

export function PhaseInterstitial({ from, to, onComplete }: PhaseInterstitialProps) {
  const [phase, setPhase] = useState<"in" | "out">("in");
  const key = `${from}-${to}`;
  const config = MESSAGES[key];

  useEffect(() => {
    // Auto-advance after 1.5s
    const timer = setTimeout(() => {
      setPhase("out");
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === "out") {
      const timer = setTimeout(onComplete, 400);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  // No interstitial for this transition — complete on next tick via effect
  useEffect(() => {
    if (!config) {
      onComplete();
    }
  }, [config, onComplete]);

  if (!config) {
    return null;
  }

  const Icon = config.icon === "lightbulb" ? Lightbulb : Brain;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onComplete}
      role="status"
      aria-live="polite"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-(--cr-bg-root)/80 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative z-10 flex max-w-md flex-col items-center gap-4 rounded-2xl border border-(--cr-glass-border) bg-(--cr-glass-card) px-10 py-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        style={{
          animation:
            phase === "in"
              ? "cr-interstitial-in 400ms ease-out forwards"
              : "cr-interstitial-out 400ms ease-in forwards",
        }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--cr-accent-muted)">
          <Icon className="h-7 w-7 text-(--cr-accent)" />
        </div>
        <p className="text-xl font-semibold text-(--cr-text-heading)">
          {config.text}
        </p>
        <p className="text-sm text-(--cr-text-secondary)">
          Tap anywhere to continue
        </p>
      </div>
    </div>
  );
}
