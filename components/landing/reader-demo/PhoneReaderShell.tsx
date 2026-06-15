"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import { getBookCoverPath } from "@/lib/book-covers";

import {
  DEMO_BOOK_AUTHOR,
  DEMO_BOOK_ID,
  DEMO_BOOK_TITLE,
  DEMO_CHAPTER_NUMBER,
  DEMO_CHAPTER_TITLE,
} from "./demoChapter";
import { PhonePhaseStepper } from "./PhonePhaseStepper";
import { PhonePhaseInterstitial } from "./PhonePhaseInterstitial";
import { PhoneSummaryView } from "./PhoneSummaryView";
import { PhoneExamplesView } from "./PhoneExamplesView";
import { PhoneQuizView } from "./PhoneQuizView";
import { PhonePracticeView } from "./PhonePracticeView";

const PHASE_ORDER: ChapterTab[] = ["summary", "examples", "quiz", "practice"];

const PHASE_DURATIONS_MS: Record<ChapterTab, number> = {
  summary: 7000,
  examples: 7500,
  quiz: 8500,
  practice: 6500,
};

const INTERSTITIAL_MS = 1200;

/**
 * The phone reader shell — choreographs a cinematic loop through the
 * 4 phases (Summary → Examples → Quiz → Practice → loop).
 *
 * Behavior:
 *   - Auto-loop with hover-to-pause (computes elapsed and freezes).
 *   - Click anywhere takes the loop offline; user can scroll the
 *     stacked phase column manually.
 *   - Phase interstitial cards appear for ~1.2s between phases,
 *     using the same `cr-interstitial-in` animation as in-app.
 *   - Respects `useReducedMotion` — if reduced, all 4 views render
 *     stacked, no autoplay.
 */
