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
  const useSegmented = totalChapters <= 20;

  if (useSegmented) {
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
                  ? "var(--accent-emerald)"
                  : isCurrent
                    ? "var(--cf-accent-soft)"
                    : "var(--cf-progress-track)",
              }}
            >
              {isCurrent && (
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${(currentStepNumber / 4) * 100}%`,
                    borderRadius: height >= 6 ? 4 : 2,
                    background: "var(--cf-accent)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Continuous bar for >20 chapters
  const completedPct = (completedChapters / totalChapters) * 100;
  const chapterPct = (1 / totalChapters) * 100;
  const stepWithinChapter = ((currentStepNumber - 1) / 4) * chapterPct;

  return (
    <div
      className="relative w-full overflow-hidden rounded-full"
      style={{ height, background: "var(--cf-progress-track)" }}
      role="progressbar"
      aria-valuenow={completedChapters}
      aria-valuemin={0}
      aria-valuemax={totalChapters}
      aria-label={`Book progress: ${completedChapters} of ${totalChapters} chapters completed`}
    >
      {/* Completed chapters */}
      {completedPct > 0 && (
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${completedPct}%`, background: "var(--accent-emerald)" }}
        />
      )}
      {/* Current chapter progress (within the 4-step loop) */}
      {stepWithinChapter > 0 && (
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            left: `${completedPct}%`,
            width: `${stepWithinChapter}%`,
            background: "color-mix(in srgb, var(--cf-accent) 60%, transparent)",
          }}
        />
      )}
      {/* Current position marker */}
      <div
        className="absolute top-0 h-full rounded-full"
        style={{
          left: `${completedPct + stepWithinChapter}%`,
          width: Math.max(2, height / 4),
          background: "var(--cf-accent)",
        }}
      />
    </div>
  );
}
