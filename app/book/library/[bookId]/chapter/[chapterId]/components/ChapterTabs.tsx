"use client";

import { FileText, HelpCircle, Lightbulb } from "lucide-react";
import type { ComponentType } from "react";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

const tabs: Array<{
  id: ChapterTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "examples", label: "Examples", icon: Lightbulb },
  { id: "quiz", label: "Quiz", icon: HelpCircle },
];

type ChapterTabsProps = {
  value: ChapterTab;
  onChange: (tab: ChapterTab) => void;
};

export function ChapterTabs({ value, onChange }: ChapterTabsProps) {
  return (
    <div className="inline-flex rounded-2xl border border-white/15 bg-white/3 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      {tabs.map((tab) => {
        const active = tab.id === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
              active
                ? "bg-sky-500/18 text-sky-50 shadow-[0_1px_3px_rgba(2,6,23,0.35),0_0_0_1px_rgba(56,189,248,0.18)]"
                : "text-slate-400 hover:bg-white/6 hover:text-slate-200",
            ].join(" ")}
            aria-pressed={active}
          >
            <Icon className={active ? "h-4 w-4 text-sky-300" : "h-4 w-4 text-slate-500"} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
