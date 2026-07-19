"use client";

import { cn } from "@/lib/utils";

export function SectionNav({
  sections,
  activeIndex,
  onNavigate,
}: {
  sections: { id: string; label: string }[];
  activeIndex: number;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav
      className="fixed right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 lg:flex"
      aria-label="Section navigation"
    >
      {sections.map((section, i) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onNavigate(section.id)}
          className="group relative flex items-center justify-end"
          aria-label={`Go to ${section.label}`}
        >
          <span className="pointer-events-none absolute right-5 whitespace-nowrap rounded-lg bg-(--cf-surface-strong) px-2.5 py-1 text-xs text-(--cf-text-2) opacity-0 shadow-shadow-elevated transition-opacity group-hover:opacity-100">
            {section.label}
          </span>
          <span className={cn(
            "h-2 w-2 rounded-full transition-all",
            i === activeIndex ? "h-2.5 w-2.5 bg-(--cf-accent)" : "bg-(--cf-text-soft)/40 hover:bg-(--cf-text-soft)"
          )} />
        </button>
      ))}
    </nav>
  );
}
