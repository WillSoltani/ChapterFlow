"use client";

import type { PrerequisiteConcept } from "@/app/book/hooks/useConceptPrerequisites";

type Props = {
  prerequisites: PrerequisiteConcept[];
  onDismiss: () => void;
  onNavigateToChapter?: (chapterNumber: number) => void;
};

export function PrerequisiteRefresher({
  prerequisites,
  onDismiss,
  onNavigateToChapter,
}: Props) {
  if (prerequisites.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Before you dive in
        </h3>
        <button
          onClick={onDismiss}
          className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
        >
          Dismiss
        </button>
      </div>
      <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
        This chapter builds on concepts from earlier chapters you haven&apos;t completed yet.
      </p>
      <div className="space-y-2">
        {prerequisites.map((concept) => (
          <div
            key={concept.id}
            className="rounded-md border border-amber-100 bg-white p-3 dark:border-amber-900 dark:bg-amber-950/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  {concept.label}
                </p>
                {concept.summary && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    {concept.summary}
                  </p>
                )}
              </div>
              {onNavigateToChapter && (
                <button
                  onClick={() => onNavigateToChapter(concept.fromChapterNumber)}
                  className="shrink-0 rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
                >
                  Ch {concept.fromChapterNumber}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
