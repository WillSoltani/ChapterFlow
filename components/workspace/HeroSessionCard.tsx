"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { LearningLoopIndicator } from "./LearningLoopIndicator";

type LoopStep = "summary" | "scenarios" | "quiz" | "unlock";

type UserState =
  | "new_user"
  | "active_reader"
  | "quiz_pending"
  | "between_books"
  | "returning"
  | "free_limit_reached";

interface CurrentBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  currentChapter: number;
  totalChapters: number;
  progressPercent: number;
  currentLoopStep: LoopStep | null;
  estimatedMinutes: number;
  gradient?: string;
  glowColor?: string;
}

interface HeroSessionCardProps {
  userState: UserState;
  currentBook: CurrentBook | null;
  firstName: string;
}

function getStatusBadge(userState: UserState): { label: string; color: string } {
  switch (userState) {
    case "active_reader":
      return { label: "CONTINUE READING", color: "var(--cf-accent)" };
    case "new_user":
      return { label: "READY TO START", color: "var(--cf-success-text)" };
    case "quiz_pending":
      return { label: "QUIZ TIME", color: "var(--accent-gold)" };
    case "between_books":
      return { label: "BOOK COMPLETE", color: "var(--accent-gold)" };
    case "returning":
      return { label: "WELCOME BACK", color: "var(--cf-accent)" };
    case "free_limit_reached":
      return { label: "UNLOCK MORE", color: "var(--accent-gold)" };
    default:
      return { label: "CONTINUE READING", color: "var(--cf-accent)" };
  }
}

function getCTAHref(userState: UserState, book: CurrentBook | null): string {
  switch (userState) {
    case "new_user":
      return "/book/library";
    case "active_reader":
    case "quiz_pending":
    case "returning":
      return book
        ? `/book/library/${book.id}/chapter/${book.currentChapter}`
        : "/book/library";
    case "between_books":
      return "/book/library";
    case "free_limit_reached":
      return "/pricing";
    default:
      return "/book/library";
  }
}

function getCTAText(userState: UserState, book: CurrentBook | null): string {
  switch (userState) {
    case "new_user":
      return "Pick Your First Book";
    case "active_reader":
      return `Continue Chapter ${book?.currentChapter ?? 1}`;
    case "quiz_pending":
      return "Take the Quiz";
    case "between_books":
      return "Explore Library";
    case "returning":
      return "Pick Up Where You Left Off";
    case "free_limit_reached":
      return "Unlock Your Full Library";
    default:
      return "Continue";
  }
}

function getHeroTitle(
  userState: UserState,
  book: CurrentBook | null,
  firstName: string
): string {
  switch (userState) {
    case "new_user":
      return "Start Your Reading Journey";
    case "returning":
      return `Welcome Back, ${firstName}!`;
    case "between_books":
      return "What's Next?";
    default:
      return book?.title ?? "Your Next Book";
  }
}

