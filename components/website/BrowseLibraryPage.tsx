"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { BookCover } from "@/app/book/components/BookCover";
import { BookRequestSection } from "@/components/website/BookRequestSection";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { BOOKS_CATALOG, getBookSynopsis } from "@/app/book/data/booksCatalog";
import { BOOK_PACKAGES } from "@/app/book/data/bookPackages";
import { getBookCoverPath } from "@/lib/book-covers";

/* ================================================================== */
/*  TYPES                                                              */
/* ================================================================== */

interface LibraryBook {
  id: string;
  title: string;
  author: string;
  category: string;
  chapters: number;
  difficulty: "easy" | "medium" | "hard";
  estimatedHours: number;
  description: string;
  rating: number;
  popular?: boolean;
  isNew?: boolean;
  staffPick?: boolean;
  isFree?: boolean;
  coverId?: string;
}

type SortOption = "popular" | "newest" | "shortest" | "alphabetical";

/* ================================================================== */
/*  BOOK DATA — derived from the real catalog (95 books)               */
/* ================================================================== */

const POPULAR_IDS = new Set([
  "the-48-laws-of-power", "friends-and-influence",
]);

const NEW_IDS = new Set<string>([]);

const FREE_IDS = new Set(["friends-and-influence"]);

const STAFF_PICK_IDS = new Set([
  "the-48-laws-of-power",
]);

function makeRating(id: string): number {
  let h = 0;
  for (const c of id) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return +(4.2 + (Math.abs(h) % 8) * 0.1).toFixed(1);
}

const CHAPTER_COUNTS = new Map(
  BOOK_PACKAGES.map((pkg) => [pkg.book.bookId, pkg.chapters.length]),
);

const ALL_BOOKS: LibraryBook[] = BOOKS_CATALOG.map((cat) => {
  const synopsis = getBookSynopsis(cat.id);
  const desc =
    synopsis.length > 120
      ? synopsis.substring(0, synopsis.indexOf(".", 40) + 1) || synopsis.substring(0, 117) + "..."
      : synopsis;

  return {
    id: cat.id,
    title: cat.title,
    author: cat.author,
    category: cat.category,
    chapters: CHAPTER_COUNTS.get(cat.id) || 6,
    difficulty: cat.difficulty.toLowerCase() as "easy" | "medium" | "hard",
    estimatedHours: Math.round((cat.estimatedMinutes / 60) * 10) / 10,
    description: desc || cat.title,
    rating: makeRating(cat.id),
    popular: POPULAR_IDS.has(cat.id),
    isNew: NEW_IDS.has(cat.id),
    isFree: FREE_IDS.has(cat.id),
    staffPick: STAFF_PICK_IDS.has(cat.id),
  };
});

const FEATURED_BOOK = ALL_BOOKS.find((b) => b.id === "the-48-laws-of-power") || ALL_BOOKS[0];

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */

