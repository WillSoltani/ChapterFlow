"use client";

import { useMemo } from "react";
import { useBookQuery } from "@/lib/client/book-api-cache";
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
  // Stabilize the array dependency to prevent re-renders when contents haven't changed
  const completedKey = completedChapters.join(",");
  const stableCompleted = useMemo(
    () => new Set(completedChapters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completedKey]
  );

  const graphQuery = useBookQuery<ConceptGraphResponse>(
    `/app/api/book/books/${bookId}/concept-graph`
  );

  const prerequisites = useMemo<PrerequisiteConcept[]>(() => {
    const conceptGraph = graphQuery.data?.conceptGraph;
    if (!conceptGraph) return [];

    const chapterKey = `ch${String(chapterNumber).padStart(2, "0")}`;
    const requiredConceptIds = conceptGraph.chapterRequires[chapterKey] ?? [];

    const missing: PrerequisiteConcept[] = [];

    for (const conceptId of requiredConceptIds) {
      const concept = conceptGraph.concepts.find((c) => c.id === conceptId);
      if (!concept) continue;

      const introducedChapterNum = parseInt(
        concept.introducedIn.replace("ch", ""),
        10
      );

      if (!stableCompleted.has(introducedChapterNum)) {
        missing.push({
          ...concept,
          fromChapterNumber: introducedChapterNum,
        });
      }
    }

    return missing;
  }, [graphQuery.data, chapterNumber, stableCompleted]);

  const loading = graphQuery.loading;

  return { prerequisites, loading };
}
