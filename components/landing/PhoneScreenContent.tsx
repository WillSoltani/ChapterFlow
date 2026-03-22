"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ChapterHeader } from "./ChapterHeader";
import { SummarySection } from "./SummarySection";
import { ScenariosSection } from "./ScenariosSection";
import { QuizPreview } from "./QuizPreview";

export function PhoneScreenContent() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const rafRef = useRef<number>(0);
  const scrollDirectionRef = useRef<"down" | "up">("down");
  const pauseUntilRef = useRef<number>(0);

  // Stop auto-scroll when user interacts
  const handleUserInteraction = useCallback(() => {
    if (!userInteracted) {
      setUserInteracted(true);
      setShowScrollHint(true);
      // Hide hint after 2s
      setTimeout(() => setShowScrollHint(false), 2000);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    }
  }, [userInteracted]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || userInteracted) return;

    let lastTime = 0;
    const SCROLL_SPEED = 12; // px per second down (slow, cinematic)
    const SCROLL_SPEED_UP = 30; // px per second up (gentle return)
    const PAUSE_DURATION = 3000; // ms to pause at sections
    const START_DELAY = 2000; // ms before starting

    // Pause points (approximate scroll positions where section labels appear)
    // These are rough values - the auto-scroll just needs to feel natural
    const pausePoints = [0, 200, 500, 700];
    let nextPauseIndex = 1;

    const startTime = performance.now() + START_DELAY;

    const animate = (time: number) => {
      if (time < startTime) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // If paused, wait
      if (pauseUntilRef.current > 0 && time < pauseUntilRef.current) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      pauseUntilRef.current = 0;

      if (!lastTime) lastTime = time;
      const delta = (time - lastTime) / 1000; // seconds
      lastTime = time;

      const maxScroll = el.scrollHeight - el.clientHeight;

      if (scrollDirectionRef.current === "down") {
        el.scrollTop += SCROLL_SPEED * delta;

        // Check if we should pause
        if (
          nextPauseIndex < pausePoints.length &&
          el.scrollTop >= pausePoints[nextPauseIndex]
        ) {
          pauseUntilRef.current = time + PAUSE_DURATION;
          nextPauseIndex++;
        }

        // Reached bottom
        if (el.scrollTop >= maxScroll - 1) {
          pauseUntilRef.current = time + 4000; // pause 4s at bottom
          scrollDirectionRef.current = "up";
        }
      } else {
        el.scrollTop -= SCROLL_SPEED_UP * delta;

        // Reached top
        if (el.scrollTop <= 0) {
          pauseUntilRef.current = time + 2000;
          scrollDirectionRef.current = "down";
          nextPauseIndex = 1;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [userInteracted]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={scrollRef}
        className="w-full h-full overflow-y-auto hide-scrollbar"
        onTouchStart={handleUserInteraction}
        onWheel={handleUserInteraction}
        onClick={handleUserInteraction}
      >
        <ChapterHeader />
        <SummarySection />
        <ScenariosSection />
        <QuizPreview />
      </div>

      {/* Scroll hint (appears when user takes control) */}
      {showScrollHint && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] px-2 py-1 rounded-full z-20 transition-opacity duration-500"
          style={{
            background: "rgba(0,0,0,0.7)",
            color: "var(--text-muted)",
          }}
        >
          Scroll to explore
        </div>
      )}

      {/* Bottom fade gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none z-10"
        style={{
          height: 24,
          background: "linear-gradient(transparent, #08080C)",
        }}
      />
    </div>
  );
}
