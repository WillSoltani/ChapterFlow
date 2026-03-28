"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useAnimation,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import { X, Heart, Clock, Check } from "lucide-react";
import { useOnboarding } from "@/app/onboarding/hooks/useOnboarding";
import type { OnboardingBook } from "@/app/onboarding/data/books";
import { getBookCoverPath } from "@/app/onboarding/data/books";
import { generateSwipeDeck } from "@/app/onboarding/data/recommendations";

interface StepStarterShelfProps {
  onNext: () => void;
}

const MAX_PICKS = 3;

function getDifficultyStyle(d: string) {
  switch (d) {
    case "Easy":
      return "bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/20";
    case "Hard":
      return "bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] border border-[var(--accent-amber)]/20";
    default:
      return "bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/20";
  }
}

/* ── BookCoverImage — shows real cover or gradient fallback ── */

function BookCoverImage({
  book,
  width,
  height,
  radius = 14,
  showTitle = true,
  titleSize = 15,
}: {
  book: OnboardingBook;
  width: number;
  height: number;
  radius?: number;
  showTitle?: boolean;
  titleSize?: number;
}) {
  const coverPath = getBookCoverPath(book.id);

  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: book.gradient,
        boxShadow: "var(--cf-shadow-lg)",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {coverPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverPath}
          alt={book.title}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      ) : showTitle ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: titleSize,
              fontWeight: 700,
              textAlign: "center",
              lineHeight: 1.25,
              maxWidth: width - 24,
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            {book.title}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════
   SwipeCard — the front draggable card
   ═══════════════════════════════════════ */

interface SwipeCardProps {
  book: OnboardingBook;
  onSwipe: (dir: "left" | "right") => void;
  onButtonSwipe: React.MutableRefObject<((dir: "left" | "right") => void) | null>;
}

