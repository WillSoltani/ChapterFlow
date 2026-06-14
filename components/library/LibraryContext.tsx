"use client";

import { createContext, useContext } from "react";
import type { LibraryBook } from "./libraryData";

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
 * Pro lock is true only for a free user looking at a Pro book they have neither
 * unlocked nor already started. Fixes the bug where `isProLocked = showProLock &&
 * book.isPro` showed "Unlock with Pro" on books the user already owns / is reading.
 */
export function computeProLocked(
  book: LibraryBook,
  isFreeUser: boolean,
  unlockedBookIds: Set<string>,
): boolean {
  return (
    isFreeUser && book.isPro && !unlockedBookIds.has(book.id) && !book.userProgress
  );
}
