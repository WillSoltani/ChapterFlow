"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { BookRequestSection } from "@/components/website/BookRequestSection";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { FREE_OFFER_LABEL } from "@/lib/pricing";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";
import {
  ALL_BOOKS,
  filterAndSortBooks,
  getCategoriesWithCounts,
  type SortOption,
} from "./browse-library/browse-library-core";
import { BrowseLibraryFilterBar } from "./browse-library/BrowseLibraryFilterBar";
import { BrowseLibraryHero } from "./browse-library/BrowseLibraryHero";
import { BrowseLibraryResults } from "./browse-library/BrowseLibraryResults";

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
            className="mt-3 text-2xl md:text-3xl font-bold leading-[1.15]"
            style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
          >
            Every book follows the same proven loop.
          </h2>

          <p
            className="mt-3 text-cf-body leading-[1.7] max-w-md mx-auto"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
          >
            Read the summary. See it applied in real life. Prove you understood it.
            Practice what you learned.
          </p>

          <div className="mt-6">
            <Link
              href={AUTH_LOGIN_BOOK_URL}
              onClick={() => track("cta_click", { source: "browse_library_bottom_cta" })}
              className="cta-shine inline-flex items-center rounded-full px-7 py-3.5 font-semibold text-cf-body transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
              style={{ backgroundColor: "var(--accent-cyan)", color: "var(--primary-foreground)" }}
            >
              Open my first book →
            </Link>
          </div>

          <p className="mt-3 text-cf-label-sm" style={{ color: "var(--text-muted)" }}>
            No credit card · {FREE_OFFER_LABEL} · Cancel anytime
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
  const [requestTitle, setRequestTitle] = useState("");
  const requestSectionRef = useRef<HTMLDivElement>(null);
  const seededFromUrl = useRef(false);

  const categories = useMemo(() => getCategoriesWithCounts(ALL_BOOKS), []);

  // Prefill the request form with the searched title and scroll to it. Used by
  // the zero-results states so the "Request this book" affordance is real.
  const handleRequestBook = useCallback((title: string) => {
    setRequestTitle(title.trim());
    track("book_request_prefill", { source: "browse_zero_results", title: title.trim() });
    requestAnimationFrame(() => {
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      requestSectionRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start",
      });
    });
  }, []);

  // Seed the search from a ?q= URL param (deep links from JSON-LD / the
  // WebSite SearchAction, e.g. /books?q=Deep%20Work). Client-only read, guarded
  // so it seeds state exactly once (never re-fires setState on a later render
  // or a StrictMode/fast-refresh remount).
  useEffect(() => {
    if (seededFromUrl.current) return;
    seededFromUrl.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      // One-time seed from the client-only URL query on mount. A lazy useState
      // initializer would read window during SSR (hydration mismatch) and
      // useSearchParams() would force a Suspense boundary on this client page,
      // so a ref-guarded mount effect is the correct pattern here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery(q);
      setDebouncedQuery(q);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Filtered + sorted books
  const filteredBooks = useMemo(
    () => filterAndSortBooks(ALL_BOOKS, { category: activeCategory, query: debouncedQuery, sort: sortBy }),
    [activeCategory, debouncedQuery, sortBy],
  );

  const handleCategoryChange = useCallback((cat: string) => {
    setActiveCategory(cat);
    track("library_category_filter", { category: cat });
  }, []);

  const handleSortChange = useCallback((s: SortOption) => {
    setSortBy(s);
    track("library_sort_change", { sort: s });
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
            "radial-gradient(ellipse 60vw 50vw at 30% 0%, color-mix(in srgb, var(--accent-cyan) 4%, transparent), transparent)",
            "var(--bg-base)",
          ].join(", "),
        }}
      />

      <Navbar />

      <BrowseLibraryHero
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRequestBook={handleRequestBook}
      />

      <BrowseLibraryFilterBar
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        resultCount={filteredBooks.length}
        totalCount={ALL_BOOKS.length}
      />

      {/* Browse area */}
      <BrowseLibraryResults
        books={filteredBooks}
        activeCategory={activeCategory}
        query={debouncedQuery}
        isAllView={isAllView}
        onClear={handleClearSearch}
        onRequestBook={handleRequestBook}
        onSelectCategory={handleCategoryChange}
      />

      <div className="-mb-10" ref={requestSectionRef}>
        <BookRequestSection initialTitle={requestTitle} />
      </div>
      <BottomCTA />
      <Footer />
    </div>
  );
}