function SwipeCard({ book, onSwipe, onButtonSwipe }: SwipeCardProps) {
  const reducedMotion = useReducedMotion();
  const controls = useAnimation();
  const x = useMotionValue(0);
  const busy = useRef(false);

  const rotate = useTransform(x, [-200, 200], reducedMotion ? [0, 0] : [-25, 25]);
  const keepOpacity = useTransform(x, [0, 100], [0, 1]);
  const skipOpacity = useTransform(x, [-100, 0], [1, 0]);
  const borderColor = useTransform(
    x,
    [-150, -50, 0, 50, 150],
    [
      "rgba(244,63,94,0.6)",
      "rgba(244,63,94,0.2)",
      "var(--cf-border-strong)",
      "rgba(34,211,238,0.2)",
      "rgba(34,211,238,0.6)",
    ]
  );
  const cardShadow = useTransform(
    x,
    [-150, 0, 150],
    [
      "0 0 30px rgba(244,63,94,0.15)",
      "var(--cf-shadow-lg)",
      "0 0 30px rgba(34,211,238,0.15)",
    ]
  );

  const doSwipe = useCallback(
    async (dir: "left" | "right") => {
      if (busy.current) return;
      busy.current = true;
      const targetX = dir === "right" ? 500 : -500;
      if (reducedMotion) {
        await controls.start({ opacity: 0, transition: { duration: 0.1 } });
      } else {
        await controls.start({
          x: targetX,
          opacity: 0,
          transition: { duration: 0.25, ease: "easeOut" },
        });
      }
      onSwipe(dir);
    },
    [controls, onSwipe, reducedMotion]
  );

  // Register button trigger — set synchronously every render so it's always current
  onButtonSwipe.current = doSwipe;

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
            ? { duration: 0.1 }
            : { type: "spring", stiffness: 300, damping: 25 },
        });
      }
    },
    [controls, doSwipe, reducedMotion]
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
      {/* KEEP stamp */}
      <motion.div
        className="absolute top-6 left-6 z-20 px-4 py-2 rounded-lg pointer-events-none select-none"
        style={{
          opacity: keepOpacity,
          rotate: -12,
          borderWidth: 3,
          borderStyle: "solid",
          borderColor: "var(--accent-cyan)",
          color: "var(--accent-cyan)",
          fontFamily: "var(--font-sora, sans-serif)",
          fontWeight: 700,
          fontSize: 22,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
        aria-hidden="true"
      >
        Keep
      </motion.div>

      {/* SKIP stamp */}
      <motion.div
        className="absolute top-6 right-6 z-20 px-4 py-2 rounded-lg pointer-events-none select-none"
        style={{
          opacity: skipOpacity,
          rotate: 12,
          borderWidth: 3,
          borderStyle: "solid",
          borderColor: "var(--accent-rose)",
          color: "var(--accent-rose)",
          fontFamily: "var(--font-sora, sans-serif)",
          fontWeight: 700,
          fontSize: 22,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
        aria-hidden="true"
      >
        Skip
      </motion.div>

      {/* Book cover */}
      <BookCoverImage book={book} width={130} height={185} />

      {/* Title */}
      <p
        style={{
          fontFamily: "var(--font-sora, sans-serif)",
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

      {/* Author */}
      <p
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 14,
          color: "var(--cf-text-3)",
          textAlign: "center",
          marginTop: 4,
        }}
      >
        {book.author}
      </p>

      {/* Badges */}
      <div className="flex items-center justify-center gap-2 flex-wrap" style={{ marginTop: 12 }}>
        <span
          className="rounded-full px-3 py-1 text-xs"
          style={{
            background: "var(--cf-surface-muted)",
            border: "1px solid var(--cf-border-strong)",
            color: "var(--cf-text-3)",
            fontFamily: "var(--font-dm-sans, sans-serif)",
          }}
        >
          {book.category}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs ${getDifficultyStyle(book.difficulty)}`}
          style={{ fontFamily: "var(--font-dm-sans, sans-serif)" }}
        >
          {book.difficulty}
        </span>
        <span
          className="flex items-center gap-1 text-xs"
          style={{ color: "var(--cf-text-soft)", fontFamily: "var(--font-dm-sans, sans-serif)" }}
        >
          <Clock size={12} />~{book.estimatedHours}h
        </span>
      </div>

      {/* Tagline */}
      <p
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
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

/* ═══════════════════════════════════════
   BackCard — solid opaque card behind the front
   ═══════════════════════════════════════ */

function BackCard({ book }: { book: OnboardingBook }) {
  const coverPath = getBookCoverPath(book.id);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 24,
        background: "var(--cf-surface)",
        border: "1px solid var(--cf-border)",
        boxShadow: "var(--cf-shadow-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {coverPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverPath}
          alt=""
          draggable={false}
          style={{ width: 60, height: 85, objectFit: "cover", borderRadius: 8, opacity: 0.35, pointerEvents: "none", userSelect: "none" }}
        />
      ) : (
        <div
          style={{
            width: 60,
            height: 85,
            borderRadius: 8,
            background: book.gradient,
            opacity: 0.25,
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   ShelfComplete — brief celebration
   ═══════════════════════════════════════ */

function ShelfComplete({ books, onDone }: { books: OnboardingBook[]; onDone: () => void }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center text-center"
      style={{ padding: "40px 20px" }}
    >
      <motion.h2
        initial={reducedMotion ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
        style={{
          fontFamily: "var(--font-sora, sans-serif)",
          fontSize: 28,
          fontWeight: 600,
          color: "var(--cf-text-1)",
          marginBottom: 32,
        }}
      >
        Your shelf is set!
      </motion.h2>

      <div className="flex items-start justify-center gap-6">
        {books.map((book, i) => (
          <motion.div
            key={book.id}
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.15, duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center"
            style={{ maxWidth: 120 }}
          >
            <BookCoverImage book={book} width={100} height={140} radius={12} titleSize={11} />
            <p
              style={{
                fontFamily: "var(--font-dm-sans, sans-serif)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--cf-text-1)",
                marginTop: 8,
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {book.title}
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans, sans-serif)",
                fontSize: 11,
                color: "var(--cf-text-soft)",
                textAlign: "center",
              }}
            >
              {book.author}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.3 }}
        style={{ marginTop: 24 }}
      >
        <Check size={24} style={{ color: "var(--accent-cyan)" }} />
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   StepStarterShelf — main orchestrator
   ═══════════════════════════════════════ */

export default function StepStarterShelf({ onNext }: StepStarterShelfProps) {
  const router = useRouter();
  const { motivation, interests, setStarterShelf } = useOnboarding();
  const reducedMotion = useReducedMotion();

  const deck = useMemo(
    () => generateSwipeDeck(interests, motivation),
    [interests, motivation]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedBooks, setSelectedBooks] = useState<OnboardingBook[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  // Ref for the button-triggered swipe — set synchronously by SwipeCard each render
  const buttonSwipeRef = useRef<((dir: "left" | "right") => void) | null>(null);

  const frontBook = currentIndex < deck.length ? deck[currentIndex] : null;

  const handleSwipe = useCallback(
    (dir: "left" | "right") => {
      if (!frontBook) return;

      if (dir === "right") {
        const newSelected = [...selectedBooks, frontBook];
        setSelectedBooks(newSelected);

        if (newSelected.length >= MAX_PICKS) {
          setIsComplete(true);
          setStarterShelf(newSelected);
          return;
        }
      }
      setCurrentIndex((prev) => prev + 1);
    },
    [frontBook, selectedBooks, setStarterShelf]
  );

  const handleComplete = useCallback(() => {
    onNext();
  }, [onNext]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComplete || !frontBook) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        buttonSwipeRef.current?.("right");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        buttonSwipeRef.current?.("left");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isComplete, frontBook]);

  const backBooks = deck.slice(currentIndex + 1, currentIndex + 3);
  const selectedCount = selectedBooks.length;

  if (isComplete) {
    return <ShelfComplete books={selectedBooks} onDone={handleComplete} />;
  }

  return (
    <div
      style={{ width: "100%", maxWidth: 480, margin: "0 auto", padding: "0 20px" }}
      role="region"
      aria-label="Book selection - swipe or use buttons to choose books"
    >
      {/* Header */}
      <h2
        style={{
          fontFamily: "var(--font-sora, sans-serif)",
          fontSize: "clamp(24px, 5vw, 32px)",
          fontWeight: 600,
          color: "var(--cf-text-1)",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        Your starter shelf
      </h2>
      <p
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 16,
          color: "var(--cf-text-3)",
          textAlign: "center",
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        Swipe right on books you want. Pick 3.
      </p>

      {/* Counter */}
      <p
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 14,
          color:
            selectedCount === 0
              ? "var(--cf-text-soft)"
              : selectedCount >= MAX_PICKS
                ? "var(--accent-cyan)"
                : "var(--accent-cyan)",
          textAlign: "center",
          marginBottom: 8,
          transition: "color 200ms ease",
        }}
      >
        {selectedCount} of {MAX_PICKS} selected
      </p>

      {/* Indicator dots */}
      <div className="flex items-center justify-center gap-3" style={{ marginBottom: 24 }}>
        {Array.from({ length: MAX_PICKS }, (_, i) => {
          const filled = i < selectedCount;
          return (
            <motion.div
              key={i}
              initial={false}
              animate={{
                scale: filled ? 1.2 : 1,
                backgroundColor: filled ? "var(--accent-cyan)" : "transparent",
              }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { duration: 0.3, ease: "easeOut" }
              }
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: filled ? "none" : "2px solid var(--cf-border-strong)",
              }}
            />
          );
        })}
      </div>

      {/* Card stack */}
      <div
        className="relative mx-auto"
        style={{
          width: "min(320px, calc(100vw - 80px))",
          height: 440,
          marginBottom: 8,
        }}
      >
        {/* Back cards — rendered first, behind */}
        {backBooks.map((book, i) => (
          <motion.div
            key={book.id}
            className="absolute inset-0"
            initial={false}
            animate={{
              scale: 1 - (i + 1) * 0.05,
              y: (i + 1) * 12,
            }}
            transition={
              reducedMotion
                ? { duration: 0.1 }
                : { duration: 0.3, ease: "easeOut" }
            }
            style={{ opacity: 1 - (i + 1) * 0.2, zIndex: 2 - i }}
          >
            <BackCard book={book} />
          </motion.div>
        ))}

        {/* Front card */}
        <AnimatePresence mode="popLayout">
          {frontBook && (
            <motion.div
              key={frontBook.id}
              className="absolute inset-0"
              initial={reducedMotion ? false : { scale: 0.95, y: 12, opacity: 0.85 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={
                reducedMotion
                  ? { duration: 0.1 }
                  : { duration: 0.3, ease: "easeOut" }
              }
              style={{ zIndex: 10 }}
            >
              <SwipeCard
                book={frontBook}
                onSwipe={handleSwipe}
                onButtonSwipe={buttonSwipeRef}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!frontBook && selectedCount < MAX_PICKS && (
          <div
            className="flex items-center justify-center"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 24,
              border: "1px dashed var(--cf-border-strong)",
              background: "var(--cf-surface-muted)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-dm-sans, sans-serif)",
                fontSize: 15,
                color: "var(--cf-text-soft)",
                textAlign: "center",
                padding: 24,
              }}
            >
              No more books in this set.
              <br />
              We&apos;ll fill your remaining slots with our best picks.
            </p>
          </div>
        )}
      </div>

      {/* Action buttons — X (skip) and Heart (keep) */}
      {frontBook && (
        <div className="flex items-center justify-center gap-8" style={{ marginTop: 8 }}>
          <motion.button
            onClick={() => buttonSwipeRef.current?.("left")}
            whileHover={reducedMotion ? {} : { scale: 1.1 }}
            whileTap={reducedMotion ? {} : { scale: 0.9 }}
            aria-label="Skip this book"
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--cf-surface-muted)",
              border: "1px solid var(--cf-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "border-color 200ms, background 200ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "color-mix(in srgb, var(--accent-rose) 50%, transparent)";
              e.currentTarget.style.background = "color-mix(in srgb, var(--accent-rose) 10%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--cf-border)";
              e.currentTarget.style.background = "var(--cf-surface-muted)";
            }}
          >
            <X size={24} style={{ color: "var(--accent-rose)" }} />
          </motion.button>

          <motion.button
            onClick={() => buttonSwipeRef.current?.("right")}
            whileHover={reducedMotion ? {} : { scale: 1.1 }}
            whileTap={reducedMotion ? {} : { scale: 0.9 }}
            aria-label="Keep this book"
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--cf-surface-muted)",
              border: "1px solid var(--cf-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "border-color 200ms, background 200ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "color-mix(in srgb, var(--accent-cyan) 50%, transparent)";
              e.currentTarget.style.background = "color-mix(in srgb, var(--accent-cyan) 10%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--cf-border)";
              e.currentTarget.style.background = "var(--cf-surface-muted)";
            }}
          >
            <Heart size={24} style={{ color: "var(--accent-cyan)" }} />
          </motion.button>
        </div>
      )}

      {/* Selected books thumbnails */}
      <div className="flex items-center justify-center gap-3" style={{ marginTop: 24 }}>
        {Array.from({ length: MAX_PICKS }, (_, i) => {
          const book = selectedBooks[i];
          return (
            <div key={i} style={{ width: 48, height: 68 }}>
              {book ? (
                <motion.div
                  initial={reducedMotion ? false : { scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <BookCoverImage book={book} width={48} height={68} radius={8} titleSize={7} />
                </motion.div>
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 68,
                    borderRadius: 8,
                    border: "1px dashed var(--cf-border-strong)",
                    background: "var(--cf-surface-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans, sans-serif)",
                      fontSize: 14,
                      color: "var(--cf-border-strong)",
                    }}
                  >
                    {i + 1}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom text */}
      <p
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 13,
          color: "var(--cf-text-soft)",
          textAlign: "center",
          marginTop: 20,
          lineHeight: 1.5,
        }}
      >
        Your 2 free books are included.{" "}
        <span
          onClick={() => router.push("/pricing")}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") router.push("/pricing"); }}
          style={{
            textDecoration: "underline",
            textUnderlineOffset: 2,
            cursor: "pointer",
            transition: "color 200ms",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cf-text-3)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--cf-text-soft)")}
        >
          Add more with Pro.
        </span>
      </p>

      {/* Screen reader live region */}
      <div className="sr-only" aria-live="polite" role="status">
        {frontBook &&
          `Book ${currentIndex + 1} of ${deck.length}: ${frontBook.title} by ${frontBook.author}. ${frontBook.category}, ${frontBook.difficulty} difficulty, approximately ${frontBook.estimatedHours} hours.`}
      </div>
    </div>
  );
}
