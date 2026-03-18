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
    <div className="inline-flex rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-1 shadow-sm">
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
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
              active
                ? "bg-(--cf-surface-strong) text-(--cf-accent) shadow-sm"
                : "text-(--cf-text-3) hover:bg-(--cf-surface) hover:text-(--cf-text-2)",
            ].join(" ")}
            aria-pressed={active}
          >
            <Icon className={active ? "h-4 w-4 text-(--cf-accent)" : "h-4 w-4 text-(--cf-text-soft)"} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
