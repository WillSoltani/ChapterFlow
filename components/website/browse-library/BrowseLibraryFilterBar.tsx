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
            <div className="flex gap-2" role="group" aria-label="Filter by category">
              <button
                type="button"
                aria-pressed={activeCategory === "All"}
                onClick={() => onCategoryChange("All")}
                className="min-h-[44px] shrink-0 rounded-full px-4 py-2 text-cf-label font-medium transition-all duration-200"
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
                  type="button"
                  aria-pressed={activeCategory === cat.name}
                  onClick={() => onCategoryChange(cat.name)}
                  className="min-h-[44px] shrink-0 rounded-full px-4 py-2 text-cf-label font-medium transition-all duration-200 whitespace-nowrap"
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

          {/* Native sorting control retains platform arrow-key, Escape, and
              focus-return behavior while sharing the Recall visual language. */}
          <div className="flex min-h-[44px] shrink-0 items-center gap-1.5">
            <span aria-hidden="true" className="hidden text-cf-label sm:inline" style={{ color: "var(--text-secondary)" }}>
              Sort:
            </span>
            <div className="relative">
              <select
                aria-label="Sort books"
                value={sortBy}
                onChange={(event) => onSortChange(event.target.value as SortOption)}
                className="min-h-[44px] cursor-pointer appearance-none rounded-lg bg-transparent py-2 pl-2 pr-8 text-cf-label transition-colors hover:bg-(--bg-glass) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60"
                style={{ color: "var(--text-secondary)" }}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-secondary)" }}
              >
                <ChevronDown />
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
