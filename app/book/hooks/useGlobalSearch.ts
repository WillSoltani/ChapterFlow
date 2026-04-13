"use client";

import { useCallback, useRef, useState } from "react";
import type { SearchDocument, GroupedResults } from "@/app/book/types/search";

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
    .catch((err) => {
      indexPromise = null;
      throw err;
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

  return { search, ensureLoaded, indexLoaded, isLoading, error };
}
