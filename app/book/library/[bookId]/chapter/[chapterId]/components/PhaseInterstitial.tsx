"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Brain, Lightbulb, Target } from "lucide-react";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

type PhaseInterstitialProps = {
  from: ChapterTab;
  to: ChapterTab;
  onComplete: () => void;
};

const MESSAGES: Record<string, { text: string; icon: "lightbulb" | "brain" | "target" }> = {
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

const FADE_IN_MS = 250;
const HOLD_MS = 400;
const FADE_OUT_MS = 250;

export function PhaseInterstitial({ from, to, onComplete }: PhaseInterstitialProps) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<"in" | "out">("in");
  const titleId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const key = `${from}-${to}`;
  const config = MESSAGES[key];

  // Reduced motion: skip overlay entirely
  useEffect(() => {
    if (prefersReducedMotion) {
      onComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  // No interstitial for this transition — complete immediately
  useEffect(() => {
    if (!config) {
      onComplete();
    }
  }, [config, onComplete]);

  // Save / restore focus
  useEffect(() => {
    if (prefersReducedMotion || !config) return;
    previousFocusRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    return () => {
      const el = previousFocusRef.current;
      if (el && typeof el.focus === "function") {
        el.focus({ preventScroll: true });
      }
    };
  }, [prefersReducedMotion, config]);

  // Auto-advance: fade-in → hold → fade-out
  useEffect(() => {
    if (prefersReducedMotion || !config) return;
    const holdTimer = setTimeout(() => setPhase("out"), FADE_IN_MS + HOLD_MS);
    return () => clearTimeout(holdTimer);
  }, [prefersReducedMotion, config]);

  useEffect(() => {
    if (phase === "out") {
      const timer = setTimeout(onComplete, FADE_OUT_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase, onComplete]);

  // Escape to dismiss
  useEffect(() => {
    if (prefersReducedMotion || !config) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onComplete();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [prefersReducedMotion, config, onComplete]);

  if (prefersReducedMotion || !config) {
    return null;
  }

  const Icon = config.icon === "lightbulb" ? Lightbulb : config.icon === "brain" ? Brain : Target;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onComplete}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-(--cr-bg-root)/80 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative z-10 flex max-w-md flex-col items-center gap-4 rounded-2xl border border-(--cr-glass-border) bg-(--cr-glass-card) px-10 py-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        style={{
          animation:
            phase === "in"
              ? `cr-interstitial-in ${FADE_IN_MS}ms ease-out forwards`
              : `cr-interstitial-out ${FADE_OUT_MS}ms ease-in forwards`,
        }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--cr-accent-muted)">
          <Icon className="h-7 w-7 text-(--cr-accent)" />
        </div>
        <p
          id={titleId}
          className="text-xl font-semibold text-(--cr-text-heading)"
        >
          {config.text}
        </p>
        <p className="text-sm text-(--cr-text-secondary)">
          Tap anywhere or press Esc to continue
        </p>
      </div>
    </div>
  );
}
