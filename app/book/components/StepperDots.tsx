"use client";

type StepperDotsProps = {
  total: number;
  current: number;
  labels?: string[];
};

export function StepperDots({
  total,
  current,
  labels = [],
}: StepperDotsProps) {
  const hasLabels = labels.length === total;

  return (
    <div className="space-y-3" aria-label={`Step ${current + 1} of ${total}`}>
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, index) => {
          const isActive = index === current;
          const isComplete = index < current;

          return (
            <div key={index} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-hidden="true"
                className={[
                  "block h-2.5 w-full rounded-full transition-all duration-300",
                  isActive
                    ? "bg-(--cf-accent) shadow-[0_0_24px_var(--cf-accent-shadow)]"
                    : isComplete
                      ? "bg-(--cf-accent-border)"
                      : "bg-(--cf-border-strong)",
                ].join(" ")}
              />
            </div>
          );
        })}
      </div>

      {hasLabels ? (
        <>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-(--cf-text-3) md:hidden">
            {labels[current]}
          </p>

          <ol
            className="hidden gap-2 md:grid"
            style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
          >
            {labels.map((label, index) => {
              const isActive = index === current;
              const isComplete = index < current;

              return (
                <li
                  key={label}
                  aria-current={isActive ? "step" : undefined}
                  className={[
                    "truncate rounded-full border px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors",
                    isActive
                      ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text)"
                      : isComplete
                        ? "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)"
                        : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-3)",
                  ].join(" ")}
                >
                  {label}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </div>
  );
}
