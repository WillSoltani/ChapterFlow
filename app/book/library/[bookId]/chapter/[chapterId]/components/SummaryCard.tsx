"use client";

import { BookmarkPlus, ChevronDown, ChevronUp, Quote } from "lucide-react";

type SummaryCardProps = {
  bullets: string[];
  takeaways: string[];
  keyQuote?: string;
  recap?: string;
  showRecap: boolean;
  onToggleRecap: () => void;
  onSaveTakeaways: () => void;
  fontScaleClass: string;
};

export function SummaryCard({
  bullets,
  takeaways,
  keyQuote,
  recap,
  showRecap,
  onToggleRecap,
  onSaveTakeaways,
  fontScaleClass,
}: SummaryCardProps) {
  return (
    <div className="space-y-4">
      {/* Main summary */}
      <section className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-6 shadow-[0_20px_50px_rgba(2,6,23,0.5)] sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Summary</p>
            <h2 className="mt-0.5 text-xl font-semibold text-slate-100">Chapter Breakdown</h2>
          </div>
          <button
            type="button"
            onClick={onSaveTakeaways}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save to notes
          </button>
        </div>

        <ul className="space-y-3.5">
          {bullets.map((bullet, i) => (
            <li key={bullet} className={["group flex gap-3.5", fontScaleClass].join(" ")}>
              <span className="mt-[0.4em] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sky-300/30 bg-sky-500/12 text-[10px] font-bold tabular-nums text-sky-300">
                {i + 1}
              </span>
              <span className="text-slate-200 leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Key quote */}
      {keyQuote ? (
        <section className="relative overflow-hidden rounded-2xl border border-sky-300/18 bg-[linear-gradient(135deg,rgba(14,116,144,0.18),rgba(2,6,23,0.60))] px-6 py-5">
          <Quote className="absolute right-4 top-3 h-10 w-10 rotate-180 text-sky-300/12" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-400/70">Key Quote</p>
          <p className={["relative mt-2 text-slate-100 italic", fontScaleClass].join(" ")}>
            &ldquo;{keyQuote}&rdquo;
          </p>
        </section>
      ) : null}

      {/* 1-min recap */}
      {recap ? (
        <section className="rounded-2xl border border-white/10 bg-white/3">
          <button
            type="button"
            onClick={onToggleRecap}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/3"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              1-minute recap
            </span>
            {showRecap
              ? <ChevronUp className="h-4 w-4 text-slate-500" />
              : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>
          {showRecap ? (
            <p className={["border-t border-white/8 px-4 pb-4 pt-3 text-slate-300", fontScaleClass].join(" ")}>
              {recap}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Key takeaways */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Key Takeaways
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {takeaways.map((takeaway) => (
            <span
              key={takeaway}
              className="rounded-full border border-sky-300/28 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200"
            >
              {takeaway}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
