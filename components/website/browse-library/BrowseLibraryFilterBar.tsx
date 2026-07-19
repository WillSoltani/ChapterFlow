"use client";

import { useEffect, useRef, useState } from "react";
import { SORT_OPTIONS, type SortOption } from "./browse-library-core";
import { ChevronDown } from "./BrowseLibraryIcons";

export function BrowseLibraryFilterBar({
  categories,
  activeCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  resultCount,
  totalCount,
}: {
  categories: { name: string; count: number }[];
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  resultCount: number;
  totalCount: number;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Close sort dropdown on outside click or Escape
  useEffect(() => {
    if (!sortOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      setSortOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, [sortOpen]);

  return (
    <>
      <div ref={sentinelRef} className="h-0" />
      <div
        className="sticky z-40 transition-all duration-300 py-3"
        style={{
          top: 64, // matches Navbar height — update here if Navbar height changes
          background: isSticky ? "color-mix(in srgb, var(--bg-base) 85%, transparent)" : "transparent",
          backdropFilter: isSticky ? "blur(24px)" : "none",
          WebkitBackdropFilter: isSticky ? "blur(24px)" : "none",
          borderBottom: isSticky ? "1px solid var(--border-subtle)" : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4">
          {/* Category pills */}
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2" role="tablist" aria-label="Filter by category">
              <button
                role="tab"
                aria-selected={activeCategory === "All"}
                onClick={() => onCategoryChange("All")}
                className="shrink-0 rounded-full px-4 py-2 text-cf-label font-medium transition-all duration-200"
                style={
                  activeCategory === "All"
                    ? { background: "var(--accent-cyan)", color: "var(--primary-foreground)", fontWeight: 600 }
                    : { background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }
                }
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  role="tab"
                  aria-selected={activeCategory === cat.name}
                  onClick={() => onCategoryChange(cat.name)}
                  className="shrink-0 rounded-full px-4 py-2 text-cf-label font-medium transition-all duration-200 whitespace-nowrap"
                  style={
                    activeCategory === cat.name
                      ? { background: "var(--accent-cyan)", color: "var(--primary-foreground)", fontWeight: 600 }
                      : { background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }
                  }
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>
          </div>

          {/* Result count */}
          <span className="hidden md:block text-cf-label-sm shrink-0" style={{ color: "var(--text-muted)" }}>
            Showing {resultCount} of {totalCount}
          </span>

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setSortOpen((p) => !p); }}
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSortOpen(false);
                if (e.key === "ArrowDown") { e.preventDefault(); setSortOpen(true); }
              }}
              className="flex items-center gap-1.5 text-cf-label px-3 py-2 rounded-lg transition-colors hover:bg-(--bg-glass) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="hidden sm:inline">Sort:</span>{" "}
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
              <ChevronDown />
            </button>

            {sortOpen && (
              <div
                role="listbox"
                className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden z-50"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: "0 12px 40px color-mix(in srgb, var(--cf-palette-black) 50%, transparent)",
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    role="option"
                    aria-selected={sortBy === opt.value}
                    onClick={() => { onSortChange(opt.value); setSortOpen(false); }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setSortOpen(false); }
                      if (e.key === "Enter" || e.key === " ") { onSortChange(opt.value); setSortOpen(false); }
                    }}
                    className="block w-full text-left px-4 py-2.5 text-cf-label transition-colors hover:bg-(--bg-glass) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60"
                    style={{
                      color: sortBy === opt.value ? "var(--accent-cyan)" : "var(--text-secondary)",
                      fontWeight: sortBy === opt.value ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
