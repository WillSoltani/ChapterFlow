"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CategoryChipBarProps {
  categories: { name: string; count: number }[];
  activeCategories: string[];
  onToggleCategory: (category: string) => void;
  onClearAll: () => void;
  resultCount: number;
  totalCount: number;
}

const VISIBLE_COUNT = 8;

export function CategoryChipBar({
  categories,
  activeCategories,
  onToggleCategory,
  onClearAll,
  resultCount,
  totalCount,
}: CategoryChipBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const visibleCategories = categories.slice(0, VISIBLE_COUNT);
  const overflowCategories = categories.slice(VISIBLE_COUNT);
  const hasOverflow = overflowCategories.length > 0;
  const isAllActive = activeCategories.length === 0;

  // Close dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;

    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  const chipBase: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    fontFamily: "var(--font-dm-sans)",
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 9999,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "all 0.2s",
    lineHeight: 1.4,
  };

  const inactiveStyle: React.CSSProperties = {
    ...chipBase,
    background: "transparent",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-secondary)",
  };

  const activeStyle: React.CSSProperties = {
    ...chipBase,
    background: "var(--accent-blue)",
    border: "1px solid var(--accent-blue)",
    color: "white",
  };

  function resultLabel() {
    if (activeCategories.length > 0) {
      return `Showing ${resultCount} books in ${activeCategories.join(", ")}`;
    }
    return `Showing ${resultCount} of ${totalCount} books`;
  }

  return (
    <div className="max-w-[1080px] mx-auto px-4 mt-6">
      {/* Chip row */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar flex-wrap lg:justify-center">
        {/* All chip */}
        <button
          type="button"
          style={isAllActive ? activeStyle : inactiveStyle}
          onClick={onClearAll}
          onMouseEnter={(e) => {
            if (!isAllActive) {
              e.currentTarget.style.background = "var(--bg-glass-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isAllActive) {
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          All
        </button>

        {/* Visible category chips */}
        {visibleCategories.map((cat) => {
          const isActive = activeCategories.includes(cat.name);
          return (
            <button
              key={cat.name}
              type="button"
              style={isActive ? activeStyle : inactiveStyle}
              onClick={() => onToggleCategory(cat.name)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--bg-glass-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span className="flex items-center gap-1.5">
                <span>
                  {cat.name} ({cat.count})
                </span>
                {isActive && (
                  <span style={{ fontSize: 11, marginLeft: 2, lineHeight: 1 }}>
                    ×
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {/* More + chip */}
        {hasOverflow && (
          <div ref={moreRef} className="relative">
            <button
              type="button"
              style={inactiveStyle}
              onClick={() => setMoreOpen((prev) => !prev)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-glass-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              More +
            </button>

            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-1/2 mt-2 z-50"
                  style={{
                    transform: "translateX(-50%)",
                    background: "var(--bg-raised)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: 12,
                    padding: 16,
                    boxShadow:
                      "0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)",
                    minWidth: 280,
                  }}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {overflowCategories.map((cat) => {
                      const isActive = activeCategories.includes(cat.name);
                      return (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => {
                            onToggleCategory(cat.name);
                            setMoreOpen(false);
                          }}
                          className="text-left"
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-dm-sans)",
                            fontWeight: 500,
                            paddingTop: 6,
                            paddingBottom: 6,
                            paddingLeft: 12,
                            paddingRight: 12,
                            borderRadius: 6,
                            cursor: "pointer",
                            transition: "all 0.15s",
                            whiteSpace: "nowrap",
                            background: isActive
                              ? "var(--accent-blue)"
                              : "transparent",
                            color: isActive
                              ? "white"
                              : "var(--text-secondary)",
                            border: "none",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background =
                                "var(--bg-glass-hover)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = "transparent";
                            }
                          }}
                        >
                          {cat.name} ({cat.count})
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Result count */}
      <p
        className="text-center mt-4"
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        {resultLabel()}
      </p>
    </div>
  );
}