function getCategoriesWithCounts(books: LibraryBook[]) {
  const counts = new Map<string, number>();
  books.forEach((b) => counts.set(b.category, (counts.get(b.category) || 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function sortBooks(books: LibraryBook[], sort: SortOption): LibraryBook[] {
  const sorted = [...books];
  switch (sort) {
    case "popular":
      return sorted.sort((a, b) => (a.popular === b.popular ? b.rating - a.rating : a.popular ? -1 : 1));
    case "newest":
      return sorted.sort((a, b) => (a.isNew === b.isNew ? b.rating - a.rating : a.isNew ? -1 : 1));
    case "shortest":
      return sorted.sort((a, b) => a.estimatedHours - b.estimatedHours);
    case "alphabetical":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest added" },
  { value: "shortest", label: "Shortest read" },
  { value: "alphabetical", label: "Alphabetical" },
];

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Beginner",
  medium: "Intermediate",
  hard: "Advanced",
};

function getBookBadge(book: LibraryBook): { label: string; color: string } | null {
  if (book.isFree) return { label: "Free", color: "var(--accent-emerald)" };
  if (book.isNew) return { label: "New", color: "var(--accent-cyan)" };
  if (book.popular) return { label: "Trending", color: "var(--accent-amber)" };
  if (book.staffPick) return { label: "Editor's Pick", color: "var(--accent-amber)" };
  return null;
}

function coverPath(book: LibraryBook) {
  return getBookCoverPath(book.id, book.coverId);
}

function avgMinPerChapter(book: LibraryBook) {
  return Math.round((book.estimatedHours * 60) / book.chapters);
}

/* ================================================================== */
/*  ICONS (inline SVGs)                                                */
/* ================================================================== */

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/* ================================================================== */
/*  SEARCH BAR                                                         */
/* ================================================================== */

function SearchBar({
  query,
  onChange,
  books,
}: {
  query: string;
  onChange: (q: string) => void;
  books: LibraryBook[];
}) {
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return books
      .filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [query, books]);

  const showDropdown = focused && query.length >= 2;

  return (
    <div className="relative">
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${focused ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.08)"}`,
        }}
      >
        <SearchIcon />
        <input
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder="Search by title, author, or topic..."
          className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[--text-muted]"
          style={{ color: "var(--text-heading)", fontFamily: "var(--font-body)" }}
          aria-label="Search books"
        />
        {query && (
          <button
            onClick={() => onChange("")}
            className="text-[--text-muted] hover:text-[--text-heading] transition-colors text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          }}
        >
          {results.length > 0 ? (
            results.map((book) => (
              <Link
                key={book.id}
                href={`/book/library/${book.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
              >
                <div className="w-8 h-12 shrink-0 rounded overflow-hidden">
                  <BookCover
                    bookId={book.coverId || book.id}
                    title={book.title}
                    icon="📚"
                    coverImage={coverPath(book)}
                    className="w-full h-full"
                    interactive={false}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate" style={{ color: "var(--text-heading)" }}>
                    {book.title}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {book.author}
                  </p>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}
                >
                  {book.category}
                </span>
              </Link>
            ))
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
                No books found for &ldquo;{query}&rdquo;
              </p>
              <p className="text-[12px] mt-1 cursor-pointer hover:underline" style={{ color: "var(--accent-teal)" }}>
                Request this book
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  FEATURED BOOK SPOTLIGHT                                            */
/* ================================================================== */

function FeaturedBookSpotlight({ book }: { book: LibraryBook }) {
  return (
    <div className="flex gap-5 items-center overflow-hidden">
      <div className="shrink-0 w-[100px] sm:w-[130px] md:w-[150px] aspect-[2/3] transform -rotate-2 transition-transform hover:rotate-0 duration-300">
        <BookCover
          bookId={book.coverId || book.id}
          title={book.title}
          icon="📚"
          coverImage={coverPath(book)}
          className="w-full h-full rounded-xl shadow-shadow-elevated"
          interactive={false}
        />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className="text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider w-fit"
          style={{ background: "rgba(34,211,238,0.1)", color: "var(--accent-teal)" }}
        >
          Editor&apos;s Pick
        </span>
        <h3
          className="text-[18px] md:text-[20px] font-bold mt-2 leading-snug"
          style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
        >
          {book.title}
        </h3>
        <p className="text-[14px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {book.author}
        </p>
        <p className="text-[13px] mt-2 leading-relaxed hidden md:block" style={{ color: "var(--text-muted)" }}>
          {book.description}
        </p>
        <p className="text-[12px] mt-2" style={{ color: "var(--text-muted)" }}>
          {book.chapters} chapters · ~{avgMinPerChapter(book)}m each · ★ {book.rating.toFixed(1)}
        </p>
        <Link
          href={`/book/library/${book.id}`}
          className="mt-3 text-[13px] font-semibold hover:underline underline-offset-4 w-fit"
          style={{ color: "var(--accent-teal)" }}
        >
          Start reading →
        </Link>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  LIBRARY HERO (compact — max 40% viewport)                          */
/* ================================================================== */

function LibraryHero({
  searchQuery,
  onSearchChange,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  return (
    <section className="pt-28 lg:pt-32 pb-10 lg:pb-14">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-10 lg:gap-8 items-center">
          {/* Left column */}
          <SectionReveal>
            <div>
              <SectionLabel>THE LIBRARY</SectionLabel>
              <h1
                className="mt-3 text-[28px] md:text-[36px] lg:text-[42px] font-bold leading-[1.1] tracking-tight"
                style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
              >
                Handpicked books, structured for retention.
              </h1>
              <p
                className="mt-3 text-[15px] md:text-[16px] leading-[1.7] max-w-[520px]"
                style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
              >
                95+ non-fiction titles across psychology, productivity, leadership, and more.
                Each one broken into chapter summaries, real-world scenarios, and retention quizzes.
              </p>
              <div className="mt-5">
                <SearchBar query={searchQuery} onChange={onSearchChange} books={ALL_BOOKS} />
              </div>
            </div>
          </SectionReveal>

          {/* Right column — Featured book */}
          <SectionReveal delay={0.15}>
            <div
              className="rounded-2xl p-5 md:p-6"
              style={{
                background: "var(--bg-glass)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <FeaturedBookSpotlight book={FEATURED_BOOK} />
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  FILTER BAR (sticky below navbar)                                   */
/* ================================================================== */

function FilterBar({
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

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return;
    const close = () => setSortOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [sortOpen]);

  return (
    <>
      <div ref={sentinelRef} className="h-0" />
      <div
        className="sticky z-40 transition-all duration-300 py-3"
        style={{
          top: 60,
          background: isSticky ? "color-mix(in srgb, var(--bg-base) 85%, transparent)" : "transparent",
          backdropFilter: isSticky ? "blur(24px)" : "none",
          WebkitBackdropFilter: isSticky ? "blur(24px)" : "none",
          borderBottom: isSticky ? "1px solid var(--border-subtle)" : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4">
          {/* Category pills */}
          <div className="flex-1 overflow-x-auto hide-scrollbar">
            <div className="flex gap-2" role="tablist" aria-label="Filter by category">
              <button
                role="tab"
                aria-selected={activeCategory === "All"}
                onClick={() => onCategoryChange("All")}
                className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-200"
                style={
                  activeCategory === "All"
                    ? { background: "var(--accent-teal)", color: "#0a0f1a", fontWeight: 600 }
                    : { background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.08)" }
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
                  className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-200 whitespace-nowrap"
                  style={
                    activeCategory === cat.name
                      ? { background: "var(--accent-teal)", color: "#0a0f1a", fontWeight: 600 }
                      : { background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.08)" }
                  }
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>
          </div>

          {/* Result count */}
          <span className="hidden md:block text-[12px] shrink-0" style={{ color: "var(--text-muted)" }}>
            Showing {resultCount} of {totalCount}
          </span>

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setSortOpen((p) => !p); }}
              className="flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="hidden sm:inline">Sort:</span>{" "}
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
              <ChevronDown />
            </button>

            {sortOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden z-50"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { onSortChange(opt.value); setSortOpen(false); }}
                    className="block w-full text-left px-4 py-2.5 text-[13px] transition-colors hover:bg-white/5"
                    style={{
                      color: sortBy === opt.value ? "var(--accent-teal)" : "var(--text-secondary)",
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

/* ================================================================== */
/*  BOOK CARD                                                          */
/* ================================================================== */

function BookCard({ book, showCategoryTag = false }: { book: LibraryBook; showCategoryTag?: boolean }) {
  const badge = getBookBadge(book);

  return (
    <Link href={`/book/library/${book.id}`} className="group block">
      {/* Cover */}
      <div className="relative overflow-hidden rounded-lg aspect-[2/3] transition-all duration-200 group-hover:scale-[1.04] group-hover:shadow-shadow-elevated">
        <BookCover
          bookId={book.coverId || book.id}
          title={book.title}
          icon="📚"
          coverImage={coverPath(book)}
          className="w-full h-full"
          interactive={false}
        />

        {/* Badge */}
        {badge && (
          <span
            className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full z-10"
            style={{ background: badge.color, color: "#0a0f1a" }}
          >
            {badge.label}
          </span>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-x-0 bottom-0 h-[50%] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)" }}
        >
          <p className="text-[12px] text-white/80 line-clamp-2 leading-relaxed">
            {book.description}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
            >
              {DIFFICULTY_LABEL[book.difficulty]}
            </span>
            <span className="text-[11px] font-medium ml-auto" style={{ color: "var(--accent-teal)" }}>
              Start reading →
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-2.5">
        <h4
          className="text-[14px] font-semibold line-clamp-2 leading-snug"
          style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
        >
          {book.title}
        </h4>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {book.author}
        </p>
        {showCategoryTag && (
          <span
            className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {book.category}
          </span>
        )}
        <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
          <span style={{ color: "var(--accent-teal)" }}>★</span>
          {book.rating.toFixed(1)} · {book.chapters} ch · ~{avgMinPerChapter(book)}m
        </p>
      </div>
    </Link>
  );
}

/* ================================================================== */
/*  HORIZONTAL BOOK ROW                                                */
/* ================================================================== */

function BookRow({
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
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (books.length === 0) return null;

  return (
    <div className="group/row">
      {/* Row header */}
      <div className="flex justify-between items-center mb-4 px-4 max-w-7xl mx-auto">
        <h3
          className="text-[18px] font-semibold"
          style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
        >
          {icon && <span className="mr-1.5">{icon}</span>}
          {title}
        </h3>
        {onSeeAll && seeAllLabel && (
          <button
            onClick={onSeeAll}
            className="text-[13px] font-medium hover:underline underline-offset-4 transition-colors"
            style={{ color: "var(--accent-teal)" }}
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
            className="absolute left-2 top-1/3 -translate-y-1/2 z-10 w-10 h-10 rounded-full hidden md:flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
            style={{
              background: "rgba(17, 24, 39, 0.85)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            aria-label="Scroll left"
          >
            <ChevronLeft />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto hide-scrollbar px-4"
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
              <BookCard book={book} showCategoryTag={showCategoryTag} />
            </div>
          ))}
          {/* Right padding to allow last card to snap */}
          <div className="shrink-0 w-4" />
        </div>

        {/* Right arrow */}
        {canRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/3 -translate-y-1/2 z-10 w-10 h-10 rounded-full hidden md:flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
            style={{
              background: "rgba(17, 24, 39, 0.85)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
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

/* ================================================================== */
/*  CATEGORY ROWS (default "All" view)                                 */
/* ================================================================== */

const MIN_ROW_SIZE = 4;

function CategoryRows({
  books,
  onSelectCategory,
}: {
  books: LibraryBook[];
  onSelectCategory: (cat: string) => void;
}) {
  const popularBooks = useMemo(() => books.filter((b) => b.popular), [books]);
  const newBooks = useMemo(() => books.filter((b) => b.isNew), [books]);
  const categories = getCategoriesWithCounts(books);

  const largeCategories = useMemo(
    () => categories.filter((c) => c.count >= MIN_ROW_SIZE),
    [categories],
  );
  const exploreMoreBooks = useMemo(() => {
    const smallCatNames = new Set(categories.filter((c) => c.count < MIN_ROW_SIZE).map((c) => c.name));
    return books.filter((b) => smallCatNames.has(b.category));
  }, [books, categories]);

  return (
    <div className="space-y-12 py-8">
      {/* Most Read This Week */}
      {popularBooks.length > 0 && (
        <BookRow title="Most Read This Week" icon="🔥" books={popularBooks} showCategoryTag />
      )}

      {/* New This Month */}
      {newBooks.length > 0 && (
        <BookRow title="New This Month" icon="✨" books={newBooks} showCategoryTag />
      )}

      {/* Large category rows (4+ books each) */}
      {largeCategories.map((cat) => {
        const catBooks = books.filter((b) => b.category === cat.name);
        return (
          <BookRow
            key={cat.name}
            title={cat.name}
            books={catBooks}
            onSeeAll={() => onSelectCategory(cat.name)}
            seeAllLabel={`See all ${cat.count} →`}
          />
        );
      })}

      {/* Explore More Topics — consolidated small categories */}
      {exploreMoreBooks.length > 0 && (
        <BookRow title="Explore More Topics" icon="🔍" books={exploreMoreBooks} showCategoryTag />
      )}
    </div>
  );
}

/* ================================================================== */
/*  CATEGORY GRID (filtered view)                                      */
/* ================================================================== */

function CategoryGrid({
  books,
  categoryName,
}: {
  books: LibraryBook[];
  categoryName: string;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h3
        className="text-[22px] font-bold mb-6"
        style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
      >
        {categoryName}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  ZERO RESULTS                                                       */
/* ================================================================== */

function ZeroResults({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.1)" }}
      >
        <SearchIcon />
      </div>
      <h3 className="text-[20px] font-bold" style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}>
        No books found
      </h3>
      {query.trim() && (
        <p className="text-[14px] mt-2" style={{ color: "var(--text-secondary)" }}>
          Nothing matched &ldquo;{query}&rdquo;. Try a different search or browse by category.
        </p>
      )}
      <button
        onClick={onClear}
        className="mt-5 text-[13px] font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer"
        style={{ background: "var(--bg-raised)", border: "1px solid var(--border-medium)", color: "var(--text-heading)" }}
      >
        Clear search
      </button>
    </div>
  );
}

/* ================================================================== */
/*  BOTTOM CTA                                                         */
/* ================================================================== */

function BottomCTA() {
  return (
    <section className="pt-4 pb-14 lg:pt-6 lg:pb-16 px-4">
      <SectionReveal>
        <div
          className="max-w-[640px] mx-auto text-center rounded-2xl p-8 md:p-10"
          style={{
            background: "var(--bg-glass)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <SectionLabel>START WITH ONE CHAPTER</SectionLabel>

          <h2
            className="mt-3 text-[24px] md:text-[30px] font-bold leading-[1.15]"
            style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
          >
            Every book follows the same proven loop.
          </h2>

          <p
            className="mt-3 text-[15px] leading-[1.7] max-w-md mx-auto"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
          >
            Read the summary. See it applied in real life. Prove you understood it.
            Unlock the next chapter.
          </p>

          <div className="mt-6">
            <Link
              href="/auth/login?returnTo=%2Fbook"
              className="cta-shine inline-flex items-center rounded-full px-7 py-3.5 font-semibold text-[15px] transition-transform hover:scale-[1.03] active:scale-[0.98]"
              style={{ backgroundColor: "var(--accent-teal)", color: "#0a0f1a" }}
            >
              Start reading free →
            </Link>
          </div>

          <p className="mt-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
            No credit card · 2 books free · Cancel anytime
          </p>
        </div>
      </SectionReveal>
    </section>
  );
}

/* ================================================================== */
/*  MAIN PAGE COMPONENT                                                */
/* ================================================================== */

export function BrowseLibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortOption>("popular");

  const categories = useMemo(() => getCategoriesWithCounts(ALL_BOOKS), []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Filtered + sorted books
  const filteredBooks = useMemo(() => {
    let result: LibraryBook[] = ALL_BOOKS;

    if (activeCategory !== "All") {
      result = result.filter((b) => b.category === activeCategory);
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

    return sortBooks(result, sortBy);
  }, [activeCategory, debouncedQuery, sortBy]);

  const handleCategoryChange = useCallback((cat: string) => {
    setActiveCategory(cat);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
    setActiveCategory("All");
  }, []);

  const isAllView = activeCategory === "All" && !debouncedQuery.trim();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Noise overlay */}
      <div className="noise-overlay pointer-events-none fixed inset-0 z-0" aria-hidden />

      {/* Background gradient */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background: [
            "radial-gradient(ellipse 60vw 50vw at 30% 0%, rgba(34, 211, 238, 0.04), transparent)",
            "var(--bg-base)",
          ].join(", "),
        }}
      />

      <Navbar />

      <LibraryHero searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <FilterBar
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        sortBy={sortBy}
        onSortChange={setSortBy}
        resultCount={filteredBooks.length}
        totalCount={ALL_BOOKS.length}
      />

      {/* Browse area */}
      <AnimatePresence mode="wait">
        {filteredBooks.length === 0 ? (
          <motion.div
            key="zero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ZeroResults query={debouncedQuery} onClear={handleClearSearch} />
          </motion.div>
        ) : isAllView ? (
          <motion.div
            key="rows"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CategoryRows books={filteredBooks} onSelectCategory={handleCategoryChange} />
          </motion.div>
        ) : (
          <motion.div
            key={`grid-${activeCategory}-${debouncedQuery}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CategoryGrid
              books={filteredBooks}
              categoryName={activeCategory !== "All" ? activeCategory : `Results for "${debouncedQuery}"`}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="-mb-10">
        <BookRequestSection />
      </div>
      <BottomCTA />
      <Footer />
    </div>
  );
}
