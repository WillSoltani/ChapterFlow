"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import type { LibraryBook } from "./browse-library-core";
import { ChevronLeft, ChevronRight } from "./BrowseLibraryIcons";
import { BrowseLibraryBookCard } from "./BrowseLibraryBookCard";

export function BrowseLibraryShelfRow({
  title,
  icon,
  books,
  onSeeAll,
  seeAllLabel,
  showCategoryTag = false,
}: {
  title: string;
  icon?: string;
  books: LibraryBook[];
  onSeeAll?: () => void;
  seeAllLabel?: string;
  showCategoryTag?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 10);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, books]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  if (books.length === 0) return null;

  return (
    <div className="group/row">
      {/* Row header */}
      <div className="flex justify-between items-center mb-4 px-4 max-w-7xl mx-auto">
        <h3
          className="text-lg font-semibold"
          style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
        >
          {icon && <span className="mr-1.5">{icon}</span>}
          {title}
        </h3>
        {onSeeAll && seeAllLabel && (
          <button
            onClick={onSeeAll}
            className="text-cf-label font-medium hover:underline underline-offset-4 transition-colors"
            style={{ color: "var(--accent-cyan)" }}
          >
            {seeAllLabel}
          </button>
        )}
      </div>

      {/* Scroll container */}
      <div className="relative">
        {/* Left arrow */}
        {canLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-[38%] -translate-y-1/2 z-10 w-10 h-10 rounded-full hidden md:flex items-center justify-center opacity-40 group-hover/row:opacity-100 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60"
            style={{
              background: "var(--bg-glass)",
              backdropFilter: "blur(8px)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-heading)",
            }}
            aria-label="Scroll left"
          >
            <ChevronLeft />
          </button>
        )}

        {/* Left fade */}
        {canLeft && (
          <div
            className="absolute left-0 top-0 bottom-0 w-20 pointer-events-none z-[5]"
            style={{ background: "linear-gradient(to right, var(--bg-base) 0%, transparent 100%)" }}
          />
        )}

        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto scrollbar-hide px-4"
          style={{ scrollSnapType: "x mandatory", scrollPaddingLeft: 16 }}
        >
          {/* Left padding for max-w alignment */}
          <div className="shrink-0 w-[calc((100vw-1280px)/2)]" style={{ minWidth: 0 }} />
          {books.map((book) => (
            <div
              key={book.id}
              className="shrink-0 w-[160px] sm:w-[180px] md:w-[200px] lg:w-[210px]"
              style={{ scrollSnapAlign: "start" }}
            >
              <BrowseLibraryBookCard book={book} showCategoryTag={showCategoryTag} />
            </div>
          ))}
          {/* Right padding to allow last card to snap */}
          <div className="shrink-0 w-4" />
        </div>

        {/* Right fade */}
        {canRight && (
          <div
            className="absolute right-0 top-0 bottom-0 w-20 pointer-events-none z-[5]"
            style={{ background: "linear-gradient(to left, var(--bg-base) 0%, transparent 100%)" }}
          />
        )}

        {/* Right arrow */}
        {canRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-[38%] -translate-y-1/2 z-10 w-10 h-10 rounded-full hidden md:flex items-center justify-center opacity-40 group-hover/row:opacity-100 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60"
            style={{
              background: "var(--bg-glass)",
              backdropFilter: "blur(8px)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-heading)",
            }}
            aria-label="Scroll right"
          >
            <ChevronRight />
          </button>
        )}
      </div>
    </div>
  );
}
