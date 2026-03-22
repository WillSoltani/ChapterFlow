"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { SearchDropdown } from "./SearchDropdown";
import type { LibraryBook } from "./libraryData";

interface LibraryHeaderProps {
  totalBooks: number;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (query: string) => void;
  onClearSearch: () => void;
  onBookSelect: (bookId: string) => void;
  onCategoryClick: (category: string) => void;
  books: LibraryBook[];
}

export function LibraryHeader({
  totalBooks,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  onBookSelect,
  onCategoryClick,
  books,
}: LibraryHeaderProps) {
  const [focused, setFocused] = useState(false);
  const [recentSearches] = useState<string[]>(["Atomic Habits", "psychology"]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // "/" keyboard shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setFocused(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        onSearchSubmit(searchQuery.trim());
        setFocused(false);
        inputRef.current?.blur();
      }
    },
    [searchQuery, onSearchSubmit]
  );

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="py-6" style={{ maxWidth: 1080, margin: "0 auto" }}>
      {/* Title row */}
      <div className="flex items-center justify-between">
        <h1
          className="font-(family-name:--font-display) text-[28px] font-bold"
          style={{ color: "var(--text-heading)" }}
        >
          Library
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {totalBooks} books
          </span>
          {/* View toggle — hidden mobile */}
          <div
            className="hidden items-center rounded-lg p-1 md:flex"
            style={{ background: "var(--bg-raised)" }}
          >
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              className="cursor-pointer rounded-md p-1.5 transition-all"
              style={{
                background: viewMode === "grid" ? "var(--bg-elevated)" : "transparent",
                color: viewMode === "grid" ? "var(--text-heading)" : "var(--text-muted)",
              }}
              aria-label="Grid view"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className="cursor-pointer rounded-md p-1.5 transition-all"
              style={{
                background: viewMode === "list" ? "var(--bg-elevated)" : "transparent",
                color: viewMode === "list" ? "var(--text-heading)" : "var(--text-muted)",
              }}
              aria-label="List view"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="14" height="2.5" rx="1" />
                <rect x="1" y="6.75" width="14" height="2.5" rx="1" />
                <rect x="1" y="11.5" width="14" height="2.5" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mt-4" ref={containerRef}>
        <form onSubmit={handleSubmit}>
          <div
            className="flex h-12 items-center gap-2.5 px-4 transition-all"
            style={{
              background: "var(--bg-raised)",
              border: `1px solid ${focused ? "var(--accent-blue)" : "var(--border-subtle)"}`,
              borderRadius: "var(--radius-lg-val)",
              boxShadow: focused
                ? "0 0 0 3px rgba(45,212,191,0.1)"
                : "none",
            }}
          >
            {/* Search icon */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>

            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder="Search by title, author, or topic..."
              className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--text-muted)]"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-body)",
              }}
            />

            {/* Clear button when active */}
            {isSearchActive && (
              <button
                type="button"
                onClick={onClearSearch}
                className="flex cursor-pointer items-center justify-center rounded-full p-1 transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-heading)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}

            {/* Keyboard hint */}
            {!isSearchActive && !focused && (
              <span
                className="rounded px-1.5 py-0.5 text-[11px]"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-muted)",
                }}
              >
                /
              </span>
            )}
          </div>
        </form>

        {/* Search dropdown */}
        <AnimatePresence>
          {focused && (
            <SearchDropdown
              query={searchQuery}
              books={books}
              recentSearches={recentSearches}
              onSelect={(id) => {
                onBookSelect(id);
                setFocused(false);
              }}
              onSearchSubmit={(q) => {
                onSearchSubmit(q);
                setFocused(false);
              }}
              onCategoryClick={(cat) => {
                onCategoryClick(cat);
                setFocused(false);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
