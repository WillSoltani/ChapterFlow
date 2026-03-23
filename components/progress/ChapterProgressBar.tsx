"use client";

import type { StepNumber } from "./progressTypes";

interface ChapterProgressBarProps {
  totalChapters: number;
  completedChapters: number;
  currentChapterNumber: number;
  currentStepNumber: StepNumber;
  height?: number;
}

export function ChapterProgressBar({
  totalChapters,
  completedChapters,
  currentChapterNumber,
  currentStepNumber,
  height = 8,
}: ChapterProgressBarProps) {
  const gap = height >= 6 ? 2 : 1;

  return (
    <div
      className="flex w-full items-center"
      style={{ height, gap }}
      role="progressbar"
      aria-valuenow={completedChapters}
      aria-valuemin={0}
      aria-valuemax={totalChapters}
      aria-label={`Book progress: ${completedChapters} of ${totalChapters} chapters completed`}
    >
      {Array.from({ length: totalChapters }, (_, i) => {
        const chapterNum = i + 1;
        const isCompleted = chapterNum <= completedChapters;
        const isCurrent = chapterNum === currentChapterNumber;

        return (
          <div
            key={chapterNum}
            className="relative flex-1 overflow-hidden"
            style={{
              height,
              borderRadius: height >= 6 ? 4 : 2,
              background: isCompleted
                ? "#34D399"
                : isCurrent
                  ? "rgba(56,189,248,0.15)"
                  : "rgba(255,255,255,0.06)",
            }}
          >
            {/* Inner step progress for current chapter */}
            {isCurrent && (
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${(currentStepNumber / 4) * 100}%`,
                  borderRadius: height >= 6 ? 4 : 2,
                  background: "#38BDF8",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
