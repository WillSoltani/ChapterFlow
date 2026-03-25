"use client";

import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";

type SettingsSearchProps = {
  query: string;
  onChange: (query: string) => void;
};

export function SettingsSearch({ query, onChange }: SettingsSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        onChange("");
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onChange]);

  return (
    <div
      role="search"
      className="sticky top-0 z-10 -mx-4 px-4 py-2 sm:static sm:mx-0 sm:px-0 sm:py-0"
      style={{ WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)" }}
    >
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--cf-text-soft) pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          aria-label="Search settings"
          placeholder="Search settings..."
          value={query}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded-2xl border bg-(--cf-surface) py-3 pl-11 pr-20 text-sm text-(--cf-text-1) placeholder:text-(--cf-text-soft)",
            "backdrop-blur-md transition-all duration-200",
            "border-(--cf-border) focus:border-(--cf-border-strong) focus:shadow-[0_0_12px_var(--cf-accent-shadow)]",
            "focus:outline-none focus:ring-1 focus:ring-(--cf-accent)/20"
          )}
        />
        {/* Keyboard shortcut hint */}
        {!query && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[11px] text-(--cf-text-soft) pointer-events-none">
            <kbd className="rounded border border-(--cf-border-strong) bg-(--cf-surface-muted) px-1.5 py-0.5 font-mono text-[10px]">
              &#8984;K
            </kbd>
          </span>
        )}
        {/* Clear button */}
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full hover:bg-(--cf-surface-strong) text-(--cf-text-soft) transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
