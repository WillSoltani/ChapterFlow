"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { DUR } from "@/lib/motion";
import { ChevronDown } from "lucide-react";
import { BookCover } from "@/components/ui/BookCover";
import { BookSaveButton } from "@/components/book/BookSaveButton";
import { useLibraryContext, computeProLocked } from "./LibraryContext";
import { formatReadingTime, type LibraryBook } from "./libraryData";

interface BookCardProps {
  book: LibraryBook;
  index?: number;
  /** "grid" (fluid, default) or "carousel" (fixed width inside a horizontal scroll row). */
  layout?: "grid" | "carousel";
  /** Whether the viewer is on the free plan (Pro-lock gating). */
  showProLock?: boolean;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "var(--accent-emerald)",
  medium: "var(--accent-amber)",
  hard: "var(--accent-rose)",
};

const BADGE_CONFIG: Record<string, { label: string; color: string; glow?: boolean }> = {
  "staff-pick": { label: "Staff Pick ★", color: "var(--accent-gold)" },
  new: { label: "New", color: "var(--accent-rose)" },
};

export function BookCard({ book, index = 0, layout = "grid", showProLock = false }: BookCardProps) {
  const [expanded, setExpanded] = useState(false);
  const prefersReduced = useReducedMotion();
  const panelId = useId();

  const { booksById, unlockedBookIds, savedSet, onToggleSave } = useLibraryContext();
  const badge = book.badges[0]; // Max 1 badge per card
  const isProLocked = computeProLocked(book, showProLock, unlockedBookIds);
  const saved = savedSet.has(book.id);
  const similarBook = book.similarBookId ? booksById.get(book.similarBookId) : undefined;

  const detailHref = `/book/library/${encodeURIComponent(book.id)}`;
  const widthClass =
    layout === "carousel" ? "w-[150px] shrink-0 sm:w-[170px] md:w-auto" : "w-full";

  return (
    <article
      className={`group relative ${widthClass}`}
      style={layout === "carousel" ? { scrollSnapAlign: "start" } : undefined}
    >
      {/* Primary target: cover + title + meta is one real anchor (keyboard: Tab → Enter opens detail). */}
      <Link
        href={detailHref}
        aria-label={`${book.title} by ${book.author}`}
        className="block rounded-[var(--radius-md-val)] cf-focus"
      >
        {/* Cover */}
        <motion.div
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: "2/3",
            borderRadius: "var(--radius-md-val)",
            boxShadow: "var(--shadow-book)",
          }}
          initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: DUR.page, delay: index * 0.06 }}
          whileHover={prefersReduced ? {} : { y: -4, boxShadow: "var(--shadow-elevated)" }}
        >
          <BookCover
            bookId={book.id}
            title={book.title}
            coverGradient={book.coverGradient}
            coverImage={book.coverImage}
            fill
          />

          {/* Badge */}
          {badge && BADGE_CONFIG[badge] && (
            <span
              className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                BADGE_CONFIG[badge].glow ? "ring-1 ring-inset ring-white/20" : ""
              }`}
              style={{
                background: BADGE_CONFIG[badge].color,
                boxShadow: BADGE_CONFIG[badge].glow ? `0 0 12px ${BADGE_CONFIG[badge].color}` : undefined,
              }}
            >
              {BADGE_CONFIG[badge].label}
            </span>
          )}

          {/* Pro lock overlay — only when the free viewer hasn't unlocked/started it */}
          {isProLocked && (
            <div
              className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-3"
              style={{
                height: "32%",
                background: "linear-gradient(to top, var(--cf-overlay), transparent)",
              }}
            >
              <span
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                style={{
                  background: "var(--cf-gold-soft)",
                  border: "1px solid var(--cf-gold-border)",
                  color: "var(--cf-amber-text)",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--accent-gold)" stroke="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="var(--accent-gold)" strokeWidth="2" />
                </svg>
                Pro
              </span>
            </div>
          )}
        </motion.div>

        {/* Title */}
        <h3
          className="mt-2.5 text-cf-body font-semibold leading-snug"
          style={{
            color: "var(--text-heading)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {book.title}
        </h3>

        {/* Author */}
        <p className="mt-0.5 truncate text-cf-label" style={{ color: "var(--text-secondary)" }}>
          {book.author}
        </p>

        {/* Hook */}
        <p
          className="mt-1 text-cf-label leading-snug"
          style={{
            color: "var(--text-primary)",
            opacity: 0.7,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {book.hook}
        </p>

        {/* Honest metadata — category · difficulty · time · chapters (no fabricated counts) */}
        <div
          className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-cf-label-sm"
          style={{ color: "var(--text-muted)" }}
        >
          <span className="cf-chip px-2 py-px">
            {book.category}
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: DIFFICULTY_COLORS[book.difficulty] }}
            />
            {book.difficulty.charAt(0).toUpperCase() + book.difficulty.slice(1)}
          </span>
          <span>~{formatReadingTime(book.estimatedReadingTimeMinutes)}</span>
          <span aria-hidden="true">·</span>
          <span>{book.totalChapters} chapters</span>
        </div>
      </Link>

      {/* Save affordance — overlays the cover, but a sibling of the anchor (no nested interactive). */}
      <div className="absolute left-2 top-2 z-20">
        <BookSaveButton
          saved={saved}
          onToggle={() => onToggleSave(book.id, book.title)}
          className="shadow-(--cf-shadow-sm)"
        />
      </div>

      {/* Explicit disclosure — accessible, no hidden focusables (panel is conditionally rendered). */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 flex min-h-11 cursor-pointer items-center gap-1 text-cf-label-sm font-medium transition-colors"
        style={{ color: "var(--accent-cyan)" }}
      >
        {expanded ? "Hide details" : "What you'll learn"}
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div id={panelId} className="pt-2">
          <ul className="flex flex-col gap-1">
            {book.whatYoullLearn.map((item, j) => (
              <li key={j} className="text-cf-label-sm leading-snug" style={{ color: "var(--text-secondary)" }}>
                {item}
              </li>
            ))}
          </ul>

          {book.staffPickReason && (
            <p className="mt-2 text-cf-label-sm italic leading-snug" style={{ color: "var(--text-tertiary)" }}>
              Why we picked it: {book.staffPickReason}
            </p>
          )}

          {book.bestFor.length > 0 && (
            <p className="mt-2 text-cf-caption" style={{ color: "var(--text-muted)" }}>
              Best for:{" "}
              <span style={{ color: "var(--text-secondary)" }}>{book.bestFor.join(" · ")}</span>
            </p>
          )}

          <div className="mt-3">
            {isProLocked ? (
              <Link
                href="/pricing"
                className="inline-block cursor-pointer rounded-lg px-4 py-2 text-cf-label font-semibold transition-colors"
                style={{
                  background: "var(--cf-gold-soft)",
                  border: "1px solid var(--cf-gold-border)",
                  color: "var(--cf-amber-text)",
                }}
              >
                Unlock with Pro
              </Link>
            ) : (
              <Link
                href={detailHref}
                className="inline-block cursor-pointer rounded-lg px-4 py-2 text-cf-label font-semibold transition-colors"
                style={{ background: "var(--accent-cyan)", color: "var(--bg-base)" }}
              >
                {book.userProgress ? "Continue reading" : "Start reading"}
              </Link>
            )}
          </div>

          {/* Similar book — resolved against the LIVE catalog, not static MOCK_BOOKS */}
          {similarBook && (
            <p className="mt-2 text-cf-caption" style={{ color: "var(--text-muted)" }}>
              Similar to:{" "}
              <Link
                href={`/book/library/${encodeURIComponent(similarBook.id)}`}
                className="cursor-pointer transition-colors"
                style={{ color: "var(--accent-cyan)" }}
              >
                {similarBook.title}
              </Link>
            </p>
          )}
        </div>
      )}
    </article>
  );
}