function getHeroSubtitle(
  userState: UserState,
  book: CurrentBook | null
): string | null {
  switch (userState) {
    case "new_user":
      return "Choose from 95+ non-fiction books across 21 categories";
    case "returning":
      return "Your book is right where you left it";
    case "between_books":
      return "Pick your next book to continue growing";
    case "active_reader":
    case "quiz_pending":
      return book ? `by ${book.author}` : null;
    case "free_limit_reached":
      return "Unlock 93 more books with Pro";
    default:
      return null;
  }
}

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroSessionCard({
  userState,
  currentBook,
  firstName,
}: HeroSessionCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const badge = getStatusBadge(userState);
  const ctaText = getCTAText(userState, currentBook);
  const ctaHref = getCTAHref(userState, currentBook);
  const title = getHeroTitle(userState, currentBook, firstName);
  const subtitle = getHeroSubtitle(userState, currentBook);
  const showBookCover =
    currentBook && userState !== "new_user" && userState !== "between_books";
  const showProgress =
    currentBook && userState !== "new_user" && userState !== "between_books";
  const showLoopIndicator =
    currentBook?.currentLoopStep &&
    (userState === "active_reader" || userState === "quiz_pending");

  const coverSrc = currentBook
    ? currentBook.coverUrl || `/book-covers/${currentBook.id}.jpg`
    : "";
  return (
    <motion.div
      className="group rounded-2xl"
      style={{
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        border: "1px solid var(--cf-border-strong)",
        boxShadow:
          "0 0 100px -20px rgba(139, 92, 246, 0.30), 0 0 40px -10px rgba(139, 92, 246, 0.15)",
        transition: "box-shadow 500ms ease-out",
      }}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? undefined
          : { duration: 0.6, delay: 0.1, ease }
      }
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 0 120px -20px rgba(139, 92, 246, 0.45), 0 0 50px -10px rgba(139, 92, 246, 0.25)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 0 100px -20px rgba(139, 92, 246, 0.30), 0 0 40px -10px rgba(139, 92, 246, 0.15)";
      }}
    >
      <div className="flex flex-col lg:flex-row">
        {/* LEFT: Book info + CTA */}
        <div className="flex-1 p-6 md:p-8">
          {/* Status badge */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{
              background: `${badge.color}10`,
              border: `1px solid ${badge.color}25`,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: badge.color,
                boxShadow: `0 0 6px ${badge.color}40`,
              }}
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: badge.color }}
            >
              {badge.label}
            </span>
          </div>

          {/* Title */}
          {currentBook && userState !== "new_user" && userState !== "between_books" ? (
            <Link href={`/book/library/${currentBook.id}`}>
              <h2
                className="mt-4 font-(family-name:--font-display) text-3xl font-bold lg:text-4xl transition-colors hover:text-accent-violet"
                style={{ color: "var(--cf-text-1)" }}
              >
                {title}
              </h2>
            </Link>
          ) : (
            <h2
              className="mt-4 font-(family-name:--font-display) text-3xl font-bold lg:text-4xl"
              style={{ color: "var(--cf-text-1)" }}
            >
              {title}
            </h2>
          )}

          {/* Subtitle */}
          {subtitle && (
            <p className="mt-1.5 text-lg" style={{ color: "var(--cf-text-3)" }}>
              {subtitle}
            </p>
          )}

          {/* Chapter progress */}
          {showProgress && currentBook && (
            <div className="mt-4">
              <span className="text-sm font-medium" style={{ color: "var(--cf-text-3)" }}>
                Chapter {currentBook.currentChapter} of{" "}
                {currentBook.totalChapters}
              </span>
              <div
                className="mt-2 h-1 overflow-hidden rounded-full"
                style={{
                  background: "var(--cf-surface-muted)",
                  maxWidth: 280,
                }}
                role="progressbar"
                aria-valuenow={currentBook.progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Book progress: ${currentBook.progressPercent}%`}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, var(--accent-violet), var(--accent-cyan))",
                  }}
                  initial={prefersReducedMotion ? undefined : { width: 0 }}
                  animate={{ width: `${currentBook.progressPercent}%` }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 1, ease: "easeOut", delay: 0.4 }
                  }
                />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className="font-(family-name:--font-jetbrains) text-xs tabular-nums"
                  style={{ color: "var(--cf-text-soft)" }}
                >
                  {currentBook.progressPercent}%
                </span>
                <span className="text-xs" style={{ color: "var(--cf-text-soft)" }}>
                  ⏱ ~{currentBook.estimatedMinutes} min
                </span>
              </div>
            </div>
          )}

          {/* Learning loop (mobile) */}
          {showLoopIndicator && currentBook && (
            <div className="mt-4 lg:hidden">
              <LearningLoopIndicator
                currentStep={currentBook.currentLoopStep}
              />
            </div>
          )}

          {/* CTA Button */}
          <div className="mt-6">
            <Link href={ctaHref}>
              <motion.span
                className="cta-shine cta-shimmer inline-flex cursor-pointer items-center rounded-xl px-8 py-3.5 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)"
                style={{
                  background: "linear-gradient(135deg, var(--accent-violet), #6D28D9)",
                  boxShadow:
                    "0 0 30px -5px rgba(139, 92, 246, 0.60), 0 4px 15px -3px rgba(139, 92, 246, 0.30)",
                  transition: "box-shadow 300ms ease",
                }}
                whileHover={
                  prefersReducedMotion ? undefined : { scale: 1.02 }
                }
                whileTap={
                  prefersReducedMotion ? undefined : { scale: 0.97 }
                }
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                role="button"
                aria-label={
                  currentBook
                    ? `Continue reading chapter ${currentBook.currentChapter} of ${currentBook.title}`
                    : ctaText
                }
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 45px -5px rgba(139, 92, 246, 0.80), 0 4px 20px -3px rgba(139, 92, 246, 0.40)";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 30px -5px rgba(139, 92, 246, 0.60), 0 4px 15px -3px rgba(139, 92, 246, 0.30)";
                }}
              >
                <span className="flex items-center gap-2.5">
                  {ctaText}
                  <span className="cta-arrow inline-block transition-transform duration-200">
                    →
                  </span>
                </span>
              </motion.span>
            </Link>
          </div>
        </div>

        {/* RIGHT: Book cover + loop indicator (desktop only) */}
        {showBookCover && currentBook && (
          <div className="hidden items-center justify-center p-8 lg:flex">
            <div className="flex flex-col items-center gap-5">
              {/* Book cover with ambient glow */}
              <div className="relative">
                {/* Ambient glow behind book — matches cover's dominant color */}
                <div
                  style={{
                    position: "absolute",
                    top: "10%",
                    left: "10%",
                    right: "10%",
                    bottom: "10%",
                    borderRadius: 16,
                    background: `radial-gradient(ellipse at center, rgba(255, 160, 0, 0.35) 0%, transparent 70%)`,
                    filter: "blur(30px)",
                    zIndex: 0,
                  }}
                />
                {/* Subtle cyan gradient glow */}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "100%",
                    height: "100%",
                    borderRadius: 16,
                    boxShadow: "0 0 60px 20px rgba(34,211,238,0.08)",
                    zIndex: 0,
                    pointerEvents: "none",
                  }}
                />
                {/* Book with perspective tilt + hover interaction */}
                <motion.div
                  className="relative"
                  style={{
                    transform: "perspective(800px) rotateY(-5deg)",
                    transformOrigin: "left center",
                  }}
                  initial={
                    prefersReducedMotion
                      ? undefined
                      : { scale: 0.9, opacity: 0 }
                  }
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { scale: 1, opacity: 1 }
                  }
                  whileHover={
                    prefersReducedMotion
                      ? undefined
                      : { rotateY: -8, scale: 1.03 }
                  }
                  transition={
                    prefersReducedMotion
                      ? undefined
                      : { type: "spring", stiffness: 300, damping: 20 }
                  }
                >
                  <Link href={`/book/library/${currentBook.id}`}>
                    <Image
                      src={coverSrc}
                      alt={`${currentBook.title} by ${currentBook.author}`}
                      width={200}
                      height={300}
                      priority
                      className="rounded-lg object-cover ring-1 ring-white/[0.08]"
                      style={{
                        boxShadow:
                          "0 25px 50px -12px rgba(0,0,0,0.6), 0 0 30px -5px rgba(255,160,0,0.15)",
                      }}
                    />
                  </Link>
                </motion.div>
              </div>

              {showLoopIndicator && (
                <LearningLoopIndicator
                  currentStep={currentBook.currentLoopStep}
                />
              )}
            </div>
          </div>
        )}

        {/* New user: abstract book visuals */}
        {userState === "new_user" && (
          <div className="hidden items-center justify-center p-8 lg:flex">
            <div className="flex gap-3">
              {[
                { src: "/book-covers/the-48-laws-of-power.jpg", rot: -8 },
                { src: "/book-covers/friends-and-influence.jpg", rot: 8 },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="overflow-hidden rounded-lg shadow-shadow-elevated ring-1 ring-white/[0.08]"
                  style={{
                    width: 70,
                    height: 100,
                    transform: `rotate(${item.rot}deg)`,
                  }}
                  initial={
                    prefersReducedMotion
                      ? undefined
                      : { y: 20, opacity: 0 }
                  }
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { y: 0, opacity: 1 }
                  }
                  transition={
                    prefersReducedMotion
                      ? undefined
                      : { duration: 0.4, delay: 0.3 + i * 0.1, ease }
                  }
                >
                  <Image
                    src={item.src}
                    alt=""
                    width={70}
                    height={100}
                    className="h-full w-full object-cover"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
