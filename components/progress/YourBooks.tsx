"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { ActiveBook, CompletedBook } from "./progressTypes";
import { ActiveBookRow, CompletedBookRow } from "./BookRow";

type BookFilter = "active" | "completed" | "all";

interface YourBooksProps {
  activeBooks: ActiveBook[];
  completedBooks: CompletedBook[];
}

export function YourBooks({ activeBooks, completedBooks }: YourBooksProps) {
  const prefersReduced = useReducedMotion();
  const totalBooks = activeBooks.length + completedBooks.length;
  const hasBooks = totalBooks > 0;

  const [filter, setFilter] = useState<BookFilter>("active");

  const tabs: Array<{ id: BookFilter; label: string; count: number }> = [
    { id: "active", label: "Active", count: activeBooks.length },
    { id: "completed", label: "Completed", count: completedBooks.length },
    { id: "all", label: "All", count: totalBooks },
  ];

  return (
    <motion.section
      className="rounded-2xl p-5"
      style={{
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--cf-border)",
        boxShadow: "var(--cf-shadow-md)",
      }}
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-heading)" }}
        >
          Your Books
        </h2>

        {/* Tab filters */}
        {hasBooks && (
          <div className="flex gap-1" role="tablist" aria-label="Book filter">
            {tabs.map((tab) => {
              const isActive = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setFilter(tab.id)}
                  className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)"
                  style={{
                    background: isActive
                      ? "rgba(34,211,238,0.15)"
                      : "transparent",
                    color: isActive
                      ? "var(--accent-cyan)"
                      : "var(--text-secondary)",
                    border: isActive
                      ? "1px solid rgba(34,211,238,0.3)"
                      : "1px solid transparent",
                  }}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      {!hasBooks ? (
        <div className="mt-4 flex flex-col items-center py-6 text-center">
          <p
            className="text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Your library is empty
          </p>
          <Link
            href="/book/library"
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            style={{
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            Browse Library {"\u2192"}
          </Link>
        </div>
      ) : (
        <div className="mt-3 flex flex-col divide-y" style={{ borderColor: "var(--cf-border)" }}>
          {/* Active books */}
          {(filter === "active" || filter === "all") &&
            activeBooks.map((book) => (
              <ActiveBookRow key={book.id} book={book} />
            ))}

          {/* Completed books */}
          {(filter === "completed" || filter === "all") &&
            completedBooks.map((book) => (
              <CompletedBookRow key={book.id} book={book} />
            ))}

          {/* Empty filter state */}
          {filter === "active" && activeBooks.length === 0 && (
            <p
              className="py-4 text-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              No active books
            </p>
          )}
          {filter === "completed" && completedBooks.length === 0 && (
            <p
              className="py-6 text-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              No completed books yet — finish your first book to see it here!
            </p>
          )}
        </div>
      )}
    </motion.section>
  );
}
