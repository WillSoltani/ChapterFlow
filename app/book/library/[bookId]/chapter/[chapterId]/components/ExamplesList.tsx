"use client";

import type { ChapterExample } from "@/app/book/data/mockChapters";
import type { ExampleFilter } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

const options: Array<{ id: ExampleFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "work", label: "Work" },
  { id: "school", label: "School" },
  { id: "personal", label: "Personal" },
];

type ExamplesListProps = {
  examples: ChapterExample[];
  filter: ExampleFilter;
  onFilterChange: (value: ExampleFilter) => void;
  fontScaleClass: string;
};

export function ExamplesList({
  examples,
  filter,
  onFilterChange,
  fontScaleClass,
}: ExamplesListProps) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-100">Real-world examples</h2>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = option.id === filter;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onFilterChange(option.id)}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  active
                    ? "border-sky-300/45 bg-sky-500/16 text-sky-100"
                    : "border-white/20 bg-white/5 text-slate-300 hover:border-white/35",
                ].join(" ")}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {examples.map((example) => (
          <article
            key={example.id}
            className="rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_18px_38px_rgba(2,6,23,0.42)]"
          >
            <h3 className="text-3xl font-semibold text-slate-100">{example.title}</h3>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Scenario</p>
                <p className={["mt-1 text-slate-200", fontScaleClass].join(" ")}>{example.scenario}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">What to do</p>
                <p className={["mt-1 text-slate-100", fontScaleClass].join(" ")}>{example.whatToDo}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Why it matters</p>
                <p className={["mt-1 text-slate-200", fontScaleClass].join(" ")}>{example.whyItMatters}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
