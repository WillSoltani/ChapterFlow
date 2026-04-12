"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SearchDocument = {
  id: string;
  type: "book" | "chapter" | "takeaway" | "example";
  bookId: string;
  bookTitle: string;
  author: string;
  chapterNumber?: number;
  chapterTitle?: string;
  text: string;
  tags: string[];
  categories: string[];
};

export type SearchResult = SearchDocument & { score: number };

type GroupedResults = {
  books: SearchResult[];
  chapters: SearchResult[];
  takeaways: SearchResult[];
  examples: SearchResult[];
};

let cachedIndex: SearchDocument[] | null = null;
let indexPromise: Promise<SearchDocument[]> | null = null;

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
    .catch(() => {
      indexPromise = null;
      return [];
    });

  return indexPromise;
}

function scoreDocument(doc: SearchDocument, terms: string[]): number {
  let score = 0;
  const searchable = `${doc.text} ${doc.bookTitle} ${doc.author} ${doc.tags.join(" ")}`.toLowerCase();

  for (const term of terms) {
    if (searchable.includes(term)) {
      score += 1;
      // Boost for title-level matches
      if (doc.bookTitle.toLowerCase().includes(term)) score += 2;
      if (doc.chapterTitle?.toLowerCase().includes(term)) score += 1.5;
      // Boost for exact word match
      if (searchable.split(/\s+/).includes(term)) score += 0.5;
    }
  }

  // Type-based boosting
  if (doc.type === "book") score *= 2;
  if (doc.type === "chapter") score *= 1.5;

  return score;
}

export function useGlobalSearch() {
  const [index, setIndex] = useState<SearchDocument[]>([]);
  const [indexLoaded, setIndexLoaded] = useState(false);
  const loadedRef = useRef(false);

  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const docs = await loadIndex();
    setIndex(docs);
    setIndexLoaded(true);
  }, []);

  const search = useCallback(
    (query: string): GroupedResults => {
      const terms = query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2);

      if (terms.length === 0 || index.length === 0) {
        return { books: [], chapters: [], takeaways: [], examples: [] };
      }

      const scored = index
        .map((doc) => ({ ...doc, score: scoreDocument(doc, terms) }))
        .filter((doc) => doc.score > 0)
        .sort((a, b) => b.score - a.score);

      return {
        books: scored.filter((d) => d.type === "book").slice(0, 6),
        chapters: scored.filter((d) => d.type === "chapter").slice(0, 8),
        takeaways: scored.filter((d) => d.type === "takeaway").slice(0, 6),
        examples: scored.filter((d) => d.type === "example").slice(0, 6),
      };
    },
    [index],
  );

  return { search, ensureLoaded, indexLoaded };
}
