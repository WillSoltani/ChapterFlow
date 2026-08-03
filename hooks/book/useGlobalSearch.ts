"use client";

import { useCallback, useRef, useState } from "react";
import type { SearchDocument, GroupedResults } from "@/lib/search-types";

let cachedIndex: SearchDocument[] | null = null;
let indexPromise: Promise<SearchDocument[]> | null = null;

/**
 * Stop-words dropped from every query so common connective words don't flood the
 * panel. "by" is the worst offender: the indexed book text is literally
 * "<title> by <author>", so an un-filtered "by" used to match every book.
 */
export const SEARCH_STOP_WORDS = new Set([
  "the",
  "by",
  "and",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
]);

/** Tokenize a raw query into meaningful search terms (≥2 chars, no stop-words). */
export function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !SEARCH_STOP_WORDS.has(t));
}

/**
 * Score a book against pre-tokenized terms using ONLY its title + author
 * (search is books-only — tags/categories no longer participate, which is what
 * used to surface unrelated books via hidden tags). Title matches are boosted.
 * Shared by the enhanced-index scorer and the local catalog fallback so both
 * paths rank identically.
 */
export function scoreBookMatch(bookTitle: string, author: string, terms: string[]): number {
  const title = bookTitle.toLowerCase();
  const searchable = `${title} ${author.toLowerCase()}`;
  const words = searchable.split(/\s+/);

  let score = 0;
  for (const term of terms) {
    if (searchable.includes(term)) {
      score += 1;
      // Boost for title-level matches
      if (title.includes(term)) score += 2;
      // Boost for exact word match
      if (words.includes(term)) score += 0.5;
    }
  }
  return score;
}

async function loadIndex(): Promise<SearchDocument[]> {
  if (cachedIndex) return cachedIndex;
  if (indexPromise) return indexPromise;

  indexPromise = fetch("/app/api/book/search-index")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load search index");
      return res.json() as Promise<SearchDocument[]>;
    })
    .then((docs) => {
      cachedIndex = docs;
      return docs;
    })
    .catch((err) => {
      indexPromise = null;
      throw err;
    });

  return indexPromise;
}

export function useGlobalSearch() {
  const [index, setIndex] = useState<SearchDocument[]>([]);
  const [indexLoaded, setIndexLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setIsLoading(true);
    try {
      const docs = await loadIndex();
      setIndex(docs);
      setIndexLoaded(docs.length > 0);
    } catch {
      setError("Failed to load search index");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const search = useCallback(
    (query: string): GroupedResults => {
      const terms = tokenizeQuery(query);

      if (terms.length === 0 || index.length === 0) {
        return { books: [], chapters: [], takeaways: [], examples: [] };
      }

      const books = index
        .filter((doc) => doc.type === "book")
        .map((doc) => ({ ...doc, score: scoreBookMatch(doc.bookTitle, doc.author, terms) }))
        .filter((doc) => doc.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      return { books, chapters: [], takeaways: [], examples: [] };
    },
    [index],
  );

  return { search, ensureLoaded, indexLoaded, isLoading, error };
}
