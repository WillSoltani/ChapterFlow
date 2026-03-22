"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DashboardBookCover } from "@/components/ui/DashboardBookCover";
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
  title: string;
  author: string;
  coverUrl: string;
  currentChapter: number;
  totalChapters: number;
  progressPercent: number;
  currentLoopStep: LoopStep | null;
  estimatedMinutes: number;
  gradient?: string;
}

interface HeroSessionCardProps {
  userState: UserState;
  currentBook: CurrentBook | null;
  firstName: string;
}

function getStatusBadge(userState: UserState): { label: string; color: string } {
  switch (userState) {
    case "active_reader":
      return { label: "CONTINUE READING", color: "#7C3AED" };
    case "new_user":
      return { label: "READY TO START", color: "#10B981" };
    case "quiz_pending":
      return { label: "QUIZ TIME", color: "#F59E0B" };
    case "between_books":
      return { label: "BOOK COMPLETE", color: "#F59E0B" };
    case "returning":
      return { label: "WELCOME BACK", color: "#7C3AED" };
    case "free_limit_reached":
      return { label: "UNLOCK MORE", color: "#F59E0B" };
    default:
      return { label: "CONTINUE READING", color: "#7C3AED" };
  }
}

function getCTAText(userState: UserState, book: CurrentBook | null): string {
  switch (userState) {
    case "new_user":
      return "Pick Your First Book →";
    case "active_reader":
      return `Continue Chapter ${book?.currentChapter ?? 1} →`;
    case "quiz_pending":
      return "Take the Quiz →";
    case "between_books":
      return "Explore Library →";
    case "returning":
      return "Pick Up Where You Left Off →";
    case "free_limit_reached":
      return "Unlock Your Full Library →";
    default:
      return "Continue →";
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
  const title = getHeroTitle(userState, currentBook, firstName);
  const subtitle = getHeroSubtitle(userState, currentBook);
  const showBookCover =
    currentBook && userState !== "new_user" && userState !== "between_books";
  const showProgress =
    currentBook && userState !== "new_user" && userState !== "between_books";
  const showLoopIndicator =
    currentBook?.currentLoopStep &&
    (userState === "active_reader" || userState === "quiz_pending");

  return (
    <motion.div
      className="group overflow-hidden rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(24px) saturate(150%)",
        WebkitBackdropFilter: "blur(24px) saturate(150%)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 0 40px -8px rgba(124,58,237,0.2)",
        transition: "box-shadow 300ms ease",
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
          "0 0 50px -8px rgba(124,58,237,0.35)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 0 40px -8px rgba(124,58,237,0.2)";
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
              className="text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: badge.color }}
            >
              {badge.label}
            </span>
          </div>

          {/* Title */}
          <h2
            className="mt-4 font-(family-name:--font-display) text-3xl font-bold md:text-4xl"
            style={{ color: "#F0F0F0" }}
          >
            {title}
          </h2>

          {/* Subtitle */}
          {subtitle && (
            <p className="mt-1.5 text-lg" style={{ color: "#A0A0B8" }}>
              {subtitle}
            </p>
          )}

          {/* Chapter progress */}
          {showProgress && currentBook && (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "#A0A0B8" }}>
                  Chapter {currentBook.currentChapter} of{" "}
                  {currentBook.totalChapters}
                </span>
              </div>
              <div
                className="mt-2 h-1 overflow-hidden rounded-full"
                style={{
                  background: "rgba(255,255,255,0.06)",
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
                    background:
                      "linear-gradient(90deg, #7C3AED, #A78BFA)",
                  }}
                  initial={prefersReducedMotion ? undefined : { width: 0 }}
                  animate={{
                    width: `${currentBook.progressPercent}%`,
                  }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 1, ease: "easeOut", delay: 0.3 }
                  }
                />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className="font-(family-name:--font-jetbrains) text-xs tabular-nums"
                  style={{ color: "#6B6B80" }}
                >
                  {currentBook.progressPercent}%
                </span>
                <span className="text-xs" style={{ color: "#6B6B80" }}>
                  ⏱ ~{currentBook.estimatedMinutes} min
                </span>
              </div>
            </div>
          )}

          {/* Learning loop indicator (mobile: show below progress) */}
          {showLoopIndicator && currentBook && (
            <div className="mt-4 lg:hidden">
              <LearningLoopIndicator
                currentStep={currentBook.currentLoopStep}
              />
            </div>
          )}

          {/* CTA Button */}
          <div className="mt-6">
            <button
              className="cta-shine cursor-pointer rounded-xl px-8 py-3.5 text-base font-semibold text-white transition-all hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, #7C3AED, #6D28D9)",
                boxShadow:
                  "0 0 24px rgba(124,58,237,0.3), 0 4px 16px rgba(124,58,237,0.2)",
              }}
              aria-label={
                currentBook
                  ? `Continue reading chapter ${currentBook.currentChapter} of ${currentBook.title}`
                  : ctaText.replace(" →", "")
              }
              onMouseOver={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 0 32px rgba(124,58,237,0.4), 0 4px 20px rgba(124,58,237,0.3)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 0 24px rgba(124,58,237,0.3), 0 4px 16px rgba(124,58,237,0.2)";
              }}
            >
              {ctaText.replace(" →", "")}{" "}
              <motion.span
                className="inline-block"
                whileHover={prefersReducedMotion ? undefined : { x: 4 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                →
              </motion.span>
            </button>
          </div>
        </div>

        {/* RIGHT: Book cover + loop indicator (desktop only) */}
        {showBookCover && currentBook && (
          <div className="hidden items-center justify-center p-8 lg:flex">
            <div className="flex flex-col items-center gap-5">
              <motion.div
                style={{
                  transform: "perspective(800px) rotateY(-5deg)",
                  filter:
                    "drop-shadow(0 8px 24px rgba(0,0,0,0.4))",
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
                transition={
                  prefersReducedMotion
                    ? undefined
                    : { duration: 0.5, delay: 0.2, ease }
                }
              >
                <DashboardBookCover
                  title={currentBook.title}
                  gradient={
                    currentBook.gradient ||
                    "linear-gradient(135deg, #2563EB, #1E40AF)"
                  }
                  width={140}
                  height={196}
                />
              </motion.div>

              {showLoopIndicator && (
                <LearningLoopIndicator
                  currentStep={currentBook.currentLoopStep}
                />
              )}
            </div>
          </div>
        )}

        {/* New user: abstract visual */}
        {userState === "new_user" && (
          <div className="hidden items-center justify-center p-8 lg:flex">
            <div className="flex gap-3">
              {[
                "linear-gradient(135deg, #7C3AED, #6D28D9)",
                "linear-gradient(135deg, #2563EB, #1E40AF)",
                "linear-gradient(135deg, #D97706, #B45309)",
              ].map((g, i) => (
                <motion.div
                  key={i}
                  className="rounded-lg"
                  style={{
                    width: 60,
                    height: 84,
                    background: g,
                    opacity: 0.6 + i * 0.15,
                    transform: `rotate(${(i - 1) * 8}deg)`,
                  }}
                  initial={
                    prefersReducedMotion
                      ? undefined
                      : { y: 20, opacity: 0 }
                  }
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { y: 0, opacity: 0.6 + i * 0.15 }
                  }
                  transition={
                    prefersReducedMotion
                      ? undefined
                      : { duration: 0.4, delay: 0.3 + i * 0.1, ease }
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