export function PhoneReaderShell() {
  const [phase, setPhase] = useState<ChapterTab>("summary");
  const [interstitialFrom, setInterstitialFrom] =
    useState<ChapterTab | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [hovered, setHovered] = useState(false);

  const prefersReducedMotion = useReducedMotion();

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interstitialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const phaseStartedAtRef = useRef<number>(0);
  const remainingMsRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const clearTimers = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    if (interstitialTimerRef.current) {
      clearTimeout(interstitialTimerRef.current);
      interstitialTimerRef.current = null;
    }
  }, []);

  const handleUserInteraction = useCallback(() => {
    if (userInteracted) return;
    setUserInteracted(true);
    setInterstitialFrom(null);
    clearTimers();
  }, [userInteracted, clearTimers]);

  // Phase advance loop (chained setTimeout)
  useEffect(() => {
    if (userInteracted || prefersReducedMotion) return;
    if (hovered) return;
    if (interstitialFrom != null) return; // wait for interstitial to clear

    const dwell = PHASE_DURATIONS_MS[phase];
    const remaining =
      remainingMsRef.current > 0 ? remainingMsRef.current : dwell;
    phaseStartedAtRef.current = performance.now();
    remainingMsRef.current = 0;

    advanceTimerRef.current = setTimeout(() => {
      const idx = PHASE_ORDER.indexOf(phase);
      const nextPhase = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];

      // Show interstitial only on forward transitions (not on loop reset)
      if (idx < PHASE_ORDER.length - 1) {
        setInterstitialFrom(phase);
        interstitialTimerRef.current = setTimeout(() => {
          setInterstitialFrom(null);
          setPhase(nextPhase);
        }, INTERSTITIAL_MS);
      } else {
        // practice → summary (loop reset, no interstitial)
        setPhase(nextPhase);
      }
    }, remaining);

    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, [phase, hovered, userInteracted, prefersReducedMotion, interstitialFrom]);

  // Align the active phase to the top of the phone screen as phases advance.
  // IMPORTANT: scroll ONLY this inner phone container — never the page. Element
  // .scrollIntoView() scrolls EVERY scrollable ancestor, including the window, so
  // as the demo auto-advanced it kept yanking the whole landing page up to this
  // section ("the front page scrolls to the top, then slowly back down").
  // container.scrollTo() moves just the phone's own scroll area; the page stays put.
  useEffect(() => {
    if (userInteracted || prefersReducedMotion) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-phase="${phase}"]`);
    if (target instanceof HTMLElement) {
      const top =
        container.scrollTop +
        (target.getBoundingClientRect().top -
          container.getBoundingClientRect().top);
      container.scrollTo({ top, behavior: "smooth" });
    }
  }, [phase, userInteracted, prefersReducedMotion]);

  const handleMouseEnter = useCallback(() => {
    if (userInteracted || prefersReducedMotion) return;
    setHovered(true);
    const elapsed = performance.now() - phaseStartedAtRef.current;
    const dwell = PHASE_DURATIONS_MS[phase];
    remainingMsRef.current = Math.max(0, dwell - elapsed);
  }, [phase, userInteracted, prefersReducedMotion]);

  const handleMouseLeave = useCallback(() => setHovered(false), []);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  // Derived
  const completedPhases = new Set<ChapterTab>(
    PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(phase))
  );
  const progressPercent =
    ((PHASE_ORDER.indexOf(phase) + 1) / PHASE_ORDER.length) * 100;

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ background: "var(--cr-bg-root)" }}
    >
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-y-auto hide-scrollbar"
        onClick={handleUserInteraction}
        onTouchStart={handleUserInteraction}
        onWheel={handleUserInteraction}
      >
        {/* Mini chapter header */}
        <div style={{ padding: "0 12px", paddingTop: 4 }}>
          <div
            className="flex items-center gap-1"
            style={{ color: "var(--cr-accent)" }}
          >
            <ChevronLeft className="h-2 w-2" />
            <span className="text-[8px]">{DEMO_BOOK_TITLE}</span>
          </div>

          <div className="flex gap-2 mt-1.5">
            <div
              className="shrink-0 relative overflow-hidden"
              style={{
                width: 32,
                height: 44,
                borderRadius: 4,
                boxShadow:
                  "0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              <Image
                src={getBookCoverPath(DEMO_BOOK_ID)}
                alt={`${DEMO_BOOK_TITLE} cover`}
                fill
                sizes="32px"
                className="object-cover"
                unoptimized
              />
            </div>

            <div className="min-w-0 flex-1">
              <span
                className="text-[7px]"
                style={{ color: "var(--cr-text-disabled)" }}
              >
                Chapter {DEMO_CHAPTER_NUMBER}
              </span>
              <p
                className="text-[10px] font-semibold"
                style={{
                  color: "var(--cr-text-heading)",
                  lineHeight: 1.2,
                  marginTop: 1,
                }}
              >
                {DEMO_CHAPTER_TITLE}
              </p>
              <span
                className="text-[7px]"
                style={{ color: "var(--cr-accent)" }}
              >
                {DEMO_BOOK_AUTHOR}
              </span>
            </div>
          </div>

          {/* Depth pills (Lite / Standard / Deeper) — visual only on phone */}
          <div className="flex gap-1 mt-2">
            {["Lite", "Standard", "Deeper"].map((depth) => {
              const active = depth === "Standard";
              return (
                <span
                  key={depth}
                  className="text-[7px] rounded-full"
                  style={{
                    padding: "2px 8px",
                    background: active
                      ? "var(--cr-accent-muted)"
                      : "transparent",
                    color: active
                      ? "var(--cr-accent)"
                      : "var(--cr-text-disabled)",
                    border: `1px solid ${active ? "var(--cr-glass-border-teal)" : "var(--cr-glass-border)"}`,
                  }}
                >
                  {depth}
                </span>
              );
            })}
          </div>
        </div>

        {/* Phase stepper */}
        <div style={{ marginTop: 10, marginBottom: 10 }}>
          <PhonePhaseStepper
            currentPhase={phase}
            completedPhases={completedPhases}
            progressPercent={progressPercent}
          />
        </div>

        {/* Phase content */}
        {prefersReducedMotion || userInteracted ? (
          // Reduced motion or post-interaction: render all 4 stacked
          <div className="space-y-6 pb-6">
            <div data-phase="summary">
              <PhoneSummaryView isActive={false} />
            </div>
            <div data-phase="examples">
              <PhoneExamplesView isActive={false} />
            </div>
            <div data-phase="quiz">
              <PhoneQuizView isActive={false} />
            </div>
            <div data-phase="practice">
              <PhonePracticeView isActive={false} />
            </div>
          </div>
        ) : (
          // Cinematic mode: render only the active phase
          <div className="pb-6">
            {phase === "summary" && (
              <div data-phase="summary">
                <PhoneSummaryView isActive />
              </div>
            )}
            {phase === "examples" && (
              <div data-phase="examples">
                <PhoneExamplesView isActive />
              </div>
            )}
            {phase === "quiz" && (
              <div data-phase="quiz">
                <PhoneQuizView isActive />
              </div>
            )}
            {phase === "practice" && (
              <div data-phase="practice">
                <PhonePracticeView isActive />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase interstitial (shows briefly between phase transitions) */}
      {interstitialFrom != null && (
        <PhonePhaseInterstitial
          from={interstitialFrom}
          to={
            PHASE_ORDER[
              (PHASE_ORDER.indexOf(interstitialFrom) + 1) % PHASE_ORDER.length
            ]
          }
        />
      )}

      {/* Bottom fade gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none z-10"
        style={{
          height: 24,
          background: "linear-gradient(transparent, var(--cr-bg-root))",
        }}
      />
    </div>
  );
}
