"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  motion,
  useAnimation,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { Clock } from "lucide-react";
import type { OnboardingBook } from "@/app/onboarding/data/books";
import type { StarterShelfSwipeDirection } from "@/app/onboarding/hooks/starter-shelf-selection-core";
import { DUR } from "@/lib/motion";
import { StarterShelfBookCover } from "./StarterShelfBookCover";

interface StarterShelfSwipeCardProps {
  book: OnboardingBook;
  onSwipe: (direction: StarterShelfSwipeDirection) => void;
  buttonSwipeRef: MutableRefObject<
    ((direction: StarterShelfSwipeDirection) => void) | null
  >;
}

function difficultyStyle(difficulty: string): React.CSSProperties {
  const accent = difficulty === "Hard" ? "var(--accent-amber)" : "var(--accent-cyan)";
  return {
    background: `color-mix(in srgb, ${accent} 12%, transparent)`,
    color: accent,
    border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
  };
}

function resolveAccent(token: string, alphaPct: number): string {
  if (typeof window === "undefined") return "transparent";
  const probe = document.createElement("span");
  probe.style.color = `color-mix(in srgb, var(${token}) ${alphaPct}%, transparent)`;
  probe.style.position = "absolute";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return resolved || "transparent";
}

export function StarterShelfSwipeCard({
  book,
  onSwipe,
  buttonSwipeRef,
}: StarterShelfSwipeCardProps) {
  const reducedMotion = useReducedMotion();
  const controls = useAnimation();
  const x = useMotionValue(0);
  const busy = useRef(false);

  const [accents, setAccents] = useState({
    rose60: "transparent",
    rose20: "transparent",
    rose15: "transparent",
    cyan60: "transparent",
    cyan20: "transparent",
    cyan15: "transparent",
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccents({
      rose60: resolveAccent("--accent-rose", 60),
      rose20: resolveAccent("--accent-rose", 20),
      rose15: resolveAccent("--accent-rose", 15),
      cyan60: resolveAccent("--accent-cyan", 60),
      cyan20: resolveAccent("--accent-cyan", 20),
      cyan15: resolveAccent("--accent-cyan", 15),
    });
  }, []);

  const rotate = useTransform(x, [-200, 200], reducedMotion ? [0, 0] : [-25, 25]);
  const keepOpacity = useTransform(x, [0, 100], [0, 1]);
  const skipOpacity = useTransform(x, [-100, 0], [1, 0]);
  const borderColor = useTransform(
    x,
    [-150, -50, 0, 50, 150],
    [
      accents.rose60,
      accents.rose20,
      "var(--cf-border-strong)",
      accents.cyan20,
      accents.cyan60,
    ],
  );
  const cardShadow = useTransform(
    x,
    [-150, 0, 150],
    [
      `0 0 30px ${accents.rose15}`,
      "var(--cf-shadow-lg)",
      `0 0 30px ${accents.cyan15}`,
    ],
  );

  const doSwipe = useCallback(
    async (direction: StarterShelfSwipeDirection) => {
      if (busy.current) return;
      busy.current = true;
      const targetX = direction === "right" ? 500 : -500;
      if (reducedMotion) {
        await controls.start({ opacity: 0, transition: { duration: DUR.instant } });
      } else {
        await controls.start({
          x: targetX,
          opacity: 0,
          transition: { duration: DUR.fast, ease: "easeOut" },
        });
      }
      onSwipe(direction);
    },
    [controls, onSwipe, reducedMotion],
  );

  // Register synchronously every render so buttons share this card's busy guard.
  // eslint-disable-next-line react-hooks/refs -- registration must precede same-frame input
  buttonSwipeRef.current = doSwipe;

  const handleDragEnd = useCallback(
    async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const offset = info.offset.x;
      const velocity = info.velocity.x;
      if (offset > 150 || velocity > 500) {
        await doSwipe("right");
      } else if (offset < -150 || velocity < -500) {
        await doSwipe("left");
      } else {
        controls.start({
          x: 0,
          transition: reducedMotion
            ? { duration: DUR.instant }
            : { type: "spring", stiffness: 300, damping: 25 },
        });
      }
    },
    [controls, doSwipe, reducedMotion],
  );

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      animate={controls}
      style={{
        x,
        rotate,
        borderColor,
        boxShadow: cardShadow,
        touchAction: "none",
        position: "absolute",
        inset: 0,
        borderRadius: 24,
        background: "var(--cf-surface)",
        borderWidth: 1,
        borderStyle: "solid",
        padding: "24px 24px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        userSelect: "none",
        overflow: "hidden",
        zIndex: 10,
      }}
      whileTap={{ cursor: "grabbing" }}
    >
      <motion.div
        className="absolute top-6 left-6 z-20 px-4 py-2 rounded-lg pointer-events-none select-none"
        style={{
          opacity: keepOpacity,
          rotate: -12,
          borderWidth: 3,
          borderStyle: "solid",
          borderColor: "var(--accent-cyan)",
          color: "var(--accent-cyan)",
          fontFamily: "var(--font-display, sans-serif)",
          fontWeight: 700,
          fontSize: 22,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
        aria-hidden="true"
      >
        Keep
      </motion.div>

      <motion.div
        className="absolute top-6 right-6 z-20 px-4 py-2 rounded-lg pointer-events-none select-none"
        style={{
          opacity: skipOpacity,
          rotate: 12,
          borderWidth: 3,
          borderStyle: "solid",
          borderColor: "var(--accent-rose)",
          color: "var(--accent-rose)",
          fontFamily: "var(--font-display, sans-serif)",
          fontWeight: 700,
          fontSize: 22,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
        aria-hidden="true"
      >
        Skip
      </motion.div>

      <StarterShelfBookCover book={book} width={130} height={185} />

      <p
        style={{
          fontFamily: "var(--font-display, sans-serif)",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--cf-text-1)",
          textAlign: "center",
          marginTop: 16,
          lineHeight: 1.3,
        }}
      >
        {book.title}
      </p>

      <p
        style={{
          fontFamily: "var(--font-body, sans-serif)",
          fontSize: 14,
          color: "var(--cf-text-3)",
          textAlign: "center",
          marginTop: 4,
        }}
      >
        {book.author}
      </p>

      <div className="flex items-center justify-center gap-2 flex-wrap" style={{ marginTop: 12 }}>
        <span
          className="rounded-full px-3 py-1 text-xs"
          style={{
            background: "var(--cf-surface-muted)",
            border: "1px solid var(--cf-border-strong)",
            color: "var(--cf-text-3)",
            fontFamily: "var(--font-body, sans-serif)",
          }}
        >
          {book.category}
        </span>
        <span
          className="rounded-full px-3 py-1 text-xs"
          style={{
            ...difficultyStyle(book.difficulty),
            fontFamily: "var(--font-body, sans-serif)",
          }}
        >
          {book.difficulty}
        </span>
        <span
          className="flex items-center gap-1 text-xs"
          style={{
            color: "var(--cf-text-soft)",
            fontFamily: "var(--font-body, sans-serif)",
          }}
        >
          <Clock size={12} />~{book.estimatedHours}h
        </span>
      </div>

      <p
        style={{
          fontFamily: "var(--font-body, sans-serif)",
          fontSize: 13,
          color: "var(--cf-text-soft)",
          fontStyle: "italic",
          textAlign: "center",
          marginTop: 12,
          lineHeight: 1.5,
          maxWidth: 240,
        }}
      >
        &ldquo;{book.tagline}&rdquo;
      </p>
    </motion.div>
  );
}
