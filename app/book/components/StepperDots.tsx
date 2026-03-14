"use client";

type StepperDotsProps = {
  total: number;
  current: number;
};

export function StepperDots({ total, current }: StepperDotsProps) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      aria-label={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === current;
        return (
          <span
            key={index}
            aria-hidden="true"
            className={[
              "rounded-full transition-all duration-200",
              isActive
                ? "h-2.5 w-12 bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.55)]"
                : "h-2.5 w-2.5 bg-white/20",
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}

