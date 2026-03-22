"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { BrowseHero } from "@/components/website/BrowseHero";
import { CategoryChipBar } from "@/components/website/CategoryChipBar";
import { BookGrid } from "@/components/website/BookGrid";
import { BookRequestSection } from "@/components/website/BookRequestSection";
import { BrowseCTA } from "@/components/website/BrowseCTA";
import { PopularBooksRow } from "@/components/website/PopularBooksRow";
import type { PublicBookCardProps } from "@/components/website/PublicBookCard";

/* ------------------------------------------------------------------ */
/*  Book data                                                         */
/* ------------------------------------------------------------------ */

type PublicBook = PublicBookCardProps;

const ALL_BOOKS: PublicBook[] = [
  { id: "atomic-habits", title: "Atomic Habits", author: "James Clear", category: "Productivity", chapters: 18, difficulty: "easy", coverGradient: "linear-gradient(135deg, #D97706, #B45309)", estimatedHours: 4, popular: true },
  { id: "deep-work", title: "Deep Work", author: "Cal Newport", category: "Productivity", chapters: 14, difficulty: "medium", coverGradient: "linear-gradient(135deg, #2563EB, #1E40AF)", estimatedHours: 3, popular: true },
  { id: "thinking-fast-and-slow", title: "Thinking, Fast and Slow", author: "Daniel Kahneman", category: "Psychology", chapters: 16, difficulty: "hard", coverGradient: "linear-gradient(135deg, #0D9488, #0F766E)", estimatedHours: 5, popular: true },
  { id: "the-48-laws-of-power", title: "The 48 Laws of Power", author: "Robert Greene", category: "Strategy", chapters: 20, difficulty: "hard", coverGradient: "linear-gradient(135deg, #7C3AED, #6D28D9)", estimatedHours: 6, popular: true },
  { id: "never-split-the-difference", title: "Never Split the Difference", author: "Chris Voss", category: "Negotiation", chapters: 10, difficulty: "medium", coverGradient: "linear-gradient(135deg, #DC2626, #B91C1C)", estimatedHours: 3, popular: true },
  { id: "the-power-of-habit", title: "The Power of Habit", author: "Charles Duhigg", category: "Psychology", chapters: 12, difficulty: "easy", coverGradient: "linear-gradient(135deg, #059669, #047857)", estimatedHours: 3 },
  { id: "mindset", title: "Mindset", author: "Carol S. Dweck", category: "Psychology", chapters: 8, difficulty: "easy", coverGradient: "linear-gradient(135deg, #DB2777, #BE185D)", estimatedHours: 2 },
  { id: "essentialism", title: "Essentialism", author: "Greg McKeown", category: "Productivity", chapters: 10, difficulty: "easy", coverGradient: "linear-gradient(135deg, #0891B2, #0E7490)", estimatedHours: 3 },
  { id: "influence", title: "Influence", author: "Robert Cialdini", category: "Psychology", chapters: 12, difficulty: "medium", coverGradient: "linear-gradient(135deg, #EA580C, #C2410C)", estimatedHours: 3 },
  { id: "start-with-why", title: "Start With Why", author: "Simon Sinek", category: "Leadership", chapters: 10, difficulty: "easy", coverGradient: "linear-gradient(135deg, #4F46E5, #4338CA)", estimatedHours: 2, staffPick: true },
  { id: "zero-to-one", title: "Zero to One", author: "Peter Thiel", category: "Strategy", chapters: 14, difficulty: "medium", coverGradient: "linear-gradient(135deg, #1D4ED8, #1E3A8A)", estimatedHours: 3 },
  { id: "the-lean-startup", title: "The Lean Startup", author: "Eric Ries", category: "Strategy", chapters: 12, difficulty: "medium", coverGradient: "linear-gradient(135deg, #16A34A, #15803D)", estimatedHours: 3 },
  { id: "good-to-great", title: "Good to Great", author: "Jim Collins", category: "Leadership", chapters: 9, difficulty: "medium", coverGradient: "linear-gradient(135deg, #0369A1, #075985)", estimatedHours: 3 },
  { id: "extreme-ownership", title: "Extreme Ownership", author: "Jocko Willink", category: "Leadership", chapters: 12, difficulty: "medium", coverGradient: "linear-gradient(135deg, #4B5563, #374151)", estimatedHours: 3 },
  { id: "mans-search-for-meaning", title: "Man's Search for Meaning", author: "Viktor Frankl", category: "Philosophy", chapters: 8, difficulty: "medium", coverGradient: "linear-gradient(135deg, #78350F, #92400E)", estimatedHours: 2, staffPick: true },
  { id: "meditations", title: "Meditations", author: "Marcus Aurelius", category: "Philosophy", chapters: 12, difficulty: "medium", coverGradient: "linear-gradient(135deg, #854D0E, #A16207)", estimatedHours: 3 },
  { id: "the-obstacle-is-the-way", title: "The Obstacle Is the Way", author: "Ryan Holiday", category: "Philosophy", chapters: 10, difficulty: "easy", coverGradient: "linear-gradient(135deg, #B45309, #D97706)", estimatedHours: 2 },
  { id: "grit", title: "Grit", author: "Angela Duckworth", category: "Psychology", chapters: 13, difficulty: "medium", coverGradient: "linear-gradient(135deg, #BE185D, #9D174D)", estimatedHours: 3 },
  { id: "drive", title: "Drive", author: "Daniel H. Pink", category: "Psychology", chapters: 8, difficulty: "easy", coverGradient: "linear-gradient(135deg, #7E22CE, #6B21A8)", estimatedHours: 2 },
  { id: "the-charisma-myth", title: "The Charisma Myth", author: "Olivia Fox Cabane", category: "Communication", chapters: 12, difficulty: "medium", coverGradient: "linear-gradient(135deg, #0E7490, #155E75)", estimatedHours: 3 },
  { id: "crucial-conversations", title: "Crucial Conversations", author: "Kerry Patterson", category: "Communication", chapters: 12, difficulty: "medium", coverGradient: "linear-gradient(135deg, #B91C1C, #991B1B)", estimatedHours: 3 },
  { id: "how-to-talk-to-anyone", title: "How to Talk to Anyone", author: "Leil Lowndes", category: "Communication", chapters: 10, difficulty: "easy", coverGradient: "linear-gradient(135deg, #C026D3, #A21CAF)", estimatedHours: 2, isNew: true },
  { id: "friends-and-influence", title: "How to Win Friends and Influence People", author: "Dale Carnegie", category: "Communication", chapters: 14, difficulty: "easy", coverGradient: "linear-gradient(135deg, #059669, #047857)", estimatedHours: 3, popular: true, coverId: "friends-and-influence-student-edition" },
  { id: "antifragile", title: "Antifragile", author: "Nassim Taleb", category: "Strategy", chapters: 16, difficulty: "hard", coverGradient: "linear-gradient(135deg, #1E3A8A, #1E40AF)", estimatedHours: 5 },
  { id: "the-psychology-of-money", title: "The Psychology of Money", author: "Morgan Housel", category: "Psychology", chapters: 10, difficulty: "easy", coverGradient: "linear-gradient(135deg, #065F46, #064E3B)", estimatedHours: 2, isNew: true },
  { id: "rich-dad-poor-dad", title: "Rich Dad Poor Dad", author: "Robert Kiyosaki", category: "Self Help", chapters: 10, difficulty: "easy", coverGradient: "linear-gradient(135deg, #9D174D, #831843)", estimatedHours: 2 },
  { id: "cant-hurt-me", title: "Can't Hurt Me", author: "David Goggins", category: "Self Help", chapters: 11, difficulty: "medium", coverGradient: "linear-gradient(135deg, #1C1917, #44403C)", estimatedHours: 3, isNew: true },
  { id: "the-art-of-war", title: "The Art of War", author: "Sun Tzu", category: "Strategy", chapters: 13, difficulty: "medium", coverGradient: "linear-gradient(135deg, #991B1B, #7F1D1D)", estimatedHours: 2, coverId: "art-of-war" },
  { id: "mastery", title: "Mastery", author: "Robert Greene", category: "Self Help", chapters: 14, difficulty: "hard", coverGradient: "linear-gradient(135deg, #312E81, #3730A3)", estimatedHours: 4 },
  { id: "the-7-habits", title: "The 7 Habits of Highly Effective People", author: "Stephen Covey", category: "Productivity", chapters: 12, difficulty: "medium", coverGradient: "linear-gradient(135deg, #1E40AF, #1D4ED8)", estimatedHours: 3, staffPick: true, coverId: "the-7-habits-of-highly-effective-people" },
  { id: "make-time", title: "Make Time", author: "Jake Knapp", category: "Productivity", chapters: 8, difficulty: "easy", coverGradient: "linear-gradient(135deg, #F59E0B, #D97706)", estimatedHours: 2 },
  { id: "predictably-irrational", title: "Predictably Irrational", author: "Dan Ariely", category: "Psychology", chapters: 13, difficulty: "medium", coverGradient: "linear-gradient(135deg, #6D28D9, #5B21B6)", estimatedHours: 3 },
  { id: "the-hard-thing", title: "The Hard Thing About Hard Things", author: "Ben Horowitz", category: "Leadership", chapters: 10, difficulty: "hard", coverGradient: "linear-gradient(135deg, #374151, #1F2937)", estimatedHours: 3, coverId: "the-hard-thing-about-hard-things" },
  { id: "discipline-is-destiny", title: "Discipline Is Destiny", author: "Ryan Holiday", category: "Philosophy", chapters: 10, difficulty: "easy", coverGradient: "linear-gradient(135deg, #92400E, #78350F)", estimatedHours: 2, isNew: true },
  { id: "talk-like-ted", title: "Talk Like TED", author: "Carmine Gallo", category: "Communication", chapters: 9, difficulty: "easy", coverGradient: "linear-gradient(135deg, #E11D48, #BE123C)", estimatedHours: 2 },
];

