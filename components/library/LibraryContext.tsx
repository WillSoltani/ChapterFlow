"use client";

import { createContext, useContext } from "react";
import type { LibraryBook } from "./libraryData";
import type { FreeBookAllowance } from "@/hooks/book/useFreeBookAllowance";

/**
 * Shared library state consumed by the cards (BookCard, HeroRecommendation,
 * CompletedShelf) without threading four props through CuratedSection /
 * BrowseAll. Provided once by LibraryPage (and the Saved page) from live
 * dashboard data — no static MOCK_BOOKS, no fabricated entitlements.
 */
export interface LibraryContextValue {
  /** Live catalog keyed by id — resolves "Similar to" / "Because you loved" against real books. */
  booksById: Map<string, LibraryBook>;
  /** Viewer is on the free plan. */
  isFreeUser: boolean;
  /** Book ids the viewer has unlocked (free slots used + Pro). */
  unlockedBookIds: Set<string>;
  /** Free starts left (D7); null while unknown — then no lock and no label. */
  allowance: FreeBookAllowance | null;
  /** Book ids currently in the viewer's Read Next list. */
  savedSet: Set<string>;
  /** Optimistically toggle a book's saved state and surface a toast. */
  onToggleSave: (bookId: string, title: string) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export const LibraryProvider = LibraryContext.Provider;

export function useLibraryContext(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) {
    throw new Error("useLibraryContext must be used within a LibraryProvider");
  }
  return ctx;
}

/**
 * D7: a Pro lock only for a free reader with no free starts left, on a book they
 * have neither unlocked nor started. Unknown allowance (loading or failed read)
 * → no lock; the server's `/start` still enforces the limit.
 */
export function computeProLocked(
  book: LibraryBook,
  allowance: FreeBookAllowance | null,
): boolean {
  return book.isPro && !book.userProgress && isFreeLimitLocked(book.id, allowance);
}

/** True when a free reader has no free starts left and has not unlocked this book. */
export function isFreeLimitLocked(
  bookId: string,
  allowance: FreeBookAllowance | null,
): boolean {
  if (!allowance || allowance.plan !== "FREE") return false;
  return (
    !allowance.unlockedBookIds.includes(bookId) && allowance.remainingFreeStarts <= 0
  );
}

/**
 * Number of free books a free reader can still start, when this book would use
 * one; null when no "free" label should show (Pro, unknown, already unlocked,
 * or none left).
 */
export function freeStartsLeft(
  bookId: string,
  allowance: FreeBookAllowance | null,
): number | null {
  if (!allowance || allowance.plan !== "FREE") return null;
  if (allowance.unlockedBookIds.includes(bookId)) return null;
  return allowance.remainingFreeStarts > 0 ? allowance.remainingFreeStarts : null;
}

export function freeWithPlanLabel(left: number): string {
  return `Free with your plan (${left} left)`;
}

/** The D7 caption for a book, or null when none should show. */
export function freeCaptionFor(
  bookId: string,
  allowance: FreeBookAllowance | null,
): string | null {
  const left = freeStartsLeft(bookId, allowance);
  return left === null ? null : freeWithPlanLabel(left);
}
