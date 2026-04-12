"use client";

import { useEffect, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { ConceptGraph, ConceptNode } from "@/app/app/api/book/_lib/types";

export type PrerequisiteConcept = ConceptNode & {
  fromChapterNumber: number;
};

type ConceptGraphResponse = {
  conceptGraph: ConceptGraph | null;
};

export function useConceptPrerequisites(
  bookId: string,
  chapterNumber: number,
  completedChapters: number[]
) {
  const [prerequisites, setPrerequisites] = useState<PrerequisiteConcept[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { conceptGraph } = await fetchBookJson<ConceptGraphResponse>(
          `/app/api/book/books/${bookId}/concept-graph`
        );

        if (!mounted || !conceptGraph) {
          setPrerequisites([]);
          setLoading(false);
          return;
        }

        const chapterKey = `ch${String(chapterNumber).padStart(2, "0")}`;
        const requiredConceptIds = conceptGraph.chapterRequires[chapterKey] ?? [];
        const completedSet = new Set(completedChapters);

        const missing: PrerequisiteConcept[] = [];

        for (const conceptId of requiredConceptIds) {
          const concept = conceptGraph.concepts.find((c) => c.id === conceptId);
          if (!concept) continue;

          const introducedChapterNum = parseInt(
            concept.introducedIn.replace("ch", ""),
            10
          );

          if (!completedSet.has(introducedChapterNum)) {
            missing.push({
              ...concept,
              fromChapterNumber: introducedChapterNum,
            });
          }
        }

        setPrerequisites(missing);
      } catch {
        setPrerequisites([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [bookId, chapterNumber, completedChapters]);

  return { prerequisites, loading };
}