/* ------------------------------------------------------------------ */
/*  Zero results state (inline)                                       */
/* ------------------------------------------------------------------ */

function ZeroResultsState({
  searchQuery,
  onClearSearch,
  topCategories,
  onSelectCategory,
}: {
  searchQuery: string;
  onClearSearch: () => void;
  topCategories: { name: string; count: number }[];
  onSelectCategory: (cat: string) => void;
}) {
  return (
    <div className="max-w-[480px] mx-auto px-4 py-20 text-center">
      {/* Empty icon */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{
          background: "rgba(79,139,255,0.06)",
          border: "1px solid rgba(79,139,255,0.1)",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>

      <h3
        className="text-[20px] font-bold"
        style={{
          color: "var(--text-heading)",
          fontFamily: "var(--font-display)",
        }}
      >
        No books found
      </h3>

      {searchQuery.trim() && (
        <p
          className="text-[14px] mt-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Nothing matched &ldquo;{searchQuery}&rdquo;. Try a different search or
          browse by category.
        </p>
      )}

      <button
        type="button"
        onClick={onClearSearch}
        className="mt-5 text-[13px] font-semibold px-5 py-2.5 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02]"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--border-medium)",
          color: "var(--text-heading)",
        }}
      >
        Clear search
      </button>

      {topCategories.length > 0 && (
        <div className="mt-8">
          <p
            className="text-[12px] font-semibold uppercase mb-3"
            style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
          >
            Try a category
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            {topCategories.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => onSelectCategory(cat.name)}
                className="text-[12px] font-medium px-4 py-1.5 rounded-full cursor-pointer transition-all duration-200"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-blue)";
                  e.currentTarget.style.color = "var(--accent-blue)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <PopularBooksRow />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                               */
/* ------------------------------------------------------------------ */

export function BrowseLibraryPage() {
  /* --- Categories derived from data --- */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    ALL_BOOKS.forEach((b) =>
      counts.set(b.category, (counts.get(b.category) || 0) + 1),
    );
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const totalChapters = useMemo(
    () => ALL_BOOKS.reduce((s, b) => s + b.chapters, 0),
    [],
  );

  /* --- State --- */
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const BOOKS_PER_PAGE = 20;

  /* --- Debounce search (200ms) + reset page --- */
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /* --- Compute filtered books --- */
  const filteredBooks = useMemo(() => {
    let result = ALL_BOOKS as PublicBook[];

    if (activeCategories.length > 0) {
      result = result.filter((b) => activeCategories.includes(b.category));
    }

    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q),
      );
    }

    return result;
  }, [debouncedQuery, activeCategories]);

  /* --- Handlers --- */
  const handleToggleCategory = useCallback(
    (cat: string) => {
      setActiveCategories((prev) =>
        prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
      );
      setPage(1);
    },
    [],
  );

  const handleClearAll = useCallback(() => {
    setActiveCategories([]);
    setPage(1);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
  }, []);

  const handleSelectCategory = useCallback(
    (cat: string) => {
      setSearchQuery("");
      setDebouncedQuery("");
      setActiveCategories([cat]);
    },
    [],
  );

  /* --- Render --- */
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <Navbar />

      <BrowseHero
        totalBooks={ALL_BOOKS.length}
        totalTopics={categories.length}
        totalChapters={totalChapters}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {filteredBooks.length > 0 ? (
        <>
          <CategoryChipBar
            categories={categories}
            activeCategories={activeCategories}
            onToggleCategory={handleToggleCategory}
            onClearAll={handleClearAll}
            resultCount={filteredBooks.length}
            totalCount={ALL_BOOKS.length}
          />

          <BookGrid
            books={filteredBooks}
            page={page}
            perPage={BOOKS_PER_PAGE}
            onPageChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 400, behavior: "smooth" });
            }}
          />

          <BookRequestSection />
        </>
      ) : (
        <ZeroResultsState
          searchQuery={debouncedQuery}
          onClearSearch={handleClearSearch}
          topCategories={categories.slice(0, 5)}
          onSelectCategory={handleSelectCategory}
        />
      )}

      <BrowseCTA />
      <Footer />
    </div>
  );
}
